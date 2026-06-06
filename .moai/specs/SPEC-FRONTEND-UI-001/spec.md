---
id: SPEC-FRONTEND-UI-001
version: 0.6.0
status: approved
created: 2026-05-27
updated: 2026-06-06
author: manager-spec
priority: high
issue_number: null
---

# SPEC-FRONTEND-UI-001 — 기사 제작 시스템 프런트엔드 UI 계층

## HISTORY

- 2026-06-06 (v0.6.0): 사용자 요청 반영 — 기사아이디가 생성되지 않은 신규 초안(A-DRAFT) 작성 화면에는 KILL 버튼을 표시하지 않는다. REQ-FE-WRITE-013 개정: KILL 버튼 노출은 기사아이디가 부여된(편집 컨텍스트) RDS 기사 + 권한 매트릭스(R/Z)일 때로 한정 — 존재하지 않는 기사는 KILL 대상이 아니며, 종전에는 초안 KILL이 기사를 생성한 직후 KILL하는 동작이 됐다. 구현: useWriteController가 isDraft(A-DRAFT 센티널)를 노출하고 WritePage KILL 게이트에 !isDraft 추가. AC-5.3 개정, AC-5.5 신설. news.md 작성 페이지 버튼 절 + moai-domain-news-editor SKILL 동기 갱신. (MoAI)
- 2026-06-06 (v0.5.0): 사용자 요청 반영 — 조회 4개 메뉴 데이터 표시·기사상태 컬럼·편집 로드·락 게이트 개정. (1) REQ-FE-VIEW-008/011 개정 — 공통 목록 컬럼을 7개 → 8개로 확장: 수정시간과 LockYN 사이에 기사상태(status, RDS/DPS/RRH/RRK/DDH/DDK 원시 값) 컬럼 추가. (2) REQ-FE-VIEW-007 개정 — 개인별 수정 author 필터는 기사에 저장된 작성자 표시 이름(user.name) 기준으로 매칭(종전 userId 매칭은 저장 값과 불일치로 항상 0건). (3) 기사 생성 시 서버가 세션 사용자의 department/departmentCode를 스탬프하고, 레거시 행은 작성자 이름→User.department 비파괴 백필 — 부서별 작성/송고 조회가 실데이터와 매칭되도록 복구. (4) 편집 진입 로드 복구 — 백엔드 articleModel.query가 Article을 LEFT JOIN하여 markupVersion을 포함하고, Contents에 공통정보 8컬럼(coAuthor/region/attribute/keyword/internalComment/externalComment/attachmentFile/referenceFile) 영속화 + secondaryEmbargoAt→secondEmbargoAt 매핑. (5) SPEC-NEWS-REVISE-002 AC-EDIT-LOCK-6 이행 — applyAction(송고/보류/KILL action 라우트 포함)에 락 자동 검증: 타 보유자의 live 락이 있으면 lock-required 거부, 락이 비면 통과(신규 송고 보존). AC-7.3/7.4/7.5 개정. (MoAI)
- 2026-06-06 (v0.4.0): 사용자 요청 반영 — 기사 조회 4개 메뉴 개정. (1) REQ-FE-VIEW-011 신설 — 4개 메뉴 전부 기사 목록 컬럼을 기사아이디/제목/작성자/수정자/작성시간/수정시간/LockYN 7개로 통일(상태 배지·인라인 액션 버튼 제거). (2) REQ-FE-VIEW-005 개정 — 부서별 작성에 부서 Select(데이터-소스 인터페이스 재사용, 초기값 로그인 사용자 부서 + 자동 조회) + 조회 버튼 추가, 필터 `{ department, statusNot: 'DPS,RRH' }`. 백엔드 articleModel.query에 statusNot(NOT IN) 필터 신설, 누락돼 있던 department 동등 필터 추가. (3) REQ-FE-VIEW-007 개정 — 개인별 수정은 본인 작성 + 상태 RDS/RRK만 (`{ author, status: 'RDS,RRK' }`). (4) REQ-FE-VIEW-009/010 개정 — DPS 고침/포털고침 게이팅을 인라인 버튼에서 우클릭 컨텍스트 메뉴 항목(고침(포털제외)/포털고침)으로 이동, D 권한 + DPS일 때만 활성화되어 기사작성(편집) 페이지로 이동. AC-7.1/7.1b/7.3/7.5/8.1/8.2 개정·신설. news.md 동기 갱신. (MoAI)
- 2026-06-06 (v0.3.0): 사용자 요청 5건 반영. (1) REQ-FE-WRITE-012/013/014 개정 — 송고/보류/KILL 버튼은 '송고/보류/KILL하시겠습니까?' 확인창을 선행하고, 보류/KILL도 송고와 동일하게 기사 DTO 저장(saveArticle) 후 액션을 제출하며, 요청 성공 시 버튼 아래에 결과 상태 메시지를 표시하지 않는다(작성 페이지 초기화는 유지). (2) REQ-FE-VIEW-008 개정 — 데스크 미송고는 상태값 RDS, DDH 기사만 나열하고 컬럼은 기사아이디/제목/작성자/수정자/작성시간/수정시간/LockYN 7개만 표현. 백엔드 article 조회에 status 다중값(IN) 필터 추가. (3) 에디터 '본문' 라벨 텍스트 제거(aria-label 유지). (4) 문말 trailing 개행 렌더 보정(trailing <br> 패딩 — Enter 2회 증상 해소). AC-5.1/5.2 개정, AC-5.3/5.4 신설, AC-7.4 개정. news.md 동기 갱신. (MoAI)
- 2026-05-27 (v0.2.0): 결정 포인트 5건 확정. DP-F1=에디터는 교체 가능한 어댑터 추상화(마크업 in/out 계약만 정의, 구체 라이브러리 Run 단계, markupVersion 덮어쓰기·이력 UI 없음). DP-F2=실시간은 UI 계약만(데이터 변경 → 목록·상태바 자동 갱신, 구독 인터페이스 경유), WebSocket-vs-폴링은 Run 단계 인프라. DP-F3=외부 검색(유튜브→구글)은 백엔드 검색 프록시 경유(키 서버 보관, CORS 회피, 폴백 로직 서버 집중). 이는 SPEC-BACKEND-CORE-001 현 범위에 없는 백엔드 검색 프록시 책임을 새로 도입 — 본 SPEC에 프런트엔드가 소비하는 외부 의존/인터페이스로 문서화하고, 프록시 엔드포인트는 Run 단계(또는 후속 backend API 추가)에서 정의. 프런트엔드 Model 계층이 호출을 추상화. DP-F4=부서 목록은 분리된 데이터-소스 인터페이스(예: User.department distinct), 구체 소스 Run 단계. DP-F5=송고/보류 다음 상태는 백엔드가 계산, UI는 액션+DTO 전송 후 백엔드 반환 상태 표시(클라이언트 미계산)를 기본값으로 확정. "미해결 결정 포인트" → "확정 결정"으로 전환. status: draft → approved. 영향 요구사항(에디터 어댑터, 실시간 구독 인터페이스, 검색 백엔드 프록시, 부서 데이터-소스 인터페이스, 백엔드 반환 상태 표시) 갱신. (manager-spec)
- 2026-05-27 (v0.1.0): 최초 작성. 3-SPEC 계층 분해(DB → backend → frontend) 중 3번 SPEC. 프런트엔드 UI 계층(React/Vite, MVC, 3개 페이지: 로그인/작성/조회, 공통 사용자 정보 표시, 4탭 메타데이터, 외부 검색 폴백, 실시간 조회 + 4개 메뉴, 권한별 UI 노출)만 정의. SPEC-DB-FOUNDATION-001(승인됨) 및 SPEC-BACKEND-CORE-001(승인됨)의 확정 계약(권한 R/D/Z, 생애주기 RDS/DPS/RRH/DDH/RRK/DDK, 기사 필드, 조회 필터 incl. distributedAt)에 정렬. 미해결 사항은 결정 포인트로 표기. (manager-spec)

