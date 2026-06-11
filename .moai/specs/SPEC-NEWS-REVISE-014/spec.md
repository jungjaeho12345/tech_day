---
id: SPEC-NEWS-REVISE-014
version: 0.1.0
status: Plan
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-012
  - SPEC-EDIT-LOCK-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-008
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-014 — Lock해제 확인창 + 편집 화면 자동 종료(강제 해제 통지)

## HISTORY

- 2026-06-10 (v0.1.0): 최초 작성. **사용자 직접 요청(2026-06-10, verbatim 승인) 흡수** — "데스크 미송고에서
  Lock해제를 누르면 alert 를 띄워 'Lock해제하시겠습니까?' 예/아니오 묻고, 예를 누르면 데이터베이스 Contents
  테이블의 LockYN 이 N 으로 변경되고, 기사 작성에서 편집으로 열었던 화면은 자동으로 닫힌다." **편집 화면
  종료 UX 는 2026-06-10 AskUserQuestion 으로 확정**: 강제 해제 SSE 수신 시 `alert('Lock이 해제되어 편집을
  종료합니다')` 로 사전 통지한 뒤 편집 탭을 닫고 워크스페이스가 남은 탭 / 새 기사 탭으로 전환하며, 저장하지
  않은 편집 내용은 폐기한다. **DB 강제 해제(LockYN='N') 경로는 SPEC-NEWS-REVISE-012 에서 이미 구현됨** —
  본 SPEC 은 그 위에 (a) 클릭 확인창, (b) 편집 화면 자동 종료, (c) SSE `forced:true` 구분 플래그만 Δ-only 로
  추가한다. 검증: `web/src/view/ViewPage.jsx:57-63,576`, `server/index.js:364-383`,
  `src/services/articleService.js:172-183`. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-014 |
| 제목 | Lock해제 확인창(window.confirm) + 강제 해제 시 편집 화면 자동 종료 |
| 상태 | Plan |
| 생성일 | 2026-06-10 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-012(Lock해제 컨텍스트 메뉴), SPEC-EDIT-LOCK-001(편집 잠금), NEWS-REVISE-002/008, AUTH-001 |
| 영향 페이지 | `list.do`(조회 — 컨텍스트 메뉴 클릭), `writer.do`(작성 — 편집 탭 자동 종료) |
| 영향 레이어 | 프론트(컨텍스트 메뉴 확인창 · WritePage SSE 구독 · WriteWorkspace 탭 종료) · 서버(SSE payload 1줄) |
| Source of truth | 사용자 직접 요청(2026-06-10 verbatim) + 종료 UX 결정(2026-06-10 AskUserQuestion 승인) |
| 작업 모드 | Brownfield 확장 (Δ-only). DB 강제 해제는 SPEC-012 에서 구현 완료 |
| 인코딩 | UTF-8 (CLAUDE.md HARD) |

---

## 1. 목적 (Goal)

SPEC-NEWS-REVISE-012 가 추가한 list.do 컨텍스트 메뉴 "Lock해제"(편집 잠금 강제 해제)에 **오조작 방지 확인창**을
붙이고, 강제 해제로 잠금을 빼앗긴 **원 편집자의 편집 화면을 자동으로 닫아** 데이터/상태 불일치를 막는다.

현재(2026-06-10) 두 가지 운영 공백이 있다:
1. **확인창 없음** — list.do 에서 "Lock해제"를 누르면 즉시 강제 해제가 실행된다(`ViewPage.jsx:60`
   `onSelect: () => onForceUnlock(article.articleId)`). 실수 클릭이 곧바로 타인의 잠금을 푼다.
2. **편집 화면이 모름** — 강제 해제 당한 원 편집자의 WritePage(편집 탭)는 SSE 를 구독하지 않으므로
   (`WritePage`/`useWriteController` 에 SSE 구독 없음 — ViewPage 만 `model.subscribe` 사용), 잠금을 잃은 사실을
   저장/송고 시도가 `lock-required` 로 실패할 때에야 알게 된다. 그 사이 사용자는 이미 풀린 잠금의 기사를 계속
   편집한다.

