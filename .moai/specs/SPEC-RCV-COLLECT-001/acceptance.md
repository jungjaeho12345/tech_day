# SPEC-RCV-COLLECT-001 — 인수 기준 (Acceptance Criteria)

## HISTORY

- 2026-06-13 (v0.2.0): 결정 포인트 6건 확정(2026-06-13) 반영. AC-7b(작성자/부서 스탬핑, REQ-RCV-REGISTER-005, DP-RCV-4) + AC-5b(추상 파서 어댑터 + 기본 파서 1종, REQ-RCV-PARSE-005, DP-RCV-5) 신설. AC-8 자동기사 표지를 Contents.source='자동기사' 기준으로 정정(attribute 미사용). AC-9/AC-11 관리 권한을 Z 전용으로 확정(DP-RCV-6). AC-12 마이그레이션을 Contents.source 컬럼 + 수신처 설정 테이블 신설 기준으로 정정(DP-RCV-1/-3). 엣지 케이스·DoD·결정 포인트 요약표를 확정안으로 갱신.
- 2026-06-13 (v0.1.0): 최초 작성. 12개 AC(Given-When-Then) + 엣지 케이스 + 품질 게이트(DoD) + 결정 포인트 요약. 결정 포인트 DP-RCV-1~6 미해결 상태로 표기.

## Given-When-Then 시나리오

### AC-1: FTP event 수신 → 파이프라인 진입 (REQ-RCV-RECEIVE-001, REQ-RCV-RECEIVE-003)

```
Given  화이트리스트에 등록된 송신처 ID로부터 FTP 파일이 도착한다
When   FTP event(수신) 핸들러가 파일을 수신한다
Then   파일이 event 방식으로 ingest되어 분석(파싱) 단계로 전달된다
And    파싱·등록 이전에 송신처 ID가 화이트리스트 검사를 통과한다
```

### AC-2: API 호출 응답 수신 → 파이프라인 진입 (REQ-RCV-RECEIVE-002, REQ-RCV-RECEIVE-003)

```
Given  화이트리스트에 등록된 출처 ID에 대한 외부 API 호출이 구성되어 있다
When   API를 호출하여 응답 데이터를 수신한다
Then   응답 데이터가 ingest되어 분석(파싱) 단계로 전달된다
And    파싱·등록 이전에 출처 ID가 화이트리스트 검사를 통과한다
```

### AC-3: 미등록 ID 수신 거부 (REQ-RCV-WHITELIST-001~002)

```
Given  화이트리스트에 등록되지 않은 ID로부터 데이터(FTP 파일 또는 API 응답)가 도착한다
When   수신 파이프라인이 출처/송신처 ID를 화이트리스트와 대조한다
Then   해당 데이터는 파싱·등록 없이 거부된다
And    그 데이터로부터 어떤 Article/Contents 행도 생성되지 않는다
```

### AC-4: 제목·본문 추출 (REQ-RCV-PARSE-001~002)

```
Given  화이트리스트를 통과한 수신 데이터(FTP 파일 또는 API 응답)가 있다
When   분석(파싱) 함수가 데이터를 분석한다
Then   기사 제목과 본문 내용이 추출된다
And    FTP 경로와 API 경로 모두 동일한 {title, body} 추출 결과를 산출한다
```

### AC-5: 본문 → yh-editor 블록 JSON 정규화 (REQ-RCV-PARSE-003) [DP-RCV-5 확정]

```
Given  추출된 본문 텍스트가 있다
When   파서 어댑터가 본문을 정규화한다
Then   본문이 Article.markupVersion의 블록 JSON 형태({"format":"yh-editor","version":1,"blocks":[...]})로 변환된다
And    평문 본문은 최소 1개 이상의 텍스트 블록으로 감싸여 에디터 작성 기사와 동일한 구조로 저장 가능해진다
```

### AC-5b: 추상 파서 어댑터 + 기본 파서 1종 (REQ-RCV-PARSE-005) [DP-RCV-5 확정]

```
Given  수신 입력에서 제목/본문을 추출하는 파서가 어댑터 인터페이스(in: 입력 → out: {title, bodyBlocks})로 정의되어 있다
When   이번 Run 범위에 포함된 기본 파서 1종에 수신 입력을 전달한다
       (예: 제목/본문 키를 갖는 구조화 입력, 또는 평문 첫 줄=제목·이후=본문)
Then   기본 파서가 {title, bodyBlocks} 결과를 산출한다
And    추가 포맷 파서는 후속 SPEC으로 이연되며 이번 범위에는 최소 1개 구체 파서만 요구된다
```

### AC-6: 제목/본문 추출 실패 시 미등록 (REQ-RCV-PARSE-004)

```
Given  수신 데이터에서 제목 또는 본문 내용을 추출할 수 없다
When   분석(파싱) 단계가 추출을 시도한다
Then   해당 항목은 거부/스킵되어 등록되지 않는다
And    부분적으로 형성된(제목만 또는 본문만) 또는 손상된 기사가 영속화되지 않는다
```

