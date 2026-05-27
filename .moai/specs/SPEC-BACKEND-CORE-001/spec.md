---
id: SPEC-BACKEND-CORE-001
version: 0.3.0
status: approved
created: 2026-05-27
updated: 2026-05-27
author: manager-spec
priority: high
issue_number: null
---

# SPEC-BACKEND-CORE-001 — 기사 제작 시스템 백엔드 애플리케이션 계층

## HISTORY

- 2026-05-27 (v0.3.0): 외부 검색 프록시 책임 추가 (SPEC-FRONTEND-UI-001 [DP-F3] 갭 해소). 기사 작성 페이지 이미지/영상 탭이 외부 미디어를 검색(YouTube 우선, 실패 시 Google 폴백)할 때 백엔드 프록시를 경유하도록 확정 — API 키 서버측 보관(CORS 회피). 미디어 검색 프록시 서비스 계약(REQ-SRCH-M-*), API 키 비노출(REQ-SRCH-SEC-*), 글기사 탭 내부 기사 전문(제목·본문) 검색 전용 계약(REQ-SRCH-A-*) 추가. REST 라우트는 기존 [DP-2] 결정대로 Run 단계 이연. 이전 확정 결정 4건은 그대로 유지. (manager-spec)
- 2026-05-27 (v0.2.0): 결정 포인트 4건 확정. DP-1=배부시간 조회는 SPEC-DB-FOUNDATION-001에 신규 추가되는 `distributedAt` 컬럼(Contents) 기준(병행 개정 중). DP-2=함수/서비스 계약만 정의, REST 라우트 Run 단계 이연(유지). DP-3=비밀번호 해시 저장(bcrypt 또는 동급)+로그인 시 해시 비교(OWASP). DP-4=news.md 정의 전이(RDS 6개 + DPS+D 편집)만 허용, 그 외 거부(유지). "결정 포인트/가정" → 확정 결정으로 전환. status: draft → approved. (manager-spec)
- 2026-05-27 (v0.1.0): 최초 작성. 3-SPEC 계층 분해(DB → backend → frontend) 중 2번 SPEC. 백엔드 애플리케이션 계층(NodeJS/MVC 함수, 비즈니스 로직, 기사 생애주기 상태머신, 로그인 인증, 기사 ID 생성)만 정의. SPEC-DB-FOUNDATION-001의 확정 스키마/PK/status/ID 계약에 정렬. 미해결 사항은 결정 포인트로 표기. (manager-spec)

---

## 개요 (Overview)

기사 제작 시스템(기사 작성기)의 **백엔드 애플리케이션 계층**을 정의한다. NodeJS + MVC 패턴 위에서
기사 CRUD 함수, 사용자 CRUD + 로그인 인증, 기사 ID 생성 함수, 기사 생애주기 상태머신(RDS/DPS/...),
권한(R/D/Z) 기반 인가를 비즈니스 로직 차원에서 정의한다.

본 SPEC은 **관찰 가능한 백엔드 동작과 비즈니스 규칙만** 다룬다. DB 스키마(SPEC-DB-FOUNDATION-001 확정)와
프런트엔드(React/Vite, 페이지 이동)는 다루지 않는다. 함수명/클래스 구조/API 스키마 등 구현 세부는 Run 단계로 미룬다.

### 계층 분해 위치

| 순번 | SPEC | 범위 |
|------|------|------|
| 1 | SPEC-DB-FOUNDATION-001 (승인됨) | SQLite 스키마, 기사 ID 생성 계약, 소프트 삭제 제약 |
| **2** | **SPEC-BACKEND-CORE-001 (본 SPEC)** | 기사/사용자 함수, 생애주기 전이, 로그인 인증, 권한, 기사 ID 생성 구현 |
| 3 | (예정) frontend SPEC | React + Vite 페이지(로그인/작성/조회), 페이지 이동 |

### 의존성 (Dependency)