`why`: CLAUDE.md 최상위 비협상 규칙은 "안전성·데이터 무결성 우선"이다. 강제 해제는 동시편집 잠금의 의도적
예외이므로, (a) 파괴적 조작 직전 확인은 필수이고, (b) 잠금을 잃은 편집자가 무효 편집을 계속하지 못하도록 화면을
즉시·명확히 종료해야 한다. 정합 명세 없이 구현하면 자기 종료(송고/보류/KILL/정상 탭 닫기)까지 잘못 닫거나,
무관한 기사 탭을 닫는 회귀가 발생한다. 본 SPEC 은 이를 EARS 로 고정한다.

본 SPEC 은 SPEC-NEWS-REVISE-012 의 DB 강제 해제 경로를 **재사용**하며 새 백엔드 동작을 발명하지 않는다(Δ-only).

---

## 2. 도메인 용어 및 현재 구현 사실 (Glossary / Brownfield 기준점)

> 직접 Read 로 검증한 현재 상태(2026-06-10).

- **강제 해제 DB 경로(이미 구현됨, SPEC-012)**: list.do 컨텍스트 메뉴 "Lock해제"(`ViewPage.jsx:57-63`
  `buildForceUnlockItem`, D/Z 활성·R 비활성) → `onForceUnlock` → `model.forceUnlockArticle`(`ViewPage.jsx:576`)
  → `httpModel.forceUnlockArticle`(`httpModel.js:240`) → `POST /api/articles/:id/force-unlock`
  (`server/index.js:364-383`, 세션 역할 D/Z 가드 401→403→404) → `articleService.forceReleaseEditLock`
  (`src/services/articleService.js:172-183`) → `UPDATE Contents SET lockYN='N', lockerUserId=NULL,
  lockerSessionId=NULL, lockedAt=NULL`. **DB 부분은 본 SPEC 의 신규 동작이 아니다.**
- **확인창 부재(현행)**: `buildForceUnlockItem` 의 활성 항목은 `onSelect: () => onForceUnlock(article.articleId)`
  로 **확인 없이 즉시** 호출한다(`ViewPage.jsx:60`).
- **기존 확인창 패턴**: WritePage 의 송고/보류/KILL 은 동기 `window.confirm` 을 선행한다 —
  `onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}`(`WritePage.jsx:882,884,889,...`).
  브라우저가 확인/취소(= 예/아니오) 버튼을 렌더한다. 본 SPEC 의 '예/아니오' 요구는 이 기존 메커니즘
  (`window.confirm`)으로 충족한다(새 모달 컴포넌트 도입 금지).
- **서버 SSE 발행(현행)**: 강제 해제 성공 시 `bus.emit('change', { type: 'unlock', articleId })`
  (`server/index.js:380`). `GET /api/stream` 이 이를 브로드캐스트한다. **payload 에 `forced` 플래그는 아직
  없다.**
- **SSE 구독(현행)**: 모델 컨트랙트 `subscribe(filter, onChange)`(`contract.js:29,53`,
  `httpModel.js:250-275`)가 EventSource 로 `/api/stream` 을 열어 `change` payload 를 `onChange` 로 넘긴다.
  **ViewPage 는 이를 구독하지만(useViewController), WritePage 는 구독하지 않는다.**
- **편집 화면 = 탭(브라우저 창 아님)**: 편집 화면은 `WriteWorkspace`(`WriteWorkspace.jsx`)의 탭이다
  (sessionStorage `newsroom.editorTabs`). `WritePage` 는 `editArticleId` 를 prop 으로 받고
  (`useWriteController(user, { editArticleId, draftKey })`, `WritePage.jsx:797`), 잠금은
  `useWriteController.js:245-283` 에서 마운트 시 획득한다(`acquiredLockRef.current`).
