---
id: SPEC-NEWS-REVISE-008
version: 0.1.0
status: Plan
created: 2026-06-06
updated: 2026-06-06
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-007
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-008 — 구현 계획 (Implementation Plan)

편집 잠금이 편집 탭 생존 중 유지되도록 락 해제 시점을 4종으로 정밀화하고, DDH(보류) 기사의 생애주기 전이 4행 + 작성 페이지 버튼 게이트를 확장한다.
모두 Δ 이며, 기존 락 계약(SPEC-NEWS-REVISE-002), 전이표(RDS 6 + Z-mirror 3), RDS 버튼 매트릭스는 회귀 없이 유지한다.

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. 버그 ①(편집 잠금 조회 이동 시 해제) + 버그 ②(DDH 버튼 미표시·전이 부재) 진단을 흡수.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 brownfield Δ 기준점 (직접 Read 로 검증한 현재 사실)

- `web/src/controller/useWriteController.js`:
  - 편집-락 effect(약 L237~293)가 마운트 시 `model.acquireEditLock(editArticleId, { sessionId })` 로 획득하고, `beforeunload`/`visibilitychange:hidden` 에 `sendBeacon` release 를 건다(SPEC-NEWS-REVISE-002).
  - **버그 ①의 근원**: cleanup(약 L282~292)이 **무조건** `model.releaseEditLock?.(editArticleId, { sessionId })` 를 호출한다. list.do 로 이동해 작성 페이지가 unmount 되면(WriteWorkspace L9 주석: list.do 이동 시 전체 unmount) 이 cleanup 이 락을 풀어버린다.
  - 송고/보류/KILL 성공 시 `submitAction`(약 L370~431)이 `resetDraft()` 를 호출 → `isDraft=true` + `lifecycleStatus` 확정 → WritePage 의 `onEditContextEnded` 가 발화한다.
- `web/src/view/WriteWorkspace.jsx`:
  - 탭 메타데이터 `newsroom.editorTabs` 를 sessionStorage 에 영속한다(L19, L122~124). 탭은 같은 세션/탭의 페이지 전환·F5 에 생존하고 브라우저 탭 닫힘에 소멸한다(lockYN 규칙 정합 — L6~7 주석).
  - `closeTab`(L168~182): 탭을 제거하면 그 패널이 unmount 되어 컨트롤러 cleanup 으로 락이 풀린다(L166 주석).
  - `endEditContext`(L188~193): 송고/보류/KILL 성공 시 그 탭의 `editArticleId` 를 null 로 바꾼다 → 컨트롤러의 락 effect 가 cleanup 되어 락이 풀린다(L184~187 주석).
  - **함정**: 현재 두 경로(탭 닫기/성공) 모두 unmount cleanup 의 무조건 release 에 의존한다. cleanup 을 "탭 생존 여부"로 조건화하면 이 두 경로의 해제가 누락될 수 있다.
- `src/services/articleService.js`:
  - `acquireEditLock`(L105~133)은 same-user+same-session 보유 시 `lockedAt` 갱신 + `{ok:true}` 멱등 재획득을 **이미 구현**한다(L128~131). same-user 다른 session 은 'locked' 거부(D2-5 strict, L102).
  - 따라서 버그 ①의 same-session 재획득 멱등은 서버에 이미 충족되어 있다. 본 SPEC 은 이를 **회귀 가드**로 고정한다(코드 추가 불필요, 테스트로 동작 보장).
- `src/services/lifecycle.js`:
  - TRANSITIONS(L9~21) = RDS 소스 6 전이 + Z-mirror 3 전이. DDH 는 source 로 미정의 → `transition('DDH', *, *)` 는 `{ ok:false }`(invalid-transition).
- `web/src/view/WritePage.jsx`:
  - `isRds = ctrl.status === 'RDS'`(L780). 송고/보류 게이트 `(R|D|Z) && isRds`(L834), KILL 게이트 `(R|Z) && isRds && !ctrl.isDraft`(L842). DDH 는 어떤 버튼도 안 보임 = 버그 ②.
- `web/src/view/useViewController.js`(약 L52): 데스크 미송고 필터가 status `RDS,DDH` 둘 다 조회 → DDH 가 작성 페이지로 진입하는 근거.

### 1.2 Δ 요약

