---
id: SPEC-RCV-COLLECT-001
version: 0.2.0
status: approved
created: 2026-06-13
updated: 2026-06-13
author: manager-spec
priority: high
issue_number: null
---

# SPEC-RCV-COLLECT-001 — 수집(자동기사) 시스템

## HISTORY

- 2026-06-13 (v0.2.0): 결정 포인트 6건 사용자 확정(2026-06-13) 반영, status `draft` → `approved`. **DP-RCV-1 = B안 신규 `Contents.source` 컬럼**(멱등 ALTER, `source='자동기사'`) — 사용자 편집 항목 `attribute`와 분리하여 표지 안정화. AUTOMARK REQ/AC 전부 `source` 컬럼 기준으로 정정. **DP-RCV-2 = RDS** 초기 상태 확정. **DP-RCV-3 = 전용 수신처 설정 테이블**(User 테이블 아님, rcvMgmt.do CRUD) 화이트리스트 출처 확정. **DP-RCV-4 = 피드 우선 스탬핑**(없으면 시스템 기본: 작성자='자동수집', 부서/부서코드 빈 값) 확정. **DP-RCV-5 = 추상 파서 어댑터 + 기본 파서 1종**(이번 Run 범위 최소 1개 구체 파서 포함) 확정. **DP-RCV-6 = rcvMgmt.do 관리 권한 Z 전용** 확정. 멱등 마이그레이션에 `Contents.source` 컬럼 + 수신처 설정 테이블 신설을 additive로 명시. (manager-spec)
- 2026-06-13 (v0.1.0): 최초 작성. 수집(자동기사) 시스템 — API 또는 FTP로 데이터를 수신받아 제목·본문을 파싱하고 '자동기사'로 표시하여 Article/Contents에 등록하는 백엔드 중심 시스템을 정의. 원천 명세 `rcv.md`의 5개 절(자동기사/수신/분석/등록/관리)을 EARS REQ로 분해. SPEC-DB-FOUNDATION-001(스키마·기사 ID 생성·소프트 삭제)과 SPEC-BACKEND-CORE-001(MVC 계층·기사 ID 생성 구현·초기 상태 RDS·Contents.status)의 확정 계약에 정렬. 기존 데이터를 삭제하지 않는 멱등 마이그레이션 제약과 미등록 ID 수신 거부를 Unwanted 동작으로 명문화. 미해결 사항 6건은 결정 포인트(DP-RCV-1~6)로 표기 — status: draft 유지. (manager-spec)

---

## 개요 (Overview)

기사 작성기 프로젝트의 **수집(자동기사) 시스템**을 정의한다. 외부 데이터를 **API 호출** 또는
**FTP(event 방식) 수신**으로 받아, 수신 파일/응답 데이터에서 **제목·본문 내용**을 자동으로 추출(파싱)하고,
그 결과를 **'자동기사'로 표시**하여 `Article`·`Contents` 테이블에 등록한다. 또한 API/FTP 송수신 설정을
조회·생성·삭제할 수 있는 관리 페이지(`rcvMgmt.do`)의 동작 계약을 정의한다.

본 SPEC은 **관찰 가능한 수집 동작과 비즈니스 규칙만** 다룬다(WHAT/WHY). DB 스키마(SPEC-DB-FOUNDATION-001 확정)와
기사 함수·생애주기·MVC 계층(SPEC-BACKEND-CORE-001 확정)을 **소비·재사용**하며, 그 위에 수집 고유의 책임
(수신·파싱·화이트리스트·자동기사 표시·수신처 설정 관리)을 추가한다. 함수명/클래스 구조/REST 라우트/구체 파서 포맷/
FTP 서버 설정/`rcvMgmt.do` UI 렌더링 등 구현 세부는 Run 단계로 미룬다.

### 시스템 분해 위치

