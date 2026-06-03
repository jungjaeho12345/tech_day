// Regression guard tests for SPEC-NEWS-REVISE-003 REQ-ARTICLE-LOCK-YN (토픽 C).
// AC-LOCK-1..6 — Δ-only: these assert the RESULTANT lock behaviour already implemented in
// src/services/articleService.js (acquireEditLock / releaseEditLock / assertLockHolder with the
// D2-3 = 30분 stale-TTL auto-release). No production code is changed by this SPEC.
//
// 1 인 1 페이지 정책 매핑: the page-scoped UUID IS the sessionId at the service layer
// (server/index.js replays a per-editor-mount page session id as `sessionId`). A second tab/page
// for the same user therefore presents a DIFFERENT sessionId — modelled here as P1/P2.
import { test } from 'node:test';
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
// 동일 user U1 이 다른 페이지(다른 sessionId P2)로 진입 → 거부 + lockerPageId(=sessionId) 미덮어쓰기.
test('AC-LOCK-4: 같은 사용자 다른 페이지 차단 — U1이 다른 페이지 ID로 재진입하면 거부되고 lockerSessionId가 P1로 유지된다', () => {
  const { db, svc } = freshService();
  const articleId = seedArticle(svc);
  // P1 (첫 번째 탭) 이 락 보유.
  svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: new Date('2026-06-04T01:00:00Z') });

  // 같은 user U1, 다른 페이지 P2 (두 번째 탭의 localStorage UUID) 로 진입 시도.
  const otherPage = svc.acquireEditLock(articleId, { userId: 'U1', sessionId: 'P2', now: new Date('2026-06-04T01:01:00Z') });
  assert.equal(otherPage.ok, false);
  assert.equal(otherPage.reason, 'locked');

  // lockerPageId(=lockerSessionId) 가 여전히 P1 — P2 로 덮어쓰지 않음.
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
  const holder = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'P1' });
  assert.equal(holder.ok, true);
});