- **탭 종료 메커니즘(현행)**: `WriteWorkspace.closeTab(tabId)` 가 탭을 닫고(마지막 탭이면 빈 '새 기사' 탭 유지,
  `WriteWorkspace.jsx:174-191`), `endEditContext(tabId)` 는 편집 탭을 빈 '새 기사' 탭으로 전환한다(`:197-202`).
  편집 탭은 `onEditContextEnded` 콜백을 이미 prop 으로 받는다(`:252`).

---

## 3. 범위 (Scope)

### 3.1 포함 (In Scope)

- **Lock해제 확인창**: list.do 컨텍스트 메뉴의 활성 "Lock해제"(D/Z) 클릭 시 `window.confirm('Lock해제하시겠습니까?')`
  를 선행하고, **수락(예) 시에만** `forceUnlockArticle(articleId)` 를 호출한다. 취소(아니오) 시 모델 호출도 DB
  변경도 없다. R(비활성) 항목은 SPEC-012 대로 클릭 자체가 무동작이므로 확인창도 뜨지 않는다.
- **편집 화면 자동 종료**: 편집 잠금을 보유한 WritePage 가 자기 기사에 대한 강제 해제 SSE 프레임
  (`{ type:'unlock', articleId:X, forced:true }`)을 수신하면, `alert('Lock이 해제되어 편집을 종료합니다')` 를
  **1회** 통지한 뒤 편집 탭을 닫는다(워크스페이스가 남은 탭 / 새 기사 탭으로 전환). 저장하지 않은 편집 내용은
  폐기한다.
- **SSE `forced:true` 구분 플래그**: 강제 해제 SSE payload 에 `forced:true` 를 실어, 클라이언트가 강제 해제와
  정상 해제(송고/보류/KILL/정상 탭 닫기에 따른 release)를 구분할 수 있게 한다(`server/index.js` payload 1줄).
- WritePage 의 SSE 구독은 기존 `model.subscribe(filter, onChange)` 컨트랙트를 재사용한다(새 실시간 채널 금지).

### 3.2 핵심 설계 결정 — 자기 해제는 종료시키지 않는다

- **종료 트리거 = `forced:true` + articleId 일치 + 잠금 보유**: 세 조건이 모두 참일 때만 alert/종료한다.
- **자기 시작 해제는 제외**: 편집자 본인이 송고/보류/KILL 하거나 탭을 정상으로 닫아 release 가 일어난 경우는
  `forced:true` 가 아니므로 alert/종료 대상이 아니다(기존 `endEditContext`/`closeTab` 경로 불변). 이를 위해 정상
  해제 이벤트(존재한다면)에는 `forced:true` 를 싣지 않는다.
- **확인창 vs 모달**: 기존 송고/보류/KILL 의 `window.confirm` 패턴을 그대로 차용한다(예/아니오 = 확인/취소). 새
  디자인 토큰·모달 컴포넌트를 만들지 않는다.

### 3.3 제외 (Out of Scope) — §9 Exclusions 참조

---

## 4. 사용자 시나리오 (User Scenarios)

### 4.1 D/Z 강제 해제 — 확인창 수락 (정상 경로)
- D(또는 Z)가 list.do 에서 LockYN='Y' 행을 우클릭 → 활성 "Lock해제" 클릭.
- `window.confirm('Lock해제하시겠습니까?')` 가 뜬다 → 예 → `forceUnlockArticle(articleId)` 1회 호출 → DB
  LockYN='N'(SPEC-012 경로) → 서버가 `forced:true` SSE 발행.

### 4.2 확인창 취소
- 같은 클릭에서 아니오를 누르면 `forceUnlockArticle` 가 호출되지 않고 DB 도 SSE 도 변동 없다.

### 4.3 원 편집자 화면 자동 종료
- 원 편집자가 writer.do 에서 그 기사를 편집(잠금 보유) 중이었다면, `forced:true` SSE 수신 시
  `alert('Lock이 해제되어 편집을 종료합니다')` 1회 → 편집 탭이 닫히고 남은 탭/새 기사 탭으로 전환 → 저장 안 한
  내용 폐기.

