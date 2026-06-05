---
id: SPEC-EDIT-LOCK-001
version: 0.2.0
status: draft
created: 2026-06-03
updated: 2026-06-03
author: manager-spec
---

# SPEC-EDIT-LOCK-001 — Acceptance Criteria (Given-When-Then)

> [EXISTING] 시나리오는 **이미 통과하는 기존 테스트**에 대응한다(특성화/회귀 가드).
> [NEW] 시나리오(AC-TTL-1~4)는 **아직 테스트가 존재하지 않는 타깃 동작**이며 run 단계에서 TDD로
> RED 먼저 작성한다. 각 시나리오는 증거(또는 구현 대상) file:line을 명시한다.

---

## REQ-LOCK-ACQUIRE — 편집 진입 시 세션 단위 배타 잠금 획득 (멱등) + 지연 TTL 만료

### AC-ACQ-1 (자유 기사 획득) — [EXISTING]
- **Given** `status='RDS'`이고 잠금이 없는 기사
- **When** `svc.acquireEditLock(id,'sess-A',{now:'2026-05-27T01:00:00Z'})`
- **Then** `{ok:true}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'`, `LockedAt='2026-05-27T01:00:00.000Z'`
- 증거: `test/articleService.test.js:198-207` · 구현 `src/models/articleModel.js:84-99`, `src/db/schema.js:65-67`

