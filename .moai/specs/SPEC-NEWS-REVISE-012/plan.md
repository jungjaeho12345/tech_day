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

# SPEC-NEWS-REVISE-012 — 구현 계획 (Implementation Plan)

## HISTORY

- 2026-06-10 (v0.1.1): 버전 동기 갱신(3파일 정합). 내용 변경은 spec.md REQ-FORCE-UNLOCK-CONSISTENCY 및
  acceptance.md AC-CON-2 의 정합 노트 보정에 한하며(동작 변경 아님 — Run 단계 검증으로 발견된 기존
  SPEC-EDIT-LOCK-001 의미론과의 문구 불일치 정정), plan 의 구현 접근·마일스톤·리스크는 불변. (manager-spec)
- 2026-06-10 (v0.1.0): 최초 작성. spec.md REQ-FORCE-UNLOCK-MENU / -SERVER / -CONSISTENCY / REGRESSION-GUARD
  에 대한 구현 접근·마일스톤·리스크 정의. 사용자 직접 요청(2026-06-10) + 도메인 결정(D/Z 전용, Z=D-mirror,
  R show-but-disabled) 흡수. (manager-spec)

---

## 1. 기술 접근 (Technical Approach)

### 1.1 핵심 결정 — 강제 해제는 "신규 경로"로 추가 (기존 보유자-한정 해제 재사용 불가)

현행 `releaseEditLock` / `POST /api/articles/:id/unlock` 는 **보유자-한정**이다(`row.lockerUserId !== userId ||
row.lockerSessionId !== sessionId → {ok:false, reason:'not-holder'}`, `src/services/articleService.js:153-154`).
타인 잠금 강제 해제는 이 경로로 표현할 수 없다. 따라서:

- **신규 서비스 메서드** `forceReleaseEditLock(articleId)` 를 추가한다 — 보유자 검사 없이 잠금 컬럼을
  `lockYN='N', lockerUserId=NULL, lockerSessionId=NULL, lockedAt=NULL` 로 설정(없는 기사는 `{ok:false,
  reason:'not-found'}`). 기존 `releaseEditLock` 은 **불변**으로 둔다(AC-CON-3).
- **신규 라우트** `POST /api/articles/:id/force-unlock` 를 추가한다 — 기존 lock/unlock 라우트의 가드 순서
  (`401 → 403 → 404 → 처리`)를 그대로 따르되, **허용 역할을 `D`/`Z` 로 좁힌다**(lock/unlock 는 R/D/Z 허용이지만
  강제 해제는 D/Z 전용). 성공 시 기존 SSE 발행 패턴(`bus.emit('change', { type:'unlock', articleId })` 또는
  의미 구분용 `type:'lock-release'`)을 재사용한다.

### 1.2 프론트 — 컨텍스트 메뉴 조건부 항목 (데이터-주도 노출 + 권한 비활성)

`web/src/view/ViewPage.jsx` `buildContextItems({article, menu, role, navigate})` 에서, **모든 메뉴 공통으로**
`article.lockYN === 'Y'` 일 때만 "Lock해제" 항목을 배열에 추가한다. 권한 게이트는 기존 `dpsEditItem` 의
show-but-disabled 패턴을 차용하되 허용 역할 집합만 `{D, Z}` 로 바꾼다:

- `role === 'D' || role === 'Z'` → `{ label: 'Lock해제', onSelect: () => model.forceUnlockArticle(article.articleId) }`
- `role === 'R'` → `{ label: 'Lock해제', ...DISABLED }`(즉 `{disabled:true}` → ContextMenu 가 "(준비중)" 렌더)

`buildContextItems` 는 현재 `model` 을 인자로 받지 않으므로, 호출부(`ViewPage` 본문 L338)에서 `model`(또는
`forceUnlockArticle` 콜백)을 주입하도록 시그니처를 확장한다. `model` 은 `useModel()`/context 에서 가져온다
(기존 컨트롤러가 model 을 쓰는 경로 확인 후 일관 적용). 클릭 후 메뉴 닫힘은 `ContextMenu` 의 `onSelect → onClose`
경로가 이미 처리한다(`ContextMenu.jsx:60-63`).