---

## 개요 (Overview)

기사 제작 시스템(기사 작성기)의 **프런트엔드 UI 계층**을 정의한다. React + Vite + MVC 패턴 위에서
3개 페이지(로그인 / 기사 작성 / 기사 조회), 모든 페이지 공통의 우측 상단 로그인 사용자 정보 표시,
기사 작성 페이지의 에디터 + 4탭 메타데이터 레이아웃, 외부 미디어 검색(유튜브 → 구글 폴백) 및 내부 글기사 검색,
기사 조회 페이지의 실시간 갱신 + 상태바 + 4개 메뉴, 그리고 권한(R/D/Z) 기반 UI 노출/비활성을 정의한다.

본 SPEC은 **관찰 가능한 UI 동작과 그 동작이 필요로 하는 데이터만** 다룬다. 백엔드 비즈니스 로직
(SPEC-BACKEND-CORE-001 확정), DB 스키마(SPEC-DB-FOUNDATION-001 확정)는 다루지 않는다.
컴포넌트명/파일 구조/상태관리 라이브러리 선택/구체 REST 라우트·요청·응답 JSON 스키마 등 구현 세부는 Run 단계로 미룬다.

### 계층 분해 위치

| 순번 | SPEC | 범위 |
|------|------|------|
| 1 | SPEC-DB-FOUNDATION-001 (승인됨) | SQLite 스키마, 기사 ID 생성 계약, 소프트 삭제 제약 |
| 2 | SPEC-BACKEND-CORE-001 (승인됨) | 기사/사용자 함수, 생애주기 전이, 로그인 인증, 권한, 기사 ID 생성 구현 |
| **3** | **SPEC-FRONTEND-UI-001 (본 SPEC)** | React + Vite UI, 3개 페이지, 공통 사용자 정보, 4탭 작성, 외부/내부 검색, 실시간 조회 + 4메뉴, 권한별 노출 |

