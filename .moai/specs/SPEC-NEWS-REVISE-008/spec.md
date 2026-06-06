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

# SPEC-NEWS-REVISE-008 — 편집 잠금 탭 생존 유지 + DDH 보류 해제 전이

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. 사용자 버그 리포트 2건(데스크 미송고 편집 시 LockYN=Y 미표시 / 일부 DDH 기사에서 송고·보류·KILL 버튼 미표시) 진단 결과를 EARS 명세로 흡수. 도메인 결정 2026-06-06 사용자 승인.

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-008 |
| 제목 | 편집 잠금 탭 생존 유지 + DDH 보류 해제 전이 |
| 상태 | Plan |
| 생성일 | 2026-06-06 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001/002/003/007, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001, SPEC-AUTH-001 |
| 영향 페이지 | `writer.do` (기사 작성/편집), `list.do` (기사 조회 — 데스크 미송고·부서별 송고) |
| 작업 모드 | Brownfield 확장 (Δ-only, 프론트엔드 + lifecycle 전이표) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

사용자 버그 리포트 2건을 코드/테스트에 정합되도록 정식 명세화한다.

### 버그 ① — 데스크 미송고 편집 진입 시 LockYN 이 Y 로 표시되지 않음

진단: 서버 락 SQL(`src/services/articleService.js` `acquireEditLock`), SSE `type:'lock'` 재조회, DB 컬럼(LockYN)은 모두 정상이다. 그러나 `web/src/controller/useWriteController.js` 의 편집-락 effect cleanup(약 L282~292)이 **작성 페이지가 조회 페이지(list.do)로 이동하며 unmount 되는 순간 무조건 `releaseEditLock` 을 호출**한다. 그 결과 편집자가 잠시 조회 페이지로 이동했다 돌아오는 사이 본인이 건 락이 풀려 LockYN 이 Y 로 유지되지 않는다. 이는 초안 보존(news.md L59 — 작성 내용은 페이지 이동에도 유지) 의미론과 모순되며, 락이 비어 있는 동안 타 세션이 동시 편집할 수 있는 동시편집 구멍을 만든다.

### 버그 ② — 일부 기사(DDH 상태)에서 송고/보류/KILL 버튼이 보이지 않음

진단: `web/src/view/WritePage.jsx` 의 버튼 게이트가 `isRds = ctrl.status === 'RDS'`(약 L780)이므로, 데스크 미송고 필터(`web/src/view/useViewController.js` 약 L52 — status `RDS,DDH` 둘 다 조회)로 함께 표시되는 DDH(보류) 기사를 편집할 때 어떤 액션 버튼도 렌더되지 않는다. 또한 `src/services/lifecycle.js` TRANSITIONS 에 DDH 를 source 로 하는 전이가 정의되지 않아(invalid-transition), DDH(보류) 기사는 영구히 송고/킬 할 수 없는 막다른 상태가 된다.

`why`: 두 버그 모두 source-of-truth(news.md) 의 의도(편집 탭 생존 중 잠금 유지 — L63, DDH 버튼 규칙 — L70)와 코드가 어긋난 결과다. 정합 명세 없이 고치면 (a) 락 해제 4시점 중 일부 누락, (b) 같은 세션 재진입 시 락 재획득 실패, (c) DDH 전이가 R 권한까지 새는 회귀가 발생한다. 본 SPEC 은 이를 EARS 형식으로 고정한다.

본 SPEC 은 기존 SPEC(NEWS-REVISE-001/002/003/007, BACKEND-CORE-001, FRONTEND-UI-001, AUTH-001) 계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- 편집 탭이 살아있는 동안(sessionStorage `newsroom.editorTabs` 에 해당 기사 탭 존재) lockYN='Y' 유지. 조회 페이지(list.do) 이동만으로는 해제하지 않는다.
- 락 해제 4시점 명문화: (a) 편집 탭 닫기(×), (b) 송고/보류/KILL 성공(탭 블랭크 전환), (c) 로그아웃/세션 만료, (d) 브라우저(탭) 닫힘(기존 `beforeunload`/`visibilitychange:hidden` + `sendBeacon` release 유지).
- 같은 세션 재진입(WRITE 라우트 재마운트) 시 같은 `pageSessionId` 의 락 재획득은 멱등 성공이어야 함(회귀 가드).
- 송고/보류/KILL 성공 경로의 명시적 release 보장(unmount cleanup 조건화 시 누락 방지).
- `src/services/lifecycle.js` TRANSITIONS 에 DDH 출발 전이 4행 추가: `DDH|D|send`→`DPS`, `DDH|Z|send`→`DPS`, `DDH|D|kill`→`DDK`, `DDH|Z|kill`→`DDK`.
- WritePage 버튼 게이트 확장: DDH 기사 편집 시 송고/KILL 을 권한 D, Z 에 노출(KILL 의 `!isDraft` 조건 유지). 보류 버튼 비표시. R 은 3버튼 전부 비표시.
- 기존 RDS 버튼 매트릭스(송고/보류 R|D|Z, KILL R|Z + `!isDraft`) 및 송고 (끝) 가드·제목 가드·확인창 회귀 없이 유지.

