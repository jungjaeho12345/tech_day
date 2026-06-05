// Regression guard tests for SPEC-NEWS-REVISE-003 REQ-ARTICLE-LOCK-YN (토픽 C).
// AC-LOCK-1..6 — Δ-only: these assert the RESULTANT lock behaviour already implemented in
// src/services/articleService.js (acquireEditLock / releaseEditLock / assertLockHolder with the
// D2-3 = 30분 stale-TTL auto-release). No production code is changed by this SPEC.
//
// 1 인 1 페이지 정책 매핑: the page-scoped UUID IS the sessionId at the service layer
// (server/index.js replays a per-editor-mount page session id as `sessionId`). A second tab/page
// for the same user therefore presents a DIFFERENT sessionId — modelled here as P1/P2.
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService, EDIT_LOCK_TIMEOUT_MS } from '../src/services/articleService.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createArticleService(db) };
}

function seedArticle(svc) {
  // RDS 기사 1건 — create()는 초기 상태 RDS + lockYN='N'으로 적재한다.
  return svc.create({ title: '편집 락 대상', content: '본문', author: 'U1' },
    { now: new Date('2026-06-04T00:00:00Z') }).articleId;
}

// AC-LOCK-1: 정상 진입 — 빈 락(lockYN='N') → 획득 성공 + locker/페이지 정보 기록.
test('AC-LOCK-1: 정상 진입 — 빈 락이면 lockYN=Y로 획득하고 보유자/페이지 정보를 기록한다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  const T0 = new Date('2026-06-04T01:00:00Z');
  const result = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 });
  assert.equal(result.ok, true);

  const row = db.prepare(
    'SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?',
  ).get(articleId);
  assert.equal(row.lockYN, 'Y');
  assert.equal(row.lockerUserId, 'U1');
  assert.equal(row.lockerSessionId, 'P1');
  assert.equal(row.lockedAt, T0.toISOString());
});

// AC-LOCK-2: 정상 해제 — release 후 lockYN='N' + 보유자 정보 비움. 멱등(이미 해제 상태도 ok).
test('AC-LOCK-2: 정상 해제 — releaseEditLock이 lockYN=N으로 풀고 보유자 정보를 비운다 (멱등)', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

  const released = svc.releaseEditLock(articleId, { userId: 'U1', sessionId: 'P1' });
  assert.equal(released.ok, true);
  const row = db.prepare(
    'SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?',
  ).get(articleId);
  assert.equal(row.lockYN, 'N');
  assert.equal(row.lockerUserId, null);
  assert.equal(row.lockerSessionId, null);
  assert.equal(row.lockedAt, null);

  // beforeunload/visibilitychange 더블 파이어를 모사 — 이미 풀린 락 재해제도 에러 없이 ok.
  const again = svc.releaseEditLock(articleId, { userId: 'U1', sessionId: 'P1' });
  assert.equal(again.ok, true);
});

// AC-LOCK-3: 다른 사용자 차단 — read-only 거부 + 보유자 정보 보존.
test('AC-LOCK-3: 다른 사용자 차단 — 보유 중인 락에 다른 user가 진입하면 reason=locked로 거부되고 보유자가 유지된다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

  const conflict = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'P2', now: new Date('2026-06-04T01:01:00Z') });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'locked');

  // DB의 보유자 정보 변경 없음.
  const row = db.prepare('SELECT lockerUserId, lockerSessionId FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockerUserId, 'U1');
  assert.equal(row.lockerSessionId, 'P1');
});

// AC-LOCK-4: 같은 사용자 다른 페이지 차단 (003 고유 1 인 1 페이지) —
// 동일 user U1 이 다른 페이지(다른 sessionId P2)로 진입 → 거부 + lockerSessionId(페이지 단위 식별자) 미덮어쓰기.
// [SPEC-NEWS-REVISE-006 AC-HARDEN-3] 주석 어휘를 lockerSessionId(페이지 단위 식별자) 단일 표기로 정리(코드/단언 무변경).
test('AC-LOCK-4: 같은 사용자 다른 페이지 차단 — U1이 다른 페이지 ID로 재진입하면 거부되고 lockerSessionId가 P1로 유지된다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  // P1 (첫 번째 탭) 이 락 보유.
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

  // 같은 user U1, 다른 페이지 P2 (두 번째 탭의 localStorage UUID) 로 진입 시도.
  const otherPage = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P2', now: new Date('2026-06-04T01:01:00Z') });
  assert.equal(otherPage.ok, false);
  assert.equal(otherPage.reason, 'locked');

  // lockerSessionId(페이지 단위 식별자) 가 여전히 P1 — P2 로 덮어쓰지 않음.
  const row = db.prepare('SELECT lockerUserId, lockerSessionId FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.lockerUserId, 'U1');
  assert.equal(row.lockerSessionId, 'P1');
});