> 노출 조건이 "메뉴 종류"가 아니라 "행 데이터(lockYN)"이므로, 데스크 미송고·부서별 송고·부서별 작성·개인별
> 수정 4개 메뉴 모두에서 LockYN='Y' 행이면 항목이 붙는다. (LockYN 컬럼은 4개 메뉴 모두 표시되므로 일관적 —
> moai-domain-news-editor §2.8, news.md L92.)

### 1.3 프론트 — 모델 컨트랙트 + HTTP + fakeModel

- `web/src/model/contract.js`: `MODEL_KEYS` 에 `'forceUnlockArticle'` 추가 + JSDoc 주석
  (`forceUnlockArticle(articleId) -> { ok:true } | { ok:false, reason }  POST /api/articles/:id/force-unlock`).
- `web/src/model/httpModel.js`: `forceUnlockArticle(articleId)` 구현 — `sendJson('POST',
  '/api/articles/:id/force-unlock', undefined, { ok:false, reason:'network-error' })`(body 없음, 세션 헤더는
  `headers()` 가 주입; 기존 `lockArticle` 패턴과 동일).
- `web/src/test/fakeModel.js`: `async forceUnlockArticle(_articleId) { return { ok: true }; }` 기본 구현
  (`assertModel` 통과 + 무관 테스트 기본 성공). lockYN='Y' 테스트는 `createFakeModel({ forceUnlockArticle })`
  로 스파이 주입.

### 1.4 백엔드 — 서비스 + 컨트롤러 + 라우트

- `src/services/articleService.js`:
  ```
  forceReleaseEditLock(articleId) {
    const row = readLock(articleId);
    if (row === undefined) return { ok: false, reason: 'not-found' };
    db.prepare(`UPDATE Contents
                   SET lockYN='N', lockerUserId=NULL, lockerSessionId=NULL, lockedAt=NULL
                 WHERE articleId = ?`).run(articleId);
    return { ok: true };
  }
  ```
  (보유자 무관 — 강제. 응답에 보유자 식별자 미포함.)
- `src/controllers/index.js`: `forceReleaseEditLock: (articleId) => articleService.forceReleaseEditLock(articleId)`.
- `server/index.js`: `POST /api/articles/:id/force-unlock` —
  `401(touchSession undefined) → 403(role !== 'D' && role !== 'Z') → 404(query 없음) → forceReleaseEditLock →
  성공 시 bus.emit('change', { type:'unlock', articleId })`. 응답에 lockerSessionId/lockerUserId 미노출.

### 1.5 강제 해제 후 정합 (코드 변경 없음 — 기존 의미론 재확인)

AC-CON-1/AC-CON-2 는 **새 코드를 추가하지 않고** 기존 `acquireEditLock`(자유 잠금 재획득 가능) /
`assertLockHolder`·`applyAction`(lock-required) 경로가 강제 해제 이후에도 의도대로 동작함을 **테스트로 확인**한다.
now 주입으로 stale 경로를 결정적으로 제어한다.

---

## 2. 마일스톤 (Milestones — 우선순위 기반, 시간 추정 없음)

### M1 (Priority High) — 백엔드 강제 해제 코어
- `forceReleaseEditLock` 서비스 메서드 + 컨트롤러 와이어링.
- `POST /api/articles/:id/force-unlock` 라우트(가드 401→403(D/Z)→404 + SSE 발행 + 보유자 비노출).
- 대응 테스트: `test/articleService.test.js`(서비스 강제 해제), `test/serverAuthWiring.test.js`(라우트 가드).
- 충족 AC: AC-SRV-1~8.

### M2 (Priority High) — 프론트 컨텍스트 메뉴 + 모델 컨트랙트
- `contract.js`(MODEL_KEYS+주석) → `httpModel.js`(forceUnlockArticle) → `fakeModel.js`(기본 구현).
- `ViewPage.jsx` `buildContextItems` 조건부 "Lock해제" 항목(D/Z 활성, R 비활성, lockYN='Y' 게이트) + 호출부
  model 주입.
- 대응 테스트: `web/src/view/ViewPage.contextMenu.test.jsx`(또는 신규 `ViewPage.forceUnlock.test.jsx`).
- 충족 AC: AC-MENU-1~5.