### 2.2 제외 (Out of Scope) — Exclusions 절(§9) 참조

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 편집 탭 생존 중 잠금 유지 (버그 ① 수정)

- 데스크 미송고 메뉴에서 RDS 기사를 편집 진입한다. 락이 acquire 되어 LockYN='Y' 가 된다.
- 같은 세션에서 잠시 조회 페이지(list.do)로 이동했다가 다시 작성 페이지로 돌아온다.
- 편집 탭(`newsroom.editorTabs`)이 여전히 살아있으므로 LockYN 은 Y 로 유지되며, 재진입 시 같은 `pageSessionId` 로 락이 멱등 재획득된다(거부 배너 미발생).
- 타 세션이 같은 기사를 열면 기존 lock-banner/ALERT 로 거부된다(SPEC-NEWS-REVISE-002 계약 불변).

### 3.2 락 해제 4시점

- (a) 사용자가 편집 탭의 × 버튼을 눌러 탭을 닫으면 그 기사의 락이 해제된다.
- (b) 송고/보류/KILL 이 성공하면 탭이 빈 '새 기사' 탭으로 전환되며 그 기사의 락이 해제된다.
- (c) 로그아웃/세션 만료 시 열려있는 편집 탭들의 락이 해제된다.
- (d) 브라우저(탭)를 닫으면 기존 `beforeunload`/`visibilitychange:hidden` + `sendBeacon` release 로 락이 해제된다.

### 3.3 DDH(보류) 기사 송고/킬 (버그 ② 수정)

- D 권한 사용자가 데스크 미송고 메뉴에서 DDH(보류) 기사를 편집 진입한다.
- 작성 페이지에 송고/KILL 버튼이 노출된다(보류 버튼은 비표시 — 이미 보류 상태).
- 송고를 누르면 lifecycle 전이 `DDH|D|send`→`DPS` 가 적용되어 DPS 로 송고된다.
- KILL 을 누르면 `DDH|D|kill`→`DDK` 가 적용된다(기존 기사이므로 `!isDraft` 자동 충족).
- R 권한 사용자가 같은 DDH 기사를 편집하면 송고/보류/KILL 어느 버튼도 보이지 않는다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-LOCK-RETENTION — 편집 잠금 탭 생존 유지 (Priority: High)

#### EARS 문장

- **[State-Driven]** WHILE 해당 기사의 편집 탭이 살아있는 동안(sessionStorage `newsroom.editorTabs` 에 그 기사의 탭이 존재), THE 시스템 SHALL lockYN='Y' 를 유지하고 기사 조회 페이지(list.do) 이동만으로는 락을 해제하지 않는다.
- **[Event-Driven]** WHEN 사용자가 편집 탭의 × 버튼으로 탭을 닫으면, THE 시스템 SHALL 그 기사의 편집 락을 해제한다.
- **[Event-Driven]** WHEN 편집 탭에서 송고/보류/KILL 이 성공하여 탭이 빈 '새 기사' 탭으로 전환되면, THE 시스템 SHALL 그 기사의 편집 락을 해제한다.
- **[Event-Driven]** WHEN 사용자가 로그아웃하거나 세션이 만료되면, THE 시스템 SHALL 그 세션이 보유한 열려있는 편집 탭들의 락을 해제한다.
- **[Event-Driven]** WHEN 브라우저(탭)가 닫히면, THE 시스템 SHALL 기존 `beforeunload`/`visibilitychange:hidden` + `sendBeacon` release 경로로 그 기사의 락을 해제한다(SPEC-NEWS-REVISE-002 계약 그대로 재사용).
- **[Unwanted]** IF 사용자가 같은 세션에서 작성 페이지를 떠났다 돌아와 WRITE 라우트가 재마운트되어 같은 `pageSessionId` 로 acquire 를 재발사하면, THEN THE 시스템 SHALL 그 락 재획득을 멱등 성공(`{ ok: true }`, lockedAt 갱신)으로 처리하고 자기 자신을 'locked' 로 거부하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 편집 탭이 살아있는 동안 조회 페이지 이동/탭 전환만으로 락을 해제하지 않는다(동시편집 구멍 방지).