본 SPEC은 **SPEC-DB-FOUNDATION-001 (승인됨)** 에 의존한다. 아래 확정 사항을 그대로 준수한다.

- Article/Contents/User 3개 테이블, 모든 컬럼 VARCHAR.
- Article PK = `articleId` 단독. Contents PK = `articleId`, `status` 컬럼 보유. User PK = `userId`.
- 기사 ID 형식 `AKR + YYYYMMDD + 난수 9자리`는 **NodeJS 애플리케이션 함수**가 생성(본 SPEC이 구현 소관).
  동작: ID 생성 → 유니크 검사 → INSERT.
- 소프트 삭제 = 생애주기 KILL 상태(RRK/DDK). 물리 DELETE 금지, 별도 `deleted` 플래그 없음.
- Contents 컬럼(확정): `articleId, title, content, author, modifier, sender, department, departmentCode, createdAt, editedAt, sentAt, embargoAt, secondEmbargoAt, status`.
- **[D-1] `distributedAt`(배부시간) 컬럼**: SPEC-DB-FOUNDATION-001 병행 개정으로 **Contents 테이블에 신규 추가**되는 VARCHAR 컬럼. 본 SPEC의 조회 함수는 이 컬럼을 배부시간 필터로 사용한다.

---

## 환경 및 가정 (Environment & Assumptions)

- 런타임/언어: **NodeJS**.
- 아키텍처: **MVC 패턴** (Controller / Model / Service 계층 분리).
- 데이터 접근: SPEC-DB-FOUNDATION-001의 SQLite DB. status 값은 `Contents.status`에 저장.
- 권한 값: `R`(기자/리포터), `D`(데스크), `Z`(관리자). User 테이블 `role` 컬럼에 저장.
- 모든 텍스트 입출력 인코딩: UTF-8 (CLAUDE.md HARD 규칙).

### 확정 결정 (Confirmed Decisions)

> 2026-05-27 사용자 확인 완료. 아래는 더 이상 가정이 아니라 본 SPEC의 확정 사항이다.

- **[DP-1] 배부시간(distribution time) 조회 = `distributedAt` 컬럼 기준 ✅**
  배부시간 조회는 SPEC-DB-FOUNDATION-001에 **신규 추가되는 `distributedAt` 컬럼(Contents 테이블)** 을 필터로 사용한다.
  (DB SPEC은 병행 개정 중 — D-1 참조.) `sentAt`(송고시간)으로 대체 매핑하지 않는다. → REQ-ART-Q-001 갱신.

- **[DP-2] REST API = 함수/서비스 계약만 정의 ✅**
  본 SPEC은 **함수/서비스 계약(동작·입력·출력·규칙)만** 정의한다. 구체 HTTP 메서드·경로·요청/응답 JSON 스키마는
  Run 단계(또는 별도 API SPEC)로 이연한다. (SPEC은 WHAT/WHY, HOW는 Run 단계 원칙에 부합.)

- **[DP-3] 비밀번호 = 해시 저장 + 해시 비교 (OWASP) ✅**
  비밀번호는 **bcrypt 또는 동급 알고리즘으로 해시 저장**하며, 로그인 시 제출 비밀번호를 동일 방식으로 해시하여
  저장된 해시와 비교한다. 평문 저장·평문 비교는 금지(OWASP 준수). `User.password` 컬럼은 VARCHAR 유지(해시 문자열 보관).
  → REQ-USR-C-001 / REQ-USR-LOGIN-001 갱신.

- **[DP-4] 비-RDS 전이 = news.md 정의 전이만 허용, 그 외 거부 ✅**
  허용 전이는 **RDS 기준 6개(R/D × 송고/보류/KILL) + DPS 상태의 D권한 고침/포털고침 편집**뿐이다.
  그 외 모든 (현재상태, 권한, 액션) 조합은 유효하지 않은 전이로 거부한다(REQ-ART-LC-008).

---

## 요구사항 (Requirements — EARS)

### MVC 아키텍처 (Architecture)

