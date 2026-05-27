---
id: SPEC-DB-FOUNDATION-001
version: 0.3.0
status: approved
created: 2026-05-27
updated: 2026-05-27
author: manager-spec
priority: high
issue_number: null
---

# SPEC-DB-FOUNDATION-001 — 기사 제작 시스템 DB 기반 계층

## HISTORY

- 2026-05-27 (v0.3.0): Contents 테이블에 `distributedAt`(배부시간, VARCHAR) 컬럼 추가. 후속 backend SPEC(SPEC-BACKEND-CORE-001)이 배부시간 기준 기사 조회를 요구하나 해당 컬럼이 부재했음. 사용자가 `sentAt` 재사용 대신 신규 컬럼 추가를 확정. 다른 확정 결정(D-A1/D-A2/D-A4/D1/D2/A5)은 모두 유지. (manager-spec)
- 2026-05-27 (v0.2.0): 결정 포인트 확정. Article PK=articleId 단독(A1, 복합 PK 폐기), status=Contents.status(A4), 기사 ID 생성=NodeJS 애플리케이션 함수(D1), 소프트 삭제=KILL 상태(RRK/DDK) 재사용·별도 deleted 플래그 없음(D2), User PK=userId(A2), Article↔Contents 필드 중복 허용(A5). "결정 포인트/가정" → 확정 결정으로 전환. status: draft → approved. (manager-spec)
- 2026-05-27 (v0.1.0): 최초 작성. 3-SPEC 계층 분해(DB → backend → frontend) 중 1번 SPEC. DB 계층(SQLite 스키마, 기사 ID 생성, 소프트 삭제 제약)만 정의. (manager-spec)

---

## 개요 (Overview)

기사 제작 시스템(기사 작성기)의 **데이터 저장 기반 계층**을 정의한다. SQLite 단일 파일 DB 위에
`Article`, `Contents`, `User` 3개 테이블 스키마, 기사 아이디 생성 규칙, 그리고
"DB 내용은 삭제하지 않는다"(소프트 삭제)는 프로젝트 HARD 규칙을 스키마 차원에서 보장한다.

본 SPEC은 **DB 계층 스키마와 데이터 무결성 제약만** 다룬다. 애플리케이션 로직, 기사 생애주기
전이 규칙, API 핸들러, 프런트엔드는 후속 SPEC(backend, frontend)에서 다룬다.

### 계층 분해 위치

| 순번 | SPEC | 범위 |
|------|------|------|
| **1** | **SPEC-DB-FOUNDATION-001 (본 SPEC)** | SQLite 스키마, 기사 ID 생성, 소프트 삭제 제약 |
| 2 | (예정) backend SPEC | 기사 입력/수정/조회 함수, 생애주기 전이(RDS/DPS/...), 로그인, MVC |
| 3 | (예정) frontend SPEC | React + Vite 페이지(로그인/작성/조회) |

---

## 환경 및 가정 (Environment & Assumptions)

- DB 엔진: **SQLite** (단일 파일 DB).
- 모든 텍스트 저장 인코딩: **UTF-8**.
- 모든 컬럼 타입: **VARCHAR** (VO 명세 기준). SQLite는 동적 타입이므로 `TEXT`/`VARCHAR` affinity가 동일하게 동작한다.
- 필드명은 VO 파일(ArticleVO / ContentsVO / UserVO)의 영문 식별자를 그대로 사용한다.

### 확정 결정 (Confirmed Decisions)

> 2026-05-27 사용자 확인 완료. 아래는 더 이상 가정이 아니라 본 SPEC의 확정 사항이다.

- **[D-A1] Article 테이블 PK = `articleId` 단독 PK (single column)**. 복합 PK `(articleId, markupVersion)`는 폐기.
  - **Tradeoff**: 단일 PK이므로 동일 기사(`articleId`)당 하나의 행만 존재한다. `markupVersion`은 버전 식별이 아니라
    현재 마크업 버전 값을 보관하는 컬럼으로, 기사 수정 시 **덮어쓰기(overwrite)** 된다 — 마크업 버전 이력은 DB에 누적 보관되지 않는다.
    버전 이력 보관이 후속 요건으로 등장하면 별도 SPEC에서 history 테이블 추가로 대응한다.
- **[D-A2] User 테이블 PK = `userId` 단독 PK** (로그인 식별자).
- **[A3] Contents 테이블 PK = `articleId` 단독 PK** (news.md/ContentsVO 명시 — 처음부터 확정).
- **[D-A4] status 컬럼 = `Contents.status`**. 생애주기 상태값(RDS/DPS/RRH/DDH/RRK/DDK)을 Contents 테이블에 저장한다.
  (상태 **전이 규칙**은 backend SPEC 소관 — 본 SPEC은 저장 컬럼만 정의.)
- **[A5] Article ↔ Contents 필드 중복 허용**: `articleId`, `title`, `content`, `modifier`가 두 테이블에 중복 존재한다.
  VO 명세를 그대로 따라 중복을 허용한다(Article = 마크업/버전 관점, Contents = 발행 메타데이터 관점). 정규화는 보류.
- **[D1] 기사 ID 생성 = NodeJS 애플리케이션 함수**. SQLite는 native Stored Procedure를 지원하지 않으므로,
  명세상의 "기사 ID 생성 SP"는 **백엔드 애플리케이션 측 함수**로 충족한다. 동작: 백엔드에서 ID 생성 → 유니크 검사 → INSERT.
  본 SPEC은 **계약(format `AKR`+YYYYMMDD+9난수, 유니크성)만** 정의하고, 함수 구현 자체는 backend SPEC 소관.