#### Acceptance Criteria 포인터

- AC-LOCK-1 (탭 생존 중 유지/조회 이동 불해제), AC-LOCK-2 (4시점 해제), AC-LOCK-3 (같은 세션 재획득 멱등), AC-LOCK-4 (송고·보류·KILL 성공 명시 해제) — acceptance.md §1

---

### REQ-LOCK-RELEASE-EXPLICIT — 성공·탭닫기 경로 명시적 해제 보장 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 송고/보류/KILL 이 성공하여 편집 컨텍스트가 종료되면(editArticleId 가 null 로 바뀜), THE 시스템 SHALL 그 기사의 락 해제가 누락 없이 일어나도록 보장한다(명시적 release 호출 또는 "탭 목록에 더 이상 없으면 release" 조건부 cleanup 중 단순한 쪽 채택).
- **[Event-Driven]** WHEN 편집 탭을 × 로 닫으면, THE 시스템 SHALL 명시적 release 또는 "탭 목록에 더 이상 없으면 release" 조건부 cleanup 으로 그 기사의 락 해제를 보장한다.
- **[State-Driven]** WHILE 편집 락 effect 의 unmount cleanup 이 조회 페이지 이동(탭 목록은 그대로 유지)으로 발화하는 동안, THE 시스템 SHALL 락을 해제하지 않는다(탭이 아직 살아있으므로).
- **[Unwanted]** IF unmount cleanup release 가 탭 생존 여부로 조건화되어 송고/보류/KILL 성공 경로의 cleanup 에서 release 가 건너뛰어질 수 있으면, THEN THE 시스템 SHALL 성공 경로에서 별도의 명시적 release 로 해제를 보장하여 락이 영구히 남지 않게 한다.

#### Acceptance Criteria 포인터

- AC-REL-1 (성공 시 release 보장), AC-REL-2 (탭 닫기 release 보장), AC-REL-3 (조회 이동 cleanup 은 불해제) — acceptance.md §2

---

### REQ-DDH-LIFECYCLE — DDH 생애주기 전이 추가 (보류 해제) (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN DDH(보류) 기사에 권한 `D` 또는 `Z` 가 `send` 액션을 적용하면, THE 시스템 SHALL lifecycle 전이 `DDH|D|send`→`DPS` / `DDH|Z|send`→`DPS` 를 적용하여 상태값을 `DPS` 로 전이한다.
- **[Event-Driven]** WHEN DDH(보류) 기사에 권한 `D` 또는 `Z` 가 `kill` 액션을 적용하면, THE 시스템 SHALL lifecycle 전이 `DDH|D|kill`→`DDK` / `DDH|Z|kill`→`DDK` 를 적용하여 상태값을 `DDK` 로 전이한다.
- **[Unwanted]** IF DDH 기사에 권한 `R` 이 어떤 액션을 적용하거나(`DDH|R|*` 미정의), DDH 기사에 `hold` 를 적용하면(`DDH|*|hold` 미정의), THEN THE 시스템 SHALL 그 전이를 거부하고(`{ ok: false, reason: 'invalid-transition' }`) Contents.status 를 DDH 로 그대로 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 기존 RDS 소스 6 전이 및 SPEC-NEWS-REVISE-001 D-6 Z-mirror 3 전이를 변경하지 않는다(전이표 추가만, 기존 행 불변).

#### Acceptance Criteria 포인터

- AC-DDH-1 (DDH→DPS 송고 D/Z), AC-DDH-2 (DDH→DDK KILL D/Z), AC-DDH-3 (DDH|R|*·DDH|*|hold 거부), AC-DDH-4 (기존 9전이 불변) — acceptance.md §3