| 순번 | SPEC | 범위 |
|------|------|------|
| 1 | SPEC-DB-FOUNDATION-001 (승인됨) | SQLite 스키마, 기사 ID 생성 계약, 소프트 삭제 제약 |
| 2 | SPEC-BACKEND-CORE-001 (승인됨) | 기사/사용자 함수, 생애주기 전이, 로그인 인증, 권한, 기사 ID 생성 구현 |
| 3 | SPEC-FRONTEND-UI-001 (승인됨) | React + Vite UI 3개 페이지(로그인/작성/조회) |
| **수집** | **SPEC-RCV-COLLECT-001 (본 SPEC)** | API/FTP 수신, 파싱, 화이트리스트, 자동기사 표시·등록(트랜잭션), 수신처 설정 관리(rcvMgmt.do) |

### 의존성 (Dependency)

본 SPEC은 **SPEC-DB-FOUNDATION-001 (승인됨)** 및 **SPEC-BACKEND-CORE-001 (승인됨)** 에 의존한다. 아래 확정 계약을 그대로 준수·소비한다.

- **테이블**: `Article`, `Contents`, `User` 3개. 모든 컬럼 VARCHAR. (Dept 테이블 없음 — 부서는 User/Contents 컬럼.)
- **Article**: PK = `articleId` 단독. 본문은 `Article.markupVersion`에 **블록 JSON**으로 저장(`{"format":"yh-editor","version":1,"blocks":[...]}`). 평문 `content` 컬럼은 미사용. (schema.md L38/L40/L51)
- **Contents**: PK = `articleId`(Article과 1:1). 공통정보 컬럼에 **`attribute`(속성)** 포함(사용자 편집 항목 — 본 SPEC은 사용하지 않음, [DP-RCV-1] 참조). 생애주기 `status`(RDS/DPS/RRH/DDH/RRK/DDK)를 `Contents.status`에 저장. 시간 컬럼은 ISO-8601 UTC 문자열. **자동기사 표지는 신규 `Contents.source` 컬럼**(멱등 ALTER, additive)으로 `source='자동기사'` 저장([DP-RCV-1] 확정).
- **기사 ID 생성**: `AKR` + `YYYYMMDD` + 난수 9자리(중복이면 난수 재생성). NodeJS 애플리케이션 함수가 생성(SPEC-DB-FOUNDATION-001 D1, SPEC-BACKEND-CORE-001 REQ-ART-ID-001~004 구현 소관).
- **트랜잭션**: Article·Contents를 함께 수정(입력)할 때는 트랜잭션으로 처리(schema.md L23).
- **초기 상태**: 기사 최초 작성 시 상태값 = `RDS`(news.md 생애주기, SPEC-BACKEND-CORE-001 REQ-ART-C-002).
- **소프트 삭제 / 멱등 마이그레이션**: DB 내용은 절대 삭제하지 않는다. 스키마 변경은 데이터 삭제 없이 컬럼 추가(멱등 마이그레이션)로만. (CLAUDE.md HARD, schema.md L10~L11)

### 본 SPEC이 추가하는 책임 (Additive Scope)

- **수신(Receive)**: FTP event 방식 수신, API 호출/응답 수신.
- **분석(Parse)**: 수신 데이터에서 제목·본문 추출 및 본문 → `Article.markupVersion` 블록 JSON 정규화.
- **화이트리스트(Whitelist)**: 등록되지 않은 ID의 데이터 수신 거부.
- **자동기사 표시(Auto-Mark)**: 모든 자동 등록 기사를 신규 `Contents.source='자동기사'` 컬럼으로 표시.
- **등록(Register)**: 분석 데이터를 Article/Contents에 트랜잭션으로 입력(초기 상태 RDS).
- **관리(Mgmt)**: API/FTP 송수신 설정을 조회/생성/삭제하는 `rcvMgmt.do`.

---

## 환경 및 가정 (Environment & Assumptions)

