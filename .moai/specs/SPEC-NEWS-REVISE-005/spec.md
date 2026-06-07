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

# SPEC-NEWS-REVISE-005 — 송고 "(끝)" 마커 가드 (송고 차단 + ALERT) 및 기존 send 경로 테스트 정합

## HISTORY

- 2026-06-05 (v0.1.0): 최초 작성. `news.md`「# 기사 작성 페이지 내 버튼」절에 신규 추가된 규칙(L66 — "송고는 본문에 \"(끝)\" 표시가 있어야 한다. 없으면 ALERT를 띄우고 송고를 차단한다. 보류/KILL은 \"(끝)\" 없이도 진행된다.")을 단일 SPEC, 2개 REQ로 정리.
  (1) 송고(send) 액션 시 본문이 `(끝)` 마커로 끝나지 않으면 ALERT 후 저장/액션 미진입 가드(REQ-SEND-END-MARKER-GUARD) — 구현은 `web/src/controller/useWriteController.js` submit 경로에 미커밋 상태로 이미 존재(제목 가드 직후·transport 진입 전, `hasEndMarker(adapter.getBodyText())` 사용),
  (2) 가드 도입으로 FAIL 된 기존 send 경로 테스트 26건을 본문에 `(끝)` 마커를 포함시키는 방식으로 보강해 전체 스위트 GREEN 복원(REQ-SEND-TESTS-ALIGN) — production 동작 변경 없이 테스트 입력만 정합.
  본 SPEC 은 SPEC-NEWS-REVISE-002~004 후속 차수이며, `(끝)` 마커 정본(`web/src/model/editorContent.js` 의 `END_MARKER` / `hasEndMarker` — SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER) 과 Alt+Y 동작을 침범하지 않는 Δ-only 명세이다. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-005 |
| 제목 | 송고 "(끝)" 마커 가드 (송고 차단 + ALERT) 및 기존 send 경로 테스트 정합 |
| 상태 | Plan |
| 생성일 | 2026-06-05 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-002, SPEC-NEWS-REVISE-003, SPEC-NEWS-REVISE-004 |
| 우선순위 | High |
| 변경 유형 | Brownfield Δ-only (기사 작성기 한정) |

---

## 개요 (Overview)

`news.md`「# 기사 작성 페이지 내 버튼」절(L66)에 송고 가드 규칙이 추가되었다:

> 송고는 본문에 "(끝)" 표시가 있어야 한다. 없으면 ALERT를 띄우고 송고를 차단한다. 보류/KILL은 "(끝)" 없이도 진행된다.

이 규칙의 production 구현은 작업 트리에 **이미 존재**한다(미커밋). `web/src/controller/useWriteController.js` 의 submit 경로에서 제목 가드 직후·transport 진입 전에 다음 가드가 위치한다:

```js
if (action === 'send' && !hasEndMarker(adapter.getBodyText())) {
  window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.');
  return;
}
```

`hasEndMarker` 는 `web/src/model/editorContent.js` 에서 import 한다(정본 — `END_MARKER = '(끝)'`, `hasEndMarker(text)` 는 `trimEnd()` 후 `(끝)` 으로 끝나는지 판정; HEAD 에 이미 존재, SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER).

이 가드 도입으로 본문에 `(끝)` 없이 send 를 수행하던 기존 테스트 **26건이 FAIL** 한다(HEAD 에서는 전체 GREEN). 본 SPEC 은 (1) 가드 동작을 명세하고 가드 신규 AC 를 신설하며, (2) FAIL 된 26건을 본문 `(끝)` 포함으로 보강해 GREEN 을 복원하는 것을 범위로 한다.

---

## 환경 및 가정 (Environment & Assumptions)

- 대상은 **제작(작성) 시스템**의 기사 작성 페이지(`WritePage`) 송고 경로뿐이다. 수집/배부 시스템은 범위 밖.
- `(끝)` 마커 정본은 `web/src/model/editorContent.js` 이며 본 SPEC 에서 **변경 금지**한다.
- 가드 구현(8줄)은 `web/src/controller/useWriteController.js` 에 **이미 작성**되어 있으므로 production 변경은 이 가드로 한정된다(추가 production 변경 없음).
- 가드 위치: 제목 가드(`if (action === 'send' || action === 'hold')` 블록) 직후, `try { ... model.saveArticle / model.applyAction ... }` 진입 전.
- 테스트 레이아웃(실제): 백엔드 `test/*.test.js`, 프론트엔드 `web/src/**/*.test.{js,jsx}`. 빌드는 Vite(`vite build web`).
- 검증 명령은 `npm test`(백엔드), `npm run test:web`(프론트), `npm run build`(빌드)만 사용한다. `--prefix web`, `src/services/__tests__/` 류 경로는 **사용 금지**(실제 레이아웃에 존재하지 않음).

---

## 요구사항 (Requirements — EARS)

### REQ-SEND-END-MARKER-GUARD — 송고 "(끝)" 마커 가드

