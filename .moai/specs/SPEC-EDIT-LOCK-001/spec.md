---
id: SPEC-EDIT-LOCK-001
version: 0.2.0
status: draft
created: 2026-06-03
updated: 2026-06-03
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-DB-FOUNDATION-001
  - SPEC-AUTH-001
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-NEWS-REVISE-001
---

# SPEC-EDIT-LOCK-001 — 기사 편집 잠금 (LockYN) 동시성 제어 특성화 명세

## HISTORY

- 2026-06-03 (v0.2.0): **범위 확장 — 서버측 지연(lazy) 잠금 만료(TTL) 도입.** 사용자 승인 하에 PD-1(잠금
  TTL/만료)을 **"지금 추가"** 로 확정하고, 그 결과로 PD-2(`LockedAt` 용도)를 함께 해소한다. 메커니즘은
  **active background sweep가 아니라 획득 시점 지연 만료(reclaim-on-acquire)** 다 — 기존 단일 원자적
  조건부 UPDATE(`src/models/articleModel.js:84-99`)의 WHERE 절에 `LockedAt < ?staleThreshold` 분기만
  추가하여, 스테일 잠금을 획득 트랜잭션 내에서 그대로 재선점한다(타이머/스케줄러/백그라운드 프로세스 없음 —
  node:sqlite 단일 프로세스 동기 모델에 부합). TTL 기본값은 **30분**(`EDIT_LOCK_TTL_MS = 30*60*1000`,
  구성 가능). `LockedAt`은 더 이상 audit-only가 아니라 **만료 판단의 단일 입력**이 된다. 이 만료 동작은
  **[NEW] 타깃 동작(테스트 미존재)** 이며 run 단계에서 TDD(RED→GREEN→REFACTOR)로 구현한다 — 기존
  특성화 AC([EXISTING])와 명확히 구분된다. REQ 모듈 수는 **정확히 5개 유지**(TTL은 REQ-LOCK-ACQUIRE에
  편입, 신규 6번째 REQ 생성하지 않음). PD-3/PD-4는 사용자 선택(나머지는 현행 유지)에 따라 **"확정: 현행
  유지"** 로 전환한다. (manager-spec)
- 2026-06-03 (v0.1.0): 최초 작성. **이미 구현·테스트가 GREEN인** 기사 편집 잠금(LockYN) 기능을
  앵커링 SPEC 부재 상태에서 **사후 특성화(brownfield Δ / characterization)** 로 정식화한다. 신규 동작을
  발명하지 않고 현 계약(DB `Contents.LockYN`/`LockedBySessionId`/`LockedAt`, 백엔드
  `acquireEditLock`/`releaseEditLock`/`applyAction` auto-release, HTTP `POST /lock`·`/unlock`,
  프론트 `useWriteController` lock effect)을 EARS로 고정한다. `news.md` ~141-142가 침묵·모호한 지점은
  **Pending Decisions**로 표면화하고 본 SPEC 내에서 임의로 해소하지 않는다.
  기존 SPEC-DB-FOUNDATION-001 / SPEC-AUTH-001 / SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001 /
  SPEC-NEWS-REVISE-001 은 참조만 하며 침범하지 않는다. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-EDIT-LOCK-001 |
