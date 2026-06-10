// Tests for HTTP routes in server/index.js that the auth-wiring suite does not cover:
//   - GET  /api/health              (public)
//   - GET  /api/articles            (metadata query, session-gated H-1)
//   - GET  /api/articles/search?q=  (full-text search, session-gated H-2)
//   - PUT  /api/articles/:id        (saveArticle, session-gated)
//   - GET  /api/stream              (Server-Sent Events realtime bus, session-gated H-4)
//
// H-1/H-2/H-4 security hardening: the read endpoints now require a valid x-session-id. These tests
// seed + login an R session and send the header, preserving each test's original intent (verifying
// the route's data behavior, not its anonymous reachability). Dedicated 401 boundary tests below
// assert the new gates reject unauthenticated callers.
//
// Like serverAuthWiring.test.js these drive the real Express app over an ephemeral port
// (app.listen(0)) with the built-in fetch client, and use an in-memory SQLite db so the
// production news.db is never touched (CLAUDE.md HARD rule: DB 내용은 삭제하지 않는다).
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
  return controllers.auth.login(userId, 'pw').sessionId;
}

// Shared read-session for the session-gated GET routes (H-1/H-2/H-4). Seeded once on first use.
let readSessionId;
function readSession() {
  if (readSessionId === undefined) {
    seedUser('route-reader', 'R');
    readSessionId = loginSessionId('route-reader');
  }
  return readSessionId;
}
function authGet(pathAndQuery) {
  return fetch(`${base}${pathAndQuery}`, { headers: { 'x-session-id': readSession() } });
}