- **[Event-Driven]** WHEN 송고(`action === 'send'`) 액션이 요청되고 본문(`adapter.getBodyText()`)이 `(끝)` 마커로 끝나지 않으면(`!hasEndMarker(...)`), the system **shall** `window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.')` 를 표시한 뒤 즉시 반환하여 `model.saveArticle` / `model.applyAction` 에 **진입하지 않는다**.
- **[State-Driven]** WHILE 액션이 보류(`hold`) 또는 KILL(`kill`)인 동안, the system **shall** `(끝)` 마커 유무와 무관하게 가드를 적용하지 않고 진행한다(마커 미요구).
- **[Ubiquitous]** The system **shall** 송고 시 본문이 `(끝)` 마커로 끝나면(`hasEndMarker(...) === true`) 가드를 통과시켜 기존 송고 경로(Insert/Update 분기 포함)를 정상 진행한다.
- **[State-Driven]** WHILE 제목 가드(`제목이 없어 송고/보류할 수 없습니다.`)가 먼저 발동하는 동안, the system **shall** `(끝)` 가드보다 제목 가드를 우선 적용한다(제목 빈 송고는 제목 ALERT 만 본다 — 가드 순서: 제목 → `(끝)`).
- **[Unwanted Behavior]** IF `(끝)` 정본 변경이 시도되면, **then** the system **shall** 변경을 거부한다 — `web/src/model/editorContent.js` 의 `END_MARKER`/`hasEndMarker`/`END_MARKER_BLOCK` 시그니처·값은 변경하지 않는다.
- **[Unwanted Behavior]** IF Alt+Y `(끝)` 삽입 동작(SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER) 변경이 시도되면, **then** the system **shall** 변경을 거부한다 — 본 SPEC 은 송고 가드만 추가하며 Alt+Y 삽입 경로는 무변경.

### REQ-SEND-TESTS-ALIGN — 기존 send 경로 테스트 정합

- **[Event-Driven]** WHEN 가드 도입으로 본문에 `(끝)` 없이 send 를 수행하던 기존 테스트 26건이 FAIL 하면, the system(테스트 스위트) **shall** 각 send 시나리오의 본문 입력에 `(끝)` 마커를 포함시키는 방식으로 보강되어 전체 스위트가 GREEN 으로 복원되어야 한다.
- **[Ubiquitous]** The system(테스트 스위트) **shall** 다음 3개 파일의 FAIL 을 해소한다: `web/src/controller/useWriteController.test.jsx`(14건 — AC-API-1 매트릭스, AC-WLC-1/2/5, USER-REQ 송고 DTO, DP-F5 등), `web/src/controller/useWriteController.editLoad.test.jsx`(3건), `web/src/view/WritePage.test.jsx`(9건 — AC-5.1, EC-5, AC-TITLE-3, AC-Z regression, AC-RESET-1 등).
- **[Unwanted Behavior]** IF 테스트 보강이 기존 검증 의도(라우팅 분기, 송고 DTO 단언, 기사 생애주기 전이 단언 등)를 약화시키려 하면, **then** the system **shall** 이를 금지한다 — 보강은 **본문 입력에 `(끝)` 추가**로 한정하며, 단언(assertion)·기대값은 변경하지 않는다.
- **[Ubiquitous]** The system(테스트 스위트) **shall** 가드 자체를 검증하는 신규 테스트(REQ-SEND-END-MARKER-GUARD AC)를 신설한다(가드 신규 테스트는 HEAD 에 부재).

---

## Exclusions (What NOT to Build)

- `web/src/model/editorContent.js` 의 `END_MARKER` / `hasEndMarker` / `END_MARKER_BLOCK` 정본 변경 (정본 무변경 — 단순 소비만).
- Alt+Y `(끝)` 삽입 동작(SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER) 변경.
- 보류(hold)/KILL 경로에 `(끝)` 마커 요구 추가 (규칙상 마커 미요구).
- 가드 외 신규 production 변경 — `useWriteController.js` 의 가드 8줄(이미 작성) 외 추가 로직 없음.
- 신규 CSS 토큰/스타일 추가 (가드는 표준 `window.alert`).
- DB 스키마/컬럼 변경, ContentsVO 변경.
- 수집(collect)·배부(distribute) 시스템 작업 (현재 구현 범위는 기사 작성기만).
- ALERT 문구 국제화(i18n) 또는 커스텀 모달 UI 로의 교체.

---

## 추적성 (Traceability)

| REQ ID | news.md 근거 | 구현/테스트 위치 |
|--------|-------------|------------------|
| REQ-SEND-END-MARKER-GUARD | L66 (송고 `(끝)` 가드) | `web/src/controller/useWriteController.js`(가드, 미커밋) / 신규 AC |
| REQ-SEND-TESTS-ALIGN | L66 파생(가드 도입 회귀) | `useWriteController.test.jsx`, `useWriteController.editLoad.test.jsx`, `WritePage.test.jsx` |

정본 의존: `web/src/model/editorContent.js`(`END_MARKER='(끝)'`, `hasEndMarker`) — SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER.

---

자세한 구현 순서는 [plan.md](./plan.md), 검증 기준은 [acceptance.md](./acceptance.md) 참조.