| 제목 | 기사 편집 잠금 (LockYN) 동시성 제어 특성화 명세 |
| 상태 | draft |
| 생성일 | 2026-06-03 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-DB-FOUNDATION-001, SPEC-AUTH-001, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001, SPEC-NEWS-REVISE-001 |
| Source of truth | `news.md` ~141-142 (편집/고침/포털고침 진입 시 LockYN=Y, 최초 세션만 편집, 편집 종료 시 N) |
| 영향 레이어 | DB(`Contents`) · 백엔드 서비스/모델 · HTTP 라우트 · 프론트엔드 작성 페이지 컨트롤러 |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` development_mode=tdd, coverage 85% / per-commit 80%) |
| 작업 모드 | Brownfield 특성화 (기존 잠금 동작은 Δ-only [EXISTING]) **+ 신규 TTL 만료 [NEW]** (v0.2.0, TDD RED→GREEN) |

---

## 1. 목적 (Goal)

이미 DB·백엔드·프론트엔드 전 계층에 구현되어 있고 포괄적 테스트가 모두 GREEN인 **기사 편집 잠금
(LockYN) 동시성 제어** 기능을, 이를 정의하는 앵커링 SPEC이 없는 품질-추적 공백을 메우기 위해 **현
계약 그대로** EARS 형식으로 정식화한다.

`news.md` ~141-142:
> "편집, 고침, 포털고침을 눌러 기사 편집화면에 들어가면 해당 기사는 LockYN 값이 Y가 된다. 최초
> 편집화면에 들어간 사용자 세션 외에는 중복 편집 할 수 없다. 편집이 끝나면 LockYN은 N이 되고,
> 편집가능한 상태이다."

`why`: CLAUDE.md의 최상위 비협상 규칙은 "안전성과 데이터 무결성을 기능 속도보다 우선" 이며, 본 기능은
동시 편집 충돌(lost update)을 막는 데이터-무결성 핵심 장치다. 그럼에도 이를 정의·추적하는 SPEC이
없어 회귀가 발생해도 어떤 계약을 위반했는지 추적할 수 없다. 본 SPEC은 그 계약을 EARS + Acceptance
Criteria로 고정하여, (a) 기존 테스트를 특성화/회귀 가드로 명문화하고 (b) 향후 변경 시 위반 지점을
추적 가능하게 한다.

v0.1.0은 **새 동작을 도입하지 않았다** — 모든 REQ/AC가 현 구현과 현 테스트가 이미 만족하는 관찰 가능
동작을 기술했다(특성화 [EXISTING]).

**v0.2.0 변경**: 사용자 승인으로 PD-1(잠금 TTL/만료)을 채택하여 **단 하나의 신규 동작 — 지연(lazy)
잠금 만료(reclaim-on-acquire)** 를 추가한다. 이는 데이터-무결성 비협상 규칙의 약점이던 orphaned lock
(세션이 무효화될 때까지 정당 사용자의 편집을 영구 차단)을 해소한다. 신규 동작은 REQ-LOCK-ACQUIRE에
편입되며(신규 6번째 REQ를 만들지 않는다), 대응 AC(AC-TTL-1~4)는 **아직 테스트가 존재하지 않는 [NEW]
타깃 동작**으로 run 단계에서 TDD(RED 먼저)로 구현한다. 기존 [EXISTING] 특성화 AC는 그대로 회귀 가드로
유지된다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

#### [EXISTING] — 구현·테스트 완료 (특성화)

- DB `Contents` 테이블 잠금 컬럼 3종(`LockYN`/`LockedBySessionId`/`LockedAt`)과 멱등 마이그레이션
  (`ensureContentsLockColumns`)의 계약 명문화 — `src/db/schema.js:65-67,101-112`.
- 백엔드 편집 잠금 획득/해제 서비스 계약 (`acquireEditLock`/`releaseEditLock`) 및 모델의 원자적
  check-and-set / 조건부 해제 — `src/services/articleService.js:89-106`, `src/models/articleModel.js:84-115`.
- 액션(send/hold/kill) 성공 시 무조건 잠금 해제, 무효/실패 액션 시 잠금 보존 —
  `src/services/articleService.js:65-79`.
- HTTP 잠금/해제 엔드포인트의 상태코드·페이로드·홀더 비노출·역할 게이팅·인증 우선순위 —
  `server/index.js:153-193`.
- 프론트엔드 작성 페이지의 lock-before-load, 409 차단(인라인 알림+목록 복귀), 이탈/언로드/로그아웃
  해제 순서, 액션 후 이중 해제 방지 — `web/src/controller/useWriteController.js`, `web/src/app/App.jsx:44-58`,
  `web/src/model/httpModel.js:151-178`, `web/src/model/contract.js:29-30`.
- 위 동작에 대응하는 기존 테스트(`test/articleService.test.js`, `test/serverAuthWiring.test.js`,
  `web/src/controller/useWriteController.lock.test.jsx`)를 특성화/회귀 가드로 명문화.

#### [NEW] — v0.2.0 신규 (run 단계 TDD 구현 대상)

- **지연(lazy) 잠금 만료 — reclaim-on-acquire**: 기존 단일 원자적 조건부 UPDATE
  (`src/models/articleModel.js:84-99`)의 WHERE 절에 `LockedAt < ?staleThreshold` 분기를 추가하여,
  스테일(만료) 잠금을 획득 트랜잭션 내에서 재선점한다. 백그라운드 sweep/스케줄러 없음.
- **`EDIT_LOCK_TTL_MS` 구성 상수**: 기본 `30*60*1000`(30분), 오버라이드 가능. `staleThreshold = now - EDIT_LOCK_TTL_MS`.
- **`LockedAt`을 만료 판단의 단일 입력으로 사용**(PD-2 RESOLVED) — 더 이상 audit-only가 아니다.

### 2.2 제외 (Out of Scope)

- **active background sweep / 스케줄러 기반 만료** — v0.2.0은 지연 reclaim-on-acquire만 채택(타이머/잡 신설 금지).
- **만료 알림 UX / 만료된 홀더에 대한 알림** — 스테일 홀더는 조용히 대체된다(범위 외).
- **lock-acquire 외 시점의 만료 처리** — idle 폴링·주기적 정리 등 획득 외 경로의 만료 처리 금지.
- 잠금 식별자 모델 변경(세션 → 사용자/단말 등) — 변경 금지.
- 멱등성 키(idempotency key) 도입.
- `Contents` 잠금 컬럼 외의 스키마 변경(단, TTL 비교를 위한 `LockedAt` 표현 일관화는 컬럼 추가 없이 포맷 고정 또는 epoch-ms 전환 범위).
- 역할 게이팅 의미 변경(R/D/Z 허용, 그 외 403) — 변경 금지(SPEC-AUTH-001 소관).
- 기사 생애주기 상태 전이 로직 (SPEC-BACKEND-CORE-001 소관).
- 인증/세션 발급·검증 메커니즘 (SPEC-AUTH-001 소관).
- 실시간(SSE) 잠금 알림/표시 UI.

---

## 3. 도메인 용어 (Glossary)

- **세션 (session)**: 로그인 1회당 발급되는 불투명 식별자. HTTP에서는 `x-session-id` 헤더로 전달되며,
  **사용자(userId)와 1:1이 아니다** (동일 사용자가 두 탭/기기에서 로그인하면 서로 다른 세션).
- **홀더 (holder / LockedBySessionId)**: 현재 잠금을 보유한 세션 id.
- **편집 진입 (편집/고침/포털고침)**: `news.md` 기준 편집화면 진입 트리거. 프론트에서는
  `editArticleId`가 주어진 작성 페이지 진입에 해당한다.
- **신규 초안 (fresh draft)**: `editArticleId`가 없는 신규 작성. 잠금을 획득하지 않는다.

---

## 4. 요구사항 (Requirements — EARS) — 정확히 5개 REQ 모듈

> **[EXISTING]** 표시 AC는 현 구현이 이미 만족하는(테스트 GREEN) 특성화 동작이고, **[NEW]** 표시 AC(AC-TTL-1~4)는 run 단계에서 TDD로 구현할 타깃 동작이다. 각 AC는 증거(이미 구현된 경우) 또는 구현 대상(file:line)을 명시한다.

### REQ-LOCK-ACQUIRE — 편집 진입 시 세션 단위 배타 잠금 획득 (멱등) + 지연 TTL 만료

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 기존 기사의 편집화면(편집/고침/포털고침)에 진입하면 (프론트:
  `editArticleId`가 주어진 작성 페이지 진입), THE 시스템 SHALL 해당 기사에 대해 단일 원자적
  check-and-set으로 `LockYN='Y'`, `LockedBySessionId=<진입 세션>`, `LockedAt=<획득 시각>`을 설정하고
  성공 시 `{ok:true, article}`을 반환한다.
- **[Event-Driven]** WHEN 잠금을 이미 보유한 동일 세션이 동일 기사에 대해 다시 획득을 시도하면, THE
  시스템 SHALL 그 재획득을 멱등(idempotent)하게 허용하여 `{ok:true}`를 반환하고 홀더/타임스탬프를
  교체하되 다른 세션으로 빼앗기지 않는다.
- **[Event-Driven] (v0.2.0 [NEW])** WHEN 어떤 세션이 기존 잠금의 `LockedAt`이 `now`보다
  `EDIT_LOCK_TTL_MS`(기본 30분) 이상 과거인 기사에 대해 잠금 획득을 시도하면, THE 시스템 SHALL 그 기존
  잠금을 만료(스테일)로 간주하여 동일한 원자적 UPDATE로 획득 세션에게 재선점하고
  (`LockedBySessionId=<획득 세션>`, `LockedAt=now`, `LockYN='Y'`) `{ok:true, article}`을 반환한다.
- **[State-Driven] (v0.2.0 [NEW])** WHILE 기존 잠금의 `LockedAt`이 `now`로부터 `EDIT_LOCK_TTL_MS` 이내
  (비스테일)이면, THE 시스템 SHALL 그 잠금을 계속 보유 중인 것으로 취급하여 다른 세션을 차단한다
  (REQ-LOCK-BLOCK 참조).
- **[Ubiquitous] (v0.2.0 [NEW])** THE 시스템 SHALL `LockedAt`을 만료 판단의 **단일 입력**으로 읽으며,
  이를 `now - EDIT_LOCK_TTL_MS`와 **일관되고 정렬 가능한 UTC 타임스탬프 표현**으로 비교한다 — 즉 저장·비교
  모두 동일 고정폭 UTC(Z) ISO-8601(또는 epoch-ms)이어야 한다(구현 불변식, §5.2 참조).
- **[State-Driven]** WHILE 작성 페이지가 신규 초안(`editArticleId` 부재) 상태이면, THE 시스템 SHALL
  어떤 잠금도 획득하지 아니한다 (`lockArticle` 미호출).
- **[Unwanted]** IF 획득 대상 기사가 존재하지 않으면, THEN THE 시스템 SHALL `{ok:false,reason:'not-found'}`
  를 반환하고 어떤 잠금 상태도 생성하지 아니한다.

#### Acceptance Criteria (Given-When-Then)

- **AC-ACQ-1 (자유 기사 획득 → Y/holder/timestamp)**
  - Given: `status='RDS'`이고 잠금이 없는 기사
  - When: `svc.acquireEditLock(id,'sess-A',{now})` 호출
  - Then: `{ok:true}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'`, `LockedAt='<now ISO>'`
  - 증거: `test/articleService.test.js:198-207`; 모델 `src/models/articleModel.js:84-99`; 스키마 `src/db/schema.js:65-67`