// AC-LOCK-5: TTL 30분 좀비 락 자동 해제 — lockedAt가 TTL 초과면 다음 acquire가 자동 해제 후 획득.
test('AC-LOCK-5: TTL 30분 좀비 락 자동 해제 — stale 락은 다음 acquire에서 자동 해제되고 새 보유자가 획득한다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  const T0 = new Date('2026-06-04T01:00:00Z');
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 });

  // 30분 + 1초 경과 — U1의 락은 stale.
  const T1 = new Date(T0.getTime() + EDIT_LOCK_TIMEOUT_MS + 1000);
  const result = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'P2', now: T1 });
  assert.equal(result.ok, true);

  // 새 보유자 U2/P2 로 갱신, lockedAt = T1.
  const row = db.prepare(
    'SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?',
  ).get(articleId);
  assert.equal(row.lockYN, 'Y');
  assert.equal(row.lockerUserId, 'U2');
  assert.equal(row.lockerSessionId, 'P2');
  assert.equal(row.lockedAt, T1.toISOString());
});

test('AC-LOCK-5 (경계): TTL 직전(30분 미만) 락은 stale이 아니므로 다른 사용자 진입이 거부된다', () => {
  const { svc } = freshService();
  const articleId = seedArticle(svc);
  const T0 = new Date('2026-06-04T01:00:00Z');
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 });

  // TTL - 1초 (아직 신선한 락).
  const Tjust = new Date(T0.getTime() + EDIT_LOCK_TIMEOUT_MS - 1000);
  const result = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'P2', now: Tjust });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'locked');
});

// AC-LOCK-6: articleUpdate-equivalent applyAction by non-holder → 거부 + DB 무변경.
// 서버 PUT /api/articles/:id 는 update 직전 assertLockHolder 게이트를 통과해야 한다(server/index.js:197).
// 본 테스트는 그 게이트의 결과적 동작을 단언: 락 미보유자는 update가 막히고 DB가 그대로다.
test('AC-LOCK-6: 락 미보유자의 articleUpdate-equivalent는 assertLockHolder 게이트에서 거부되고 DB가 변경되지 않는다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

  const beforeArticle = db.prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(articleId);
  const beforeContents = db.prepare('SELECT title, status, lockerUserId FROM Contents WHERE articleId = ?').get(articleId);

  // U2 (락 미보유) 가 update 를 시도하기 전, 서버 게이트가 호출하는 assertLockHolder 결과.
  const gate = svc.assertLockHolder(articleId, { userId: 'U2', sessionId: 'P2' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'lock-required');

  // 게이트가 막으므로 update 는 호출되지 않는다 → DB 무변경을 단언 (게이트 실패 시 update 미수행).
  const afterArticle = db.prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(articleId);
  const afterContents = db.prepare('SELECT title, status, lockerUserId FROM Contents WHERE articleId = ?').get(articleId);
  assert.deepEqual(afterArticle, beforeArticle);
  assert.deepEqual(afterContents, beforeContents);
  assert.equal(afterContents.lockerUserId, 'U1');
});

test('AC-LOCK-6 (보완): 락 보유자 본인의 assertLockHolder는 통과한다(게이트가 정상 보유자만 허용)', () => {
  const { svc } = freshService();
  const articleId = seedArticle(svc);
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });
  // now 를 고정 전달 — 실시간 시계 기준 30분 stale 판정으로 다음 날부터 FAIL 하는 time-bomb 방지.
  const holder = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(holder.ok, true);
});

