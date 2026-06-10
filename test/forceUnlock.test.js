// SPEC-NEWS-REVISE-012 — 편집 잠금 강제 해제 (force-unlock).
// 서비스 신규 메서드 forceReleaseEditLock(보유자 무관 해제) + 라우트 POST /api/articles/:id/force-unlock
// (가드 401→403(D/Z)→404→처리, body.role 무시, SSE 발행, 보유자 식별자 비노출) + 강제 해제 후 기존
// 잠금 의미론 정합(재획득 가능 / 원 편집자 lock-required / 보유자-한정 unlock 계약 불변).
//
// [HARD] 시간 의존(30분 stale) 경로를 타는 정합 AC 는 now 고정 전달 — 실시간 시계 금지(30분 stale time-bomb 방지).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';
import { createControllers } from '../src/controllers/index.js';
import { createSessionService } from '../src/services/sessionService.js';
import { createApp } from '../server/index.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createArticleService(db) };
}

// ----------------------------------------------------------------------------
// §A. 서비스 — forceReleaseEditLock (보유자 무관 해제)
// ----------------------------------------------------------------------------

// AC-SRV-1 (SPEC-NEWS-REVISE-012) — 강제 해제는 lockYN='N' + 락 컬럼 전부 NULL 로 비운다.
test('AC-SRV-1 (service): forceReleaseEditLock clears lockYN and all locker columns', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'force-1' });
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'S1', now: new Date('2026-06-10T01:00:00Z') });

  const result = svc.forceReleaseEditLock(articleId);
  assert.equal(result.ok, true);
  const row = db.prepare(
    'SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?',
  ).get(articleId);
  assert.equal(row.lockYN, 'N');
  assert.equal(row.lockerUserId, null);
  assert.equal(row.lockerSessionId, null);
  assert.equal(row.lockedAt, null);
});

// AC-SRV-2 (SPEC-NEWS-REVISE-012) — 보유자가 아닌 호출자도 강제 해제할 수 있다(강제의 본질).
// 서비스 메서드는 보유자 인자를 받지 않으므로 보유자 검사 없이 항상 해제됨을 확인한다.
test('AC-SRV-2 (service): forceReleaseEditLock releases another holder\'s lock (no holder check)', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'force-2' });
  svc.acquireEditLock(articleId, { userId: 'owner', sessionId: 'sess-A', now: new Date('2026-06-10T01:00:00Z') });

  const result = svc.forceReleaseEditLock(articleId);
  assert.equal(result.ok, true);
  assert.equal(db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId).lockYN, 'N');
});

// AC-SRV-5 (SPEC-NEWS-REVISE-012) — 없는 기사는 not-found.
test('AC-SRV-5 (service): forceReleaseEditLock on a missing article returns not-found', () => {
  const { svc } = freshService();
  const result = svc.forceReleaseEditLock('AKR000000000000000000');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-found');
});