- (a) **락 유지/해제 정밀화 (REQ-LOCK-RETENTION / REQ-LOCK-RELEASE-EXPLICIT)**: unmount cleanup 의 무조건 release 를 "편집 탭이 더 이상 살아있지 않을 때만 release" 로 조건화하거나, 탭 닫기·송고/보류/KILL 성공 경로에 명시적 release 를 추가한다. 둘 중 단순한 쪽을 Run 단계에서 선택하되, 두 경로의 해제 누락이 없도록 한다.
- (b) **로그아웃 해제**: 클라이언트가 로그아웃 시 열린 편집 탭들의 락을 명시 해제하거나, 서버 logout 핸들러가 그 sessionId 로 잡힌 락을 일괄 해제한다. 단순한 쪽을 채택.
- (c) **DDH 전이 4행 추가 (REQ-DDH-LIFECYCLE)**: `src/services/lifecycle.js` TRANSITIONS 에 4행 추가.
- (d) **DDH 버튼 게이트 확장 (REQ-DDH-BUTTONS)**: `WritePage.jsx` 의 게이트 조건에 DDH 분기 추가.

### 1.3 설계 원칙

- 락 수명 = 편집 탭 수명. "탭 목록(`newsroom.editorTabs`)에 그 기사 탭이 있으면 락 유지, 없으면 해제" 가 단일 기준이다. 조회 페이지 이동/탭 전환은 탭을 없애지 않으므로 락을 유지한다.
- same-session 재획득 멱등은 서버가 이미 보장 — 클라이언트는 재마운트 시 동일 `pageSessionId` 로 다시 acquire 만 하면 된다(서버가 lockedAt 만 갱신).
- DDH 전이는 RDS 패턴과 대칭: D/Z 만 send/kill, R 은 거부, hold 는 재보류라 미정의.
- DDH 버튼은 RDS 버튼 마크업/클래스/가드(끝 마커·제목·confirm)를 그대로 재사용한다. 새 스타일/새 가드 금지.
- 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 사용.

---

## 2. 마일스톤 (Milestones — Priority 기반, 시간 추정 없음)

### M1 (Priority: High) — DDH 생애주기 전이 4행 추가

목표: news.md 생애주기 — DDH(보류) 기사가 D/Z 권한으로 송고/킬 될 수 있도록 전이표 확장.

- `src/services/lifecycle.js` TRANSITIONS 에 추가:
  - `'DDH|D|send': 'DPS'`, `'DDH|Z|send': 'DPS'`
  - `'DDH|D|kill': 'DDK'`, `'DDH|Z|kill': 'DDK'`
- `'DDH|R|*'` 미정의 유지(invalid-transition), `'DDH|*|hold'` 미정의 유지(이미 보류).
- 기존 RDS 6 전이 + Z-mirror 3 전이 라인은 한 글자도 바꾸지 않는다.

AC 매핑: AC-DDH-1, AC-DDH-2, AC-DDH-3, AC-DDH-4.

### M2 (Priority: High) — DDH 버튼 게이트 확장

목표: news.md L70 — DDH 편집 시 D/Z 에 송고·KILL 노출(보류 비표시), R 은 전버튼 비표시.

- `WritePage.jsx`: 현재 `isRds` 단독 게이트를 확장한다(예: `isDdh = ctrl.status === 'DDH'` 도입).
  - 송고 버튼: `(role===R|D|Z && isRds)` 또는 `(role===D|Z && isDdh)`. (DDH+R 은 미노출)
  - 보류 버튼: `(role===R|D|Z && isRds)` 만(DDH 면 보류 미노출).
  - KILL 버튼: `(role===R|Z && isRds && !isDraft)` 또는 `(role===D|Z && isDdh && !isDraft)`.
  - DDH 는 항상 기존 기사이므로 `!isDraft` 가 자동 충족된다(편집 로드 후 articleId 존재).
- 송고 핸들러(끝 마커 가드/제목 가드/confirm)는 기존 `ctrl.send()` 경로를 그대로 사용 — DDH 도 동일하게 적용된다.
- RDS 매트릭스(송고/보류 R|D|Z, KILL R|Z + !isDraft)는 변경하지 않는다.

AC 매핑: AC-BTN-1, AC-BTN-2, AC-BTN-3, AC-BTN-4.

### M3 (Priority: High) — 편집 잠금 탭 생존 유지 + 해제 4시점

목표: news.md L63 — 편집 탭 생존 중 lockYN='Y' 유지, 조회 이동만으로 미해제. 해제 4시점 보장.

- `useWriteController.js` 편집-락 effect 의 unmount cleanup(약 L287~291)을 정밀화한다(Run 단계에서 단순한 쪽 택일):
  - 방식 A — cleanup 조건부: cleanup 시점에 `newsroom.editorTabs` 에 해당 기사 탭이 남아있으면 release 를 건너뛰고, 더 이상 없으면 release. (탭 닫기/성공으로 탭이 사라진 뒤의 unmount 만 해제)
  - 방식 B — cleanup 무해제 + 명시 release: cleanup 에서 release 를 제거하고, `WriteWorkspace.closeTab`/`endEditContext` 에서 명시적으로 `releaseEditLock(articleId, { sessionId })` 호출.
