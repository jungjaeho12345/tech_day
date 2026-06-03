---
id: SPEC-NEWS-REVISE-003
artifact: acceptance
version: 0.1.0
created: 2026-06-03
updated: 2026-06-03
---

# Acceptance — SPEC-NEWS-REVISE-003

본 파일은 `spec.md` §4 의 EARS 요구사항(6 REQ) 에 대한 **테스트 가능한 Given-When-Then 시나리오**와 **Definition of Done**을 정리한다. 모든 시나리오는 Vitest + jsdom + @testing-library/react (프론트엔드), Vitest + `node:sqlite` (백엔드) 조합으로 자동화 가능하다. 본 SPEC 의 AC 는 SPEC-NEWS-REVISE-001/002 의 AC 를 *대체하지 않고 보강* 한다 (회귀 가드 + 정합 단언).

각 AC 항목 옆에 `[검증 명령]` + `[통과 기준]` + `[매핑 REQ + 토픽]` 을 표기한다. evaluator-active 가 별도 해석 없이 PASS/FAIL 산출 가능하도록 작성.

---

## 1. REQ-MEDIA-TAB-SEARCH — 시나리오 (토픽 A)

### Scenario AC-MEDIA-1: 이미지탭/영상탭 검색 → Youtube Data API 호출 (Youtube 정상)

- **Given** `src/services/mediaSearch.js` 가 Youtube provider mock 과 Google provider mock 으로 구성되고, Youtube mock 이 정상 응답 (`{items: [{id, snippet}]}`) 을 반환하도록 설정
- **When** `searchMedia({ tab: 'image', query: '올림픽' })` 또는 `searchMedia({ tab: 'video', query: '올림픽' })` 호출
- **Then** Youtube provider mock 이 정확히 1 회 호출됨 (`youtubeProvider.search.mock.calls.length === 1`)
- **And** Google provider mock 이 호출되지 않음 (`googleProvider.search.mock.calls.length === 0`)
- **And** 반환 결과가 임베딩 카드 페이로드(`{source, title, url, thumbnailUrl}`) 배열
- `[검증 명령]` `npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js -t "AC-MEDIA-1"`
- `[통과 기준]` 위 단언이 모두 GREEN
- `[매핑]` REQ-MEDIA-TAB-SEARCH / 토픽 A

### Scenario AC-MEDIA-2: Youtube 실패 → Google 폴백

- **Given** Youtube provider mock 이 HTTP 503 또는 throw 로 실패하도록 설정, Google provider mock 이 정상 응답 반환
- **When** `searchMedia({ tab: 'image', query: '올림픽' })` 호출
- **Then** Youtube provider mock 이 호출됨 (`youtubeProvider.search.mock.calls.length === 1`)
- **And** Google provider mock 이 후속 호출됨 (`googleProvider.search.mock.calls.length === 1`)
- **And** 최종 반환 결과가 Google mock 의 응답을 정규화한 카드 페이로드
- `[검증 명령]` `npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js -t "AC-MEDIA-2"`
- `[통과 기준]` Youtube 호출 후 Google 폴백 호출 + 결과 정규화
- `[매핑]` REQ-MEDIA-TAB-SEARCH / 토픽 A

### Scenario AC-MEDIA-3: 글기사탭 → 내부 기사 DB 검색만 (외부 API 미호출)

- **Given** Youtube/Google provider mock 모두 throw 하도록 설정 (호출되면 즉시 실패), `articleService.searchArticles` mock 이 정상 응답 반환
- **When** `searchMedia({ tab: 'article', query: '올림픽' })` 호출
- **Then** Youtube provider mock 미호출 (`youtubeProvider.search.mock.calls.length === 0`)
- **And** Google provider mock 미호출 (`googleProvider.search.mock.calls.length === 0`)
- **And** `articleService.searchArticles` mock 이 정확히 1 회 호출됨, 파라미터에 query='올림픽' 포함
- **And** 반환 결과가 내부 기사 카드 페이로드 배열
- `[검증 명령]` `npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js -t "AC-MEDIA-3"`
- `[통과 기준]` 외부 API 0 호출 + 내부 검색만 1 호출
- `[매핑]` REQ-MEDIA-TAB-SEARCH / 토픽 A

### Scenario AC-MEDIA-4: API 키 응답 페이로드 비노출 회귀 가드