### 4.4 자기 송고/보류/KILL/정상 닫기 (종료 아님)
- 편집자 본인이 송고/보류/KILL 하거나 탭을 직접 닫으면 alert 없이 기존 동작(빈 '새 기사' 탭 전환/탭 닫힘)만
  일어난다.

### 4.5 무관한 기사·초안 탭
- 강제 해제 SSE 의 articleId 가 현재 편집 중인 articleId 와 다르면 무시한다. 잠금 없는 초안 탭(editArticleId=null)
  은 어떤 unlock 프레임도 무시한다.

---

## 5. 요구사항 (Requirements — EARS)

> 각 AC 는 acceptance.md 에 Given-When-Then 으로 상술된다. 프론트 `web/src/**/*.test.jsx`(`npm run test:web`),
> 백엔드 `test/*.test.js`(`npm test`).

### REQ-UNLOCK-CONFIRM — Lock해제 클릭 확인창 (Priority: High)

#### EARS 문장
- **[Event-Driven]** WHEN 사용자가 list.do 컨텍스트 메뉴(임의 메뉴)에서 활성 "Lock해제"(권한 D/Z) 항목을
  클릭하면, THE 시스템 SHALL `window.confirm('Lock해제하시겠습니까?')` 를 표시한다.
- **[Event-Driven]** WHEN 확인창에서 사용자가 수락(예/확인)하면, THE 시스템 SHALL `forceUnlockArticle(articleId)`
  를 정확히 1회 호출한다.
- **[Unwanted]** IF 확인창에서 사용자가 취소(아니오/취소)하면, THEN THE 시스템 SHALL `forceUnlockArticle` 를
  호출하지 아니하고 어떤 DB 변경도 SSE 발행도 일어나지 아니한다.
- **[Unwanted]** IF "Lock해제" 항목이 비활성(권한 R)이면, THEN THE 시스템 SHALL 클릭 시 확인창을 표시하지
  아니하고 모델 호출도 하지 아니한다(SPEC-012 show-but-disabled 패턴 불변).

#### Acceptance Criteria 포인터
- AC-CONFIRM-1 (확인창 표시), AC-CONFIRM-2 (수락 → 1회 호출), AC-CONFIRM-3 (취소 → 무호출),
  AC-CONFIRM-4 (R 비활성 → 확인창 없음) — acceptance.md §1

---

### REQ-UNLOCK-DB — 강제 해제 시 LockYN='N' (Priority: Medium, 이미 구현됨 — 회귀 가드)

#### EARS 문장
- **[Event-Driven]** WHEN 확인창 수락으로 강제 해제가 호출되면, THE 시스템 SHALL 기존
  `forceReleaseEditLock`(SPEC-012)을 통해 Contents 의 `lockYN='N', lockerUserId=NULL, lockerSessionId=NULL,
  lockedAt=NULL` 로 설정한다(신규 백엔드 동작 없음 — Δ-only 회귀 가드).

> **[정합 노트]** DB 강제 해제는 SPEC-NEWS-REVISE-012 에서 구현 완료다. 본 REQ 는 확인창 추가가 그 결과를
> 회귀시키지 않음을 보증하기 위한 가드일 뿐, 새 서버/서비스 코드를 만들지 않는다.

#### Acceptance Criteria 포인터
- AC-DB-1 (수락 후 LockYN='N' + locker 컬럼 NULL — 기존 경로 회귀) — acceptance.md §2

---

### REQ-EDITOR-AUTOCLOSE — 강제 해제 SSE 수신 시 편집 화면 자동 종료 (Priority: High)

#### EARS 문장
- **[State-Driven]** WHILE WritePage 가 articleId=X 의 편집 잠금을 보유한 동안, WHEN
  `{ type:'unlock', articleId:X, forced:true }` SSE `change` 프레임이 도착하면, THE 시스템 SHALL
  `alert('Lock이 해제되어 편집을 종료합니다')` 를 **정확히 1회** 표시하고, 그 편집 탭을 닫는다(워크스페이스가
  남은 탭 / 새 기사 탭으로 전환).
