---
id: SPEC-NEWS-REVISE-002
artifact: acceptance
version: 0.1.0
created: 2026-06-02
updated: 2026-06-02
---

# Acceptance — SPEC-NEWS-REVISE-002

본 파일은 spec.md §4의 EARS 요구사항에 대한 **테스트 가능한 Given-When-Then 시나리오**와 **Definition of Done**을 정리한다. 모든 시나리오는 Vitest + jsdom + @testing-library/react (프론트엔드), Vitest + `node:sqlite` (백엔드) 조합으로 자동화 가능하다.

---

## 1. REQ-DB-LOCKYN — 시나리오

### Scenario AC-LOCKYN-1: Contents 테이블 스키마에 lockYN 컬럼 존재

- **Given** 빈 SQLite 메모리 DB(`new DatabaseSync(':memory:')`)
- **When** `createSchema(db)` 호출 후 `db.prepare("PRAGMA table_info('Contents')").all()` 실행
- **Then** 반환 행 중 `name === 'lockYN'`인 컬럼이 정확히 1개 존재한다
- **And** 그 컬럼의 `notnull === 1` (NOT NULL)
- **And** 그 컬럼의 `dflt_value === "'N'"` (default `'N'`)

### Scenario AC-LOCKYN-2: 신규 행 insert 시 lockYN 미지정 → default 'N'

- **Given** `createSchema(db)` 직후, `createArticleModel(db).insert('AKR20260602001', { title: 'T', content: 'C', status: 'RDS' })` 호출 (lockYN 필드 미지정)
- **When** `findById('AKR20260602001')` 호출
- **Then** 결과 행의 `lockYN === 'N'`

### Scenario AC-LOCKYN-3: 직렬화 round-trip — lockYN='Y'로 insert/query

- **Given** insert 시 `lockYN: 'Y'`로 명시
- **When** `findById` 및 `query({ articleId: ... })` 호출
- **Then** 두 결과 모두 `lockYN === 'Y'`
- **And** `CONTENTS_COLUMNS` (Object.freeze 배열)에 `'lockYN'` 항목이 포함되어 있다 (`CONTENTS_COLUMNS.includes('lockYN') === true`)

---

## 2. REQ-EDIT-LOCK — 시나리오

### Scenario AC-EDIT-LOCK-1: 락 획득 성공 — `lockYN === 'N'`인 기사

- **Given** 기사 `AKR20260602001`이 RDS 상태, `lockYN === 'N'`
- **When** 사용자 U1 / 세션 S1이 `articleService.acquireEditLock('AKR20260602001', { userId: 'U1', sessionId: 'S1', now: T0 })` 호출
- **Then** 반환값 `{ ok: true }`
- **And** 해당 기사의 `lockYN === 'Y'`, `lockerUserId === 'U1'`, `lockerSessionId === 'S1'`, `lockedAt === T0`

### Scenario AC-EDIT-LOCK-2: 락 충돌 — 다른 사용자/세션의 진입 거부

- **Given** AC-EDIT-LOCK-1 상태(U1/S1이 락 보유 중)
- **When** 사용자 U2 / 세션 S2가 동일 기사로 `acquireEditLock` 호출
- **Then** 반환값 `{ ok: false, reason: 'locked' }` (또는 동등한 거부 코드)
- **And** DB 상의 `lockerUserId === 'U1'` 유지 (덮어쓰지 않음)
- **And** 프론트엔드 useWriteController는 `lockError` 상태를 설정하여 ALERT/배너로 안내

### Scenario AC-EDIT-LOCK-3: 락 해제 후 재획득 성공

- **Given** AC-EDIT-LOCK-1 상태
- **When** U1/S1이 `releaseEditLock('AKR20260602001', { userId: 'U1', sessionId: 'S1' })` 호출 → 그 후 U2/S2가 `acquireEditLock` 호출
- **Then** 1차 해제는 `{ ok: true }`이고 `lockYN === 'N'`, `lockerUserId === null`
- **And** 2차 획득은 `{ ok: true }`이고 `lockerUserId === 'U2'`

### Scenario AC-EDIT-LOCK-4: 브라우저 닫힘(beforeunload) → sendBeacon → 락 해제

