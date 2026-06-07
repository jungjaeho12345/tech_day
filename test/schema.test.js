// Tests for SPEC-DB-FOUNDATION-001 schema layer (AC-1, AC-2, AC-3, AC-6, AC-7).
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  createSchema,
  backfillContentsDepartmentFromAuthor,
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
  //   lockYN 1 컬럼 + lockerUserId/lockerSessionId/lockedAt 3 컬럼 추가 → 19 컬럼.
  // 단일 SQL race-safe 락 획득 (UPDATE ... WHERE lockYN='N' OR lockedAt < ?)을 가능케 함.
  // 편집 진입 공통정보 복원 (news.md 기사 편집 기능): 공통정보 8 컬럼(coAuthor..referenceFile)
  // 추가 → 총 27 컬럼. 신규 CREATE와 레거시 ALTER 마이그레이션이 같은 순서를 공유하도록 맨 뒤에 둔다.
  assert.deepEqual(cols, [
    'articleId', 'title', 'content', 'author', 'modifier', 'sender',
    'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
    'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status', 'lockYN',
    'lockerUserId', 'lockerSessionId', 'lockedAt',
    'coAuthor', 'region', 'attribute', 'keyword',
    'internalComment', 'externalComment', 'attachmentFile', 'referenceFile',
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
  const koreanTitle = '속보: 기사 작성기';
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

// 부서 백필 — 레거시 Contents 행(department=NULL)을 작성자 이름→User.department 조인으로 채운다.
// 비파괴(UPDATE만, 삭제 없음, CLAUDE.md HARD) + 멱등(재실행 시 0건) 가드.
describe('backfillContentsDepartmentFromAuthor — 레거시 부서 백필 (비파괴·멱등)', () => {
  function seedUserRow(db, userId, name, department, departmentCode) {
    db.prepare('INSERT INTO User (userId, name, password, role, department, departmentCode) VALUES (?,?,?,?,?,?)')
      .run(userId, name, 'pw', 'R', department, departmentCode);
  }

  it('department가 비어 있는 행은 작성자 이름으로 User.department/departmentCode가 채워진다', () => {
    const db = freshDb();
    createSchema(db);
    seedUserRow(db, '2015019', '정재호', '개발부', 'DEV');
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000001', '정재호', 'RDS');

    const changed = backfillContentsDepartmentFromAuthor(db);
    assert.equal(changed, 1);
    const row = db.prepare('SELECT department, departmentCode FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000001');
    assert.equal(row.department, '개발부');
    assert.equal(row.departmentCode, 'DEV');
  });

  it('작성자가 비었거나 매칭 사용자가 없는 행은 건드리지 않고, 행 수는 절대 줄지 않는다', () => {
    const db = freshDb();
    createSchema(db);
    seedUserRow(db, '2015019', '정재호', '개발부', 'DEV');
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000002', '', 'RDS'); // 작성자 공백 — 추정 불가
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000003', '미상기자', 'RDS'); // 매칭 사용자 없음
    const before = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;

    const changed = backfillContentsDepartmentFromAuthor(db);
    assert.equal(changed, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, before, '행 수 불변 (비파괴)');
    assert.equal(db.prepare('SELECT department FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000002').department, null);
    assert.equal(db.prepare('SELECT department FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000003').department, null);
  });

  it('이미 department가 있는 행은 덮어쓰지 않고, 재실행은 0건 변경(멱등)이다', () => {
    const db = freshDb();
    createSchema(db);
    seedUserRow(db, '2015019', '정재호', '개발부', 'DEV');
    db.prepare('INSERT INTO Contents (articleId, author, department, status) VALUES (?,?,?,?)')
      .run('AKR202606060000000004', '정재호', '기획부', 'RDS'); // 기존 값 보존 대상
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000005', '정재호', 'RDS'); // 백필 대상

    assert.equal(backfillContentsDepartmentFromAuthor(db), 1, '1차 실행은 비어 있는 행만 채운다');
    assert.equal(db.prepare('SELECT department FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000004').department, '기획부', '기존 department는 보존');
    assert.equal(backfillContentsDepartmentFromAuthor(db), 0, '재실행은 0건 (멱등)');
  });

  // 적대적 리뷰 발견 보강: 매칭 사용자의 department가 NULL이면 NULL을 재기록해 WHERE가 영원히
  // 매칭되는 멱등성 위반이 있었다 — 부서 없는 사용자는 백필 대상에서 제외되어야 한다.
  it('매칭 사용자의 department가 비어 있으면 건너뛰어 멱등이 유지된다 (NULL 재기록 금지)', () => {
    const db = freshDb();
    createSchema(db);
    seedUserRow(db, '2015020', '김기자', null, 'SOC'); // 부서 미배정 사용자
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000006', '김기자', 'RDS');

    assert.equal(backfillContentsDepartmentFromAuthor(db), 0, '부서 없는 사용자는 백필 대상이 아니다');
    assert.equal(backfillContentsDepartmentFromAuthor(db), 0, '재실행도 0건 — 멱등 유지');
    const row = db.prepare('SELECT department, departmentCode FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000006');
    assert.equal(row.department, null);
    assert.equal(row.departmentCode, null, 'departmentCode도 단독 기록하지 않는다');
  });

  // 적대적 리뷰 발견 보강: User.name은 UNIQUE가 아니므로 동명이인이면 스칼라 서브쿼리가 임의의
  // 부서를 찍는다 — 정확히 1명 매칭일 때만 백필한다 (COUNT(*) = 1 가드).
  it('동명이인(활성 사용자 2명 이상 매칭)은 임의 부서를 찍지 않고 건너뛴다', () => {
    const db = freshDb();
    createSchema(db);
    seedUserRow(db, '2015021', '정재호', '정치부', 'POL');
    seedUserRow(db, '2015022', '정재호', '경제부', 'ECO');
    db.prepare('INSERT INTO Contents (articleId, author, status) VALUES (?,?,?)')
      .run('AKR202606060000000007', '정재호', 'RDS');

    assert.equal(backfillContentsDepartmentFromAuthor(db), 0, '모호한 매칭은 백필하지 않는다');
    assert.equal(db.prepare('SELECT department FROM Contents WHERE articleId = ?')
      .get('AKR202606060000000007').department, null);
  });
});
