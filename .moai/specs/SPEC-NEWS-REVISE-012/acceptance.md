---
id: SPEC-NEWS-REVISE-012
version: 0.1.1
status: Plan
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
---

# SPEC-NEWS-REVISE-012 — 인수 기준 (Acceptance Criteria)

## HISTORY

- 2026-06-10 (v0.1.1): **AC-CON-2 보정 (동작 변경 아님).** Run 단계 검증에서 발견된 기존 의미론과의 문구
  불일치를 정정한다. 직전 문구는 "강제 해제로 `lockYN='N'` 이 된 기사에 원 편집자가 `applyAction(send)` 하면
  lock-required" 였으나, 이는 기존 SPEC-EDIT-LOCK-001 의미론과 어긋난다 — `applyAction` 의 락 가드는
  `current.lockYN === 'Y'` 일 때만 발동하므로(`src/services/articleService.js:206`) 자유 잠금('N') 상태에서는
  통과(`ok:true`)가 기존 정의된 동작(§3.2 "코드 변경 금지" 대상)이다. 실사용 시나리오대로 **다른 세션이 재획득한
  직후** 원 편집자가 비보유자로서 lock-required 에 막히는 시점으로 보정하고 정합 노트를 추가한다(검증:
  `test/integration.lockLifecycle.test.js` + `test/forceUnlock.test.js`). (manager-spec)
- 2026-06-10 (v0.1.0): 최초 작성. REQ-FORCE-UNLOCK-MENU/-SERVER/-CONSISTENCY/REGRESSION-GUARD 의 Given-When-Then
  인수 기준. 실제 테스트 레이아웃 기준: 프론트 `web/src/view/*.test.jsx`(`npm run test:web`), 백엔드
  `test/*.test.js`(`npm test`), 빌드 `npm run build`. 시간 의존 AC 에는 now 주입 NFR 명기. (manager-spec)

---

## 테스트 레이아웃 (실제)

| 종류 | 위치 | 실행 명령 |
|------|------|-----------|
| 프론트(컨텍스트 메뉴) | `web/src/view/ViewPage.contextMenu.test.jsx` 또는 신규 `web/src/view/ViewPage.forceUnlock.test.jsx` | `npm run test:web` |
| 백엔드(서비스) | `test/articleService.test.js` | `npm test` |
| 백엔드(라우트 가드) | `test/serverAuthWiring.test.js` | `npm test` |
| 백엔드(통합 정합) | `test/integration.lockLifecycle.test.js` | `npm test` |
| 빌드 | (전체) | `npm run build` |

> 컨텍스트 메뉴 컨테이너는 `role="menu"` + `aria-label="기사 메뉴"`. 항목은 `role="menuitem"`.
> 비활성 항목은 `disabled` 속성을 가지며 "(준비중)" 힌트를 렌더한다(`ContextMenu.jsx`). 행 데이터는
> `article.lockYN`(소문자)로 읽는다. 강제 해제 모델 호출명: `forceUnlockArticle(articleId)`.

---

## §1. REQ-FORCE-UNLOCK-MENU — 컨텍스트 메뉴 노출·게이팅 (프론트)

### AC-MENU-1 — LockYN='Y' 행 → "Lock해제" 항목 노출
- **Given**: list.do, D 권한 사용자, `queryArticles` 가 `lockYN:'Y'` 인 행 1개를 반환
- **When**: 해당 행을 우클릭하여 컨텍스트 메뉴를 연다
- **Then**: 메뉴(`role="menu", name:'기사 메뉴'`)에 `menuitem` "Lock해제" 가 존재한다
- 테스트: `web/src/view/ViewPage.contextMenu.test.jsx`(또는 `ViewPage.forceUnlock.test.jsx`)

### AC-MENU-2 — LockYN!='Y' 행 → "Lock해제" 항목 미노출
- **Given**: list.do, D 권한 사용자, `queryArticles` 가 `lockYN:'N'`(또는 미설정) 인 행을 반환
- **When**: 해당 행을 우클릭하여 메뉴를 연다
- **Then**: 메뉴에 "Lock해제" `menuitem` 이 **존재하지 않는다**(`queryByRole('menuitem', { name:/Lock해제/ })`
  is null)

