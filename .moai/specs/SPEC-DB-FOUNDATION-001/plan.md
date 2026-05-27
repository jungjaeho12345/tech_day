# SPEC-DB-FOUNDATION-001 — 구현 계획 (Plan)

## 기술 접근 (Technical Approach)

- **DB**: SQLite 단일 파일. 스키마는 `CREATE TABLE IF NOT EXISTS` DDL로 정의(REQ-SCH-010).
- **타입**: 모든 컬럼 VARCHAR. SQLite는 동적 타입이므로 affinity 상 TEXT와 동일하게 동작하나, DDL 가독성을 위해 `VARCHAR`로 선언.
- **인코딩**: SQLite는 기본 UTF-8 저장 → 별도 PRAGMA 불필요하나 연결 시 인코딩 검증.
- **기사 ID 생성**: SQLite native SP 부재 → **NodeJS 애플리케이션 함수**로 구현(결정 D1). 함수 시그니처/배치는 backend SPEC에서 확정하되, 본 SPEC은 알고리즘과 유니크 제약(PK)으로 보장한다.

## 마일스톤 (우선순위 기반, 시간 추정 없음)

### Priority High — 핵심 스키마

- M1: 3개 테이블 DDL 정의 (Article, Contents, User) — REQ-SCH-001~008
- M2: `status` 컬럼 추가 및 생애주기 상태값 저장 가능 확인 — REQ-SCH-009
- M3: UTF-8 저장 검증 — REQ-SCH-002

### Priority High — 무결성 제약

- M4: PK 제약 적용 (Contents.articleId 확정 / Article 복합PK·User PK는 가정 확인 후) — REQ-SCH-006~008
- M5: 소프트 삭제 보장 — 물리 DELETE 금지를 스키마/규약으로 명문화 — REQ-DEL-001~003

### Priority Medium — ID 생성

- M6: 기사 ID 생성 알고리즘(`AKR`+YYYYMMDD+9난수) 및 충돌 재생성 — REQ-ID-001~005

### Priority Low — 검증 자산

- M7: 스키마 생성 idempotency 테스트 — REQ-SCH-010

## 기술적 리스크 (Risks)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| Article/Contents 필드 중복(가정 A5)으로 데이터 불일치 | 중 | backend SPEC에서 두 테이블 동기화 책임 확정 전까지 정규화 보류, 단일 쓰기 경로 권고 |
| 9난수 충돌 확률(YYYYMMDD 동일 일자 내) | 저 | 10^9 공간 → 일일 생성량 대비 충분. PK 유니크 + 재생성(REQ-ID-004)로 보장 |
| SP 미지원 → 구현 위치 모호 | 중 | 결정 D1로 애플리케이션 함수 채택 명시. backend SPEC가 함수 위치 확정 |
| status 컬럼 배치(Article vs Contents) 가정 A4 | 중 | 사용자/오케스트레이터 확인 필요. 확정 후 단순 컬럼 이동으로 대응 가능 |

## 후속 SPEC 의존성

- backend SPEC은 본 SPEC의 스키마/PK/status 컬럼/ID 생성 함수에 의존한다.
- 본 SPEC의 가정(A1/A2/A4/A5, D1/D2)이 확정되어야 backend 함수 설계가 시작될 수 있다.
