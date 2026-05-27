---
id: SPEC-AUTH-001
version: 0.1.0
status: draft
created: 2026-05-27
updated: 2026-05-27
author: MoAI
priority: high
issue_number: 0
---

# SPEC-AUTH-001 — 기사 제작 시스템 인증 · 세션 · 인가 계층

## HISTORY

- 2026-05-27 (v0.1.0): 최초 작성. 기사 제작 시스템의 **인증(authentication) · 세션(session) · 인가(authorization)** 횡단 계층을 정의. 기존 3-SPEC 계층(DB → backend → frontend)이 "인증 계약"·"권한 판정"·"로그인 UI"를 부분적으로 다루나, **쿠키 기반 서버 세션 메커니즘 자체**는 어느 SPEC에도 정의되지 않았음(backend는 인증 계약과 "기능 가용성"까지만, frontend는 "세션이 없으면"이라는 전제만 사용). 본 SPEC이 그 갭을 메우고, R/D/Z 권한 인가를 횡단 관심사로 통합한다. 기사 생애주기 전이 로직은 SPEC-BACKEND-CORE-001 소관으로 두고 본 SPEC은 *권한 체크 계층*만 소유한다. 브라운필드이므로 [DELTA] 마커로 기존 SPEC과의 관계를 표기. (MoAI)

---

## 개요 (Overview)

기사 제작 시스템(기사 작성기)의 **인증 · 세션 · 인가 횡단 계층**을 정의한다. 본 SPEC은 다음 세 가지를 소유한다.

1. **로그인 인증 동작**: 아이디 + 비밀번호를 DB(User 테이블)와 대조하여 성공/실패를 판정하고, 성공 시 기사 작성 페이지로 이동, 실패 시 사유와 함께 ALERT를 띄우는 관찰 가능한 동작.
2. **세션 유지 메커니즘**: **서버 측 세션 + 세션 쿠키**(JWT 아님). 인증 성공 시 서버 세션 수립, 모든 보호된 페이지/요청에서 세션 검증, 모든 페이지 우측 상단의 로그인 사용자 정보 표시.
3. **권한 인가 체크 계층**: R/D/Z 권한별 기사 편집/고침·포털고침 게이팅, 사용자 관리(입력/수정/삭제/조회) 권한, 그리고 권한 없는 요청의 거부.

본 SPEC은 **관찰 가능한 동작과 권한 규칙만** 다룬다. 기사 생애주기 *전이 규칙*(RDS→DPS 등)은 SPEC-BACKEND-CORE-001 소관이며, 본 SPEC은 그 전이가 일어나기 전 단계의 **권한 체크 계층**만 소유한다. 함수명/클래스 구조/세션 스토어 종류/쿠키 속성 세부 등 구현 세부는 Run 단계로 미룬다.

### 계층 분해 위치 (Layer Position)

| 순번 | SPEC | 범위 |
|------|------|------|
| 1 | SPEC-DB-FOUNDATION-001 (승인됨) | SQLite 스키마(User 테이블 incl. `password`,`role`), 기사 ID, 소프트 삭제 |
| 2 | SPEC-BACKEND-CORE-001 (승인됨) | 기사/사용자 함수, 생애주기 전이, 로그인 인증 계약, 권한 판정, 기사 ID 생성 |
| 3 | SPEC-FRONTEND-UI-001 (승인됨) | React/Vite 3개 페이지, 로그인 폼 UI, 공통 사용자 정보 표시, 권한별 UI 노출 |
| **X** | **SPEC-AUTH-001 (본 SPEC, 횡단)** | **쿠키 기반 서버 세션 메커니즘, 세션 검증, 인증 동작, R/D/Z 인가 체크 계층, 사용자 관리 권한** |

### 의존성 및 [DELTA] 관계 (Dependencies & Brownfield Deltas)

본 SPEC은 기존 3개 승인 SPEC에 **세션 계층을 추가(DELTA)** 한다. 기존 요구사항을 재정의하지 않고 **연결·보강**한다.

