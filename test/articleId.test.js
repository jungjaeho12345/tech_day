// Tests for SPEC-DB-FOUNDATION-001 article ID generation (AC-4, AC-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { generateArticleId, formatArticleId } from '../src/db/articleId.js';

const ID_REGEX = /^AKR\d{8}\d{9}$/;

// AC-4: format
test('AC-4: generated ID matches ^AKR\\d{8}\\d{9}$ and is 20 chars', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const id = generateArticleId(db, { now: new Date('2026-05-27T10:00:00Z') });
  assert.match(id, ID_REGEX);
  assert.equal(id.length, 20);
  assert.ok(id.startsWith('AKR20260527'), `unexpected date prefix: ${id}`);
});

test('AC-4: random portion is zero-padded to 9 digits', () => {
  // Force a small random value to verify left zero-padding.
  const id = formatArticleId(new Date('2026-05-27T00:00:00Z'), 42);
  assert.equal(id, 'AKR20260527000000042');
  assert.equal(id.length, 20);
  assert.match(id, ID_REGEX);
});

test('AC-4: random portion at boundaries stays 9 digits', () => {
  assert.equal(formatArticleId(new Date('2026-05-27T00:00:00Z'), 0), 'AKR20260527000000000');
  assert.equal(formatArticleId(new Date('2026-05-27T00:00:00Z'), 999999999), 'AKR20260527999999999');
});

// AC-5: collision regeneration
test('AC-5: collision triggers regeneration of a unique ID', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);

  const existing = 'AKR20260527000000001';
  db.prepare('INSERT INTO Article (articleId) VALUES (?)').run(existing);

  // Deterministic random sequence: first returns the colliding value, then a free one.
  const sequence = [1, 2];
  let i = 0;
  const randomFn = () => sequence[i++];

  const id = generateArticleId(db, {
    now: new Date('2026-05-27T00:00:00Z'),
    randomFn,
  });

  assert.notEqual(id, existing);
  assert.equal(id, 'AKR20260527000000002');
  const found = db.prepare('SELECT articleId FROM Article WHERE articleId = ?').get(id);
  assert.equal(found, undefined, 'final ID must not already exist in Article');
});

test('AC-4: defaults (real random + current date) still produce a valid 20-char ID', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const id = generateArticleId(db); // no options -> defaultRandom + new Date()
  assert.match(id, ID_REGEX);
  assert.equal(id.length, 20);
});

test('AC-5: generated ID against many existing rows is unique', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  for (let n = 1; n <= 50; n++) {
    db.prepare('INSERT INTO Article (articleId) VALUES (?)')
      .run(formatArticleId(new Date('2026-05-27T00:00:00Z'), n));
  }
  const id = generateArticleId(db, { now: new Date('2026-05-27T00:00:00Z') });
  const found = db.prepare('SELECT articleId FROM Article WHERE articleId = ?').get(id);
  assert.equal(found, undefined);
  assert.match(id, ID_REGEX);
});
