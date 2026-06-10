---
id: SPEC-NEWS-REVISE-011
version: 0.2.0
status: Completed
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-007
  - SPEC-NEWS-REVISE-008
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-011 — 구현 계획 (Plan)

## 1. 개요

`news.md` "# 기사 작성 페이지 내 버튼" 델타 2건을 흡수한다.

- **델타 A (Δ-only 재기술)**: 요약줄 `송고/보류/KILL ... RDS, DDH` 변경 → DDH 의 요약줄 포함은 SPEC-008 로 이미 구현. 신규 구현 없음, 회귀 가드만.
- **델타 B (신규 동작)**: DPS 기사 고침/포털고침 시 송고/보류 버튼 노출 + DPS-출발 송고(→DPS)·보류(→DDH) 전이.

작업 모드: Brownfield 확장(Δ-only). 프론트엔드 버튼 게이트 1곳 + lifecycle 전이표 추가(DPS send 3 + DPS hold 3). 진입 게이트(D-only)·모드 플래그 무도입·DDH/RDS 매트릭스는 불변.

DPS 보류 결과상태는 **2026-06-10 사용자 승인으로 DDH 확정**(`DPS|R/D/Z|hold`→DDH). 직전 블로커 해제됨.

## 2. 기술 접근 (Technical Approach)

### 2.1 프론트엔드 — DPS 버튼 게이트 (`web/src/view/WritePage.jsx`)

- 현재: L814 `isRds`, L816 `isDdh` 파생값. 버튼 블록은 RDS(L870-881) + DDH(L882-889) 분기만.
- 추가: `const isDps = ctrl.status === 'DPS';` 파생값(상태값 기준 — 모드 플래그 무도입, REQ-DPS-BUTTONS Unwanted 충족).
- DPS 분기: `isDps && (R|D|Z)` 일 때 송고/보류 버튼 노출. 기존 RDS 블록과 동일 클래스(`yh-btn--primary`/`yh-btn--hold`)·동일 확인창(`window.confirm`)·`disabled={!!ctrl.lockError}` 재사용. KILL 버튼은 추가하지 않는다(REQ-DPS-BUTTONS Unwanted).
- 송고 가드: 기존 송고 경로(`ctrl.send`)가 본문 끝 "(끝)" 가드·제목 가드를 이미 포함하므로 그대로 재사용 → DPS 송고에도 동일 적용(REQ-DPS-BUTTONS Ubiquitous).
- RDS/DDH 분기는 손대지 않는다(REQ-SUMMARY-LINE-RECONCILE 회귀 가드).

### 2.2 백엔드 — DPS-출발 송고·보류 전이 (`src/services/lifecycle.js`)

- 현재 TRANSITIONS: RDS 6 + Z-mirror 3. (SPEC-008 의 DDH 4 전이 반영 여부는 Run 시작 시 재확인 — 본 SPEC 은 DDH 행 불변 가드만 둔다.)
- 추가(송고): `'DPS|R|send': 'DPS'`, `'DPS|D|send': 'DPS'`, `'DPS|Z|send': 'DPS'` (재송고·재배부, 상태값 유지).
- 추가(보류, 2026-06-10 사용자 승인): `'DPS|R|hold': 'DDH'`, `'DPS|D|hold': 'DDH'`, `'DPS|Z|hold': 'DDH'` (데스크 보류로 전이; 이후 DDH 규칙 적용).
- 미추가: `DPS|*|kill`(거부 유지 — REQ-DPS-LIFECYCLE Unwanted).
- `Object.freeze` 패턴·`transition()` 시그니처 불변.

### 2.3 진입 게이트 (`web/src/view/ViewPage.jsx`) — 변경 없음

- `canDpsEdit = status === 'DPS' && role === 'D'`(L52) D-only 유지. 본 SPEC 은 진입 게이트를 변경하지 않는다(REQ-DPS-ENTRY-GATE). 회귀 가드 테스트만 추가/유지.

### 2.4 결정 이력 (Resolved Decision)

- DPS 보류 결과상태(spec.md §11)는 **2026-06-10 사용자 승인(AskUserQuestion 경유)으로 DDH 로 확정**(옵션 1). 보류 클릭의 lifecycle 와이어링(2.2 의 `DPS|*|hold`→DDH)을 정식 구현한다. 추가 블로커 없음.

## 3. 마일스톤 (우선순위 기반, 시간 추정 없음)

