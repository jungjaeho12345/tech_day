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

// SPEC-FRONTEND-UI-001 v0.3.0 (REQ-FE-VIEW-008) — status filter, single + comma-separated multi-value.
// Previously `status` was silently ignored (not in QUERY_FILTERS) so menu filters returned all rows.
test('v0.3.0: query filters by a single status', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000001', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000002', 'DPS');
  const rows = svc.query({ status: 'RDS' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'RDS');
});

test('v0.3.0: query expands comma-separated status to an IN clause (데스크 미송고 RDS,DDH)', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000003', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000004', 'DDH');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000005', 'DPS');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000006', 'RRK');
  const rows = svc.query({ status: 'RDS,DDH' });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.status).sort(), ['DDH', 'RDS']);
});

test('v0.3.0: status filter AND-combines with other filters', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
    .run('AKR202606060000000007', 'alice', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
    .run('AKR202606060000000008', 'bob', 'RDS');
  const rows = svc.query({ author: 'alice', status: 'RDS,DDH' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].author, 'alice');
});

// SPEC-FRONTEND-UI-001 v0.4.0 (REQ-FE-VIEW-005) — statusNot exclusion filter, NOT IN mirror of status.
// 부서별 작성 queries { department, statusNot: 'DPS,RRH' } so sent/held articles drop out of the list.
test('v0.4.0: query excludes comma-separated statusNot states (부서별 작성 DPS,RRH 제외)', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000011', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000012', 'DPS');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000013', 'RRH');
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000014', 'RRK');
  const rows = svc.query({ statusNot: 'DPS,RRH' });
  assert.deepEqual(rows.map((r) => r.status).sort(), ['RDS', 'RRK']);
});

test('v0.4.0: statusNot AND-combines with department (부서별 작성 menu filter shape)', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, department, status) VALUES (?,?,?)')
    .run('AKR202606060000000015', '정치부', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, department, status) VALUES (?,?,?)')
    .run('AKR202606060000000016', '정치부', 'DPS');
  db.prepare('INSERT INTO Contents (articleId, department, status) VALUES (?,?,?)')
    .run('AKR202606060000000017', '경제부', 'RDS');
  const rows = svc.query({ department: '정치부', statusNot: 'DPS,RRH' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].articleId, 'AKR202606060000000015');
});

test('v0.4.0: empty statusNot is ignored (no NOT IN clause)', () => {
  const { db, svc } = freshService();
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?,?)').run('AKR202606060000000018', 'DPS');
  assert.equal(svc.query({ statusNot: '' }).length, 1);
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
  // Different user/session — now 를 고정 전달해 실시간 시계 기준 30분 stale 판정(time-bomb)을 막는다.
  const r1 = svc.assertLockHolder(articleId, { userId: 'U2', sessionId: 'S2', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'lock-required');
  // Holder itself: ok
  const r2 = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-04T01:05:00Z') });
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

// 편집 진입 로드 (news.md 기사 편집 기능) — query 행은 Article.markupVersion을 포함해야 한다.
// 종전에는 SELECT * FROM Contents 만 수행해 markupVersion이 항상 undefined → 편집 진입 시
// 본문/제목이 빈 화면으로 로드되는 원인이었다 (LEFT JOIN Article 회귀 가드).
test('edit-load: query rows carry Article.markupVersion (Contents LEFT JOIN Article)', () => {
  const { svc } = freshService();
  const markup = '제목 첫 줄\n본문 단락\n(끝)';
  const { articleId } = svc.create(
    { title: '제목 첫 줄', content: '본문 단락', author: '정재호', markupVersion: markup },
    { now: new Date('2026-06-06T00:00:00Z') },
  );

  const [row] = svc.query({ articleId });
  assert.equal(row.markupVersion, markup, 'query 행에 markupVersion이 실려야 편집기가 본문을 복원한다');
  assert.equal(row.title, '제목 첫 줄');
  // 필터 결합도 JOIN 후 동작해야 한다 (c.-qualified WHERE 회귀 가드).
  assert.equal(svc.query({ articleId, status: 'RDS' }).length, 1);
  assert.equal(svc.query({ author: '정재호', statusNot: 'DPS,RRH' }).length, 1);
});

// 공통정보 8필드 round-trip — create가 영속화하고 query가 돌려주며 update가 갱신한다.
// 종전에는 컬럼 자체가 없어 INSERT에서 조용히 유실 → 편집 진입 시 공통정보 복원 불가였다.
test('edit-load: 공통정보 8필드가 create→query→update 라운드트립으로 보존된다', () => {
  const { svc } = freshService();
  const commonInfo = {
    coAuthor: '공동기자', region: '서울', attribute: '일반', keyword: '테스트,키워드',
    internalComment: '내부메모', externalComment: '외부메모',
    attachmentFile: 'a.hwp', referenceFile: 'r.pdf',
  };
  const { articleId } = svc.create(
    { title: 't', content: 'c', author: '정재호', ...commonInfo },
    { now: new Date('2026-06-06T00:00:00Z') },
  );

  const [row] = svc.query({ articleId });
  for (const [key, value] of Object.entries(commonInfo)) {
    assert.equal(row[key], value, `${key} 필드가 create→query 라운드트립에서 보존돼야 한다`);
  }

  const updated = svc.update(articleId, { region: '부산', keyword: '갱신' });
  assert.equal(updated.ok, true);
  const [after] = svc.query({ articleId });
  assert.equal(after.region, '부산');
  assert.equal(after.keyword, '갱신');
  assert.equal(after.coAuthor, '공동기자', '부분 update는 다른 공통정보 필드를 건드리지 않는다');
});
