// @MX:ANCHOR: [AUTO] DB schema DDL — foundation consumed by backend SPEC (expected fan_in >= 3).
// @MX:REASON: createSchema + column/status constants are the canonical contract for SPEC-DB-FOUNDATION-001.
//
// Schema layer for SPEC-DB-FOUNDATION-001.
// All columns declared VARCHAR (VO spec); SQLite stores them with TEXT-equivalent affinity.
// Tables are created idempotently so re-running creation never destroys data (REQ-SCH-010).

export const ARTICLE_COLUMNS = Object.freeze([
  'articleId', 'title', 'content', 'markupVersion', 'modifier',
]);

export const CONTENTS_COLUMNS = Object.freeze([
  'articleId', 'title', 'content', 'author', 'modifier', 'sender',
  'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
  'distributedAt', 'embargoAt', 'secondEmbargoAt', 'status',
]);

export const USER_COLUMNS = Object.freeze([
  'userId', 'name', 'password', 'role', 'department', 'departmentCode',
]);

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
  status VARCHAR
)`;

const CREATE_USER = `
CREATE TABLE IF NOT EXISTS User (
  userId VARCHAR PRIMARY KEY,
  name VARCHAR,
  password VARCHAR,
  role VARCHAR,
  department VARCHAR,
  departmentCode VARCHAR
)`;

/**
 * Create the three foundation tables idempotently on the given DatabaseSync handle.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createSchema(db) {
  db.exec(CREATE_ARTICLE);
  db.exec(CREATE_CONTENTS);
  db.exec(CREATE_USER);
}
