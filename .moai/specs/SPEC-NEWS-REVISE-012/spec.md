---
id: SPEC-NEWS-REVISE-012
version: 0.1.1
status: Plan
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-EDIT-LOCK-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-008
  - SPEC-NEWS-REVISE-007
  - SPEC-AUTH-001
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
---

# SPEC-NEWS-REVISE-012 — 기사 조회페이지(list.do) 컨텍스트 메뉴 "Lock해제" (편집 잠금 강제 해제)

## HISTORY

- 2026-06-10 (v0.1.1): **REQ-FORCE-UNLOCK-CONSISTENCY 정합 노트 보정 (동작 변경 아님).** Run 단계 검증에서
  발견된 기존 의미론과의 문구 불일치를 정정한다. 직전 EARS 는 "강제 해제로 잠금을 잃은 원 편집자가 저장/액션
  시도 시 lock-required" 로 기술했으나, `applyAction` 의 락 가드는 `current.lockYN === 'Y'` 일 때만 발동하므로
  (`src/services/articleService.js:206`) 강제 해제 직후 맨 `lockYN='N'` 상태의 액션은 통과(`ok:true`)가 기존
  SPEC-EDIT-LOCK-001 의 정의된 동작이다(§3.2 "코드 변경 금지"). 따라서 원 편집자가 막히는 시점을 **다른 세션이
  재획득해 다시 `lockYN='Y'` 가 된 이후**로 보정하고, 두 경로(PUT `assertLockHolder` 는 'N' 에도 lock-required /
  action 가드는 'Y' 시에만 발동)의 차이를 정합 노트로 명시한다. 동작 변경 없음 — acceptance.md AC-CON-2 와 동기.
  (검증: `test/integration.lockLifecycle.test.js` + `test/forceUnlock.test.js`) (manager-spec)
- 2026-06-10 (v0.1.0): 최초 작성. **사용자 직접 요청(2026-06-10) 흡수** — "기사 조회페이지(list.do)에서 기사 행을
  우클릭하면 나오는 컨텍스트 메뉴에, 해당 기사의 LockYN 이 'Y' 일 때 'Lock해제' 메뉴를 추가하고, 누르면 그
  기사의 LockYN 이 'N' 이 된다(편집 잠금 강제 해제)." 도메인 결정은 **2026-06-10 사용자 AskUserQuestion 승인**
  으로 확정: **Lock해제 메뉴는 권한 D/Z 전용** — R 에게는 기존 컨텍스트 메뉴의 비허용 항목 패턴(show-but-disabled)
  과 일관되게 **표시하되 비활성**으로 둔다. Z 는 `Z=D-mirror` 원칙(news.md L62, moai-domain-news-editor §2.1)을
  적용해 D 와 동일하게 활성. **news.md 는 본 SPEC/Run 에서 수정하지 않으며, 코드 구현 완료 후 오케스트레이터가
  news.md 에 후속 반영하는 것을 권장한다.** 강제 해제 후 원 편집자의 저장/송고 시도 동작은 기존
  SPEC-EDIT-LOCK-001 의미론(잠금 상실 ⇒ `lock-required` 거부)이 이미 정의한 결과를 그대로 따르며 새 동작을
  발명하지 않는다. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-012 |
| 제목 | list.do 컨텍스트 메뉴 "Lock해제" — 편집 잠금 강제 해제 |
| 상태 | Plan |
| 생성일 | 2026-06-10 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-EDIT-LOCK-001, SPEC-NEWS-REVISE-002/007/008, SPEC-AUTH-001, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001 |
| 영향 페이지 | `list.do` (기사 조회 — 우클릭 컨텍스트 메뉴) |
| 영향 레이어 | 프론트(컨텍스트 메뉴/모델 컨트랙트) · HTTP 라우트(신규 강제 해제 경로 + 서버 권한 가드) · 백엔드 서비스(강제 해제 메서드) |
| Source of truth | 사용자 직접 요청(2026-06-10) + 도메인 결정(2026-06-10 승인). news.md 에는 미수록(후속 반영 권장) |
| 작업 모드 | Brownfield 확장 (Δ-only). 프론트 메뉴 게이트 + 신규 서버 강제 해제 경로 |
| 인코딩 | UTF-8 (CLAUDE.md HARD) |

---

## 1. 목적 (Goal)

