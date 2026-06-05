// Tests for SPEC-DB-FOUNDATION-001 schema layer (AC-1, AC-2, AC-3, AC-6, AC-7).
import { test, describe, it } from 'node:test';
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
  // SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN (T-M1-001) + REQ-EDIT-LOCK (T-M2-001, D2-2 = A):
  //   lockYN 1 컬럼 + lockerUserId/lockerSessionId/lockedAt 3 컬럼 추가 → 총 19 컬럼.
  // 단일 SQL race-safe 락 획득 (UPDATE ... WHERE lockYN='N' OR lockedAt < ?)을 가능케 함.
  assert.deepEqual(cols, [
    'articleId', 'title', 'content', 'author', 'modifier', 'sender',
    'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
    'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status', 'lockYN',
    'lockerUserId', 'lockerSessionId', 'lockedAt',
  ]);
  assert.ok(cols.includes('distributedAt'), 'distributedAt column must exist');
  assert.ok(cols.includes('status'), 'status column must exist on Contents');
});

// SPEC-NEWS-REVISE-002 — AC-LOCKYN-1: lockYN 컬럼은 NOT NULL + DEFAULT 'N'.
test('AC-LOCKYN-1: Contents.lockYN is NOT NULL with default \'N\'', () => {
  const db = freshDb();
  createSchema(db);
  const lockColumn = columnInfo(db, 'Contents').find((c) => c.name === 'lockYN');
  assert.ok(lockColumn, 'lockYN column must exist');
  assert.equal(lockColumn.notnull, 1, 'lockYN must be NOT NULL');
  assert.equal(lockColumn.dflt_value, "'N'", "lockYN must default to 'N'");
  assert.equal(lockColumn.type, 'VARCHAR');
});

test('AC-LOCKYN-1: CONTENTS_COLUMNS array contains lockYN and locker columns', () => {
  for (const name of ['lockYN', 'lockerUserId', 'lockerSessionId', 'lockedAt']) {
    assert.ok(CONTENTS_COLUMNS.includes(name), `${name} must be in CONTENTS_COLUMNS`);
  }
});

// SPEC-NEWS-REVISE-002 — AC-EDIT-LOCK-1 schema prerequisite: locker columns are NULLABLE.
test('AC-EDIT-LOCK-1 schema: locker columns are VARCHAR + nullable', () => {
  const db = freshDb();
  createSchema(db);
  const cols = columnInfo(db, 'Contents');
  for (const name of ['lockerUserId', 'lockerSessionId', 'lockedAt']) {
    const col = cols.find((c) => c.name === name);
    assert.ok(col, `${name} column must exist`);
    assert.equal(col.notnull, 0, `${name} must be NULLABLE`);
    assert.equal(col.type, 'VARCHAR');
  }
});

test('AC-LOCKYN-2: INSERT without lockYN populates default \'N\'', () => {
  const db = freshDb();
  createSchema(db);
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?, ?)')
    .run('AKR202606040000000001', 'RDS');
  const row = db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?')
    .get('AKR202606040000000001');
  assert.equal(row.lockYN, 'N');
});

// SPEC-NEWS-REVISE-002 — REQ-SCH-010 idempotence for the two new ensure helpers.
test('REQ-SCH-010: re-running createSchema on a pre-existing Contents adds new columns without destroying rows', () => {
  const db = freshDb();
  // Legacy Contents without ANY of the SPEC-NEWS-REVISE-002 amendments.
  db.exec(`
    CREATE TABLE Contents (
      articleId VARCHAR PRIMARY KEY,
      title VARCHAR,
      content VARCHAR,
      author VARCHAR,
      modifier VARCHAR,
      sender VARCHAR,
      department VARCHAR,
      departmentCode VARCHAR,
      createdAt VARCHAR,
      editedAt VARCHAR,
      sentAt VARCHAR,
      distributedAt VARCHAR,
      embargoAt VARCHAR,
      secondEmbargoAt VARCHAR,
      status VARCHAR
    )
  `);
  db.prepare('INSERT INTO Contents (articleId, status) VALUES (?, ?)')
    .run('AKR202606040000000099', 'RDS');
  createSchema(db);
  const cols = columnInfo(db, 'Contents').map((c) => c.name);
  for (const name of ['lockYN', 'lockerUserId', 'lockerSessionId', 'lockedAt']) {
    assert.ok(cols.includes(name), `${name} added idempotently`);
  }
  const row = db.prepare('SELECT articleId, status, lockYN, lockerUserId FROM Contents WHERE articleId = ?')
    .get('AKR202606040000000099');
  assert.equal(row.articleId, 'AKR202606040000000099');
  assert.equal(row.status, 'RDS');
  assert.equal(row.lockYN, 'N');
  assert.equal(row.lockerUserId, null);
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

// SPEC-NEWS-REVISE-004 REQ-LOCK-VOCAB-ALIGN — schema-vocab 가드.
// 락 보유자 식별 컬럼의 정본 어휘는 lockerUserId / lockerSessionId / lockedAt 이며,
// lockerPageId 컬럼은 존재하지 않는다(부재는 의도적 — 어휘 혼동 방지, PD1 컬럼 추가 거부 가드).
describe('SPEC-NEWS-REVISE-004 REQ-LOCK-VOCAB-ALIGN — 락 보유자 정본 어휘 schema-vocab 가드', () => {
  // AC-LOCKV-1: Contents 테이블에 정본 락 컬럼이 존재하고 lockerPageId 는 부재함을 단언.
  it('AC-LOCKV-1: Contents 컬럼은 lockYN/lockerUserId/lockerSessionId/lockedAt 을 포함하고 lockerPageId 는 포함하지 않는다', () => {
    const db = freshDb();
    createSchema(db);
    const cols = columnInfo(db, 'Contents').map((c) => c.name);

    // 정본 어휘 4컬럼 존재 (lockerSessionId 가 1 인 1 페이지 정책의 페이지 단위 식별자를 운반한다).
    for (const name of ['lockYN', 'lockerUserId', 'lockerSessionId', 'lockedAt']) {
      assert.ok(cols.includes(name), `${name} 정본 컬럼이 존재해야 한다`);
    }

    // lockerPageId 부재 — option (ii) add-only 컬럼 도입은 명시적 거부(PD1). 부재가 의도적임을 잠근다.
    assert.equal(cols.includes('lockerPageId'), false, 'lockerPageId 컬럼은 존재하지 않아야 한다(어휘 정합, 컬럼 추가 거부)');
  });
});