### AC-ACQ-2 (동일 세션 재획득 멱등) — [EXISTING]
- **Given** `sess-A`가 이미 잠금 보유
- **When** `sess-A`가 동일 기사를 다시 획득
- **Then** `{ok:true}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 유지(빼앗김 없음)
- 증거: `test/articleService.test.js:222-231`; HTTP 멱등 200 `test/serverAuthWiring.test.js:216-224` · 구현 `src/models/articleModel.js:89` (`LockedBySessionId = ?` 조건)

### AC-ACQ-3 (없는 기사) — [EXISTING]
- **Given** 존재하지 않는 articleId
- **When** `svc.acquireEditLock(missing,'sess-A')`
- **Then** `{ok:false,reason:'not-found'}`
- 증거: `test/articleService.test.js:233-238` · 구현 `src/models/articleModel.js:92-94`

### AC-ACQ-4 (신규 초안은 잠금 미획득) — [EXISTING]
- **Given** `editArticleId` 없이 작성 페이지 렌더
- **When** 마운트 후 effect 실행
- **Then** `lockArticle`이 한 번도 호출되지 않음
- 증거: `web/src/controller/useWriteController.lock.test.jsx:43-49` · 구현 `useWriteController.js:105`

### AC-ACQ-5 (lock-before-load 순서) — [EXISTING]
- **Given** `editArticleId='A-100'`, `lockArticle`→`{ok:true}`
- **When** 작성 페이지 마운트
- **Then** `lockArticle('A-100')`이 `queryArticles({articleId:'A-100'})` **이전에** 호출됨
- 증거: `web/src/controller/useWriteController.lock.test.jsx:32-41` · 구현 `useWriteController.js:104-127`

### AC-TTL-1 (스테일 잠금 재선점) — [NEW] (테스트 미존재 — RED 작성 대상)
- **Given** `sess-A`가 잠금 보유, `LockedAt = now - 31min` (TTL 30분 기준 스테일)
- **When** `sess-B`가 주입된 `now`로 `svc.acquireEditLock(id,'sess-B',{now})` 호출
- **Then** `{ok:true}` 이고 `LockedBySessionId='sess-B'`, `LockedAt = now`, `LockYN='Y'` (스테일 홀더 sess-A는 조용히 대체됨)
- 구현 대상: `src/models/articleModel.js:84-99` (WHERE 절에 `OR LockedAt < ?staleThreshold` 분기 추가); `src/services/articleService.js:89-92` (`now` 주입 + staleThreshold 산출/전달)
- 검증 방식: 주입된 `now`로 결정적 테스트(실시간 대기 없음)

### AC-TTL-2 (신선 잠금 비탈취 — 여전히 차단) — [NEW] (테스트 미존재 — RED 작성 대상)
- **Given** `sess-A`가 잠금 보유, `LockedAt = now - 29min` (비스테일)
- **When** `sess-B`가 주입된 `now`로 동일 기사 획득 시도
- **Then** `{ok:false,reason:'locked'}` 이고 `LockedBySessionId='sess-A'` 불변 (REQ-LOCK-BLOCK과 일관 — 여전히 차단)
- 구현 대상: `src/models/articleModel.js:95-97` (비스테일 → changes=0 → locked)

### AC-TTL-3 (만료 경계 의미) — [NEW] (테스트 미존재 — RED 작성 대상)
- **경계 규칙(확정)**: 만료(스테일) 판정은 `LockedAt < (now - EDIT_LOCK_TTL_MS)`. 즉 **TTL보다 엄격히 더 오래된** 잠금만 스테일이며, **정확히 TTL 경과 시점은 비스테일**(차단 유지)이다.
- **Given** `sess-A`가 잠금 보유, `LockedAt = now - EDIT_LOCK_TTL_MS` (정확히 TTL)
- **When** `sess-B`가 주입된 `now`로 획득 시도
- **Then** `{ok:false,reason:'locked'}` (경계는 비스테일 → 차단). (`LockedAt = now - TTL - 1ms`이면 스테일 → 재선점)
- 구현 대상: `src/models/articleModel.js:89` (`<` 비교 연산자 선택)

### AC-TTL-4 (TTL 구성 가능) — [NEW] (테스트 미존재 — RED 작성 대상)
- **Given** `EDIT_LOCK_TTL_MS` 기본값 `30*60*1000`
- **When** 코드/테스트가 더 작은 TTL을 주입(또는 작은 `now` 델타로 스테일 경계 검증)
- **Then** 기본값은 30분이며, 주입된 TTL/`now`로 스테일 판정이 결정적으로 동작(실시간 대기·타이머 불필요)
- 구현 대상: `EDIT_LOCK_TTL_MS` 상수(기본 `30*60*1000`, 오버라이드 가능); `src/services/articleService.js:89-92` (`options`로 `now`/TTL 주입)

---

## REQ-LOCK-BLOCK — 비보유 세션의 중복 편집 차단 (409, 홀더 비노출) — **비스테일 잠금에 한함**

> 주: 스테일 잠금(`LockedAt`이 TTL보다 오래됨)은 차단(409) 대상이 아니라 **재선점 대상**이다(REQ-LOCK-ACQUIRE / AC-TTL-1). 아래 AC는 모두 **비스테일** 잠금 전제다.

### AC-BLK-1 (2번째 세션 차단, 서비스 계층) — [EXISTING]
- **Given** `sess-A`가 비스테일 잠금 보유
- **When** `sess-B`가 동일 기사 획득 시도
- **Then** `{ok:false,reason:'locked',lockedBy:'sess-A'}` 이고 `LockedBySessionId='sess-A'` 불변
- 증거: `test/articleService.test.js:209-220` · 구현 `src/models/articleModel.js:95-97`

### AC-BLK-2 (HTTP 409 + 홀더 비노출) — [EXISTING]
- **Given** `sess-A`가 비스테일 잠금 보유한 기사
- **When** `sess-B`가 `POST /api/articles/:id/lock`
- **Then** status 409, `body.ok===false`, `body.reason==='locked'`, `'lockedBy' in body === false`
- 증거: `test/serverAuthWiring.test.js:199-213` · 구현 `server/index.js:170-173`

### AC-BLK-3 (프론트 409 → 알림 + 목록 복귀 + 미로드) — [EXISTING]
- **Given** `editArticleId='A-1'`, `lockArticle`→`{ok:false,reason:'locked'}`
- **When** 작성 페이지 마운트
- **Then** `lockError==='다른 사용자가 편집 중입니다.'`, `queryArticles` 미호출, `navigate(ROUTES.VIEW)` 호출
- 증거: `web/src/controller/useWriteController.lock.test.jsx:51-64` · 구현 `useWriteController.js:110-117`

---

## REQ-LOCK-RELEASE-ACTION — 액션 성공 시 무조건 자동 해제 / 무효 액션 시 보존

### AC-RLA-1 (send/hold/kill 성공 → 자동 해제) — [EXISTING]
- **Given** `sess-A`가 잠금 보유한 RDS 기사
- **When** `svc.applyAction(id,'D','send')` (및 'hold'/'kill')
- **Then** `{ok:true}` 이고 `LockYN='N'`, `LockedBySessionId=NULL`
- 증거: `test/articleService.test.js:267-299`; HTTP `test/serverAuthWiring.test.js:245-259` · 구현 `src/services/articleService.js:74-78` (sessionId 없는 무조건 해제)

### AC-RLA-2 (무효 액션 → 잠금 보존) — [EXISTING]
- **Given** `sess-A`가 잠금 보유, 무효 전이(비정의 소스 상태 RRH에서 send)
- **When** `svc.applyAction(id,'R','send')`
- **Then** `{ok:false}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 보존
- 증거: `test/articleService.test.js:301-311` · 구현 `src/services/articleService.js:71-73` (invalid → early return)

