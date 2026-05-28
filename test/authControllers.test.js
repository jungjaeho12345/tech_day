// Tests for SPEC-AUTH-001 controller wiring: login->session, logout, and session-derived
// authorization for protected user-management + DPS-edit actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';

function freshControllers() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const media = { search: async () => ({ items: [], error: false }) };
  const c = createControllers(db, { mediaSearch: media });
  return { db, c };
}

function seedUser(c, userId, role) {
  c.user.create({ userId, name: userId, password: 'pw', role });
}

// 시나리오 1: login success -> session created, sessionId issued, no hash exposed.
test('REQ-AUTH-LOGIN-002/SESS-001: login success returns sessionId + sanitized user, no hash', () => {
  const { c } = freshControllers();
  seedUser(c, 'reporter1', 'R');
  const res = c.auth.login('reporter1', 'pw');
  assert.equal(res.ok, true);
  assert.equal(typeof res.sessionId, 'string');
  assert.equal(res.user.userId, 'reporter1');
  assert.equal(res.user.role, 'R');
  assert.ok(!('password' in res.user), 'no password hash in the login response');
});

// 시나리오 2: login failure -> no session, reason returned for ALERT, no hash.
test('REQ-AUTH-LOGIN-003: login failure returns {ok:false, reason} and no session', () => {
  const { c } = freshControllers();
  seedUser(c, 'reporter1', 'R');
  const res = c.auth.login('reporter1', 'wrong');
  assert.equal(res.ok, false);
  assert.equal(typeof res.reason, 'string');
  assert.equal(res.sessionId, undefined, 'no session must be established on failure');
  assert.equal(res.user, undefined);
});

