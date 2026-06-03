// Regression guard tests for SPEC-NEWS-REVISE-003 REQ-API-LIFECYCLE-RULE (토픽 F).
// AC-LIFE-1..3 — articleInsert / articleUpdate / articleSelect 가 src/services/lifecycle.js 의
// TRANSITIONS 테이블(RDS 소스 6 전이 + SPEC-NEWS-REVISE-001 D-6 Z-mirror 3 전이)을 우회하지 않음을
// 결과적 동작(Contents.status) 으로 단언한다. Δ-only: 전이표/서비스 코드는 변경하지 않는다.
//
// articleInsert ≈ svc.create (초기 RDS 적재), articleUpdate ≈ svc.applyAction (전이 적용),
// articleSelect ≈ svc.query / model.findById (읽기 전용).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';
import { transition } from '../src/services/lifecycle.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createArticleService(db) };
}

// SPEC-NEWS-REVISE-001 D-6: Z권한은 D권한 동작을 거울 반영(D-mirror) — Z/RDS/* === D/RDS/*.
// (lifecycle.js TRANSITIONS: 'RDS|Z|send'->DPS, 'RDS|Z|hold'->DDH, 'RDS|Z|kill'->DDK)
const MATRIX = [
  { role: 'R', action: 'send', expected: 'RDS' },
  { role: 'R', action: 'hold', expected: 'RRH' },
  { role: 'R', action: 'kill', expected: 'RRK' },
  { role: 'D', action: 'send', expected: 'DPS' },
  { role: 'D', action: 'hold', expected: 'DDH' },
  { role: 'D', action: 'kill', expected: 'DDK' },
  { role: 'Z', action: 'send', expected: 'DPS' }, // Z-mirror of D
  { role: 'Z', action: 'hold', expected: 'DDH' }, // Z-mirror of D
  { role: 'Z', action: 'kill', expected: 'DDK' }, // Z-mirror of D
];

// AC-LIFE-1: 정상 전이 — R/D/Z × send/hold/kill 매트릭스(RDS 진입)의 결과 status가 전이표와 정합.
test('AC-LIFE-1: R/D/Z × send/hold/kill 매트릭스 — articleInsert(RDS) → articleUpdate(action)의 결과 status가 전이표와 정합한다', () => {
  for (const { role, action, expected } of MATRIX) {
    const { db, svc } = freshService();
    // articleInsert 등가: RDS 상태로 적재.
    const { articleId, status } = svc.create({ title: `${role}-${action}`, content: '본문' },
      { now: new Date('2026-06-04T00:00:00Z') });
    assert.equal(status, 'RDS', `${role}/${action}: 초기 상태는 RDS`);

    // articleUpdate 등가: 전이 적용.
    const result = svc.applyAction(articleId, role, action);
    assert.equal(result.ok, true, `${role}/RDS/${action} 는 허용 전이`);
    assert.equal(result.status, expected, `${role}/RDS/${action} → ${expected}`);

    // DB에 영속된 결과 status 단언.
    const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId);
    assert.equal(row.status, expected, `${role}/RDS/${action}: Contents.status === ${expected}`);

    // pure reducer 도 동일 결과를 내는지 cross-check (전이표 단일 출처 정합).
    assert.deepEqual(transition('RDS', role, action), { ok: true, status: expected });
  }
});

// AC-LIFE-2: 비허용 전이 거부 + DB 무변경 — R 권한이 DPS 기사에 KILL 시도(소스 RDS 가 아님).
test('AC-LIFE-2: 비허용 전이 거부 — DPS 기사에 R 권한 KILL은 거부되고 Contents.status가 DPS로 유지된다', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'dps 대상', content: '본문' },
    { now: new Date('2026-06-04T00:00:00Z') });
  // 데스크 송고로 DPS 진입 (정상 전이).
  svc.applyAction(articleId, 'D', 'send');
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'DPS');

  // DPS 는 전이표의 소스에 정의되지 않음 → 어떤 (role, action) 도 비허용.
  const result = svc.applyAction(articleId, 'R', 'kill');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-transition');

  // DB 의 status 변경 없음.
  const row = db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId);
  assert.equal(row.status, 'DPS');

  // pure reducer 단언 — 비허용 전이는 status 없이 거부.
  const pure = transition('DPS', 'R', 'kill');
  assert.equal(pure.ok, false);
  assert.equal(pure.status, undefined);
});

test('AC-LIFE-2 (보완): RRH 등 비-RDS 소스에서의 전이도 거부되고 DB가 그대로 유지된다', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: 'rrh 대상' }, { now: new Date('2026-06-04T00:00:00Z') });
  svc.applyAction(articleId, 'R', 'hold'); // RDS -> RRH
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RRH');

  const result = svc.applyAction(articleId, 'R', 'send'); // RRH 소스 미정의
  assert.equal(result.ok, false);
  assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status, 'RRH');
});

// AC-LIFE-3: articleSelect 무전이 — 조회(query/findById)는 어떤 상태 변경도, 전이 호출도 일으키지 않는다.
test('AC-LIFE-3: articleSelect(query/findById) 는 status·lockYN을 변경하지 않고 lifecycle 전이를 호출하지 않는다', () => {
  const { db, svc } = freshService();
  const { articleId } = svc.create({ title: '조회 대상', content: '본문' },
    { now: new Date('2026-06-04T00:00:00Z') });

  const before = db.prepare('SELECT status, lockYN, lockerUserId, lockedAt FROM Contents WHERE articleId = ?').get(articleId);

  // articleSelect 등가 호출들 — 어떤 것도 전이를 트리거해서는 안 된다.
  const byQuery = svc.query({ articleId });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].articleId, articleId);
  svc.query({}); // 전체 조회
  svc.searchArticles('조회'); // 내부 텍스트 검색

  const after = db.prepare('SELECT status, lockYN, lockerUserId, lockedAt FROM Contents WHERE articleId = ?').get(articleId);
  assert.deepEqual(after, before, '조회 후 status/lockYN/locker 정보 완전 무변경');
  assert.equal(after.status, 'RDS');
});
