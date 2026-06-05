// Unit tests for articleModel.query — array IN clause support (SPEC-EDIT-LOCK-001 follow-up)
// Covers: multi-status array, department scalar, author+status array AND combination,
//         scalar status regression, empty array safe behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleModel } from '../src/models/articleModel.js';

function freshModel() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return createArticleModel(db);
}

function seed(model, rows) {
  // Insert directly via the model's insert() — schema provides Article + Contents tables.
  // We need DB access to insert test rows directly because insert() requires Article row first.
  // Use the underlying db from a freshModel via a helper that exposes db.
  return rows; // used for documentation; actual insertion done via db.prepare below
}

function freshModelWithDb() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const model = createArticleModel(db);
  return { db, model };
}

function insertRow(db, row) {
  db.prepare(
    `INSERT INTO Contents (articleId, title, author, department, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    row.articleId,
    row.title ?? null,
    row.author ?? null,
    row.department ?? null,
    row.status ?? 'RDS',
    row.createdAt ?? null,
  );
}

// --- query({ status: ['RDS', 'DDH'] }) returns only RDS and DDH rows ---
test('query with status array [RDS,DDH] returns only RDS and DDH rows, excludes DPS', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-001', status: 'RDS' });
  insertRow(db, { articleId: 'A-002', status: 'DDH' });
  insertRow(db, { articleId: 'A-003', status: 'DPS' });
  insertRow(db, { articleId: 'A-004', status: 'RRK' });

  const rows = model.query({ status: ['RDS', 'DDH'] });
  const ids = rows.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['A-001', 'A-002']);
});

// --- query({ department: 'X' }) returns only that department ---
test('query with scalar department returns only that department', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-010', department: '사회부', status: 'RDS' });
  insertRow(db, { articleId: 'A-011', department: '경제부', status: 'RDS' });
  insertRow(db, { articleId: 'A-012', department: '사회부', status: 'DPS' });

  const rows = model.query({ department: '사회부' });
  const ids = rows.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['A-010', 'A-012']);
});

// --- query({ author: 'u1', status: ['RRK', 'RDS'] }) AND combination ---
test('query with author scalar AND status array combines as AND', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-020', author: 'u1', status: 'RDS' });   // match
  insertRow(db, { articleId: 'A-021', author: 'u1', status: 'RRK' });   // match
  insertRow(db, { articleId: 'A-022', author: 'u1', status: 'DPS' });   // excluded (wrong status)
  insertRow(db, { articleId: 'A-023', author: 'u2', status: 'RDS' });   // excluded (wrong author)

  const rows = model.query({ author: 'u1', status: ['RRK', 'RDS'] });
  const ids = rows.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['A-020', 'A-021']);
});

// --- scalar status regression: query({ status: 'DPS' }) uses = not IN ---
test('query with scalar status DPS returns only DPS rows (= branch regression)', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-030', status: 'DPS' });
  insertRow(db, { articleId: 'A-031', status: 'RDS' });

  const rows = model.query({ status: 'DPS' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].articleId, 'A-030');
});

// --- empty array: query({ status: [] }) returns 0 rows safely ---
test('query with empty status array returns 0 rows (safe empty-array handling)', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-040', status: 'RDS' });

  const rows = model.query({ status: [] });
  assert.equal(rows.length, 0);
});

// --- empty filter still returns all rows ---
test('query with empty filter returns all rows (no regression)', () => {
  const { db, model } = freshModelWithDb();
  insertRow(db, { articleId: 'A-050', status: 'RDS' });
  insertRow(db, { articleId: 'A-051', status: 'DPS' });

  const rows = model.query({});
  assert.equal(rows.length, 2);
});
