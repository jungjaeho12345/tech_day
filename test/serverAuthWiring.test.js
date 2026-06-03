// Tests for SPEC-AUTH-001 HTTP route wiring (server/index.js):
// the REST layer must derive the acting role from the validated x-session-id session,
// never from req.body.role, and must gate users-roster exposure behind a session.
//
// These exercise the real Express app via an ephemeral port (app.listen(0)) using the
// built-in fetch client, so the x-session-id header path (server/index.js) is covered end-to-end.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';
import { createSessionService } from '../src/services/sessionService.js';
import { createApp } from '../server/index.js';

// Shared live server bound to an ephemeral port for the whole file.
let server;
let base;
let db;
let controllers;
let sessions;

before(async () => {
  db = new DatabaseSync(':memory:');
  createSchema(db);
  sessions = createSessionService();
  const media = { search: async () => ({ items: [], error: false }) };
  controllers = createControllers(db, { mediaSearch: media, sessionService: sessions });
  const app = createApp({ controllers, sessionService: sessions });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

function seedUser(userId, role) {
  controllers.user.create({ userId, name: userId, password: 'pw', role });
}

function loginSessionId(userId) {
  const res = controllers.auth.login(userId, 'pw');
  return res.sessionId;
}

async function postAction(articleId, { sessionId, body }) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

// C-1: an action request with no session must be rejected (no trust of body.role).
test('C-1: action without a session is rejected (no body.role trust)', async () => {
  seedUser('r-nosession', 'R');
  const { articleId } = controllers.article.create({ title: 'x' });
  // Attacker forges role=D in the body but sends no session.
  const result = await postAction(articleId, { body: { role: 'D', action: 'send' } });
  assert.equal(result.ok, false);
  assert.ok(result.reason, 'a reason must be returned on rejection');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.status, 'RDS', 'state must be unchanged when the request is rejected');
});

// C-1: an R session attempting a 고침 (edit) on a DPS article must be denied via the gate.
test('C-1: an R session is denied a DPS edit and the article state is unchanged', async () => {
  seedUser('r-dps', 'R');
  seedUser('d-dps', 'D');
  const { articleId } = controllers.article.create({ title: 'x' });
  controllers.article.applyAction(articleId, 'D', 'send'); // RDS -> DPS (backend lifecycle)
  const sessionId = loginSessionId('r-dps');
  // Even if the body forges role=D, the session (R) governs and the DPS-edit rule denies R.
  const result = await postAction(articleId, { sessionId, body: { role: 'D', action: 'edit' } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.status, 'DPS', 'state must be unchanged after a denied DPS edit');
});

// C-1: a valid session role drives a normal transition; the body role is ignored.
test('C-1: a D session performs a normal transition using the session role', async () => {
  seedUser('d-send', 'D');
  const { articleId } = controllers.article.create({ title: 'x' });
  const sessionId = loginSessionId('d-send');
  // Body forges role=R, but the session role (D) is what is used: RDS|D|send -> DPS.
  const result = await postAction(articleId, { sessionId, body: { role: 'R', action: 'send' } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DPS', 'the D session role must drive the transition, not body.role');
});

// C-1: an invalid/expired session id is rejected.
test('C-1: an unknown session id is rejected', async () => {
  const { articleId } = controllers.article.create({ title: 'x' });
  const result = await postAction(articleId, { sessionId: 'no-such-session', body: { action: 'send' } });
  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

// C-2: GET /api/users with no session must NOT expose the full roster.
test('C-2: unauthenticated GET /api/users does not expose the full roster', async () => {
  seedUser('z-roster', 'Z');
  seedUser('r-roster', 'R');
  const res = await fetch(`${base}/api/users`);
  const body = await res.json();
  // Either a rejection object, or at most minimal info — never the full multi-field roster array.
  if (Array.isArray(body)) {
    assert.fail('unauthenticated /api/users must not return a roster array');
  }
  assert.equal(body.ok, false);
  assert.ok(body.reason);
});

// C-2: a Z session sees the full roster (management view).
test('C-2: a Z session GET /api/users returns the full roster array', async () => {
  seedUser('z-full', 'Z');
  const sessionId = loginSessionId('z-full');
  const res = await fetch(`${base}/api/users`, { headers: { 'x-session-id': sessionId } });
  const body = await res.json();
  assert.ok(Array.isArray(body), 'a Z session must receive the roster as a plain array (contract)');
  assert.ok(body.length >= 1);
  assert.ok(!('password' in body[0]), 'never expose the password hash');
});

// C-2: a non-Z (R) session gets minimal department info, preserving the frontend dropdown contract.
test('C-2: an R session GET /api/users returns a minimal department-only array', async () => {
  seedUser('r-min', 'R');
  const sessionId = loginSessionId('r-min');
  const res = await fetch(`${base}/api/users`, { headers: { 'x-session-id': sessionId } });
  const body = await res.json();
  assert.ok(Array.isArray(body), 'frontend queryUsers contract expects a plain array');
  // The frontend only reads u.department; the hash and other sensitive fields must be absent.
  for (const u of body) {
    assert.ok(!('password' in u), 'no password hash in the minimal view');
  }
});

// M-2: article create requires an authenticated edit-capable (R/D/Z) session.
test('M-2: unauthenticated POST /api/articles is rejected', async () => {
  const res = await fetch(`${base}/api/articles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'no-session' }),
  });
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.ok(body.reason);
});

// M-2: an authenticated R session may create an article.
test('M-2: an authenticated R session may create an article', async () => {
  seedUser('r-create', 'R');
  const sessionId = loginSessionId('r-create');
  const res = await fetch(`${base}/api/articles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({ title: 'created-by-R' }),
  });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.articleId);
});

// --- User management routes (POST/PUT /api/users) -- Z-only via manageUsers gate ---

async function postUser(user, { sessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(user ?? {}),
  });
  return res.json();
}

async function putUser(userId, fields, { sessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(fields ?? {}),
  });
  return res.json();
}

function userExists(userId) {
  const [u] = controllers.user.query({ userId });
  return u !== undefined;
}

// USRMGMT: a Z session creates a user via POST /api/users (the body is the user object).
test('USRMGMT: a Z session POST /api/users creates a user', async () => {
  seedUser('z-poster', 'Z');
  const sessionId = loginSessionId('z-poster');
  const newUser = {
    userId: 'created-by-z',
    name: '신규기자',
    password: 'pw',
    role: 'R',
    department: '정치부',
    departmentCode: 'POL',
  };
  const body = await postUser(newUser, { sessionId });
  assert.equal(body.ok, true, 'a Z session must be allowed to create a user');
  assert.ok(userExists('created-by-z'), 'the user must be persisted via the create op');
});

// USRMGMT: a Z session updates a user via PUT /api/users/:userId (body = fields to change).
test('USRMGMT: a Z session PUT /api/users/:userId updates a user', async () => {
  seedUser('z-putter', 'Z');
  seedUser('target-user', 'R');
  const sessionId = loginSessionId('z-putter');
  const body = await putUser('target-user', { department: '경제부' }, { sessionId });
  assert.equal(body.ok, true, 'a Z session must be allowed to update an existing user');
  const [updated] = controllers.user.query({ userId: 'target-user' });
  assert.equal(updated.department, '경제부', 'the update op must mutate the targeted user');
});

// USRMGMT: PUT for an unknown user returns the not-found rejection from userService.update.
test('USRMGMT: a Z session PUT for an unknown user returns not-found', async () => {
  seedUser('z-put-missing', 'Z');
  const sessionId = loginSessionId('z-put-missing');
  const body = await putUser('no-such-user', { department: 'x' }, { sessionId });
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'not-found');
});

// USRMGMT: a non-Z (R) session is forbidden from creating; the user must NOT be created.
test('USRMGMT: a non-Z session POST /api/users is forbidden and does not create', async () => {
  seedUser('r-poster', 'R');
  const sessionId = loginSessionId('r-poster');
  const body = await postUser(
    { userId: 'blocked-by-r', name: 'x', password: 'pw', role: 'R' },
    { sessionId },
  );
  assert.equal(body.ok, false, 'a non-Z session must be denied user creation');
  assert.ok(body.reason, 'a reason must be returned on the authorization denial');
  assert.equal(userExists('blocked-by-r'), false, 'no user may be created by a non-Z session');
});

// USRMGMT: an unauthenticated POST /api/users is rejected and creates nothing.
test('USRMGMT: an unauthenticated POST /api/users is rejected and does not create', async () => {
  const body = await postUser({ userId: 'blocked-anon', name: 'x', password: 'pw', role: 'R' });
  assert.equal(body.ok, false);
  assert.ok(body.reason);
  assert.equal(userExists('blocked-anon'), false, 'no user may be created without a session');
});

// USRMGMT: an unauthenticated PUT /api/users/:userId is rejected and mutates nothing.
test('USRMGMT: an unauthenticated PUT /api/users/:userId is rejected and does not mutate', async () => {
  seedUser('put-victim', 'R');
  const body = await putUser('put-victim', { department: '사회부' });
  assert.equal(body.ok, false);
  assert.ok(body.reason);
  const [unchanged] = controllers.user.query({ userId: 'put-victim' });
  assert.notEqual(unchanged.department, '사회부', 'the user must be unchanged without a session');
});

// --- SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK + REQ-API-INSERT-UPDATE-SPLIT route wiring ---

async function acquireLock(articleId, { sessionId, pageSessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/lock`, {
    method: 'POST',
    headers,
    body: JSON.stringify(pageSessionId === undefined ? {} : { sessionId: pageSessionId }),
  });
  return res.json();
}

async function releaseLock(articleId, { sessionId, pageSessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/lock`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(pageSessionId === undefined ? {} : { sessionId: pageSessionId }),
  });
  return res.json();
}

