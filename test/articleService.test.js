// Tests for SPEC-BACKEND-CORE-001 article model + service (AC-1, AC-2, AC-3, AC-4, AC-13, AC-18)
// + SPEC-NEWS-REVISE-002 edit-lock + update + searchArticles regression guard
// (AC-EDIT-LOCK-1..7, AC-API-2/3/5, AC-SEARCH-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService, EDIT_LOCK_TIMEOUT_MS } from '../src/services/articleService.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createArticleService(db) };
}

// AC-1: create -> unique articleId, initial status RDS, persisted to Article + Contents
test('AC-1: create generates a unique 20-char articleId and stores RDS in Contents.status', () => {
  const { db, svc } = freshService();
  const result = svc.create({
    title: '속보',
    content: '본문',
    author: 'reporter1',
    department: '사회부',
  }, { now: new Date('2026-05-27T00:00:00Z') });

  assert.match(result.articleId, /^AKR20260527\d{9}$/);
  assert.equal(result.status, 'RDS');

  const contents = db.prepare('SELECT * FROM Contents WHERE articleId = ?').get(result.articleId);
  assert.equal(contents.status, 'RDS');
  assert.equal(contents.title, '속보');
  assert.equal(contents.author, 'reporter1');

  const article = db.prepare('SELECT * FROM Article WHERE articleId = ?').get(result.articleId);
  assert.equal(article.title, '속보');
});

// AC-2: query by each independent filter, AND combination, includes KILL states
test('AC-2: query supports each filter independently', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, title, author, sender, createdAt, distributedAt, status) VALUES (?,?,?,?,?,?,?)')
    .run('AKR202605270000000001', 't1', 'alice', 'bob', '2026-05-27', '2026-05-28', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, author, sender, createdAt, distributedAt, status) VALUES (?,?,?,?,?,?,?)')
    .run('AKR202605270000000002', 't2', 'carol', 'bob', '2026-05-26', '2026-05-29', 'RRK');

  assert.equal(svc.query({ author: 'alice' }).length, 1);
  assert.equal(svc.query({ sender: 'bob' }).length, 2);
  assert.equal(svc.query({ articleId: 'AKR202605270000000002' }).length, 1);
  assert.equal(svc.query({ createdAt: '2026-05-27' }).length, 1);
  assert.equal(svc.query({ distributedAt: '2026-05-28' }).length, 1);
});

test('AC-2: distributedAt filter uses Contents.distributedAt not sentAt', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, distributedAt, sentAt, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000010', '2026-05-28', '2026-05-01', 'RDS');
  assert.equal(svc.query({ distributedAt: '2026-05-28' }).length, 1);
  assert.equal(svc.query({ distributedAt: '2026-05-01' }).length, 0); // sentAt must not match
});

test('AC-2: multiple filters combine with AND', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, author, sender, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000003', 'alice', 'bob', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, author, sender, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000004', 'alice', 'dave', 'RDS');
  assert.equal(svc.query({ author: 'alice', sender: 'bob' }).length, 1);
  assert.equal(svc.query({ author: 'alice' }).length, 2);
});

test('AC-2: query results include KILL-state (RRK/DDK) articles', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
    .run('AKR202605270000000005', 'eve', 'RRK');
  const rows = svc.query({ author: 'eve' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'RRK');
});

test('AC-2: empty filter returns all articles', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000006', 'RDS');
  assert.equal(svc.query({}).length, 1);
});

// AC-3: update by articleId changes Contents.status; not-found rejected without changing rows
test('AC-3: update changes Contents.status by articleId', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.updateStatus('AKR202605270000000001', 'RRH');
  assert.equal(result.ok, true);
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'RRH');
});

test('AC-3: update of a missing articleId returns not-found and changes nothing', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.updateStatus('AKR999999990000000000', 'RRH');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-found');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'RDS'); // untouched
});