- 런타임/언어: **NodeJS** (기존 `server/index.js` Express 진입, MVC 패턴 — SPEC-BACKEND-CORE-001 정합).
- 아키텍처: **MVC 패턴**. 수집 비즈니스 로직(수신 디스패치, 파싱, 화이트리스트 판정, 자동기사 표시, 등록 트랜잭션)은 Service 계층에 둔다.
- 데이터 접근: SPEC-DB-FOUNDATION-001의 SQLite DB. 기사는 기존 Article/Contents 테이블에 등록.
- 모든 텍스트 입출력 인코딩: **UTF-8** (CLAUDE.md HARD 규칙).
- 수집은 **백엔드 중심**이다. `rcvMgmt.do` 관리 페이지는 frontend+backend 양쪽이나, 본 SPEC은 그 **백엔드 동작 계약(설정 CRUD 서비스)** 까지 정의하고 UI 렌더링은 Run/프런트엔드 소관으로 둔다(REQ-RCV-MGMT-006 참조).

### 결정 포인트 (Decision Points — 확정, 사용자 승인 2026-06-13)

> 아래 6건은 **모두 사용자 승인으로 확정**되었다(2026-06-13). 본문 REQ/AC는 확정안 기준으로 정렬되었으며 미해결 사항은 없다.
> (선례: SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001 도 DP를 draft에 남겼다가 확정 후 approved로 전환.)

- **[DP-RCV-1] '자동기사' 표시 컬럼 — 확정: B안(신규 `Contents.source` 컬럼)** — rcv.md "자동기사는 데이터베이스 **속성**에 '자동기사'를 꼭 입력".
  - **확정안**: `Contents`에 **신규 `source` 컬럼**을 **멱등 ALTER**(컬럼 존재 확인 후 추가, 기존 데이터 삭제 없음)로 추가하고, 자동 등록 기사는 `source='자동기사'`로 표기한다. additive이므로 DB 삭제 금지 규칙 위배가 아니다.
  - **`attribute`(속성) 미사용 사유**: `attribute`는 작성 페이지 공통정보의 **사용자 편집 항목**이다(schema.md L47, news.md L56). 편집 시 사용자가 값을 덮어쓰면 표지가 사라지고, 수동 입력 시 자동/수동 구분이 모호해진다. 전용 컬럼으로 분리하여 표지를 안정화한다. rcv.md "속성에 '자동기사'"의 의도(자동 표기)를 전용 컬럼으로 안전하게 구현.
  - → REQ-RCV-AUTOMARK-001 / -002, REQ-RCV-MIGRATE-001 이 `source` 컬럼 기준으로 정렬됨.

- **[DP-RCV-2] 자동 등록 기사의 초기 상태 — 확정: RDS** — news.md 생애주기상 최초 작성 = `RDS`.
  - **확정안**: `RDS`(데스크 미송고 검수 진입). 데스크 미송고 목록(RDS, DDH)에 노출되어 데스크 검수 흐름에 자연히 편입된다(news.md L97). 생애주기 전이는 news.md 규칙을 계승한다.
  - → REQ-RCV-REGISTER-003 정렬됨.

- **[DP-RCV-3] 수신 ID 화이트리스트 출처 — 확정: 전용 수신처 설정 테이블** — rcv.md "등록되어 있지 않은 ID는 데이터를 수신받지 않는다".
  - **확정안**: "등록되어 있지 않은 ID는 수신 거부"의 ID 화이트리스트는 **별도 수신처 설정 테이블**(신규, additive 멱등 마이그레이션으로 신설)에서 관리하며 `rcvMgmt.do`에서 CRUD한다. **User 테이블이 아니다** — 수신처 ID는 로그인 사용자가 아니라 외부 피드/송신처 식별자이므로 의미가 다르다.
  - → REQ-RCV-WHITELIST-001 / -002, REQ-RCV-MGMT-*, REQ-RCV-MIGRATE-001 정렬됨.