async function putArticle(articleId, body, { sessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

// AC-EDIT-LOCK-1: POST /api/articles/:id/lock acquires the lock with the page-scoped sessionId.
test('AC-EDIT-LOCK-1: POST /api/articles/:id/lock acquires (auth session userId, page sessionId)', async () => {
  seedUser('r-lock-1', 'R');
  const sessionId = loginSessionId('r-lock-1');
  const { articleId } = controllers.article.create({ title: 'lock-1' });
  const result = await acquireLock(articleId, { sessionId, pageSessionId: 'page-A' });
  assert.equal(result.ok, true, 'first-time acquire on a free lock must succeed');
});

// AC-EDIT-LOCK-2: a different user's lock acquire is rejected (locked).
test('AC-EDIT-LOCK-2: second user cannot acquire while another user holds the lock', async () => {
  seedUser('r-lock-2a', 'R');
  seedUser('r-lock-2b', 'R');
  const { articleId } = controllers.article.create({ title: 'lock-2' });
  const sessionA = loginSessionId('r-lock-2a');
  const sessionB = loginSessionId('r-lock-2b');
  const first = await acquireLock(articleId, { sessionId: sessionA, pageSessionId: 'page-A' });
  assert.equal(first.ok, true);
  const second = await acquireLock(articleId, { sessionId: sessionB, pageSessionId: 'page-B' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'locked');
});

// AC-EDIT-LOCK-3: release frees the lock so another user can acquire.
test('AC-EDIT-LOCK-3: DELETE /api/articles/:id/lock releases; a second user can then acquire', async () => {
  seedUser('r-lock-3a', 'R');
  seedUser('r-lock-3b', 'R');
  const { articleId } = controllers.article.create({ title: 'lock-3' });
  const sessionA = loginSessionId('r-lock-3a');
  const sessionB = loginSessionId('r-lock-3b');
  await acquireLock(articleId, { sessionId: sessionA, pageSessionId: 'page-A' });
  const released = await releaseLock(articleId, { sessionId: sessionA, pageSessionId: 'page-A' });
  assert.equal(released.ok, true);
  const reAcquired = await acquireLock(articleId, { sessionId: sessionB, pageSessionId: 'page-B' });
  assert.equal(reAcquired.ok, true);
});

// AC-EDIT-LOCK-1 boundary: an unauthenticated POST /api/articles/:id/lock is rejected.
test('AC-EDIT-LOCK-1 boundary: unauthenticated lock acquire is rejected', async () => {
  const { articleId } = controllers.article.create({ title: 'lock-anon' });
  const result = await acquireLock(articleId, { pageSessionId: 'page-A' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unauthenticated');
});

// AC-API-2: PUT /api/articles/:id routes to articleService.update (R-CRIT-2 regression guard).
// The previous wiring (saveArticle) called .create on every PUT — assert that the SAME articleId is
// updated (not a NEW one minted), so we know we are hitting the update path.
test('AC-API-2 + R-CRIT-2: PUT /api/articles/:id updates the SAME row (no new id minted)', async () => {
  seedUser('d-put', 'D');
  const sessionId = loginSessionId('d-put');
  const { articleId } = controllers.article.create({ title: '원본', content: '원본 본문' });
  // Acquire the lock first (REQ-EDIT-LOCK gates PUT).
  await acquireLock(articleId, { sessionId, pageSessionId: 'page-PUT' });
  const result = await putArticle(
    articleId,
    { sessionId: 'page-PUT', title: '편집된 제목', markupVersion: 'v2' },
    { sessionId },
  );
  assert.equal(result.ok, true, 'PUT must succeed when the caller holds the lock');
  // R-CRIT-2 가드: 원래 articleId의 row가 갱신됨 (새 articleId가 생기지 않음).
  const [row] = controllers.article.query({ articleId });
  assert.equal(row.title, '편집된 제목');
  // The original row count for THIS articleId must still be exactly 1 (no shadow create).
  const duplicates = db.prepare('SELECT COUNT(*) AS n FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(duplicates.n, 1, 'no duplicate row created — PUT updated in place');
  // Cross-check: no new row with the edited title was minted (would happen under the legacy create path).
  const titleRows = db.prepare("SELECT COUNT(*) AS n FROM Contents WHERE title = '편집된 제목'").get();
  assert.equal(titleRows.n, 1, 'no extra row with the edited title was minted');
});

// AC-EDIT-LOCK-6: PUT /api/articles/:id requires the lock holder.
test('AC-EDIT-LOCK-6: PUT /api/articles/:id without lock is rejected with lock-required', async () => {
  seedUser('d-put-nolock', 'D');
  const sessionId = loginSessionId('d-put-nolock');
  const { articleId } = controllers.article.create({ title: 'no-lock' });
  const result = await putArticle(
    articleId,
    { sessionId: 'page-PUT', title: 'should-not-apply' },
    { sessionId },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'lock-required');
  const [row] = controllers.article.query({ articleId });
  assert.equal(row.title, 'no-lock', 'no mutation when the lock guard rejects');
});