### AC-RLA-3 (프론트 액션 후 이중 해제 방지) — [EXISTING]
- **Given** 잠금 보유 상태에서 편집 후 `send()` 성공
- **When** 컴포넌트 unmount
- **Then** `unlockArticle` 미호출 (플래그가 이미 클리어)
- 증거: `web/src/controller/useWriteController.lock.test.jsx:93-110` · 구현 `useWriteController.js:246-248`

---

## REQ-LOCK-RELEASE-EXIT — 편집 이탈 시 명시적 조건부 해제 (unmount / beforeunload / logout)

### AC-RLE-1 (보유자 해제 → released:true + 재획득 가능) — [EXISTING]
- **Given** `sess-A`가 잠금 보유
- **When** `svc.releaseEditLock(id,'sess-A')`
- **Then** `{ok:true,released:true}`, `LockYN='N'`, 이후 `sess-B`가 획득 가능
- 증거: `test/articleService.test.js:240-253`; HTTP `test/serverAuthWiring.test.js:227-242` · 구현 `src/models/articleModel.js:106-115`

### AC-RLE-2 (비보유자 해제 → no-op released:false) — [EXISTING]
- **Given** `sess-A`가 잠금 보유
- **When** `svc.releaseEditLock(id,'sess-B')`
- **Then** `{ok:true,released:false}` 이고 `LockYN='Y'`, `LockedBySessionId='sess-A'` 불변
- 증거: `test/articleService.test.js:255-265` · 구현 `src/models/articleModel.js:110-111` (`AND LockedBySessionId = ?`)

### AC-RLE-3 (unmount 시 해제) — [EXISTING]
- **Given** 잠금 획득에 성공한 편집 페이지
- **When** unmount
- **Then** `unlockArticle('A-2')` 호출
- 증거: `web/src/controller/useWriteController.lock.test.jsx:66-78` · 구현 `useWriteController.js:140-148`

### AC-RLE-4 (차단 진입 시 해제 미발생) — [EXISTING]
- **Given** 409로 진입 차단(잠금 미획득)
- **When** unmount
- **Then** `unlockArticle` 미호출
- 증거: `web/src/controller/useWriteController.lock.test.jsx:80-91` · 구현 `useWriteController.js:93-98` (`if (!acquiredLockRef.current) return;`)

### AC-RLE-5 (beforeunload best-effort 해제, keepalive) — [EXISTING]
- **Given** 잠금 보유 편집 페이지
- **When** `window.dispatchEvent(new Event('beforeunload'))`
- **Then** `unlockArticle('A-5')` 호출
- 증거: `web/src/controller/useWriteController.lock.test.jsx:112-124` · 구현 `useWriteController.js:141-142`; keepalive `web/src/model/httpModel.js:166-178` (`keepalive:true` at :172)

### AC-RLE-6 (logout: release-before-clear-session) — [EXISTING]
- **Given** 잠금 보유 편집 페이지에서 `registerEditLockRelease` 호출됨
- **When** 등록된 release fn 호출 (App.handleLogout 경로)
- **Then** `unlockArticle('A-6')` 호출
- 증거: `web/src/controller/useWriteController.lock.test.jsx:126-144` · 구현 `useWriteController.js:154-158`; App 순서 `web/src/app/App.jsx:54-55` (release 먼저 → logout)

---

## REQ-LOCK-AUTH-SCOPE — 세션 단위 식별 / 역할 게이팅 / 인증 우선순위

### AC-AUTH-1 (R 세션 정상 획득 200) — [EXISTING]
- **Given** 역할 R 로그인 세션
- **When** `POST /api/articles/:id/lock`
- **Then** status 200, `body.ok===true`, `body.article.LockYN==='Y'`, `body.article.LockedBySessionId===sessionId`
- 증거: `test/serverAuthWiring.test.js:187-196` · 구현 `server/index.js:157-174`

### AC-AUTH-2 (미인증 → 401, 상태 불변) — [EXISTING]
- **Given** `x-session-id` 없는 lock 요청
- **When** `POST /api/articles/:id/lock`
- **Then** status 401, `body.ok===false`, `body.reason` 존재, `LockYN='N'` 불변
- 증거: `test/serverAuthWiring.test.js:262-270` · 구현 `server/index.js:158-162`

