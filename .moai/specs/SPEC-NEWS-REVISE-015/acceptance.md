---
id: SPEC-NEWS-REVISE-015
version: 0.1.0
status: Plan
created: 2026-06-12
updated: 2026-06-12
author: manager-spec
priority: medium
issue_number: 0
---

# SPEC-NEWS-REVISE-015 — 인수 기준 (Acceptance Criteria)

## HISTORY

- 2026-06-12 (v0.1.0): 최초 작성. 근거 커밋 **a8a6c87**(2026-06-11, "docs(spec): maintenance.md 코드-명세 갭을
  news.md 문체로 반영")의 news.md 추가분 흡수에 대한 Given-When-Then 인수 기준. 추가분 대부분은 **기구현
  (characterization)** 이라 본 문서 AC 의 다수는 **기존 테스트 GREEN 유지(회귀 가드)** 이고, 일부 **테스트 공백
  (회귀 가드 신설)** 만 신규 작성 대상이다. 실제 테스트 레이아웃: 백엔드 `test/*.test.js`(`npm test`), 프론트
  `web/src/**/*.test.jsx`·`web/src/**/*.test.js`(`npm run test:web`), 빌드 `npm run build`. (manager-spec)

---

## 테스트 레이아웃 (실제 — 검증 완료)

| 종류 | 위치 | 실행 명령 |
|------|------|-----------|
| 백엔드 (생애주기/잠금/세션/인증/SP/미디어/스키마) | `test/*.test.js` | `npm test` |
| 프론트 (조회/작성/에디터/상세/세션/라우팅) | `web/src/**/*.test.jsx`, `web/src/**/*.test.js` | `npm run test:web` |
| 빌드 | (전체) | `npm run build` |
| 린트 | (전체) | `npm run lint` |

> **분류 규약**: 각 AC 머리에 분류표를 단다 — **[기구현/회귀가드]** = 코드·기존 테스트 존재, GREEN 유지만 검증 / **[테스트 공백/신설]**
> = 코드 구현은 존재하나 독립 회귀 가드 테스트가 없어 본 SPEC 의 신규 작성 대상. **본 SPEC 은 어떤 경우에도
> `web/`·`src/` 운영 코드를 변경하지 않는다 — 신규 작성 대상은 테스트 파일뿐이다.**

> **검증 완료 코드 사실(2026-06-12 Read)**: `src/services/lifecycle.js:9-37` TRANSITIONS 에 RDS-출발 6 + Z-mirror 3 +
> DPS-출발(송고→DPS, 보류→DDH; KILL 미정의=거부) + DDH-출발(D/Z 송고→DPS, KILL→DDK) 이 모두 구현됨. 대응 테스트
> `test/lifecycleDps.test.js`, `test/lifecycleRule.test.js`, `test/lifecycle.test.js` 존재.

---

## §1. REQ-DESIGN-SYNC — 디자인 블루 기조 정정 흡수 (프론트, [기구현/회귀가드] + 일부 테스트 공백)

### AC-DSN-1 — 주색 블루(#0A4DA6) · 레드 포인트 한정 [기구현/회귀가드]
- **Given**: 빌드/스타일(`web/src/styles/yonhap.css`), 디자인 토큰 SSOT(`--yh-blue #0A4DA6`)
- **When**: `npm run build` 와 기존 스타일 의존 테스트를 실행
- **Then**: 헤더 강조선·활성 탭·주요 버튼이 블루(`--yh-blue`)이고 레드(#C8102E)는 포인트로만 사용됨이 회귀 없이
  유지된다. (코드는 이미 블루 — news.md a8a6c87 정정은 코드 정합. 새 운영 코드 없음)

### AC-DSN-2 — 상태 배지 색 회귀 가드 [테스트 공백/신설]
- **Given**: 조회 목록 상태 배지 색 규칙(RDS=회색, DPS=레드, 보류 RRH/DDH=앰버, KILL RRK/DDK=슬레이트)
- **When**: 신규 회귀 가드 테스트(`web/src/view/ViewPage.statusBadge.test.jsx` 권장)로 각 상태 행의 배지
  클래스/색 토큰을 단언
- **Then**: 6 상태가 위 색 매핑과 일치한다. (maintenance.md L119 는 yonhap.css 근거만 있고 독립 테스트가 없는
  공백 — 운영 코드 변경 없이 테스트만 신설)

---

## §2. REQ-ROUTING-SYNC — SPA 라우팅(.do)·writer.do 오타 정정 (프론트, [기구현/회귀가드])

### AC-RT-1 — writer.do 정규 경로 [기구현/회귀가드]
- **Given**: `web/src/app/routing.js`, 기존 `web/src/app/routing.test.js`
- **When**: `npm run test:web`
- **Then**: 작성 페이지 경로가 `writer.do` 로 매핑됨이 GREEN 유지(과거 `wirter.do` 오타 부재). news.md 오타 정정은
  코드 정합 확인.

### AC-RT-2 — .do SPA 라우팅 · 뒤로/앞으로 · 미정의→로그인 [기구현/회귀가드]
- **Given**: history API(pushState/popstate) 라우트(`routing.js`, `App.jsx`), 기존 라우팅 테스트
- **When**: 정의된 .do 경로 진입, popstate 발생, 미정의 경로 진입을 시뮬레이트
- **Then**: 정의 경로는 해당 뷰로, 미정의 경로는 로그인으로 폴백됨이 GREEN 유지.

---

## §3. REQ-COMMON-SYNC — 공통 조건(미디어 프록시·멀티탭) 흡수 (혼합, [기구현/회귀가드])

### AC-CMN-1 — 이미지/영상 서버 프록시 · API 키 환경변수 · 실패 시 빈 결과 [기구현/회귀가드]
- **Given**: `src/services/mediaSearch.js`, 기존 `test/mediaSearch.test.js`, `test/mediaSearch.lifecycleGuard.test.js`
- **When**: `npm test`
- **Then**: type 라우팅(image→Google, 그 외→YouTube), 환경변수(YOUTUBE_API_KEY/GOOGLE_API_KEY/GOOGLE_SEARCH_CX)
  필수, 상류 오류 시 빈 배열+error:true(500 미발생)가 GREEN 유지.

### AC-CMN-2 — 탭·작성내용 sessionStorage 유지 [기구현/회귀가드]
- **Given**: `web/src/view/WriteWorkspace.jsx`(탭 메타 `newsroom.editorTabs`, 초안 `newsroom.writeDraft.<tabId>`),
  기존 `web/src/view/WriteWorkspace.test.jsx`, `web/src/controller/useWriteController.draftPersist.test.jsx`
- **When**: `npm run test:web`
- **Then**: 페이지 이동 후에도 탭 목록·탭별 초안이 sessionStorage 로 복원됨이 GREEN 유지.

### AC-CMN-3 — 탭 전환 시 주소창·브라우저 탭 제목 갱신 [기구현/회귀가드]
- **Given**: `WriteWorkspace.jsx:155-181`(replaceState 주소 동기화 + document.title 동기화)
- **When**: 편집 탭/새 기사 탭 전환을 시뮬레이트(기존 WriteWorkspace 테스트)
- **Then**: 편집 탭은 `?id=<기사아이디>` 표시·탭 제목=기사아이디, 새 기사 탭은 쿼리 제거·기본 제목이 GREEN 유지.

### AC-CMN-4 — 강제 Lock해제 시 편집 탭 자동 닫힘 [기구현/회귀가드, SPEC-014 위임]
- **Given**: `WriteWorkspace.jsx:198-218`, 기존 `web/src/view/WritePage.forceUnlockClose.test.jsx`
- **When**: `npm run test:web`
- **Then**: 강제 해제 통지 수신 시 해당 편집 탭이 자동으로 닫힘이 GREEN 유지. **본 SPEC 은 이 동작을 재명세하지
  않는다 — SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE 가 소유. 여기서는 흡수 사실만 기록한다.**

---

## §4. REQ-VIEW-SYNC — 조회페이지 세부 흡수 (프론트, [기구현/회귀가드] + 일부 테스트 공백)

### AC-VW-1 — SSE 실시간 수신 [기구현/회귀가드]
- **Given**: `web/src/model/httpModel.js:258-270`(EventSource + ?session= 인증, change 수신 시 목록 갱신),
  기존 `web/src/model/httpModel.test.js`, `web/src/view/ViewPage.test.jsx` SSE 케이스
- **When**: `npm run test:web`
- **Then**: 기사 생성/수정/상태변경/잠금변경 이벤트 수신 시 목록 갱신이 GREEN 유지.

### AC-VW-2 — SSE 자동 재연결 [테스트 공백/신설 — 위임 한계 명시]
- **Given**: EventSource 의 자동 재연결은 브라우저 내장(우리 코드가 재연결 루프를 구현하지 않음)
- **When**: 신규 회귀 가드 테스트로 open/error 핸들러 배선과 연결 상태 추적을 단언(재연결 자체는 EventSource 위임)
- **Then**: 우리 코드가 EventSource 를 사용(폴링/타이머 아님)하고 error 시 상태를 추적함을 검증한다. **재연결 동작
  자체는 브라우저 위임이므로 독립 단위 테스트로 완전 검증 불가** — 이 한계를 테스트 주석에 명시한다.

### AC-VW-3 — 부서 멀티셀렉트('전체' 토글) [기구현/회귀가드]
- **Given**: `web/src/view/ViewPage.jsx:322-403`(DeptMultiSelect), 기존
  `web/src/view/ViewPage.deptMultiSelect.test.jsx`
- **When**: `npm run test:web`
- **Then**: '전체' 토글 + 체크박스 다중 선택 + 외부 클릭 닫기 + 선택 상태별 표시 텍스트가 GREEN 유지.

### AC-VW-4 — 우클릭 스텁 메뉴 비활성 [기구현/회귀가드]
- **Given**: `ViewPage.jsx:78-137`, 기존 `web/src/view/ViewPage.contextMenu.test.jsx`
- **When**: `npm run test:web`
- **Then**: 이력보기/송고이력보기/번역/매핑/후속기사작성/계속기사작성/삭제요청/재송 항목이 disabled 스텁으로
  표시되고 동작하지 않음이 GREEN 유지.

### AC-VW-5 — 잠긴 기사 Lock해제(D,Z 한정) [기구현/회귀가드, SPEC-012/014 위임]
- **Given**: `ViewPage.jsx:61-70`, 기존 `web/src/view/ViewPage.forceUnlock.test.jsx`
- **When**: `npm run test:web`
- **Then**: LockYN='Y' 행에서만 Lock해제 노출, D/Z 활성·R 비활성, '해제하시겠습니까?' 확인 후 호출이 GREEN 유지.
  **소유: SPEC-NEWS-REVISE-012/014.**

### AC-VW-6 — 컬럼 표시·간격 설정 모달(메뉴별 저장) [기구현/회귀가드]
- **Given**: `ViewPage.jsx:203-261`, `web/src/view/columnConfig.js`, 기존 `web/src/view/columnConfig.test.js`
- **When**: `npm run test:web`
- **Then**: 헤더 우클릭 시 컬럼 표시/숨김 체크박스 + 간격 슬라이더(0~32px), 메뉴별 localStorage
  (`tech_day.viewColumns.{menu}`) 저장이 GREEN 유지.

### AC-VW-7 — 시간 컬럼 YYYY-MM-DD HH:mm 가운데 정렬 [기구현/회귀가드]
- **Given**: `ViewPage.jsx:27-33,302`, 기존 ViewPage 테스트
- **When**: `npm run test:web`
- **Then**: 작성/수정시간 컬럼이 YYYY-MM-DD HH:mm 포맷 + 헤더·값 가운데 정렬임이 GREEN 유지.

---

## §5. REQ-DETAIL-SYNC — 상세보기 새창 흡수 (프론트, [기구현/회귀가드])

### AC-DT-1 — 720×800 새창 · 창 제목=기사 제목 [기구현/회귀가드]
- **Given**: `web/src/view/ViewPage.jsx:38`(window.open 720×800), `web/src/view/articleDetail.js:146`(title),
  기존 `web/src/view/articleDetail.test.js`
- **When**: `npm run test:web`
- **Then**: 새창 스펙 720×800, `<title>` = 기사 제목(빈 제목이면 '(제목 없음)')이 GREEN 유지.

### AC-DT-2 — 빈 필드 '—' [기구현/회귀가드]
- **Given**: `articleDetail.js:194-261`, 기존 `articleDetail.test.js`
- **When**: `npm run test:web`
- **Then**: 공통정보 빈 필드가 em-dash('—')로 표시됨이 GREEN 유지.

### AC-DT-3 — 블록 순서 렌더 · HTML 이스케이프 [기구현/회귀가드]
- **Given**: `articleDetail.js:113-135`(블록 순서 deserialize), `:18-26`(escapeHtml), 기존 `articleDetail.test.js`
- **When**: `npm run test:web`
- **Then**: 본문이 저장된 블록(text→embed) 순서대로 렌더되고 모든 출력이 HTML 이스케이프되어 스크립트가 실행되지
  않음이 GREEN 유지(레거시 plain content 폴백 포함).

---

## §6. REQ-USERINFO-SYNC — 사용자 정보 표시 형식 (프론트, [테스트 공백/신설])

### AC-UI-1 — '유저아이디 · 부서 · (권한)' 형식 [테스트 공백/신설]
- **Given**: `web/src/view/TopBar.jsx:23-27`(`userId · department · (role)`)
- **When**: 신규 회귀 가드 테스트(`web/src/view/TopBar.test.jsx` 권장)로 우측 상단 사용자 정보 렌더를 단언
- **Then**: '유저아이디 · 부서 · (권한)' 형식으로 표시된다. (maintenance.md L130 은 코드 근거만 있고 독립 테스트
  공백 — 운영 코드 변경 없이 테스트만 신설)

---

## §7. REQ-SESSION-SYNC — 세션 정책 보안 세부 흡수 (백엔드+프론트, [기구현/회귀가드])

### AC-SES-1 — 무작위 세션 토큰 · 로그인 시 재발급 [기구현/회귀가드]
- **Given**: `src/services/sessionService.js:68`(randomBytes opaque), `src/controllers/index.js:45-46`(재발급),
  기존 `test/sessionService.test.js`, `test/authControllers.test.js`
- **When**: `npm test`
- **Then**: 세션 ID 가 권한 정보를 담지 않는 무작위 토큰이고, 로그인 성공 시 기존 세션 무효화 후 새 ID 발급
  (session fixation 방어)이 GREEN 유지.

### AC-SES-2 — sliding 갱신은 인증된 모든 요청 [기구현/회귀가드]
- **Given**: `sessionService.js:96-105`(touchSession), 기존 `test/sessionService.test.js`
- **When**: `npm test`
- **Then**: 인증된 모든 요청에서 만료 시점이 갱신됨이 GREEN 유지.

### AC-SES-3 — sessionStorage 복원 · 복원 전 리다이렉트 금지 [기구현/회귀가드]
- **Given**: `web/src/app/App.jsx:18-19,83,118-120`(2단계 영속 + restoreSettled 게이트), 기존
  `web/src/app/App.session.test.jsx`
- **When**: `npm run test:web`
- **Then**: user+sessionId 가 sessionStorage 에 영속되고 GET /api/session 확인 전에는 로그인으로 리다이렉트하지
  않음(restoreSettled 게이트)이 GREEN 유지. 불완전 세션(한쪽 누락)은 양쪽 정리됨도 유지.

---

## §8. REQ-LOCK-SYNC — 편집 잠금(lockYN) 절 신설 흡수 (백엔드, [기구현/회귀가드])

### AC-LK-1 — 잠금 식별(사용자·세션·시각) + 한 세션 한정 [기구현/회귀가드]
- **Given**: `src/db/schema.js:21-27`(lockerUserId/lockerSessionId/lockedAt), 기존 `test/editLockBehavior.test.js`
  (AC-LOCK-4 1인1페이지), `test/integration.lockLifecycle.test.js`
- **When**: `npm test`
- **Then**: 잠금이 사용자+세션+시각 3컬럼으로 식별되고, 동일 사용자라도 다른 세션으로는 같은 기사 편집 진입이
  차단됨이 GREEN 유지.

### AC-LK-2 — 30분 만료 · 잠금자 비공개 · 탭 닫힘 시 해제 · 강제 해제 D,Z [기구현/회귀가드]
- **Given**: `articleService.js:19`(30분 stale), `server/index.js:287`(409 비노출), `:308-317`(sendBeacon 해제),
  `:364-386`(force-unlock D/Z), 기존 `test/editLockBehavior.test.js`, `test/forceUnlock.test.js`
- **When**: `npm test`
- **Then**: 30분 무갱신 잠금 자동 승계, 획득 실패(409)에 보유자 비노출, 브라우저 닫힘 해제, 강제 해제 D/Z 한정
  (R 403)이 GREEN 유지. **소유: SPEC-EDIT-LOCK-001/NEWS-REVISE-002/003/012/014.**

---

## §9. REQ-LOGIN-SYNC — 로그인 워크플로우 보안 흡수 (백엔드+프론트, [기구현/회귀가드])

### AC-LG-1 — 15분 10회 rate limit [기구현/회귀가드]
- **Given**: `server/index.js:98,89-95`(IP당 15분 창 10회), 기존 `test/serverRoutes.test.js` 또는
  `test/serverAuthWiring.test.js`
- **When**: `npm test`
- **Then**: 같은 IP 에서 15분 동안 10회 초과 로그인 시도가 제한됨이 GREEN 유지.

### AC-LG-2 — 비밀번호 해시 · 응답 미포함 · active='N' 거부 · 타이밍 균일화 [기구현/회귀가드]
- **Given**: `src/services/userService.js:39,18-25`(bcryptjs 해시·password 컬럼 제거), `:85`(active='N' 거부),
  `:76-87`(constant-time), 기존 `test/userService.test.js`, `test/userSoftDelete.test.js`
- **When**: `npm test`
- **Then**: 비밀번호가 bcrypt 해시로 저장되고 어떤 응답에도 포함되지 않으며, active='N' 거부, 실패 사유 무관 동일
  비교 수행이 GREEN 유지.

### AC-LG-3 — placeholder 문구 [기구현/회귀가드]
- **Given**: `web/src/view/LoginPage.jsx:25,33,45`, 기존 App/LoginPage 테스트
- **When**: `npm run test:web`
- **Then**: 아이디/암호 입력칸에 '아이디를 입력하세요'/'암호를 입력하세요' 안내 문구가 GREEN 유지.

---

## §10. REQ-WRITE-SYNC — 기사작성 워크플로우 흡수 (백엔드, [기구현/회귀가드])

### AC-WR-1 — 편집 저장은 잠금 보유 세션만 [기구현/회귀가드]
- **Given**: `server/index.js:258`(PUT /api/articles/:id, 잠금 보유자만), 기존 `test/serverRoutes.test.js` 또는
  `test/editLockBehavior.test.js`
- **When**: `npm test`
- **Then**: 편집 잠금을 보유한 세션만 PUT 부분 수정 가능함이 GREEN 유지. **소유: SPEC-NEWS-REVISE-002.**

---

## §11. REQ-SP-SYNC — 기사 아이디 SP 흡수 (백엔드, [기구현/회귀가드])

### AC-SP-1 — 기사 아이디 중복 시 난수 재생성 [기구현/회귀가드]
- **Given**: `src/services/articleId.js:39-45`(충돌 시 난수 재시도, now 주입 가능), 기존 `test/articleId.test.js`
- **When**: `npm test`
- **Then**: 생성된 'AKR'+YYYYMMDD+난수9 가 기존 기사와 충돌하면 난수 부분만 재생성됨이 GREEN 유지.
  **검증 시 now(날짜)를 명시 주입한다** (미주입 시 익일부터 30분 stale 판정 등 시한폭탄 회피).

---

## §12. REQ-EDITOR-SYNC — 기사 에디터 규칙 흡수 (프론트, [기구현/회귀가드])

### AC-ED-1 — 라인 삭제 시 임베드 동반 삭제(한 개씩) + × 버튼 [기구현/회귀가드]
- **Given**: `web/src/view/editorShortcuts.js:115-231`, `web/src/view/WritePage.jsx:144`(× 버튼), 기존
  `web/src/view/editorShortcuts.test.js`, `web/src/view/InlineEmbed.test.jsx`
- **When**: `npm run test:web`
- **Then**: Backspace/Delete/Ctrl+D 가 현재 라인 임베드를 한 개씩 동반 삭제하고, 각 임베드에 × 삭제 버튼이
  있음이 GREEN 유지(최근 커밋 6fc6e9e/cc7617d 실브라우저 재현 수정 포함).

### AC-ED-2 — markupVersion 블록 구조 · 하위 호환 [기구현/회귀가드]
- **Given**: `web/src/model/editorContent.js`, 기존 `web/src/model/editorContent.test.js`,
  `web/src/model/articleStructure.test.js`
- **When**: `npm run test:web`
- **Then**: 본문이 `{ format:'yh-editor', version:1, blocks:[...] }` 로 저장되고 편집-저장-불러오기 round-trip 에서
  블록 순서가 보존되며, 레거시 plain-text 본문도 호환 처리됨이 GREEN 유지.

### AC-ED-3 — IME 조합 중 색칠 금지 [기구현/회귀가드]
- **Given**: `web/src/view/editorColoring.js:44-65`(repaint 은 compositionend/blur/로드 시점만), 기존
  `web/src/view/editorColoring.test.js`
- **When**: `npm run test:web`
- **Then**: 한글 IME 조합 중에는 색상 repaint 가 일어나지 않고, 조합 완료/포커스 이탈/기사 불러오기 시점에만
  적용됨이 GREEN 유지(SPEC-NEWS-REVISE-001 D-7 회귀).

---

## §13. REQ-API-SYNC — API 라우트 9종 명세 흡수 (백엔드, [기구현/회귀가드])

### AC-API-1 — 신규 라우트 9종 존재 [기구현/회귀가드]
- **Given**: `server/index.js`(/api/health, /login, /logout, /session, /articles/search, /articles/:id/action,
  PUT /articles/:id, /articles/:id/lock·unlock·force-unlock, /media/search, /stream), 기존
  `test/serverRoutes.test.js`, `test/serverAuthWiring.test.js`
- **When**: `npm test`
- **Then**: news.md API 명세서에 추가된 라우트들이 실제 서버에 존재하고 라우팅됨이 GREEN 유지. (라우트 동작 자체는
  각 도메인 SPEC 소유 — 본 AC 는 라우트 존재·명세 정합만)

---

## §14. REQ-LIFECYCLE-SYNC — 생애주기 확장 전이 흡수 (백엔드, [기구현/회귀가드])

### AC-LC-1 — Z=D-mirror 전이 [기구현/회귀가드]
- **Given**: `src/services/lifecycle.js:18-20`, 기존 `test/lifecycleRule.test.js`
- **When**: `npm test`
- **Then**: RDS|Z|송고→DPS, RDS|Z|보류→DDH, RDS|Z|KILL→DDK 가 GREEN 유지.

### AC-LC-2 — DPS-출발 전이 (송고→DPS 재송고, 보류→DDH, KILL 거부) [기구현/회귀가드]
- **Given**: `lifecycle.js:24-29`, 기존 `test/lifecycleDps.test.js`
- **When**: `npm test`
- **Then**: DPS|R/D/Z|송고→DPS(재송고 유지), DPS|R/D/Z|보류→DDH 가 GREEN 유지하고, **DPS|*|KILL 은 전이표 부재로
  거부**됨이 GREEN 유지. **메모리상 미결로 남아 있던 'DPS 보류 결과상태'는 본 흡수로 DDH 로 확정 기록**
  (lifecycle.js + SPEC-NEWS-REVISE-011 코드 근거). **소유: SPEC-NEWS-REVISE-011.**

### AC-LC-3 — DDH-출발 전이 + R 거부 + 화이트리스트 거부 [기구현/회귀가드]
- **Given**: `lifecycle.js:33-36,49-55`, 기존 `test/lifecycleDps.test.js`, `test/lifecycleBypass.test.js`
- **When**: `npm test`
- **Then**: DDH|D/Z|송고→DPS, DDH|D/Z|KILL→DDK 가 GREEN 유지하고, DDH 에서 R 권한 모든 액션 거부 + 전이표에 없는
  (상태|권한|액션) 조합 전부 거부(화이트리스트)가 GREEN 유지. **소유: SPEC-NEWS-REVISE-008/011.**

---

## §15. REQ-DB-SYNC — DB 컬럼·마이그레이션 명세 흡수 (백엔드, [기구현/회귀가드])

### AC-DB-1 — lockYN 4컬럼 + 공통정보 8컬럼 + User.active [기구현/회귀가드]
- **Given**: `src/db/schema.js:21-40`, 기존 `test/schema.test.js`
- **When**: `npm test`
- **Then**: Contents 의 lockYN(+locker 3) 및 공통정보 8컬럼, User.active('Y' 기본)가 존재함이 GREEN 유지.

### AC-DB-2 — 멱등 마이그레이션 · 레거시 대소문자 호환 · 부서 백필/자동 스탬핑 [기구현/회귀가드]
- **Given**: `schema.js:108-207`, `src/models/articleModel.js:55-58`, `server/index.js:239-244`, 기존
  `test/schema.test.js`, `test/articleModel.test.js`
- **When**: `npm test`
- **Then**: ensure*Column 멱등 추가, 레거시 LockYN/LockedAt 키 통일 읽기, NULL department 백필, 저장 시 부서 자동
  스탬핑이 GREEN 유지. **CLAUDE.md HARD: 기존 데이터 삭제 없음(컬럼 추가만).**

### AC-DB-3 — 다중 부서 / statusNot 필터 + 트랜잭션 [기구현/회귀가드]
- **Given**: `articleModel.js:69-98`, `articleService.js:283-297`, 기존 `test/articleModel.test.js`,
  `test/articleModel.searchByText.test.js`, `test/articleService.test.js`
- **When**: `npm test`
- **Then**: department CSV 다중 부서 + statusNot 제외 필터, Article/Contents 동시 수정 트랜잭션이 GREEN 유지.

---

## §16. REQ-SECURITY-SYNC — 보안 절 신설 흡수 (백엔드, [기구현/회귀가드])

### AC-SEC-1 — helmet 보안 헤더 · CORS localhost:5173 · 스택 비노출 [기구현/회귀가드]
- **Given**: `server/index.js:42-63,438-445`, 기존 `test/serverRoutes.test.js` 또는 `test/serverAuthWiring.test.js`
- **When**: `npm test`
- **Then**: helmet CSP, CORS 가 localhost/127.0.0.1:5173 만 허용, 전역 에러 핸들러가 스택을 노출하지 않음이 GREEN
  유지.

### AC-SEC-2 — 권한 검증(R/D/Z 외 거부, 사용자 관리 Z만) [기구현/회귀가드]
- **Given**: `src/services/authorization.js:9-31`, 기존 `test/authorization.test.js`
- **When**: `npm test`
- **Then**: 미지의 역할 요청 거부(403), 사용자 생성/수정/삭제는 Z 만 허용이 GREEN 유지.

---

## §17. 품질 게이트 (Quality Gate)

- [ ] `npm test` (backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web` (vitest) 전체 GREEN
- [ ] `npm run build` (vite) 무경고
- [ ] `npm run lint` (eslint) 무경고
- [ ] 신규 회귀 가드 테스트(AC-DSN-2 상태배지, AC-UI-1 TopBar, AC-VW-2 SSE 재연결 한계)만 추가 — **운영 코드 변경
      0줄**
- [ ] articleId/lock 시간 의존 테스트는 now/시각을 명시 주입(시한폭탄 회피)
- [ ] TRUST 5: Tested / Readable / Unified / Secured / Trackable

---

## §18. Definition of Done (요약)

- [ ] §1~§16 의 [기구현/회귀가드] AC 가 모두 기존 테스트 GREEN 유지로 확인됨(코드 변경 없음)
- [ ] [테스트 공백/신설] AC-DSN-2 / AC-UI-1 / AC-VW-2 의 신규 회귀 가드 테스트가 GREEN(운영 코드 무변경)
- [ ] DPS-출발 보류 결과상태가 DDH 로 흡수 기록됨(AC-LC-2) — 메모리 미결 항목 해소 반영
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.0 / Plan)
- [ ] news.md 미변경 (a8a6c87 에서 이미 반영 완료 — 본 SPEC 은 그 흡수만 명세화)
- [ ] 기존 SPEC-NEWS-REVISE-001~014 본문 미수정 (참조만)
- [ ] Slack `tech-day` 보고(CLAUDE.md HARD; 폴백 시 "전송됨" 단정 금지)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-12