- **REQ-ARCH-001 (Ubiquitous)**: The backend **shall** be organized using the MVC pattern with separated layers — Controller (request handling), Service (business logic: lifecycle, authorization, ID generation), and Model (data access to the SQLite tables).
- **REQ-ARCH-002 (Ubiquitous)**: Business rules (lifecycle transitions, role-based authorization, article-ID generation) **shall** reside in the Service layer, not in Controllers or Models.
- **REQ-ARCH-003 (Ubiquitous)**: The Model layer **shall** be the only layer that issues SQL against the `Article`, `Contents`, and `User` tables defined by SPEC-DB-FOUNDATION-001.

### 기사 함수 — 입력 (Article Create)

- **REQ-ART-C-001 (Event-Driven)**: **When** a client submits article creation data, the system **shall** generate a unique article ID, set the initial lifecycle state to `RDS`, and persist the article across `Article` and `Contents` per the confirmed schema.
- **REQ-ART-C-002 (Ubiquitous)**: On article creation, the system **shall** store the new article's `status` value as `RDS` in `Contents.status`.

### 기사 함수 — 조회 (Article Query)

- **REQ-ART-Q-001 (Event-Driven)** [DP-1]: **When** an article query is requested, the system **shall** support each of the following as an independent filter condition: distribution time (배부시간 = `Contents.distributedAt`, the column added by the amended SPEC-DB-FOUNDATION-001), creation time (작성시간 = `createdAt`), article ID (`articleId`), author (작성자 = `author`), and sender (송고자 = `sender`).
- **REQ-ART-Q-002 (Optional)**: **Where** multiple filter conditions are supplied in one query, the system **shall** combine them conjunctively (AND) to narrow the result set.
- **REQ-ART-Q-003 (Ubiquitous)**: Article query results **shall** include articles in any lifecycle state, including KILL states (RRK/DDK), because no physical deletion occurs (soft-delete contract from SPEC-DB-FOUNDATION-001).

### 기사 함수 — 수정 (Article Update via status change)

- **REQ-ART-U-001 (Event-Driven)**: **When** an article update is requested, the system **shall** locate the target article by `articleId` and change its `status` value in `Contents.status`.
- **REQ-ART-U-002 (Unwanted Behavior)**: **If** no article exists for the supplied `articleId`, **then** the system **shall** reject the update and return a not-found result without modifying any row.

### 기사 함수 — 삭제 (Article Delete = soft delete)

- **REQ-ART-D-001 (Event-Driven)**: **When** an article deletion is requested, the system **shall** locate the article by `articleId` and change `Contents.status` to a KILL state (RRK for role R, DDK for role D) rather than removing the row.
- **REQ-ART-D-002 (Unwanted Behavior)**: **If** an article deletion is requested, **then** the system **shall not** issue a physical SQL `DELETE` against `Article` or `Contents`.

### 사용자 함수 — CRUD (User CRUD)

- **REQ-USR-C-001 (Event-Driven)** [DP-3]: **When** a user-creation request is received, the system **shall** persist a `User` row with `userId, name, password, role, department, departmentCode`, where `role` is one of `R`, `D`, `Z`, and the `password` column **shall** store a hash (bcrypt or equivalent), never the plaintext password.
- **REQ-USR-U-001 (Event-Driven)**: **When** a user-update request is received, the system **shall** locate the user by `userId` and update the supplied fields.
- **REQ-USR-D-001 (Event-Driven)**: **When** a user-delete request is received, the system **shall** remove or deactivate the user keyed by `userId`. (Note: the DB soft-delete rule applies only to articles; the `User` row is NOT protected by the article soft-delete constraint.)
- **REQ-USR-Q-001 (Event-Driven)**: **When** a user-query request is received, the system **shall** return user records matching the supplied condition (e.g., `userId`).

### 사용자 함수 — 로그인 인증 (Login / Authentication)

