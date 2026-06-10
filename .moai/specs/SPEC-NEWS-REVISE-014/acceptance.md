---
id: SPEC-NEWS-REVISE-014
version: 0.1.0
status: Plan
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
---

# SPEC-NEWS-REVISE-014 — 인수 기준 (Acceptance Criteria)

## HISTORY

- 2026-06-10 (v0.1.0): 최초 작성. REQ-UNLOCK-CONFIRM / -DB / REQ-EDITOR-AUTOCLOSE / REQ-SSE-FORCED-FLAG /
  REGRESSION-GUARD 의 Given-When-Then 인수 기준. 실제 테스트 레이아웃: 프론트 `web/src/view/*.test.jsx`
  (`npm run test:web`), 백엔드 `test/*.test.js`(`npm test`), 빌드 `npm run build`. DB 강제 해제는
  SPEC-NEWS-REVISE-012 에서 구현 완료이므로 AC-DB-1 은 회귀 가드. (manager-spec)

---

## 테스트 레이아웃 (실제)

| 종류 | 위치 | 실행 명령 |
|------|------|-----------|
| 프론트(확인창) | `web/src/view/ViewPage.forceUnlock.test.jsx` | `npm run test:web` |
| 프론트(편집 자동 종료) | `web/src/view/WritePage.test.jsx` 또는 신규 `WriteWorkspace.forceClose.test.jsx` | `npm run test:web` |
| 백엔드(SSE forced payload) | `test/forceUnlock.test.js` 또는 `test/serverAuthWiring.test.js` | `npm test` |
| 빌드 | (전체) | `npm run build` |

> 컨텍스트 메뉴 활성 "Lock해제" 항목은 `onSelect` 을 가지며, 클릭 시 `window.confirm('Lock해제하시겠습니까?')` 를
> 선행한다. R 비활성 항목은 `onSelect` 자체가 없다(SPEC-012 `{...DISABLED}`). 강제 해제 모델 호출명:
> `forceUnlockArticle(articleId)`. 강제 해제 SSE payload: `{ type:'unlock', articleId, forced:true }`.
> 편집 화면은 `WriteWorkspace` 의 탭(`editArticleId`)이며, 종료는 `closeTab(tabId)` 로 수행한다.

---

## §1. REQ-UNLOCK-CONFIRM — Lock해제 클릭 확인창 (프론트)

### AC-CONFIRM-1 — 활성 "Lock해제" 클릭 → confirm 표시
- **Given**: list.do, D(또는 Z) 권한, LockYN='Y' 행, `window.confirm` 스파이
- **When**: 행 우클릭 → 활성 "Lock해제" 클릭
- **Then**: `window.confirm` 이 정확히 `'Lock해제하시겠습니까?'` 인자로 호출된다

### AC-CONFIRM-2 — 수락(예) → forceUnlock 1회
- **Given**: AC-CONFIRM-1 셋업, `window.confirm` 이 `true` 반환, `forceUnlockArticle` 스파이(`articleId:'A-LOCK'`)
- **When**: "Lock해제" 클릭
- **Then**: `forceUnlockArticle` 가 정확히 `'A-LOCK'` 로 1회 호출된다

### AC-CONFIRM-3 — 취소(아니오) → 무호출
- **Given**: AC-CONFIRM-1 셋업, `window.confirm` 이 `false` 반환, `forceUnlockArticle` 스파이
- **When**: "Lock해제" 클릭
- **Then**: `forceUnlockArticle` 가 **호출되지 않는다**(`expect(spy).not.toHaveBeenCalled()`) — DB/SSE 무변동

### AC-CONFIRM-4 — R 비활성 항목 → confirm 없음
- **Given**: list.do, R 권한, LockYN='Y' 행, `window.confirm`/`forceUnlockArticle` 스파이
- **When**: 행 우클릭 → 비활성 "Lock해제" 클릭 시도
- **Then**: 항목은 `disabled` 이고, `window.confirm` 도 `forceUnlockArticle` 도 호출되지 않는다

---

## §2. REQ-UNLOCK-DB — 강제 해제 LockYN='N' (백엔드, SPEC-012 회귀 가드)

### AC-DB-1 — 수락 후 LockYN='N' + locker 컬럼 NULL (기존 경로 회귀)
- **Given**: lockYN='Y' 로 잠긴 기사(보유자 = 임의 세션), D(또는 Z) 로그인 세션
- **When**: `POST /api/articles/:id/force-unlock`(x-session-id = D/Z 세션) — 확인창은 프론트 UX 이므로 서버
  테스트는 라우트를 직접 호출
