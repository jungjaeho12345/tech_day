// SPEC-NEWS-REVISE-011 REQ-DPS-LIFECYCLE — DPS-출발 송고·보류 전이 (백엔드).
// AC-DPS-LC-1 (DPS|R/D/Z|send → DPS), AC-DPS-LC-HOLD (DPS|R/D/Z|hold → DDH, 2026-06-10 사용자 승인),
// AC-DPS-LC-2 (DPS|*|kill 거부 + DB 무변경), AC-DPS-LC-3 (기존 RDS 6 + Z-mirror 3 전이 불변).
//
// 테스트 레이아웃: test/*.test.js (node test runner, node:sqlite). 실행 `npm test`.
// 시간 의존 로직은 now 고정 전달(30분 stale 시한폭탄 방지) — svc.create 에 now 주입.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';
import { transition } from '../src/services/lifecycle.js';

const FIXED_NOW = new Date('2026-06-10T00:00:00Z');

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createArticleService(db) };
}

// DPS 상태로 적재: RDS 생성 → D 송고로 DPS 진입(정상 전이, now 고정).
function seedDps() {
  const { db, svc } = freshService();
  const { articleId, status } = svc.create({ title: 'dps 대상', content: '본문' }, { now: FIXED_NOW });
  assert.equal(status, 'RDS', '초기 상태는 RDS');
  const r = svc.applyAction(articleId, 'D', 'send'); // RDS|D|send → DPS
  assert.equal(r.ok, true);
  assert.equal(r.status, 'DPS', 'D 송고로 DPS 진입');
  return { db, svc, articleId };
}

function statusOf(db, articleId) {
  return db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(articleId).status;
}

// AC-DPS-LC-1 (SPEC-NEWS-REVISE-011): DPS|R/D/Z|send → DPS (재송고·재배부, 상태값 유지).
for (const role of ['R', 'D', 'Z']) {
  test(`AC-DPS-LC-1 (SPEC-NEWS-REVISE-011): DPS|${role}|send → DPS (재송고, applyAction + pure reducer 정합)`, () => {
    const { db, svc, articleId } = seedDps();
    const result = svc.applyAction(articleId, role, 'send');
    assert.equal(result.ok, true, `DPS|${role}|send 는 허용 전이`);
    assert.equal(result.status, 'DPS', `DPS|${role}|send → DPS`);
    assert.equal(statusOf(db, articleId), 'DPS', `Contents.status === DPS 유지`);
    // pure reducer cross-check (전이표 단일 출처 정합).
    assert.deepEqual(transition('DPS', role, 'send'), { ok: true, status: 'DPS' });
  });
}

// AC-DPS-LC-HOLD (SPEC-NEWS-REVISE-011, 2026-06-10 사용자 승인): DPS|R/D/Z|hold → DDH.
for (const role of ['R', 'D', 'Z']) {
  test(`AC-DPS-LC-HOLD (SPEC-NEWS-REVISE-011): DPS|${role}|hold → DDH (데스크 보류, applyAction + pure reducer 정합)`, () => {
    const { db, svc, articleId } = seedDps();
    const result = svc.applyAction(articleId, role, 'hold');
    assert.equal(result.ok, true, `DPS|${role}|hold 는 허용 전이`);
    assert.equal(result.status, 'DDH', `DPS|${role}|hold → DDH`);
    assert.equal(statusOf(db, articleId), 'DDH', `Contents.status === DDH 전이`);
    // pure reducer cross-check.
    assert.deepEqual(transition('DPS', role, 'hold'), { ok: true, status: 'DDH' });
  });
}

// AC-DPS-LC-2 (SPEC-NEWS-REVISE-011): DPS|*|kill 거부 + DB 무변경 (KILL 은 DPS 컨텍스트에서 미지원).
for (const role of ['R', 'D', 'Z']) {
  test(`AC-DPS-LC-2 (SPEC-NEWS-REVISE-011): DPS|${role}|kill 거부 + Contents.status DPS 유지`, () => {
    const { db, svc, articleId } = seedDps();
    const result = svc.applyAction(articleId, role, 'kill');
    assert.equal(result.ok, false, `DPS|${role}|kill 는 미정의(거부)`);
    assert.equal(statusOf(db, articleId), 'DPS', `거부 후 DB status 무변경(DPS)`);
    // pure reducer 도 status 없이 거부.
    const pure = transition('DPS', role, 'kill');
    assert.equal(pure.ok, false);
    assert.equal(pure.status, undefined);
  });
}