- **[Ubiquitous]** THE 시스템 SHALL 편집 탭 종료 시 저장하지 않은 에디터 변경분을 폐기한다(별도 저장 시도 없음).
- **[Unwanted]** IF unlock 프레임의 articleId 가 현재 편집 중인 articleId 와 다르면, THEN THE 시스템 SHALL 그
  프레임을 무시하고 alert/종료를 수행하지 아니한다.
- **[Unwanted]** IF WritePage 가 편집 잠금을 보유하지 않으면(초안 탭, editArticleId=null), THEN THE 시스템
  SHALL unlock 프레임을 무시한다.
- **[Unwanted]** IF 해제가 자기 시작 release(송고/보류/KILL/편집자의 정상 탭 닫기)이면(`forced:true` 아님),
  THEN THE 시스템 SHALL alert/자동 종료를 수행하지 아니하고 기존 종료 경로만 따른다.
- **[Unwanted]** IF 동일한 `forced:true` 프레임이 중복 도착하면, THEN THE 시스템 SHALL alert 를 1회만 표시한다
  (멱등 — 이미 종료가 진행된 탭은 추가 alert 없음).

#### Acceptance Criteria 포인터
- AC-CLOSE-1 (보유 탭 + 일치 articleId → alert 1회 + 탭 닫힘), AC-CLOSE-2 (다른 articleId → 무시),
  AC-CLOSE-3 (초안 탭 → 무시), AC-CLOSE-4 (자기 해제 → alert/종료 없음), AC-CLOSE-5 (중복 프레임 → alert 1회),
  AC-CLOSE-6 (저장 안 한 변경분 폐기) — acceptance.md §3

---

### REQ-SSE-FORCED-FLAG — 강제 해제 SSE 구분 플래그 (Priority: High)

#### EARS 문장
- **[Event-Driven]** WHEN 강제 해제가 성공하면, THE 시스템 SHALL 강제 해제 SSE `change` payload 에 `forced:true`
  를 포함하여 발행한다(`{ type:'unlock', articleId, forced:true }`).
- **[Unwanted]** THE 시스템 SHALL NOT 정상 해제 이벤트(존재 시: 송고/보류/KILL/정상 release 에 수반되는 변동)에
  `forced:true` 를 포함하지 아니한다(클라이언트가 강제/정상을 구분 가능하도록).
- **[Ubiquitous]** THE 시스템 SHALL list.do(ViewPage)의 기존 SSE 재조회 동작을 회귀시키지 아니한다 —
  `forced` 플래그 추가는 ViewPage 의 재조회 트리거에 영향이 없어야 한다(payload 확장만, 키 제거 없음).

#### Acceptance Criteria 포인터
- AC-SSE-1 (강제 해제 payload 에 forced:true), AC-SSE-2 (정상 해제엔 forced 미포함),
  AC-SSE-3 (ViewPage 재조회 회귀 없음) — acceptance.md §4

---

### REQ-REGRESSION-GUARD — 메뉴/잠금/SSE 회귀 가드 (Priority: Medium)

#### EARS 문장
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-012 의 "Lock해제" 노출/게이팅(LockYN='Y' 조건부, D/Z 활성,
  R 비활성) 및 서버 강제 해제 라우트(401→403→404 + LockYN='N' + 보유자 비노출)를 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-EDIT-LOCK-001 / NEWS-REVISE-002 의 잠금 획득/해제/멱등/30분 stale 계약과
  WritePage 의 lock-before-load·탭 생존 동작을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL 기존 WritePage 송고/보류/KILL `window.confirm` 확인창과 WriteWorkspace 의
  `endEditContext`/`closeTab` 정상 경로를 회귀 없이 유지한다.

#### Acceptance Criteria 포인터
- AC-REG-1 (SPEC-012 메뉴/라우트 회귀), AC-REG-2 (잠금 계약/WritePage 회귀), AC-REG-3 (기존 확인창/탭 경로 회귀)
  — acceptance.md §5

---

## 6. 비기능 요건 (Non-Functional Requirements)

