// Tests for SPEC-BACKEND-CORE-001 user model + service + login (AC-5, AC-6, AC-7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { createSchema } from '../src/db/schema.js';
import { createUserService } from '../src/services/userService.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createUserService(db) };
}

// AC-7 create: password stored as hash, never plaintext
test('AC-7: create stores a bcrypt hash, not the plaintext password', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'reporter1', name: 'Kim', password: 'pw', role: 'R', department: '사회부' });
  const row = db.prepare('SELECT * FROM User WHERE userId = ?').get('reporter1');
  assert.notEqual(row.password, 'pw', 'plaintext must not be stored');
  assert.ok(bcrypt.compareSync('pw', row.password), 'stored value must be a bcrypt hash of the password');
  assert.equal(row.role, 'R');
});

test('AC-7: create rejects an invalid role', () => {
  const { svc } = freshService();
  assert.throws(() => svc.create({ userId: 'x', password: 'pw', role: 'Q' }), /role/i);
});

// AC-7 query: never returns password hash
test('AC-7: query returns the user without the password hash', () => {
  const { svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  const result = svc.query({ userId: 'desk1' });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, 'desk1');
  assert.equal(result[0].role, 'D');
  assert.ok(!('password' in result[0]), 'password hash must not be present in query result');
});

// AC-7 update
test('AC-7: update changes fields by userId', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  const result = svc.update('desk1', { name: 'Park', department: '정치부' });
  assert.equal(result.ok, true);
  const row = db.prepare('SELECT name, department FROM User WHERE userId = ?').get('desk1');
  assert.equal(row.name, 'Park');
  assert.equal(row.department, '정치부');
});

test('AC-7: update re-hashes when password supplied; still not plaintext', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  svc.update('desk1', { password: 'newpw' });
  const row = db.prepare('SELECT password FROM User WHERE userId = ?').get('desk1');
  assert.notEqual(row.password, 'newpw');
  assert.ok(bcrypt.compareSync('newpw', row.password));
});

test('AC-7: update of a missing user returns not-found', () => {
  const { svc } = freshService();
  assert.equal(svc.update('ghost', { name: 'x' }).ok, false);
});

// AC-7 delete
test('AC-7: delete removes the user by userId', () => {
  const { db, svc } = freshService();
  svc.create({ userId: 'desk1', name: 'Lee', password: 'pw', role: 'D' });
  const result = svc.remove('desk1');
  assert.equal(result.ok, true);
  const row = db.prepare('SELECT * FROM User WHERE userId = ?').get('desk1');
  assert.equal(row, undefined);
});

// AC-5: login success via hash compare, returns identity + role, no hash in response
test('AC-5: login succeeds with correct password and returns identity + role without the hash', () => {
  const { svc } = freshService();
  svc.create({ userId: 'reporter1', name: 'Kim', password: 'pw', role: 'R' });
  const result = svc.login('reporter1', 'pw');
  assert.equal(result.ok, true);
  assert.equal(result.user.userId, 'reporter1');
  assert.equal(result.user.role, 'R');
  assert.ok(!('password' in result.user), 'password hash must never be returned');
});

// AC-6: login failure on wrong password or missing user, no session
test('AC-6: login fails on wrong password and establishes no session', () => {
  const { svc } = freshService();
  svc.create({ userId: 'reporter1', name: 'Kim', password: 'pw', role: 'R' });
  const result = svc.login('reporter1', 'wrong');
  assert.equal(result.ok, false);
  assert.equal(result.user, undefined);
});

test('AC-6: login fails on unknown userId', () => {
  const { svc } = freshService();
  const result = svc.login('nobody', 'pw');
  assert.equal(result.ok, false);
  assert.equal(result.user, undefined);
});