### 의존성 (Dependency)

본 SPEC은 **SPEC-BACKEND-CORE-001 (승인됨)** 및 **SPEC-DB-FOUNDATION-001 (승인됨)** 에 의존한다. 아래 확정 계약을 그대로 소비한다.

- **권한 값**: `R`(기자/리포터), `D`(국기사/데스크), `Z`(관리자). 로그인 시 백엔드가 사용자 `role`을 반환(REQ-USR-LOGIN-003).
- **생애주기 상태값**: `RDS`(최초 작성), `DPS`, `RRH`, `DDH`, `RRK`(R KILL), `DDK`(D KILL). `Contents.status`에 저장.
- **로그인 계약**: `userId` + `password` 제출 → 인증 성공 시 사용자 정체성과 `role` 반환(REQ-USR-LOGIN-001/003). 실패 시 인증 거부, 세션 미수립(REQ-USR-LOGIN-002). 응답에 비밀번호 해시 미포함(REQ-USR-LOGIN-004).
- **사용자 표시 필드**: User 테이블 `userId, name, role, department, departmentCode`(UserVO). 우측 상단 표시에 사용.
- **조회 필터(백엔드 제공)**: 배부시간(`distributedAt`), 작성시간(`createdAt`), 기사 ID(`articleId`), 작성자(`author`), 송고자(`sender`)를 독립 필터로 지원(REQ-ART-Q-001). 다중 조건은 AND 결합(REQ-ART-Q-002).
- **권한 게이팅 계약**: 상태값 `DPS`인 기사의 고침/포털고침은 `D` 권한만 가능, `R`/`Z`는 거부(REQ-ART-AUTH-002). UI는 이 규칙을 노출/비활성에 반영한다.
- **송고/보류 액션**: 송고(send)/보류(hold)는 생애주기 전이를 트리거(REQ-ART-LC-001~006). 송고 시 기사 DTO를 서버에 전달하면 백엔드가 생애주기를 거쳐 DB에 반영(REQ-WF-001). UI는 DTO 조립·제출까지 소관.

> 참고: 백엔드는 [DP-2 확정]에 따라 함수/서비스 계약만 정의하고 구체 REST 경로는 Run 단계로 이연했다. 따라서 본 SPEC도 **UI 동작과 필요한 데이터**를 정의하며, 특정 HTTP 엔드포인트는 명시하지 않는다(아래 확정 결정 참조).