- **[DP-RCV-4] 자동기사의 작성자·부서 스탬핑 — 확정: 피드 우선 → 시스템 기본** — 자동기사는 사람 작성자가 없다.
  - **확정안**: 수신 피드에 작성자/부서 값이 **있으면 그것을 사용**하고, **없으면 시스템 기본값**으로 스탬프한다 — 작성자='자동수집', 부서/부서코드는 빈 값(또는 시스템 기본). 결과를 `Contents.author/department/departmentCode`에 기록한다.
  - 영향: 부서별 작성/송고·개인별 수정 조회(news.md)에서 자동기사가 어느 부서/작성자로 묶일지 결정한다.
  - → REQ-RCV-REGISTER-001 보조(REQ-RCV-REGISTER-005 신설로 명문화).

- **[DP-RCV-5] 수신 입력 포맷 / 파서 — 확정: 추상 파서 어댑터 + 기본 파서 1종** — rcv.md는 FTP 파일/API 응답의 구체 포맷(XML/JSON/NewsML/평문 등)을 규정하지 않는다.
  - **확정안**: 입력 포맷 → `{ title, bodyBlocks }`로 정규화하는 **추상 파서 어댑터 인터페이스**를 정의하고, **이번 Run 범위에 최소 1개 구체 파서**(예: 제목/본문 키를 갖는 구조화 입력, 또는 평문 첫 줄=제목·이후=본문)를 포함한다. 본문은 schema.md 정합대로 `Article.markupVersion` **yh-editor 블록 JSON**으로 정규화한다(평문은 텍스트 블록 1개 이상으로 감싼다). 추가 포맷 파서는 후속 이연.
  - → REQ-RCV-PARSE-001~005, REQ-RCV-REGISTER-001 정렬됨.

- **[DP-RCV-6] `rcvMgmt.do` 관리 권한 — 확정: Z 전용** — 수신처/API/FTP 설정은 운영 관리 기능이다.
  - **확정안**: 수신처/API/FTP 설정 페이지는 권한 **`Z`(관리자) 전용**으로만 접근·조작한다. 사용자 생성/수정/삭제를 Z 전용으로 제한한 선례(news.md L240)와 정합.
  - → REQ-RCV-MGMT-005 정렬됨.

---

## 요구사항 (Requirements — EARS)

### 아키텍처 (Architecture)

- **REQ-RCV-ARCH-001 (Ubiquitous)**: The collection system **shall** be organized within the existing NodeJS MVC backend, with ingestion dispatch, parsing, whitelist validation, auto-marking, and registration business logic residing in the Service layer (consistent with SPEC-BACKEND-CORE-001 REQ-ARCH-001~002).
- **REQ-RCV-ARCH-002 (Ubiquitous)**: The collection system **shall** persist collected articles into the existing `Article` and `Contents` tables defined by SPEC-DB-FOUNDATION-001, and **shall not** introduce a parallel article store.
- **REQ-RCV-ARCH-003 (Ubiquitous)**: The collection system **shall** reuse the article-ID generation contract (`AKR` + `YYYYMMDD` + 9-digit random, unique-on-collision) implemented per SPEC-BACKEND-CORE-001 REQ-ART-ID-001~004, rather than defining a separate ID scheme.

### 수신 (Receive — FTP event + API)

- **REQ-RCV-RECEIVE-001 (Event-Driven)**: **When** a file is received over FTP, the system **shall** ingest the received file as an event (event-driven FTP reception) and pass it to the analysis (parse) stage.
- **REQ-RCV-RECEIVE-002 (Event-Driven)**: **When** the system calls an external API and obtains a response, the system **shall** ingest the response data and pass it to the analysis (parse) stage.
- **REQ-RCV-RECEIVE-003 (State-Driven)**: **While** ingesting from either source (FTP or API), the system **shall** evaluate the source/sender ID against the registered-ID whitelist (REQ-RCV-WHITELIST-001) **before** parsing or registering any data.