- **AC-ACQ-2 (동일 세션 재획득 멱등)**
  - Given: `sess-A`가 이미 잠금 보유
  - When: `sess-A`가 동일 기사 재획득
  - Then: `{ok:true}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 유지(빼앗김 없음)
  - 증거: `test/articleService.test.js:222-231`; HTTP 멱등 `test/serverAuthWiring.test.js:216-224`; 모델 조건절 `LockedBySessionId = ?` (`src/models/articleModel.js:89`)

- **AC-ACQ-3 (없는 기사 → not-found)**
  - Given: 존재하지 않는 articleId
  - When: `svc.acquireEditLock(missing,'sess-A')`
  - Then: `{ok:false,reason:'not-found'}`
  - 증거: `test/articleService.test.js:233-238`; 모델 `src/models/articleModel.js:92-94`

- **AC-ACQ-4 (신규 초안은 잠금 미획득)**
  - Given: `editArticleId` 없이 작성 페이지 렌더
  - When: 마운트 후 effect 실행
  - Then: `lockArticle`이 한 번도 호출되지 않음
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:43-49`; 컨트롤러 가드 `useWriteController.js:105` (`if (!editArticleId) return;`)

- **AC-ACQ-5 (lock-before-load 순서)**
  - Given: `editArticleId='A-100'`, `lockArticle`이 `{ok:true}` 반환
  - When: 작성 페이지 마운트
  - Then: `lockArticle('A-100')`이 `queryArticles({articleId:'A-100'})` **이전에** 호출됨
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:32-41`; 컨트롤러 `useWriteController.js:104-127` (lock → query 순서)

> 아래 AC-TTL-1~4는 **[NEW] 타깃 동작 — 테스트가 아직 존재하지 않는다.** run 단계에서 TDD로 RED 먼저
> 작성한다(위의 [EXISTING] 특성화 AC와 구분). 모두 주입된 `now`/작은 TTL로 결정적으로 검증한다.

- **AC-TTL-1 (스테일 잠금 재선점) — [NEW]**
  - Given: `sess-A`가 잠금 보유, `LockedAt = now - 31min` (TTL 30분 기준 스테일)
  - When: `sess-B`가 주입된 `now`로 `acquireEditLock` 호출
  - Then: `{ok:true}` 이고 `LockedBySessionId='sess-B'`, `LockedAt=now`, `LockYN='Y'` (스테일 홀더 sess-A 조용히 대체)
  - 구현 대상: `src/models/articleModel.js:84-99` (WHERE 절 `OR LockedAt < ?staleThreshold` 추가); `src/services/articleService.js:89-92`

- **AC-TTL-2 (신선 잠금 비탈취 — 여전히 차단) — [NEW]**
  - Given: `sess-A`가 잠금 보유, `LockedAt = now - 29min` (비스테일)
  - When: `sess-B`가 주입된 `now`로 획득 시도
  - Then: `{ok:false,reason:'locked'}` 이고 홀더 sess-A 불변 (REQ-LOCK-BLOCK과 일관 — 차단 유지)
  - 구현 대상: `src/models/articleModel.js:95-97`

- **AC-TTL-3 (만료 경계) — [NEW]**
  - 경계 규칙(확정): 만료 판정은 `LockedAt < (now - EDIT_LOCK_TTL_MS)` — **TTL보다 엄격히 더 오래된** 잠금만 스테일이며, **정확히 TTL 경과 시점은 비스테일**(차단)이다.
  - Given: `sess-A`가 잠금 보유, `LockedAt = now - EDIT_LOCK_TTL_MS` (정확히 TTL)
  - When: `sess-B`가 획득 시도
  - Then: `{ok:false,reason:'locked'}` (경계는 비스테일). (`now - TTL - 1ms`이면 스테일 → 재선점)
  - 구현 대상: `src/models/articleModel.js:89` (`<` 연산자 선택)

- **AC-TTL-4 (TTL 구성 가능) — [NEW]**
  - Given: `EDIT_LOCK_TTL_MS` 기본값 `30*60*1000`
  - When: 테스트가 더 작은 TTL을 주입(또는 작은 `now` 델타로 경계 검증)
  - Then: 기본값은 30분이며, 주입된 TTL/`now`로 스테일 판정이 결정적으로 동작(실시간 대기/타이머 불필요)
  - 구현 대상: `EDIT_LOCK_TTL_MS` 상수(기본 `30*60*1000`); `src/services/articleService.js:89-92`

---

### REQ-LOCK-BLOCK — 비보유 세션의 중복 편집 차단 (409, 홀더 비노출) — **비스테일 잠금에 한함**

#### EARS 문장

- **[Unwanted]** IF 다른 세션이 이미 **비스테일(non-stale) 잠금**을 보유한 기사에 대해 비보유 세션이
  획득을 시도하면, THEN THE 시스템 SHALL 획득을 거부하고 HTTP 409 `{ok:false,reason:'locked'}`를
  반환한다. (스테일 잠금은 차단 대상이 아니라 **재선점 대상**이다 — REQ-LOCK-ACQUIRE의 [NEW] TTL EARS
  및 AC-TTL-1 참조. 즉 만료된 잠금에 대한 획득은 409가 아니라 `{ok:true}` 재선점이다.)
- **[Unwanted]** THE 시스템 SHALL NOT 409 응답 본문에 홀더 세션 id(`lockedBy`)를 노출하지 아니한다
  (정보 누출 방지).
- **[State-Driven]** WHILE 거부가 발생하는 동안, THE 시스템 SHALL 기존 홀더(`LockedBySessionId`)와
  `LockYN='Y'`를 변경 없이 보존한다 (도둑맞지 않음).
- **[Event-Driven]** WHEN 프론트엔드가 편집 진입 중 409(또는 전송 실패)를 수신하면, THE 시스템 SHALL
  인라인 알림 "다른 사용자가 편집 중입니다."를 표시하고 기사를 로드하지 않은 채 목록(ROUTES.VIEW)으로
  복귀하며, 잠금 보유 플래그를 false로 유지한다.

#### Acceptance Criteria

- **AC-BLK-1 (2번째 세션 차단, 서비스 계층)**
  - Given: `sess-A`가 잠금 보유
  - When: `sess-B`가 동일 기사 획득 시도
  - Then: `{ok:false,reason:'locked',lockedBy:'sess-A'}` 이고 `LockedBySessionId='sess-A'` 불변
  - 증거: `test/articleService.test.js:209-220`; 모델 `src/models/articleModel.js:95-97`

- **AC-BLK-2 (HTTP 409 + 홀더 비노출)**
  - Given: `sess-A`가 잠금 보유한 기사
  - When: `sess-B`가 `POST /api/articles/:id/lock`
  - Then: status 409, `body.ok===false`, `body.reason==='locked'`, **`'lockedBy' in body === false`**
  - 증거: `test/serverAuthWiring.test.js:199-213`; 라우트 `server/index.js:170-173` (holder 미포함)

- **AC-BLK-3 (프론트 409 → 알림 + 목록 복귀 + 미로드)**
  - Given: `editArticleId='A-1'`, `lockArticle`이 `{ok:false,reason:'locked'}` 반환
  - When: 작성 페이지 마운트
  - Then: `lockError === '다른 사용자가 편집 중입니다.'`, `queryArticles` 미호출, `navigate(ROUTES.VIEW)` 호출
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:51-64`; 컨트롤러 `useWriteController.js:110-117`