- **Given** 프론트엔드 useWriteController가 락을 획득한 상태로 마운트됨
- **And** `navigator.sendBeacon`이 mock으로 stubbed
- **When** `window.dispatchEvent(new Event('beforeunload'))` (또는 `visibilitychange:hidden`)
- **Then** `navigator.sendBeacon`이 락 해제 endpoint URL과 페이로드(`{ articleId, userId, sessionId }`)로 정확히 1회 호출된다
- **And** 백엔드 endpoint가 호출되면 `lockYN === 'N'` 으로 전이된다 (통합 테스트 기준)

### Scenario AC-EDIT-LOCK-5: 동일 사용자의 다른 페이지/탭 진입 거부 (D2-5 = A)

- **Given** U1이 페이지 P1(`sessionId === 'S1-P1'`)에서 락 보유 중
- **When** 동일 사용자 U1이 페이지 P2(`sessionId === 'S1-P2'`)에서 동일 기사 `acquireEditLock` 호출
- **Then** 반환값 `{ ok: false, reason: 'locked' }` (다른 페이지 = 다른 sessionId로 간주)
- **And** P1의 락은 보존됨

### Scenario AC-EDIT-LOCK-6: articleUpdate가 락 보유자 검증 자동 수행

- **Given** U1이 락 보유 중인 기사
- **When** U2의 세션으로 `articleService.applyAction(articleId, 'D', 'send')` 호출 (락 미획득 상태)
- **Then** 반환값 `{ ok: false, reason: 'lock-required' }` (또는 동등)
- **And** 기사 status 변경되지 않음

### Scenario AC-EDIT-LOCK-7: 좀비 락 자동 해제 (D2-3 = 30분)

- **Given** 기사의 `lockYN === 'Y'`, `lockedAt === (now - 31분)`
- **When** 다른 사용자가 `acquireEditLock` 호출
- **Then** 반환값 `{ ok: true }` (좀비 락 자동 해제 후 신규 획득 성공)

---

## 3. REQ-API-INSERT-UPDATE-SPLIT — 시나리오

### Scenario AC-API-1: 신규 작성 컨텍스트에서 송고 → articleInsert 호출

- **Given** `useWriteController(user, {})` 마운트 (editArticleId 없음, 초기 articleId === 'A-DRAFT')
- **And** 본문 제목 채워짐, 모델은 mock으로 `articleInsert`/`articleUpdate` 두 메서드를 spy
- **When** `send()` 호출
- **Then** mock의 `articleInsert`가 DTO와 함께 1회 호출됨
- **And** `articleUpdate`는 호출되지 않음
- **And** 후속 `applyAction(newArticleId, role, 'send')`이 lifecycle 전이 적용

### Scenario AC-API-2: 편집 컨텍스트에서 송고 → articleUpdate 호출

- **Given** `useWriteController(user, { editArticleId: 'AKR20260602001' })` 마운트 (락 획득 성공, 본문 로드)
- **When** `send()` 호출 (제목 채워짐 상태)
- **Then** mock의 `articleUpdate`가 `('AKR20260602001', dto)`로 1회 호출됨
- **And** `articleInsert`는 호출되지 않음
- **And** 후속 `applyAction('AKR20260602001', role, 'send')` 호출

### Scenario AC-API-3: 편집 컨텍스트에서 KILL (R권한) → articleUpdate 호출

- **Given** `user.role === 'R'`, `editArticleId === 'AKR20260602001'`, status === 'RDS' (편집 컨텍스트)
- **When** `kill()` 호출
- **Then** `articleUpdate('AKR20260602001', dto)` 1회 호출
- **And** `articleInsert`는 호출되지 않음
- **And** `applyAction('AKR20260602001', 'R', 'kill')` → lifecycle 전이로 `RRK` 결과

### Scenario AC-API-4: 제목 없음 ALERT (회귀)

- **Given** 신규 작성 컨텍스트, 본문 제목 비어 있음
- **When** `send()` 또는 `hold()` 호출
- **Then** `actionError === '제목이 없어 송고/보류할 수 없습니다.'`
- **And** `articleInsert` / `articleUpdate` / `applyAction` 중 어느 것도 호출되지 않음

### Scenario AC-API-5: lifecycle 규칙 일관성

- **Given** 모든 (role, action) 조합에 대해
- **When** `applyAction`이 호출됨
- **Then** 결과 status가 `src/services/lifecycle.js` `TRANSITIONS` 표(SPEC-NEWS-REVISE-001 D-6 Z=D-mirror)와 정확히 일치
- **And** 권한 R/D/Z의 분기는 *컨텍스트(신규 vs 편집)* 와 직교 — 권한이 동일해도 컨텍스트에 따라 Insert vs Update가 결정된다