- **Given** `process.env.YOUTUBE_API_KEY = 'AIza-FAKE-DO-NOT-LEAK-TOKEN'`, `process.env.GOOGLE_API_KEY = 'AIza-FAKE-DO-NOT-LEAK-GOOGLE'` 환경에서 Youtube provider mock 이 응답 객체에 키를 *의도적으로 포함시킨* 결과를 반환 (악성 응답 시뮬레이션)
- **When** `searchMedia({ tab: 'image', query: 'x' })` 호출 → 결과 `response`
- **Then** `JSON.stringify(response).includes(process.env.YOUTUBE_API_KEY)` === `false`
- **And** `JSON.stringify(response).includes(process.env.GOOGLE_API_KEY)` === `false`
- **And** `response` 의 어떤 항목에도 `apiKey` / `key` / `accessToken` 키가 존재하지 않음
- `[검증 명령]` `npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js -t "AC-MEDIA-4"`
- `[통과 기준]` 응답 직렬화에서 API 키 토큰이 어떤 위치에도 발견되지 않음
- `[매핑]` REQ-MEDIA-TAB-SEARCH / 토픽 A (보안)

---

## 2. REQ-DETAIL-BODY-EMPHASIS — 시나리오 (토픽 B)

### Scenario AC-EMPH-1: 본문 폰트 사이즈 > 제목 폰트 사이즈 (CSS 룰 단언)

- **Given** 정상 article 객체 (`title='테스트 제목'`, `content='테스트 본문 내용'`, 공통정보 12 필드 채움)
- **When** `buildArticleDetailHtml(article)` 호출 → HTML 문서 문자열을 `JSDOM` 또는 `DOMParser` 로 파싱
- **Then** `.yh-detail__content` 의 `font-size` 가 `.yh-detail__title` 의 `font-size` 보다 *수치적으로* 크다
  - 추출 방법: CSS 룰 텍스트에서 `font-size:\s*([\d.]+)rem` 정규식으로 추출
  - 단언: `parseFloat(contentSize) > parseFloat(titleSize)`
- `[검증 명령]` `npm test --prefix web -- web/src/view/articleDetail.test.js -t "AC-EMPH-1"`
- `[통과 기준]` content > title 수치 비교가 true
- `[매핑]` REQ-DETAIL-BODY-EMPHASIS / 토픽 B

### Scenario AC-EMPH-2: jsdom getComputedStyle 보조 비교

- **Given** AC-EMPH-1 의 HTML 을 `jsdom` 환경에 마운트 (`document.body.innerHTML = html`)
- **When** `getComputedStyle(document.querySelector('.yh-detail__content')).fontSize` 와 `getComputedStyle(document.querySelector('.yh-detail__title')).fontSize` 비교
- **Then** content `font-size` 가 title `font-size` 보다 크다 (단위 정규화 후 px 비교)
- **And** 만약 jsdom 이 `getComputedStyle` 미지원으로 빈 문자열 반환 시 AC-EMPH-1 의 정규식 fallback 으로 단언 (둘 중 하나는 반드시 GREEN)
- `[검증 명령]` `npm test --prefix web -- web/src/view/articleDetail.test.js -t "AC-EMPH-2"`
- `[통과 기준]` content > title 또는 AC-EMPH-1 fallback GREEN
- `[매핑]` REQ-DETAIL-BODY-EMPHASIS / 토픽 B

### Scenario AC-EMPH-3: 빈 제목 케이스 — `(제목 없음)` 플레이스홀더 (003 고유)

- **Given** `article.title = ''` (또는 `null`), `article.content = '본문이 있음'`
- **When** `buildArticleDetailHtml(article)` 호출 → 파싱
- **Then** 제목 섹션이 여전히 존재 (`aria-label="제목"` 섹션 1 개)
- **And** 제목 섹션의 텍스트가 `(제목 없음)` 플레이스홀더
- **And** 본문 섹션(`aria-label="본문"`) 도 분리되어 존재
- **And** content `font-size` > title `font-size` (`(제목 없음)` 플레이스홀더에 대해서도 폰트 사이즈 비교 관계 유지)
- `[검증 명령]` `npm test --prefix web -- web/src/view/articleDetail.test.js -t "AC-EMPH-3"`
- `[통과 기준]` 빈 제목 + 플레이스홀더 + 폰트 비교 모두 GREEN
- `[매핑]` REQ-DETAIL-BODY-EMPHASIS / 토픽 B (003 고유 보강)

### Scenario AC-EMPH-4: SPEC-NEWS-REVISE-001 분리 구조 회귀 가드

- **Given** 정상 article 객체 (12 공통정보 필드 채움)
- **When** `buildArticleDetailHtml(article)` 호출 → 파싱
- **Then** `aria-label="제목"` 섹션 정확히 1 개, `aria-label="본문"` 섹션 정확히 1 개
- **And** 두 섹션이 동일 부모의 형제 노드
- **And** 두 섹션 사이에 1px `#DDD` 또는 `--yh-gray-line` 토큰의 회색 구분선 또는 섹션 헤더 존재
- **And** 상단 공통정보 섹션의 `<dt>` 노드 enumerate 결과가 다음 12 label 을 모두 정확히 한 번씩 포함: 작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고
- `[검증 명령]` `npm test --prefix web -- web/src/view/articleDetail.test.js -t "AC-EMPH-4"`
- `[통과 기준]` SPEC-NEWS-REVISE-001 AC-DTL-1, 2, 3 의 단언이 회귀 없이 GREEN
- `[매핑]` REQ-DETAIL-BODY-EMPHASIS / 토픽 B (NEWS-REVISE-001 회귀 가드)