- **Then**: status 200, `body.ok === true`; 이후 조회 시 그 기사의 `lockYN === 'N'`,
  `lockerSessionId`/`lockerUserId`/`lockedAt` 가 모두 NULL — 기존 `forceReleaseEditLock` 동작 회귀 없음
  (SPEC-NEWS-REVISE-012 AC-SRV-1 과 동일 결과; 본 SPEC 은 새 서버 코드를 추가하지 않음)

---

## §3. REQ-EDITOR-AUTOCLOSE — 강제 해제 SSE 수신 시 편집 화면 자동 종료 (프론트)

> 자동 종료 테스트는 실제 EventSource 대신 fake `subscribe` 로 forced 프레임을 주입해 결정적으로 검증한다.
> `window.alert` 는 스파이로 가로챈다. 종료는 `closeTab` 으로 그 편집 탭이 사라지는 것으로 검증한다.

### AC-CLOSE-1 — 보유 탭 + 일치 articleId + forced:true → alert 1회 + 탭 닫힘
- **Given**: writer.do, 편집 탭이 `editArticleId='A-LOCK'` 로 잠금 보유, `window.alert` 스파이, fake `subscribe`
- **When**: SSE 프레임 `{ type:'unlock', articleId:'A-LOCK', forced:true }` 가 주입된다
- **Then**: `window.alert` 가 정확히 `'Lock이 해제되어 편집을 종료합니다'` 로 **1회** 호출되고, 그 편집 탭이
  닫힌다(워크스페이스가 남은 탭 / 새 기사 탭으로 전환 — `closeTab` 결과)

### AC-CLOSE-2 — 다른 articleId 무시
- **Given**: 편집 탭이 `editArticleId='A-LOCK'` 보유, `window.alert` 스파이
- **When**: `{ type:'unlock', articleId:'OTHER', forced:true }` 주입
- **Then**: `window.alert` 가 호출되지 않고, 탭은 닫히지 않는다(그대로 편집 유지)

### AC-CLOSE-3 — 초안 탭(잠금 없음) 무시
- **Given**: '새 기사' 탭(`editArticleId=null`, 잠금 없음), `window.alert` 스파이
- **When**: 임의 `{ type:'unlock', articleId:'A-LOCK', forced:true }` 주입(또는 구독 자체가 없음)
- **Then**: `window.alert` 가 호출되지 않고 탭도 그대로 — 초안 탭은 unlock 프레임을 무시한다

### AC-CLOSE-4 — 자기 해제(정상 release) → alert/자동 종료 없음
- **Given**: 편집 탭이 `editArticleId='A-LOCK'` 보유, `window.alert` 스파이
- **When**: 정상 해제에 해당하는 `{ type:'unlock', articleId:'A-LOCK' }`(forced 미포함) 주입 — 또는 편집자
  본인이 송고/보류/KILL/정상 탭 닫기를 수행
- **Then**: `window.alert` 가 호출되지 않고, 강제 자동 종료 경로가 작동하지 않는다(기존 `endEditContext`/
  `closeTab` 정상 경로만 동작) — `forced:true` 가 아니면 종료 트리거가 발동하지 않는다

### AC-CLOSE-5 — 중복 forced 프레임 → alert 1회 (멱등)
- **Given**: 편집 탭이 `editArticleId='A-LOCK'` 보유, `window.alert` 스파이
- **When**: 동일 `{ type:'unlock', articleId:'A-LOCK', forced:true }` 프레임이 2회 이상 주입된다
- **Then**: `window.alert` 가 **정확히 1회만** 호출된다(이미 종료가 진행된 탭은 추가 alert 없음 — `closed` 멱등 가드)

### AC-CLOSE-6 — 저장하지 않은 변경분 폐기
- **Given**: 편집 탭이 `editArticleId='A-LOCK'` 보유, 에디터에 저장하지 않은 변경분 존재
- **When**: `{ type:'unlock', articleId:'A-LOCK', forced:true }` 주입으로 자동 종료
- **Then**: 별도 저장 호출(`updateArticle`/`send` 등) 없이 탭이 닫히고 그 탭의 보존 초안이 폐기된다
  (`closeTab` → `removeStoredDraft` + WritePage unmount)

---

