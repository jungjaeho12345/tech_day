# SPEC-BACKEND-CORE-001 — 구현 계획 (Implementation Plan)

## 기술 접근 (Technical Approach)

NodeJS + MVC 패턴. 비즈니스 로직(생애주기 전이, 권한 인가, 기사 ID 생성)은 Service 계층에 집중하고,
Controller는 요청 수신/응답 변환만, Model은 SQLite 데이터 접근만 담당한다. DB 스키마는
SPEC-DB-FOUNDATION-001이 확정한 Article/Contents/User 테이블을 그대로 사용한다.

> 함수명·파일 경로·클래스 구조 등 구현 세부는 본 계획에서 규정하지 않는다(Run 단계 소관). 본 계획은 마일스톤 순서와 기술 접근, 리스크만 정의한다.

### 계층 책임 (개념 수준)

| 계층 | 책임 | 비고 |
|------|------|------|
| Controller | 클라이언트 요청 수신, DTO 파싱, Service 호출, 결과 응답 | REST 라우트 구체화는 [DP-2] 기본값에 따라 범위 밖 |
| Service | 생애주기 상태머신, 권한 인가(R/D/Z), 기사 ID 생성·유니크 재시도, 로그인 자격증명 판정 | 비즈니스 규칙 단일 소스 |
| Model | Article/Contents/User SQL 접근 (조회 필터, status UPDATE, INSERT, 유니크 검사) | 물리 DELETE 미발행 |

## 마일스톤 (Milestones — priority-based, 시간 추정 없음)

### Milestone 1 (Priority High) — 기반 함수 + 인증
- MVC 계층 골격(Controller/Service/Model) 구성 — REQ-ARCH-001~003
- 사용자 CRUD 함수 — REQ-USR-C/U/D/Q-001
- 로그인 인증 계약(userId+password 일치 판정, role 반환) — REQ-USR-LOGIN-001~003
- 기사 ID 생성 함수(형식·제로패딩·유니크 검사·충돌 재시도) — REQ-ART-ID-001~004

### Milestone 2 (Priority High) — 기사 CRUD
- 기사 입력(초기 상태 RDS, Article+Contents 영속화) — REQ-ART-C-001~002
- 기사 조회 함수 + 필터 조건(배부시간=distributedAt/작성시간/articleId/작성자/송고자, AND 결합) — REQ-ART-Q-001~003
- 기사 수정(articleId 기준 status 변경) — REQ-ART-U-001~002
- 기사 삭제(소프트 삭제 = KILL 상태, 물리 DELETE 금지) — REQ-ART-D-001~002

### Milestone 3 (Priority High) — 생애주기 상태머신 + 권한
- RDS 기준 6개 전이(R/D × 송고/보류/KILL) — REQ-ART-LC-001~007
- 미정의 전이 거부 — REQ-ART-LC-008
- 권한 인가: R/D/Z 편집 허용, DPS+D-only 고침/포털고침, 미인가 액션 거부 — REQ-ART-AUTH-001~003
- 송고 워크플로우(클라이언트 DTO → 상태머신 → DB) — REQ-WF-001~002

### Milestone 4 (Priority Medium) — 보안·연동 보강
- 비밀번호 해싱(bcrypt 또는 동급) 적용 및 응답 해시 비노출 검증 — REQ-USR-C-001, REQ-USR-LOGIN-001/004 [DP-3 확정]
- 배부시간 조회는 `distributedAt` 컬럼 기준 — DB 병행 개정(`distributedAt` 추가) 완료 후 통합 [DP-1 확정]

### Milestone 5 (Priority Medium) — 외부/내부 검색 (SPEC-FRONTEND-UI-001 [DP-F3])
- 미디어 검색 프록시 서비스(YouTube 우선 → 실패/빈결과 시 Google 폴백 → 정규화 결과) — REQ-SRCH-M-001~004
- 외부 검색 API 키 서버측(환경변수) 보관·비노출 — REQ-SRCH-SEC-001
- 글기사 탭 내부 기사 전문(제목·본문) 검색 — REQ-SRCH-A-001

## 리스크 (Risks)

- **[R-1] `distributedAt` 컬럼 의존 ([DP-1] 확정)**: 배부시간 조회는 SPEC-DB-FOUNDATION-001에 신규 추가되는 `distributedAt` 컬럼에 의존한다. DB SPEC 개정이 병행 진행 중이므로, 해당 컬럼이 스키마에 반영되기 전에는 배부시간 조회 통합 테스트가 차단될 수 있다. → DB SPEC 개정 머지 순서 조정 필요.
- **[R-2] API 범위 이연 ([DP-2] 확정)**: 본 SPEC은 함수 계약만 정의(REST 라우트는 Run 단계). 프런트엔드 연동 시 엔드포인트 합의가 별도로 필요.
- **[R-3] 비-RDS 전이 미명세 ([DP-4] 확정)**: news.md 정의 전이(RDS 6개 + DPS+D 편집)만 허용, 그 외 거부. 실제 편집 워크플로우(예: DPS 기사 고침 후 재송고)가 등장하면 news.md 갱신 후 전이표 확장이 필요.
- **[R-4] 해싱 파라미터 ([DP-3] 확정)**: 해시 저장·비교는 확정. cost factor 등 세부 튜닝은 Run 단계에서 결정.
- **[R-5] 외부 검색 API 의존 (SPEC-FRONTEND-UI-001 [DP-F3])**: YouTube/Google API는 쿼터·비용·가용성·응답 형식 변경 리스크가 있다. 폴백(REQ-SRCH-M-002)과 양쪽 실패 처리(REQ-SRCH-M-004)로 완화하나, 키 발급·쿼터 한도·캐싱은 Run 단계에서 결정 필요. 테스트는 업스트림 모킹으로 수행.

## 검증 전략 (Verification Strategy)

- 각 생애주기 전이(6개)와 미정의 전이 거부를 단위 테스트로 검증.
- 기사 ID 형식은 정규식(`^AKR\d{8}\d{9}$`)으로, 충돌 재시도는 모킹된 충돌 시나리오로 검증.
- 로그인 성공/실패(해시 비교), 비밀번호 해시 저장·응답 비노출, 소프트 삭제(물리 DELETE 미발행)를 테스트로 검증.
- 미디어 검색은 업스트림(YouTube/Google) 모킹으로 폴백 순서·정규화 형태·키 비노출·양쪽 실패 처리를 검증. 내부 기사 검색은 제목·본문 매칭으로 검증.
- TRUST 5 품질 게이트 적용(Run 단계).
