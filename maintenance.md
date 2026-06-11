# maintenance.md
news.md에 명세되어 있지 않지만 소스코드에 구현(반영)되어 있는 내용의 정리 문서이다.
- 각 항목에 근거 소스 위치(file:line)와 출처 SPEC을 병기한다.
- rcv.md(수집/자동기사)는 현재 백엔드 소스에 구현이 없어 본 문서 범위 외이다.
- 디자인 세부는 design.md가 별도 출처이므로 [design.md 출처]로 표기한다.

### 서버

## API 엔드포인트 (news.md API 명세서에 없는 라우트)
news.md는 articleInsert/articleUpdate/articleSelect + 사용자 3종만 명시하나, 실제 서버에는 아래 라우트가 추가로 존재한다 (server/index.js):
- GET /api/health — 서버 헬스체크. (server/index.js:81)
- POST /api/login — 로그인. 15분 창 IP당 10회 레이트 리밋 적용. (server/index.js:98, 89-95)
- POST /api/logout — 세션 종료. (server/index.js:105)
- GET /api/session — F5 새로고침 시 세션 복원(재인증 없이 사용자 재수화). (server/index.js:113)
- GET /api/articles/search?q= — 제목/본문 LIKE 전문 검색 (글기사 임베드 탭용). (server/index.js:179)
- POST /api/articles/:id/action — 송고/보류/KILL 상태 전이 전용 라우트. 세션 기반 권한 검증 후 생애주기 전이 실행. (server/index.js:190)
- PUT /api/articles/:id — 기사 부분 업데이트. 편집 잠금 보유자만 허용. (server/index.js:258, SPEC-NEWS-REVISE-002)
- POST /api/articles/:id/lock / unlock / force-unlock — 편집 잠금 획득/해제/강제해제. (server/index.js:289, 334, 364)
- GET /api/media/search?q=&type= — 이미지/영상 검색 프록시. (server/index.js:392)
- GET /api/stream — SSE 실시간 스트림. (server/index.js:405)

## 인증·세션 보안 (세션 정책 절 외 구현 세부)
- 세션 ID는 randomBytes(24) 기반 opaque 토큰 — 클라이언트에 권한 정보를 싣지 않는다. (src/services/sessionService.js:68)
- sliding 만료는 인증된 모든 요청마다 touchSession()으로 갱신된다. (src/services/sessionService.js:96-105)
- 로그인 성공 시 기존 세션을 무효화하고 새 세션 ID를 발급한다 (session fixation 방어). (src/controllers/index.js:45-46)
- 로그인 실패 사유와 무관하게 bcrypt 비교를 동일하게 수행한다 (timing attack 방어, constant-time). (src/services/userService.js:76-87)
- 비밀번호는 bcryptjs(SALT_ROUNDS=10) 해시로 저장하며, 조회/로그인 응답에서 password 컬럼을 제거한다. (src/services/userService.js:39, 18-25)
- 비활성 사용자(active='N')는 로그인 거부된다. (src/services/userService.js:85)

## 편집 잠금(lockYN) 서버 규칙 (news.md에는 LockYN 컬럼 노출과 해제 시점만 존재)
- 30분 stale 타임아웃: 잠금 후 30분(EDIT_LOCK_TIMEOUT_MS=1,800,000ms) 무갱신 잠금은 다음 획득 시도 시 자동 해제·승계된다. (src/services/articleService.js:19, test/editLockBehavior.test.js:102-121, SPEC-NEWS-REVISE-003 D2-3)
- 잠금 획득은 단일 atomic SQL(WHERE lockYN='N' OR lockedAt<cutoff)로 처리해 레이스 컨디션을 제거한다. (src/services/articleService.js:33-44)
- 1인 1페이지 정책: 동일 사용자라도 다른 sessionId(다른 탭/페이지)로는 같은 기사 편집 진입이 차단된다. (test/editLockBehavior.test.js:81-99, AC-LOCK-4)
- 잠금 보유자는 lockerUserId + lockerSessionId + lockedAt 3컬럼 조합으로 식별한다. (src/db/schema.js:21-27)
- POST /lock 의 body에 release:true가 오면 해제로 처리한다 — 브라우저 언로드 시 sendBeacon(POST만 가능) 호환용. (server/index.js:308-317)
- 잠금 획득 실패(409) 응답에 보유자 정보를 노출하지 않는다. (server/index.js:287)
- 강제 해제(force-unlock)는 D/Z 권한만 가능, R은 403. (server/index.js:364-386, src/services/articleService.js:172-183)

