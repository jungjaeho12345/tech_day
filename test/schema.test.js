// Tests for SPEC-DB-FOUNDATION-001 schema layer (AC-1, AC-2, AC-3, AC-6, AC-7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  createSchema,
  ARTICLE_COLUMNS,
  CONTENTS_COLUMNS,
  USER_COLUMNS,
  LIFECYCLE_STATUSES,
  KILL_STATUSES,
} from '../src/db/schema.js';
import { softDeleteArticle } from '../src/db/softDelete.js';

function freshDb() {
  return new DatabaseSync(':memory:');
}

function columnInfo(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function pkColumns(db, table) {
  return columnInfo(db, table)
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
}

// AC-1: schema creation
test('AC-1: creates exactly three tables Article, Contents, User', () => {
  const db = freshDb();
  createSchema(db);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name)
    .filter((n) => !n.startsWith('sqlite_'));
  assert.deepEqual(tables, ['Article', 'Contents', 'User']);
});

test('AC-1: Article has expected columns', () => {
  const db = freshDb();
  createSchema(db);
  const cols = columnInfo(db, 'Article').map((c) => c.name);
  assert.deepEqual(cols, ['articleId', 'title', 'content', 'markupVersion', 'modifier']);
});

test('AC-1: Contents has expected columns including distributedAt and status', () => {
  const db = freshDb();
  createSchema(db);
  const cols = columnInfo(db, 'Contents').map((c) => c.name);
  assert.deepEqual(cols, [
    'articleId', 'title', 'content', 'author', 'modifier', 'sender',
    'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
    'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status',
  ]);
  assert.ok(cols.includes('distributedAt'), 'distributedAt column must exist');
  assert.ok(cols.includes('status'), 'status column must exist on Contents');
});

test('AC-1: User has expected columns', () => {
  const db = freshDb();
  createSchema(db);
  const cols = columnInfo(db, 'User').map((c) => c.name);
  // `active` added by SPEC-AUTH-001 amendment (status-based soft delete; REQ-AUTH-USRMGMT-003).
  assert.deepEqual(cols, ['userId', 'name', 'password', 'role', 'department', 'departmentCode', 'active']);
});

test('AC-1: all columns declared VARCHAR', () => {
  const db = freshDb();
  createSchema(db);
  for (const table of ['Article', 'Contents', 'User']) {
    for (const col of columnInfo(db, table)) {
      assert.equal(col.type, 'VARCHAR', `${table}.${col.name} should be VARCHAR, got ${col.type}`);
    }
  }
});

test('AC-1: Article.articleId is single-column PRIMARY KEY (not composite)', () => {
  const db = freshDb();
  createSchema(db);
  assert.deepEqual(pkColumns(db, 'Article'), ['articleId']);
});

test('AC-1: Contents.articleId is PRIMARY KEY', () => {
  const db = freshDb();
  createSchema(db);
  assert.deepEqual(pkColumns(db, 'Contents'), ['articleId']);
});

test('AC-1: User.userId is PRIMARY KEY', () => {
  const db = freshDb();
  createSchema(db);
  assert.deepEqual(pkColumns(db, 'User'), ['userId']);
});

// AC-2: idempotent re-creation preserves data
test('AC-2: re-running schema creation preserves existing data', () => {
  const db = freshDb();
  createSchema(db);
  db.prepare('INSERT INTO Article (articleId, title, content, markupVersion, modifier) VALUES (?,?,?,?,?)')
    .run('AKR202605270000000001', 'keep me', 'body', 'v1', 'editor');
  // Re-run must not throw and must not destroy data.
  createSchema(db);
  const rows = db.prepare('SELECT * FROM Article').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'keep me');
});

// AC-3: UTF-8 Korean round-trip
test('AC-3: Korean string round-trips intact through Contents', () => {
  const db = freshDb();
  createSchema(db);
  const koreanTitle = '속보: 기사 제작 시스템';
  db.prepare('INSERT INTO Contents (articleId, title) VALUES (?, ?)')
    .run('AKR202605270000000002', koreanTitle);
  const row = db.prepare('SELECT title FROM Contents WHERE articleId = ?')
    .get('AKR202605270000000002');
  assert.equal(row.title, koreanTitle);
});

// AC-7: all lifecycle statuses store and read back
test('AC-7: all six lifecycle status values store and read back unmodified', () => {
  const db = freshDb();
  createSchema(db);
  const statuses = ['RDS', 'DPS', 'RRH', 'DDH', 'RRK', 'DDK'];
  assert.deepEqual([...LIFECYCLE_STATUSES].sort(), [...statuses].sort());
  statuses.forEach((status, i) => {
    const id = `AKR2026052700000000${(10 + i).toString()}`;
    db.prepare('INSERT INTO Contents (articleId, status) VALUES (?, ?)').run(id, status);
    const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(id);
    assert.equal(row.status, status);
  });
});

// AC-6: soft delete
test('AC-6: soft delete preserves row, sets KILL status, no deleted column, no physical DELETE', () => {
  const db = freshDb();
  createSchema(db);

  // No `deleted` flag column exists on Contents.
  const contentCols = columnInfo(db, 'Contents').map((c) => c.name);
  assert.ok(!contentCols.includes('deleted'), 'no deleted flag column allowed');

  const id = 'AKR202605270000000099';
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?, ?)').run(id, 'RDS');
  const before = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;

  const newStatus = softDeleteArticle(db, id, 'RRK');

  const after = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;
  assert.equal(after, before, 'row count must be unchanged');
  assert.ok(KILL_STATUSES.has(newStatus), 'returned status must be a KILL state');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(id);
  assert.equal(row.status, 'RRK');
});

test('AC-6: soft delete rejects non-KILL status', () => {
  const db = freshDb();
  createSchema(db);
  const id = 'AKR202605270000000098';
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?, ?)').run(id, 'RDS');
  assert.throws(() => softDeleteArticle(db, id, 'DPS'), /KILL/);
});