### 화이트리스트 (Whitelist — 미등록 ID 거부)

- **REQ-RCV-WHITELIST-001 (Event-Driven)** [DP-RCV-3 확정]: **When** data arrives carrying a source/sender ID, the system **shall** accept the data for further processing **if and only if** that ID is present in the registered receiver-ID whitelist, where the whitelist is sourced from the dedicated receiver-configuration table managed via `rcvMgmt.do` (NOT the `User` table).
- **REQ-RCV-WHITELIST-002 (Unwanted Behavior)**: **If** the arriving data's source/sender ID is **not** registered in the receiver-configuration whitelist, **then** the system **shall** reject the data without parsing or registering it, and **shall not** create any `Article`/`Contents` row from it.

### 분석 (Parse — 제목/본문 추출)

- **REQ-RCV-PARSE-001 (Event-Driven)**: **When** a file is received over FTP and accepted by the whitelist, the system **shall** analyze the file to extract the article **title** and **body content**.
- **REQ-RCV-PARSE-002 (Event-Driven)**: **When** API response data is received and accepted by the whitelist, the system **shall** analyze the data to extract the article **title** and **body content**.
- **REQ-RCV-PARSE-003 (Ubiquitous)** [DP-RCV-5 확정]: The parser **shall** normalize the extracted body into the `Article.markupVersion` block-JSON form (`{"format":"yh-editor","version":1,"blocks":[...]}`), so that the collected article's body is stored in the same structure as articles authored by the editor (schema.md L38). Plain-text bodies **shall** be wrapped into at least one text block.
- **REQ-RCV-PARSE-004 (Unwanted Behavior)**: **If** the title or the body content cannot be extracted from the received data, **then** the system **shall** reject/skip that item and **shall not** persist a partially-formed or malformed article.
- **REQ-RCV-PARSE-005 (Ubiquitous)** [DP-RCV-5 확정]: The system **shall** define an abstract parser-adapter interface (in: received input → out: `{title, bodyBlocks}`) AND **shall** provide at least one concrete parser within this Run scope (e.g., a structured input carrying title/body keys, or plain text where the first line is the title and the remainder is the body). Additional format-specific parsers are deferred to follow-up SPECs.

### 등록 (Register — Article/Contents 입력 + 트랜잭션)

- **REQ-RCV-REGISTER-001 (Event-Driven)**: **When** parsed data (title + normalized body) is available, the system **shall** persist a collected article across `Article` (title + body block JSON in `markupVersion`) and `Contents` (title + lifecycle/common-info fields), keyed by the generated `articleId`.
- **REQ-RCV-REGISTER-002 (Ubiquitous)**: Registration that writes both `Article` and `Contents` **shall** be performed within a single transaction, consistent with the schema rule that joint Article/Contents modifications are transactional (schema.md L23).
- **REQ-RCV-REGISTER-003 (Ubiquitous)** [DP-RCV-2 확정]: On registration, the system **shall** set the collected article's initial `Contents.status` to `RDS` (desk pre-submission review entry per news.md lifecycle).
- **REQ-RCV-REGISTER-004 (Unwanted Behavior)**: **If** the transaction cannot be completed for a collected article, **then** the system **shall** roll back so that neither a partial `Article` row nor a partial `Contents` row remains, leaving the database unchanged for that item.
- **REQ-RCV-REGISTER-005 (State-Driven)** [DP-RCV-4 확정]: **While** stamping the author/department of a collected article, the system **shall** use the author/department values from the received feed **when present**; **otherwise** the system **shall** stamp system defaults — `Contents.author='자동수집'` and empty (or system-default) `Contents.department`/`departmentCode`.

### 자동기사 표시 (Auto-Mark)