### 6.1 보안 / 데이터 무결성
- 강제 해제 라우트의 D/Z 서버 가드(SPEC-012)는 불변. 본 SPEC 은 프론트 확인창만 추가하므로 서버 권한 모델을
  바꾸지 않는다(확인창은 UX 안전장치이지 인가 수단이 아님).
- 편집 탭 자동 종료는 잠금 컬럼/기사 본문/DB 행을 변경·삭제하지 않는다(CLAUDE.md "DB 내용 삭제 금지" HARD).
- alert/confirm 은 직전 보유자 식별자 등 민감정보를 노출하지 않는다(고정 문구만 사용).

### 6.2 실시간 / 전파
- WritePage SSE 구독은 **기존 `model.subscribe` 컨트랙트 재사용**(폴링/타이머/신규 채널 금지). 컴포넌트
  unmount 시 `unsubscribe` 로 정리한다(누수 방지).
- `forced` 플래그는 payload 확장(키 추가)만 — 기존 키(`type`,`articleId`) 제거·변경 없음(SSE 소비자 하위호환).

### 6.3 디자인 토큰 / 접근성
- 신규 모달/CSS 변수 도입 없음. 확인은 `window.confirm`, 통지는 `window.alert`(기존 송고/보류/KILL 확인창과
  동일 메커니즘).

### 6.4 인코딩
- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD).

### 6.5 회귀 방지
- SPEC-NEWS-REVISE-012(Lock해제 메뉴/라우트), SPEC-EDIT-LOCK-001/NEWS-REVISE-002(잠금 계약),
  SPEC-NEWS-REVISE-008(SSE 재조회), AUTH-001(R/D/Z 권한)을 모두 회귀 없이 유지한다.

---

## 7. 영향 영역 (Affected Files)

- `web/src/view/ViewPage.jsx` — `buildForceUnlockItem` 의 활성 `onSelect` 을 `window.confirm('Lock해제하시겠습니까?')`
  선행 후에만 `onForceUnlock` 호출하도록 변경(취소 시 무호출).
- `web/src/view/WritePage.jsx` 또는 `web/src/controller/useWriteController.js` — 편집 잠금 보유 시
  `model.subscribe` 로 `change` 구독, `forced:true` + articleId 일치 프레임에서 `alert` 1회 + 탭 종료 콜백 호출.
- `web/src/view/WriteWorkspace.jsx` — 강제 종료용 콜백 배선(기존 `closeTab`/`endEditContext` 재사용 또는
  `onForceClosed` prop 추가). 저장 안 한 변경분 폐기.
- `server/index.js` — `bus.emit('change', { type:'unlock', articleId, forced:true })`(force-unlock 라우트 1줄).
- 테스트: 프론트 `web/src/view/ViewPage.forceUnlock.test.jsx`(확인창) + WritePage/WriteWorkspace 자동 종료 테스트;
  백엔드 `test/serverAuthWiring.test.js` 또는 `test/forceUnlock.test.js`(SSE forced:true payload).

---

## 8. 종속성 및 Cross-References

> 아래 SPEC 들은 **참조 전용** — 본 SPEC 은 이들의 3파일을 수정하지 않는다.

- **SPEC-NEWS-REVISE-012**: list.do "Lock해제" 메뉴 + 서버 강제 해제 라우트 + `forceReleaseEditLock`. 본 SPEC 은
  그 클릭 경로에 확인창을 붙이고, 그 SSE 에 `forced` 플래그를 더하며, 그 결과를 원 편집자 화면 종료로 연결한다.
- **SPEC-EDIT-LOCK-001 / SPEC-NEWS-REVISE-002**: 편집 잠금 의미론(acquire/release/30분 stale/lock-before-load).
  본 SPEC 은 이를 회귀 없이 유지한다.
- **SPEC-NEWS-REVISE-008**: SSE `change` 재조회 경로. 본 SPEC 은 동일 경로를 재사용하며 payload 키만 확장한다.
- **SPEC-AUTH-001**: R/D/Z 권한. SPEC-012 의 D/Z 게이팅을 그대로 따른다.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- **DB 강제 해제 로직 재구현** — `forceReleaseEditLock`/`POST /force-unlock`/`forceUnlockArticle` 는 SPEC-012 에서
  구현 완료. 본 SPEC 은 새 서버/서비스 코드를 만들지 않는다(SSE payload 1줄 확장 제외).