- **[DELTA from SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-001~004]**: 백엔드는 "인증 성공/실패 판정"과 "비밀번호 해시 비교"까지 정의했으나, **세션을 어떻게 수립·유지하는지**(REQ-USR-LOGIN-002의 "shall not establish an authenticated session"이 가리키는 *세션*의 정의)는 미정의. 본 SPEC이 그 세션 = **서버 측 세션 + 세션 쿠키**로 확정한다.
- **[DELTA from SPEC-BACKEND-CORE-001 REQ-ART-AUTH-001~003]**: 백엔드는 권한 판정 규칙(R/D/Z 편집, DPS는 D만 고침/포털고침)을 정의했다. 본 SPEC은 이를 **재정의하지 않고**, 그 판정이 **수립된 세션의 `role`을 입력으로 삼아 실행되는 인가 체크 계층**으로서 연결한다. 전이 로직은 SPEC-BACKEND-CORE-001 소유로 유지.
- **[DELTA from SPEC-FRONTEND-UI-001 REQ-FE-APP-004]**: 프런트엔드는 "인증 세션이 없으면 보호 페이지를 렌더링하지 않고 로그인으로 라우팅"한다고 전제했다. 본 SPEC이 그 **세션 존재 판정의 서버 측 권위(authority)** = 세션 쿠키 검증으로 확정한다(UI 게이팅은 보조, 서버가 최종 강제).
- **[DELTA — 신규] 사용자 관리 인가**: SPEC-BACKEND-CORE-001은 사용자 CRUD 함수(REQ-USR-C/U/D/Q)를 정의했으나 **어느 권한이 사용자를 관리할 수 있는지**는 미정의. 본 SPEC이 그 인가 규칙을 신규 정의한다.

---

## 환경 및 가정 (Environment & Assumptions)

- 세션 메커니즘: **서버 측 세션 + 세션 쿠키** (JWT/토큰 기반 아님). 단일 서버 + SQLite + NodeJS/MVC 아키텍처에 정합.
- 인증 입력: `userId`(아이디) + `password`(암호). User 테이블과 대조(SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-001, 해시 비교).
- 권한 값: `R`(기자/리포터), `D`(국기사/데스크), `Z`(관리자). User 테이블 `role` 컬럼.
- 사용자 표시 필드: `userId, name, role, department, departmentCode` (UserVO). 우측 상단 표시에 사용.
- 모든 텍스트 입출력 인코딩: **UTF-8** (CLAUDE.md HARD 규칙).
- **HARD 규칙**: DB에 있는 내용은 삭제하지 않는다. 사용자 "삭제"는 물리 DELETE가 아니라 **상태 기반 소프트 삭제(비활성화)** 로 처리한다.

### 확정 결정 (Confirmed Decisions)

> 2026-05-27 사용자 확인 완료. 아래는 본 SPEC의 확정 사항이다.

- **[D-AUTH-1] 세션 = 서버 측 세션 + 세션 쿠키 ✅** (JWT 미사용). 인증 성공 시 서버가 세션을 생성하고 세션 식별자를 쿠키로 클라이언트에 전달한다. 이후 보호된 요청은 쿠키의 세션 식별자로 서버 측 세션을 조회·검증한다.
- **[D-AUTH-2] 인가 권위 = 서버 ✅**. UI 노출/비활성(SPEC-FRONTEND-UI-001)은 보조 수단이며, 최종 인가 거부는 서버 세션의 `role`을 근거로 서버가 강제한다.
- **[D-AUTH-3] 사용자 "삭제" = 소프트 삭제(비활성화) ✅**. CLAUDE.md HARD 규칙("DB 내용 미삭제")을 사용자 관리에도 적용한다. 물리 DELETE 금지. (참고: SPEC-BACKEND-CORE-001 REQ-USR-D-001은 "remove or deactivate"를 허용했으나, 프로젝트 HARD 규칙에 따라 본 SPEC은 **deactivate(소프트 삭제)로 확정**한다.)
- **[D-AUTH-4] 권한 체크 계층만 소유 ✅**. 기사 생애주기 전이(RDS→DPS 등) 계산은 SPEC-BACKEND-CORE-001 소유. 본 SPEC은 전이 실행 직전 "이 세션의 role이 이 액션을 수행할 권한이 있는가"의 판정만 소유한다.

---

## 요구사항 (Requirements — EARS)

본 SPEC은 5개 요구사항 모듈로 구성된다: ① 로그인 인증, ② 세션 수립·유지, ③ 세션 검증·보호, ④ 권한 기반 인가, ⑤ 사용자 관리 인가.

### 모듈 ① 로그인 인증 (Login Authentication)