- **REQ-RCV-AUTOMARK-001 (Ubiquitous)** [DP-RCV-1 확정]: Every collected (auto) article **shall** carry the `'자동기사'` mark in the new dedicated `Contents.source` column (`Contents.source='자동기사'`). The user-editable `Contents.attribute` column **shall not** be used for this mark (avoids overwrite conflict and auto/manual ambiguity).
- **REQ-RCV-AUTOMARK-002 (Unwanted Behavior)**: **If** an article is being registered through the collection pipeline, **then** the system **shall not** persist it without `Contents.source='자동기사'` — the source mark is mandatory for every auto-collected article (rcv.md 규칙: "자동기사는 데이터베이스 속성에 '자동기사'를 꼭 입력", 전용 `source` 컬럼으로 안전하게 구현).

### 관리 (Management — rcvMgmt.do CRUD)

> rcv.md 관리 명세서: "API 설정, FTP 송신, 수신을 설정할 수 있는 페이지(rcvMgmt.do)를 **조회/생성/삭제** 할 수 있다." (수정(update)은 rcv.md에 명시되지 않음 — 조회/생성/삭제만 정의.)

- **REQ-RCV-MGMT-001 (Event-Driven)**: **When** a read (조회) request is made via `rcvMgmt.do`, the system **shall** return the existing receiver configuration entries (API settings, FTP send settings, FTP/receive settings).
- **REQ-RCV-MGMT-002 (Event-Driven)**: **When** a create (생성) request is made via `rcvMgmt.do`, the system **shall** persist a new receiver configuration entry (e.g., an API setting, an FTP send setting, or a receive/whitelist setting).
- **REQ-RCV-MGMT-003 (Event-Driven)**: **When** a delete (삭제) request is made via `rcvMgmt.do` for a receiver configuration entry, the system **shall** remove that configuration entry.
- **REQ-RCV-MGMT-004 (Unwanted Behavior)**: **If** a receiver configuration entry is deleted, **then** the system **shall not** delete or alter any already-collected articles in `Article`/`Contents` — deletion is scoped to the configuration entry only (DB no-delete rule applies to article data).
- **REQ-RCV-MGMT-005 (State-Driven)** [DP-RCV-6 확정]: **While** authorizing `rcvMgmt.do` configuration actions (read/create/delete), the system **shall** permit only role `Z` (administrator) and **shall** deny the action to all other roles (R, D).
- **REQ-RCV-MGMT-006 (Ubiquitous)**: `rcvMgmt.do` **shall** be backed by a backend configuration service exposing read/create/delete operations; the page's UI rendering is owned by the frontend/Run scope, while this SPEC defines the backend behavior contract.

### 멱등 마이그레이션 (Idempotent Migration — DB 삭제 금지)

- **REQ-RCV-MIGRATE-001 (Ubiquitous)** [DP-RCV-1, DP-RCV-3 확정]: The collection system **shall** introduce its required schema changes as additive, idempotent migrations only — specifically (a) a new `Contents.source` column ([DP-RCV-1]) and (b) a new dedicated receiver-configuration table ([DP-RCV-3]) — applied via `ALTER TABLE Contents ADD COLUMN source ...` guarded by a column-existence check and `CREATE TABLE IF NOT EXISTS`, preserving all existing rows and columns.
- **REQ-RCV-MIGRATE-002 (Unwanted Behavior)**: **If** a schema change is applied for the collection system, **then** the system **shall not** drop, recreate, or delete any existing table, column, or row (CLAUDE.md HARD: "DB에 있는 내용은 절대 삭제하지 않는다"; schema.md L10~L11).

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 수집(자동기사) 시스템의 **관찰 가능한 동작과 비즈니스 규칙**(WHAT/WHY)만 다룬다. 아래는 명시적으로 범위 밖이다.

