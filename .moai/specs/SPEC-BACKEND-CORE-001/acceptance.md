# SPEC-BACKEND-CORE-001 — 인수 기준 (Acceptance Criteria)

## Given-When-Then 시나리오

### AC-1: 기사 입력 — 초기 상태 RDS (REQ-ART-C-001~002)

```
Given  로그인된 사용자가 기사 작성 데이터를 제출한다
When   기사 입력 함수를 호출한다
Then   고유한 articleId가 생성되어 Article/Contents에 영속화된다
And    해당 기사의 Contents.status 값이 RDS로 설정된다
```

### AC-2: 기사 조회 — 필터 조건 (REQ-ART-Q-001~003)

```
Given  다양한 작성자/송고자/작성시간/배부시간을 가진 기사들이 존재한다
When   다음 각 조건으로 조회한다: 배부시간(distributedAt) / 작성시간(createdAt) / articleId / 작성자(author) / 송고자(sender)
Then   각 조건이 독립적으로 동작하여 해당 조건에 일치하는 기사를 반환한다
And    배부시간 조건은 Contents.distributedAt 컬럼 기준으로 필터링한다 (sentAt 아님)
And    여러 조건을 동시에 주면 AND로 결합되어 결과가 좁혀진다
And    KILL 상태(RRK/DDK) 기사도 결과에 포함될 수 있다 (물리 삭제 없음)
```

### AC-3: 기사 수정 — articleId 기준 status 변경 (REQ-ART-U-001~002)

```
Given  articleId "AKR202605270000000001" 기사가 존재한다
When   해당 articleId로 수정 함수를 호출하여 상태값을 변경한다
Then   Contents.status가 변경된다
And    존재하지 않는 articleId로 수정 요청 시 not-found로 거부되고 어떤 행도 변경되지 않는다
```

### AC-4: 기사 삭제 — 소프트 삭제 (REQ-ART-D-001~002)

```
Given  status가 RDS인 기사가 존재한다
When   해당 articleId로 삭제 함수를 호출한다 (요청자 권한 R)
Then   Contents.status가 KILL 상태(R권한=RRK)로 변경된다
And    행이 물리적으로 제거되지 않는다 (행 수 불변)
And    물리 DELETE SQL 문이 실행되지 않는다
```

### AC-5: 로그인 인증 성공 — 해시 비교 (REQ-USR-LOGIN-001, 003)

```
Given  User 테이블에 (userId="reporter1", password=bcrypt("pw"), role="R") 행이 존재한다
       (password 컬럼에는 평문이 아니라 해시가 저장되어 있다)
When   userId="reporter1", password="pw"로 로그인 요청을 보낸다
Then   제출 비밀번호를 저장된 해시와 비교하여 일치하므로 인증에 성공한다
And    인증된 사용자의 신원과 role("R")이 반환된다
And    응답에 password 해시는 포함되지 않는다 (REQ-USR-LOGIN-004)
And    기사 작성/목록 기능이 가용해진다 (페이지 이동은 frontend 소관)
```

### AC-6: 로그인 인증 실패 — 해시 불일치 (REQ-USR-LOGIN-002)

```
Given  User 테이블에 (userId="reporter1", password=bcrypt("pw")) 행이 존재한다
When   존재하지 않는 userId 또는 잘못된 password("wrong")로 로그인 요청을 보낸다
Then   userId 부재 또는 해시 비교 실패로 인증이 거부된다
And    인증된 세션이 생성되지 않는다
```

### AC-7: 사용자 CRUD — 해시 저장 (REQ-USR-C/U/D/Q-001)

```
Given  관리자 권한(Z) 컨텍스트
When   사용자 입력/수정/삭제/조회 함수를 호출한다
Then   입력: role이 R/D/Z 중 하나인 User 행이 생성되고 password 컬럼에 bcrypt(또는 동급) 해시가 저장된다 (평문 미저장)
And    수정: userId 기준으로 필드가 갱신된다
And    조회: 조건(userId 등)에 일치하는 사용자가 반환되며 응답에 password 해시는 포함되지 않는다
And    삭제: userId 기준으로 사용자가 제거/비활성화된다
```

### AC-8: 기사 ID 생성 형식 (REQ-ART-ID-001~002)