## 실시간(SSE) 구현 (news.md는 "조회페이지는 실시간이다" 한 줄)
- In-process EventEmitter 이벤트 버스로 변경 사항을 브로드캐스트한다. (server/index.js:31-33)
- 이벤트 타입: create / update / status / lock / unlock (강제 해제는 unlock + forced:true 로 구분). (server/index.js:215, 246, 279, 315, 353, 380-383)
- EventSource는 커스텀 헤더를 못 보내므로 ?session= 쿼리 파라미터로 세션 인증을 받는다. (server/index.js:412)

## 기사 생애주기 — news.md 생애주기 절에 없는 전이 (src/services/lifecycle.js TRANSITIONS)
- Z 권한은 D-mirror: RDS|Z|송고→DPS, RDS|Z|보류→DDH, RDS|Z|KILL→DDK. (src/services/lifecycle.js:18-20, SPEC-NEWS-REVISE-001 D-6, test: lifecycleRule)
- DPS-출발 전이: DPS|R/D/Z|송고→DPS(재송고 유지), DPS|R/D/Z|보류→DDH. (src/services/lifecycle.js:24-29, SPEC-NEWS-REVISE-011)
- DPS에서 KILL은 불가(전이표에 없음 → 거부). DPS 기사의 KILL은 고침/포털고침 편집 진입 후 보류(DDH)→KILL(DDK) 경로만 가능하다. (src/services/lifecycle.js, test/lifecycleDps.test.js)
- DDH-출발 전이: DDH|D/Z|송고→DPS, DDH|D/Z|KILL→DDK. DDH에서 R 권한은 모든 액션이 거부된다. (src/services/lifecycle.js:33-36, test/lifecycleDps.test.js:99-130)
  - ※ news.md L72는 DDH의 "버튼 노출"만 규정하고 전이 결과 상태는 미기재.
- 전이표에 없는 (상태|권한|액션) 조합은 모두 거부된다 (화이트리스트 방식). (src/services/lifecycle.js:49-55)

## 기사아이디 생성 SP 세부 (news.md는 규칙 'AKR'+YYYYMMDD+난수9 만)
- 생성된 아이디가 기존 기사와 충돌하면 난수 부분만 재생성해 재시도한다. (src/services/articleId.js:39-45)
- 테스트 결정성을 위해 now(날짜)를 주입할 수 있다. (src/services/articleId.js:34-46)

## 이미지/영상 검색 프록시 세부 (news.md는 "이미지=Google, 영상=YouTube" 만)
- type 파라미터 라우팅: type='image' → Google Custom Search(searchType=image), 그 외 → YouTube Data API. fallback 없음 (2026-06-06 지시로 YouTube-first + Google fallback 구조 폐기). (src/services/mediaSearch.js:1-5, 92-109)
- 환경변수 필수: YOUTUBE_API_KEY, GOOGLE_API_KEY, GOOGLE_SEARCH_CX. (src/services/mediaSearch.js:40, 64-65)
- 상류 API 오류는 catch 후 빈 배열 + error:true 로 응답한다 (서버 500 미발생). (src/services/mediaSearch.js:23-31, 107-109)
- 제공자별 응답을 {source, title, url, thumbnailUrl} 공통 형식으로 정규화한다. (src/services/mediaSearch.js:13-20)

## DB 스키마·마이그레이션 (schema.md에도 없는 컬럼/처리)
- Contents.lockYN ('N' 기본) + lockerUserId / lockerSessionId / lockedAt 컬럼. (src/db/schema.js:24-26, SPEC-NEWS-REVISE-002/003)
- Contents 공통정보 8컬럼: coAuthor, region, attribute, keyword, internalComment, externalComment, attachmentFile, referenceFile — 편집 진입 시 공통정보 복원용. (src/db/schema.js:26-28)
- User.active ('Y' 기본) — 사용자 soft delete. (src/db/schema.js:40, SPEC-AUTH-001)
- 멱등 마이그레이션: ensure*Column 함수들로 레거시 DB에 컬럼을 중복 없이 추가한다. (src/db/schema.js:108-174)
- 레거시 대소문자 호환: 구 DB의 LockYN/LockedAt 키를 lockYN/lockedAt으로 통일해 읽는다. (src/models/articleModel.js:55-58)
- 부서 백필: Contents.department가 NULL인 레거시 행을 작성자명-User 조인으로 채운다 (동명이인 제외, 멱등). (src/db/schema.js:191-207)
- 기사 저장 시 department/departmentCode 미지정이면 로그인 사용자의 부서로 자동 스탬핑한다. (server/index.js:239-244)
- 기사 조회 필터: distributedAt(배부시간) 외에 department CSV 다중 부서, statusNot(상태 제외) 필터를 지원한다. (src/models/articleModel.js:69-74, 92-98)
- Article/Contents 동시 수정은 BEGIN/COMMIT/ROLLBACK 트랜잭션으로 묶인다. (src/services/articleService.js:283-297)