---

## 3. REQ-ARTICLE-LOCK-YN — 시나리오 (토픽 C)

### Scenario AC-LOCK-1: 정상 진입 — 락 획득 (1 인 1 페이지 정책 기본값)

- **Given** 기사 `AKR-001` 이 RDS 상태, `Contents.lockYN === 'N'`, 사용자 U1 의 세션 S1 / 페이지 P1
- **When** U1/S1/P1 이 `acquireEditLock('AKR-001', { userId: 'U1', sessionId: 'S1', pageId: 'P1', now: T0 })` 호출
- **Then** 반환값 `{ ok: true }`
- **And** DB 의 `Contents.lockYN === 'Y'`, `lockOwner === 'U1'` (또는 `lockerUserId`), `lockerSessionId === 'S1'`, `lockerPageId === 'P1'`, `lockedAt === T0`
- **And** 002 AC-EDIT-LOCK-1 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-1"`
- `[통과 기준]` 락 획득 + 보유자/페이지 ID 기록 모두 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C

### Scenario AC-LOCK-2: 정상 해제 — 송고/보류/KILL/취소/beforeunload

- **Given** AC-LOCK-1 상태 (U1/S1/P1 락 보유)
- **When** 다음 5 가지 trigger 중 하나가 발생:
  1. 송고 성공 → 후속 cleanup
  2. 보류 성공 → 후속 cleanup
  3. KILL 성공 → 후속 cleanup
  4. 사용자 명시적 종료 (cancel 버튼)
  5. `beforeunload` 또는 `visibilitychange:hidden` + `navigator.sendBeacon` 호출
- **Then** 각 trigger 후 DB 의 `Contents.lockYN === 'N'`, 락 보유자 정보가 비워짐 (`lockOwner === null` 또는 빈 문자열)
- **And** 002 AC-EDIT-LOCK-3, AC-EDIT-LOCK-4 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-2"`
- `[통과 기준]` 5 trigger 모두 락 해제 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C

### Scenario AC-LOCK-3: 다른 사용자 차단 — read-only 안내

- **Given** AC-LOCK-1 상태 (U1/S1/P1 락 보유 중)
- **When** 다른 사용자 U2/S2/P2 가 동일 기사로 `acquireEditLock` 호출
- **Then** 반환값 `{ ok: false, reason: 'locked', holder: { userId: 'U1', lockedAt: T0 } }` (또는 동등한 거부 + 보유자 정보)
- **And** DB 의 락 보유자 정보 변경 없음 (`lockOwner === 'U1'`, `lockerPageId === 'P1'`)
- **And** 프론트엔드 useWriteController 에 `lockError` 상태 + read-only 모드 안내 (`aria-live="assertive"` ALERT 또는 inline banner)
- **And** 002 AC-EDIT-LOCK-2 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-3"`
- `[통과 기준]` 거부 + 보유자 정보 + read-only 안내 모두 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C

### Scenario AC-LOCK-4: 같은 사용자 다른 탭/페이지 차단 (003 고유 — 1 인 1 페이지)

- **Given** U1/S1/P1 이 락 보유 중 (AC-LOCK-1)
- **When** 동일 사용자 U1, 동일 세션 S1, *다른* 페이지 ID P2 (예: localStorage UUID 가 다른 두 번째 탭) 로 `acquireEditLock('AKR-001', { userId: 'U1', sessionId: 'S1', pageId: 'P2', now: T1 })` 호출
- **Then** 반환값 `{ ok: false, reason: 'locked', holder: { userId: 'U1', pageId: 'P1', lockedAt: T0 } }`
- **And** DB 의 `lockerPageId` 가 여전히 `'P1'` (P2 로 덮어쓰지 않음)
- **And** UI 안내: "해당 기사는 다른 페이지/세션에서 편집 중입니다."
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-4"`
- `[통과 기준]` 같은 사용자/세션 + 다른 페이지 ID 진입 거부 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C (003 고유 1 인 1 페이지 정책)

### Scenario AC-LOCK-5: TTL / heartbeat 회복 — 좀비 락 자동 해제

- **Given** U1/S1/P1 이 락 보유 중, `lockedAt = T0`. TTL 기본값 30 분 (Pending R3)
- **When** 현재 시각 `now = T0 + 30 minutes + 1 second` 인 상태에서 U2/S2/P2 가 `acquireEditLock` 호출
- **Then** 시스템이 TTL 초과 락을 자동 해제 (`lockYN := 'N'` 후 U2 의 획득 진행)
- **And** 반환값 `{ ok: true }` (U2 가 락 획득 성공)
- **And** DB 의 `lockOwner === 'U2'`, `lockerPageId === 'P2'`, `lockedAt === T0 + 30m + 1s`
- **And** 옵션 heartbeat 활성화 시 1 분 간격 갱신으로 좀비 락 검출 윈도우 더 짧음 (단언은 30 분 TTL 만)
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-5"`
- `[통과 기준]` TTL 초과 자동 해제 + 새 보유자 획득 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C (좀비 락 회복)

