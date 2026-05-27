# SPEC-AUTH-001 — 구현 계획 (Implementation Plan)

> 본 문서는 *무엇을 어떤 순서로* 구축할지의 계획이다. 함수명·클래스 구조·세션 스토어 종류 등 구현 세부(HOW)는 Run 단계 소관이다.

## 기술 접근 (Technical Approach)

- **세션 메커니즘**: 서버 측 세션 + 세션 쿠키 (JWT 미사용). NodeJS/MVC 백엔드(SPEC-BACKEND-CORE-001)의 Controller/Service 계층에 인증·세션·인가를 횡단 미들웨어/서비스로 통합.
- **인가 위치**: 세션 `role`을 단일 권위로 삼아 Service 계층(기사 편집/고침 권한, 사용자 관리 권한)에서 판정. UI 게이팅(SPEC-FRONTEND-UI-001)은 보조이며 서버가 최종 강제.
- **소프트 삭제**: 사용자 삭제 = 상태 기반 비활성화. 물리 DELETE 금지(CLAUDE.md HARD 규칙). 필요 시 SPEC-DB-FOUNDATION-001 개정으로 User 비활성화 컬럼 추가.
- **기존 SPEC 정렬**: 본 SPEC은 신규 전이 규칙·해시 알고리즘·UI 렌더링을 재정의하지 않고, 기존 승인 SPEC의 계약을 세션 계층으로 연결([DELTA]).

## 마일스톤 (Milestones — 우선순위 기반, 시간 추정 없음)

### Milestone 1 (Priority High) — 세션 메커니즘 기반
- 서버 측 세션 생성/조회/무효화 서비스 계약 (REQ-AUTH-SESS-001~004)
- 세션 쿠키 발급/검증 (불투명 식별자만; 자격·role 미포함)
- 세션 보관 정보: userId/name/role/department/departmentCode
- 의존: SPEC-BACKEND-CORE-001 REQ-USR-LOGIN-* (인증 판정), SPEC-DB-FOUNDATION-001 User 테이블

### Milestone 2 (Priority High) — 로그인 인증 흐름 연결
- 로그인 성공 → 세션 수립 → 성공 신호 (REQ-AUTH-LOGIN-001/002)
- 로그인 실패 → 세션 미수립 + 사유 반환(ALERT용) (REQ-AUTH-LOGIN-003)
- 응답에 비밀번호 해시 미포함 (REQ-AUTH-LOGIN-004)
- 의존: Milestone 1

### Milestone 3 (Priority High) — 세션 검증 · 보호 (라우트 가드)
- 보호 자원 접근 시 세션 검증 (REQ-AUTH-GUARD-001)
- 미인증/무효 세션 거부 (REQ-AUTH-GUARD-002)
- 만료 세션 → 재인증 요구 (REQ-AUTH-GUARD-003)
- 의존: Milestone 1

### Milestone 4 (Priority High) — 권한 기반 인가 체크 계층
- R/D/Z 편집 허용 (REQ-AUTH-ROLE-001)
- DPS 상태 고침/포털고침 = D만 허용, R/Z 거부 (REQ-AUTH-ROLE-002)
- 미인가 액션은 전이 계산 전 거부, 상태 불변 (REQ-AUTH-ROLE-003)
- role은 세션에서만 도출, 클라이언트 값 불신 (REQ-AUTH-ROLE-004)
- 의존: Milestone 3, SPEC-BACKEND-CORE-001 REQ-ART-AUTH-* / REQ-ART-LC-*

### Milestone 5 (Priority Medium) — 사용자 관리 인가 + 소프트 삭제
- 사용자 입력/수정/삭제는 Z만 허용 (REQ-AUTH-USRMGMT-001/002)
- 사용자 삭제 = 소프트 삭제(비활성화), 물리 DELETE 금지 (REQ-AUTH-USRMGMT-003)
- 비활성 사용자는 로그인 불가, 행은 보존 (REQ-AUTH-USRMGMT-004)
- 의존: Milestone 4; (필요 시) SPEC-DB-FOUNDATION-001 비활성화 컬럼 개정

## 위험 (Risks)

| 위험 | 영향 | 완화 |
|------|------|------|
| 세션 권위와 UI 게이팅의 이중화로 인한 우회 가능성 | 클라이언트가 UI 비활성을 우회해 보호 액션 시도 | 서버가 세션 `role`로 최종 강제(REQ-AUTH-ROLE-004), UI는 보조로만 취급 |
| 사용자 소프트 삭제 컬럼 부재 | SPEC-DB-FOUNDATION-001에 비활성화 컬럼 미정의 | DB SPEC 개정 필요 — 본 SPEC은 동작 계약만, DDL은 DB SPEC에 위임 |
| 기존 REQ-USR-D-001("remove or deactivate") 과의 충돌 | 백엔드 SPEC이 물리 삭제도 허용 | [D-AUTH-3]로 deactivate 확정, HARD 규칙 우선; 향후 backend SPEC 개정 권고 |
| 세션 만료 처리 누락 | 만료 세션으로 보호 자원 접근 | REQ-AUTH-GUARD-003으로 만료 시 재인증 강제 |

## 통합 지점 (Integration Points)

- **SPEC-BACKEND-CORE-001**: 인증 판정·해시 비교(REQ-USR-LOGIN-001), 권한 판정·전이(REQ-ART-AUTH-*, REQ-ART-LC-*), 사용자 CRUD(REQ-USR-*)를 소비. 본 SPEC은 세션 계층으로 이들을 연결.
- **SPEC-FRONTEND-UI-001**: 로그인 폼(REQ-FE-LOGIN-*), 세션 전제 라우팅(REQ-FE-APP-004), 권한별 UI 노출(REQ-FE-VIEW-009/010)의 서버 측 권위를 제공.
- **SPEC-DB-FOUNDATION-001**: User 테이블 `password`/`role` 소비; 사용자 비활성화 컬럼이 필요하면 DB SPEC 개정.

## 권장 전문가 자문 (Recommended Expert Consultation)

- **expert-backend**: 세션 미들웨어 설계, 세션 스토어 선택(메모리/SQLite/Redis), 쿠키 보안 속성(HttpOnly/Secure/SameSite), 인가 미들웨어 배치. 보안 민감 인증 계층이므로 Run 단계 진입 전 자문 권장.