---

## 4. REQ-DETAIL-FONT-EMPHASIS — 시나리오

### Scenario AC-FONT-1: CSS 룰 단언 — 본문 폰트 > 제목 폰트

- **Given** `buildArticleDetailHtml(article)` 결과 HTML 문자열 (article 12 필드 채움)
- **When** HTML 내 `<style>` 블록을 추출하여 `.yh-detail__title { font-size: X.Xrem }` 와 `.yh-detail__content { font-size: Y.Yrem }` 정규식 매칭
- **Then** Y.Y > X.X (예: 1.75 > 1.3) — 본문 폰트가 제목 폰트보다 *크다*

### Scenario AC-FONT-2: 단언 방식 — 정규식 또는 getComputedStyle

- **Given** AC-FONT-1 결과
- **When** (선택) `JSDOM`으로 파싱 후 `getComputedStyle(titleEl).fontSize` 와 `getComputedStyle(contentEl).fontSize` 비교
- **Then** 본문이 더 크다 (jsdom 환산 신뢰도가 낮으면 정규식 단언으로 fallback — AC-FONT-1으로 충족)

### Scenario AC-FONT-3: 빈 제목 — placeholder 시에도 폰트 관계 유지

- **Given** `article.title === ''`, `article.content === '본문'`
- **When** HTML 렌더링 후 CSS 룰 검사
- **Then** `(제목 없음)` 플레이스홀더 텍스트가 제목 섹션 안에 존재
- **And** 폰트 사이즈 관계(.yh-detail__content > .yh-detail__title)는 그대로 유지

### Scenario AC-FONT-4: SPEC-NEWS-REVISE-001 AC-DTL-1~6 회귀 가드

- **Given** 본 SPEC의 폰트 변경 적용 후
- **When** `npx vitest run web/src/view/articleDetail.test.js`
- **Then** SPEC-NEWS-REVISE-001 AC-DTL-1 (분리 구조), AC-DTL-2 (시각적 분리), AC-DTL-3 (12 필드), AC-DTL-4 (빈 제목 placeholder), AC-DTL-5 (HTML 이스케이프), AC-DTL-6 (회귀 가드) 단언이 모두 통과한다

---

## 5. REQ-EDITOR-END-MARKER — 시나리오

### Scenario AC-ENDMARK-1: Alt+Y → 정확히 "(끝)" 삽입 (prefix 없음)

- **Given** 에디터 본문 `"본문 한 줄"` 상태, 포커스 보유
- **When** `Alt+Y` 키 이벤트 발화 (`{ altKey: true, key: 'y' }`)
- **Then** 본문 텍스트가 `"본문 한 줄(끝)"`로 변경된다 (정확히 `"(끝)"` 5바이트, prefix CRLF/공백 없음)

### Scenario AC-ENDMARK-2: 이미 "(끝)" 존재 시 noop

- **Given** 본문 `"본문(끝)"`
- **When** `Alt+Y` 발화
- **Then** 본문은 그대로 `"본문(끝)"` (중복 삽입 없음)

### Scenario AC-ENDMARK-3: 골드색 적용

- **Given** AC-ENDMARK-1 결과
- **When** 렌더링된 DOM에서 `(끝)` 텍스트 노드의 부모 또는 span을 조회
- **Then** 골드색을 나타내는 데이터 속성 또는 CSS class (`data-end-marker="true"` 또는 `style="color: gold"` 등 기존 구현 합의)가 적용되어 있다

### Scenario AC-ENDMARK-4: SPEC-NEWS-REVISE-001 AC-CTRL-D-5 단언 갱신 정합

- **Given** SPEC-NEWS-REVISE-001 `acceptance.md` §3 AC-CTRL-D-5의 단언이 `"\r\n (끝)"`을 단언하고 있었음
- **When** 본 SPEC 적용 후 동일 회귀 가드를 실행
- **Then** 단언 문자열이 `"(끝)"`로 갱신되어 있고 GREEN
- **And** 본 SPEC의 REQ-EDITOR-END-MARKER가 SPEC-NEWS-REVISE-001 AC-CTRL-D-5와 충돌하지 않는다 (단언 동기화 완료)

---

## 6. REQ-EMBED-DELETE — 시나리오

### Scenario AC-EMB-DEL-1: 임베드 단일 노드 삭제 — × 버튼 또는 Backspace