// EC-3: a protected action with no/invalid session is rejected as unauthenticated.
test('REQ-AUTH-GUARD-002: protected action with an unknown sessionId is rejected', () => {
  const { c } = freshControllers();
  const res = c.auth.manageUsers('no-such-session', 'create', { userId: 'x', password: 'pw', role: 'R' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unauthenticated');
});

// 시나리오 4 + EC-2: user management is Z-only; the role comes from the session, not the client.
test('REQ-AUTH-USRMGMT-001: a Z session may create a user', () => {
  const { c } = freshControllers();
  seedUser(c, 'admin', 'Z');
  const { sessionId } = c.auth.login('admin', 'pw');
  const res = c.auth.manageUsers(sessionId, 'create', { userId: 'new1', password: 'pw', role: 'R' });
  assert.equal(res.ok, true);
});

test('REQ-AUTH-USRMGMT-002: an R session is denied user management and no row changes', () => {
  const { db, c } = freshControllers();
  seedUser(c, 'reporter1', 'R');
  const { sessionId } = c.auth.login('reporter1', 'pw');
  const before = db.prepare('SELECT COUNT(*) AS n FROM User').get().n;
  const res = c.auth.manageUsers(sessionId, 'create', { userId: 'sneaky', password: 'pw', role: 'R' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'forbidden');
  const after = db.prepare('SELECT COUNT(*) AS n FROM User').get().n;
  assert.equal(after, before, 'no User row may be created by an unauthorized session');
});

// 시나리오 3 + EC-2: DPS edit is D-only; an R session is denied and the article state is unchanged.
test('REQ-AUTH-ROLE-002/003: an R session is denied DPS edit and the article state is unchanged', () => {
  const { db, c } = freshControllers();
  seedUser(c, 'reporter1', 'R');
  seedUser(c, 'desk1', 'D');
  // create an article and move it to DPS via a D action (lifecycle owned by backend SPEC).
  const created = c.article.create({ title: 'x' });
  c.article.applyAction(created.articleId, 'D', 'send'); // RDS -> DPS
  const { sessionId } = c.auth.login('reporter1', 'pw'); // R session

  const res = c.auth.editDps(sessionId, created.articleId, 'edit');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'forbidden');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(created.articleId);
  assert.equal(row.status, 'DPS', 'state must be unchanged after a denied edit');
});

test('REQ-AUTH-ROLE-002: a D session is authorized for a DPS edit (client role ignored)', () => {
  const { c } = freshControllers();
  seedUser(c, 'desk1', 'D');
  const created = c.article.create({ title: 'x' });
  c.article.applyAction(created.articleId, 'D', 'send');
  const { sessionId } = c.auth.login('desk1', 'pw');
  // EC-2: even if a client forged role were passed it is irrelevant; the session role (D) governs.
  const res = c.auth.editDps(sessionId, created.articleId, 'edit');
  assert.equal(res.ok, true);
});

// REQ-AUTH-USRMGMT-001: a Z session may update / soft-delete / query users.
test('REQ-AUTH-USRMGMT-001/003: a Z session may update, soft-delete (remove), and query users', () => {
  const { db, c } = freshControllers();
  seedUser(c, 'admin', 'Z');
  seedUser(c, 'reporter1', 'R');
  const { sessionId } = c.auth.login('admin', 'pw');

  const upd = c.auth.manageUsers(sessionId, 'update', { userId: 'reporter1', fields: { name: 'Renamed' } });
  assert.equal(upd.ok, true);

  const q = c.auth.manageUsers(sessionId, 'query', { userId: 'reporter1' });
  assert.equal(q.ok, true);
  assert.equal(q.users[0].name, 'Renamed');

  const del = c.auth.manageUsers(sessionId, 'remove', { userId: 'reporter1' });
  assert.equal(del.ok, true);
  const row = db.prepare('SELECT active FROM User WHERE userId = ?').get('reporter1');
  assert.equal(row.active, 'N', 'soft delete preserves the row');
});

test('manageUsers rejects an unknown op for an authorized session', () => {
  const { c } = freshControllers();
  seedUser(c, 'admin', 'Z');
  const { sessionId } = c.auth.login('admin', 'pw');
  const res = c.auth.manageUsers(sessionId, 'explode', {});
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unknown-op');
});

// editDps on a non-DPS article uses the generic edit rule (R/D/Z allowed).
test('REQ-AUTH-ROLE-001: editDps on a non-DPS (RDS) article permits an R session', () => {
  const { c } = freshControllers();
  seedUser(c, 'reporter1', 'R');
  const created = c.article.create({ title: 'x' }); // stays RDS
  const { sessionId } = c.auth.login('reporter1', 'pw');
  const res = c.auth.editDps(sessionId, created.articleId, 'edit');
  assert.equal(res.ok, true);
  assert.equal(res.status, 'RDS');
});

test('REQ-AUTH-GUARD-002: editDps with an unknown session is unauthenticated', () => {
  const { c } = freshControllers();
  const res = c.auth.editDps('no-such-session', 'AKR00000000000000000', 'edit');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unauthenticated');
});

test('REQ-AUTH-GUARD: editDps on a non-existent article returns not-found', () => {
  const { c } = freshControllers();
  seedUser(c, 'desk1', 'D');
  const { sessionId } = c.auth.login('desk1', 'pw');
  const res = c.auth.editDps(sessionId, 'AKR00000000000000000', 'edit');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not-found');
});

// SPEC-AUTH-001 Finding #2 (A07 session fixation): login mints a fresh sessionId on each call,
// and a prior session supplied to login is invalidated before the new one is issued.
test('Finding#2: login mints a new sessionId and invalidates any prior session id', () => {
  const { c } = freshControllers();
  seedUser(c, 'admin', 'Z');

  const first = c.auth.login('admin', 'pw');
  assert.equal(first.ok, true);
  assert.equal(typeof first.sessionId, 'string');

  // Re-login carrying the prior (pre-auth) session id: it must be invalidated and a NEW id minted.
  const second = c.auth.login('admin', 'pw', first.sessionId);
  assert.equal(second.ok, true);
  assert.notEqual(second.sessionId, first.sessionId, 'a fresh session id must be minted on re-login');

  // The prior session is gone (session fixation guard); the new one is live.
  assert.equal(c.auth.manageUsers(first.sessionId, 'query', {}).reason, 'unauthenticated');
  assert.equal(c.auth.manageUsers(second.sessionId, 'query', {}).ok, true);
});

// EC-4: logout invalidates the session so reuse is rejected.
test('REQ-AUTH-SESS-004/GUARD-002: after logout the session is rejected', () => {
  const { c } = freshControllers();
  seedUser(c, 'admin', 'Z');
  const { sessionId } = c.auth.login('admin', 'pw');
  c.auth.logout(sessionId);
  const res = c.auth.manageUsers(sessionId, 'create', { userId: 'x', password: 'pw', role: 'R' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unauthenticated');
});
