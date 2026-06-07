// @MX:ANCHOR: [AUTO] DB schema DDL — foundation consumed by backend SPEC (expected fan_in >= 3).
// @MX:REASON: createSchema + column/status constants are the canonical contract for SPEC-DB-FOUNDATION-001.
//
// Schema layer for SPEC-DB-FOUNDATION-001.
// All columns declared VARCHAR (VO spec); SQLite stores them with TEXT-equivalent affinity.
// Tables are created idempotently so re-running creation never destroys data (REQ-SCH-010).

export const ARTICLE_COLUMNS = Object.freeze([
  'articleId', 'title', 'content', 'markupVersion', 'modifier',
]);

// @MX:NOTE: [AUTO] `lockYN` (REQ-DB-LOCKYN) + `lockerUserId` / `lockerSessionId` / `lockedAt`
// (REQ-EDIT-LOCK, Pending Decision D2-2 = A) are SPEC-NEWS-REVISE-002 amendments to
// SPEC-DB-FOUNDATION-001. Together they enable race-safe atomic lock acquisition via a single SQL
// `UPDATE Contents SET ... WHERE articleId=? AND (lockYN='N' OR lockedAt < ?)`. lockYN is NEVER
// NULL ('Y'/'N'); the locker identification columns are NULL when no edit lock is held.
// @MX:NOTE: [AUTO] The trailing 8 common-info columns (coAuthor..referenceFile) persist the write
// page's 공통정보 fields that previously lived only in the client DTO and were silently dropped on
// INSERT, so 편집 진입 시 공통정보 복원이 불가능했다 (news.md 기사 편집 기능). Appended LAST so a
// fresh CREATE TABLE and an ALTER-migrated legacy DB share the same column order.
export const CONTENTS_COLUMNS = Object.freeze([
  'articleId', 'title', 'content', 'author', 'modifier', 'sender',
  'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
  'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status', 'lockYN',
  'lockerUserId', 'lockerSessionId', 'lockedAt',
  'coAuthor', 'region', 'attribute', 'keyword',
  'internalComment', 'externalComment', 'attachmentFile', 'referenceFile',
]);

// The 8 common-info columns added by the edit-load fix (nullable VARCHAR, no default).
// Shared by CREATE_CONTENTS and the idempotent ALTER migration below.
const CONTENTS_COMMON_INFO_COLUMNS = Object.freeze([
  'coAuthor', 'region', 'attribute', 'keyword',
  'internalComment', 'externalComment', 'attachmentFile', 'referenceFile',
]);

// @MX:NOTE: [AUTO] `active` is a SPEC-AUTH-001 amendment to SPEC-DB-FOUNDATION-001: status-based
// user deactivation ('Y'=active default, 'N'=soft-deleted) so user "deletion" never physically
// deletes a row (REQ-AUTH-USRMGMT-003; CLAUDE.md HARD rule).
export const USER_COLUMNS = Object.freeze([
  'userId', 'name', 'password', 'role', 'department', 'departmentCode', 'active',
]);

export const USER_ACTIVE = Object.freeze({ ACTIVE: 'Y', INACTIVE: 'N' });

// Lifecycle states from news.md. KILL states represent soft deletion (REQ-DEL-002).
export const LIFECYCLE_STATUSES = Object.freeze(
  new Set(['RDS', 'DPS', 'RRH', 'DDH', 'RRK', 'DDK']),
);
export const KILL_STATUSES = Object.freeze(new Set(['RRK', 'DDK']));

const CREATE_ARTICLE = `
CREATE TABLE IF NOT EXISTS Article (
  articleId VARCHAR PRIMARY KEY,
  title VARCHAR,
  content VARCHAR,
  markupVersion VARCHAR,
  modifier VARCHAR
)`;

const CREATE_CONTENTS = `
CREATE TABLE IF NOT EXISTS Contents (
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
  status VARCHAR,
  lockYN VARCHAR NOT NULL DEFAULT 'N',
  lockerUserId VARCHAR,
  lockerSessionId VARCHAR,
  lockedAt VARCHAR,
  coAuthor VARCHAR,
  region VARCHAR,
  attribute VARCHAR,
  keyword VARCHAR,
  internalComment VARCHAR,
  externalComment VARCHAR,
  attachmentFile VARCHAR,
  referenceFile VARCHAR
)`;

const CREATE_USER = `
CREATE TABLE IF NOT EXISTS User (
  userId VARCHAR PRIMARY KEY,
  name VARCHAR,
  password VARCHAR,
  role VARCHAR,
  department VARCHAR,
  departmentCode VARCHAR,
  active VARCHAR NOT NULL DEFAULT 'Y'
)`;