기사 조회페이지(`list.do`)의 우클릭 컨텍스트 메뉴에서, **편집 잠금이 걸린(LockYN='Y') 기사**에 대해 데스크/관리자가
잠금을 **강제로 해제**(LockYN='N')할 수 있는 운영 도구를 추가한다. 현재 편집 잠금은 보유자 본인(또는 30분 stale
TTL 경과)만 해제 가능하므로(SPEC-EDIT-LOCK-001 / SPEC-NEWS-REVISE-002), 편집자가 비정상 종료하거나 자리를 비운
사이 30분 동안 다른 데스크원이 그 기사를 편집할 수 없는 운영 공백이 발생한다. 본 기능은 그 공백을 권한자(D/Z)의
명시적 조작으로 즉시 회복한다.

`why`: CLAUDE.md 최상위 비협상 규칙은 "안전성·데이터 무결성 우선"이다. 강제 해제는 동시편집 충돌 방지(잠금)의
**의도적 예외**이므로, (a) 프론트 게이트만으로는 우회 가능한 보안 결함이 되어 **서버 권한 가드가 필수**이고,
(b) 잠금 자체를 빼앗아 다른 사람이 즉시 편집하게 만드는 것이 본질이므로 "타인 잠금도 해제 가능"해야 한다.
정합 명세 없이 구현하면 (a) 프론트 전용 게이트로 인한 권한 우회, (b) 기존 보유자-한정 해제 계약(AC-RLE-2 도둑질
금지)과의 모순, (c) LockYN 컬럼/SSE 재조회 회귀를 일으킨다. 본 SPEC 은 이를 EARS 로 고정한다.

본 SPEC 은 기존 SPEC(EDIT-LOCK-001, NEWS-REVISE-002/007/008, AUTH-001, BACKEND-CORE-001, FRONTEND-UI-001)
계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다.

---

## 2. 도메인 용어 및 현재 구현 사실 (Glossary / Brownfield 기준점)

> 직접 Read 로 검증한 현재 상태(2026-06-10).

- **편집 잠금 컬럼(실제 코드 명칭)**: 런타임 코드는 `lockYN` / `lockerUserId` / `lockerSessionId` / `lockedAt`
  (소문자)를 사용한다(`src/services/articleService.js`, `src/models/articleModel.js`). 목록 API 는
  `c.lockYN AS lockYN` 로 별칭해 반환하며, 프론트는 `article.lockYN` 로 읽는다
  (`web/src/view/ViewPage.jsx:129`). **SPEC-EDIT-LOCK-001 문서의 `LockYN`/`LockedBySessionId`/`LockedAt`
  표기는 문서 드리프트이며, 본 SPEC 과 Run 은 실제 코드 명칭(소문자)을 정본으로 사용한다.**
- **보유자-한정 해제(현행)**: `articleService.releaseEditLock(articleId, {userId, sessionId})` 는 호출자가
  잠금 보유자일 때만 해제하고, 비보유자는 `{ok:false, reason:'not-holder'}` 로 상태 불변(도둑질 금지,
  SPEC-EDIT-LOCK-001 AC-RLE-2). HTTP `POST /api/articles/:id/unlock` 가 이를 노출한다.
  ⇒ **현행 해제 경로로는 타인 잠금을 강제 해제할 수 없다.** 강제 해제는 신규 서비스 메서드 + 신규 라우트가 필요하다.
- **컨텍스트 메뉴(현행)**: `web/src/view/ViewPage.jsx` `buildContextItems({article, menu, role, navigate})` 가
  메뉴별 항목 배열을 만든다. 비허용 항목은 **숨기지 않고 비활성**으로 둔다 — `dpsEditItem(label)` 은
  권한 미달 시 `{ label, ...DISABLED }`(즉 `{disabled:true}`) 를 반환하고, `ContextMenu.jsx` 가 비활성 버튼에
  "(준비중)" 힌트를 렌더한다(`ViewPage.jsx:35,52-55`, `ContextMenu.jsx:51-67`). 메뉴 컨테이너는
  `role="menu"` + `aria-label="기사 메뉴"`(`ContextMenu.jsx:47`).
- **권한 매트릭스**: 고침/포털고침은 `DPS + D 전용`(R·Z 모두 비활성, `ViewPage.jsx:52`). 단 본 기능의 도메인
  결정은 그와 달리 **D/Z 활성, R 비활성**(Z=D-mirror, news.md L62 / moai-domain-news-editor §2.1).
- **LockYN 전파/실시간**: 잠금 변동 시 서버가 SSE `change` 이벤트를 발행하면 열려 있는 list.do 가 자기 필터로
  재조회한다. 기존 acquire/release 는 `bus.emit('change', { type: 'lock'|'unlock', articleId })` 를 발행한다
  (`server/index.js:325,353`). SSE 의 LockYN 컬럼 재조회는 SPEC-NEWS-REVISE-008 회귀 가드 대상이다.