### AC-MENU-3 — D/Z 권한 → "Lock해제" 활성
- **Given**: list.do, `lockYN:'Y'` 행, 사용자 권한이 `D`(케이스 a) 또는 `Z`(케이스 b)
- **When**: 행을 우클릭
- **Then**: "Lock해제" `menuitem` 이 **enabled** 이다(`toBeEnabled()`)

### AC-MENU-4 — R 권한 → "Lock해제" 비활성 + 클릭 무동작
- **Given**: list.do, `lockYN:'Y'` 행, 사용자 권한이 `R`, `forceUnlockArticle` 스파이 주입
- **When**: 행을 우클릭한 뒤 비활성 "Lock해제" 항목을 클릭 시도
- **Then**: "Lock해제" `menuitem` 이 **disabled** 이고, `forceUnlockArticle` 가 **호출되지 않는다**
  (`expect(spy).not.toHaveBeenCalled()`), 메뉴는 닫히지 않는다(비활성 항목은 act·close 모두 no-op)

### AC-MENU-5 — D/Z 활성 클릭 → forceUnlock 1회 + 메뉴 닫힘
- **Given**: list.do, `lockYN:'Y'` 행(`articleId:'A-LOCK'`), D 권한,
  `createFakeModel({ forceUnlockArticle: spy })`(spy 가 `{ok:true}` resolve)
- **When**: 행 우클릭 → 활성 "Lock해제" 클릭
- **Then**: `forceUnlockArticle` 가 정확히 `'A-LOCK'` 로 1회 호출되고, 메뉴(`role="menu"`)가 닫힌다

---

## §2. REQ-FORCE-UNLOCK-SERVER — 서버 강제 해제 라우트 + 가드 (백엔드)

> 라우트: `POST /api/articles/:id/force-unlock`. 세션 헤더 `x-session-id`. 가드 순서 `401 → 403 → 404 → 처리`.
> 테스트는 기존 `serverAuthWiring.test.js` 의 `seedUser`/`loginSessionId`/`fetch(base)` 패턴을 따른다.

### AC-SRV-1 — D/Z 세션 강제 해제 → 200 + lockYN='N'
- **Given**: lockYN='Y' 로 잠긴 기사(보유자 = 임의 세션), 별도의 D(또는 Z) 로그인 세션
- **When**: `POST /api/articles/:id/force-unlock` (x-session-id = D/Z 세션)
- **Then**: status 200, `body.ok === true`; 이후 조회 시 그 기사의 `lockYN === 'N'`,
  `lockerSessionId`/`lockerUserId`/`lockedAt` 가 모두 NULL

### AC-SRV-2 — 타인(비보유) 잠금도 해제 (강제의 본질)
- **Given**: `sess-A`(R/D/Z 무관) 가 보유한 잠금, 강제 해제 호출자는 **다른** D 세션(`sess-D`, 비보유자)
- **When**: `sess-D` 가 `POST .../force-unlock`
- **Then**: `body.ok === true`, `lockYN === 'N'` (보유자가 아니어도 해제됨 — 기존 보유자-한정 unlock 의
  `not-holder` 거부와 대비)

### AC-SRV-3 — 미인증 → 401 우선 + 상태 불변
- **Given**: lockYN='Y' 기사, `x-session-id` 헤더 없음
- **When**: `POST .../force-unlock`
- **Then**: status 401, `body.ok === false`, `body.reason` 존재; 기사 `lockYN` 은 **'Y' 불변**(강제 해제 시도
  이전 거부)

### AC-SRV-4 — R 권한 → 403 + 상태 불변
- **Given**: lockYN='Y' 기사, **R** 로그인 세션
- **When**: `POST .../force-unlock` (x-session-id = R 세션)
- **Then**: status 403, `body.reason === 'forbidden'`; 기사 `lockYN` 은 **'Y' 불변**

### AC-SRV-5 — 없는 기사 → 404 (인증·인가 통과 후)
- **Given**: D 세션, 존재하지 않는 articleId
- **When**: `POST /api/articles/<missing>/force-unlock`
- **Then**: status 404, `body.reason === 'not-found'`

