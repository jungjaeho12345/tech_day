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
  const holderGate = svc.assertLockHolder(articleId, { userId: 'U2', sessionId: 'P-U2' });
  assert.equal(holderGate.ok, true, '락 보유자 U2는 update 게이트를 통과한다');

  // 비보유자(U1 다른 페이지)는 같은 게이트에서 막혀야 한다 (락 우회 불가, AC-LOCK-6 교차).
  const intruderGate = svc.assertLockHolder(articleId, { userId: 'U1', sessionId: 'P-U1' });
  assert.equal(intruderGate.ok, false);
  assert.equal(intruderGate.reason, 'lock-required');

  // 게이트 통과 후 KILL 전이 (articleUpdate 등가).
  const killResult = svc.applyAction(articleId, 'R', 'kill');
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