- **서버 권한 가드 패턴(현행)**: lock/unlock 라우트는 `401(미인증) → 403(R/D/Z 아님) → 404(기사 없음) → 처리`
  순서를 적용하고, 역할은 `sessionService.touchSession(sessionIdOf(req)).role` 에서만 도출한다(body.role 불신,
  `server/index.js:289-356`).

---

## 3. 범위 (Scope)

### 3.1 포함 (In Scope)

- **컨텍스트 메뉴 "Lock해제" 항목**: list.do 우클릭 컨텍스트 메뉴에 추가한다. **노출 조건 = 해당 행의
  `article.lockYN === 'Y'`** (잠금 없는 행에는 항목 자체를 추가하지 않는다 — 데이터-주도 노출). 결정 근거: §3.3.
- **권한 게이트(프론트)**: D/Z 는 활성, R 은 **표시하되 비활성**(기존 비허용 항목 show-but-disabled 패턴 일관).
  Z=D-mirror.
- **서버 권한 가드(필수)**: 신규 강제 해제 라우트는 프론트와 무관하게 `401 → 403(R/Z 가 아닌 역할은 거부;
  본 작업의 허용 역할은 D/Z) → 404 → 강제 해제` 순서로 서버에서 권한을 재검증한다. 프론트만 막으면 보안 결함.
- **강제 해제 동작**: 클릭 → 서버가 보유자 여부와 무관하게(타인 잠금 포함) 해당 기사의 `lockYN='N',
  lockerUserId=NULL, lockerSessionId=NULL, lockedAt=NULL` 로 설정 → `{ok:true}` 반환.
- **LockYN 반영/전파**: 강제 해제 성공 시 서버가 기존 SSE 경로(`bus.emit('change', { type:'unlock'|'lock-release',
  articleId })`)로 변동을 발행하여 열려 있는 list.do 가 자동 재조회되어 LockYN 컬럼이 'N' 으로 갱신된다
  (SPEC-NEWS-REVISE-008 SSE 재조회 경로 재사용 — 새 실시간 메커니즘 도입 금지).
- **자기 세션 아닌 타인 잠금도 해제 가능**: 강제 해제의 본질이므로 보유자-검사 없이 해제한다(기존 conditional
  release 와 의도적으로 구분되는 신규 경로).
- 프론트 모델 컨트랙트에 강제 해제 호출(예: `forceUnlockArticle(articleId)`) 추가 + `fakeModel` 기본 구현.

### 3.2 정합 노트 — 강제 해제 후 원 편집자 동작 (새 동작 발명 금지)

강제 해제로 잠금을 잃은 원 편집자가 이후 저장(PUT)·송고/보류/KILL(action) 을 시도할 때의 동작은 **본 SPEC 이
새로 정의하지 않는다.** 기존 SPEC-EDIT-LOCK-001 의미론이 이미 정의한 결과를 그대로 따른다:

- PUT `/api/articles/:id`: `assertLockHolder` 가 보유자 불일치(또는 lockYN='N')를 감지해
  `{ok:false, reason:'lock-required'}` 로 거부하고 상태 불변(`server/index.js:269-275`,
  `src/services/articleService.js:168-189`).
- action `/api/articles/:id/action`: `applyAction` 의 잠금 가드가 `!stale && !isHolder` 일 때
  `{ok:false, reason:'lock-required'}` 로 거부(`src/services/articleService.js:206-217`).

본 SPEC 은 위 동작을 **정합 노트로만 기술**하며, 코드를 변경하지 않는다(REQ-FORCE-RELEASE-CONSISTENCY 참조).

### 3.3 핵심 설계 결정 — 노출(조건부 추가) vs 비활성

- **잠금 유무에 따른 메뉴 항목**: **조건부 추가**(LockYN='Y' 일 때만 항목을 배열에 넣음). 근거: "Lock해제"는
  잠금이 없는 행에서는 의미가 없고 오해를 부른다. 기존 메뉴는 *권한* 미달을 비활성으로 표현하지만(항목은 상존),
  *상태/데이터* 부적합(예: 데스크 미송고 메뉴에 부서별 송고 전용 항목 미추가)은 **항목 자체를 넣지 않는** 패턴을
  이미 쓴다(`buildContextItems` 가 메뉴별로 다른 배열을 반환). LockYN 은 행별 데이터 상태이므로 후자(조건부
  추가)가 일관적이다.