- 송고/보류/KILL 성공 경로는 어느 방식이든 release 가 누락되지 않도록 보장한다(REQ-LOCK-RELEASE-EXPLICIT). 방식 A 는 성공 시 탭이 블랭크 전환되며 editArticleId 가 사라지므로 cleanup release 가 발화; 방식 B 는 endEditContext 의 명시 release 로 발화.
- same-session 재진입 멱등은 서버가 이미 보장하므로(articleService L128~131) 추가 코드 없이 재마운트 시 동일 `pageSessionId` 로 acquire 가 멱등 성공함을 테스트로 고정.
- 로그아웃 해제: 클라이언트 로그아웃 시 열린 편집 탭들의 락 명시 해제 또는 서버 logout 핸들러의 sessionId 일괄 해제 중 단순한 쪽 채택.
- 브라우저 탭 닫힘은 기존 `sendBeacon` release(L256~280) 그대로 유지.

AC 매핑: AC-LOCK-1, AC-LOCK-2, AC-LOCK-3, AC-LOCK-4, AC-REL-1, AC-REL-2, AC-REL-3.

### M4 (Priority: Medium) — 회귀 가드

목표: 락 계약/전이표/SSE/필터/007 회귀 없음.

- SPEC-NEWS-REVISE-002 락 계약(acquire/release/sendBeacon/30분 stale/same-session 멱등/타 세션 'locked' + banner) 회귀 가드.
- 전이표 RDS 6 + Z-mirror 3 불변 회귀 가드(`test/lifecycleRule.test.js`).
- SSE `type:'lock'` 재조회 + 데스크 미송고 필터(RDS,DDH + LockYN 컬럼) 회귀.
- SPEC-NEWS-REVISE-007 읽기전용 8필드/부서별 송고 진입점 회귀.

AC 매핑: AC-REG-1, AC-REG-2, AC-REG-3.

---

## 3. 파일 단위 변경 계획 (File-Level Change Plan)

| 파일 | 마일스톤 | 변경 요지 |
|------|----------|-----------|
| `src/services/lifecycle.js` | M1 | TRANSITIONS 에 DDH 출발 4행 추가(`DDH|D|send`→DPS, `DDH|Z|send`→DPS, `DDH|D|kill`→DDK, `DDH|Z|kill`→DDK). 기존 9 전이 불변 |
| `web/src/view/WritePage.jsx` | M2 | 버튼 게이트에 DDH 분기 추가(송고/KILL on D|Z, 보류 비표시, R 전버튼 비표시). RDS 매트릭스/송고 가드 불변 |
| `web/src/controller/useWriteController.js` | M3 | 편집-락 unmount cleanup 정밀화(탭 생존 시 미해제) 또는 cleanup 무해제 + 명시 release 경로 |
| `web/src/view/WriteWorkspace.jsx` | M3 | 방식 B 채택 시 `closeTab`/`endEditContext` 에 명시적 `releaseEditLock` 호출 추가 |
| 로그아웃 경로(클라이언트 또는 서버 logout 핸들러) | M3 | 로그아웃/세션 만료 시 sessionId 기준 편집 락 해제(단순한 쪽) |
| `test/lifecycleRule.test.js` | M1, M4 | DDH 4 전이 정상/거부, DDH|R|*·DDH|*|hold 거부, 기존 9 전이 불변 |
| `test/articleService.test.js` | M3, M4 | same-session 재획득 멱등(now 고정), DDH applyAction 결과 status |
| `web/src/view/WritePage.test.jsx` | M2 | DDH+D/Z 버튼 노출(보류 비표시), DDH+R 전버튼 비표시, RDS 매트릭스 회귀 |
| `web/src/controller/useWriteController.editLoad.test.jsx` 또는 신규 `web/src/controller/useWriteController.lockRetention.test.jsx` | M3 | 락 유지/해제 4시점(탭 생존 미해제/4시점 해제/재획득 멱등) |
| `web/src/view/WriteWorkspace.test.jsx` | M3 | 탭 닫기 시 락 해제 |

> 비고: M3 의 cleanup 정밀화 방식(A vs B)·로그아웃 해제 위치(클라이언트 vs 서버)는 Run 단계에서 실제 코드 형태를 Read 로 확인해 단순한 쪽으로 확정한다. 본 plan 은 WHAT/우선순위만 고정하고 내부 구현 형태를 강제하지 않는다.

---