### AC-SRV-6 — body.role 무시 (세션 역할로만 구동)
- **Given**: lockYN='Y' 기사, **R** 세션이지만 요청 본문에 `{ role: 'D' }` 를 실어 보냄
- **When**: `POST .../force-unlock` (x-session-id = R 세션, body.role='D')
- **Then**: status 403(세션 역할 R 기준), `lockYN` 불변 — body.role 은 무시됨

### AC-SRV-7 — 강제 해제 성공 → SSE change 발행
- **Given**: SSE `/api/stream` 구독 중, lockYN='Y' 기사, D 세션
- **When**: `POST .../force-unlock` 성공
- **Then**: 구독자가 그 articleId 에 대한 `change` 이벤트를 수신한다(기존 `type:'unlock'` 또는 `type:'lock-release'`
  payload). (테스트는 기존 SSE 검증 패턴 또는 `bus` 직접 검증 중 단순한 쪽 채택.)

### AC-SRV-8 — 응답에 보유자 식별자 비노출
- **Given**: `sess-A` 보유 잠금, D 세션 강제 해제
- **When**: `POST .../force-unlock`
- **Then**: `body.ok === true` 이고 응답 본문에 `lockerSessionId`/`lockerUserId`(직전 보유자 식별자)가
  **포함되지 않는다**(`'lockerSessionId' in body === false`)

---

## §3. REQ-FORCE-UNLOCK-CONSISTENCY — 강제 해제 후 기존 의미론 정합 (백엔드 통합)

> **[NFR — now 주입]** 본 절의 모든 AC 는 acquire/assertLockHolder 의 시각 비교 경로(30분 stale)를 타므로,
> 테스트는 반드시 `now`(및 필요 시 `timeoutMs`)를 주입해 결정적으로 검증한다. 실시간 대기/타이머 금지
> (30분 stale 시한폭탄 방지).

### AC-CON-1 — 강제 해제 후 타 세션 재획득 가능
- **Given**: `sess-A` 가 보유한 잠금(`lockedAt = now`, 비stale), D 세션이 강제 해제 완료(`lockYN='N'`)
- **When**: `sess-B` 가 `acquireEditLock(id, { userId:'u-b', sessionId:'sess-B', now })`
- **Then**: `{ ok: true }` (자유 잠금으로 취급되어 재획득 성공) — `now` 고정 전달

### AC-CON-2 — 원 편집자 PUT/action → lock-required (재획득된 잠금에 막힘, 기존 의미론 회귀)
- **Given**: `sess-A` 가 보유했던 기사가 D 세션 강제 해제로 `lockYN='N'` 이 된 뒤, **다른 세션 `sess-B` 가 그
  기사를 재획득**하여 다시 `lockYN='Y'`(holder=`sess-B`)가 됨 (강제 해제의 실사용 시나리오 — 자리를 비운
  편집자의 잠금을 회수해 다른 데스크원이 편집)
- **When**: 원 편집자 `sess-A` 가 (a) `assertLockHolder(id, { userId:'u-a', sessionId:'sess-A', now })`,
  (b) `applyAction(id, role, 'send', { userId:'u-a', sessionId:'sess-A', now })`
- **Then**: (a) `{ ok:false, reason:'lock-required' }`(보유자 불일치 — holder 는 `sess-B`), (b) `{ ok:false,
  reason:'lock-required' }` 이고 기사 status 불변 — 원 편집자가 **비보유자**로서 기존 SPEC-EDIT-LOCK-001
  의미론에 의해 막힘. `now` 고정 전달.
  - 구현 검증 위치: `test/integration.lockLifecycle.test.js` + `test/forceUnlock.test.js` (Run 단계 확인).
  - **[정합 노트]** 강제 해제 직후 **맨 `lockYN='N'` 상태**에서 원 편집자가 곧장 `applyAction(send)` 하면
    `{ok:true}` 로 통과한다 — `applyAction` 의 락 가드는 `current.lockYN === 'Y'` 일 때만 발동하고(자유 잠금
    'N' 은 통과), 이는 기존 SPEC-EDIT-LOCK-001 의미론(`src/services/articleService.js:206`)이며 **본 SPEC 이
    변경하지 않는다**(spec §3.2 "코드 변경 금지"). 따라서 "원 편집자가 막힌다"는 보장은 **다른 세션이 재획득한
    이후**에만 성립하며, 그것이 강제 해제의 실사용 시나리오다. PUT 경로(`assertLockHolder`)는 `lockYN='N'` 시
    `lock-required`(lock-required 경로)이지만, action 경로는 위와 같이 `lockYN='Y'` 시에만 가드된다 — 두 경로의
    가드 발동 조건 차이는 기존 코드 사실이다.