- **권한에 따른 활성/비활성**: **show-but-disabled**(R 은 항목을 보되 비활성). 근거: 기존 고침/포털고침의 권한
  게이팅과 동일한 UX 패턴(`dpsEditItem` 의 `{...DISABLED}`). 단, 허용 역할 집합만 D/Z(Z=D-mirror)로 다르다.
  ⇒ 결과적으로 LockYN='Y' 인 행에서: D/Z → 활성 "Lock해제", R → 비활성 "Lock해제(준비중)". LockYN='N' 인
  행에서는 어떤 역할에도 항목 미노출.

### 3.4 제외 (Out of Scope) — §9 Exclusions 참조

---

## 4. 사용자 시나리오 (User Scenarios)

### 4.1 D/Z 권한 강제 해제 (정상 경로)

- D(또는 Z) 권한 사용자가 list.do 에서 LockYN='Y' 인 기사 행을 우클릭한다.
- 컨텍스트 메뉴에 활성 "Lock해제" 항목이 보인다.
- "Lock해제"를 누르면 서버가 강제 해제하여 그 기사의 LockYN 이 'N' 이 된다.
- SSE `change` 이벤트로 열려 있는 list.do 가 재조회되어 LockYN 컬럼이 'N' 으로 갱신된다.

### 4.2 R 권한 (메뉴 비활성)

- R 권한 사용자가 같은 LockYN='Y' 행을 우클릭하면 "Lock해제" 항목이 **비활성**으로 보이고(준비중 힌트),
  클릭해도 아무 일도 일어나지 않는다(서버 호출 없음).

### 4.3 서버 권한 가드 (프론트 우회 방지)

- 임의 클라이언트가 R 세션(또는 미인증)으로 강제 해제 라우트를 직접 호출하면, 서버가 403(또는 401)로 거부하고
  LockYN 상태를 변경하지 않는다.

### 4.4 LockYN='N' 행 (항목 미노출)

- 어떤 역할이든 LockYN='N' 인 행을 우클릭하면 "Lock해제" 항목 자체가 메뉴에 없다.

### 4.5 강제 해제 후 원 편집자 (기존 의미론)

- 원 편집자가 강제 해제된 기사에서 저장/송고를 시도하면 기존 SPEC-EDIT-LOCK-001 의미론에 따라
  `lock-required` 로 거부된다(본 SPEC 은 이 동작을 변경하지 않음).

---

## 5. 요구사항 (Requirements — EARS)

> 각 AC 는 acceptance.md 에 Given-When-Then 으로 상술된다. 실제 테스트 레이아웃: 프론트
> `web/src/view/*.test.jsx`(`npm run test:web`), 백엔드 `test/*.test.js`(`npm test`).

### REQ-FORCE-UNLOCK-MENU — 컨텍스트 메뉴 "Lock해제" 노출·게이팅 (Priority: High)

#### EARS 문장

- **[State-Driven]** WHILE list.do 의 어떤 행의 `article.lockYN === 'Y'` 이면, THE 시스템 SHALL 그 행의
  우클릭 컨텍스트 메뉴에 "Lock해제" 항목을 노출한다.
- **[Unwanted]** IF 행의 `article.lockYN` 이 'Y' 가 아니면(미설정/'N'), THEN THE 시스템 SHALL 그 행의
  컨텍스트 메뉴에 "Lock해제" 항목을 추가하지 아니한다(항목 자체 미노출).
- **[State-Driven]** WHILE 사용자 권한이 `D` 또는 `Z` 이고 행이 LockYN='Y' 인 동안, THE 시스템 SHALL
  "Lock해제" 항목을 **활성(클릭 가능)** 으로 렌더한다.
- **[Unwanted]** IF 사용자 권한이 `R` 이고 행이 LockYN='Y' 이면, THEN THE 시스템 SHALL "Lock해제" 항목을
  **표시하되 비활성** 으로 렌더하고(기존 비허용 항목 show-but-disabled 패턴), 클릭 시 어떤 서버 호출도 하지
  아니한다.
- **[Event-Driven]** WHEN D/Z 사용자가 활성 "Lock해제" 항목을 클릭하면, THE 시스템 SHALL 해당 기사 id 로
  강제 해제 모델 호출(`forceUnlockArticle(articleId)`)을 1회 수행하고 컨텍스트 메뉴를 닫는다.

#### Acceptance Criteria 포인터

