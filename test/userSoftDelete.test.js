// Tests for SPEC-AUTH-001 Module ⑤ soft delete + deactivated-login (REQ-AUTH-USRMGMT-003/004).
// CLAUDE.md HARD rule: DB rows are NEVER physically deleted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createUserService } from '../src/services/userService.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createUserService(db) };
}

// REQ-AUTH-USRMGMT-003: remove() is a soft delete — the row is preserved, marked inactive.
test('REQ-AUTH-USRMGMT-003: remove soft-deletes — User row is preserved, not physically deleted', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  const result = svc.remove('desk1');
  assert.equal(result.ok, true);
  const row = db.prepare('SELECT * FROM User WHERE userId = ?').get('desk1');
  assert.notEqual(row, undefined, 'the User row MUST still exist after soft delete (HARD rule)');
  assert.equal(row.active, 'N', 'the row must be flagged inactive');
});

// REQ-AUTH-USRMGMT-004: a deactivated user cannot establish a new session (login rejected).
test('REQ-AUTH-USRMGMT-004: a deactivated user cannot log in, but the row is preserved', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  svc.remove('desk1');
  const login = svc.login('desk1', 'pw');
  assert.equal(login.ok, false, 'deactivated user must not authenticate');
  const row = db.prepare('SELECT * FROM User WHERE userId = ?').get('desk1');
  assert.notEqual(row, undefined, 'row preserved in DB');
});

// REQ-AUTH-LOGIN-004 reaffirmed: a deactivated-login response carries no password hash.
test('REQ-AUTH-LOGIN-004: a rejected deactivated login never returns the hash', () => {
  const { svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  svc.remove('desk1');
  const login = svc.login('desk1', 'pw');
  assert.equal(login.ok, false);
  assert.equal(login.user, undefined);
});

// An active user still logs in normally (no regression).
test('active user still logs in after the soft-delete change', () => {
  const { svc } = freshService();
  svc.create({ userId: 'reporter1', name: 'Kim', password: 'pw', role: 'R' });
  const login = svc.login('reporter1', 'pw');
  assert.equal(login.ok, true);
  assert.equal(login.user.role, 'R');
});

// remove() of a missing user reports failure without throwing.
test('remove of a missing user returns ok:false', () => {
  const { svc } = freshService();
  assert.equal(svc.remove('ghost').ok, false);
});