- **REQ-USR-LOGIN-001 (Event-Driven)** [DP-3]: **When** a login request supplies a `userId` and `password`, the system **shall** authenticate the user successfully **if and only if** the `userId` matches an existing `User` row AND the submitted password, verified against the stored hash via the bcrypt-or-equivalent comparison function, matches.
- **REQ-USR-LOGIN-002 (Unwanted Behavior)**: **If** the submitted `userId` does not exist OR the password hash comparison fails, **then** the system **shall** reject authentication and **shall not** establish an authenticated session.
- **REQ-USR-LOGIN-003 (Event-Driven)**: **When** authentication succeeds, the system **shall** return the authenticated user's identity and `role` so the client may proceed to the article-writing and article-list capabilities. (The actual page navigation is owned by the frontend SPEC; this requirement covers only the backend auth contract.)
- **REQ-USR-LOGIN-004 (Unwanted Behavior)** [DP-3]: **If** any authentication response or user-query result is returned, **then** the system **shall not** include the stored password hash in the response.

### 기사 ID 생성 함수 (Article-ID Generation)

- **REQ-ART-ID-001 (Event-Driven)**: **When** a new article ID is requested, the system **shall** generate an ID of the form `AKR` + `YYYYMMDD` (creation date) + a 9-digit random number, producing an exactly 20-character ID.
- **REQ-ART-ID-002 (Ubiquitous)**: The 9-digit random portion **shall** be zero-padded to maintain a fixed 9-digit length.
- **REQ-ART-ID-003 (Event-Driven)**: **When** generating an article ID, the system **shall** check the candidate ID for uniqueness against `Article.articleId` before INSERT.
- **REQ-ART-ID-004 (Unwanted Behavior)**: **If** the generated article ID collides with an existing `Article.articleId`, **then** the system **shall** regenerate the random portion and retry until a unique ID is obtained.

### 기사 생애주기 상태머신 (Lifecycle State Machine)

> 초기 상태(최초 작성) = `RDS`. 아래 전이는 **현재상태 RDS** 기준이다. (current state, role, action) → next state.

- **REQ-ART-LC-001 (Complex)**: **While** an article is in state `RDS`, **when** a role `R` user performs **send (송고)**, the system **shall** set the state to `RDS`.
- **REQ-ART-LC-002 (Complex)**: **While** an article is in state `RDS`, **when** a role `R` user performs **hold (보류)**, the system **shall** set the state to `RRH`.
- **REQ-ART-LC-003 (Complex)**: **While** an article is in state `RDS`, **when** a role `R` user performs **KILL**, the system **shall** set the state to `RRK`.
- **REQ-ART-LC-004 (Complex)**: **While** an article is in state `RDS`, **when** a role `D` user performs **send (송고)**, the system **shall** set the state to `DPS`.
- **REQ-ART-LC-005 (Complex)**: **While** an article is in state `RDS`, **when** a role `D` user performs **hold (보류)**, the system **shall** set the state to `DDH`.
- **REQ-ART-LC-006 (Complex)**: **While** an article is in state `RDS`, **when** a role `D` user performs **KILL**, the system **shall** set the state to `DDK`.
- **REQ-ART-LC-007 (Ubiquitous)**: On every successful lifecycle transition, the system **shall** persist the resulting state value into `Contents.status`.
- **REQ-ART-LC-008 (Unwanted Behavior)**: **If** a requested (current state, role, action) combination is not an explicitly defined transition (e.g., an undefined source state, an unknown action, or a role not permitted for that action), **then** the system **shall** reject the transition and leave `Contents.status` unchanged.

#### 전이표 (Transition Table — for reference)

| 현재 상태 | 권한 | 액션 | 다음 상태 | 요구사항 |
|-----------|------|------|-----------|----------|
| RDS | R | 송고(send) | RDS | REQ-ART-LC-001 |
| RDS | R | 보류(hold) | RRH | REQ-ART-LC-002 |
| RDS | R | KILL | RRK | REQ-ART-LC-003 |
| RDS | D | 송고(send) | DPS | REQ-ART-LC-004 |
| RDS | D | 보류(hold) | DDH | REQ-ART-LC-005 |
| RDS | D | KILL | DDK | REQ-ART-LC-006 |
| 그 외 (명시되지 않은 조합) | — | — | (거부, 상태 불변) | REQ-ART-LC-008 |