async function postAction(articleId, { sessionId, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

async function postLock(articleId, { sessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/lock`, { method: 'POST', headers });
  return { status: res.status, body: await res.json() };
}

async function postUnlock(articleId, { sessionId } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/unlock`, { method: 'POST', headers });
  return { status: res.status, body: await res.json() };
}

// --- GET /api/health ------------------------------------------------------

test('GET /api/health returns { ok: true }', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

// --- GET /api/articles ----------------------------------------------------

test('GET /api/articles returns all articles as a plain array', async () => {
  const a = controllers.article.create({ title: 'list-one' });
  const b = controllers.article.create({ title: 'list-two' });
  const res = await authGet('/api/articles');
  const body = await res.json();
  assert.ok(Array.isArray(body), 'the articles route must return a plain array (frontend contract)');
  const ids = body.map((r) => r.articleId);
  assert.ok(ids.includes(a.articleId));
  assert.ok(ids.includes(b.articleId));
});

test('GET /api/articles?author= AND-filters by metadata', async () => {
  const uniqueAuthor = 'route-author-XYZ';
  const target = controllers.article.create({ title: 'filtered', author: uniqueAuthor });
  controllers.article.create({ title: 'other', author: 'someone-else' });
  const res = await authGet(`/api/articles?author=${encodeURIComponent(uniqueAuthor)}`);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1, 'only the matching author row must be returned');
  assert.equal(body[0].articleId, target.articleId);
});

// H-1 boundary: an unauthenticated list request is rejected with 401 (no roster leak).
test('GET /api/articles without a session is rejected (401)', async () => {
  const res = await fetch(`${base}/api/articles`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

// --- GET /api/articles/search?q= ------------------------------------------

test('GET /api/articles/search?q= returns title/content text matches', async () => {
  const needle = '고유검색어ZZZ';
  const hit = controllers.article.create({ title: `속보 ${needle}`, content: '본문' });
  const miss = controllers.article.create({ title: '관련없는기사', content: '무관한내용' });
  const res = await authGet(`/api/articles/search?q=${encodeURIComponent(needle)}`);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'search must return a plain array');
  const ids = body.map((r) => r.articleId);
  assert.ok(ids.includes(hit.articleId), 'the matching article must be present');
  assert.ok(!ids.includes(miss.articleId), 'a non-matching article must be excluded');
});

// H-2 boundary: an unauthenticated search request is rejected with 401.
test('GET /api/articles/search without a session is rejected (401)', async () => {
  const res = await fetch(`${base}/api/articles/search?q=anything`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

// --- PUT /api/articles/:id (session-gated R/D/Z, lock-required) --------------
// SPEC-EDIT-LOCK-001: 신설계에서 PUT은 세션 id 기반 잠금 보유를 요구한다.
// 성공 케이스는 PUT 전에 POST /lock (같은 세션)으로 잠금을 획득해야 하며,
// 미인증 거부 케이스는 구설계와 동일하게 유지된다.
// 변경 사유: page-scoped UUID 폐기 → 로그인 세션 id 단위 lock holder 정책으로 통일.

test('PUT /api/articles/:id by an authenticated R session persists and returns ok + articleId', async () => {
  seedUser('put-r', 'R');
  const sessionId = loginSessionId('put-r');
  const existing = controllers.article.create({ title: 'to-edit' });
  // SPEC-EDIT-LOCK-001: PUT 전에 같은 세션으로 잠금 획득 (신설계 실제 편집 흐름).
  const lockRes = await postLock(existing.articleId, { sessionId });
  assert.equal(lockRes.status, 200, 'lock must succeed before PUT');
  const res = await fetch(`${base}/api/articles/${existing.articleId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({ title: 'edited-title' }),
  });
  const body = await res.json();
  assert.equal(body.ok, true);
  // 신설계 PUT update는 articleId를 반환하지 않는다 (articleService.update 반환값 = {ok:true}).
  // 기사가 실제 갱신됐는지 직접 조회로 확인한다.
  const [row] = controllers.article.query({ articleId: existing.articleId });
  assert.equal(row.title, 'edited-title', 'PUT must update the existing article in place');
});

test('PUT /api/articles/:id without a session is rejected (saveArticle auth gate)', async () => {
  const existing = controllers.article.create({ title: 'guarded' });
  const res = await fetch(`${base}/api/articles/${existing.articleId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'nope' }),
  });
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.ok(body.reason, 'a reason must be returned on the unauthenticated rejection');
});

// --- M1: lock/unlock role guard (403) -------------------------------------
// userService.create restricts roles to R/D/Z, so the lock/unlock 403 branch
// (`!['R','D','Z'].includes(session.role)`) is a defense-in-depth guard not reachable via
// normal user creation. We exercise it by minting a session with a non-edit role directly on
// the session store — the HTTP layer must not assume the store only ever holds edit-capable roles.

test('LOCK: a session whose role is not R/D/Z is forbidden (403) and leaves state unchanged', async () => {
  const { articleId } = controllers.article.create({ title: 'role-gated-lock' });
  const { sessionId } = sessions.createSession({ userId: 'guest-lock', role: 'G' });
  const { status, body } = await postLock(articleId, { sessionId });
  assert.equal(status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'forbidden');
  // node:sqlite는 저장된 컬럼명(lockYN)을 그대로 반환한다 — LockYN 대신 lockYN으로 접근.
  const row = db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockYN, 'N', 'the article must not be locked by a forbidden role');
});

test('UNLOCK: a session whose role is not R/D/Z is forbidden (403)', async () => {
  const { articleId } = controllers.article.create({ title: 'role-gated-unlock' });
  const { sessionId } = sessions.createSession({ userId: 'guest-unlock', role: 'G' });
  const { status, body } = await postUnlock(articleId, { sessionId });
  assert.equal(status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'forbidden');
});

// --- Bug 2 regression: 보류(hold) on a lock-held article must NOT be rejected ---------------
// SPEC-EDIT-LOCK-001 신설계: 잠금 holder = 로그인 세션 id (POST /lock 이 sid 로 획득). 따라서
// POST /:id/action 의 잠금 게이트도 sid(로그인 세션 id)로 보유자를 식별해야 한다. 종전에는 클라이언트
// body 의 page-scoped sessionId(UUID)를 사용해, 같은 로그인 세션이 정당하게 잠근 기사에 대한 보류가
// {ok:false, reason:'lock-required'} 로 거부됐다 (UI: "전송이 거부되었습니다 (lock-required)").
test('ACTION: 보류(hold) on a lock-held article by the lock-holding login session succeeds (Bug 2 regression)', async () => {
  seedUser('hold-holder', 'R');
  const sessionId = loginSessionId('hold-holder');
  const { articleId } = controllers.article.create({ title: 'hold-locked' }); // RDS, lockYN='N'
  // 편집 진입: 같은 로그인 세션으로 잠금 획득 (실제 편집 흐름).
  const lockRes = await postLock(articleId, { sessionId });
  assert.equal(lockRes.status, 200, 'lock must succeed before the action');
  // 클라이언트(useWriteController)는 body 에 page-scoped UUID 를 sessionId 로 실어 보낸다 — 잠금 holder(sid)
  // 와는 다른 값이다. 서버 action 라우트가 sid 로 holder 를 식별하므로 보류는 통과해야 한다.
  const acted = await postAction(articleId, {
    sessionId,
    body: { action: 'hold', sessionId: 'page-scoped-uuid-differs-from-sid' },
  });
  assert.equal(acted.ok, true, 'hold on the holder\'s own locked article must succeed (not lock-required)');
  assert.equal(acted.status, 'RRH', 'R + RDS + hold transitions to RRH');
});

test('ACTION: a hold by a NON-holder login session on a locked article is still rejected (lock-required)', async () => {
  seedUser('hold-owner', 'R');
  seedUser('hold-intruder', 'R');
  const ownerSid = loginSessionId('hold-owner');
  const intruderSid = loginSessionId('hold-intruder');
  const { articleId } = controllers.article.create({ title: 'hold-foreign-lock' });
  const lockRes = await postLock(articleId, { sessionId: ownerSid });
  assert.equal(lockRes.status, 200);
  const acted = await postAction(articleId, { sessionId: intruderSid, body: { action: 'hold' } });
  assert.equal(acted.ok, false);
  assert.equal(acted.reason, 'lock-required');
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RDS');
});

test('UNLOCK: an unauthenticated unlock request is rejected (401)', async () => {
  const { articleId } = controllers.article.create({ title: 'unlock-no-session' });
  const { status, body } = await postUnlock(articleId);
  assert.equal(status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

test('UNLOCK: unlocking a missing article returns 404 not-found', async () => {
  seedUser('unlock-404', 'R');
  const sessionId = loginSessionId('unlock-404');
  const { status, body } = await postUnlock('AKR000000000000000000', { sessionId });
  assert.equal(status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'not-found');
});

// --- GET /api/stream (SSE) ------------------------------------------------
// Helpers to open an SSE connection and pull one parsed frame at a time, with a
// timeout guard so a missing event fails the test instead of hanging it.

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SSE timeout waiting for ${label}`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Parse a raw SSE frame ("event: x\ndata: y") into { event, data }.
function parseFrame(raw) {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return { event, data };
}

async function openStream() {
  const ac = new AbortController();
  // H-4: the stream is session-gated; open it with the shared read session.
  const res = await fetch(`${base}/api/stream`, {
    signal: ac.signal,
    headers: { 'x-session-id': readSession() },
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  async function nextFrame() {
    for (;;) {
      const idx = buffer.indexOf('\n\n');
      if (idx !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        return parseFrame(raw);
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
    }
  }

  async function close() {
    try {
      await reader.cancel();
    } catch {
      /* connection already torn down */
    }
    ac.abort();
  }

  return { nextFrame, close };
}

// H-4 boundary: an unauthenticated stream request gets a 401 JSON rejection, not an event stream.
test('GET /api/stream without a session is rejected (401, no event stream)', async () => {
  const res = await fetch(`${base}/api/stream`);
  assert.equal(res.status, 401);
  assert.ok(!(res.headers.get('content-type') ?? '').includes('text/event-stream'),
    'an unauthenticated stream must not switch to the SSE content-type');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

// SPEC-NEWS-REVISE-014 follow-up — 브라우저 EventSource 는 커스텀 헤더를 보낼 수 없으므로 /api/stream 만
// ?session= 쿼리 파라미터 폴백을 허용한다. (a) 유효 query → 200 text/event-stream.
test('GET /api/stream?session=<valid> is accepted (200 text/event-stream) when no header is sent', async () => {
  seedUser('sse-query-valid', 'R');
  const sessionId = loginSessionId('sse-query-valid');
  const ac = new AbortController();
  const res = await fetch(`${base}/api/stream?session=${sessionId}`, { signal: ac.signal });
  try {
    assert.equal(res.status, 200);
    assert.ok(
      (res.headers.get('content-type') ?? '').includes('text/event-stream'),
      'a valid query-param session must open the SSE stream',
    );
  } finally {
    ac.abort();
  }
});

// (b) 헤더도 쿼리도 없으면 401.
test('GET /api/stream with neither header nor query session is rejected (401)', async () => {
  const res = await fetch(`${base}/api/stream`);
  assert.equal(res.status, 401);
  assert.ok(
    !(res.headers.get('content-type') ?? '').includes('text/event-stream'),
    'no credential must not switch to the SSE content-type',
  );
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

// (c) 유효하지 않은 query session 은 401(폴백이 인증을 우회시키지 않는다).
test('GET /api/stream?session=<invalid> is rejected (401) — query fallback does not bypass auth', async () => {
  const res = await fetch(`${base}/api/stream?session=not-a-real-session`);
  assert.equal(res.status, 401);
  assert.ok(
    !(res.headers.get('content-type') ?? '').includes('text/event-stream'),
    'an invalid query session must not switch to the SSE content-type',
  );
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'unauthenticated');
});

test('SSE: stream sends a ready frame then a change frame on article create', async () => {
  const stream = await openStream();
  try {
    const ready = await withTimeout(stream.nextFrame(), 3000, 'ready');
    assert.equal(ready.event, 'ready', 'the stream must announce readiness first');

    seedUser('sse-creator', 'R');
    const sessionId = loginSessionId('sse-creator');
    const created = await fetch(`${base}/api/articles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
      body: JSON.stringify({ title: 'sse-article' }),
    });
    const { articleId } = await created.json();

    const change = await withTimeout(stream.nextFrame(), 3000, 'change');
    assert.equal(change.event, 'change');
    const payload = JSON.parse(change.data);
    assert.equal(payload.type, 'create');
    assert.equal(payload.status, 'RDS');
    assert.equal(payload.articleId, articleId, 'the change payload must carry the created articleId');
  } finally {
    await stream.close();
  }
});

test('SSE: stream sends a change frame on a lifecycle status action', async () => {
  seedUser('sse-d', 'D');
  const sessionId = loginSessionId('sse-d');
  // Create directly via the controller (no HTTP route) so no bus event is emitted during setup.
  const { articleId } = controllers.article.create({ title: 'sse-action' });
  const stream = await openStream();
  try {
    assert.equal((await withTimeout(stream.nextFrame(), 3000, 'ready')).event, 'ready');

    const acted = await postAction(articleId, { sessionId, body: { action: 'send' } });
    assert.equal(acted.ok, true, 'RDS + D + send must succeed');

    const change = await withTimeout(stream.nextFrame(), 3000, 'change');
    assert.equal(change.event, 'change');
    const payload = JSON.parse(change.data);
    assert.equal(payload.type, 'status');
    assert.equal(payload.articleId, articleId);
    assert.equal(payload.status, 'DPS', 'the status change (RDS -> DPS) must be broadcast');
  } finally {
    await stream.close();
  }
});
