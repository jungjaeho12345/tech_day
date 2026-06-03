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
export const CONTENTS_COLUMNS = Object.freeze([
  'articleId', 'title', 'content', 'author', 'modifier', 'sender',
  'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
  'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status', 'lockYN',
  'lockerUserId', 'lockerSessionId', 'lockedAt',
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
  lockedAt VARCHAR
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
  const hasLockYN = db.prepare("PRAGMA table_info('Contents')").all()
    .some((col) => col.name === 'lockYN');
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
  const existing = new Set(
    db.prepare("PRAGMA table_info('Contents')").all().map((col) => col.name),
  );
  if (!existing.has('lockerUserId')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockerUserId VARCHAR');
  }
  if (!existing.has('lockerSessionId')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockerSessionId VARCHAR');
  }
  if (!existing.has('lockedAt')) {
    db.exec('ALTER TABLE Contents ADD COLUMN lockedAt VARCHAR');
  }
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
}