- **[D2] 소프트 삭제 = 생애주기 KILL 상태(RRK/DDK) 재사용**. 물리 DELETE 금지. 별도 `deleted` 플래그 컬럼을 두지 않으며,
  삭제는 `Contents.status`를 KILL 상태값으로 변경하여 표현한다.

---

## 요구사항 (Requirements — EARS)

### 스키마 생성 (Schema Creation)

- **REQ-SCH-001 (Ubiquitous)**: The system **shall** maintain exactly three tables — `Article`, `Contents`, `User` — in a single SQLite database file.
- **REQ-SCH-002 (Ubiquitous)**: The system **shall** store all text columns using **UTF-8** encoding.
- **REQ-SCH-003 (Ubiquitous)**: The `Article` table **shall** contain columns `articleId`, `title`, `content`, `markupVersion`, `modifier`, all of type VARCHAR.
- **REQ-SCH-004 (Ubiquitous)**: The `Contents` table **shall** contain columns `articleId`, `title`, `content`, `author`, `modifier`, `sender`, `department`, `departmentCode`, `createdAt`, `editedAt`, `sentAt`, `distributedAt`, `embargoAt`, `secondEmbargoAt`, all of type VARCHAR. (`distributedAt` = 배부시간; added to support distribution-time queries required by SPEC-BACKEND-CORE-001.)
- **REQ-SCH-005 (Ubiquitous)**: The `User` table **shall** contain columns `userId`, `name`, `password`, `role`, `department`, `departmentCode`, all of type VARCHAR.
- **REQ-SCH-006 (Ubiquitous)**: The `Contents` table **shall** declare `articleId` as its PRIMARY KEY.
- **REQ-SCH-007 (Ubiquitous)** [D-A1]: The `Article` table **shall** declare `articleId` as its single-column PRIMARY KEY (no composite key). `markupVersion` is a non-key column overwritten on update.
- **REQ-SCH-008 (Ubiquitous)** [D-A2]: The `User` table **shall** declare `userId` as its PRIMARY KEY.
- **REQ-SCH-009 (Ubiquitous)** [D-A4]: The system **shall** provide a `status` VARCHAR column **on the `Contents` table** capable of storing lifecycle state values (RDS, DPS, RRH, DDH, RRK, DDK).
- **REQ-SCH-010 (State-Driven)**: **While** the schema is being created, the system **shall** create tables idempotently (`CREATE TABLE IF NOT EXISTS`) so that re-running creation does not destroy existing data.

### 기사 아이디 생성 (Article ID Generation)

- **REQ-ID-001 (Event-Driven)**: **When** a new article ID is requested, the system **shall** generate an ID of the form `AKR` + `YYYYMMDD` (creation date) + a 9-digit random number.
- **REQ-ID-002 (Ubiquitous)**: The generated article ID **shall** be exactly 20 characters (`AKR`=3, date=8, random=9).
- **REQ-ID-003 (Event-Driven)** [D1]: **When** generating an article ID, the system **shall** produce it via a NodeJS application-side function (no native SQLite stored procedure exists); the function generates the ID, checks uniqueness against `Article.articleId`, then INSERTs. Function implementation is owned by the backend SPEC; this SPEC defines only the format and uniqueness contract.
- **REQ-ID-004 (Unwanted Behavior)**: **If** a generated article ID collides with an existing `Article.articleId`, **then** the system **shall** regenerate the random portion and retry until a unique ID is obtained.
- **REQ-ID-005 (Ubiquitous)**: The 9-digit random portion **shall** be zero-padded to maintain a fixed length when the random value has fewer than 9 digits.

### 소프트 삭제 (Soft Delete)

- **REQ-DEL-001 (Unwanted Behavior)**: **If** an article deletion is requested, **then** the system **shall not** issue a physical SQL `DELETE` statement against `Article` or `Contents`.
- **REQ-DEL-002 (Event-Driven)** [D2]: **When** an article deletion is requested, the system **shall** represent the deletion by changing `Contents.status` to a lifecycle KILL state (RRK/DDK) rather than removing the row. No separate `deleted` flag column exists.
- **REQ-DEL-003 (Ubiquitous)**: The system **shall** preserve all historical rows in `Article`, `Contents`, and `User` — no row is ever physically removed.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 DB 계층만 다룬다. 아래는 **명시적으로 범위 밖**이다.

- **기사 생애주기 전이 로직**: RDS→DPS, RDS→RRH 등 상태 전이 규칙과 권한(R/D/Z)별 분기는 **backend SPEC** 소관. 본 SPEC은 상태값을 저장할 컬럼만 정의한다.
- **애플리케이션 함수**: 기사 입력/수정/조회, 사용자 CRUD, 로그인 인증 함수는 backend SPEC 소관.
- **API 핸들러 / 라우팅 / MVC 컨트롤러**: 범위 밖.
- **프런트엔드**: React/Vite 페이지, 컴포넌트, 상태관리는 frontend SPEC 소관.
- **쿼리 조건 로직**: 배부시간/작성시간/작성자/송고자 등 조회 조건 함수는 backend SPEC 소관(DB는 해당 컬럼만 제공).
- **데이터 정규화**: Article/Contents 필드 중복 제거는 의도적으로 보류(결정 A5).
- **인덱스 튜닝 / 성능 최적화**: 본 기반 SPEC 범위 밖.
- **비밀번호 해싱 정책**: `password` 컬럼만 제공. 해싱/암호화 방식은 backend SPEC(보안) 소관.

---

## 참조 (References)

- 원천 명세: `news.md` (기사 DB 명세서, SQLite Store Procedure 명세서, 사용자 권한, 기사 생애주기)
- 프로젝트 기술: `.moai/project/tech.md`
- 프로젝트 HARD 규칙: `CLAUDE.md` — "DB에 있는 내용은 삭제하지 않는다", "모든 텍스트는 UTF-8"