- AC-MENU-1 (LockYN='Y' → 항목 노출), AC-MENU-2 (LockYN!='Y' → 항목 미노출), AC-MENU-3 (D/Z 활성),
  AC-MENU-4 (R 비활성 + 클릭 무동작), AC-MENU-5 (활성 클릭 → forceUnlock 호출 + 메뉴 닫힘) — acceptance.md §1

---

### REQ-FORCE-UNLOCK-SERVER — 서버 강제 해제 라우트 + 권한 가드 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 인증된 `D` 또는 `Z` 세션이 강제 해제 라우트(`POST /api/articles/:id/force-unlock`)
  를 호출하면, THE 시스템 SHALL 대상 기사의 잠금을 **보유자 여부와 무관하게** 해제하여
  `lockYN='N', lockerUserId=NULL, lockerSessionId=NULL, lockedAt=NULL` 로 설정하고 `{ok:true}` 를 반환한다.
- **[Unwanted]** IF 요청이 미인증(유효 세션 없음)이면, THEN THE 시스템 SHALL **강제 해제 시도 이전에** HTTP
  401 `{ok:false, reason:'unauthenticated'}` 를 반환하고 잠금 상태를 변경하지 아니한다(401 우선).
- **[Unwanted]** IF 인증되었으나 역할이 `D`/`Z` 가 아니면(예: `R`), THEN THE 시스템 SHALL HTTP 403
  `{ok:false, reason:'forbidden'}` 를 반환하고 잠금 상태를 변경하지 아니한다.
- **[Unwanted]** IF 인증·인가를 통과했으나 대상 기사가 존재하지 않으면, THEN THE 시스템 SHALL HTTP 404
  `{ok:false, reason:'not-found'}` 를 반환한다.
- **[Ubiquitous]** THE 시스템 SHALL 역할을 검증된 세션(`x-session-id` → `touchSession`)에서만 도출하며,
  요청 본문(body.role)으로 결정하지 아니한다.
- **[Event-Driven]** WHEN 강제 해제가 성공하면, THE 시스템 SHALL 기존 SSE 경로로 잠금 변동 `change` 이벤트를
  발행하여 열려 있는 조회 뷰가 자기 필터로 재조회하도록 한다(새 실시간 메커니즘 도입 금지).
- **[Unwanted]** THE 시스템 SHALL NOT 강제 해제 응답 본문에 직전 보유자 식별자(`lockerSessionId`/
  `lockerUserId`)를 노출하지 아니한다(정보 누출 방지, 기존 409 holder 비노출 원칙과 일관).

#### Acceptance Criteria 포인터

- AC-SRV-1 (D/Z 강제 해제 200 + LockYN='N'), AC-SRV-2 (타인 잠금도 해제), AC-SRV-3 (미인증 401 우선 + 불변),
  AC-SRV-4 (R 403 + 불변), AC-SRV-5 (없는 기사 404), AC-SRV-6 (body.role 무시 — 세션 역할로만 구동),
  AC-SRV-7 (성공 시 SSE change 발행), AC-SRV-8 (보유자 식별자 비노출) — acceptance.md §2

---

### REQ-FORCE-UNLOCK-CONSISTENCY — 강제 해제 후 기존 잠금 의미론 정합 (Priority: Medium)

#### EARS 문장

- **[State-Driven]** WHILE 어떤 기사가 강제 해제되어 `lockYN='N'` 인 동안, THE 시스템 SHALL 다른 세션이
  그 기사를 정상 편집 진입(`acquireEditLock`)할 수 있도록 허용한다(자유 잠금으로 취급 — 기존 acquire 경로 불변).
- **[Unwanted]** IF 강제 해제 후 **다른 세션이 그 기사의 잠금을 재획득**(`lockYN='Y'`, holder=타 세션)한
  상태에서 원 편집자가 저장(PUT) 또는 액션(send/hold/kill)을 시도하면, THEN THE 시스템 SHALL 기존
  SPEC-EDIT-LOCK-001 의미론에 따라 `{ok:false, reason:'lock-required'}` 로 거부하고 기사 상태를 변경하지
  아니한다(본 SPEC 은 이 동작을 **변경하지 않으며** 정합 노트로만 기술).
- **[Unwanted]** THE 시스템 SHALL NOT 강제 해제 경로를 위해 기존 보유자-한정 해제(`releaseEditLock`,
  `POST /unlock`)의 계약(비보유자 no-op, AC-RLE-2 도둑질 금지)을 변경하지 아니한다(강제 해제는 별도 경로로 추가).