- **Given** 본문에 임베드 노드 3개 (`[E1, text, E2, text, E3]`) 가 존재
- **When** E2를 포커스한 후 (a) 노드의 × 버튼 클릭 또는 (b) `Backspace` 키 발화
- **Then** 본문에서 E2만 제거됨 (`[E1, text, text, E3]`)
- **And** E1, E3은 그대로 보존됨
- **And** 인접 텍스트 노드는 변경 없음

### Scenario AC-EMB-DEL-2: 인접 보존 — 텍스트와 다른 임베드는 영향 없음

- **Given** 본문 `"AAA"` + 임베드 E1 + `"BBB"` + 임베드 E2 + `"CCC"`
- **When** E1 삭제
- **Then** 본문 텍스트는 `"AAA"`, `"BBB"`, `"CCC"` 모두 보존 (병합/누락 없음)
- **And** E2는 보존

### Scenario AC-EMB-DEL-3: markup round-trip — 삭제 결과 영구 반영

- **Given** AC-EMB-DEL-1 직후 `markup = adapter.getMarkup()`
- **When** 새 adapter `adapter2`에 `adapter2.setMarkup(markup)` 호출
- **Then** 복원된 본문에 E2는 존재하지 않음 (`adapter2.getStructure().embeds.length === 2`)
- **And** E1, E3은 동일 위치 + 동일 데이터로 복원

### Scenario AC-EMB-DEL-4: SPEC-NEWS-REVISE-001 AC-EMB-1~3 회귀

- **Given** 본 SPEC의 삭제 기능 적용 후
- **When** 커서 위치 임베드 삽입(AC-EMB-1), 후속 입력 영속성(AC-EMB-2), getMarkup round-trip 영속성(AC-EMB-3) 테스트 실행
- **Then** 3 단언 모두 GREEN (삭제 기능이 삽입/영속성 동작을 깨뜨리지 않음)

### Scenario AC-EMB-DEL-5: 접근성 — × 어포던스 aria-label

- **Given** 임베드 노드가 hover/focus 상태
- **When** × 버튼이 렌더링됨
- **Then** 버튼은 `aria-label="임베드 삭제"` (또는 동등한 접근 텍스트)를 가진다
- **And** 키보드 Tab으로 포커스 가능

---

## 7. REQ-SEARCH-YOUTUBE-API — 시나리오

### Scenario AC-SEARCH-1: Youtube provider 정상 호출

- **Given** mock Youtube provider가 `[{ title, url, thumbnailUrl }, ...]` 반환
- **When** `mediaSearch.search('query')` (또는 동등 API) 호출
- **Then** Youtube provider의 `search('query')`가 1회 호출됨
- **And** 결과의 각 아이템의 `source === 'youtube'` (또는 normalize 결과)
- **And** Google provider는 호출되지 않음

### Scenario AC-SEARCH-2: Youtube 실패 → Google fallback

- **Given** mock Youtube provider가 throw (또는 `safeSearch`가 빈 배열 반환)
- **And** mock Google provider가 결과 반환
- **When** `mediaSearch.search('query')` 호출
- **Then** Youtube provider 호출 → 실패 → Google provider 호출
- **And** 결과의 `source === 'google'`

### Scenario AC-SEARCH-3: 글기사 탭 내부 검색

- **Given** DB에 `title === '테스트 제목'`인 기사 1건이 존재
- **When** 글기사 탭의 검색이 `articleService.searchArticles('테스트')` 또는 동등 메서드 호출
- **Then** 결과에 해당 기사가 포함됨 (title/content LIKE 검색)
- **And** 결과는 임베딩 카드 형태로 정규화 가능 (`{ articleId, title, content (preview) }`)

### Scenario AC-SEARCH-4: API 키 비노출 회귀

- **Given** `process.env.YOUTUBE_API_KEY === 'SECRET_KEY'`
- **When** `mediaSearch.search('query')` 결과 반환
- **Then** 결과 아이템의 어떤 필드에도 `'SECRET_KEY'` 문자열이 포함되지 않음
- **And** `JSON.stringify(result).includes('SECRET_KEY') === false`

---

## 8. 비기능 시나리오

### Scenario NFR-A11Y: 접근성

- 락 거부 안내는 `aria-live="assertive"` (또는 동등 ARIA)
- 임베드 × 어포던스는 `aria-label`을 가지며 키보드 포커스 가능
- 상세보기 제목/본문 섹션은 `aria-label` 그대로 유지 (SPEC-NEWS-REVISE-001 회귀)

### Scenario NFR-DESIGN: 디자인 토큰