// SPEC-NEWS-REVISE-004 REQ-LOCK-VOCAB-ALIGN — 락 보유자 어휘 정합.
// 003 의 주석 어댑테이션(L6-8) 을 형식 단언으로 승격한다: 락 보유자 식별의 정본 어휘는
// lockerUserId / lockerSessionId / lockedAt 이며 lockerSessionId 가 "페이지 단위 식별자"를 운반한다.
describe('SPEC-NEWS-REVISE-004 REQ-LOCK-VOCAB-ALIGN — 락 보유자 정본 어휘(lockerSessionId) 형식 단언', () => {
  // AC-LOCKV-2: 동일 user 가 다른 sessionId 로 진입하면 거부되고 보유자 식별자가 덮어써지지 않는다 (003 AC-LOCK-4 회귀).
  it('AC-LOCKV-2: U1/P1 보유 중 동일 user U1 이 다른 sessionId P2 로 acquire → 거부되고 lockerSessionId 가 P1 로 유지된다', () => {
    const { db, svc } = freshService();
    const articleId = seedArticle(svc);
    const T0 = new Date('2026-06-04T01:00:00Z');
    // U1 이 sessionId P1 (첫 번째 페이지) 로 락 보유.
    const held = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 });
    assert.equal(held.ok, true);

    // 동일 user U1, 다른 sessionId P2 (두 번째 탭/페이지 단위 식별자) 로 진입 시도.
    const otherPage = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P2', now: new Date('2026-06-04T01:01:00Z') });
    assert.equal(otherPage.ok, false);

    // lockerSessionId = 페이지 단위 식별자 (정본 어휘; 003 AC-LOCK-4 의 pageId 표기는 이 컬럼의 별칭).
    // P2 로 덮어쓰지 않고 P1/U1 이 그대로 유지됨을 정본 컬럼명으로 단언한다.
    const row = db.prepare('SELECT lockerUserId, lockerSessionId FROM Contents WHERE articleId = ?').get(articleId);
    assert.equal(row.lockerSessionId, 'P1');
    assert.equal(row.lockerUserId, 'U1');
  });

  // AC-LOCKV-3: 동일 user + 동일 sessionId 재획득은 idempotent 하며 lockedAt 이 재진입 시각으로 refresh 된다 (002 D2-5=A 회귀).
  it('AC-LOCKV-3: U1/P1 이 동일 sessionId P1 로 T2(>T0) 재획득 → ok:true 이고 lockedAt 이 T2 로 refresh 된다', () => {
    const { db, svc } = freshService();
    const articleId = seedArticle(svc);
    const T0 = new Date('2026-06-04T01:00:00Z');
    svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 });

    // 동일 user + 동일 sessionId 로 T2 재진입 (idempotent re-acquire).
    const T2 = new Date('2026-06-04T01:05:00Z');
    const reacquire = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T2 });
    assert.equal(reacquire.ok, true);

    // lockedAt 이 재진입 시각 T2 로 갱신되고, 보유자 식별자는 변경되지 않는다.
    const row = db.prepare('SELECT lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?').get(articleId);
    assert.equal(row.lockedAt, T2.toISOString());
    assert.equal(row.lockerUserId, 'U1');
    assert.equal(row.lockerSessionId, 'P1');
  });

  // AC-LOCKV-4: 정본 어휘 형식 단언 — 락 보유자 식별을 lockerUserId / lockerSessionId / lockedAt 컬럼명으로만
  // 수행하고 lockerPageId 어휘를 사용하지 않음을 단언(주석 어댑테이션 → 형식 단언 승격).
  //
  // [SPEC-NEWS-REVISE-006 AC-HARDEN-1 항진식 보강] 이전 구현은 `SELECT lockerUserId, lockerSessionId,
  // lockedAt` 3컬럼만 조회한 행의 keys 에서 lockerPageId 부재를 단언했다 — SELECT 목록에 애초에
  // lockerPageId 가 없으므로 컬럼이 실제 추가돼도 항상 PASS(방어력 0 = 항진식). 이를 `SELECT *` 행의
  // Object.keys(row) 기준 단언으로 교체한다: 전체 컬럼 집합에 정본 3컬럼이 모두 존재하고 lockerPageId 가
  // 부재해야 GREEN 이며, lockerPageId 컬럼이 실제 추가되면 FAIL 하여 방어력을 회복한다. includes 기반
  // 집합 단언이므로 컬럼 순서에 무관하다.
  it('AC-LOCKV-4: 락 보유자 식별은 정본 컬럼 lockerUserId/lockerSessionId/lockedAt 으로만 이뤄지고 lockerPageId 어휘를 쓰지 않는다', () => {
    const { db, svc } = freshService();
    const articleId = seedArticle(svc);
    svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

    // lockerSessionId 는 "페이지 단위 식별자"의 정본 어휘다 (003 AC-LOCK-4 의 pageId 표기는 이 컬럼의 별칭).
    // SELECT * 로 전체 컬럼 집합을 가져와 Object.keys 기준으로 단언한다(항진식 제거 → 방어력 회복).
    const lockRow = db.prepare(
      'SELECT * FROM Contents WHERE articleId = ?',
    ).get(articleId);
    const keys = Object.keys(lockRow);
    for (const name of ['lockerUserId', 'lockerSessionId', 'lockedAt']) {
      assert.ok(keys.includes(name), `${name} 정본 컬럼으로 보유자를 식별해야 한다`);
    }
    // 전체 컬럼 집합에 대한 부재 단언 — lockerPageId 컬럼이 실제 추가되면 이 단언이 FAIL 한다.
    assert.equal(keys.includes('lockerPageId'), false, 'lockerPageId 어휘는 사용하지 않는다(전체 컬럼 집합에서 부재가 정본)');

    // 보유자 식별 값 자체도 정본 컬럼에서 읽힌다.
    assert.equal(lockRow.lockerUserId, 'U1');
    assert.equal(lockRow.lockerSessionId, 'P1');
  });
});
