# SPEC-DB-FOUNDATION-001 — 인수 기준 (Acceptance Criteria)

## Given-When-Then 시나리오

### AC-1: 스키마 생성 (REQ-SCH-001~009)

```
Given  비어 있는 SQLite 데이터베이스 파일
When   스키마 생성 DDL을 실행한다
Then   Article, Contents, User 3개 테이블이 생성된다
And    Article은 (articleId, title, content, markupVersion, modifier) 컬럼을 가진다
And    Contents는 (articleId, title, content, author, modifier, sender, department,
       departmentCode, createdAt, editedAt, sentAt, distributedAt, embargoAt, secondEmbargoAt, status) 컬럼을 가진다
And    Contents에 distributedAt(배부시간, VARCHAR) 컬럼이 존재한다
And    User는 (userId, name, password, role, department, departmentCode) 컬럼을 가진다
And    모든 컬럼 타입이 VARCHAR로 선언된다
And    Article.articleId가 단일 컬럼 PRIMARY KEY이다 (복합 PK 아님)
And    Contents.articleId가 PRIMARY KEY이다
And    User.userId가 PRIMARY KEY이다
And    status 컬럼은 Contents 테이블에 위치한다
```

### AC-2: 스키마 생성 멱등성 (REQ-SCH-010)

```
Given  3개 테이블이 이미 존재하고 데이터가 들어 있는 DB
When   스키마 생성 DDL을 재실행한다
Then   오류 없이 완료된다
And    기존 데이터는 모두 보존된다 (행 손실 없음)
```

### AC-3: UTF-8 저장 (REQ-SCH-002)

```
Given  생성된 Contents 테이블
When   한글 제목("속보: 기사 제작 시스템")을 가진 행을 삽입하고 다시 조회한다
Then   삽입한 한글 문자열이 깨지지 않고 동일하게 반환된다
```

### AC-4: 기사 ID 생성 형식 (REQ-ID-001, 002, 005)

```
Given  현재 날짜가 2026-05-27
When   기사 ID 생성 함수를 호출한다
Then   반환된 ID가 정규식 ^AKR20260527[0-9]{9}$ 에 일치한다
And    ID 길이가 정확히 20자이다
And    난수 부분이 9자리 미만일 때 0으로 좌측 패딩되어 항상 9자리이다
```

### AC-5: 기사 ID 충돌 재생성 (REQ-ID-004)

```
Given  특정 articleId 값이 이미 Article 테이블에 존재한다
When   ID 생성 함수가 동일한 값을 우연히 생성한다
Then   난수 부분을 재생성하여 기존과 충돌하지 않는 새 ID를 반환한다
And    최종 반환된 ID는 Article에 존재하지 않는다
```

### AC-6: 소프트 삭제 — 물리 삭제 금지 (REQ-DEL-001~003)

```
Given  status가 RDS인 기사 행이 Contents에 존재한다
When   해당 기사에 대한 삭제가 요청된다
Then   행은 물리적으로 제거되지 않는다 (행 수 불변)
And    삭제는 Contents.status 값을 KILL 상태(RRK/DDK)로 변경하여 표현된다
And    별도 deleted 플래그 컬럼은 존재하지 않는다
And    물리 DELETE SQL 문이 실행되지 않는다
```

### AC-7: 생애주기 상태값 저장 (REQ-SCH-009)

```
Given  생성된 Contents 테이블의 status 컬럼
When   RDS, DPS, RRH, DDH, RRK, DDK 각 값을 저장한다
Then   6개 상태값 모두 손실/변형 없이 저장되고 조회된다
(주: 상태 전이 규칙 검증은 backend SPEC 소관 — 본 SPEC은 저장 가능 여부만 검증)
```

## 엣지 케이스 (Edge Cases)

- 동일 일자(YYYYMMDD)에 대량의 기사 ID 생성 시 충돌 재생성이 정상 동작하는가.
- 동일 articleId로 Article에 INSERT 재시도 시 단일 PK 제약 위반이 발생하는가 (덮어쓰기는 UPDATE/UPSERT 경로로만 — backend SPEC 소관).
- markupVersion이 빈 문자열이어도 Article 단일 PK(articleId)는 유효한가.
- User.userId 중복 삽입 시 PK 제약 위반이 발생하는가.

## 품질 게이트 (Quality Gates)

- [ ] 3개 테이블 DDL이 VO 필드명과 1:1 일치한다
- [ ] 모든 EARS 요구사항(REQ-SCH-*, REQ-ID-*, REQ-DEL-*)에 대응하는 인수 시나리오가 존재한다
- [ ] 물리 DELETE 부재가 테스트로 검증된다
- [ ] 기사 ID 형식이 정규식으로 검증된다

## Definition of Done

- [ ] AC-1 ~ AC-7 전부 통과
- [x] 결정 A1/A2/A4/A5, D1/D2 사용자 확인 완료 (2026-05-27)
- [ ] 스키마 멱등 재생성으로 기존 데이터가 보존됨을 확인
- [ ] 후속 backend SPEC이 참조할 수 있도록 스키마/PK/status/ID 함수 계약이 spec.md에 명문화됨
