---
id: SPEC-NEWS-REVISE-005
version: 0.1.0
status: Plan
created: 2026-06-05
updated: 2026-06-05
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-004
---

# SPEC-NEWS-REVISE-005 — 구현 계획 (Implementation Plan)

## 목표 (Goal)

`news.md` L66 의 송고 `(끝)` 마커 가드를 명세화하고, (1) 가드 신규 테스트를 신설하며, (2) 가드 도입으로 FAIL 된 기존 send 경로 테스트 26건을 본문 `(끝)` 포함으로 보강해 전체 스위트 GREEN 을 복원한다. production 변경은 작업 트리에 이미 존재하는 가드 8줄(`useWriteController.js`)로 한정되는 Brownfield Δ-only 작업이다.

## 기술 접근 (Technical Approach)

- **가드 위치 불변**: 가드는 `useWriteController.js` 의 submit 경로에서 제목 가드(`if (action === 'send' || action === 'hold')` 블록) 직후, `try { ... }` 의 `model.saveArticle`/`model.applyAction` 진입 전에 위치한다. 이 순서로 `saveArticle`/`applyAction` 이 모두 차단된다.
- **정본 소비만**: `hasEndMarker` 는 `web/src/model/editorContent.js` 에서 import(`import { hasEndMarker } from '../model/editorContent.js';`). 정본은 변경하지 않고 소비만 한다.
- **테스트 보강 원칙(Δ-only)**: FAIL 26건은 송고 직전 본문 입력에 `(끝)` 를 포함하도록 입력 setup 만 수정한다. 라우팅/DTO/생애주기 단언은 그대로 유지한다. 일부 시나리오는 Alt+Y(`appendEnd`) 호출로 `(끝)` 를 주입하거나, 본문 텍스트 fixture 끝에 `(끝)` 를 직접 덧붙이는 방식 중 시나리오에 자연스러운 쪽을 택한다.
- **가드 신규 테스트**: REQ-SEND-END-MARKER-GUARD 의 4개 핵심 동작(미존재→차단+ALERT, 존재→통과, hold/KILL 비차단, ALERT 후 `saveArticle`/`applyAction` 미호출)을 컨트롤러 레벨에서 신규 추가한다. `window.alert` 는 vitest `vi.spyOn(window, 'alert')` 으로 스텁/관찰한다.
- **회귀 가드 기준선**: HEAD 의 전체 GREEN(105/105) 을 회귀 기준선으로 삼고, 본 SPEC 완료 시 전체 스위트가 다시 GREEN 이 되도록 한다.

## 마일스톤 (Milestones — Priority 기반, time estimate 없음)

### Priority High — M1: 가드 신규 테스트 신설 (REQ-SEND-END-MARKER-GUARD)
- 컨트롤러 레벨 신규 테스트 추가: 본문 `(끝)` 미존재 send → ALERT 표시 + `saveArticle`/`applyAction` 미호출.
- 본문 `(끝)` 존재 send → 가드 통과(기존 송고 경로 진입).
- hold/KILL → `(끝)` 미존재여도 비차단(가드 미적용) 검증.
- 제목 빈 송고 → 제목 가드 우선(제목 ALERT 만, `(끝)` ALERT 미발생) 검증.

### Priority High — M2: 기존 send 경로 테스트 정합 (REQ-SEND-TESTS-ALIGN)
- `web/src/controller/useWriteController.test.jsx`(14건): AC-API-1 매트릭스, AC-WLC-1/2/5, USER-REQ 송고 DTO, DP-F5 등 send 시나리오 본문에 `(끝)` 포함.
- `web/src/controller/useWriteController.editLoad.test.jsx`(3건): edit-load 후 송고 시나리오 본문에 `(끝)` 포함.
- `web/src/view/WritePage.test.jsx`(9건): AC-5.1, EC-5, AC-TITLE-3, AC-Z regression, AC-RESET-1 등 송고 시나리오 본문에 `(끝)` 포함.
- 각 보강은 단언 무변경, 본문 입력만 추가.

### Priority Medium — M3: 전체 스위트 GREEN 검증
- `npm run test:web` GREEN (프론트 — 가드 신규 + 보강 26건 포함).
- `npm test` GREEN (백엔드 회귀 무영향 확인).
- `npm run build` 성공 (Vite 빌드 무파손 확인).

## 의존성 (Dependencies)

- `web/src/model/editorContent.js`(`END_MARKER`, `hasEndMarker`) — 정본, 무변경 소비. SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER.
- `web/src/controller/useWriteController.js` — 가드(이미 작성), submit 경로.
- 테스트 러너: vitest(프론트, `--root web`), node --test(백엔드).

## 리스크 (Risks)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 보강 시 단언 약화로 검증 의도 손실 | 회귀 가드 무력화 | 본문 입력만 추가, 단언/기대값 동결(REQ-SEND-TESTS-ALIGN Unwanted) |
| `(끝)` 주입 방식 불일치(직접 텍스트 vs Alt+Y) | 일부 시나리오 흐름 깨짐 | 시나리오별 자연스러운 주입 경로 선택, Alt+Y 경로는 기존 `appendEnd` 계약 사용 |
| 제목 가드와 `(끝)` 가드 순서 혼동 | 잘못된 ALERT 단언 | 가드 순서(제목→`(끝)`)를 신규 AC 로 고정 |
| 정본/Alt+Y 무심코 변경 | SPEC-NEWS-REVISE-002 회귀 | editorContent.js·Alt+Y 경로 변경 금지(Exclusions) |

## 검증 명령 (Verification Commands)

- `npm test` — 백엔드 회귀(`test/*.test.js`).
- `npm run test:web` — 프론트엔드 전체(가드 신규 + 보강 26건 포함).
- `npm run build` — Vite 프로덕션 빌드.

(`--prefix web`, `src/services/__tests__/` 류 경로 사용 금지 — 실제 레이아웃 아님.)