- **새 모달/토스트/디자인 토큰** — 확인은 `window.confirm`, 통지는 `window.alert` 만 사용. 커스텀 모달 컴포넌트
  도입 금지.
- **편집자에게 강제 라우팅/저장 권유 UX** — 자동 종료는 alert 후 탭 닫기까지만. "저장하시겠습니까" 재확인,
  복구 화면, 강제 페이지 이동 등을 만들지 않는다(저장 안 한 변경분은 폐기).
- **정상 해제(송고/보류/KILL/정상 닫기) 동작 변경** — 기존 `endEditContext`/`closeTab` 경로 불변. 자기 해제는
  alert/자동 종료 대상 아님.
- **새 락 스토어/세션 메커니즘/실시간 채널/폴링/타이머** 도입 금지(기존 `model.subscribe` 재사용).
- **서버 권한 모델 변경** — D/Z 가드(SPEC-012)는 불변. 확인창은 인가 수단이 아님.
- **DB 스키마 변경 / DB 내용 삭제** — 컬럼 추가·변경·행 삭제 없음(CLAUDE.md HARD).
- **news.md 수정** — 본 SPEC/Run 은 news.md 를 수정하지 않는다(구현 완료 후 오케스트레이터가 후속 반영 권장).
- **수집/배부 시스템** — 기사 작성기 범위만(CLAUDE.md).
- **타 SPEC 의 3파일(spec/plan/acceptance) 수정** — 참조만 한다.
- **코드 구현** — 본 SPEC 은 Plan 단계 문서만. Run 단계에서 구현.

---

## 10. Definition of Done

- [ ] 활성 "Lock해제" 클릭 시 `window.confirm('Lock해제하시겠습니까?')` 표시 (AC-CONFIRM-1)
- [ ] 수락 → `forceUnlockArticle(articleId)` 1회 호출 (AC-CONFIRM-2), 취소 → 무호출 (AC-CONFIRM-3)
- [ ] R 비활성 항목은 확인창 없음 (AC-CONFIRM-4)
- [ ] 수락 후 LockYN='N' + locker 컬럼 NULL — SPEC-012 경로 회귀 확인 (AC-DB-1)
- [ ] 보유 탭 + 일치 articleId + forced:true → alert 1회 + 탭 닫힘 (AC-CLOSE-1)
- [ ] 다른 articleId 무시 (AC-CLOSE-2), 초안 탭 무시 (AC-CLOSE-3)
- [ ] 자기 해제(송고/보류/KILL/정상 닫기)는 alert/자동 종료 없음 (AC-CLOSE-4)
- [ ] 중복 forced 프레임에도 alert 1회 (AC-CLOSE-5), 저장 안 한 변경분 폐기 (AC-CLOSE-6)
- [ ] 강제 해제 SSE payload 에 forced:true (AC-SSE-1), 정상 해제엔 미포함 (AC-SSE-2)
- [ ] ViewPage SSE 재조회 회귀 없음 (AC-SSE-3)
- [ ] SPEC-012 메뉴/라우트, 잠금 계약/WritePage, 기존 확인창/탭 경로 회귀 없음 (AC-REG-1, 2, 3)
- [ ] 신규 토큰/모달/실시간 채널 미도입
- [ ] `npm test`(backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web`(vitest) 전체 GREEN
- [ ] `npm run build`(vite) 무경고, `npm run lint`(eslint) 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.0 / Plan)
- [ ] `news.md` 미변경 확인(구현 완료 후 오케스트레이터가 별도 반영 권장)
- [ ] 기존 SPEC(NEWS-REVISE-012, EDIT-LOCK-001, NEWS-REVISE-002/008, AUTH-001) 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD; 토큰 미설정 시 로컬 로그 폴백 — "전송됨" 단정 금지)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-10
