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

# SPEC-NEWS-REVISE-005 — 인수 기준 (Acceptance Criteria)

검증 명령(전 AC 공통, 실제 레이아웃 한정):
- `npm test` — 백엔드 회귀 (`test/*.test.js`)
- `npm run test:web` — 프론트엔드 (`web/src/**/*.test.{js,jsx}`)
- `npm run build` — Vite 프로덕션 빌드 (`vite build web`)

(`--prefix web` 금지, `src/services/__tests__/` 류 허구 경로 금지.)

---

## 가드 신규 AC (REQ-SEND-END-MARKER-GUARD)

### AC-SEND-GUARD-1 — 본문 `(끝)` 미존재 송고는 차단 + ALERT
- **Given** 로그인 상태에서 제목이 채워지고 본문이 `(끝)` 마커로 끝나지 **않는** 기사 작성 상태
- **When** 송고(`action === 'send'`) 버튼을 누른다
- **Then** `window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.')` 가 정확히 1회 표시되고, 송고 경로(저장/액션)에 진입하지 않는다

### AC-SEND-GUARD-2 — ALERT 후 saveArticle/applyAction 미호출
- **Given** AC-SEND-GUARD-1 의 상태(본문 `(끝)` 미존재)
- **When** 송고를 시도한다
- **Then** `model.saveArticle` 와 `model.applyAction` 이 **모두 호출되지 않는다**(call count 0), 페이지 상태/리셋 변화 없음

### AC-SEND-GUARD-3 — 본문 `(끝)` 존재 송고는 통과
- **Given** 제목이 채워지고 본문이 `(끝)` 마커로 끝나는 기사 작성 상태
- **When** 송고 버튼을 누른다
- **Then** `(끝)` ALERT 가 표시되지 않고 기존 송고 경로(Insert/Update 분기 → `saveArticle` → `applyAction`)가 정상 진행된다

### AC-SEND-GUARD-4 — 보류/KILL 은 `(끝)` 없이도 비차단
- **Given** 본문이 `(끝)` 마커로 끝나지 않는 기사 작성 상태
- **When** 보류(`hold`) 또는 KILL(`kill`) 버튼을 누른다
- **Then** `(끝)` 가드가 적용되지 않아 ALERT 없이 해당 액션 경로가 진행된다(보류는 제목 가드만, KILL 은 제목 가드도 면제)

### AC-SEND-GUARD-5 — 제목 가드가 `(끝)` 가드보다 우선
- **Given** 제목이 비어 있고 본문도 `(끝)` 마커가 없는 상태
- **When** 송고 버튼을 누른다
- **Then** 제목 가드(`제목이 없어 송고/보류할 수 없습니다.`)만 발동하고 `(끝)` ALERT 는 발생하지 않는다(가드 순서: 제목 → `(끝)`)

### AC-SEND-GUARD-6 — 정본/Alt+Y 무변경 회귀
- **Given** 본 SPEC 변경 적용 후
- **When** `npm run test:web` 를 실행한다
- **Then** SPEC-NEWS-REVISE-002 의 Alt+Y `(끝)` 관련 AC(AC-ENDMARK-1/2/3, AC-ALTY-1/2, AC-CTRL-D-5 등)와 `editorContent` 테스트가 모두 GREEN 으로 유지된다(정본·Alt+Y 동작 무변경)

---

## 회귀 복원 AC (REQ-SEND-TESTS-ALIGN)

### AC-ALIGN-1 — useWriteController.test.jsx 14건 복원
- **Given** 가드 도입으로 FAIL 한 `web/src/controller/useWriteController.test.jsx` 의 send 시나리오 14건(AC-API-1 매트릭스, AC-WLC-1/2/5, USER-REQ 송고 DTO, DP-F5 등)
- **When** 각 send 시나리오 본문 입력에 `(끝)` 마커를 포함시키는 보강을 적용한다
- **Then** 14건이 GREEN 으로 복원되고, 기존 라우팅/DTO 단언은 변경되지 않는다