### Scenario AC-LOCK-6: `articleUpdate` 자동 락 검증

- **Given** U1/S1/P1 이 락 보유 중. U2/S2/P2 는 락 미보유 (AC-LOCK-3 시점)
- **When** U2 가 직접 `articleUpdate('AKR-001', { action: 'send', ... })` API 호출 (UI 우회 시뮬레이션)
- **Then** 서버가 락 보유자 검증에 실패하여 4xx 응답 (403 Forbidden 권장; 또는 422 Unprocessable Entity)
- **And** DB 의 기사 상태 변경 없음 (`status` 와 `markupVersion` 모두 변경 없음)
- **And** DB 의 `lockOwner === 'U1'` 유지
- **And** 002 AC-EDIT-LOCK-6 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test -- src/services/__tests__/editLockBehavior.test.js -t "AC-LOCK-6"`
- `[통과 기준]` 락 미보유자의 articleUpdate 거부 + DB 무변경
- `[매핑]` REQ-ARTICLE-LOCK-YN / 토픽 C (자동 검증)

---

## 4. REQ-WRITE-LIFECYCLE-API — 시나리오 (토픽 D)

### Scenario AC-WLC-1: 신규 작성 → `articleInsert` 경로

- **Given** `useWriteController` 의 상태가 `editArticleId === null` 이고 URL 에 `id` 파라미터 없음. 권한 R, 제목 "신규 기사", 본문 "내용"
- **When** 송고 또는 보류 버튼 클릭 → `submitAction('send')` 또는 `submitAction('hold')`
- **Then** `model.articleInsert` mock 이 정확히 1 회 호출됨
- **And** `model.articleUpdate` mock 미호출 (`articleUpdate.mock.calls.length === 0`)
- **And** 002 AC-API-1 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/controller/useWriteController.test.jsx -t "AC-WLC-1"`
- `[통과 기준]` Insert 1 회 + Update 0 회
- `[매핑]` REQ-WRITE-LIFECYCLE-API / 토픽 D

### Scenario AC-WLC-2: 편집 → `articleUpdate` 경로

- **Given** `useWriteController` 의 상태가 `editArticleId === 'AKR-001'`. 권한 R/D/Z 중 R, 기사 상태 RDS, 제목 "편집 제목", 본문 "편집 내용"
- **When** 송고 또는 보류 버튼 클릭
- **Then** `model.articleUpdate` mock 이 정확히 1 회 호출됨 (파라미터: articleId='AKR-001')
- **And** `model.articleInsert` mock 미호출
- **And** 002 AC-API-2 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/controller/useWriteController.test.jsx -t "AC-WLC-2"`
- `[통과 기준]` Update 1 회 + Insert 0 회
- `[매핑]` REQ-WRITE-LIFECYCLE-API / 토픽 D

### Scenario AC-WLC-3: 편집 + KILL → `articleUpdate` 경로

- **Given** AC-WLC-2 와 동일 상태. 권한 R, RDS
- **When** KILL 버튼 클릭 → `submitAction('kill')`
- **Then** `model.articleUpdate` mock 이 정확히 1 회 호출됨, 파라미터에 `action: 'kill'` 포함
- **And** `model.articleInsert` mock 미호출
- **And** 002 AC-API-3 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/controller/useWriteController.test.jsx -t "AC-WLC-3"`
- `[통과 기준]` Update 1 회 (action=kill) + Insert 0 회
- `[매핑]` REQ-WRITE-LIFECYCLE-API / 토픽 D

### Scenario AC-WLC-4: 제목 빈 입력 → ALERT + API 미호출