```
Given  현재 날짜가 2026-05-27
When   기사 ID 생성 함수를 호출한다
Then   반환된 ID가 정규식 ^AKR20260527[0-9]{9}$ 에 일치한다
And    ID 길이가 정확히 20자이다
And    난수 부분이 항상 9자리로 0 좌측 패딩된다
```

### AC-9: 기사 ID 충돌 재생성 (REQ-ART-ID-003~004)

```
Given  특정 articleId가 이미 Article 테이블에 존재한다
When   ID 생성 함수가 동일한 값을 우연히 생성한다
Then   난수 부분을 재생성하여 충돌하지 않는 새 ID를 반환한다
And    최종 반환된 ID는 Article에 존재하지 않으며 INSERT 전에 유니크 검사를 통과한다
```

### AC-10: 생애주기 전이 — RDS 기준 6개 (REQ-ART-LC-001~007)

```
Given  status가 RDS인 기사
When   다음 (권한, 액션)으로 전이를 수행한다
Then   결과 상태가 아래 표와 일치하고 Contents.status에 반영된다

  | 권한 | 액션      | 다음 상태 |
  | R   | 송고(send) | RDS      |
  | R   | 보류(hold) | RRH      |
  | R   | KILL      | RRK      |
  | D   | 송고(send) | DPS      |
  | D   | 보류(hold) | DDH      |
  | D   | KILL      | DDK      |
```

### AC-11: 미정의 전이 거부 (REQ-ART-LC-008)

```
Given  status가 RRH(또는 DPS 등 비-RDS) 기사, 또는 명시되지 않은 (상태,권한,액션) 조합
When   정의되지 않은 전이를 시도한다 (예: 알 수 없는 액션, 미정의 출발 상태)
Then   전이가 거부된다
And    Contents.status는 변경되지 않는다
```

### AC-12: DPS 편집 권한 — D 권한 전용 (REQ-ART-AUTH-001~003)

```
Given  status가 DPS인 기사
When   role D 사용자가 고침/포털고침(edit/portal-edit) 액션을 시도한다
Then   허용된다
And    role R 또는 Z 사용자가 동일 액션을 시도하면 거부되고 상태는 불변이다
And    일반 편집(비-DPS 상태)은 R/D/Z 모두 허용된다
```

### AC-13: 송고 워크플로우 (REQ-WF-001)

```
Given  로그인된 사용자가 송고(send) 액션으로 기사 DTO를 제출한다
When   서버가 DTO를 수신한다
Then   기사 생애주기 상태머신을 거쳐 결과 상태가 산출된다
And    결과 상태가 DB(Contents.status)에 반영된다
```

### AC-14: 미디어 검색 — YouTube 우선 (REQ-SRCH-M-001, 003)

```
Given  미디어 검색 프록시 서비스가 가용하고 YouTube Data API가 정상 결과를 반환한다
When   프런트엔드가 검색어("뉴스 속보")로 미디어 검색을 요청한다
Then   서비스가 YouTube를 먼저 호출한다
And    정규화된 결과를 반환하며 각 항목은 최소 source="youtube", title, url을 포함한다 (가능 시 thumbnailUrl 포함)
```

### AC-15: 미디어 검색 — Google 폴백 (REQ-SRCH-M-002, 003)

```
Given  YouTube Data API가 오류를 반환하거나 빈 결과(0건)를 반환한다
When   동일 검색어로 미디어 검색을 요청한다
Then   서비스가 동일 검색어로 Google 검색으로 폴백한다
And    Google 결과를 동일한 정규화 형태(source="google", title, url, [thumbnailUrl])로 반환한다
```

### AC-16: 미디어 검색 — 양쪽 실패 처리 (REQ-SRCH-M-004)

```
Given  YouTube와 Google 폴백이 모두 실패한다
When   미디어 검색을 요청한다
Then   빈 정규화 결과 집합과 오류 표시(error indicator)를 반환한다
And    업스트림 원본 오류를 클라이언트에 그대로 전파하지 않는다
```

### AC-17: API 키 비노출 (REQ-SRCH-SEC-001)

```
Given  YouTube/Google API 키가 서버측 환경변수에 보관되어 있다
When   미디어 검색 요청/응답을 검사한다
Then   요청·응답·클라이언트 전달 설정 어디에도 API 키가 포함되지 않는다
And    키는 서버측에서만 사용된다 (CORS 우회·키 은닉 목적)
```

