// Tests for SPEC-BACKEND-CORE-001 article model + service (AC-1, AC-2, AC-3, AC-4, AC-13, AC-18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';

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