---

### REQ-LOCK-RELEASE-ACTION — 액션 성공 시 무조건 자동 해제 / 무효 액션 시 보존

#### EARS 문장

- **[Event-Driven]** WHEN 기사에 대한 생애주기 액션(send/hold/kill)이 성공적으로 적용되면, THE 시스템
  SHALL 서버 측에서 해당 기사의 잠금을 **무조건**(세션 무관) 해제하여 `LockYN='N'`,
  `LockedBySessionId=NULL`, `LockedAt=NULL`로 만든다.
- **[Unwanted]** IF 액션이 무효 전이(거부)로 실패하면, THEN THE 시스템 SHALL 잠금을 해제하지 아니하고
  `LockYN='Y'`와 홀더를 보존한다.
- **[Event-Driven]** WHEN 프론트엔드에서 액션이 성공하면, THE 시스템 SHALL 보유 플래그(`acquiredLockRef`)를
  false로 클리어하여 이후 이탈/언로드/로그아웃 해제 경로가 no-op이 되도록 한다 (이중 해제 방지).
- **[Ubiquitous]** THE 시스템 SHALL 액션 성공 시 클라이언트가 별도의 `unlock` 요청을 보내지 아니한다
  (서버가 이미 해제했으므로).

#### Acceptance Criteria