// AC-4: delete = soft delete -> KILL state, no physical DELETE, row count unchanged
test('AC-4: delete soft-deletes to RRK for role R, row preserved', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const before = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;
  const result = svc.remove('AKR202605270000000001', 'R');
  const after = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;

  assert.equal(result.ok, true);
  assert.equal(result.status, 'RRK');
  assert.equal(after, before);
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'RRK');
});

test('AC-4: delete soft-deletes to DDK for role D', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.remove('AKR202605270000000001', 'D');
  assert.equal(result.status, 'DDK');
});

// AC-13: send workflow routes through state machine and persists result
test('AC-13: send workflow (RDS + R + send) keeps RDS and persists', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.applyAction('AKR202605270000000001', 'R', 'send');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'RDS');
});

test('AC-13: send workflow (RDS + D + send) becomes DPS and persists to Contents.status', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.applyAction('AKR202605270000000001', 'D', 'send');
  assert.equal(result.status, 'DPS');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'DPS');
});

test('AC-11/13: undefined transition leaves Contents.status unchanged', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RRH');
  const result = svc.applyAction('AKR202605270000000001', 'R', 'send'); // RRH source not defined
  assert.equal(result.ok, false);
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'RRH'); // unchanged
});

// SPEC-NEWS-REVISE-001 D-6: Z권한 applyAction은 D권한과 동일하게 송고/보류/KILL 허용
test('D-6: applyAction (RDS + Z + send) becomes DPS and persists', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.applyAction('AKR202605270000000001', 'Z', 'send');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DPS');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'DPS');
});

test('D-6: applyAction (RDS + Z + hold) becomes DDH and persists', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.applyAction('AKR202605270000000001', 'Z', 'hold');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DDH');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'DDH');
});

test('D-6: remove with role Z soft-deletes to DDK', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202605270000000001', 'RDS');
  const result = svc.remove('AKR202605270000000001', 'Z');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DDK');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get('AKR202605270000000001');
  assert.equal(row.status, 'DDK');
});

test('AC-13: applyAction on a missing article returns not-found', () => {
  const { svc } = freshService();
  const result = svc.applyAction('AKR000000000000000000', 'R', 'send');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-found');
});