## 서버 보안 공통
- helmet 보안 헤더(CSP scriptSrc 'self', imgSrc https 허용 — 검색 썸네일용). (server/index.js:42-60)
- CORS는 localhost:5173 / 127.0.0.1:5173 만 허용. (server/index.js:61-63)
- 전역 에러 핸들러 — 스택 트레이스 비노출. (server/index.js:438-445)
- 권한 검증: R/D/Z 외 미지의 역할은 403. 사용자 관리(생성/수정/삭제)는 Z만 허용. (src/services/authorization.js:9-31)

### 클라이언트

## 라우팅 (.do URL의 SPA 처리)
- /login.do, /writer.do, /list.do 를 history API(pushState) 기반 SPA 라우트로 매핑하고, 미지정 경로는 login으로 폴백한다. (web/src/app/routing.js:6-29)
- popstate 리스너로 브라우저 뒤로/앞으로 이동 시 URL을 재파싱해 라우트를 동기화한다. (web/src/app/App.jsx:108-112)

## 세션 복원 흐름 (news.md 세션 정책 절의 구현 세부)
- user(JSON)와 sessionId를 sessionStorage 별도 키로 2단계 영속화하고, 둘 중 하나라도 없으면 양쪽 모두 정리한다 (불완전 세션 방지). (web/src/app/App.jsx:18-19, 40-61)
- 부트 시 동기 복원 후 GET /api/session 으로 서버 확인을 거쳐 user를 재수화한다. restoreSettled 게이트로 비동기 복원 완료 전 auth-guard의 URL 리셋을 지연시킨다. (web/src/app/App.jsx:83, 118-120)

## 멀티탭 워크스페이스 구현 세부 (news.md L60-63의 구현 계약)
- 탭 메타는 sessionStorage `newsroom.editorTabs`, 탭별 초안은 `newsroom.writeDraft.<tabId>` 키. 구 단일 초안 키는 최초 진입 시 1회 이관한다. (web/src/view/WriteWorkspace.jsx:19-28)
- 탭 전환 시 주소창은 replaceState로 동기화한다 (히스토리 오염 방지; 편집 탭이면 ?id= 표시, 새 기사 탭이면 제거). (web/src/view/WriteWorkspace.jsx:155-166)
- 브라우저 탭 제목(document.title)을 활성 편집 탭의 기사아이디로 동기화한다 (새 기사 탭은 기본 제목). (web/src/view/WriteWorkspace.jsx:171-181)
- 다른 창에서 강제 Lock해제되면 storage 이벤트로 감지해 해당 편집 탭을 자동으로 닫는다. (web/src/view/WriteWorkspace.jsx:198-218, SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE)
- 탭 닫기 시 sessionStorage를 동기로 먼저 갱신해 unmount 시점의 잠금 해제 판정(editTabSurvives)을 정확히 한다. (web/src/view/WriteWorkspace.jsx:242-257, AC-REL-2)

## 에디터 — 본문 직렬화(markupVersion) 포맷
- 저장 포맷: { format: "yh-editor", version: 1, blocks: [...] } JSON. 블록은 text(문자열) / embed(종류·제목·URL·썸네일) 2종. (web/src/model/editorContent.js:1-14, 246-250)
- 레거시 plain-text 본문도 deserialize 시 호환 처리된다 (round-trip 보존). (web/src/model/editorContent.js:262-288)
- '(끝)' 마커는 text 블록으로 persist되며, hasEndMarker는 trimEnd().endsWith('(끝)') 판정으로 후행 공백·레거시 포맷을 허용한다. setBodyText는 trailing '(끝)'을 peel하여 [본문, ...embeds, '(끝)'] 순서를 타이핑 중에도 유지한다. (web/src/model/editorContent.js:22, 40-42)

## 에디터 — 캐럿·IME·색상 처리
- 색상 재칠(repaint)은 compositionend/blur/프로그램 로드 시점에만 수행한다 — 매 키 입력마다 하지 않아 IME 한글 합성이 깨지지 않는다. (web/src/view/editorColoring.js:44-65, SPEC-NEWS-REVISE-001 D-7)
- 라인 역할 판정: 첫 줄=제목, 이후 첫 빈 줄 전까지 최대 4줄=부제목, 이후=본문, 끝의 '(끝)'=골드 세그먼트로 분리. (web/src/view/editorColoring.js:20-35, 48-62)
- 캐럿/선택 오프셋 계산에서 임베드 스팬([data-embed-index]) 내부 텍스트 길이를 제외해 bodyText 모델과 일치시킨다. (web/src/view/editorCaret.js:11-28, 44-71)