### AC-AUTH-3 (없는 기사 → 404) — [EXISTING]
- **Given** 역할 R 세션, 존재하지 않는 articleId
- **When** `POST /api/articles/:id/lock`
- **Then** status 404, `body.reason==='not-found'`
- 증거: `test/serverAuthWiring.test.js:273-280` · 구현 `server/index.js:166-169`

### AC-AUTH-4 (세션-단위 식별 — body 무시) — [EXISTING]
- **Given** lock/unlock/action은 세션 role/세션 id로만 구동
- **When** 요청 처리
- **Then** 홀더는 `x-session-id`로 결정되고 body.role은 식별에 쓰이지 않음 (동일 사용자라도 다른 세션은 비보유)
- 증거: `server/index.js:158,166,180,188` (`sessionIdOf(req)`); 컨트랙트 `web/src/model/contract.js:29-30`; 모델 식별 컬럼 `src/models/articleModel.js:87`

---

## Edge Cases (특성화 — 기존 테스트로 커버)

| Edge | 동작 | 증거 |
|------|------|------|
| 멱등 재진입 (동일 세션) | 빼앗김 없이 `{ok:true}` | `articleService.test.js:222-231`, `serverAuthWiring.test.js:216-224` |
| 무효 액션이 잠금 보존 | `LockYN='Y'` 유지 | `articleService.test.js:301-311` |
| 401이 409/404보다 우선 | 미인증은 잠금 시도 이전 401 | `serverAuthWiring.test.js:262-270`, `server/index.js:158-162` |
| 비보유 세션 unlock | 조용한 no-op `released:false` (409 아님) | `articleService.test.js:255-265` |
| 언로드 시 keepalive unlock | sendBeacon 대신 keepalive fetch (헤더 보존) | `useWriteController.lock.test.jsx:112-124`, `httpModel.js:172` |
| 액션 후 이중 unlock 방지 | 플래그 클리어로 release 경로 no-op | `useWriteController.lock.test.jsx:93-110`, `useWriteController.js:248` |
| 409 차단 시 unlock 미발생 | 잠금 미획득 → 모든 release no-op | `useWriteController.lock.test.jsx:80-91` |

## Edge Cases (TTL — [NEW], run 단계 RED 작성 대상)

| Edge | 동작 | 비고 |
|------|------|------|
| 스테일 잠금 재진입 | sess-B가 재선점, holder/`LockedAt` 교체 | AC-TTL-1 |
| 정확히 TTL 경과 | 비스테일 → 차단 유지(`LockedAt < now-TTL`만 스테일) | AC-TTL-3 (경계) |
| 작은 TTL 주입 | 결정적 테스트(실시간 대기 없음) | AC-TTL-4 |
| 스테일 재선점 후 즉시 차단 | 재선점한 sess-B의 새 잠금은 비스테일이므로 sess-C 차단 | AC-TTL-1 + AC-BLK-1 연동 |

---

## REQ ↔ AC ↔ Evidence 매핑