// AC-CON-3 (SPEC-NEWS-REVISE-012) — 기존 보유자-한정 releaseEditLock 계약은 강제 해제 추가로 바뀌지 않는다:
// 비보유자 release 는 not-holder no-op 이고 잠금은 그대로 유지된다(도둑질 금지 회귀).
test('AC-CON-3 (service): conditional releaseEditLock still rejects a non-holder (no-op)', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'con-3' });
  svc.acquireEditLock(articleId, { userId: 'u-a', sessionId: 'sess-A', now: new Date('2026-06-10T01:00:00Z') });

  const result = svc.releaseEditLock(articleId, { userId: 'u-b', sessionId: 'sess-B' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-holder');
  const row = db.prepare('SELECT lockYN, lockerSessionId FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockYN, 'Y', 'a non-holder must not steal the lock');
  assert.equal(row.lockerSessionId, 'sess-A');
});

// ----------------------------------------------------------------------------
// §B. 정합 — 강제 해제 후 기존 잠금 의미론 (now 고정 전달)
// ----------------------------------------------------------------------------

// AC-CON-1 (SPEC-NEWS-REVISE-012) — 강제 해제 후 타 세션이 재획득 가능(자유 잠금 취급). now 고정 전달.
test('AC-CON-1 (service): after force-unlock another session can re-acquire the lock', () => {
  const { svc } = freshService();
  const { articleId } = svc.create({ title: 'con-1' });
  const now = new Date('2026-06-10T01:00:00Z');
  svc.acquireEditLock(articleId, { userId: 'u-a', sessionId: 'sess-A', now });

  assert.equal(svc.forceReleaseEditLock(articleId).ok, true);

  const reAcquire = svc.acquireEditLock(articleId, { userId: 'u-b', sessionId: 'sess-B', now });
  assert.equal(reAcquire.ok, true, 'force-unlocked article is a free lock — re-acquire succeeds');
});

// AC-CON-2 (SPEC-NEWS-REVISE-012) — 강제 해제로 잠금을 잃은 원 편집자의 저장/액션은 기존 의미론대로
// lock-required 로 거부되고 기사 status 불변(새 동작 발명 없음). now 고정 전달.
//
// 정합 노트: 본 SPEC 은 applyAction/assertLockHolder 코드를 변경하지 않는다(spec §3.2). 기존
// SPEC-EDIT-LOCK-001 의미론상 (a) assertLockHolder 는 lockYN='N' 단독으로도 lock-required 다(보유자
// 없음). 그러나 (b) applyAction 의 락 가드는 lockYN='Y' 일 때만 발동하므로 — 자유 잠금(lockYN='N')에서는
// 신규 작성 송고처럼 통과한다(applyAction 주석). 따라서 원 편집자가 lock-required 로 막히는 "운영적
// 시점"은 강제 해제의 본질대로 다른 세션(sess-B)이 즉시 재획득한 직후다. 이 시나리오로 검증한다 —
// 코드 무변경 + 기존 의미론 회귀 확인. now 고정 전달(30분 stale time-bomb 방지).
test('AC-CON-2 (service): original editor gets lock-required after force-unlock + re-acquire (status unchanged)', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'con-2' });
  const now = new Date('2026-06-10T01:00:00Z');
  svc.acquireEditLock(articleId, { userId: 'u-a', sessionId: 'sess-A', now });
  const statusBefore = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status;

  assert.equal(svc.forceReleaseEditLock(articleId).ok, true);

  // (a) 강제 해제 직후(lockYN='N') assertLockHolder — 보유자 없음 → lock-required.
  const holderFree = svc.assertLockHolder(articleId, { userId: 'u-a', sessionId: 'sess-A', now });
  assert.equal(holderFree.ok, false);
  assert.equal(holderFree.reason, 'lock-required');

  // 강제 해제의 본질: 다른 세션이 즉시 재획득(이때부터 원 편집자는 비보유자).
  assert.equal(svc.acquireEditLock(articleId, { userId: 'u-b', sessionId: 'sess-B', now }).ok, true);

  // (b) 원 편집자 applyAction send — 락 게이트가 lock-required 로 거부, status 불변.
  const action = svc.applyAction(articleId, 'R', 'send', { userId: 'u-a', sessionId: 'sess-A', now });
  assert.equal(action.ok, false);
  assert.equal(action.reason, 'lock-required');
  assert.equal(
    db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status,
    statusBefore,
    'status must be unchanged on lock-required rejection',
  );
});