### AC-7: 등록 — 트랜잭션 + 초기 상태 RDS + 기사 ID 재사용 (REQ-RCV-REGISTER-001~004, REQ-RCV-ARCH-003) [DP-RCV-2 확정]

```
Given  파싱된 데이터(제목 + 정규화된 본문 블록 JSON)가 준비되어 있다
When   등록 함수가 호출된다
Then   AKR+YYYYMMDD+난수 9자리 규칙(중복 시 재생성)으로 articleId가 생성된다 (형식 ^AKR\d{8}\d{9}$)
And    Article(제목 + markupVersion 블록 JSON)과 Contents(제목 + 공통정보)가 동일 articleId로 영속화된다
And    Article·Contents 입력이 단일 트랜잭션으로 처리된다
And    Contents.status 초기값이 RDS로 설정된다 ([DP-RCV-2] 확정: 데스크 미송고 검수 진입)
And    트랜잭션이 완료되지 못하면 롤백되어 부분 Article/Contents 행이 남지 않는다
```

### AC-7b: 작성자·부서 스탬핑 — 피드 우선 → 시스템 기본 (REQ-RCV-REGISTER-005) [DP-RCV-4 확정]

```
Given  파싱된 자동기사 데이터가 등록 직전이다
When   등록 함수가 작성자·부서를 스탬프한다
Then   수신 피드에 작성자/부서 값이 있으면 그 값이 Contents.author/department/departmentCode에 기록된다
And    피드에 작성자/부서 값이 없으면 시스템 기본값(author='자동수집', department/departmentCode 빈 값 또는 시스템 기본)으로 스탬프된다
```

### AC-8: 자동기사 표시 — 표지 필수 (REQ-RCV-AUTOMARK-001~002) [DP-RCV-1 확정]

```
Given  수집 파이프라인을 통해 기사가 등록된다
When   등록이 완료된다
Then   해당 기사는 신규 Contents.source 컬럼에 '자동기사' 표지를 갖는다 (Contents.source='자동기사')
And    사용자 편집 항목인 Contents.attribute는 표지에 사용되지 않는다 (덮어쓰기·혼선 회피)
And    Contents.source='자동기사' 표지가 없는 자동기사는 영속화되지 않는다 (표지는 필수)
```

### AC-9: rcvMgmt.do 설정 조회/생성/삭제 (REQ-RCV-MGMT-001~003, -006) [DP-RCV-6 확정]

```
Given  관리 권한 Z(관리자)를 가진 사용자가 rcvMgmt.do에 접근한다 ([DP-RCV-6] 확정: Z 전용)
When   설정 조회(read) / 생성(create) / 삭제(delete) 요청을 보낸다
Then   조회: API 설정·FTP 송신 설정·수신(화이트리스트) 설정 엔트리가 반환된다
And    생성: 새 수신처 설정 엔트리가 전용 수신처 설정 테이블에 영속화된다
And    삭제: 지정한 설정 엔트리가 제거된다
And    이 동작들은 백엔드 설정 CRUD 서비스로 처리된다 (UI 렌더링은 frontend/Run 소관)
```

### AC-10: 설정 삭제가 기사 데이터를 삭제하지 않음 (REQ-RCV-MGMT-004)

```
Given  수신처 설정 엔트리와, 그 출처로 이미 수집된 자동기사들이 DB에 존재한다
When   해당 수신처 설정 엔트리를 삭제한다
Then   설정 엔트리만 제거된다
And    이미 수집된 Article/Contents 기사는 하나도 삭제·변경되지 않는다 (DB 삭제 금지 규칙 정합)
```

### AC-11: 관리 권한 게이트 — Z 전용 (REQ-RCV-MGMT-005) [DP-RCV-6 확정]

```
Given  권한 R(기자) 또는 D(데스크) 사용자가 rcvMgmt.do에 접근한다
When   설정 조회/생성/삭제를 시도한다
Then   해당 동작이 거부된다
And    권한 Z(관리자)만 수신처/API/FTP 설정을 조회·생성·삭제할 수 있다 ([DP-RCV-6] 확정: Z 전용)
```

### AC-12: 멱등 마이그레이션 — 기존 데이터 보존 (REQ-RCV-MIGRATE-001~002) [DP-RCV-1, DP-RCV-3 확정]

```
Given  수집 시스템이 신규 Contents.source 컬럼([DP-RCV-1])과 전용 수신처 설정 테이블([DP-RCV-3])을 필요로 한다
When   서버 기동 시 스키마 마이그레이션이 적용된다
Then   Contents.source 컬럼은 컬럼 존재 확인 후 ALTER TABLE Contents ADD COLUMN source 로만 추가된다
And    수신처 설정 테이블은 CREATE TABLE IF NOT EXISTS 로만 신설된다
And    기존 테이블·컬럼·행이 하나도 drop/recreate/delete 되지 않는다 (DB 삭제 금지 규칙 정합)
And    마이그레이션을 재실행해도 안전하다 (멱등)
```