---

### REQ-DDH-BUTTONS — DDH 버튼 게이트 확장 (Priority: High)

#### EARS 문장

- **[State-Driven]** WHILE 작성 페이지에 로드된 기사의 상태값이 `DDH` 이고 사용자 권한이 `D` 또는 `Z` 인 동안, THE 시스템 SHALL 송고 버튼과 KILL 버튼을 노출한다(KILL 은 기존 `!isDraft` 조건 유지 — DDH 는 항상 기존 기사이므로 자동 충족).
- **[State-Driven]** WHILE 작성 페이지에 로드된 기사의 상태값이 `DDH` 인 동안, THE 시스템 SHALL 보류 버튼을 표시하지 않는다(이미 보류 상태).
- **[Unwanted]** IF 작성 페이지에 로드된 기사의 상태값이 `DDH` 이고 사용자 권한이 `R` 이면, THEN THE 시스템 SHALL 송고/보류/KILL 세 버튼을 모두 표시하지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL DDH 송고에도 기존 송고 가드(본문 끝 "(끝)" 마커 가드, 제목 가드, `window.confirm` 확인창)를 RDS 송고와 동일하게 적용한다.
- **[Unwanted]** THE 시스템 SHALL NOT 기존 RDS 버튼 매트릭스(송고/보류: R|D|Z + RDS, KILL: R|Z + RDS + `!isDraft`)를 변경하지 않는다.

#### Acceptance Criteria 포인터

- AC-BTN-1 (DDH D/Z 송고·KILL 노출, 보류 비표시), AC-BTN-2 (DDH R 전버튼 비표시), AC-BTN-3 (DDH 송고 가드 적용), AC-BTN-4 (RDS 매트릭스 불변) — acceptance.md §4

---

### REQ-REGRESSION-GUARD — 락/전이/버튼 회귀 가드 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-002 락 계약(`acquireEditLock` 마운트 시 획득, 30분 stale 타임아웃, 타 세션 'locked' 거부 + lock-banner, `sendBeacon` 해제, same-session 멱등 재획득)을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SSE `type:'lock'` 재조회와 데스크 미송고 필터(status `RDS,DDH` + 컬럼 8종 LockYN 포함) 동작을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-007 의 ContentsVO 읽기전용 8필드 표시 및 부서별 송고 진입점 동작을 회귀 없이 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본 SPEC 으로 인해 새로운 락 규칙/락 스토어/세션 메커니즘/디자인 토큰을 도입하지 않는다.

#### Acceptance Criteria 포인터

