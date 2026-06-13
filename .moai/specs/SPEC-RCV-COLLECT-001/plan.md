# SPEC-RCV-COLLECT-001 — 구현 계획 (Implementation Plan)

## HISTORY

- 2026-06-13 (v0.2.0): 결정 포인트 6건 확정(2026-06-13) 반영. Milestone 1에 신규 Contents.source 컬럼 자동기사 표시(DP-RCV-1) + 기본 파서 1종(DP-RCV-5) + 작성자/부서 스탬핑(DP-RCV-4, REQ-RCV-REGISTER-005) 명시. Milestone 2 화이트리스트를 전용 수신처 설정 테이블 기준(DP-RCV-3)으로 확정. Milestone 3 관리 권한 Z 전용(DP-RCV-6) + 마이그레이션을 Contents.source 컬럼 + 수신처 설정 테이블 신설로 확정. 리스크 R-1~R-5를 확정으로 해소(R-3 입력 포맷은 기본 파서 1종으로 부분 완화, R-6 dedup은 범위 밖 유지).
- 2026-06-13 (v0.1.0): 최초 작성. 기술 접근·계층 책임·4개 마일스톤(priority-based)·6개 리스크·검증 전략·의존성 정의. 결정 포인트 DP-RCV-1~6 미해결 상태로 표기.

## 기술 접근 (Technical Approach)

기존 NodeJS + MVC 백엔드(`server/index.js` Express 진입) 위에 수집(자동기사) 책임을 추가한다.
수집 비즈니스 로직(수신 디스패치, 화이트리스트 판정, 파싱·정규화, 자동기사 표시, 등록 트랜잭션)은
**Service 계층**에 집중하고, 기사 등록은 SPEC-DB-FOUNDATION-001이 확정한 `Article`/`Contents` 테이블과
SPEC-BACKEND-CORE-001이 구현하는 기사 ID 생성·초기 상태 RDS 계약을 **재사용**한다.

수신은 두 경로다 — (1) FTP event 방식(수신 파일 → 분석), (2) API 호출 응답(응답 데이터 → 분석).
두 경로 모두 **화이트리스트 검사 → 파싱(제목·본문 추출 + 본문 블록 JSON 정규화) → 자동기사 표시 → 트랜잭션 등록**
순서를 공유한다. 입력 포맷은 추상 파서 어댑터로 캡슐화하여 포맷별 구현을 Run 단계로 분리한다([DP-RCV-5]).

> 함수명·파일 경로·클래스 구조·REST 라우트·구체 파서 포맷·FTP 서버 설정 등 구현 세부는 본 계획에서 규정하지 않는다(Run 단계 소관). 본 계획은 마일스톤 순서·기술 접근·리스크만 정의한다.

### 계층 책임 (개념 수준)

| 계층 | 책임 | 비고 |
|------|------|------|
| Controller | FTP event 핸들/스케줄 트리거 수신, `rcvMgmt.do` 요청 수신, Service 호출, 결과 응답 | REST 라우트 구체화는 범위 밖(Run) |
| Service | 수신 디스패치, 화이트리스트 판정, 파서 어댑터 호출, 자동기사 표시(Contents.source='자동기사'), 작성자/부서 스탬핑(피드 우선→시스템 기본), 등록 트랜잭션 오케스트레이션, 수신처 설정 CRUD | 수집 비즈니스 규칙 단일 소스 |
| Model | Article/Contents INSERT(트랜잭션, source 컬럼 포함), 수신처 설정 테이블 read/create/delete, 화이트리스트 조회 | 물리 DELETE는 설정 엔트리에 한정 — 기사 데이터 미삭제 |
| 파서 어댑터 | 입력 포맷 → `{title, bodyBlocks}` 정규화, 본문 → yh-editor 블록 JSON. 추상 인터페이스 + **기본 파서 1종(이번 Run 범위)** | 추가 포맷 파서는 후속 이연([DP-RCV-5] 확정) |

## 마일스톤 (Milestones — priority-based, 시간 추정 없음)

### Milestone 1 (Priority High) — 등록 파이프라인 코어
- 수집 Service/Model 골격을 기존 MVC에 추가 — REQ-RCV-ARCH-001~003
- 파싱·정규화 어댑터 계약 + **기본 파서 1종**(제목·본문 추출, 본문 → 블록 JSON) — REQ-RCV-PARSE-001~005 ([DP-RCV-5] 확정)
- 등록 트랜잭션(Article+Contents, 초기 상태 RDS, 기사 ID 재사용) — REQ-RCV-REGISTER-001~004
- 작성자/부서 스탬핑(피드 우선 → 시스템 기본 author='자동수집') — REQ-RCV-REGISTER-005 ([DP-RCV-4] 확정)
- 자동기사 표시(신규 Contents.source='자동기사' 컬럼) — REQ-RCV-AUTOMARK-001~002 ([DP-RCV-1] 확정)

### Milestone 2 (Priority High) — 수신 경로 + 화이트리스트
- FTP event 수신 → 파이프라인 진입 — REQ-RCV-RECEIVE-001
- API 호출 응답 수신 → 파이프라인 진입 — REQ-RCV-RECEIVE-002
- 수신 전 화이트리스트 게이팅(전용 수신처 설정 테이블 기준) — REQ-RCV-RECEIVE-003, REQ-RCV-WHITELIST-001~002 ([DP-RCV-3] 확정)