> **[정합 노트 — 기존 의미론, 변경 금지]** `applyAction` 의 락 가드는 `current.lockYN === 'Y'` 일 때만
> 발동한다(`src/services/articleService.js:206`). 따라서 강제 해제 직후 **맨 `lockYN='N'` 상태**에서 원
> 편집자가 곧장 `applyAction(send/hold/kill)` 하면 가드를 통과하여 `{ok:true}` 가 되는 것이 **기존 SPEC-EDIT-
> LOCK-001 의미론**이며 본 SPEC 은 이를 **변경하지 않는다**(§3.2 "코드 변경 금지"). 원 편집자가 `lock-required`
> 로 막히는 것은 **다른 세션이 재획득해 다시 `lockYN='Y'` 가 된 이후**에만 성립하며, 그것이 강제 해제의 실사용
> 시나리오다(자리를 비운 편집자의 잠금을 회수해 다른 데스크원이 편집 → 원 편집자는 비보유자로 막힘). 한편 PUT
> 경로(`assertLockHolder`, `src/services/articleService.js:177`)는 `lockYN='N'` 시점에도 `lock-required` 를
> 반환하므로 두 경로의 가드 발동 조건 차이는 기존 코드 사실이다. AC-CON-2 는 재획득 이후 시점을 검증한다.

#### Acceptance Criteria 포인터

- AC-CON-1 (강제 해제 후 타 세션 재획득 가능), AC-CON-2 (재획득된 잠금에서 원 편집자 PUT/action lock-required —
  기존 의미론 회귀; 맨 'N' 상태 통과는 변경 안 함 정합 노트 포함), AC-CON-3 (기존 보유자-한정 unlock 계약 불변)
  — acceptance.md §3

---

### REQ-REGRESSION-GUARD — 잠금/메뉴/SSE 회귀 가드 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL SPEC-EDIT-LOCK-001 / SPEC-NEWS-REVISE-002 의 acquire/release/멱등
  재획득/30분 stale/홀더 비노출(409) 계약을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-008 의 SSE `type:'lock'` 재조회 및 데스크 미송고
  LockYN 컬럼(8컬럼) 표시를 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL 기존 컨텍스트 메뉴 항목 세트(데스크 미송고: 편집/상세보기/이력보기/
  본문복사/제목만복사; 부서별 송고: 편집 + 고침/포털고침 D-only; 닫힘 동작 Escape/외부클릭)를 회귀 없이 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본 SPEC 으로 인해 새 락 스토어/세션 메커니즘/실시간 채널/디자인 토큰을
  도입하지 아니한다.

#### Acceptance Criteria 포인터

- AC-REG-1 (잠금 계약 회귀), AC-REG-2 (SSE/LockYN 컬럼 회귀), AC-REG-3 (기존 메뉴 항목/닫힘 회귀) — acceptance.md §4

---

## 6. 비기능 요건 (Non-Functional Requirements)

### 6.1 보안 / 데이터 무결성

- **[HARD] 서버 권한 가드 필수** — 강제 해제는 프론트 게이트와 독립적으로 서버에서 `401 → 403(D/Z 아님) → 404`
  순서로 권한을 재검증한다. 프론트만 막는 구현은 보안 결함으로 간주한다(REQ-FORCE-UNLOCK-SERVER).
- 역할은 검증된 세션에서만 도출(body.role 불신).
- 강제 해제 응답에 직전 보유자 식별자를 노출하지 않는다(기존 409 holder 비노출 원칙 일관).
- 강제 해제는 잠금 컬럼만 NULL/'N' 으로 변경할 뿐 **기사 본문/상태/DB 행을 삭제하지 않는다**(CLAUDE.md
  "DB 내용 삭제 금지" HARD).
- 강제 해제는 의도적 예외이며, 기존 "비보유자는 잠금을 빼앗을 수 없다"(AC-RLE-2)는 **보유자-한정 경로에서는
  불변**으로 유지된다 — 강제 해제는 D/Z 권한 게이트가 붙은 **별도 경로**로만 가능하다.

### 6.2 시간 의존 로직 (now 주입 NFR)

- **[HARD] now 주입** — 강제 해제 라우트/서비스가 잠금의 stale 판정을 참조하는 경우(또는 acquire 의 30분
  stale 와 상호작용하는 회귀 테스트), 테스트는 반드시 `now`(및 필요 시 `timeoutMs`)를 주입해 결정적으로
  검증한다. 강제 해제 자체는 보유자/stale 여부와 무관하게 해제하지만, **AC-CON-1(강제 해제 후 타 세션 재획득)**
  과 **AC-CON-2(원 편집자 lock-required)** 회귀 검증은 acquire/assertLockHolder 의 시각 비교 경로를 타므로
  실시간 대기 없이 `now` 고정 전달이 필수다(30분 stale 시한폭탄 방지).

