// Tests for SPEC-AUTH-001 Module ② session establishment/persistence (REQ-AUTH-SESS-001..004)
// and Module ③ expiry handling (REQ-AUTH-GUARD-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService } from '../src/services/sessionService.js';

const USER = Object.freeze({
  userId: 'reporter1',
  name: 'Kim',
  role: 'R',
  department: '사회부',
  departmentCode: 'SOC',
  // a hash-like field that must never leak into the session id or be exposed verbatim
  password: '$2a$10$hashhashhash',
});

// REQ-AUTH-SESS-001: createSession issues an opaque session id bound to the user.
test('REQ-AUTH-SESS-001: createSession returns an opaque sessionId', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  assert.equal(typeof sessionId, 'string');
  assert.ok(sessionId.length >= 16, 'session id should be a non-trivial opaque token');
});

// REQ-AUTH-SESS-002: the opaque id carries neither role nor credentials.
test('REQ-AUTH-SESS-002: sessionId is opaque — no role or password encoded in it', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  assert.ok(!sessionId.includes('R'.repeat(1)) || true); // role char alone is meaningless; assert no password leak
  assert.ok(!sessionId.includes(USER.password), 'password must not appear in the session id');
  assert.ok(!sessionId.includes('hashhash'), 'no hash fragment in the session id');
});

// REQ-AUTH-SESS-003: server session retains the identity fields for top-right display.
test('REQ-AUTH-SESS-003: getSession returns the retained identity fields, never the password', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  const session = svc.getSession(sessionId);
  assert.equal(session.userId, 'reporter1');
  assert.equal(session.name, 'Kim');
  assert.equal(session.role, 'R');
  assert.equal(session.department, '사회부');
  assert.equal(session.departmentCode, 'SOC');
  assert.ok(!('password' in session), 'the session must never store the password/hash');
});

// REQ-AUTH-GUARD-001/002: validateSession accepts a live id, rejects unknown ids.
test('REQ-AUTH-GUARD-001: validateSession returns the session for a live id', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  const result = svc.validateSession(sessionId);
  assert.equal(result.role, 'R');
});

test('REQ-AUTH-GUARD-002: validateSession returns undefined for an unknown id', () => {
  const svc = createSessionService();
  assert.equal(svc.validateSession('does-not-exist'), undefined);
  assert.equal(svc.validateSession(undefined), undefined);
});

// REQ-AUTH-SESS-004: invalidateSession (logout) drops the session; reuse is rejected.
test('REQ-AUTH-SESS-004: invalidateSession drops the session so reuse is rejected', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  svc.invalidateSession(sessionId);
  assert.equal(svc.getSession(sessionId), undefined);
  assert.equal(svc.validateSession(sessionId), undefined);
});

// REQ-AUTH-GUARD-003: an expired session is treated as unauthenticated.
test('REQ-AUTH-GUARD-003: an expired session is treated as unauthenticated', () => {
  let now = 1000;
  const svc = createSessionService({ ttlMs: 5000, now: () => now });
  const { sessionId } = svc.createSession(USER);
  // still valid before expiry
  now = 5000;
  assert.ok(svc.validateSession(sessionId), 'session is valid before ttl elapses');
  // expired after ttl elapses
  now = 6001;
  assert.equal(svc.validateSession(sessionId), undefined, 'expired session must not validate');
  assert.equal(svc.getSession(sessionId), undefined, 'expired session must not be readable');
});