### AC-ALIGN-2 — useWriteController.editLoad.test.jsx 3건 복원
- **Given** 가드 도입으로 FAIL 한 `web/src/controller/useWriteController.editLoad.test.jsx` 의 edit-load 후 송고 시나리오 3건
- **When** 본문 입력에 `(끝)` 마커를 포함시키는 보강을 적용한다
- **Then** 3건이 GREEN 으로 복원되고, edit-load/Update 분기 단언은 변경되지 않는다

### AC-ALIGN-3 — WritePage.test.jsx 9건 복원
- **Given** 가드 도입으로 FAIL 한 `web/src/view/WritePage.test.jsx` 의 9건(AC-5.1, EC-5, AC-TITLE-3, AC-Z regression, AC-RESET-1 등)
- **When** 각 송고 시나리오 본문 입력에 `(끝)` 마커를 포함시키는 보강을 적용한다
- **Then** 9건이 GREEN 으로 복원되고, 생애주기 전이/리셋/권한 단언은 변경되지 않는다

### AC-ALIGN-4 — 검증 의도 보존 (단언 동결)
- **Given** 26건 보강 작업 전체
- **When** 변경 diff 를 검토한다
- **Then** 변경은 **본문 입력(텍스트 또는 Alt+Y 주입)에 한정**되며, 어떤 테스트의 `expect(...)` 단언·기대값(라우팅, DTO, 생애주기)도 약화되거나 삭제되지 않는다

---

## 전체 스위트 GREEN 매트릭스 AC

### AC-SUITE-1 — 프론트엔드 GREEN
- **Given** 가드 신규 AC + 26건 보강 적용 후
- **When** `npm run test:web` 를 실행한다
- **Then** 전체 프론트엔드 스위트가 GREEN(0 failed)

### AC-SUITE-2 — 백엔드 GREEN
- **Given** 본 SPEC 변경 적용 후
- **When** `npm test` 를 실행한다
- **Then** 백엔드 스위트가 GREEN(0 failed) — 본 SPEC 은 백엔드 회귀에 영향 없음을 확인

### AC-SUITE-3 — 빌드 성공
- **Given** 본 SPEC 변경 적용 후
- **When** `npm run build` 를 실행한다
- **Then** Vite 프로덕션 빌드가 오류 없이 완료된다

---

## 엣지 케이스 (Edge Cases)

- **EC-1**: 본문이 `(끝)` 뒤에 공백/개행만 있는 경우(`본문(끝)  `, `본문\n (끝)`) — `hasEndMarker` 는 `trimEnd()` 후 판정하므로 통과해야 한다(레거시 `\n (끝)` 형태 포함).
- **EC-2**: 본문 중간에만 `(끝)` 이 있고 끝이 아닌 경우(`(끝) 본문`) — 가드는 차단해야 한다(끝 마커가 아님).
- **EC-3**: 본문이 빈 문자열/`undefined` 인 송고 — 가드는 차단(ALERT)해야 한다.
- **EC-4**: 제목 비고 본문 `(끝)` 있는 송고 — 제목 가드가 우선 발동(AC-SEND-GUARD-5 와 일관).

---

## Definition of Done

- [ ] REQ-SEND-END-MARKER-GUARD 가드 신규 AC(AC-SEND-GUARD-1~6) 통과
- [ ] REQ-SEND-TESTS-ALIGN 회귀 복원 AC(AC-ALIGN-1~4) 통과 — 26건 GREEN, 단언 동결
- [ ] `npm run test:web` GREEN (AC-SUITE-1)
- [ ] `npm test` GREEN (AC-SUITE-2)
- [ ] `npm run build` 성공 (AC-SUITE-3)
- [ ] `web/src/model/editorContent.js` 정본 무변경, Alt+Y 동작 무변경(Exclusions 준수)
- [ ] production 변경은 `useWriteController.js` 가드 8줄로 한정 (추가 로직 없음)
- [ ] SPEC-NEWS-REVISE-001~004 문서 무변경