/**
 * Idempotently add the `active` column to a pre-existing User table (SPEC-AUTH-001 amendment).
 * Re-running never destroys data (REQ-SCH-010): the column is added only when absent.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function ensureUserActiveColumn(db) {
  const hasActive = db.prepare("PRAGMA table_info('User')").all()
    .some((col) => col.name === 'active');
  if (!hasActive) {
    db.exec("ALTER TABLE User ADD COLUMN active VARCHAR NOT NULL DEFAULT 'Y'");
  }
}

/**
 * Idempotently add the `lockYN` column to a pre-existing Contents table
 * (SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN). Mirrors ensureUserActiveColumn's pattern:
 * PRAGMA table_info check → ALTER TABLE ADD COLUMN only when absent. Re-running
 * preserves existing rows (REQ-SCH-010, CLAUDE.md HARD: DB 내용은 삭제하지 않는다).
 * @param {import('node:sqlite').DatabaseSync} db
 */
function ensureContentsLockYNColumn(db) {
  // Legacy production DBs (pre SPEC-NEWS-REVISE-002) created this column as `LockYN`.
  // SQLite identifiers are case-insensitive, so ALTER ADD `lockYN` would fail with
  // "duplicate column name" — treat the legacy spelling as present too.
  const hasLockYN = db.prepare("PRAGMA table_info('Contents')").all()
    .some((col) => col.name === 'lockYN' || col.name === 'LockYN');
  if (!hasLockYN) {
    db.exec("ALTER TABLE Contents ADD COLUMN lockYN VARCHAR NOT NULL DEFAULT 'N'");
  }
}

/**
 * Idempotently add the locker identification columns to a pre-existing Contents table
 * (SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK, D2-2 = A). Locker columns are NULLABLE because they
 * are populated only while a lock is held.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function ensureContentsLockerColumns(db) {
  // SQLite column names are case-insensitive: compare lowercased so pre-existing
  // columns like `LockedAt` are detected and not re-added.
  const existing = new Set(
    db.prepare("PRAGMA table_info('Contents')").all().map((col) => col.name.toLowerCase()),
  );
  if (!existing.has('lockeruserid')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockerUserId VARCHAR');
  }
  if (!existing.has('lockersessionid')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockerSessionId VARCHAR');
  }
  if (!existing.has('lockedat')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockedAt VARCHAR');
  }
}

/**
 * Idempotently add the 8 common-info columns (coAuthor/region/attribute/keyword/internalComment/
 * externalComment/attachmentFile/referenceFile) to a pre-existing Contents table so the write
 * page's 공통정보 fields persist and 편집 진입 시 복원된다 (news.md 기사 편집 기능). Mirrors
 * ensureContentsLockerColumns: PRAGMA check → ALTER ADD COLUMN only when absent; re-running
 * preserves existing rows (REQ-SCH-010, CLAUDE.md HARD: DB 내용은 삭제하지 않는다).
 * @param {import('node:sqlite').DatabaseSync} db
 */
function ensureContentsCommonInfoColumns(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info('Contents')").all().map((col) => col.name),
  );
  for (const column of CONTENTS_COMMON_INFO_COLUMNS) {
    if (!existing.has(column)) {
      db.exec(`ALTER TABLE Contents ADD COLUMN ${column} VARCHAR`);
    }
  }
}

/**
 * Idempotent, NON-DESTRUCTIVE data backfill: legacy Contents rows were saved with department/
 * departmentCode = NULL (the write DTO never carried them), so the 부서별 작성/부서별 송고 menus
 * could never match them. Resolve each row's department from the author's User row (author stores
 * the display name — news.md 공통정보: 작성자=로그인 사용자 이름). Nothing is ever deleted
 * (CLAUDE.md HARD rule).
 *
 * A row is backfilled ONLY when EXACTLY ONE active user matches the author name AND that user has
 * a non-empty department. The single-match guard avoids stamping an arbitrary department for
 * 동명이인 (User.name is not UNIQUE — only userId is the PK), and the non-empty-department guard
 * keeps re-runs a true no-op: without it a NULL-department user would rewrite NULL into the row
 * forever, so the WHERE clause would keep matching on every run (idempotency violation).
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {number} number of backfilled rows
 */
export function backfillContentsDepartmentFromAuthor(db) {
  const info = db.prepare(`
    UPDATE Contents
       SET department = (SELECT u.department FROM User u
                          WHERE u.name = Contents.author AND u.active = 'Y'
                            AND u.department IS NOT NULL AND u.department <> ''),
           departmentCode = (SELECT u.departmentCode FROM User u
                              WHERE u.name = Contents.author AND u.active = 'Y'
                                AND u.department IS NOT NULL AND u.department <> '')
     WHERE (department IS NULL OR department = '')
       AND author IS NOT NULL AND author <> ''
       AND (SELECT COUNT(*) FROM User u
             WHERE u.name = Contents.author AND u.active = 'Y'
               AND u.department IS NOT NULL AND u.department <> '') = 1
  `).run();
  return Number(info.changes);
}

/**
 * Create the three foundation tables idempotently on the given DatabaseSync handle.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createSchema(db) {
  db.exec(CREATE_ARTICLE);
  db.exec(CREATE_CONTENTS);
  db.exec(CREATE_USER);
  ensureUserActiveColumn(db);
  ensureContentsLockYNColumn(db);
  ensureContentsLockerColumns(db);
  ensureContentsCommonInfoColumns(db);
}