- AC-REG-1 (락 계약 재사용), AC-REG-2 (SSE/필터 회귀), AC-REG-3 (007 회귀) — acceptance.md §5

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (연합뉴스 스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 재사용한다.
- DDH 버튼은 기존 RDS 버튼과 동일한 클래스(`yh-btn--primary`/`yh-btn--kill`)를 재사용한다(신규 버튼 스타일 금지).

### 5.2 접근성 (Accessibility)

- DDH 편집 시 노출되는 송고/KILL 버튼은 기존 RDS 버튼과 동일한 마크업/role/키보드 조작을 따른다.
- 락 거부 배너(`role="alert"` `aria-live="assertive"`)는 SPEC-NEWS-REVISE-002 동작을 그대로 따른다.

### 5.3 회귀 방지

- SPEC-NEWS-REVISE-001/002/003/007 의 모든 AC 회귀 없음.
- SPEC-BACKEND-CORE-001 lifecycle reducer 의 RDS 소스 6 전이 + Z-mirror 3 전이 불변.
- SPEC-FRONTEND-UI-001 의 4탭 레이아웃·우상단 사용자 정보·상세보기 호출 회귀 없음.
- SPEC-AUTH-001 의 R/D/Z 권한 의미/세션 메커니즘 변경 없음.

### 5.4 성능 (Performance)

- 락 유지/해제 와이어링은 추가 폴링/타이머를 도입하지 않고 기존 acquire/release/sendBeacon 호출과 탭 수명만 이용한다.
- DDH 전이/버튼 확장은 추가 네트워크 호출 없이 기존 편집 로드 결과(`queryArticles`)와 `applyAction` 경로를 재사용한다.

### 5.5 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 구현 사실 (Brownfield Δ 기준점)

> 직접 Read 로 검증한 현재 상태(2026-06-06).

| 파일 | 현재 상태 | Δ |
|------|-----------|---|
| `web/src/controller/useWriteController.js` (약 L282~292) | 편집-락 effect 의 unmount cleanup 이 **무조건** `model.releaseEditLock?.(editArticleId, { sessionId })` 호출 | 조회 페이지 이동(탭 생존)으로는 해제하지 않도록 cleanup 조건화 또는 명시적 release 경로로 재배치 |
| `web/src/view/WriteWorkspace.jsx` | 멀티탭 — `newsroom.editorTabs` sessionStorage 영속. `closeTab` 은 unmount→컨트롤러 cleanup 으로 해제(L166 주석), `endEditContext` 는 송고/보류/KILL 성공 시 editArticleId=null→cleanup 으로 해제(L186 주석). list.do 이동 시 전체 unmount(L9 주석) | 탭 닫기·성공 경로의 해제를 명시화하고, 조회 이동 cleanup 은 해제하지 않도록 정합 |
| `src/services/articleService.js` `acquireEditLock` (L105~133) | same-user+same-session 보유 시 idempotent 재획득(lockedAt 갱신 + `{ok:true}`) **이미 구현됨**(L128~131). same-user 다른 session 은 'locked' 거부(D2-5 strict) | 변경 없음. 본 SPEC 은 이 멱등 동작의 **회귀 가드**로 명문화 |
| `src/services/lifecycle.js` TRANSITIONS (L9~21) | RDS 소스 6 전이 + Z-mirror 3 전이만 정의. DDH 는 source 로 미정의(invalid-transition) | DDH 출발 4 전이 추가: `DDH|D|send`→`DPS`, `DDH|Z|send`→`DPS`, `DDH|D|kill`→`DDK`, `DDH|Z|kill`→`DDK`. `DDH|R|*`/`DDH|*|hold` 는 미정의 유지 |
| `web/src/view/WritePage.jsx` (L780, L834, L842) | `isRds = ctrl.status === 'RDS'`. 송고/보류: R|D|Z + isRds. KILL: R|Z + isRds + `!isDraft`. DDH 면 어떤 버튼도 미렌더 | DDH + (D|Z): 송고·KILL 노출(보류 비표시); DDH + R: 전버튼 비표시. RDS 매트릭스 불변 |
| `web/src/view/useViewController.js` (약 L52) | 데스크 미송고 필터가 status `RDS,DDH` 둘 다 조회 | 변경 없음(DDH 가 작성 페이지로 진입하는 근거) |

---

## 7. 영향 영역 (Affected Files)

- `src/services/lifecycle.js` — DDH 출발 4 전이 추가.
- `web/src/view/WritePage.jsx` — DDH 버튼 게이트 확장(송고/KILL on D|Z, 보류 비표시, R 전버튼 비표시).
- `web/src/controller/useWriteController.js` — 편집-락 unmount cleanup 조건화 / 명시적 release 경로.
- `web/src/view/WriteWorkspace.jsx` — 탭 닫기·송고 성공 경로의 락 해제 명시화(필요 시).
- 로그아웃 경로(클라이언트 명시 해제 또는 서버 logout 핸들러의 sessionId 일괄 해제 중 단순한 쪽).
- 테스트: `test/lifecycleRule.test.js`, `test/articleService.test.js`, `web/src/view/WritePage.test.jsx`, `web/src/controller/useWriteController.editLoad.test.jsx`(또는 신규 `web/src/controller/useWriteController.lockRetention.test.jsx`), `web/src/view/WriteWorkspace.test.jsx`.

---

## 8. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-002**: lockYN 락 계약(acquire/release/sendBeacon, 30분 stale, same-session 멱등, 타 세션 'locked'). 본 SPEC 은 이 계약을 그대로 재사용하며 새 규칙을 도입하지 않는다.
- **SPEC-NEWS-REVISE-003**: lifecycle 전이표 회귀 가드(`test/lifecycleRule.test.js`). 본 SPEC 은 DDH 4 전이를 추가하되 기존 9 전이를 불변으로 유지한다.
- **SPEC-NEWS-REVISE-007**: 부서별 송고 진입점 + ContentsVO 읽기전용 8필드. 본 SPEC 은 그 위에서 락 유지·DDH 전이/버튼을 추가하며 007 AC 를 회귀 없이 유지한다.
- **SPEC-BACKEND-CORE-001**: lifecycle reducer + 권한 전이 매트릭스. 본 SPEC 의 DDH 4 전이가 이를 확장한다(RDS 소스/Z-mirror 불변).
- **SPEC-FRONTEND-UI-001**: 작성 페이지 버튼/레이아웃. 본 SPEC 의 DDH 버튼 노출이 이를 확장한다(RDS 매트릭스 불변).
- **SPEC-AUTH-001**: R/D/Z 권한 + 세션. 본 SPEC 의 D/Z DDH 송고·KILL, R 비표시가 이를 따른다.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- `news.md` 수정(생애주기 절 DDH 3줄은 코드 구현 완료 후 오케스트레이터가 추가 예정 — 본 SPEC/Run 은 news.md 를 수정하지 않는다).
- DDH 외 다른 막다른 상태(RRH/RRK/DDK/DPS 등)의 신규 전이 추가.
- `DDH|R|*` 전이 또는 `DDH|*|hold` 전이 정의(R 권한 DDH 전이 / DDH 재보류는 비목표 — invalid-transition 유지).
- 새 락 규칙/락 스토어/세션 메커니즘 변경, 새 폴링/타이머 도입.
- 신규 디자인 토큰/CSS 변수/버튼 스타일 도입.
- 수집/배부 시스템 (제작 시스템만; CLAUDE.md "현재 구현 범위는 제작 시스템만").
- DB 스키마 변경(LockYN 등 기존 컬럼 재사용; 컬럼 추가/변경 없음, DB 내용 삭제 없음).
- 타 SPEC(SPEC-NEWS-REVISE-001~007 및 기타 SPEC)의 3파일(spec/plan/acceptance) 수정.
- 코드 구현 (본 SPEC 은 Plan 단계 문서만; Run 단계에서 구현).

---

## 10. Definition of Done

- [ ] 편집 탭 생존 중 lockYN='Y' 유지, 조회 페이지 이동만으로 미해제 (AC-LOCK-1 GREEN)
- [ ] 락 해제 4시점(탭 닫기/송고·보류·KILL 성공/로그아웃/탭 닫힘) 동작 (AC-LOCK-2 GREEN)
- [ ] 같은 세션 재진입 시 같은 pageSessionId 락 멱등 재획득 (AC-LOCK-3 GREEN)
- [ ] 송고·보류·KILL 성공 경로 명시적 release 보장 (AC-LOCK-4, AC-REL-1 GREEN)
- [ ] 탭 닫기 release 보장 (AC-REL-2 GREEN)
- [ ] 조회 이동 cleanup 은 락 미해제 (AC-REL-3 GREEN)
- [ ] DDH|D|send·DDH|Z|send → DPS 전이 (AC-DDH-1 GREEN)
- [ ] DDH|D|kill·DDH|Z|kill → DDK 전이 (AC-DDH-2 GREEN)
- [ ] DDH|R|*·DDH|*|hold 거부 + DB 무변경 (AC-DDH-3 GREEN)
- [ ] 기존 RDS 6 전이 + Z-mirror 3 전이 불변 (AC-DDH-4 GREEN)
- [ ] DDH + D/Z: 송고·KILL 노출, 보류 비표시 (AC-BTN-1 GREEN)
- [ ] DDH + R: 송고/보류/KILL 전버튼 비표시 (AC-BTN-2 GREEN)
- [ ] DDH 송고 (끝)·제목·확인창 가드 적용 (AC-BTN-3 GREEN)
- [ ] RDS 버튼 매트릭스 불변 (AC-BTN-4 GREEN)
- [ ] 락 계약/SSE/필터/007 회귀 없음 (AC-REG-1, 2, 3 GREEN)
- [ ] 기존 토큰만 사용, 신규 토큰 미도입
- [ ] `npm test` 전체 통과, `npm run test:web` 전체 통과, `npm run build` 무경고
- [ ] lock 관련 테스트는 now 고정 전달(30분 stale 시한폭탄 방지)
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] `news.md` 미변경 확인(구현 완료 후 오케스트레이터가 별도 반영)
- [ ] 기존 SPEC(NEWS-REVISE-001~007, BACKEND-CORE-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