- **REQ-AUTH-LOGIN-001 (Event-Driven)**: **When** a user submits `userId` and `password` to the login endpoint, the system **shall** validate the credentials against the User table (delegating the credential/hash comparison to SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-001).
- **REQ-AUTH-LOGIN-002 (Event-Driven)**: **When** credential validation succeeds, the system **shall** establish an authenticated server-side session (see 모듈 ②) and signal success so the client may navigate to the article-write page.
- **REQ-AUTH-LOGIN-003 (Unwanted Behavior)**: **If** credential validation fails (unknown `userId` OR password mismatch), **then** the system **shall not** establish a session and **shall** return a failure result carrying the reason so the client can display an ALERT message with that reason (news.md 58-59).
- **REQ-AUTH-LOGIN-004 (Unwanted Behavior)**: **If** any login or session response is produced, **then** the system **shall not** include the stored password hash in the response (reaffirms SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-004).

### 모듈 ② 세션 수립 · 유지 (Session Establishment & Persistence) [D-AUTH-1]

- **REQ-AUTH-SESS-001 (Event-Driven)**: **When** authentication succeeds, the system **shall** create a server-side session record bound to the authenticated user and **shall** issue a session cookie carrying the session identifier to the client.
- **REQ-AUTH-SESS-002 (Ubiquitous)**: The system **shall** use a server-side session (NOT JWT/token-based authentication); the cookie **shall** carry only an opaque session identifier, not the user's credentials or `role`.
- **REQ-AUTH-SESS-003 (Ubiquitous)**: The server session **shall** retain at minimum the authenticated user's `userId`, `name`, `role`, `department`, and `departmentCode` so that protected pages can render the top-right user-info element without re-querying credentials (news.md 37; SPEC-FRONTEND-UI-001 REQ-FE-APP-003).
- **REQ-AUTH-SESS-004 (Event-Driven)**: **When** the user logs out, the system **shall** invalidate the server-side session and **shall** clear/expire the session cookie.

### 모듈 ③ 세션 검증 · 보호 (Session Validation & Route Protection)

- **REQ-AUTH-GUARD-001 (Event-Driven)**: **When** a request targets a protected resource (article-write or article-view capabilities, article/user functions), the system **shall** validate the session cookie against an active server-side session before serving the request.
- **REQ-AUTH-GUARD-002 (Unwanted Behavior)**: **If** a protected request carries no session cookie OR an invalid/unknown session identifier, **then** the system **shall** reject the request as unauthenticated and **shall not** serve the protected resource (this is the server-side authority backing SPEC-FRONTEND-UI-001 REQ-FE-APP-004) [D-AUTH-2].
- **REQ-AUTH-GUARD-003 (Unwanted Behavior)**: **If** a session has expired, **then** the system **shall** treat subsequent protected requests as unauthenticated and **shall** require re-authentication rather than silently serving stale-session content.

### 모듈 ④ 권한 기반 인가 (Role-Based Authorization Check Layer) [D-AUTH-4]

- **REQ-AUTH-ROLE-001 (State-Driven)**: **While** authorizing an article edit, the system **shall** permit roles `R`, `D`, and `Z` (connecting the session `role` to SPEC-BACKEND-CORE-001 REQ-ART-AUTH-001; this SPEC owns the permission check, not the transition logic).
- **REQ-AUTH-ROLE-002 (State-Driven)**: **While** an article is in lifecycle state `DPS`, the system **shall** permit only sessions whose `role` is `D` to invoke the 고침/포털고침 (edit / portal-edit) actions, and **shall** deny those actions to roles `R` and `Z` (permission check for SPEC-BACKEND-CORE-001 REQ-ART-AUTH-002).
- **REQ-AUTH-ROLE-003 (Unwanted Behavior)**: **If** a session attempts an action its `role` is not authorized to perform for the article's current state, **then** the system **shall** reject the action before any lifecycle transition is computed and **shall** leave the article state unchanged (the transition computation itself remains owned by SPEC-BACKEND-CORE-001).
- **REQ-AUTH-ROLE-004 (Ubiquitous)**: The system **shall** derive the acting `role` exclusively from the validated server-side session, never from a client-supplied `role` value [D-AUTH-2].

### 모듈 ⑤ 사용자 관리 인가 (User-Management Authorization) [DELTA — 신규]