## 에디터 — 임베드 삭제·렌더링
- Backspace/Delete/Ctrl+D 가 현재 라인의 임베드를 삭제 범위에 포함한다 (캐럿 기준 한 개씩 우선 선택). (web/src/view/editorShortcuts.js:115-231)
- 각 임베드에 × 삭제 버튼(aria-label='임베드 삭제') 제공, mousedown preventDefault로 캐럿이 흔들리지 않게 한다. (web/src/view/WritePage.jsx:144)
- 마지막 임베드 뒤 편집 가능한 텍스트가 없으면 trailing <br>을 렌더해 Chrome 캐럿 점프 버그를 방지한다. (web/src/view/WritePage.jsx:336-344)
- 임베드 종류별 렌더: 사진/영상 figure max-width 612px, 기사 참조 카드 480px, 클립보드 임베드 17%×17%. 영상은 썸네일+제목+URL, 기사는 제목 카드만. (web/src/view/WritePage.jsx:189-237, web/src/styles/yonhap.css) — 크기 수치 자체는 news.md L129에 있으나 종류별 렌더 구성은 미기재.

## 조회 페이지(list.do) 구현 세부
- SSE 구독: EventSource + ?session= 쿼리 인증, change 이벤트 수신 시 목록 갱신, open/error로 연결 상태 추적(자동 재연결은 EventSource 내장). (web/src/model/httpModel.js:258-270)
- 부서 멀티셀렉트 드롭다운(DeptMultiSelect, .yh-multi-select): '전체' 토글 + 체크박스 다중 선택 + 외부 클릭 닫기 + 선택 상태별 표시 텍스트. (web/src/view/ViewPage.jsx:322-403)
- 우클릭 컨텍스트 메뉴 항목 중 실제 동작: 상세보기 / 본문복사 / 제목만복사 / 편집 / 고침(포털제외) / 포털고침 / Lock해제. 나머지(이력보기·송고이력보기·번역·매핑·후속기사작성·계속기사작성·삭제요청·재송)는 disabled 스텁이다. (web/src/view/ViewPage.jsx:78-137)
- Lock해제 메뉴: lockYN='Y' 행에서만 노출, D/Z만 활성(R은 disabled), '해제하시겠습니까?' confirm 후 force-unlock API 호출. (web/src/view/ViewPage.jsx:61-70, web/src/model/httpModel.js:240-247)
- 컬럼 설정: 목록 헤더(첫 행) 우클릭 시 중앙 모달 — 컬럼 표시/숨김 체크박스 + 컬럼 간격 슬라이더(0~32px), 메뉴별 localStorage(tech_day.viewColumns.{menu}) 저장. (web/src/view/ViewPage.jsx:203-261, web/src/view/columnConfig.js:56)
- 작성/수정시간 컬럼은 YYYY-MM-DD HH:mm 포맷 + 헤더·값 가운데 정렬. (web/src/view/ViewPage.jsx:27-33, 302)
- 상태 배지 색: RDS=회색, DPS(송고)=레드, 보류(*H)=앰버, KILL(*K)=슬레이트. (web/src/styles/yonhap.css) [design.md 출처]

## 상세보기 새창 구현 세부
- window.open 스펙 720×800 새창. (web/src/view/ViewPage.jsx:38)
- <head><title>은 기사 제목, 빈 제목이면 '(제목 없음)'. (web/src/view/articleDetail.js:146)
- 본문은 markupVersion deserialize 결과의 블록 순서(text→embed)대로 렌더, 레거시는 escaped plain content 폴백. (web/src/view/articleDetail.js:113-135)
- 모든 출력에 escapeHtml 적용 (XSS 방어 — script/img 노드 미생성). (web/src/view/articleDetail.js:18-26)
- 공통정보 빈 필드는 '—'(em-dash)로 표시. (web/src/view/articleDetail.js:194-261)

## 로그인·사용자 정보 표시 세부
- 로그인 입력 placeholder('아이디를 입력하세요'/'암호를 입력하세요'), form noValidate. (web/src/view/LoginPage.jsx:25, 33, 45)
- 우측 상단 사용자 정보 표시 형식: `userId · department · (role)`. (web/src/view/TopBar.jsx:23-27)

### 명세-코드 모순 (구현이 news.md와 다른 항목 — 갭이 아닌 충돌)
- 디자인 주색: news.md L34-35는 "레드 #C8102E 헤더 바·활성 탭·주요 버튼" 이라 하나, 실제 구현은 블루(--yh-blue #0A4DA6) 주도이고 레드는 포인트(로고 룰·송고 배지 등)로만 쓰인다 (CLAUDE.md '파란색과 흰색' 정합 우선, design.md 기준). (web/src/styles/yonhap.css) [design.md 출처]
- news.md L44 `wirter.do` 는 오타 — 구현·테스트는 `writer.do`. (web/src/app/routing.js:6-20)