### AC-18: 내부 기사 검색 — 제목·본문 (REQ-SRCH-A-001)

```
Given  Contents에 제목/본문이 다양한 기사들이 존재한다
When   글기사 탭이 검색어로 내부 기사 검색을 요청한다
Then   Contents.title 또는 Contents.content에 검색어가 포함된 기사가 반환된다
And    이는 메타데이터 필터 조회(REQ-ART-Q-*)와 구분되는 전문(제목·본문) 검색이다
```

## 엣지 케이스 (Edge Cases)

- 동일 일자(YYYYMMDD)에 대량 ID 생성 시 충돌 재시도가 무한 루프 없이 종료되는가.
- 존재하지 않는 articleId에 대한 수정/삭제/전이 요청 처리.
- 권한 값이 R/D/Z가 아닌 사용자가 생애주기 액션을 시도할 때의 거부.
- DPS 기사에 대해 R/Z가 고침을 시도할 때 거부되고 상태 불변 확인.
- 배부시간(`distributedAt`)이 아직 설정되지 않은(미배부) 기사를 배부시간 조건으로 조회할 때의 처리(빈 값 제외).
- 로그인 시 동일 userId가 PK 단일성으로 1행만 존재함을 전제(SPEC-DB-FOUNDATION-001 User PK=userId).
- 비밀번호 해시 비교가 타이밍 공격에 안전한 비교 함수(bcrypt.compare 등)를 사용하는가.
- 미디어 검색에서 YouTube가 빈 결과(0건)를 반환할 때 오류가 아니어도 Google 폴백이 트리거되는가.
- 외부 검색 업스트림 응답 지연/타임아웃 시 폴백 또는 오류 표시 처리.
- 내부 기사 검색이 KILL 상태(RRK/DDK) 기사를 결과에 포함할지(임베딩 후보 범위) — Run 단계에서 결정 가능.

## 품질 게이트 (Quality Gates)

- [ ] 모든 EARS 요구사항(REQ-ARCH/ART-*/USR-*/WF-*/SRCH-*)에 대응하는 인수 시나리오가 존재한다
- [ ] 미디어 검색 YouTube→Google 폴백 순서와 정규화 결과 형태가 검증된다
- [ ] 외부 검색 API 키가 요청·응답·클라이언트 설정에 노출되지 않음이 검증된다 (OWASP)
- [ ] 글기사 탭 내부 기사 전문(제목·본문) 검색이 메타데이터 조회와 구분되어 검증된다
- [ ] 생애주기 6개 전이 + 미정의 전이 거부가 테스트로 검증된다
- [ ] 기사 ID 형식이 정규식으로, 충돌 재시도가 테스트로 검증된다
- [ ] 소프트 삭제(물리 DELETE 미발행)가 테스트로 검증된다
- [ ] 로그인 성공/실패 경로가 해시 비교 기준으로 검증된다
- [ ] 비밀번호가 해시로 저장되고 응답에 해시가 노출되지 않음이 검증된다 (OWASP)
- [ ] 배부시간 조회가 `Contents.distributedAt` 컬럼 기준임이 검증된다
- [ ] DPS+D-only 권한 규칙이 검증된다
- [ ] 비즈니스 로직이 Service 계층에 위치하고 SQL이 Model 계층에만 존재함을 확인한다

## Definition of Done

- [ ] AC-1 ~ AC-18 전부 통과
- [ ] SPEC-DB-FOUNDATION-001 스키마/PK/status/ID 계약과 정렬됨을 확인 (`distributedAt` 컬럼은 병행 개정에 의존)
- [x] 결정 포인트 DP-1(배부시간=distributedAt), DP-2(함수 계약만), DP-3(비밀번호 해시), DP-4(news.md 정의 전이만) 사용자 확정 완료 (2026-05-27)
- [x] SPEC-FRONTEND-UI-001 [DP-F3] 외부 검색 프록시 책임 백엔드에 반영 (2026-05-27)
- [ ] 후속 frontend SPEC이 참조할 수 있도록 로그인 인증 계약·조회 필터·권한 규칙·미디어 검색 프록시 계약이 spec.md에 명문화됨