> **신규 외부 의존성 (New External Dependency)**: [DP-F3 확정]으로 본 프런트엔드는 **백엔드 검색 프록시(search-proxy)** 인터페이스를 소비한다. 이 프록시는 SPEC-BACKEND-CORE-001의 현 범위에 포함되지 않은 신규 백엔드 책임이며, 그 엔드포인트·구현은 Run 단계(또는 후속 backend API 추가)에서 정의되어야 한다. 본 SPEC은 프런트엔드가 소비하는 인터페이스 계약(검색 요청 → 유튜브 우선 → 실패 시 구글 폴백 결과 반환)만 기술한다.

---

## 환경 및 가정 (Environment & Assumptions)

- 프레임워크/빌드: **React + Vite**.
- 아키텍처: **MVC 패턴** (클라이언트 측: View = 화면/컴포넌트, Model = 서버 데이터·앱 상태, Controller = 사용자 액션·서버 호출·상태 전이 조정).
- 페이지: **3개** — 로그인(login), 기사 작성(article write), 기사 조회(article view/list).
- 모든 텍스트 입출력 인코딩: **UTF-8** (CLAUDE.md HARD 규칙).
- 백엔드 인증·기사·조회 계약은 SPEC-BACKEND-CORE-001 확정 사항을 소비한다.

### 확정 결정 (Confirmed Decisions)

> 2026-05-27 사용자 확인 완료. 아래는 더 이상 가정이 아니라 본 SPEC의 확정 사항이다.

- **[DP-F1] 에디터 = 교체 가능한 어댑터 추상화 ✅**
  좌측 에디터는 **마크업 in/out 계약만 정의하는 교체 가능한 어댑터(adapter)** 로 래핑한다. 구체 라이브러리(TipTap/Quill/contentEditable 등) 선택은 Run 단계 소관이다. `Article.markupVersion`은 저장 시 **덮어쓰기**(이력 미보관, SPEC-DB-FOUNDATION-001 결정 D-A1 정렬)이며, 마크업 버전 이력 UI는 두지 않는다. → REQ-FE-WRITE-001 / REQ-FE-WRITE-015 갱신.
- **[DP-F2] 실시간 = UI 계약만 (구독 인터페이스) ✅**
  조회 페이지의 실시간 갱신은 **UI 계약만** 정의한다: 데이터 변경 시 기사 목록과 상태바가 사용자 개입 없이 자동 갱신되며, 이는 **구독(subscription) 인터페이스**를 통해 추상화된다. WebSocket vs 폴링 등 전송 방식·인프라는 Run 단계 소관이며 본 SPEC은 규정하지 않는다. → REQ-FE-VIEW-001/003 갱신.
- **[DP-F3] 외부 검색 = 백엔드 검색 프록시 경유 ✅**
  이미지/영상 검색(유튜브 → 실패 시 구글 폴백)은 **백엔드 검색 프록시(search-proxy) 인터페이스를 경유**한다. 클라이언트는 백엔드 검색 프록시를 호출하고, API 키는 서버 측에 보관되며(CORS 회피), 유튜브→구글 폴백 로직은 서버 측에 집중된다. 프런트엔드 Model 계층이 이 호출을 추상화한다. API 키와 프록시 엔드포인트의 구체 정의는 Run 단계 소관이다. → REQ-FE-WRITE-008/009 갱신, 아래 [외부 의존성] 참조.
  - **[주의 / 외부 의존성]** 이 결정은 **SPEC-BACKEND-CORE-001 현 범위에 없는 백엔드 검색 프록시 책임**을 새로 도입한다. 본 SPEC은 이를 **프런트엔드가 소비하는 외부 의존/인터페이스**로만 문서화한다. 검색 프록시 엔드포인트는 **Run 단계(또는 후속 backend API 추가 SPEC)에서 정의**되어야 하며, 그 백엔드 구현은 본 SPEC의 범위가 아니다(Exclusions 참조).