## §4. REQ-SSE-FORCED-FLAG — 강제 해제 SSE 구분 플래그 (백엔드)

### AC-SSE-1 — 강제 해제 성공 → payload 에 forced:true
- **Given**: lockYN='Y' 기사, D(또는 Z) 세션, `bus`(또는 SSE 구독) 관찰
- **When**: `POST /api/articles/:id/force-unlock` 성공
- **Then**: 발행된 `change` payload 가 `{ type:'unlock', articleId:<id>, forced:true }` 를 포함한다
  (`forced === true`)

### AC-SSE-2 — 정상 해제 이벤트엔 forced 미포함
- **Given/When/Then**: 정상 해제 경로(존재 시: 송고/보류/KILL/정상 release 에 수반되는 lock 변동 이벤트)가
  발행하는 payload 에는 `forced` 키가 없거나 `false` 이다(`'forced' in payload === false || payload.forced !== true`)
  — 클라이언트가 강제/정상을 구분할 수 있다

### AC-SSE-3 — ViewPage 재조회 회귀 없음
- **Given/When/Then**: list.do(ViewPage)가 강제 해제 `forced:true` payload 를 수신해도 기존 SSE 재조회 동작이
  변하지 않는다 — `forced` 는 키 추가일 뿐 `type:'unlock'`/`articleId` 기반 재조회 트리거를 깨지 않는다
  (`web/src/view/ViewPage.test.jsx` SSE 케이스 GREEN 유지)

---

## §5. REQ-REGRESSION-GUARD — 회귀 가드

### AC-REG-1 — SPEC-012 메뉴/라우트 회귀 없음
- **Given/When/Then**: SPEC-NEWS-REVISE-012 의 "Lock해제" 노출/게이팅(LockYN='Y' 조건부, D/Z 활성, R 비활성)과
  서버 강제 해제 라우트(401→403→404 + LockYN='N' + 보유자 비노출) 테스트가 모두 GREEN 유지. 확인창 추가가
  메뉴 항목 세트/권한 게이팅/라우트 가드를 깨지 않는다.

### AC-REG-2 — 잠금 계약 / WritePage 회귀 없음
- **Given/When/Then**: SPEC-EDIT-LOCK-001 / NEWS-REVISE-002 의 acquire/release/멱등/30분 stale 계약과 WritePage 의
  lock-before-load(`useWriteController.js:245-283`)·탭 생존 동작 테스트가 GREEN 유지. SSE 구독 추가가 잠금
  획득/해제 타이밍을 바꾸지 않는다.

### AC-REG-3 — 기존 확인창 / 탭 정상 경로 회귀 없음
- **Given/When/Then**: WritePage 송고/보류/KILL `window.confirm` 확인창(`WritePage.test.jsx` 기존 케이스)과
  WriteWorkspace 의 `endEditContext`(송고 후 '새 기사' 전환)·`closeTab`(정상 탭 닫기) 경로가 GREEN 유지.
  강제 종료 배선이 정상 종료 경로를 깨지 않는다.

---

## §6. 품질 게이트 (Quality Gate)

- [ ] `npm test` (backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web` (vitest) 전체 GREEN
- [ ] `npm run build` (vite) 무경고
- [ ] `npm run lint` (eslint) 무경고
- [ ] SSE 자동 종료 테스트는 fake subscribe 로 forced 프레임 주입(실시간 대기/타이머 금지)
- [ ] TRUST 5: Tested / Readable / Unified / Secured / Trackable

---

## §7. Definition of Done (요약)

- [ ] AC-CONFIRM-1~4 GREEN (확인창 표시 + 수락 1회 + 취소 무호출 + R 비활성 무확인)
- [ ] AC-DB-1 GREEN (수락 후 LockYN='N' + locker NULL — SPEC-012 경로 회귀)
- [ ] AC-CLOSE-1~6 GREEN (보유 탭 종료 + 다른 기사/초안 무시 + 자기 해제 제외 + 멱등 + 변경분 폐기)
- [ ] AC-SSE-1~3 GREEN (강제 forced:true + 정상 미포함 + ViewPage 재조회 회귀 없음)
- [ ] AC-REG-1~3 GREEN (SPEC-012 메뉴/라우트, 잠금/WritePage, 기존 확인창/탭 회귀 없음)
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.0 / Plan)
- [ ] news.md 미변경
- [ ] Slack `tech-day` 보고(CLAUDE.md HARD; 폴백 시 "전송됨" 단정 금지)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-10