## 엣지 케이스 (Edge Cases)

- **빈 본문 / 빈 제목**: 둘 중 하나라도 추출 불가 시 등록하지 않음 (AC-6).
- **기사 ID 충돌**: 생성된 articleId가 기존 Article.articleId와 충돌하면 난수 부분을 재생성(SPEC-BACKEND-CORE-001 REQ-ART-ID-004 재사용) — 충돌이 반복돼도 유니크 ID 확보까지 재시도.
- **트랜잭션 중 장애**: Article만 또는 Contents만 들어간 상태로 남지 않음 — 전부 롤백 (AC-7).
- **'자동기사' 표지 컬럼 분리([DP-RCV-1] 확정: source 컬럼)**: 표지를 사용자 편집 항목 attribute가 아닌 전용 Contents.source 컬럼에 저장하므로 작성 페이지 편집으로 덮어쓰일 위험이 없다 — 옵션 B 선택으로 해소됨.
- **같은 원문 재수신(중복)**: 본 SPEC 범위 밖 — 중복 기사가 누적될 수 있음(향후 dedup SPEC 필요). 기사 ID 충돌 재시도와는 별개.
- **부서/작성자 정보 부재([DP-RCV-4] 확정)**: 피드에 작성자/부서가 없으면 시스템 기본값(author='자동수집', 부서/부서코드 빈 값)으로 스탬프(AC-7b) — 부서별 조회 메뉴에서 시스템 기본 작성자로 묶인다.
- **알 수 없는/미규정 입력 포맷([DP-RCV-5] 확정)**: 이번 Run 범위의 기본 파서 1종이 처리하지 못하는 포맷은 파싱 실패로 간주(AC-6 경로) — 부분 등록 금지. 추가 포맷 파서는 후속 SPEC.

## 품질 게이트 (Quality Gate / Definition of Done)

- [ ] REQ-RCV-RECEIVE / WHITELIST / PARSE(005 기본 파서 포함) / REGISTER(005 스탬핑 포함) / AUTOMARK / MGMT / MIGRATE 각 REQ에 대응 테스트 존재 및 통과
- [ ] 미등록 ID 수신 거부 + 등록 트랜잭션 롤백 + 물리 삭제 금지(설정 삭제가 기사 미삭제) 테스트 통과
- [ ] 본문이 yh-editor 블록 JSON으로 정규화되어 Article.markupVersion에 저장됨을 검증
- [ ] 모든 자동기사에 Contents.source='자동기사' 표지 존재([DP-RCV-1] 확정), attribute는 표지에 미사용
- [ ] 추상 파서 어댑터 + 기본 파서 1종 동작([DP-RCV-5] 확정), 작성자/부서 피드 우선→시스템 기본 스탬핑([DP-RCV-4] 확정) 검증
- [ ] rcvMgmt.do 관리 권한 Z 전용 게이트([DP-RCV-6] 확정) 검증
- [ ] 멱등 마이그레이션(Contents.source 컬럼 + 수신처 설정 테이블, 재실행 안전, 기존 데이터 보존) 검증
- [x] 결정 포인트 DP-RCV-1~6 사용자 확정 완료(2026-06-13), status: draft → approved 전환 완료
- [ ] TRUST 5 게이트 통과 (Tested / Readable / Unified / Secured / Trackable)

## 결정 포인트 요약 (Decision Points — 확정, 사용자 승인 2026-06-13)

| ID | 주제 | 확정안 | 영향 REQ |
|----|------|--------|----------|
| DP-RCV-1 | '자동기사' 표시 컬럼 | **B) 신규 Contents.source 컬럼**(멱등 ALTER, source='자동기사'). attribute 미사용(충돌·혼선 회피) | REQ-RCV-AUTOMARK-001~002, REQ-RCV-MIGRATE-001 |
| DP-RCV-2 | 자동 등록 초기 상태 | **RDS** (데스크 미송고 검수 진입) | REQ-RCV-REGISTER-003 |
| DP-RCV-3 | 수신 ID 화이트리스트 출처 | **전용 수신처 설정 테이블**(신규, rcvMgmt.do CRUD, User 테이블 아님) | REQ-RCV-WHITELIST-001~002, REQ-RCV-MGMT-*, REQ-RCV-MIGRATE-001 |
| DP-RCV-4 | 자동기사 작성자/부서 스탬핑 | **피드 우선 → 없으면 시스템 기본**(author='자동수집', 부서/부서코드 빈 값) | REQ-RCV-REGISTER-005 |
| DP-RCV-5 | 수신 입력 포맷/파서 | **추상 파서 어댑터 + 기본 파서 1종**(이번 Run 범위, 추가 포맷 이연) | REQ-RCV-PARSE-001~005 |
| DP-RCV-6 | rcvMgmt.do 관리 권한 | **Z 전용**(R/D 거부, 사용자 관리 Z-only 관례 정합) | REQ-RCV-MGMT-005 |