- **Given** 작성 페이지 (신규 또는 편집), 제목 입력 필드가 빈 문자열 `''` 또는 공백만 `'   '`
- **When** 송고 또는 보류 버튼 클릭
- **Then** `window.alert` (또는 `useWriteController.alert` mock) 이 정확히 1 회 호출됨, 메시지에 "제목" 단어 포함 (정규식 `/제목.*없/`)
- **And** `model.articleInsert` mock 미호출
- **And** `model.articleUpdate` mock 미호출
- **And** 002 AC-API-4 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/WritePage.test.jsx -t "AC-WLC-4"`
- `[통과 기준]` ALERT 1 회 + Insert/Update 모두 0 회
- `[매핑]` REQ-WRITE-LIFECYCLE-API / 토픽 D

### Scenario AC-WLC-5: 분기 오용 회귀 가드 — 권한 영향 없음 + 컨텍스트 단일 기준

- **Given** 다음 6 가지 조합:
  - {권한 R, 신규 작성}
  - {권한 D, 신규 작성}
  - {권한 Z, 신규 작성}
  - {권한 R, 편집}
  - {권한 D, 편집}
  - {권한 Z, 편집}
- **When** 각 조합에서 송고 클릭
- **Then** 신규 작성 3 케이스 모두 `articleInsert` 호출, `articleUpdate` 0 회
- **And** 편집 3 케이스 모두 `articleUpdate` 호출, `articleInsert` 0 회
- **And** 권한 R/D/Z 의 *분기 결정*에 영향 없음 (분기는 컨텍스트만 사용)
- `[검증 명령]` `npm test --prefix web -- web/src/controller/useWriteController.test.jsx -t "AC-WLC-5"`
- `[통과 기준]` 6 조합 매트릭스가 정합
- `[매핑]` REQ-WRITE-LIFECYCLE-API / 토픽 D (003 고유 분기 오용 가드)

---

## 5. REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT — 시나리오 (토픽 E)

### Scenario AC-EMB-DEL-1: 단일 임베드 삭제 — 본문 텍스트 보존

- **Given** 에디터 본문에 `"AAA"` + 임베드 카드 1 개 + `"BBB"` 순서로 콘텐츠가 있음
- **When** 임베드 카드 위에 마우스 hover → × 어포던스 클릭 (또는 노드 선택 후 `Delete` / `Backspace`)
- **Then** 본문에서 임베드 노드가 제거됨
- **And** 본문 텍스트가 `"AAA"` + `"BBB"` 로 남음 (인접 텍스트 보존)
- **And** 002 AC-EMB-DEL-1 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/InlineEmbed.test.jsx -t "AC-EMB-DEL-1"`
- `[통과 기준]` 임베드 1 개 제거 + 텍스트 보존
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E

### Scenario AC-EMB-DEL-2: 다중 임베드 중 하나만 삭제

- **Given** 본문에 임베드 3 개 (`E1`, `E2`, `E3`) 가 텍스트 `"AAA E1 BBB E2 CCC E3 DDD"` 순서로 분포
- **When** 가운데 임베드 `E2` 의 × 어포던스 클릭
- **Then** 본문이 `"AAA E1 BBB CCC E3 DDD"` 로 됨 (`E1` 과 `E3` 보존)
- **And** `BBB` / `CCC` 텍스트 보존
- `[검증 명령]` `npm test --prefix web -- web/src/view/InlineEmbed.test.jsx -t "AC-EMB-DEL-2"`
- `[통과 기준]` 1 개 삭제, 나머지 2 개 + 모든 텍스트 보존
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E

### Scenario AC-EMB-DEL-3: markupVersion round-trip 후 삭제 반영 (영구)

- **Given** AC-EMB-DEL-1 후 상태 (임베드 삭제 후 본문 `"AAA"` + `"BBB"`)
- **When** `adapter.getMarkup()` → 새 어댑터 인스턴스 `setMarkup(...)` round-trip
- **Then** 복원된 본문에 삭제된 임베드 노드가 *복원되지 않음* (silent revival 부재)
- **And** SPEC-NEWS-REVISE-001 AC-EMB-3 의 단언(삽입한 임베드는 round-trip 후 복원됨) 은 *삭제하지 않은* 임베드에 한해 GREEN 유지
- **And** 002 AC-EMB-DEL-3 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/InlineEmbed.test.jsx -t "AC-EMB-DEL-3"`
- `[통과 기준]` 삭제된 임베드 round-trip 복원 부재 + 살아있는 임베드 복원 GREEN
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E (영속성)

### Scenario AC-ALTY-1: Alt+Y → 정확히 `(끝)` 삽입 (선행 `\r\n` 없음)

- **Given** 에디터가 포커스를 가지고, 본문 끝의 마지막 문자가 임의의 평문 (예: `"본문 마지막 문장."`)
- **When** `Alt+Y` 키 이벤트 발화 (`keydown`, `altKey: true`, `key: 'y'` 또는 `'Y'`)
- **Then** 본문 끝에 정확히 문자열 `(끝)` 가 1 회 삽입됨
- **And** 삽입된 토큰 직전에 `\r` 또는 `\n` 또는 공백이 *추가로* 들어가지 않음 (정규식 단언: `/[^\r\n ]\(끝\)$/` 가 매치)
- **And** 삽입된 `(끝)` 토큰에 골드색 데이터 속성 또는 스타일 적용 (예: `data-token="end-marker"` 또는 인라인 `color: gold` 또는 클래스 `yh-end-marker`)
- **And** 002 AC-ENDMARK-1 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/editorShortcuts.test.js -t "AC-ALTY-1"`
- `[통과 기준]` `(끝)` 정확 문자열 + 선행 개행 없음 + 골드색 단언
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E (Alt+Y 정확 텍스트)