- **AC-RLA-1 (send/hold/kill 성공 → 자동 해제)**
  - Given: `sess-A`가 잠금 보유한 RDS 기사
  - When: `svc.applyAction(id,'D','send')` (또는 'hold'/'kill')
  - Then: `{ok:true}` 이고 `LockYN='N'`, `LockedBySessionId=NULL`
  - 증거: `test/articleService.test.js:267-299`; 서비스 무조건 해제 `src/services/articleService.js:74-78` (`model.releaseLock(articleId)` — sessionId 없음); HTTP `test/serverAuthWiring.test.js:245-259`

- **AC-RLA-2 (무효 액션 → 잠금 보존)**
  - Given: `sess-A`가 잠금 보유, 무효 전이(예: 비정의 소스 상태 RRH에서 send)
  - When: `svc.applyAction(id,'R','send')`
  - Then: `{ok:false}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 보존
  - 증거: `test/articleService.test.js:301-311`; 서비스 `src/services/articleService.js:71-73` (invalid → early return, 해제 전)

- **AC-RLA-3 (프론트 액션 후 이중 해제 방지)**
  - Given: 잠금 보유 상태에서 편집 후 `send()` 성공
  - When: 컴포넌트 unmount
  - Then: `unlockArticle`이 호출되지 않음 (플래그가 이미 클리어됨)
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:93-110`; 컨트롤러 `useWriteController.js:246-248` (`acquiredLockRef.current = false`)

---

### REQ-LOCK-RELEASE-EXIT — 편집 이탈 시 명시적 조건부 해제 (unmount / beforeunload / logout)

#### EARS 문장

- **[Event-Driven]** WHEN 편집 중인 작성 페이지가 언마운트되면 (라우트 변경 포함), THE 시스템 SHALL
  보유한 잠금이 있을 때에 한해 `unlockArticle`을 호출하여 해제한다.
- **[Event-Driven]** WHEN 브라우저 `beforeunload`(탭 닫기/새로고침)가 발생하면, THE 시스템 SHALL
  best-effort로 해제 요청을 보내며, 해당 요청은 페이지 언로드를 견디도록 `keepalive:true` fetch로
  전송한다 (sendBeacon은 `x-session-id` 헤더를 실을 수 없으므로 keepalive fetch 사용).
- **[Event-Driven]** WHEN 사용자가 로그아웃하면, THE 시스템 SHALL `model.logout()`(세션 클리어) **이전에**
  편집 잠금 해제를 수행한다 (release-before-clear-session 순서) — 그래야 unlock 요청이 유효한 세션
  헤더를 동반한다.
- **[Unwanted]** IF 해제 요청이 비보유 세션에서 발생하면, THEN THE 시스템 SHALL 잠금을 해제하지 아니하고
  조용한 no-op으로 처리하여 `{ok:true,released:false}`를 반환한다 (홀더 보호, 409 아님).
- **[State-Driven]** WHILE 편집 진입이 차단(409)되어 잠금을 획득하지 못한 동안, THE 시스템 SHALL 어떤
  해제 요청도 보내지 아니한다 (보유 플래그가 false이므로 모든 해제 경로 no-op).

#### Acceptance Criteria

- **AC-RLE-1 (보유자 해제 → released:true + 재획득 가능)**
  - Given: `sess-A`가 잠금 보유
  - When: `svc.releaseEditLock(id,'sess-A')`
  - Then: `{ok:true,released:true}`, `LockYN='N'`, 이후 `sess-B`가 획득 가능
  - 증거: `test/articleService.test.js:240-253`; 모델 조건부 해제 `src/models/articleModel.js:106-115`; HTTP `test/serverAuthWiring.test.js:227-242`

- **AC-RLE-2 (비보유자 해제 → no-op released:false, 도둑질 없음)**
  - Given: `sess-A`가 잠금 보유
  - When: `svc.releaseEditLock(id,'sess-B')`
  - Then: `{ok:true,released:false}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 불변
  - 증거: `test/articleService.test.js:255-265`; 모델 조건절 `AND LockedBySessionId = ?` (`src/models/articleModel.js:110-111`)

- **AC-RLE-3 (unmount 시 해제)**
  - Given: 잠금 획득에 성공한 편집 페이지
  - When: unmount
  - Then: `unlockArticle('A-2')` 호출
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:66-78`; 컨트롤러 `useWriteController.js:140-148` (cleanup → releaseLock)

- **AC-RLE-4 (차단 진입 시 해제 미발생)**
  - Given: 409로 진입 차단(잠금 미획득)
  - When: unmount
  - Then: `unlockArticle` 미호출
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:80-91`; 컨트롤러 `releaseLock` 가드 `useWriteController.js:93-98` (`if (!acquiredLockRef.current) return;`)

- **AC-RLE-5 (beforeunload best-effort 해제, keepalive)**
  - Given: 잠금 보유 편집 페이지
  - When: `window.dispatchEvent(new Event('beforeunload'))`
  - Then: `unlockArticle('A-5')` 호출
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:112-124`; 컨트롤러 `useWriteController.js:141-142`; keepalive `web/src/model/httpModel.js:166-178` (`keepalive:true` at :172)