- **[DP-F4] 부서 목록 = 분리된 데이터-소스 인터페이스 ✅**
  부서별 송고 드롭다운의 부서 목록은 **분리된 데이터-소스(data-source) 인터페이스**(예: `User.department` distinct 조회)를 통해 채워진다. 구체 소스(사용자 테이블 distinct vs 고정 코드 테이블 vs 별도 엔드포인트)는 Run 단계에서 확정한다. → REQ-FE-VIEW-006 갱신.
- **[DP-F5] 송고/보류 다음 상태 = 백엔드 계산, UI는 반환 상태 표시 ✅**
  송고/보류 버튼이 트리거하는 생애주기 전이는 **백엔드 상태머신이 (현재상태, 권한, 액션)으로 계산**한다(REQ-ART-LC-*). UI는 **액션 + 기사 DTO만 전송**하고, 다음 상태를 클라이언트가 자체 계산하지 않으며, **백엔드가 반환한 결과 상태를 표시**한다. → REQ-FE-WRITE-014 갱신(기본값 확정).

---

## 요구사항 (Requirements — EARS)

### 앱 구조 / 라우팅 / 공통 (App Structure, Routing, Common)

- **REQ-FE-APP-001 (Ubiquitous)**: The frontend **shall** be implemented with React and Vite, organized using an MVC structure (View = screens/components, Model = server data and application state, Controller = user-action handling, server calls, and state-transition coordination).
- **REQ-FE-APP-002 (Ubiquitous)**: The application **shall** provide exactly three pages — a login page, an article-write page, and an article-view (list) page — with client-side routing between them.
- **REQ-FE-APP-003 (Ubiquitous)**: Every page **shall** display the logged-in user's information (at minimum `name` and `role`, drawn from the authenticated user identity returned by the backend) in the top-right area of the screen.
- **REQ-FE-APP-004 (Unwanted Behavior)**: **If** no authenticated user session exists, **then** the application **shall not** render the article-write or article-view pages and **shall** route the user to the login page.

### 로그인 페이지 (Login Page)

- **REQ-FE-LOGIN-001 (Ubiquitous)**: The login page **shall** present a form with an identifier (아이디 = `userId`) input and a password (암호 = `password`) input.
- **REQ-FE-LOGIN-002 (Event-Driven)**: **When** the user submits the login form, the system **shall** send the supplied `userId` and `password` to the backend authentication contract (SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-001).
- **REQ-FE-LOGIN-003 (Event-Driven)**: **When** the backend reports authentication success, the system **shall** navigate the user to the article-write page and make the authenticated user's `name` and `role` available to the common top-right user-info element.
- **REQ-FE-LOGIN-004 (Unwanted Behavior)**: **If** the backend reports authentication failure, **then** the system **shall** display a login error message and **shall** remain on the login page without navigating.
- **REQ-FE-LOGIN-005 (Unwanted Behavior)**: **If** the password input is rendered, **then** the system **shall** mask the password characters and **shall not** display the plaintext password.

### 기사 작성 페이지 — 레이아웃 (Article Write — Layout)

- **REQ-FE-WRITE-001 (Ubiquitous)**: The article-write page **shall** be laid out as two regions — a left-side editor region and a right-side article-metadata input region.
- **REQ-FE-WRITE-015 (Ubiquitous)** [DP-F1]: The editor region **shall** be encapsulated behind a replaceable editor-adapter abstraction whose contract is limited to markup input/output (the concrete editor library is selected at the Run stage), and the system **shall** treat `Article.markupVersion` as an overwrite-on-save value with no markup-version history UI.
- **REQ-FE-WRITE-002 (Ubiquitous)**: The right-side metadata region **shall** present exactly four tabs labeled 공통정보 (common info), 이미지 (image), 영상 (video), and 글기사 (text-article).
- **REQ-FE-WRITE-003 (Ubiquitous)**: A 송고 (send) button and a 보류 (hold) button **shall** be displayed above the four tabs.
- **REQ-FE-WRITE-004 (Event-Driven)**: **When** the user selects a tab, the system **shall** display that tab's panel and hide the other tab panels.

### 기사 작성 페이지 — 공통정보 탭 (Common-Info Tab)