### M3 (Priority Medium) — 정합/회귀
- 강제 해제 후 타 세션 재획득(AC-CON-1) + 원 편집자 lock-required(AC-CON-2) 통합 테스트
  (`test/integration.lockLifecycle.test.js`), now 고정.
- 기존 보유자-한정 unlock 계약 불변 확인(AC-CON-3).
- 회귀 가드(AC-REG-1~3): 잠금 계약/SSE·LockYN 컬럼/기존 메뉴 항목·닫힘.

### M4 (Priority Low) — 품질 게이트 + 보고
- `npm test` + `npm run test:web` + `npm run build` GREEN/무경고, 커버리지 확인.
- TRUST 5 게이트, 3파일 정합, news.md 미변경 확인.
- Slack `tech-day` 보고.

---

## 3. 개발 방법론

- `.moai/config/sections/quality.yaml` `development_mode` 를 따른다(기존 잠금 SPEC 들과 동일). 본 작업은
  신규 동작(강제 해제) 추가이므로 **TDD(RED→GREEN→REFACTOR)** 가 적합: 라우트 가드·서비스 강제 해제·메뉴
  게이트 각각 실패 테스트 먼저 작성.
- now 의존 회귀(AC-CON-1/2)는 RED 부터 `now`/`timeoutMs` 주입으로 결정적 작성(30분 stale 시한폭탄 방지).

---

## 4. 리스크 및 완화 (Risks & Mitigation)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 프론트만 게이트하고 서버 가드 누락 | 권한 우회(R/미인증이 강제 해제) — 보안 결함 | 서버 라우트에 401→403(D/Z)→404 가드 필수(REQ-FORCE-UNLOCK-SERVER, AC-SRV-3/4/5/6); 라우트 테스트로 강제 |
| 기존 보유자-한정 `releaseEditLock` 를 강제 해제로 개조 | AC-RLE-2(도둑질 금지) 회귀 | **신규** `forceReleaseEditLock` 별도 메서드로 추가, 기존 메서드 불변(AC-CON-3) |
| 컬럼 명칭 드리프트(`LockYN` vs `lockYN`) | SQL/응답 키 불일치로 강제 해제 무효 | 실제 코드 명칭(소문자 `lockYN`/`lockerUserId`/`lockerSessionId`/`lockedAt`) 정본 사용(spec §2) |
| `buildContextItems` 가 model 미수신 | 클릭 콜백 연결 불가 | 호출부에서 model/콜백 주입하도록 시그니처 확장(plan §1.2) |
| LockYN 노출 조건을 "메뉴 종류"로 오해 | 일부 메뉴에서 항목 누락 | 노출 조건은 행 데이터 `lockYN==='Y'` (메뉴 무관, 4개 메뉴 공통) |
| 강제 해제 응답에 보유자 식별자 노출 | 정보 누출(기존 409 holder 비노출과 모순) | 응답에 lockerSessionId/lockerUserId 미포함(AC-SRV-8) |
| now 미주입 회귀 테스트 | 30분 stale 시한폭탄(다음 날부터 FAIL) | AC-CON-1/2 에 now 고정 전달 NFR 명기(spec §6.2) |

---

## 5. 검증 명령 (실제 레이아웃 기준)

- 백엔드: `npm test` (= `node --experimental-sqlite --test --experimental-test-coverage test/*.test.js`)
- 프론트: `npm run test:web` (= `vitest run --root web`)
- 빌드: `npm run build` (= `vite build web`)
- 린트: `npm run lint`

---

## 6. Exclusions (계획 범위 밖)

spec.md §9 Exclusions 를 그대로 따른다. 특히: 잠금 상실 편집자 실시간 알림/축출 UX, 감사 로그, 30분 TTL 변경,
WritePage 잠금 의미론 변경, 기존 보유자-한정 해제 계약 변경, 새 락 스토어/채널/토큰, DB 스키마 변경/삭제,
news.md 수정, 코드 외 타 SPEC 3파일 수정.

---

Version: 0.1.1
Status: Plan
Last Updated: 2026-06-10