### 권한 기반 인가 (Role-Based Authorization)

- **REQ-ART-AUTH-001 (State-Driven)**: **While** authorizing an article edit, the system **shall** permit roles `R`, `D`, and `Z` to edit the article.
- **REQ-ART-AUTH-002 (State-Driven)**: **While** an article is in state `DPS`, the system **shall** permit only role `D` users to use the edit / portal-edit (고침/포털고침) actions, and **shall** deny those actions to roles `R` and `Z`.
- **REQ-ART-AUTH-003 (Unwanted Behavior)**: **If** a user attempts a lifecycle action their role is not authorized to perform for the article's current state, **then** the system **shall** reject the action and leave the state unchanged.

### 워크플로우 (Workflow)

- **REQ-WF-001 (Event-Driven)**: **When** the client submits article data (e.g., via a send/송고 action carrying an article DTO), the system **shall** route the data through the lifecycle state machine (REQ-ART-LC-*) and persist the resulting state to the DB.
- **REQ-WF-002 (Event-Driven)**: **When** login authentication succeeds (REQ-USR-LOGIN-001), the system **shall** make the article-writing and article-list capabilities available to the authenticated user. (Navigation = frontend SPEC.)

### 외부 미디어 검색 프록시 (External Media Search Proxy)

> 출처: SPEC-FRONTEND-UI-001 [DP-F3]. 프런트엔드 작성 페이지의 이미지/영상 탭은 외부 미디어를 검색하며,
> 이 호출을 **백엔드 프록시를 경유**한다(API 키 서버측 보관, CORS 회피). 프런트엔드 SPEC은 소비 인터페이스만 정의하고,
> 프록시 자체는 본 SPEC의 백엔드 책임이다. 본 SPEC은 함수/서비스 계약만 정의(REST 라우트는 [DP-2]대로 Run 단계 이연).

- **REQ-SRCH-M-001 (Event-Driven)**: **When** the frontend submits a media search query through the backend, the system **shall** provide a media-search-proxy service that accepts the query, calls the YouTube Data API first, and returns normalized results suitable for embedding.
- **REQ-SRCH-M-002 (Unwanted Behavior)**: **If** the YouTube Data API call fails (error response OR an empty result set), **then** the system **shall** fall back to a Google search for the same query and return its normalized results.
- **REQ-SRCH-M-003 (State-Driven)**: **While** returning media search results, the system **shall** emit a normalized result shape — each item carrying at minimum `source` (`youtube` or `google`), `title`, `url`, and (where available) `thumbnailUrl` — independent of which upstream provider produced it.
- **REQ-SRCH-M-004 (Unwanted Behavior)**: **If** both YouTube and the Google fallback fail, **then** the system **shall** return an empty normalized result set with an error indicator rather than propagating the raw upstream error to the client.
- **REQ-SRCH-SEC-001 (Ubiquitous)**: The system **shall** keep the YouTube and Google API keys/credentials server-side (e.g., environment variables) and **shall not** expose them to the client in any request, response, or client-bound configuration.

### 내부 기사 검색 (Internal Article Search — 글기사 탭)

> 글기사 탭은 본문 임베딩용으로 내부 기사의 **제목·본문 내용**을 검색한다. 기존 기사 조회 함수(REQ-ART-Q-*)는
> articleId/작성자/송고자/시간 등 **메타데이터 필터**만 제공하므로 제목·본문 텍스트 검색을 커버하지 못한다 → 전용 계약을 추가한다.