- 신규 CSS 변수 도입 없음 (`grep -r '--yh-' web/src/styles/` 결과에 새 변수 추가 없음)
- 본문 폰트 강조는 절대값 rem만 사용
- 색은 기존 `--yh-blue` `#0A4DA6` 유지 (news.md의 `#C8102E`는 미적용 — CLAUDE.md "파란색과 흰색" 규칙 우선)

### Scenario NFR-REG: 회귀 가드

- `npm test` 전체 통과 (기존 14+ 테스트 파일 모두)
- `npm run build` 무경고
- SPEC-NEWS-REVISE-001 AC 세트 모두 GREEN (AC-CTRL-D-5는 단언 문자열 `"(끝)"`로 갱신된 채 GREEN)
- SPEC-DB-FOUNDATION-001 / SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001 / SPEC-UI-EDITOR-001 / SPEC-AUTH-001 의 기존 AC 회귀 없음
- 디자인 토큰 `--yh-blue` `#0A4DA6` 유지

### Scenario NFR-PERF: 성능

- 락 획득/해제 응답시간: P95 < 100ms (단일 SQLite, 단일 UPDATE)
- `beforeunload` 핸들러 실행이 `navigator.sendBeacon` 단일 호출로 끝나며 페이지 unload를 지연시키지 않음
- 임베드 삭제: DOM 노드 1개 제거 + adapter 상태 재계산이 1프레임(약 16ms) 내에 완료

### Scenario NFR-SEC: 보안

- 락 보유자 식별 정보(`lockerUserId`, `lockerSessionId`)는 백엔드 세션 컨텍스트에서 가져옴 (클라이언트 사칭 금지)
- Youtube/Google API 키는 응답 페이로드에 포함되지 않음 (AC-SEARCH-4)
- HTML 이스케이프 회귀 없음 (SPEC-NEWS-REVISE-001 AC-DTL-5 유지)

---

## 9. Quality Gate Criteria (TRUST 5)

- **Tested**: 신규/변경 코드 커버리지 85% 이상. RED-GREEN-REFACTOR 사이클 적용. 백엔드(서비스/모델)와 프론트엔드(컨트롤러/뷰) 양쪽에 단위/통합 테스트 추가.
- **Readable**: ESLint/Prettier 무경고. 한국어 코드 주석은 `code_comments` 설정 따름. 함수명은 영어(예: `acquireEditLock`).
- **Unified**: 기존 코드 스타일 일치 (yh-* CSS 클래스 네이밍 유지, `createSchema`/`ensureUserActiveColumn` 패턴 재사용).
- **Secured**: 락 보유자 백엔드 세션 식별, Youtube/Google 키 비노출, HTML 이스케이프 유지, race-safe 단일 UPDATE.
- **Trackable**: commit 메시지에 `SPEC-NEWS-REVISE-002` 및 REQ-* ID 포함. Slack `tech-day` 채널 보고.

---

## 10. Definition of Done

전체 spec.md §12와 본 acceptance.md §1~§9 시나리오 전부에 더해:

- [ ] 본 acceptance.md의 모든 Scenario(AC-LOCKYN-1~3, AC-EDIT-LOCK-1~7, AC-API-1~5, AC-FONT-1~4, AC-ENDMARK-1~4, AC-EMB-DEL-1~5, AC-SEARCH-1~4)가 자동화 테스트로 존재하고 GREEN
- [ ] Pending Decisions (D2-1 ~ D2-8) 사용자 승인 완료
- [ ] 미커밋 작업트리(`news.md`, `ContentsVO.md`, `articleDetail.js`, `articleDetail.test.js`)의 commit 정리 결정 완료 (사용자 권한)
- [ ] `npm test`, `npm run build` 통과
- [ ] SPEC-NEWS-REVISE-001 AC-CTRL-D-5의 단언 문자열이 `"(끝)"`로 갱신되어 본 SPEC AC-ENDMARK-1과 정합
- [ ] news.md / ContentsVO.md / SPEC-NEWS-REVISE-002 정합 확인
- [ ] **Slack `tech-day` 채널(ID `C0B69CG59UM`)에 작업 완료 보고 (CLAUDE.md HARD 규칙)**
- [ ] `/moai sync SPEC-NEWS-REVISE-002` 실행 및 docs 동기화
- [ ] TRUST 5 게이트 통과 (Tested ≥ 85% / Readable / Unified / Secured / Trackable)

---

Version: 0.1.0