### AC-CON-3 — 기존 보유자-한정 unlock 계약 불변
- **Given**: `sess-A` 보유 잠금
- **When**: 비보유자 `sess-B` 가 기존 `releaseEditLock(id, { userId:'u-b', sessionId:'sess-B' })`
  (강제 해제가 아닌 기존 경로)
- **Then**: `{ ok:false, reason:'not-holder' }` 이고 `lockYN='Y'`, `lockerSessionId='sess-A'` 불변
  (도둑질 금지 회귀 — 강제 해제 추가가 기존 계약을 바꾸지 않음)

---

## §4. REQ-REGRESSION-GUARD — 회귀 가드

### AC-REG-1 — 잠금 계약 회귀 없음
- **Given/When/Then**: SPEC-EDIT-LOCK-001 / NEWS-REVISE-002 의 기존 잠금 테스트
  (`test/articleService.test.js`, `test/serverAuthWiring.test.js`, `test/editLockBehavior.test.js`,
  `test/integration.lockLifecycle.test.js`)가 전부 GREEN 유지 — acquire 멱등, 30분 stale, 409 holder 비노출,
  보유자-한정 release.

### AC-REG-2 — SSE / LockYN 컬럼 회귀 없음
- **Given/When/Then**: SPEC-NEWS-REVISE-008 의 SSE `type:'lock'` 재조회 + 데스크 미송고 LockYN 컬럼(8컬럼)
  표시 테스트(`web/src/view/ViewPage.contextMenu.test.jsx` 의 LockYN 컬럼 검증 포함)가 GREEN 유지.

### AC-REG-3 — 기존 컨텍스트 메뉴 항목/닫힘 회귀 없음
- **Given/When/Then**: 데스크 미송고(편집/상세보기/이력보기/본문복사/제목만복사), 부서별 송고(편집 +
  고침/포털고침 D-only 게이팅), Escape/외부클릭 닫힘 — `web/src/view/ViewPage.contextMenu.test.jsx` 기존
  케이스가 모두 GREEN 유지. "Lock해제" 추가가 기존 항목 세트/순서/게이팅을 깨지 않는다.

---

## §5. 품질 게이트 (Quality Gate)

- [ ] `npm test` (backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web` (vitest) 전체 GREEN
- [ ] `npm run build` (vite) 무경고
- [ ] lock 관련 테스트 now 고정 전달(AC-CON-1/2 — 30분 stale 시한폭탄 방지)
- [ ] eslint(`npm run lint`) 무경고
- [ ] TRUST 5: Tested / Readable / Unified / Secured(서버 가드 필수) / Trackable

---

## §6. Definition of Done (요약)

- [ ] AC-MENU-1~5 GREEN (조건부 노출 + D/Z 활성 + R 비활성 + 클릭 동작)
- [ ] AC-SRV-1~8 GREEN (강제 해제 + 401/403/404 가드 + body.role 무시 + SSE + 보유자 비노출)
- [ ] AC-CON-1~3 GREEN (재획득 가능 + 원 편집자 lock-required + 보유자-한정 계약 불변)
- [ ] AC-REG-1~3 GREEN (잠금/SSE·LockYN 컬럼/기존 메뉴 회귀 없음)
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.1 / Plan)
- [ ] news.md 미변경
- [ ] Slack `tech-day` 보고(CLAUDE.md HARD; 폴백 시 "전송됨" 단정 금지)

---

Version: 0.1.1
Status: Plan
Last Updated: 2026-06-10