- **REQ-SRCH-A-001 (Event-Driven)**: **When** the frontend submits an internal-article search query (글기사 탭), the system **shall** search internal articles by title and body content (`Contents.title`, `Contents.content`) and return matching articles for embedding. This is distinct from the metadata-filter article query of REQ-ART-Q-*.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 백엔드 애플리케이션 계층(NodeJS/MVC 함수·비즈니스 로직)만 다룬다. 아래는 **명시적으로 범위 밖**이다.

- **DB 스키마/DDL/PK 정의**: SPEC-DB-FOUNDATION-001 소관. 본 SPEC은 그 스키마를 소비만 한다.
- **프런트엔드(React/Vite)**: 로그인/작성/조회 페이지, 컴포넌트, 상태관리, 로그인 후 페이지 이동(navigation)은 frontend SPEC 소관. 본 SPEC은 "인증 성공 후 기능 가용성"이라는 백엔드 계약까지만 정의.
- **구체 REST 엔드포인트 / HTTP 메서드 / 요청·응답 JSON 스키마**: [DP-2 확정] 본 SPEC 범위 밖(별도 API SPEC 또는 Run 단계). 본 SPEC은 함수/서비스 동작 계약만 정의.
- **함수명·클래스명·파일 구조 등 구현 세부**: Run 단계 소관 (SPEC은 WHAT/WHY).
- **비밀번호 해싱 알고리즘의 구체 파라미터(salt rounds 등)**: [DP-3 확정] 해시 저장·해시 비교는 본 SPEC이 요구(bcrypt 또는 동급). cost factor 등 세부 튜닝은 Run 단계 소관.
- **`distributedAt` 컬럼의 DDL 정의**: SPEC-DB-FOUNDATION-001(병행 개정) 소관. 본 SPEC은 해당 컬럼을 조회 필터로 소비만 한다.
- **마크업 버전 이력 보관**: SPEC-DB-FOUNDATION-001 결정 D-A1에 따라 `markupVersion`은 덮어쓰기. 이력 테이블은 별도 SPEC.
- **비-RDS 상태에서 출발하는 추가 전이 규칙**: [DP-4 확정] news.md 정의 전이(RDS 6개 + DPS+D 편집)만 허용, 그 외 거부. 신규 전이 추가 금지.
- **실시간 조회/상태바, 부서별/개인별 메뉴 필터 UI**: frontend SPEC 소관(본 SPEC은 조회 함수의 필터 조건만 제공).
- **인덱스/성능 튜닝, 동시성 제어 정책**: 범위 밖.
- **외부 검색 API 키의 구체 관리·비용·쿼터 정책**: 본 SPEC은 키를 **서버측(환경변수)에 보관하며 클라이언트에 노출하지 않는다**는 계약(REQ-SRCH-SEC-001)만 규정. 구체 키 발급/회전/비용·쿼터 한도·캐싱 전략은 Run 단계 소관.
- **YouTube/Google 검색 응답의 상세 필드 매핑·페이지네이션**: 정규화 결과의 최소 형태(REQ-SRCH-M-003)만 규정. 업스트림별 상세 필드 매핑·페이징은 Run 단계 소관.
- **외부 미디어 검색 UI(이미지/영상 탭 렌더링, 임베딩 동작)**: frontend SPEC(SPEC-FRONTEND-UI-001) 소관. 본 SPEC은 프록시 서비스 계약만 정의.

---

## 참조 (References)

- 의존 SPEC: `.moai/specs/SPEC-DB-FOUNDATION-001/spec.md`, `acceptance.md` (승인됨 — 스키마/PK/status/ID 계약 정렬)
- 원천 명세: `news.md` (서버 기술명세, 기사 함수, 사용자 함수, 워크플로우, 사용자 권한, 기사 제어 권한, 기사 생애주기)
- VO 명세: `ArticleVO.md`, `ContentsVO.md`, `UserVO.md` (필드명)
- 프로젝트 HARD 규칙: `CLAUDE.md` — "DB에 있는 내용은 삭제하지 않는다", "모든 텍스트는 UTF-8"
