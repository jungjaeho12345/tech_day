// Tests for SPEC-BACKEND-CORE-001 thin controllers (REQ-ARCH-001, AC-13 routing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';

function freshControllers() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const media = { search: async () => ({ items: [{ source: 'youtube', title: 't', url: 'u' }], error: false }) };
  return createControllers(db, { mediaSearch: media });
}

test('controllers expose article, user, and media handlers as callable functions', () => {
  const c = freshControllers();
  assert.equal(typeof c.article.create, 'function');
  assert.equal(typeof c.article.query, 'function');
  assert.equal(typeof c.article.updateStatus, 'function');
  assert.equal(typeof c.article.remove, 'function');
  assert.equal(typeof c.article.applyAction, 'function');
  assert.equal(typeof c.article.search, 'function');
  assert.equal(typeof c.user.login, 'function');
  assert.equal(typeof c.user.create, 'function');
  assert.equal(typeof c.media.search, 'function');
});

test('article.create controller persists and returns RDS', () => {
  const c = freshControllers();
  const res = c.article.create({ title: 'hi', author: 'a' });
  assert.equal(res.status, 'RDS');
  assert.match(res.articleId, /^AKR\d{17}$/);
});

test('user.login controller returns role without password hash', () => {
  const c = freshControllers();
  c.user.create({ userId: 'r1', password: 'pw', role: 'R' });
  const res = c.user.login('r1', 'pw');
  assert.equal(res.ok, true);
  assert.equal(res.user.role, 'R');
  assert.ok(!('password' in res.user));
});

test('media.search controller delegates to the media service', async () => {
  const c = freshControllers();
  const res = await c.media.search('q');
  assert.equal(res.error, false);
  assert.equal(res.items[0].source, 'youtube');
});

test('article.applyAction controller routes through the lifecycle state machine', () => {
  const c = freshControllers();
  const created = c.article.create({ title: 'x' });
  const res = c.article.applyAction(created.articleId, 'D', 'send');
  assert.equal(res.status, 'DPS');
});