- **REQ-AUTH-USRMGMT-001 (State-Driven)**: **While** authorizing a user-management function (사용자 입력/수정/삭제/조회 — SPEC-BACKEND-CORE-001 REQ-USR-C/U/D/Q), the system **shall** permit user creation, update, and deactivation (삭제) only to sessions whose `role` is `Z` (관리자).
- **REQ-AUTH-USRMGMT-002 (Unwanted Behavior)**: **If** a session whose `role` is `R` or `D` attempts user creation, update, or deactivation, **then** the system **shall** reject the request without modifying any User row.
- **REQ-AUTH-USRMGMT-003 (Event-Driven)** [D-AUTH-3]: **When** a user deactivation (사용자 삭제) is authorized and requested, the system **shall** represent the deletion by a status-based soft delete (deactivation flag/status) and **shall not** issue a physical SQL `DELETE` against the User table (CLAUDE.md HARD rule: DB content is never deleted).
- **REQ-AUTH-USRMGMT-004 (Ubiquitous)**: A deactivated user **shall not** be able to establish a new authenticated session (login is rejected for deactivated users), while the user's row is preserved in the DB.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 인증·세션·인가 횡단 계층만 다룬다. 아래는 **명시적으로 범위 밖**이다.

- **수집 시스템 · 배부 시스템의 인증**: 현재 구현 범위는 제작 시스템뿐(CLAUDE.md). 수집/배부 시스템의 인증·인가는 본 SPEC 범위 밖.
- **JWT / 토큰 기반 인증**: [D-AUTH-1 확정] 서버 측 세션 + 쿠키로 확정. JWT, OAuth 토큰, 무상태(stateless) 토큰 인증은 범위 밖.
- **MFA(다단계 인증) / SSO / 소셜 로그인 / 외부 IdP 연동**: 범위 밖.
- **기사 생애주기 전이 *계산* 로직**: RDS→DPS 등 (현재상태, 권한, 액션) → 다음 상태 계산은 SPEC-BACKEND-CORE-001(REQ-ART-LC-*) 소관. 본 SPEC은 전이 직전의 권한 체크만 소유.
- **비밀번호 해싱 알고리즘 / 해시 비교 구현**: SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-001/REQ-USR-C-001(bcrypt 또는 동급) 소관. 본 SPEC은 인증 동작의 흐름만 정의.
- **DB 스키마 / User 테이블 DDL / 비활성화 컬럼의 DDL 정의**: SPEC-DB-FOUNDATION-001 소관. 본 SPEC은 소프트 삭제 동작 계약만 규정(컬럼 추가가 필요하면 DB SPEC 개정으로 처리).
- **세션 스토어 구현 세부 (메모리/SQLite/Redis), 세션 만료 시간 값, 쿠키 속성(HttpOnly/Secure/SameSite) 구체값**: Run 단계 소관. 본 SPEC은 "서버 세션 + 세션 쿠키 + 만료 시 재인증"이라는 동작 계약만 정의.
- **구체 REST 엔드포인트 / HTTP 메서드 / 요청·응답 JSON 스키마**: 백엔드 [DP-2 확정]대로 Run 단계 소관.
- **로그인 폼 UI 렌더링 / 비밀번호 마스킹 / 페이지 라우팅 동작**: SPEC-FRONTEND-UI-001(REQ-FE-LOGIN-*, REQ-FE-APP-*) 소관. 본 SPEC은 서버 측 인증·세션 권위만 정의.
- **속도 제한(rate limiting) / 무차별 대입(brute-force) 방어 / CSRF 토큰 정책**: 본 SPEC 범위 밖(후속 보안 강화 SPEC). 본 SPEC은 인증·세션·인가의 핵심 동작에 집중.

---

## 참조 (References)

- 의존 SPEC: `.moai/specs/SPEC-BACKEND-CORE-001/spec.md` (승인됨 — 인증 계약 REQ-USR-LOGIN-*, 권한 판정 REQ-ART-AUTH-*, 사용자 CRUD REQ-USR-*)
- 의존 SPEC: `.moai/specs/SPEC-FRONTEND-UI-001/spec.md` (승인됨 — 로그인 폼·세션 전제 REQ-FE-LOGIN-*/REQ-FE-APP-004, 권한별 UI 게이팅 REQ-FE-VIEW-009/010)
- 의존 SPEC: `.moai/specs/SPEC-DB-FOUNDATION-001/spec.md` (승인됨 — User 테이블 `password`/`role`, 소프트 삭제 HARD 규칙)
- 원천 명세: `news.md` (18-21 사용자 함수, 32 로그인 페이지, 37 사용자 정보 표시, 58-60 로그인 흐름, 72-86 사용자/기사 제어 권한·생애주기)
- VO 명세: `UserVO.md` (유저아이디/이름/비밀번호/권한/부서/부서코드)
- 프로젝트 HARD 규칙: `CLAUDE.md` — "DB에 있는 내용은 삭제하지 않는다", "모든 텍스트는 UTF-8", 현재 구현 범위는 제작 시스템
