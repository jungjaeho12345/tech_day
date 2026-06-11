// Integration regression guard for SPEC-NEWS-REVISE-003 — AC-INT-1 (토픽 C+D+F 교차).
// 락 + Insert/Update + lifecycle 전체 흐름을 신선한 in-memory DB에서 단언한다:
//   1) U1 신규 작성 송고 (articleInsert ≈ create → RDS, R/RDS/send → RDS)
//   2) U2 편집 진입 (acquireEditLock → lockYN='Y', lockOwner='U2')
//   3) U2 KILL via update path (락 보유 검증 통과 후 articleUpdate ≈ applyAction R/RDS/kill → RRK)
//   4) U2 종료 (releaseEditLock → lockYN='N')
// Δ-only: production 코드는 변경하지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';

test('AC-INT-1: U1 송고(RDS) → U2 락 획득 → U2 KILL(RRK) → U2 락 해제 전체 흐름이 각 단계 단언을 통과한다', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const svc = createArticleService(db);

  // --- 1) U1 신규 작성 송고: articleInsert 등가(create) → RDS 적재 후 R/RDS/send 전이.
  const { articleId, status: insertedStatus } = svc.create(
    { title: '통합 시나리오 기사', content: '본문', author: 'U1' },
    { now: new Date('2026-06-04T00:00:00Z') },
  );
  assert.equal(insertedStatus, 'RDS', '신규 작성은 RDS로 적재된다');

  const sendResult = svc.applyAction(articleId, 'R', 'send');
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.status, 'RDS', 'R/RDS/send → RDS (기자 송고는 RDS 유지)');
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RDS');

  // 신규 작성 기사는 락이 비어 있어야 한다.
  assert.equal(db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId).lockYN, 'N');

  // --- 2) U2 편집 진입: 락 획득.
  const lock = svc.acquireEditLock(articleId, { userId: 'U2', sessionId: 'P-U2', now: new Date('2026-06-04T01:00:00Z') });
  assert.equal(lock.ok, true);
  const lockedRow = db.prepare('SELECT lockYN, lockerUserId, lockerSessionId FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(lockedRow.lockYN, 'Y');
  assert.equal(lockedRow.lockerUserId, 'U2');
  assert.equal(lockedRow.lockerSessionId, 'P-U2');

  // --- 3) U2 KILL via update path: 서버 PUT 게이트(assertLockHolder)가 보유자 U2를 통과시킨 뒤 전이.
  // now 를 고정 전달 — 실시간 시계 기준 30분 stale 판정으로 다음 날부터 FAIL 하는 time-bomb 방지.
  const holderGate = svc.assertLockHolder(articleId, { userId: 'U2', sessionId: 'P-U2', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(holderGate.ok, true, '락 보유자 U2는 update 게이트를 통과한다');

  // 비보유자(U1 다른 페이지)는 같은 게이트에서 막혀야 한다 (락 우회 불가, AC-LOCK-6 교차).
  const intruderGate = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'P-U1', now: new Date('2026-06-04T01:05:00Z') });
  assert.equal(intruderGate.ok, false);
  assert.equal(intruderGate.reason, 'lock-required');

  // AC-EDIT-LOCK-6 (applyAction 자체의 락 자동 검증): 비보유자 U1의 applyAction은 lock-required로
  // 거부되고 status는 변경되지 않는다. now 고정 전달 — stale 판정 time-bomb 방지.
  const intruderAction = svc.applyAction(articleId, 'R', 'kill', {
    userId: 'U1', sessionId: 'P-U1', now: new Date('2026-06-04T01:05:00Z'),
  });
  assert.equal(intruderAction.ok, false);
  assert.equal(intruderAction.reason, 'lock-required');
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RDS');

  // 게이트 통과 후 KILL 전이 (articleUpdate 등가) — 보유자 U2의 락 컨텍스트 + 고정 now 전달
  // (applyAction의 락 게이트가 보유자를 식별해야 통과한다; 컨텍스트 누락 시 lock-required).
  const killResult = svc.applyAction(articleId, 'R', 'kill', {
    userId: 'U2', sessionId: 'P-U2', now: new Date('2026-06-04T01:05:00Z'),
  });
  assert.equal(killResult.ok, true);
  assert.equal(killResult.status, 'RRK', 'R/RDS/kill → RRK');
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RRK');

  // KILL은 soft delete — 행이 물리 삭제되지 않는다 (CLAUDE.md HARD: DB 내용은 삭제하지 않는다).
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents WHERE articleId = ?').get(articleId).n, 1);

  // --- 4) U2 종료: 락 해제.
  const release = svc.releaseEditLock(articleId, { userId: 'U2', sessionId: 'P-U2' });
  assert.equal(release.ok, true);
  const finalRow = db.prepare('SELECT status, lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(finalRow.lockYN, 'N');
  assert.equal(finalRow.lockerUserId, null);
  assert.equal(finalRow.lockerSessionId, null);
  assert.equal(finalRow.lockedAt, null);
  // 락 해제는 status에 영향 없음 — RRK 유지.
  assert.equal(finalRow.status, 'RRK');
});