### 6.3 LockYN 전파 / 실시간

- 강제 해제 후 LockYN='N' 전파는 **기존 SSE `change` 경로 재사용**으로만 수행한다(폴링/타이머/신규 채널 금지).
  열려 있는 list.do 는 자기 필터로 재조회하여 LockYN 컬럼을 갱신한다(SPEC-NEWS-REVISE-008 경로).

### 6.4 디자인 토큰 / 접근성

- 신규 CSS 변수/버튼 스타일 도입 없음. "Lock해제" 항목은 기존 `ContextMenu` 항목 마크업(`role="menuitem"`,
  비활성 시 "(준비중)" 힌트)을 그대로 재사용한다.
- 메뉴 컨테이너 `role="menu"` `aria-label="기사 메뉴"` 불변.

### 6.5 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD).

### 6.6 회귀 방지

- SPEC-EDIT-LOCK-001 / NEWS-REVISE-002 잠금 계약, NEWS-REVISE-007 컨텍스트 메뉴 포워딩, NEWS-REVISE-008
  SSE/LockYN 컬럼, AUTH-001 R/D/Z 권한 의미를 모두 회귀 없이 유지한다.

---

## 7. 영향 영역 (Affected Files)

- `web/src/view/ViewPage.jsx` — `buildContextItems` 에 LockYN='Y' 조건부 "Lock해제" 항목 추가(D/Z 활성, R 비활성).
- `web/src/model/contract.js` — `forceUnlockArticle(articleId)` 컨트랙트 추가(MODEL_KEYS + 주석).
- `web/src/model/httpModel.js` — `forceUnlockArticle` 구현(`POST /api/articles/:id/force-unlock`).
- `web/src/test/fakeModel.js` — `forceUnlockArticle` 기본 구현(테스트 기본 통과용).
- `server/index.js` — `POST /api/articles/:id/force-unlock` 라우트(401→403(D/Z)→404→강제 해제 + SSE 발행).
- `src/services/articleService.js` — `forceReleaseEditLock(articleId)` 신규 서비스 메서드(보유자 무관 해제).
- `src/controllers/index.js` — `article.forceReleaseEditLock` 와이어링.
- 테스트: 프론트 `web/src/view/ViewPage.contextMenu.test.jsx`(또는 신규 `ViewPage.forceUnlock.test.jsx`);
  백엔드 `test/serverAuthWiring.test.js`(라우트 권한 가드) + `test/articleService.test.js`(서비스 강제 해제) +
  `test/integration.lockLifecycle.test.js`(강제 해제 후 재획득/원 편집자 lock-required 정합).

---

## 8. 종속성 및 Cross-References

> 아래 SPEC 들은 **참조 전용** — 본 SPEC 은 이들을 수정하지 않는다.

- **SPEC-EDIT-LOCK-001**: 편집 잠금 의미론(획득/해제 4시점, 30분 stale TTL reclaim-on-acquire, lockYN,
  보유자-한정 해제, holder=세션). 본 SPEC 은 그 위에 **D/Z 권한 강제 해제**를 별도 경로로 추가하며, 보유자-한정
  해제 계약은 불변으로 둔다.
- **SPEC-NEWS-REVISE-002**: lockYN 락 계약(acquire/release/sendBeacon, same-session 멱등, 타 세션 'locked').
  본 SPEC 은 이 계약을 회귀 없이 유지한다.
- **SPEC-NEWS-REVISE-008**: SSE `type:'lock'` 재조회 + 데스크 미송고 LockYN 컬럼 회귀 가드. 본 SPEC 은 강제
  해제 전파에 이 SSE 경로를 재사용한다.
- **SPEC-NEWS-REVISE-007**: list.do 컨텍스트 메뉴 편집/고침/포털고침 포워딩. 본 SPEC 은 그 메뉴에 항목을
  1개 추가하되 기존 항목/게이팅을 회귀 없이 유지한다.