## 4. 위험 & 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: cleanup 을 탭 생존으로 조건화하면 송고/보류/KILL 성공·탭 닫기 경로의 release 가 누락 | 락 영구 잔존(타인 편집 불가) | 성공/탭닫기 경로에 명시 release 보장(REQ-LOCK-RELEASE-EXPLICIT, AC-REL-1/2). 테스트로 4시점 모두 단언 |
| R2: cleanup 무해제로 바꾸면 비정상 종료(크래시) 시 락 잔존 | 30분간 락 점유 | 서버 30분 stale 타임아웃이 안전망(SPEC-NEWS-REVISE-002, 불변). 정상 경로 4시점은 명시 해제 |
| R3: 같은 세션 재진입 시 자기 락이 'locked' 로 거부 | 본인이 재편집 불가 | articleService L128~131 이 same-session 멱등 재획득을 이미 보장. now 고정 테스트로 회귀 차단 |
| R4: DDH 전이 추가가 RDS/Z-mirror 기존 전이를 흔듦 | 광범위 lifecycle 회귀 | 추가만(4행), 기존 9행 미변경. `test/lifecycleRule.test.js` 의 9행 매트릭스 GREEN 유지 |
| R5: DDH 버튼 분기가 RDS 버튼 매트릭스를 흔듦 | 작성 페이지 버튼 회귀 | RDS 게이트는 그대로 두고 DDH 분기를 OR 로만 추가. RDS 매트릭스 회귀 테스트(AC-BTN-4) |
| R6: lock 테스트에 now 미고정 | 다음 날부터 30분 stale 판정 FAIL(시한폭탄) | 모든 lock 관련 테스트에 `now`(+필요 시 `timeoutMs`) 고정 전달(이 리포 알려진 함정) |
| R7: 신규 디자인 토큰/버튼 스타일 유혹 | 디자인 일관성 위반 | 기존 `yh-btn--primary`/`yh-btn--kill` 클래스 재사용, CSS 변수 추가 금지 |
| R8: news.md 를 임의 수정 | source-of-truth 오염 + 게이트 충돌 | 본 SPEC/Run 은 news.md 미수정. 생애주기 DDH 3줄은 구현 완료 후 오케스트레이터가 별도 반영 |

---

## 5. 테스트 전략 (Test Strategy)

- 실행: 백엔드 `npm test`(루트, `test/*.test.js`, node:test), 프론트 `npm run test:web`(vitest run --root web), 빌드 `npm run build`.
  - 허구 경로 금지: `npm test --prefix web`, `src/services/__tests__/` 는 이 리포에 존재하지 않는다(알려진 SPEC 오류 패턴).
- 백엔드 단위(`test/`):
  - `lifecycleRule.test.js`: DDH|D|send→DPS, DDH|Z|send→DPS, DDH|D|kill→DDK, DDH|Z|kill→DDK 정상; DDH|R|send/hold/kill·DDH|D|hold·DDH|Z|hold 거부(invalid-transition) + DB 무변경; 기존 RDS 6 + Z-mirror 3 매트릭스 GREEN 유지.
  - `articleService.test.js`: same-user+same-session 재획득이 `{ok:true}` 로 멱등(lockedAt 갱신), same-user 다른 session 'locked' 거부 — **now 고정 전달**; DDH 적재 후 `applyAction(id, 'D', 'send')` → status DPS.
- 프론트 단위/통합(`web/src/`):
  - `WritePage.test.jsx`: status='DDH' + role D/Z → 송고·KILL 버튼 존재, 보류 버튼 부재; status='DDH' + role R → 세 버튼 부재; status='RDS' 매트릭스 회귀(송고/보류 R|D|Z, KILL R|Z + !isDraft).
  - `useWriteController.editLoad.test.jsx` 또는 신규 `useWriteController.lockRetention.test.jsx`: 편집 탭 생존(탭 목록에 존재) 중 cleanup 발화 시 release 미호출; 탭 목록에서 사라진 뒤 release 호출; 재마운트 시 같은 sessionId acquire 멱등 성공(now 고정).
  - `WriteWorkspace.test.jsx`: 탭 × 닫기 시 그 기사 release 호출.
- 회귀 가드: SPEC-NEWS-REVISE-001/002/003/007 / BACKEND-CORE-001 / FRONTEND-UI-001 / AUTH-001 AC 전체 GREEN 유지, `npm run build` 무경고.

---

## 6. 개발 방법론

- TDD (Brownfield Enhancement): 전이/버튼/락 정밀화 전에 실패하는 테스트를 먼저 작성한다(RED → GREEN → REFACTOR). 기존 코드(락 effect cleanup, 전이표, 버튼 게이트)를 Read 로 이해한 뒤 진행한다.
- 작업 모드: Brownfield 확장(Δ-only). news.md / 다른 SPEC 3파일 / 본 SPEC 범위 밖 영역 미변경. DB 내용 삭제 없음.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