// SPEC-NEWS-REVISE-012 — 강제 해제 후 기존 잠금 의미론 정합(서비스 통합). 새 동작을 발명하지 않고
// 기존 acquire/assertLockHolder/applyAction 경로가 강제 해제 이후에도 의도대로 동작함을 확인한다.
// [HARD] 시간 비교(30분 stale) 경로를 타므로 now 고정 전달 — 실시간 시계 금지(30분 stale time-bomb 방지).
test('AC-CON-1/2 (SPEC-NEWS-REVISE-012): force-unlock → 타 세션 재획득 가능 + 원 편집자 lock-required(status 불변)', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const svc = createArticleService(db);
  const now = new Date('2026-06-10T01:00:00Z');

  const { articleId } = svc.create({ title: '강제 해제 정합', content: '본문', author: 'u-a' }, { now });
  // 원 편집자 sess-A 가 비stale 잠금 보유.
  assert.equal(svc.acquireEditLock(articleId, { userId: 'u-a', sessionId: 'sess-A', now }).ok, true);
  const statusBefore = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status;

  // D/Z 강제 해제 (서비스 레벨 — 보유자 무관).
  assert.equal(svc.forceReleaseEditLock(articleId).ok, true);
  assert.equal(db.prepare('SELECT lockYN FROM Contents WHERE articleId = ?').get(articleId).lockYN, 'N');

  // AC-CON-1: 타 세션 sess-B 가 자유 잠금으로 재획득 가능 (now 고정).
  const reAcquire = svc.acquireEditLock(articleId, { userId: 'u-b', sessionId: 'sess-B', now });
  assert.equal(reAcquire.ok, true, '강제 해제된 기사는 자유 잠금 — 재획득 성공');

  // AC-CON-2: 원 편집자 sess-A 의 PUT 게이트(assertLockHolder)는 이제 보유자가 아니므로 lock-required.
  // (재획득자 sess-B 가 보유 중이므로 sess-A 는 보유자 불일치 → lock-required.)
  const holder = svc.assertLockHolder(articleId, { userId: 'u-a', sessionId: 'sess-A', now });
  assert.equal(holder.ok, false);
  assert.equal(holder.reason, 'lock-required');

  // AC-CON-2: 원 편집자 sess-A 의 applyAction(send)도 lock-required 로 거부, status 불변.
  const action = svc.applyAction(articleId, 'R', 'send', { userId: 'u-a', sessionId: 'sess-A', now });
  assert.equal(action.ok, false);
  assert.equal(action.reason, 'lock-required');
  assert.equal(
    db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status,
    statusBefore,
    'lock-required 거부 시 기사 status 불변(새 동작 발명 없음)',
  );
});