- **SPEC-AUTH-001**: R/D/Z 권한 의미 + 세션 발급·검증. 본 SPEC 의 D/Z 허용·R 거부가 이를 따른다.
- **SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001**: 기사 CRUD·라우팅·작성 페이지 구조. 본 SPEC 은 침범하지 않는다.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- **잠금을 빼앗긴 편집자 화면의 실시간 알림/축출 UX** — 강제 해제 당한 원 편집자에게 "잠금이 해제되었습니다"
  토스트/모달/강제 라우팅 등을 만들지 않는다(별도 SPEC). 원 편집자는 다음 저장/송고 시도에서 기존 의미론대로
  `lock-required` 거부를 받을 뿐이다.
- **잠금 이력 / 감사 로그(audit log)** — 누가 누구의 잠금을 언제 강제 해제했는지 기록·조회 기능을 만들지 않는다.
- **30분 stale TTL 변경** — `EDIT_LOCK_TIMEOUT_MS`(30분) 값/판정 로직을 변경하지 않는다.
- **WritePage(writer.do)의 잠금 의미론 변경** — 작성 페이지의 acquire/release/탭 생존 유지 동작을 변경하지 않는다.
- **기존 보유자-한정 해제 계약 변경** — `releaseEditLock`/`POST /unlock` 의 비보유자 no-op(도둑질 금지)을
  변경하지 않는다. 강제 해제는 신규 경로로만 추가한다.
- **새 락 스토어/세션 메커니즘/실시간 채널/폴링/타이머/디자인 토큰** 도입 금지.
- **DB 스키마 변경 / DB 내용 삭제** — 기존 lockYN/lockerUserId/lockerSessionId/lockedAt 컬럼만 사용하며
  컬럼 추가·변경·행 삭제 없음(CLAUDE.md HARD).
- **news.md 수정** — 본 SPEC/Run 은 news.md 를 수정하지 않는다(구현 완료 후 오케스트레이터가 후속 반영 권장).
- **수집/배부 시스템** — 기사 작성기 범위만(CLAUDE.md "현재 구현 범위는 기사 작성기·자동기사").
- **타 SPEC 의 3파일(spec/plan/acceptance) 수정** — 참조만 한다.
- **코드 구현** — 본 SPEC 은 Plan 단계 문서만. Run 단계에서 구현.

---

## 10. Definition of Done

- [ ] LockYN='Y' 행 우클릭 시 "Lock해제" 항목 노출 (AC-MENU-1)
- [ ] LockYN!='Y' 행에는 "Lock해제" 항목 미노출 (AC-MENU-2)
- [ ] D/Z 권한 활성, R 권한 비활성 + 클릭 무동작 (AC-MENU-3, AC-MENU-4)
- [ ] 활성 클릭 → `forceUnlockArticle(articleId)` 1회 호출 + 메뉴 닫힘 (AC-MENU-5)
- [ ] 서버 강제 해제 라우트 D/Z 200 + LockYN='N' (AC-SRV-1), 타인 잠금도 해제 (AC-SRV-2)
- [ ] 서버 가드: 미인증 401 우선 + 불변 (AC-SRV-3), R 403 + 불변 (AC-SRV-4), 없는 기사 404 (AC-SRV-5)
- [ ] body.role 무시 — 세션 역할로만 구동 (AC-SRV-6)
- [ ] 성공 시 SSE `change` 발행 (AC-SRV-7), 보유자 식별자 비노출 (AC-SRV-8)
- [ ] 강제 해제 후 타 세션 재획득 가능 (AC-CON-1) — now 고정 전달
- [ ] 원 편집자 PUT/action `lock-required` 기존 의미론 회귀 확인 (AC-CON-2) — now 고정 전달
- [ ] 기존 보유자-한정 unlock 계약 불변 (AC-CON-3)
- [ ] 잠금 계약/SSE/LockYN 컬럼/기존 메뉴 회귀 없음 (AC-REG-1, 2, 3)
- [ ] 신규 토큰/실시간 채널/락 스토어 미도입
- [ ] `npm test`(backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web`(vitest) 전체 GREEN
- [ ] `npm run build`(vite) 무경고
- [ ] lock 관련 테스트는 now 고정 전달(30분 stale 시한폭탄 방지)
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.1 / Plan)
- [ ] `news.md` 미변경 확인(구현 완료 후 오케스트레이터가 별도 반영 권장)
- [ ] 기존 SPEC(EDIT-LOCK-001, NEWS-REVISE-002/007/008, AUTH-001, BACKEND-CORE-001, FRONTEND-UI-001) 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD; 토큰 미설정 시 로컬 로그 폴백 — "전송됨" 단정 금지)

---

Version: 0.1.1
Status: Plan
Last Updated: 2026-06-10