### Milestone 3 (Priority Medium) — 관리(rcvMgmt.do) + 마이그레이션
- 수신처 설정 read/create/delete 백엔드 서비스 — REQ-RCV-MGMT-001~003, -006
- 설정 삭제 시 기사 데이터 비삭제 보장 — REQ-RCV-MGMT-004
- 관리 권한 게이트(Z 전용) — REQ-RCV-MGMT-005 ([DP-RCV-6] 확정)
- 멱등 마이그레이션 — 신규 Contents.source 컬럼([DP-RCV-1]) + 수신처 설정 테이블 신설([DP-RCV-3]) — REQ-RCV-MIGRATE-001~002

### Milestone 4 (Priority Medium) — 정합 검증 보강
- 부서별 작성/송고·개인별 수정 조회와 자동기사(작성자='자동수집') 정합 검증(news.md 메뉴 필터 기준)

## 리스크 (Risks)

- **[R-1] '자동기사' 표시 컬럼 — 해소 ([DP-RCV-1] 확정)**: 신규 `Contents.source` 컬럼으로 확정. 사용자 편집 항목 `attribute`와 분리되어 덮어쓰기/혼동 위험이 제거됨. 멱등 ALTER로 additive 추가.
- **[R-2] 화이트리스트 출처 — 해소 ([DP-RCV-3] 확정)**: 전용 수신처 설정 테이블로 확정. rcvMgmt.do 설정 CRUD와 화이트리스트가 같은 테이블을 공유하므로, Milestone 3(테이블 신설)을 Milestone 2(화이트리스트 게이팅) 전 또는 동시에 진행하는 순서 정합에 유의.
- **[R-3] 입력 포맷 — 부분 완화 ([DP-RCV-5] 확정)**: 구체 FTP 파일/API 응답 포맷이 rcv.md에 없다. 이번 Run 범위에 기본 파서 1종(구조화 입력 또는 평문 첫 줄=제목)을 포함하여 최소 동작을 보장하되, 실제 피드 포맷 샘플 확보 전까지 통합 테스트는 모킹에 의존. 추가 포맷 파서는 후속 SPEC.
- **[R-4] 초기 상태 — 해소 ([DP-RCV-2] 확정)**: RDS로 확정. 생애주기 전이표(news.md) 신규 진입점 없이 데스크 미송고 흐름에 자연 편입.
- **[R-5] 관리 권한 — 해소 ([DP-RCV-6] 확정)**: Z 전용으로 확정(R/D 거부). 운영 권한 노출 범위 최소화 — Run 단계에서 권한 게이트 보안 검토(security-coding-leader) 권장.
- **[R-6] 중복 수신 dedup 미정의(범위 밖)**: 동일 원문 재수신 시 중복 기사가 누적될 수 있다. 기사 ID 충돌 재시도와는 별개 문제 — 필요 시 후속 SPEC.

## 검증 전략 (Verification Strategy)

- 화이트리스트: 등록 ID → 수신 진행, 미등록 ID → 수신 거부(Article/Contents 행 미생성)를 단위 테스트로 검증.
- 파싱: 기본 파서 1종으로 제목·본문 추출, 본문이 yh-editor 블록 JSON(`{"format":"yh-editor",...}`)으로 정규화됨을 검증. 제목/본문 추출 실패 시 미등록(부분 행 미생성) 검증. 추상 어댑터 인터페이스 + 기본 파서 1종 존재를 검증([DP-RCV-5] 확정).
- 등록: Article+Contents 동시 INSERT가 트랜잭션이며 실패 시 롤백(부분 행 없음), 초기 status=RDS, 기사 ID 형식(`^AKR\d{8}\d{9}$`) 재사용을 검증. 작성자/부서 스탬핑은 피드 값 우선, 없으면 author='자동수집'·부서 빈 값임을 검증([DP-RCV-4] 확정).
- 자동기사 표시: 모든 자동 등록 기사에 `Contents.source='자동기사'` 표지가 있으며, 표지 없는 자동기사는 등록되지 않음을 검증. attribute 컬럼은 표지에 미사용([DP-RCV-1] 확정).
- 관리: rcvMgmt.do read/create/delete 동작, 설정 삭제가 기사 데이터를 삭제하지 않음, 권한 게이트(Z 전용, R/D 거부)를 검증([DP-RCV-6] 확정).
- 마이그레이션: 신규 테이블/컬럼이 `IF NOT EXISTS`/additive ALTER로만 적용되고 기존 행이 보존됨을 검증(멱등 재실행 안전).

## 의존성·연동 (Dependencies)

- **SPEC-DB-FOUNDATION-001 (승인됨)**: Article/Contents/User 스키마, 기사 ID 생성 계약, 소프트 삭제·멱등 마이그레이션 제약. 본 SPEC의 신규 수신처 테이블/컬럼은 그 멱등 마이그레이션 원칙을 그대로 따른다.
- **SPEC-BACKEND-CORE-001 (승인됨)**: MVC 계층 분리, 기사 ID 생성 구현(REQ-ART-ID-001~004), 초기 상태 RDS(REQ-ART-C-002), Contents.status·트랜잭션. 등록 단계가 이를 재사용.
- **news.md / schema.md**: 생애주기·데스크 미송고 목록·관리 권한 관례·Article.markupVersion 블록 JSON 정합 기준. 자동기사 표지는 신규 `Contents.source` 컬럼으로 추가하며, 사용자 편집 항목 `Contents.attribute`는 표지에 사용하지 않는다.