### Scenario AC-ALTY-2: 이미 `(끝)` 존재 시 noop

- **Given** 본문 끝이 이미 `(끝)` 으로 끝남
- **When** `Alt+Y` 키 이벤트 추가 발화
- **Then** 본문이 변경되지 않음 (`(끝)` 토큰이 1 개만 유지, 2 개 이상 누적되지 않음)
- **And** 002 AC-ENDMARK-2 의 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/editorShortcuts.test.js -t "AC-ALTY-2"`
- `[통과 기준]` noop (본문 길이/내용 변경 없음)
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E

### Scenario AC-REG-1: SPEC-NEWS-REVISE-001 회귀 가드 (인라인 임베드 + Ctrl+D)

- **Given** SPEC-NEWS-REVISE-001 AC-EMB-1 (커서 위치 삽입), AC-EMB-2 (영속성), AC-EMB-3 (round-trip), AC-CTRL-D-1~4 (라인 삭제) 의 기존 테스트 케이스
- **When** 본 SPEC 의 모든 변경이 적용된 상태로 기존 테스트 실행
- **Then** 모든 단언이 GREEN
- **And** AC-CTRL-D-5 는 SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER 에 의해 단언 문자열이 `(끝)` 로 갱신된 상태로 GREEN
- `[검증 명령]` `npm test --prefix web -- web/src/view/InlineEmbed.test.jsx`, `npm test --prefix web -- (Ctrl+D 관련 테스트 파일)`
- `[통과 기준]` SPEC-NEWS-REVISE-001 AC-EMB-*, AC-CTRL-D-* 모두 회귀 없음
- `[매핑]` REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT / 토픽 E (SPEC-001 회귀)

---

## 6. REQ-API-LIFECYCLE-RULE — 시나리오 (토픽 F)

### Scenario AC-LIFE-1: 정상 전이 — R / D / Z × 송고 / 보류 / KILL 매트릭스 (RDS 진입)

- **Given** 빈 SQLite DB. SPEC-NEWS-REVISE-001 D-6 의 lifecycle 전이표가 다음과 같이 정의됨 (news.md "기사 생애주기" 와 정합):
  - R/RDS/send → RDS
  - R/RDS/hold → RRH
  - R/RDS/kill → RRK
  - D/RDS/send → DPS
  - D/RDS/hold → DDH
  - D/RDS/kill → DDK
  - Z/RDS/{send, hold, kill} → SPEC-NEWS-REVISE-001 D-6 의 Z-mirror 정의 (Z 권한은 R/D 동작을 거울 반영; 정확한 매핑은 D-6 표 참조)
- **When** 각 9 (또는 12) 조합에 대해 `articleInsert` → `articleUpdate(action)` 호출
- **Then** 결과 `Contents.status` 가 전이표에 정의된 목표 상태로 정확히 변경됨
- **And** SPEC-NEWS-REVISE-001 D-6 의 lifecycle 단언 회귀 없음
- `[검증 명령]` `npm test -- src/services/__tests__/lifecycleRule.test.js -t "AC-LIFE-1"`
- `[통과 기준]` 매트릭스 9~12 조합 모두 GREEN
- `[매핑]` REQ-API-LIFECYCLE-RULE / 토픽 F

### Scenario AC-LIFE-2: 비허용 전이 거부 — 4xx 응답 + DB 무변경

- **Given** 기사 `AKR-001` 이 DPS 상태. 사용자 권한 R (R 권한은 DPS 기사 전이 권한 없음)
- **When** R 권한 사용자가 `articleUpdate('AKR-001', { action: 'kill' })` 호출
- **Then** 4xx 응답 반환 (403 Forbidden 또는 422 Unprocessable Entity)
- **And** DB 의 `Contents.status === 'DPS'` 유지 (변경 없음)
- **And** DB 의 `Article.updatedAt` 변경 없음 (또는 변경 있더라도 status 자체는 무변경)
- **And** lifecycle.transition() 함수가 비허용 전이에 대해 throw 또는 null 반환 (단위 테스트)
- `[검증 명령]` `npm test -- src/services/__tests__/lifecycleRule.test.js -t "AC-LIFE-2"`
- `[통과 기준]` 4xx + DB 무변경
- `[매핑]` REQ-API-LIFECYCLE-RULE / 토픽 F

### Scenario AC-LIFE-3: `articleSelect` 무전이 — 조회는 상태 변경 없음

- **Given** 기사 `AKR-001` 이 RDS 상태
- **When** `articleSelect('AKR-001')` 호출 (또는 다른 조회 메서드 `findById`, `query`)
- **Then** 반환값에 기사 정보 포함
- **And** DB 의 `Contents.status === 'RDS'` 변경 없음
- **And** DB 의 `lockYN` 변경 없음 (조회는 락 영향 없음)
- **And** lifecycle.transition() 함수가 호출되지 않음 (호출 카운터 단언)
- `[검증 명령]` `npm test -- src/services/__tests__/lifecycleRule.test.js -t "AC-LIFE-3"`
- `[통과 기준]` 조회 후 DB 완전 무변경
- `[매핑]` REQ-API-LIFECYCLE-RULE / 토픽 F

### Scenario AC-LIFE-4: 우회 경로 부재 단언 — 직접 SQL UPDATE 라우트 없음

- **Given** `src/services/` 및 `src/server/` (또는 동등 라우터) 전체
- **When** 다음 정적 검사 수행:
  - grep: `UPDATE Contents.*SET.*status` 패턴이 `articleService.js` 내부 1 곳만 발견
  - 라우터 등록 목록 enumerate: `/api/article` 하위 라우트가 `articleInsert`, `articleUpdate`, `articleSelect`, 락 관련 라우트 외에 *상태 직접 변경* 라우트 없음
- **Then** 우회 경로 0 건 발견
- **And** 만약 직접 SQL UPDATE 가 추가되어도 정적 검사가 즉시 FAIL (회귀 알람)
- `[검증 명령]` `npm test -- src/services/__tests__/lifecycleBypass.test.js -t "AC-LIFE-4"`
- `[통과 기준]` 우회 경로 grep 0 건 + 라우터 목록 단언 GREEN
- `[매핑]` REQ-API-LIFECYCLE-RULE / 토픽 F (003 고유 cross-cutting 가드)

---

## 7. 통합 회귀 시나리오 (Cross-cutting)

### Scenario AC-INT-1: 락 + Insert/Update + lifecycle 통합 시나리오

- **Given** 빈 DB. U1 이 신규 작성 페이지에서 기사 작성 → 송고 (RDS 진입)
- **When** U2 가 데스크 미송고 페이지에서 그 기사를 편집 진입 (락 획득) → 본문 수정 → KILL (권한 R 가정, RRK 전이) → 작성 페이지 초기화 → 락 해제
- **Then** 전체 흐름이 다음 단언을 모두 통과:
  - U1 송고 시: `articleInsert` 1 회 + lifecycle R/RDS/send → RDS
  - U2 편집 진입 시: `acquireEditLock` 1 회 + `lockYN === 'Y'`, `lockOwner === 'U2'`
  - U2 KILL 클릭 시: `articleUpdate` 1 회 + lifecycle R/RDS/kill → RRK
  - U2 종료 시: `releaseEditLock` 1 회 + `lockYN === 'N'`
- **And** SPEC-NEWS-REVISE-001 / 002 의 통합 시나리오 회귀 없음
- `[검증 명령]` `npm test -- src/services/__tests__/integration.lockLifecycle.test.js -t "AC-INT-1"` (신규 통합 테스트)
- `[통과 기준]` 전체 흐름 4 단계 모두 GREEN
- `[매핑]` REQ-ARTICLE-LOCK-YN + REQ-WRITE-LIFECYCLE-API + REQ-API-LIFECYCLE-RULE / 토픽 C+D+F 교차

---

## 8. Quality Gate Criteria (TRUST 5)

본 SPEC 의 PASS/FAIL 판정 기준:

- **T (Tested)** — 본 문서의 24 개 이상 AC 시나리오 모두 GREEN. coverage 85% 이상 (본 SPEC 의 회귀 가드 테스트가 새 production 코드 없이 002 의 구현 커버리지를 강화하므로 coverage 회귀 0).
- **R (Readable)** — `npm run lint --prefix web` (또는 ruff 등) 무경고. AC 시나리오 문장이 한국어로 명확.
- **U (Unified)** — 002 의 AC 명명 규칙 (`AC-LOCK-N`, `AC-WLC-N`, `AC-LIFE-N` 등) 과 정합. EARS 키워드 (WHEN / WHILE / SHALL / SHALL NOT) 사용 일관.
- **S (Secured)** — REQ-MEDIA-TAB-SEARCH 의 AC-MEDIA-4 (API 키 비노출), REQ-ARTICLE-LOCK-YN 의 AC-LOCK-6 (락 우회 차단), REQ-API-LIFECYCLE-RULE 의 AC-LIFE-4 (직접 SQL 우회 차단) 모두 GREEN.
- **T (Trackable)** — 본 SPEC 의 모든 AC 가 spec.md §4 의 EARS 단언과 1:1 또는 1:N 매핑. plan.md §2 의 토픽 매핑 표와 정합.

---

## 9. 기존 SPEC 회귀 가드 매트릭스

본 SPEC 의 Run 단계 종료 시 다음 매트릭스가 모두 GREEN 이어야 한다.

### 9.1 SPEC-NEWS-REVISE-001 회귀 가드

| 001 의 AC | 본 SPEC 의 보호 | 검증 위치 |
|-----------|---------------|---------|
| AC-Z-1~5 (Z권한 송고/보류/KILL) | 변경 없음 — 기존 테스트 GREEN | `WritePage.test.jsx` |
| AC-DTL-1~6 (상세보기 분리 + 12 필드) | AC-EMPH-4 가 정합 가드 | `articleDetail.test.js` |
| AC-EMB-1~3 (임베드 커서 위치 + 영속성) | AC-EMB-DEL-3 가 round-trip 단언 + AC-REG-1 | `InlineEmbed.test.jsx` |
| AC-CTRL-D-1~4 (Ctrl+D 라인 삭제) | 변경 없음 — 기존 테스트 GREEN | (Ctrl+D 관련 테스트 파일) |
| AC-CTRL-D-5 (Alt+Y 보존) | AC-ALTY-1, 2 가 `(끝)` 단언 정합 | `editorShortcuts.test.js` |

### 9.2 SPEC-NEWS-REVISE-002 회귀 가드

| 002 의 AC | 본 SPEC 의 보호 | 검증 위치 |
|-----------|---------------|---------|
| AC-LOCKYN-1~3 | M1 단언 + ContentsVO.md 정합 grep | `schema.test.js`, `articleModel.test.js` |
| AC-EDIT-LOCK-1~6 | AC-LOCK-1~6 정합 | `editLockBehavior.test.js` |
| AC-API-1~5 | AC-WLC-1~5 정합 | `useWriteController.test.jsx`, `WritePage.test.jsx` |
| AC-FONT-1~4 | AC-EMPH-1~4 정합 (AC-EMPH-3 빈 제목 케이스는 003 고유 보강) | `articleDetail.test.js` |
| AC-ENDMARK-1~4 | AC-ALTY-1, 2 정합 | `editorShortcuts.test.js` |
| AC-EMB-DEL-1~4 | AC-EMB-DEL-1, 2, 3 정합 | `InlineEmbed.test.jsx` |
| AC-SEARCH-1~4 | AC-MEDIA-1~4 정합 (AC-MEDIA-4 API 키 비노출은 003 고유 보강) | `mediaSearch.lifecycleGuard.test.js` |

### 9.3 SPEC-DB-FOUNDATION-001 / BACKEND-CORE-001 / FRONTEND-UI-001 / UI-EDITOR-001 / AUTH-001

- 기존 컬럼/기본키/lifecycle 전이표/UI 레이아웃/어댑터 계약/권한 의미 변경 없음.
- 본 SPEC 의 production 코드 변경 0 — 회귀 표면 없음.

---

## 10. Definition of Done

본 SPEC Run 단계의 *완료 조건*:

- [ ] M0 ~ M7 전 마일스톤 종료
- [ ] AC-MEDIA-1, 2, 3, 4 (REQ-MEDIA-TAB-SEARCH) 모두 GREEN
- [ ] AC-EMPH-1, 2, 3, 4 (REQ-DETAIL-BODY-EMPHASIS) 모두 GREEN
- [ ] AC-LOCK-1, 2, 3, 4, 5, 6 (REQ-ARTICLE-LOCK-YN) 모두 GREEN
- [ ] AC-WLC-1, 2, 3, 4, 5 (REQ-WRITE-LIFECYCLE-API) 모두 GREEN
- [ ] AC-EMB-DEL-1, 2, 3, AC-ALTY-1, 2, AC-REG-1 (REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT) 모두 GREEN
- [ ] AC-LIFE-1, 2, 3, 4 (REQ-API-LIFECYCLE-RULE) 모두 GREEN
- [ ] AC-INT-1 (통합 시나리오) GREEN
- [ ] SPEC-NEWS-REVISE-001 회귀 가드 매트릭스 §9.1 모두 GREEN
- [ ] SPEC-NEWS-REVISE-002 회귀 가드 매트릭스 §9.2 모두 GREEN
- [ ] SPEC-DB-FOUNDATION-001 / BACKEND-CORE-001 / FRONTEND-UI-001 / UI-EDITOR-001 / AUTH-001 회귀 표면 0
- [ ] `npm test --prefix web -- --run` 전체 통과
- [ ] `npm test -- --run` (백엔드) 전체 통과
- [ ] `npm run build --prefix web` 무경고
- [ ] TRUST 5 게이트 (T / R / U / S / T) 통과 (§8)
- [ ] `news.md` / `ContentsVO.md` 의 미커밋 변경분이 본 SPEC AC 와 1:1 매핑 (spec.md §6 표 정합)
- [ ] `news.md` / `ContentsVO.md` commit 완료 (Sync 단계)
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001 / 002 의 `spec.md` / `plan.md` / `acceptance.md` 를 수정하지 않음 (정적 grep 단언)
- [ ] 본 SPEC 은 production 코드 (`web/`, `src/`, `server/`) 의 *비-테스트 파일* 을 수정하지 않음 (`git diff --stat` 검증)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-03