// ----------------------------------------------------------------------------
// §C. 라우트 — POST /api/articles/:id/force-unlock (가드 + SSE + 비노출)
// ----------------------------------------------------------------------------

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
  base = `http://127.0.0.1:${server.address().port}`;
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
async function forceUnlock(articleId, { sessionId, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const res = await fetch(`${base}/api/articles/${articleId}/force-unlock`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
}
// Seed a locked article: create then acquire with an arbitrary session as the holder.
function seedLockedArticle(title, holderSessionId = 'sess-holder') {
  const { articleId } = controllers.article.create({ title });
  controllers.article.acquireEditLock(articleId, {
    userId: 'holder-user',
    sessionId: holderSessionId,
    now: new Date('2026-06-10T01:00:00Z'),
  });
  return articleId;
}
function lockYNOf(articleId) {
  return db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId)?.lockYN;
}

// AC-SRV-1 (route) — D 세션 강제 해제 → 200 + ok + lockYN='N'.
test('AC-SRV-1 (route): a D session force-unlock returns 200 ok and sets lockYN=N', async () => {
  seedUser('d-force-1', 'D');
  const sessionId = loginSessionId('d-force-1');
  const articleId = seedLockedArticle('srv-1');
  assert.equal(lockYNOf(articleId), 'Y');

  const { status, body } = await forceUnlock(articleId, { sessionId });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(lockYNOf(articleId), 'N');
});

// AC-SRV-1 (route) — Z 세션도 D-mirror 로 강제 해제 가능.
test('AC-SRV-1b (route): a Z session (D-mirror) can force-unlock', async () => {
  seedUser('z-force-1', 'Z');
  const sessionId = loginSessionId('z-force-1');
  const articleId = seedLockedArticle('srv-1b');

  const { status, body } = await forceUnlock(articleId, { sessionId });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(lockYNOf(articleId), 'N');
});

// AC-SRV-2 (route) — 타인(비보유) 잠금도 호출자(다른 D 세션)가 해제한다.
test('AC-SRV-2 (route): a non-holder D session force-unlocks another session\'s lock', async () => {
  seedUser('d-force-2', 'D');
  const sessionD = loginSessionId('d-force-2');
  const articleId = seedLockedArticle('srv-2', 'sess-A-foreign');

  const { body } = await forceUnlock(articleId, { sessionId: sessionD });
  assert.equal(body.ok, true);
  assert.equal(lockYNOf(articleId), 'N', 'a non-holder D session can force-release the lock');
});

// AC-SRV-3 (route) — 미인증 → 401 우선, lockYN 불변.
test('AC-SRV-3 (route): unauthenticated force-unlock is 401 and leaves lockYN=Y', async () => {
  const articleId = seedLockedArticle('srv-3');

  const { status, body } = await forceUnlock(articleId, {});
  assert.equal(status, 401);
  assert.equal(body.ok, false);
  assert.ok(body.reason, 'a reason must be present');
  assert.equal(lockYNOf(articleId), 'Y', 'state must be unchanged on a rejected attempt');
});

// AC-SRV-4 (route) — R 권한 → 403, lockYN 불변.
test('AC-SRV-4 (route): an R session force-unlock is 403 and leaves lockYN=Y', async () => {
  seedUser('r-force-4', 'R');
  const sessionId = loginSessionId('r-force-4');
  const articleId = seedLockedArticle('srv-4');

  const { status, body } = await forceUnlock(articleId, { sessionId });
  assert.equal(status, 403);
  assert.equal(body.reason, 'forbidden');
  assert.equal(lockYNOf(articleId), 'Y');
});

// AC-SRV-5 (route) — 없는 기사 → 404 (인증·인가 통과 후).
test('AC-SRV-5 (route): force-unlock on a missing article is 404', async () => {
  seedUser('d-force-5', 'D');
  const sessionId = loginSessionId('d-force-5');

  const { status, body } = await forceUnlock('AKR000000000000000000', { sessionId });
  assert.equal(status, 404);
  assert.equal(body.reason, 'not-found');
});

// AC-SRV-6 (route) — body.role='D' 를 실어도 세션 역할(R)로만 구동 → 403, lockYN 불변.
test('AC-SRV-6 (route): body.role is ignored — an R session with body.role=D is still 403', async () => {
  seedUser('r-force-6', 'R');
  const sessionId = loginSessionId('r-force-6');
  const articleId = seedLockedArticle('srv-6');

  const { status } = await forceUnlock(articleId, { sessionId, body: { role: 'D' } });
  assert.equal(status, 403, 'role is derived from the session, not the request body');
  assert.equal(lockYNOf(articleId), 'Y');
});

// AC-SRV-7 (route) — 성공 시 SSE change 발행. 실제 SSE 스트림을 열어 ready → change 프레임을 검증한다
// (serverRoutes.test.js 의 SSE 프레임 파서 패턴 재사용).
function parseFrame(raw) {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return { event, data };
}
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SSE timeout waiting for ${label}`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function openStream(sessionId) {
  const ac = new AbortController();
  const res = await fetch(`${base}/api/stream`, {
    signal: ac.signal,
    headers: { 'x-session-id': sessionId },
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
    try { await reader.cancel(); } catch { /* already torn down */ }
    ac.abort();
  }
  return { nextFrame, close };
}

test('AC-SRV-7 (route): a successful force-unlock emits an SSE change frame for the article', async () => {
  seedUser('d-force-7', 'D');
  const sessionId = loginSessionId('d-force-7');
  const articleId = seedLockedArticle('srv-7');

  const stream = await openStream(sessionId);
  try {
    const ready = await withTimeout(stream.nextFrame(), 3000, 'ready');
    assert.equal(ready.event, 'ready', 'the stream must announce readiness first');

    await forceUnlock(articleId, { sessionId });

    const change = await withTimeout(stream.nextFrame(), 3000, 'change');
    assert.equal(change.event, 'change');
    const payload = JSON.parse(change.data);
    assert.equal(payload.articleId, articleId, 'the change payload must carry the force-unlocked articleId');
  } finally {
    await stream.close();
  }
});

// AC-SRV-8 (route) — 응답 본문에 직전 보유자 식별자 비노출.
test('AC-SRV-8 (route): the response body does not leak the prior holder identifiers', async () => {
  seedUser('d-force-8', 'D');
  const sessionId = loginSessionId('d-force-8');
  const articleId = seedLockedArticle('srv-8', 'sess-secret');

  const { body } = await forceUnlock(articleId, { sessionId });
  assert.equal(body.ok, true);
  assert.equal('lockerSessionId' in body, false, 'must not expose lockerSessionId');
  assert.equal('lockerUserId' in body, false, 'must not expose lockerUserId');
});