- **AC-RLE-6 (logout: release-before-clear-session 등록/호출)**
  - Given: 잠금 보유 편집 페이지에서 `registerEditLockRelease`가 호출됨
  - When: 등록된 release fn을 호출 (App.handleLogout 경로)
  - Then: `unlockArticle('A-6')` 호출
  - 증거: `web/src/controller/useWriteController.lock.test.jsx:126-144`; 컨트롤러 등록 `useWriteController.js:154-158`; App 순서 `web/src/app/App.jsx:51-58` (release `:54` → `model.logout()` `:55`)

---

### REQ-LOCK-AUTH-SCOPE — 잠금 식별자는 세션 단위 / 역할 게이팅 / 인증 우선순위

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 잠금 식별자를 검증된 세션(`x-session-id`)으로만 결정하며, 사용자
  단위나 클라이언트 본문(body) 값으로 결정하지 아니한다.
- **[Unwanted]** IF 요청이 미인증(유효한 세션 없음)이면, THEN THE 시스템 SHALL **잠금 시도 이전에**
  HTTP 401 `{ok:false,reason:'unauthenticated'}`를 반환하고 기사 상태를 변경하지 아니한다 (401이
  409·404보다 우선).
- **[Unwanted]** IF 인증되었으나 역할이 R/D/Z가 아니면, THEN THE 시스템 SHALL HTTP 403
  `{ok:false,reason:'forbidden'}`를 반환한다.
- **[Unwanted]** IF 잠금/해제 대상 기사가 존재하지 않으면 (인증·인가 통과 후), THEN THE 시스템 SHALL
  HTTP 404 `{ok:false,reason:'not-found'}`를 반환한다.
- **[Ubiquitous]** THE 시스템 SHALL `/lock`과 `/unlock` 양쪽에서 동일한 세션 검증 → 역할 게이팅 →
  대상 확인 순서를 적용한다.

#### Acceptance Criteria

- **AC-AUTH-1 (R 세션 정상 획득 200 + LockYN=Y + 홀더=세션)**
  - Given: 역할 R 로그인 세션
  - When: `POST /api/articles/:id/lock`
  - Then: status 200, `body.ok===true`, `body.article.LockYN==='Y'`, `body.article.LockedBySessionId===sessionId`
  - 증거: `test/serverAuthWiring.test.js:187-196`; 라우트 `server/index.js:157-174`

- **AC-AUTH-2 (미인증 → 401, 상태 불변, 잠금 시도 이전)**
  - Given: `x-session-id` 헤더 없는 lock 요청
  - When: `POST /api/articles/:id/lock`
  - Then: status 401, `body.ok===false`, `body.reason` 존재, `LockYN='N'` 불변
  - 증거: `test/serverAuthWiring.test.js:262-270`; 라우트 `server/index.js:158-162` (validateSession → 401 early)

- **AC-AUTH-3 (없는 기사 → 404, 인증 통과 후)**
  - Given: 역할 R 세션, 존재하지 않는 articleId
  - When: `POST /api/articles/:id/lock`
  - Then: status 404, `body.reason==='not-found'`
  - 증거: `test/serverAuthWiring.test.js:273-280`; 라우트 `server/index.js:166-169`

- **AC-AUTH-4 (세션-단위 식별 — body.role 무시)**
  - Given: 잠금/액션은 세션 role로만 구동되며 body는 식별에 쓰이지 않음
  - When: lock/unlock/action 요청 처리
  - Then: 홀더는 `x-session-id` 세션으로 결정되고, 동일 사용자라도 다른 세션은 비보유로 취급(AC-BLK-1과 일관)
  - 증거: 라우트 `server/index.js:158,166,180,188` (`sessionIdOf(req)` 사용, body.role 미사용); 컨트랙트 주석 `web/src/model/contract.js:29-30`; 모델 식별 컬럼 `LockedBySessionId` (`src/models/articleModel.js:87`)

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

### 5.2 보안 / 데이터 무결성

- 409 응답에 홀더 세션 id를 절대 노출하지 않는다 (AC-BLK-2).
- 잠금 획득/해제는 파라미터 바인딩 SQL의 단일 원자적 조건부 UPDATE로 수행하여 race를 제거한다
  (`src/models/articleModel.js:84-115`). node:sqlite는 동기 실행이므로 단일 가드 UPDATE + rowcount로
  충분하다.
- 비보유 세션은 절대 잠금을 빼앗거나 강제 해제할 수 없다 (조건부 해제, AC-RLE-2).
- **(v0.2.0 [NEW]) 단, 스테일(만료) 잠금은 비보유 세션이 획득 시점에 재선점할 수 있다** — 이는 도둑질이
  아니라 만료 정책이며, `LockedAt < now - EDIT_LOCK_TTL_MS`인 경우에만 허용된다(AC-TTL-1/3).
- **[HARD] 타임스탬프 형식 불변식 (v0.2.0 [NEW])**: TTL 만료는 서버 시간 `now`를 저장된 `LockedAt`과
  비교한다. 현재 `LockedAt`은 ISO-8601 문자열(`new Date().toISOString()`)이며, SQL의 `LockedAt < thresholdISO`
  lexicographic 비교는 **양쪽이 동일한 고정폭 UTC(Z) ISO 포맷일 때에만** 정확하다. run 단계는 (a) 저장·비교
  모두 동일 고정폭 UTC(Z) ISO를 보장하거나 (b) epoch-ms 정수 표현으로 전환하여 수치 비교로 만들어야 한다.
  이 불변식을 깨면 만료 판정이 정렬되지 않아 재선점/차단이 비결정적으로 어긋난다.