- **REQ-FE-WRITE-005 (Ubiquitous)**: The 공통정보 tab **shall** present input fields for 작성자 (author), 공동작성 (co-author), 내용 (content), 지역 (region), 속성 (attribute), 키워드 (keyword), 내부코멘트 (internal comment), 외부코멘트 (external comment), 첨부파일 (attachment file), 자료파일 (reference/material file), 엠바고 시간 (embargo time), and 2차 엠바고 시간 (secondary embargo time).
- **REQ-FE-WRITE-006 (Optional)**: **Where** the embargo time and secondary embargo time fields are provided, the system **shall** accept date/time entry for each independently.

### 기사 작성 페이지 — 이미지/영상 탭 + 검색 폴백 (Image/Video Tabs + Search Fallback)

- **REQ-FE-WRITE-007 (Ubiquitous)**: The 이미지 tab and 영상 tab **shall** each provide the ability to search for media to embed into the article body.
- **REQ-FE-WRITE-008 (Event-Driven)** [DP-F3]: **When** the user performs an image or video search, the system **shall** issue the search through the backend search-proxy interface (so that API keys remain server-side and CORS is avoided), and the proxy **shall** query YouTube first.
- **REQ-FE-WRITE-009 (Unwanted Behavior)** [DP-F3]: **If** the YouTube search fails (e.g., no results or an error response), **then** the backend search-proxy **shall** fall back to a Google search for the same query; the YouTube-to-Google fallback logic is concentrated server-side, and the frontend Model layer **shall** abstract the proxy call so the UI consumes a single search interface regardless of provider.
- **REQ-FE-WRITE-010 (Event-Driven)**: **When** the user selects a search result, the system **shall** embed the selected media reference into the article body.

### 기사 작성 페이지 — 글기사 탭 (Text-Article Tab)

- **REQ-FE-WRITE-011 (Event-Driven)**: **When** the user performs a 글기사 search, the system **shall** search internal articles by title (기사 제목) and body content (본문내용) and display matching internal articles for embedding.

### 기사 작성 페이지 — 송고/보류 (Send / Hold)

