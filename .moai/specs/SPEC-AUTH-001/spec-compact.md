# SPEC-AUTH-001 (Compact) — 인증 · 세션 · 인가 계층

- **id**: SPEC-AUTH-001 | **status**: draft | **priority**: high | **created/updated**: 2026-05-27 | **author**: MoAI
- **소유 범위**: ① 로그인 인증 동작 ② 서버 측 세션 + 세션 쿠키(JWT 아님) ③ 세션 검증/보호 ④ R/D/Z 인가 체크 계층 ⑤ 사용자 관리 인가 + 소프트 삭제
- **비소유(참조)**: 기사 생애주기 전이 계산(BACKEND), 해시 알고리즘(BACKEND), 로그인 폼 UI(FRONTEND), User 테이블 DDL(DB)

## 확정 결정
- [D-AUTH-1] 세션 = 서버 측 세션 + 세션 쿠키, JWT 미사용
- [D-AUTH-2] 인가 권위 = 서버(세션 role), UI 게이팅은 보조
- [D-AUTH-3] 사용자 삭제 = 소프트 삭제(비활성화), 물리 DELETE 금지
- [D-AUTH-4] 권한 체크 계층만 소유, 전이 계산은 BACKEND

## REQ 요약 (EARS)
| 모듈 | REQ | 유형 | 요지 |
|------|-----|------|------|
| ① 인증 | REQ-AUTH-LOGIN-001 | Event | userId+password를 User 테이블과 대조 |
| | REQ-AUTH-LOGIN-002 | Event | 성공 시 세션 수립 + 성공 신호 |
| | REQ-AUTH-LOGIN-003 | Unwanted | 실패 시 세션 미수립 + 사유 반환(ALERT) |
| | REQ-AUTH-LOGIN-004 | Unwanted | 응답에 비밀번호 해시 미포함 |
| ② 세션 | REQ-AUTH-SESS-001 | Event | 성공 시 서버 세션 생성 + 쿠키 발급 |
| | REQ-AUTH-SESS-002 | Ubiquitous | 서버 세션(JWT 아님), 쿠키엔 불투명 식별자만 |
| | REQ-AUTH-SESS-003 | Ubiquitous | 세션에 userId/name/role/department/departmentCode 보관 |
| | REQ-AUTH-SESS-004 | Event | 로그아웃 시 세션 무효화 + 쿠키 만료 |
| ③ 보호 | REQ-AUTH-GUARD-001 | Event | 보호 자원 접근 시 세션 검증 |
| | REQ-AUTH-GUARD-002 | Unwanted | 쿠키 없음/무효 시 미인증 거부 |
| | REQ-AUTH-GUARD-003 | Unwanted | 만료 세션 → 재인증 요구 |
| ④ 인가 | REQ-AUTH-ROLE-001 | State | 기사 편집 = R/D/Z 허용 |
| | REQ-AUTH-ROLE-002 | State | DPS 고침/포털고침 = D만, R/Z 거부 |
| | REQ-AUTH-ROLE-003 | Unwanted | 미인가 액션은 전이 계산 전 거부, 상태 불변 |
| | REQ-AUTH-ROLE-004 | Ubiquitous | role은 세션에서만 도출, 클라이언트 값 불신 |
| ⑤ 사용자관리 | REQ-AUTH-USRMGMT-001 | State | 사용자 입력/수정/삭제 = Z만 허용 |
| | REQ-AUTH-USRMGMT-002 | Unwanted | R/D의 사용자 관리 시도 거부 |
| | REQ-AUTH-USRMGMT-003 | Event | 사용자 삭제 = 소프트 삭제, 물리 DELETE 금지 |
| | REQ-AUTH-USRMGMT-004 | Ubiquitous | 비활성 사용자 로그인 불가, 행 보존 |

## [DELTA] 기존 SPEC 관계
- SPEC-BACKEND-CORE-001: REQ-USR-LOGIN-* 세션 미정의분 보강, REQ-ART-AUTH-* 권한 판정을 세션 role로 연결
- SPEC-FRONTEND-UI-001: REQ-FE-APP-004 세션 전제의 서버 권위 제공
- SPEC-DB-FOUNDATION-001: User `password`/`role` 소비, 소프트 삭제 위해 비활성화 컬럼 개정 가능

## Exclusions
수집/배부 시스템 인증, JWT/토큰, MFA/SSO/소셜 로그인, 생애주기 전이 계산, 해시 알고리즘, DB DDL, 로그인 UI, 세션 스토어/쿠키 속성 구체값, REST 엔드포인트, rate limiting/CSRF

## 핵심 인수 시나리오
1. 로그인 성공 → 세션 수립 + 쿠키, 기사 작성 페이지 이동
2. 로그인 실패 → 세션 미수립 + 사유 ALERT
3. DPS 기사 고침을 R/Z 세션이 시도 → 거부(상태 불변), D는 허용
4. Z 세션의 사용자 삭제 → 소프트 삭제(행 보존), 비활성 사용자 로그인 불가
- 엣지: 만료 세션 재인증(EC-1), role 위조 무시(EC-2), 쿠키 없는 요청 거부(EC-3), 로그아웃 후 재사용 거부(EC-4)