| 우선순위 | 마일스톤 | 산출물 | 대응 REQ |
|---------|----------|--------|---------|
| High | M1 — DPS 송고·보류 전이표 추가 (send→DPS, hold→DDH) | `src/services/lifecycle.js` + `test/lifecycleRule.test.js` GREEN | REQ-DPS-LIFECYCLE (send + hold) |
| High | M2 — DPS 버튼 게이트(송고/보류 노출, KILL 비표시) | `web/src/view/WritePage.jsx` + `WritePage.test.jsx` GREEN | REQ-DPS-BUTTONS |
| High | M3 — 진입 게이트 D-only 회귀 가드 | `ViewPage.contextMenu.test.jsx`/`ViewPage.test.jsx` GREEN | REQ-DPS-ENTRY-GATE |
| Medium | M4 — 요약줄 Δ-only 재기술 회귀 가드(RDS/DDH 매트릭스 불변) | `WritePage.test.jsx` GREEN | REQ-SUMMARY-LINE-RECONCILE |
| Medium | M5 — 007/008/002 회귀 가드 + DPS→DDH 전이 후 DDH 매트릭스 정합 | 기존 테스트 전부 GREEN | REQ-REGRESSION-GUARD |

순서: M1 → M2 → M3 → M4 → M5. (직전 Blocked M6 은 M1 에 흡수됨 — 보류 전이 확정.)

## 4. 개발 방법론

- TDD(RED-GREEN-REFACTOR) — Brownfield 보강. 각 마일스톤마다 실패 테스트 선작성 후 최소 구현.
- 백엔드 전이는 `test/lifecycleRule.test.js` 의 MATRIX 패턴(now 고정 전달)으로 검증.
- 프론트엔드 버튼 게이트는 `WritePage.test.jsx` 의 role×status 매트릭스 패턴으로 검증.

## 5. 위험 및 완화 (Risks)

| 위험 | 영향 | 완화 |
|------|------|------|
| DPS→DDH 보류 전이로 출처가 혼재된 DDH(원래 RDS 보류 vs DPS 보류) | DDH 목록/버튼 매트릭스에서 두 출처가 동일 취급 | 도메인상 DDH 단일 상태로 통합(2026-06-10 결정 옵션 1). 이후 DDH 규칙(SPEC-008) 일괄 적용 — 출처 구분 불요. M5 에서 DPS→DDH 후 DDH 매트릭스 정합 검증 |
| 요약줄을 곧이곧대로 읽어 DDH R 노출 / RDS D-KILL 회귀 | SPEC-008·구체줄 위반 | REQ-SUMMARY-LINE-RECONCILE Unwanted + M4 회귀 테스트로 차단 |
| 진입모드 구분을 위해 모드 플래그 도입 유혹 | SPEC-007 AC-REV-2 회귀 | 상태값(DPS) 기준 게이트 강제(REQ-DPS-BUTTONS Unwanted). 모드 플래그 금지 |
| 진입 게이트를 R 로 확대(델타 B "권한 R" 곧이곧대로) | news.md L86·도메인 스킬·SPEC-007 위반 | REQ-DPS-ENTRY-GATE Unwanted + M3 회귀 테스트. R 가시성은 공허(unreachable) 처리 |
| lock 테스트 시한폭탄(now 미고정 시 30분 stale) | 다음 날부터 회귀 FAIL | now 고정 전달 규약 준수(DoD 체크) |
| SPEC-008 DDH 4 전이가 현 lifecycle.js 에 미반영일 가능성 | DPS 전이 추가 시 DDH 행 충돌/누락 | Run 시작 시 lifecycle.js 현 상태 재확인. 본 SPEC 은 추가만, 기존 행 불변 가드 |

## 6. 테스트 전략 (실제 레이아웃 기준)

- 백엔드: `npm test` (node test runner, `test/*.test.js`, node:sqlite). DPS 전이/거부 검증.
- 프론트엔드: `npm run test:web` (vitest, `web/src/**/*.test.jsx`). DPS 버튼 게이트/진입 게이트/회귀.
- 빌드: `npm run build` (vite build web) 무경고.
- 상세 Given/When/Then 은 acceptance.md.

## 7. 영향 파일

- `web/src/view/WritePage.jsx` (DPS 버튼 게이트)
- `src/services/lifecycle.js` (DPS 송고→DPS + 보류→DDH 전이)
- `test/lifecycleRule.test.js`, `web/src/view/WritePage.test.jsx`(필요 시 `WritePage.dps.test.jsx`)
- `web/src/view/ViewPage.test.jsx`/`ViewPage.contextMenu.test.jsx`(진입 게이트 회귀 가드, 변경 없음 확인)

## 8. 비목표 (요약 — spec.md §10 참조)

요약줄 곧이곧대로 적용, 진입 게이트 R/Z 확대, 모드 플래그 도입, DPS KILL(전이/버튼), news.md/타 SPEC 수정, 코드 구현(Plan 단계).

---

Version: 0.2.0
Status: Completed
Last Updated: 2026-06-10