- **REQ-FE-WRITE-012 (Event-Driven, v0.3.0 개정)**: **When** the user presses the 송고 (send) button and confirms the '송고하시겠습니까?' confirmation dialog, the system **shall** assemble the article data into an article DTO (combining editor content and the four tabs' inputs) and submit it to the backend so the backend can route it through the lifecycle state machine (SPEC-BACKEND-CORE-001 REQ-WF-001).
- **REQ-FE-WRITE-013 (Event-Driven, v0.6.0 개정)**: **When** the user presses the 보류 (hold) or KILL button and confirms the corresponding '보류하시겠습니까?' / 'KILL하시겠습니까?' confirmation dialog, the system **shall** save the current article DTO (same persistence path as send) and then submit the hold/kill action for the saved article to the backend. **When** the user cancels the confirmation dialog (any of send/hold/kill), the system **shall not** save or submit anything. **While** the write page holds an id-less draft (articleId not yet generated — the A-DRAFT sentinel), the system **shall not** display the KILL button regardless of role; KILL is offered only for an article loaded in edit context with a generated articleId, per the existing role matrix (R/Z + RDS).
- **REQ-FE-WRITE-014 (Ubiquitous, v0.3.0 개정)** [DP-F5]: The system **shall** send only the action and the article DTO to the backend and **shall not** compute the next lifecycle state on the client (the backend state machine computes the transition per REQ-ART-LC-*). After a SUCCESSFUL send/hold/kill action the system **shall not** display a lifecycle-status message below the action buttons (the write page reset per news.md remains); a REJECTED action still surfaces its error notice.

### 기사 조회 페이지 — 실시간 + 상태바 (Article View — Real-time + Status Bar)

- **REQ-FE-VIEW-001 (Ubiquitous)** [DP-F2]: The article-view page **shall** update in real time so that newly available article data is reflected without requiring a manual page reload, consuming updates through a subscription interface (the concrete transport — WebSocket vs polling — is a Run-stage infrastructure decision and is not specified here).
- **REQ-FE-VIEW-002 (Ubiquitous)**: The article-view page **shall** display a real-time status bar in the top-right area indicating the live/real-time state of the view.
- **REQ-FE-VIEW-003 (Event-Driven)** [DP-F2]: **When** the subscription interface reports new or changed article data for the active menu's filter, the system **shall** refresh the displayed article list and update the status bar to reflect the change.

### 기사 조회 페이지 — 4개 메뉴 (Article View — Four Menus)

- **REQ-FE-VIEW-004 (Ubiquitous)**: The article-view page **shall** present exactly four menus — 부서별 작성 (department-write), 부서별 송고 (department-send), 개인별 수정 (personal-edit), and 데스크 미송고 (desk-unsent).
- **REQ-FE-VIEW-005 (Event-Driven, v0.4.0 개정)**: **When** the 부서별 작성 menu is active, the system **shall** present a department Select populated from the separated department data-source interface (same source as REQ-FE-VIEW-006) with the logged-in user's department selected initially, **shall** auto-query that department on menu entry, **shall** re-query when another department is selected and the 조회 (query) button is pressed, and **shall** display only articles authored within the selected department whose lifecycle state is **not** `DPS` and **not** `RRH` (query filter `{ department, statusNot: 'DPS,RRH' }`; backend `articleModel.query` expands `statusNot` to a `NOT IN` clause).
- **REQ-FE-VIEW-006 (Event-Driven)** [DP-F4]: **When** the 부서별 송고 menu is active, the system **shall** present a department dropdown populated from a separated department data-source interface (e.g., distinct `User.department`; the concrete source is confirmed at the Run stage) and a 조회 (query) button, and **shall** display articles for the selected department only after the query button is pressed (DPS-only per news.md: query filter `{ department, status: 'DPS' }`).
- **REQ-FE-VIEW-007 (Event-Driven, v0.5.0 개정)**: **When** the 개인별 수정 menu is active, the system **shall** display only articles authored by the current individual user whose lifecycle state is `RDS` or `RRK` (query filter `{ author, status: 'RDS,RRK' }`; v0.5.0 — the `author` value matches the author display name stored on the article, i.e. the logged-in user's `user.name`, because articles persist the writer's name in the author column).
- **REQ-FE-VIEW-008 (Event-Driven, v0.5.0 개정)**: **When** the 데스크 미송고 menu is active, the system **shall** display only articles whose lifecycle state is `RDS` or `DDH` (news.md v0.3.0: "데스크 미송고 페이지는 상태값이 RDS, DDH인 기사만 나열한다"), and each listed row **shall** present exactly eight columns — 기사아이디(articleId), 제목(title), 작성자(author), 수정자(modifier), 작성시간(createdAt), 수정시간(editedAt), 기사상태(status), LockYN(lockYN).
- **REQ-FE-VIEW-011 (Ubiquitous, v0.5.0 개정)**: Article list rows in **all four** view menus (데스크 미송고, 부서별 작성, 부서별 송고, 개인별 수정) **shall** present exactly the same eight columns as REQ-FE-VIEW-008 — 기사아이디, 제목, 작성자, 수정자, 작성시간, 수정시간, 기사상태(status; raw lifecycle value RDS/DPS/RRH/RRK/DDH/DDK), LockYN — with no inline action buttons, **except** the 부서별 송고 DPS-row 고침/포털고침 forwarding buttons defined by SPEC-NEWS-REVISE-007 (REQ-FWD-ENTRYPOINTS, AC-FWD-3), which render after the eight columns on DPS rows only.

### 기사 조회 페이지 — 권한 게이팅 (Article View — Role Gating)

- **REQ-FE-VIEW-009 (State-Driven, v0.4.0 개정)**: **While** a displayed article is in lifecycle state `DPS`, the system **shall** enable the 고침(포털제외)/포털고침 (edit-excluding-portal / portal-edit) right-click context-menu items only for users whose `role` is `D`, and selecting either item **shall** navigate to the article-write page in edit context for that article. (v0.4.0: inline row buttons removed by REQ-FE-VIEW-011 — gating lives in the context menu.)
- **REQ-FE-VIEW-010 (Unwanted Behavior, v0.4.0 개정)**: **If** a `DPS` article is displayed to a user whose `role` is `R` or `Z`, **then** the system **shall** disable the 고침(포털제외)/포털고침 context-menu items for that article (the UI **shall not** offer an action the backend would reject per REQ-ART-AUTH-002). For non-`DPS` articles these items remain disabled regardless of role.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 프런트엔드 UI 계층(React/Vite, 페이지, 레이아웃, 클라이언트 동작)만 다룬다. 아래는 **명시적으로 범위 밖**이다.

- **백엔드 비즈니스 로직**: 기사/사용자 CRUD 함수, 생애주기 전이 계산, 권한 인가 판정, 기사 ID 생성, 로그인 해시 비교는 SPEC-BACKEND-CORE-001 소관. 본 SPEC은 그 계약을 소비만 한다.
- **DB 스키마/DDL/PK/소프트 삭제 구현**: SPEC-DB-FOUNDATION-001 소관.
- **구체 REST 엔드포인트 / HTTP 메서드 / 요청·응답 JSON 스키마**: 백엔드 [DP-2]에 따라 Run 단계(또는 별도 API SPEC) 소관. 본 SPEC은 UI 동작과 필요한 데이터만 정의.
- **컴포넌트명·파일 구조·상태관리 라이브러리 선택(Redux/Zustand/Context 등)·CSS 프레임워크**: Run 단계 소관 (SPEC은 WHAT/WHY).
- **리치텍스트 에디터의 구체 라이브러리 선택 및 `markupVersion` 이력 UI**: [DP-F1 확정] 에디터는 교체 가능한 어댑터로 래핑하되 구체 라이브러리는 Run 단계 소관. 마크업 이력 보관은 SPEC-DB-FOUNDATION-001 결정상 미보관(별도 SPEC).
- **실시간 전송 인프라(WebSocket 서버, 폴링 주기, 메시지 포맷)**: [DP-F2 확정] Run 단계 소관. 본 SPEC은 구독 인터페이스 기반 UI 갱신 계약만 정의.
- **백엔드 검색 프록시(search-proxy)의 구현 및 엔드포인트 정의**: [DP-F3 확정] 외부 검색은 백엔드 검색 프록시를 경유하나, 그 **프록시 자체의 구현·엔드포인트·API 키 관리·유튜브/구글 폴백 서버 로직은 SPEC-BACKEND-CORE-001 현 범위 밖**이며 Run 단계(또는 후속 backend API 추가 SPEC) 소관이다. 본 SPEC은 프런트엔드가 그 프록시 인터페이스를 **소비**하는 동작(요청·폴백 결과 표시·임베딩 선택)만 정의한다.
- **부서 목록 데이터 소스 구현**: [DP-F4 확정] 분리된 데이터-소스 인터페이스의 구체 소스 구현은 Run 단계 소관. 본 SPEC은 드롭다운·조회 버튼 UI 동작과 인터페이스 소비만 정의.
- **접근성(WCAG)·국제화(i18n) 외 다국어·테마/다크모드**: 본 SPEC 범위 밖.
- **클라이언트 측 권한 우회 방지의 보안 강제**: UI 노출/비활성만 정의. 실제 인가 거부는 백엔드(REQ-ART-AUTH-002)가 강제한다.

---

## 참조 (References)

- 의존 SPEC: `.moai/specs/SPEC-BACKEND-CORE-001/spec.md` (승인됨 — 로그인/권한/생애주기/조회 필터 계약 정렬)
- 의존 SPEC: `.moai/specs/SPEC-DB-FOUNDATION-001/spec.md` (승인됨 — 기사 필드/status/distributedAt 정렬)
- 원천 명세: `news.md` (클라이언트 기술명세, 페이지, 공통 조건, 기사 작성/조회 페이지, 사용자 권한, 기사 제어 권한, 기사 생애주기, 워크플로우)
- VO 명세: `UserVO.md`(사용자 표시 필드), `ContentsVO.md`(기사 메타데이터 필드)
- 프로젝트 HARD 규칙: `CLAUDE.md` — "모든 텍스트는 UTF-8", 현재 구현 범위는 제작 시스템