| REQ | AC | 마커 | 증거 / 구현 대상 file:line |
|-----|----|------|----------------------------|
| REQ-LOCK-ACQUIRE | AC-ACQ-1 | [EXISTING] | `test/articleService.test.js:198-207` |
| REQ-LOCK-ACQUIRE | AC-ACQ-2 | [EXISTING] | `test/articleService.test.js:222-231`, `test/serverAuthWiring.test.js:216-224` |
| REQ-LOCK-ACQUIRE | AC-ACQ-3 | [EXISTING] | `test/articleService.test.js:233-238` |
| REQ-LOCK-ACQUIRE | AC-ACQ-4 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:43-49` |
| REQ-LOCK-ACQUIRE | AC-ACQ-5 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:32-41` |
| REQ-LOCK-ACQUIRE | AC-TTL-1 | [NEW] | (구현) `src/models/articleModel.js:84-99`, `src/services/articleService.js:89-92` |
| REQ-LOCK-ACQUIRE | AC-TTL-2 | [NEW] | (구현) `src/models/articleModel.js:95-97` |
| REQ-LOCK-ACQUIRE | AC-TTL-3 | [NEW] | (구현) `src/models/articleModel.js:89` (`<` 경계) |
| REQ-LOCK-ACQUIRE | AC-TTL-4 | [NEW] | (구현) `EDIT_LOCK_TTL_MS` 상수, `src/services/articleService.js:89-92` |
| REQ-LOCK-BLOCK | AC-BLK-1 | [EXISTING] | `test/articleService.test.js:209-220` |
| REQ-LOCK-BLOCK | AC-BLK-2 | [EXISTING] | `test/serverAuthWiring.test.js:199-213` |
| REQ-LOCK-BLOCK | AC-BLK-3 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:51-64` |
| REQ-LOCK-RELEASE-ACTION | AC-RLA-1 | [EXISTING] | `test/articleService.test.js:267-299`, `test/serverAuthWiring.test.js:245-259` |
| REQ-LOCK-RELEASE-ACTION | AC-RLA-2 | [EXISTING] | `test/articleService.test.js:301-311` |
| REQ-LOCK-RELEASE-ACTION | AC-RLA-3 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:93-110` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-1 | [EXISTING] | `test/articleService.test.js:240-253`, `test/serverAuthWiring.test.js:227-242` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-2 | [EXISTING] | `test/articleService.test.js:255-265` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-3 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:66-78` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-4 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:80-91` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-5 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:112-124`, `web/src/model/httpModel.js:172` |
| REQ-LOCK-RELEASE-EXIT | AC-RLE-6 | [EXISTING] | `web/src/controller/useWriteController.lock.test.jsx:126-144`, `web/src/app/App.jsx:54-55` |
| REQ-LOCK-AUTH-SCOPE | AC-AUTH-1 | [EXISTING] | `test/serverAuthWiring.test.js:187-196` |
| REQ-LOCK-AUTH-SCOPE | AC-AUTH-2 | [EXISTING] | `test/serverAuthWiring.test.js:262-270` |
| REQ-LOCK-AUTH-SCOPE | AC-AUTH-3 | [EXISTING] | `test/serverAuthWiring.test.js:273-280` |
| REQ-LOCK-AUTH-SCOPE | AC-AUTH-4 | [EXISTING] | `server/index.js:158,166,180,188`, `web/src/model/contract.js:29-30` |

---

## Quality Gate Criteria

- [ ] (NEW) AC-TTL-1~4의 RED 테스트가 **먼저** 작성되어 실패함을 확인 (주입된 `now`/작은 TTL 사용)
- [ ] (NEW) GREEN: `acquireLock` WHERE 절에 `LockedAt < ?staleThreshold` 분기 추가 + `EDIT_LOCK_TTL_MS` 도입 → AC-TTL-1~4 통과
- [ ] (NEW) `LockedAt` 타임스탬프 형식 불변식 검증 — 저장·비교 모두 고정폭 UTC(Z) ISO-8601 동일 포맷(또는 epoch-ms)으로 lexicographic/수치 비교가 정확함
- [ ] `npm test` (web Vitest + jsdom) 전체 GREEN — 잠금 케이스 8종 포함
- [ ] backend `node --test` 전체 GREEN — `articleService.test.js`/`serverAuthWiring.test.js` 잠금 케이스 + 신규 TTL 케이스 포함
- [ ] coverage ≥85% (per-commit ≥80%, `quality.yaml` tdd_settings.min_coverage_per_commit)
- [ ] `npm run build` (vite) 무경고
- [ ] 기존 비스테일 차단(409) 경로 무회귀 — AC-BLK-1/2/3, AC-TTL-2/3 GREEN
- [ ] 모든 [EXISTING] AC의 file:line 증거가 실제 코드/테스트와 정합 (drift 없음)
- [ ] 홀더 세션 id가 409 응답에 노출되지 않음 (보안 게이트, AC-BLK-2)
- [ ] DB 잠금 컬럼 마이그레이션이 멱등이며 데이터 비파괴 (CLAUDE.md HARD, `schema.js:101-112`)
- [ ] TRUST 5 (Tested/Readable/Unified/Secured/Trackable) 통과
- [ ] (CLAUDE.md HARD) Slack `tech-day` 보고 — 토큰 미설정 시 로컬 로그 폴백, "전송됨" 단정 금지

---

## Definition of Done (요약)

spec.md §10과 동일. 핵심: 5개 REQ의 [EXISTING] AC가 기존 GREEN 테스트로 특성화되어 무회귀로 유지되고,
**신규 TTL 만료([NEW]) AC-TTL-1~4가 RED→GREEN으로 구현**되며(타임스탬프 형식 불변식 검증 포함),
PD-1/PD-2는 RESOLVED, PD-3/PD-4는 "확정: 현행 유지"로 기록된 채 전체 스위트가 통과한다.

---

Version: 0.2.0
Status: draft
Last Updated: 2026-06-03