- **DB 스키마/DDL/PK 정의 자체**: SPEC-DB-FOUNDATION-001 소관. 본 SPEC은 그 스키마를 소비하고, 수집에 필요한 컬럼/테이블(신규 `Contents.source` 컬럼, 수신처 설정 테이블)은 **additive 멱등 마이그레이션**으로만 추가(REQ-RCV-MIGRATE-001).
- **기사 함수·생애주기 전이·로그인·권한 판정 로직**: SPEC-BACKEND-CORE-001 소관. 본 SPEC은 등록 시 초기 상태 RDS와 기사 ID 생성 계약을 **재사용**할 뿐, 전이표를 새로 정의하지 않는다.
- **구체 FTP 서버/프로토콜 설정**: FTP 호스트·포트·자격증명·디렉터리 감시 방식·이벤트 트리거 메커니즘 등 인프라 구성은 Run 단계 소관. 본 SPEC은 "FTP event 방식으로 수신해 분석한다"는 동작 계약만 규정.
- **구체 외부 API 연동 세부**: 업스트림 API의 엔드포인트·인증·폴링 주기·스케줄링·레이트리밋은 Run 단계 소관. 본 SPEC은 "API 호출 응답을 수신해 분석한다"는 계약만 규정.
- **구체 수신 데이터 포맷 파서 구현**: [DP-RCV-5] 파서는 추상 어댑터(in: 포맷 → out: `{title, bodyBlocks}`)로만 규정. XML/JSON/NewsML/평문 등 포맷별 파서 구현은 Run 단계.
- **본문 블록 JSON 변환의 상세 매핑 규칙**: yh-editor 블록 구조로 정규화한다는 계약(REQ-RCV-PARSE-003)만 규정. 임베드/단락 분해 등 상세 매핑은 어댑터 구현(Run)에 위임.
- **`rcvMgmt.do` 프런트엔드 UI 렌더링**: React 컴포넌트·폼·레이아웃·디자인은 frontend/Run 소관(REQ-RCV-MGMT-006). 본 SPEC은 백엔드 설정 CRUD 서비스 계약만 정의.
- **구체 REST 엔드포인트 / HTTP 메서드 / 요청·응답 JSON 스키마**: SPEC-BACKEND-CORE-001 [DP-2] 선례대로 함수/서비스 계약만 정의하고 REST 라우트는 Run 단계로 이연.
- **함수명·클래스명·파일 구조 등 구현 세부**: Run 단계 소관.
- **중복 수신 피드의 dedup(동일 콘텐츠 재수신) 정책**: 기사 ID 충돌 재시도(SPEC-BACKEND-CORE-001 REQ-ART-ID-004)는 재사용하나, 동일 원문이 여러 번 수신될 때의 중복 기사 방지 정책은 본 SPEC 범위 밖(필요 시 별도 SPEC).
- **수신 재시도/실패 알림/모니터링·스케줄링 인프라**: 범위 밖(Run/운영 소관).
- **인덱스/성능 튜닝, 동시성 제어 정책**: 범위 밖.

---

## 참조 (References)

- 원천 명세: `rcv.md` (자동기사/수신/분석/등록/관리 5개 절)
- 의존 SPEC: `.moai/specs/SPEC-DB-FOUNDATION-001/spec.md` (스키마·기사 ID 생성·소프트 삭제), `.moai/specs/SPEC-BACKEND-CORE-001/spec.md` (MVC 계층·기사 ID 생성 구현·초기 상태 RDS·Contents.status·트랜잭션)
- 정합 명세: `news.md` (기사 생애주기 RDS/DPS/RRH/RRK/DDH/DDK, 데스크 미송고 목록, 사용자 관리 Z 전용), `schema.md` (Article.markupVersion 블록 JSON, Contents.attribute 사용자 편집 속성 컬럼 — 본 SPEC은 자동기사 표지에 미사용, 신규 Contents.source 컬럼 사용, 트랜잭션, 멱등 마이그레이션)
- 프로젝트 HARD 규칙: `CLAUDE.md` — "DB에 있는 내용은 절대 삭제하지 않는다", "모든 텍스트는 UTF-8"