- 인증(401)이 충돌(409)·대상부재(404)보다 우선한다 (AC-AUTH-2).
- DB의 잠금 컬럼 추가는 멱등 마이그레이션이며 기존 데이터를 삭제하지 않는다 (CLAUDE.md "DB 내용 삭제
  금지" HARD 규칙, `src/db/schema.js:101-112`).

### 5.3 회귀 방지 (특성화)

- [EXISTING] 잠금 동작은 신규 production code 없이 기존 테스트 전체(web Vitest + backend node:test)가
  GREEN 상태를 유지해야 한다.
- **(v0.2.0) [NEW] TTL 만료는 기존 동작을 변경하지 않는 순수 추가다** — WHERE 절에 disjunct 하나를
  더하는 것이므로, 비스테일 잠금에 대한 기존 차단(409) 경로는 무회귀여야 한다(AC-TTL-2/3, AC-BLK-*).
- 향후 어떤 변경도 본 SPEC의 AC([EXISTING]+[NEW])를 위반하면 회귀로 간주한다.

---

## 6. Delta 마커 (Δ Tracking)

| 영역 | 마커 | 근거 file:line |
|------|------|----------------|
| DB 잠금 컬럼 + 멱등 마이그레이션 | [EXISTING] | `src/db/schema.js:65-67,101-112,22` |
| 서비스 acquire/release + 액션 auto-release | [EXISTING] | `src/services/articleService.js:65-79,89-106` |
| 모델 원자적 check-and-set / 조건부 해제 (TTL 분기 추가 전 기준) | [EXISTING] | `src/models/articleModel.js:84-115` |
| **모델 `acquireLock` WHERE 절 TTL 분기 (`OR LockedAt < ?staleThreshold`)** | **[NEW]+[MODIFY]** | `src/models/articleModel.js:84-99` (특히 :89) |
| **`EDIT_LOCK_TTL_MS` 구성 상수 (기본 `30*60*1000`)** | **[NEW]** | (도입 위치) `src/models/articleModel.js` 또는 `src/services/articleService.js` |
| **`LockedAt`을 만료 입력으로 읽기 + staleThreshold 산출/전달** | **[NEW]+[MODIFY]** | `src/services/articleService.js:89-92` |
| HTTP lock/unlock 라우트 | [EXISTING] | `server/index.js:153-193` |
| 컨트롤러 wiring (acquireLock/releaseLock) | [EXISTING] | `src/controllers/index.js:98-99` |
| 프론트 contract/httpModel/controller/App | [EXISTING] | `web/src/model/contract.js:29-30`, `web/src/model/httpModel.js:151-178`, `web/src/controller/useWriteController.js:64,104-158,246-248`, `web/src/app/App.jsx:44-58` |
| 백엔드/HTTP/프론트 기존 테스트 | [EXISTING] | `test/articleService.test.js:198-311`, `test/serverAuthWiring.test.js:187-280`, `web/src/controller/useWriteController.lock.test.jsx:32-144` |
| **TTL RED 테스트 (AC-TTL-1~4)** | **[NEW]** | (작성 대상) `test/articleService.test.js` |

**v0.2.0부터 본 SPEC은 [NEW] 코드 항목을 포함한다** — 지연 TTL 만료(reclaim-on-acquire)는 테스트가
존재하지 않는 신규 동작이므로 run 단계에서 **TDD(RED→GREEN→REFACTOR)** 로 구현해야 한다. 기존
[EXISTING] 항목은 v0.1.0 특성화 대상 그대로이며 무회귀로 유지된다.

---

## 7. 종속성 및 Cross-References

> 아래 SPEC들은 **참조 전용** — 본 SPEC은 이들을 수정하지 않는다.

- **SPEC-DB-FOUNDATION-001**: `Contents` 테이블 스키마와 멱등 생성(`createSchema`)의 소관. 본 SPEC은
  그 위에 추가된 잠금 컬럼 3종의 *계약*만 명문화한다 (`src/db/schema.js`).
- **SPEC-AUTH-001**: R/D/Z 권한 의미와 세션 발급·검증(`validateSession`) 소관. 본 SPEC은 잠금
  엔드포인트가 그 세션을 *소비*하여 잠금 식별/게이팅하는 규칙만 정의한다.
- **SPEC-BACKEND-CORE-001**: 기사 CRUD·생애주기 전이(`applyAction`/`transition`) 소관. 본 SPEC은 액션
  성공이 잠금을 *해제하는 부수효과*만 다룬다 (전이 규칙 자체는 변경 없음).
- **SPEC-FRONTEND-UI-001**: 작성 페이지(`writer.do`) 구조·권한 게이팅·라우팅 소관. 본 SPEC은 그 위에
  편집 진입 시 잠금 획득/차단/해제 UX만 명문화한다.
- **SPEC-NEWS-REVISE-001**: news.md 최근 개정 반영(Z권한 버튼/상세보기/에디터). 본 SPEC과 동일하게
  news.md를 source-of-truth로 삼되 범위가 분리됨 (해당 SPEC은 잠금을 다루지 않는다).

---

## 8. Pending Decisions (결정 이력)

> v0.2.0에서 사용자 승인으로 PD-1을 채택하여 PD-1/PD-2가 해소되었다. PD-3/PD-4는 사용자가 "TTL만 추가"를
> 선택함으로써 나머지 동작을 현행 유지로 확정하였다.

- **PD-1 (잠금 TTL / idle 만료) — RESOLVED (v0.2.0)**: **지연(lazy) 만료(reclaim-on-acquire), TTL
  기본 30분, In Scope로 채택.** active background sweep/스케줄러는 채택하지 않는다(node:sqlite 단일
  프로세스 동기 모델 부합). 구현은 REQ-LOCK-ACQUIRE [NEW] EARS + AC-TTL-1~4 참조. orphaned lock은 다음
  획득 시점에 자동 회복된다.
- **PD-2 (`LockedAt` 용도) — RESOLVED (v0.2.0)**: `LockedAt`은 더 이상 audit-only가 아니라 **만료 판단의
  단일 입력**이다(`LockedAt < now - EDIT_LOCK_TTL_MS` ⇒ 스테일). 타임스탬프 형식 불변식은 §5.2 참조.
- **PD-3 (KILL 상태 RRK/DDK 상호작용) — 확정: 현행 유지**: 액션(kill 포함) 성공 시 잠금이 해제되어 KILL
  상태 기사도 이후 고침/포털고침으로 재편집 진입 시 재-lockable하다. 사용자가 TTL 외 변경을 요청하지
  않았으므로 현 동작을 의도된 계약으로 확정한다. (현 구현·테스트 GREEN: `test/serverAuthWiring.test.js:245-259`)
- **PD-4 ("편집이 끝나면" discard 의미 / 강제 종료) — 확정: 현행 유지 (+ TTL 보강)**: `beforeunload` 없는
  강제 종료 시 잠금이 잔존하던 문제는 best-effort keepalive unlock을 그대로 유지하되, **이제 PD-1의 TTL이
  잔존 잠금을 최대 30분 후 자동 회복**한다. 추가 서버측 즉시 정리(sweep)는 도입하지 않는다.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- **active background sweep / 스케줄러 기반 만료** — v0.2.0은 지연 reclaim-on-acquire만 채택한다. 타이머·
  주기적 정리 잡·백그라운드 프로세스를 신설하지 않는다(node:sqlite 단일 프로세스 동기 모델).
- **만료 알림 UX / 만료된 홀더에 대한 알림** — 스테일 잠금이 재선점되면 이전 홀더는 조용히 대체되며, 별도
  알림/표시를 만들지 않는다.
- **lock-acquire 외 시점의 만료 처리** — idle 폴링, 주기적 정리, 응답 외 경로에서의 만료 판정은 범위 외.
  만료는 오직 획득(acquire) 시점에 평가된다.
- **멱등성 키(idempotency key)** 도입 — 현 멱등성은 "동일 세션 재획득" 동작으로 충분.
- **잠금 식별자 변경** — 세션 단위(`LockedBySessionId`)를 사용자/단말 단위로 바꾸지 않는다.
- **`Contents` 잠금 컬럼 외 스키마 변경** — 신규 테이블/인덱스 추가 금지(TTL 비교 일관화는 `LockedAt` 포맷
  고정 또는 epoch-ms 표현 전환에 한함).
- **역할 게이팅 의미 변경** — R/D/Z 허용·그 외 403 규칙을 바꾸지 않는다(SPEC-AUTH-001 소관).
- **생애주기 전이 로직 변경** — send/hold/kill 전이표는 SPEC-BACKEND-CORE-001 소관.
- **실시간 잠금 표시 UI / 잠금 보유자 표시** — 범위 아님(409 응답에 홀더 비노출 원칙과도 충돌).

---

## 10. Definition of Done

- [ ] 기존 백엔드 테스트(`test/articleService.test.js` 잠금 케이스 198-311)가 GREEN으로 재확인됨
- [ ] 기존 HTTP 테스트(`test/serverAuthWiring.test.js` 잠금 케이스 187-280)가 GREEN으로 재확인됨
- [ ] 기존 프론트 테스트(`web/src/controller/useWriteController.lock.test.jsx` 32-144)가 GREEN으로 재확인됨
- [ ] **(NEW) AC-TTL-1~4의 RED 테스트가 먼저 작성되어 실패함을 확인**(주입된 `now`/작은 TTL — 실시간 대기 없음)
- [ ] **(NEW) GREEN 구현**: `acquireLock` WHERE 절에 `OR LockedAt < ?staleThreshold` 분기 추가 +
      `EDIT_LOCK_TTL_MS`(기본 `30*60*1000`) 도입 → AC-TTL-1~4 통과
- [ ] **(NEW) 타임스탬프 형식 불변식 검증** — `LockedAt` 저장·비교가 동일 고정폭 UTC(Z) ISO(또는 epoch-ms)로 정렬 정확
- [ ] **(NEW) 비스테일 차단(409) 경로 무회귀** — AC-TTL-2/3, AC-BLK-1/2/3 GREEN 유지
- [ ] 5개 REQ(REQ-LOCK-ACQUIRE/BLOCK/RELEASE-ACTION/RELEASE-EXIT/AUTH-SCOPE)의 모든 AC([EXISTING]+[NEW])가
      증거 또는 구현 대상(file:line)과 매핑되고 구현과 정합함
- [ ] 모든 file:line 앵커가 실제 파일과 일치함 (drift 없음)
- [ ] Pending Decisions: PD-1/PD-2 RESOLVED, PD-3/PD-4 "확정: 현행 유지"가 Plan Review에서 사용자에게 확인됨
- [ ] `npm test`(web Vitest) 전체 GREEN
- [ ] backend `node --test` 전체 GREEN, coverage ≥85% (per-commit ≥80%)
- [ ] `npm run build`(vite) 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] spec.md / plan.md / acceptance.md / spec-compact.md 정합 확인
- [ ] 기존 SPEC(DB-FOUNDATION-001, AUTH-001, BACKEND-CORE-001, FRONTEND-UI-001, NEWS-REVISE-001) 회귀 없음
- [ ] (CLAUDE.md HARD) Slack `tech-day` 채널 완료 보고 — 토큰 미설정 시 로컬 로그 폴백이며 "전송됨"으로 단정 금지

---

Version: 0.2.0
Status: draft
Last Updated: 2026-06-03