// AC-DPS-LC-3 (SPEC-NEWS-REVISE-011): 기존 RDS 소스 6 + Z-mirror 3 전이 불변 (본 SPEC 추가 전후 동일).
test('AC-DPS-LC-3 (SPEC-NEWS-REVISE-011): 기존 RDS 6 + Z-mirror 3 전이의 결과상태가 불변이다', () => {
  const EXISTING = [
    ['RDS', 'R', 'send', 'RDS'],
    ['RDS', 'R', 'hold', 'RRH'],
    ['RDS', 'R', 'kill', 'RRK'],
    ['RDS', 'D', 'send', 'DPS'],
    ['RDS', 'D', 'hold', 'DDH'],
    ['RDS', 'D', 'kill', 'DDK'],
    ['RDS', 'Z', 'send', 'DPS'],
    ['RDS', 'Z', 'hold', 'DDH'],
    ['RDS', 'Z', 'kill', 'DDK'],
  ];
  for (const [state, role, action, expected] of EXISTING) {
    assert.deepEqual(transition(state, role, action), { ok: true, status: expected },
      `${state}|${role}|${action} → ${expected} 불변`);
  }
});

// SPEC-NEWS-REVISE-008 REQ-DDH-LIFECYCLE (SPEC-011 L146 정합): DPS|hold→DDH 후 그 기사는 기존 DDH
// 규칙을 그대로 따른다 — D/Z 재송고(→DPS)·KILL(→DDK) 성공, R 전액션 및 *|hold 는 미정의(거부).
// 출처(RDS 보류 vs DPS 보류)와 무관하게 DDH 단일 상태로 통합 (2026-06-10 결정 옵션 1).
test('AC-DPS-LC-HOLD (보완, SPEC-008/011 정합): DPS|hold→DDH 후 DDH 는 D/Z 재송고·KILL 가능, R·hold 는 거부', () => {
  // D/Z 재송고: DDH → DPS (각 케이스 독립 적재).
  for (const role of ['D', 'Z']) {
    const { db, svc, articleId } = seedDps();
    svc.applyAction(articleId, 'D', 'hold'); // DPS → DDH
    assert.equal(statusOf(db, articleId), 'DDH');
    const r = svc.applyAction(articleId, role, 'send');
    assert.equal(r.ok, true, `DDH|${role}|send 허용`);
    assert.equal(r.status, 'DPS', `DDH|${role}|send → DPS`);
    assert.equal(statusOf(db, articleId), 'DPS');
    assert.deepEqual(transition('DDH', role, 'send'), { ok: true, status: 'DPS' });
  }
  // D/Z KILL: DDH → DDK.
  for (const role of ['D', 'Z']) {
    const { db, svc, articleId } = seedDps();
    svc.applyAction(articleId, 'D', 'hold'); // DPS → DDH
    const r = svc.applyAction(articleId, role, 'kill');
    assert.equal(r.ok, true, `DDH|${role}|kill 허용`);
    assert.equal(r.status, 'DDK', `DDH|${role}|kill → DDK`);
    assert.equal(statusOf(db, articleId), 'DDK');
    assert.deepEqual(transition('DDH', role, 'kill'), { ok: true, status: 'DDK' });
  }
  // R 전액션 + 모든 권한의 hold 는 미정의(거부), DB 무변경.
  for (const [role, action] of [['R', 'send'], ['R', 'hold'], ['R', 'kill'], ['D', 'hold'], ['Z', 'hold']]) {
    const { db, svc, articleId } = seedDps();
    svc.applyAction(articleId, 'D', 'hold'); // DPS → DDH
    const r = svc.applyAction(articleId, role, action);
    assert.equal(r.ok, false, `DDH|${role}|${action} 는 미정의(거부)`);
    assert.equal(statusOf(db, articleId), 'DDH', 'DDH 유지');
    assert.equal(transition('DDH', role, action).ok, false);
  }
});