// SPEC-NEWS-REVISE-002 — AC-LOCKYN-3: lockYN round-trip through insert → findById → query.
test('AC-LOCKYN-3: created article has lockYN=\'N\' in findById/query results', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: '락 테스트', content: '본문', author: 'r1' },
    { now: new Date('2026-06-04T00:00:00Z') });
  const byId = db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(byId.lockYN, 'N');
  const found = svc.query({ articleId });
  assert.equal(found.length, 1);
  assert.equal(found[0].lockYN, 'N');
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-1: 빈 락 → 획득 성공 + locker 컬럼 채워짐.
test('AC-EDIT-LOCK-1: acquireEditLock on a free article succeeds and writes locker info', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  const T0 = new Date('2026-06-04T01:00:00Z');
  const result = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: T0 });
  assert.equal(result.ok, true);
  const row = db.prepare('SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?')
    .get(articleId);
  assert.equal(row.lockYN, 'Y');
  assert.equal(row.lockerUserId, 'U1');
  assert.equal(row.lockerSessionId, 'S1');
  assert.equal(row.lockedAt, T0.toISOString());
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-2: 다른 user/session 진입 거부.
test('AC-EDIT-LOCK-2: a different user/session is rejected with reason=locked; existing holder preserved', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:00:00Z') });
  const conflict = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'S2', now: new Date('2026-06-04T01:01:00Z') });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'locked');
  const row = db.prepare('SELECT lockerUserId FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockerUserId, 'U1');
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-3: release 후 재획득.
test('AC-EDIT-LOCK-3: releaseEditLock clears lock; another user can then acquire', () => {
  const { svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:00:00Z') });
  const released = svc.releaseEditLock(articleId, { userId: 'U1', sessionId: 'S1' });
  assert.equal(released.ok, true);
  const re = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'S2', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(re.ok, true);
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-5 (D2-5 = A, 엄격): 동일 user 다른 session 거부.
test('AC-EDIT-LOCK-5 (D2-5 strict): same user with a different sessionId is rejected', () => {
  const { svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1-P1', now: new Date('2026-06-04T01:00:00Z') });
  const otherPage = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1-P2', now: new Date('2026-06-04T01:01:00Z') });
  assert.equal(otherPage.ok, false);
  assert.equal(otherPage.reason, 'locked');
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-5 sub: same user + same session = idempotent re-acquire success.
test('AC-EDIT-LOCK-5 sub: same user + same session re-acquire is idempotent (refreshes lockedAt)', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:00:00Z') });
  const re = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(re.ok, true);
  const row = db.prepare('SELECT lockedAt FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockedAt, '2026-06-04T01:05:00.000Z');
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-6: applyAction gates via assertLockHolder (락 보유자 외 거부).
test('AC-EDIT-LOCK-6: assertLockHolder rejects callers that do not hold the lock', () => {
  const { svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:00:00Z') });
  // Different user/session
  const r1 = svc.assertLockHolder(articleId, { userId: 'U2', sessionId: 'S2' });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'lock-required');
  // Holder itself: ok
  const r2 = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'S1' });
  assert.equal(r2.ok, true);
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-7 (D2-3 = 30분): 좀비 락 자동 해제.
test('AC-EDIT-LOCK-7 (D2-3=30min): a stale (>30min old) lock is auto-released on next acquire', () => {
  const { svc } = freshService();
  const { articleId } = svc.create({ title: 't' });
  const T0 = new Date('2026-06-04T01:00:00Z');
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: T0 });
  // 31 minutes later — U1's lock is stale.
  const T1 = new Date(T0.getTime() + 31 * 60 * 1000);
  const result = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'S2', now: T1 });
  assert.equal(result.ok, true);
});

// SPEC-NEWS-REVISE-002 — AC-API-2 + AC-API-5: update is partial (markupVersion + only explicit
// Contents fields). Fields NOT supplied to update() must keep their previous values (D2-7=A).
test('AC-API-2 (D2-7=A): update only mutates explicit Article + Contents fields', () => {
  const { db, svc } = freshService();
  // Use only columns the Contents table actually has (Contents is a subset of the form fields).
  const { articleId } = svc.create({
    title: '원본 제목', content: '원본 본문', author: 'r1', department: '사회부',
  });
  const result = svc.update(articleId, { markupVersion: 'v2', title: '편집 제목', author: 'r1-edit' });
  assert.equal(result.ok, true);
  const article = db.prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(articleId);
  const contents = db.prepare('SELECT title, author, department FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(article.title, '편집 제목');
  assert.equal(article.markupVersion, 'v2');
  assert.equal(contents.title, '편집 제목');
  assert.equal(contents.author, 'r1-edit');
  // department was NOT in the update payload -> kept its original value (partial update guarantee).
  assert.equal(contents.department, '사회부', 'unspecified fields are NOT touched');
});

test('AC-API-2: update returns not-found when articleId is missing', () => {
  const { svc } = freshService();
  const result = svc.update('AKR000000000000000000', { markupVersion: 'v2' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-found');
});

// SPEC-NEWS-REVISE-002 — AC-SEARCH-3: 글기사 탭 내부 검색.
test('AC-SEARCH-3: searchArticles performs internal title/content LIKE search', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000010', '테스트 제목', '본문', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000011', '다른 제목', '테스트 본문', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000012', '무관', '무관', 'RDS');
  const hits = svc.searchArticles('테스트');
  const ids = hits.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['AKR202606040000000010', 'AKR202606040000000011']);
});

// AC-18: internal article full-text search over title/content
test('AC-18: searchArticles matches title or content substrings', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000001', '경제 뉴스', '주가 상승', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000002', '스포츠', '경제적 효과', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202605270000000003', '날씨', '맑음', 'RDS');

  const hits = svc.searchArticles('경제');
  const ids = hits.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['AKR202605270000000001', 'AKR202605270000000002']);
});
