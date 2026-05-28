# SPEC-UI-EDITOR-001 — 인수 기준 (Acceptance Criteria)

> Given-When-Then 형식. 모든 기준은 관찰 가능해야 한다 (Vitest 단위/통합 테스트로 검증). 파싱 엣지 케이스는 plan.md §4 **후보 A(빈 줄 블록 분리)** 기본 가정값을 기준으로 기술한다 — 사용자가 다른 후보를 확정하면 해당 케이스를 재조정한다.

## 핵심 시나리오 (Core Scenarios)

### AC-1 — 구조 파싱: 제목/부제목/본문 분리 (빈 줄 경계, 후보 A)

- **Given** 에디터에 다음 내용이 입력됨:
  ```
  연합뉴스 속보 제목입니다
  부제목 첫째 줄
  부제목 둘째 줄

  본문 첫 문단입니다.
  본문 둘째 문단입니다.
  ```
- **When** DTO 조립을 위해 에디터 내용을 파싱하면
- **Then** 파서는 `title = "연합뉴스 속보 제목입니다"`, `subtitle = "부제목 첫째 줄\n부제목 둘째 줄"`, `body = "본문 첫 문단입니다.\n본문 둘째 문단입니다."`를 산출한다 (REQ-EDIT-PARSE-001/002/003).
- **And** 동일 입력으로 다시 파싱해도 동일 결과가 나온다 (순수 함수, REQ-EDIT-PARSE-005).

### AC-2 — 인라인 임베딩: 이미지 검색 결과 삽입 (텍스트 마커 아님)

- **Given** 이미지 탭에서 검색 결과 `{source:'youtube', title:'현장 사진', url:'https://img/...', thumbnailUrl:'https://thumb/...'}`가 표시됨
- **When** 사용자가 그 결과의 "삽입" 버튼을 누르면
- **Then** 에디터 본문에 **시각적 인라인 이미지 요소**(thumbnailUrl/url 사용)가 삽입된다 (REQ-EDIT-EMBED-001/002).
- **And** 기존처럼 `[youtube] https://img/...` 같은 plain 마커 텍스트를 본문 끝에 append하지 **않는다** (REQ-EDIT-EMBED-001 [MODIFY] — 회귀 금지).
- **And** 삽입된 임베드는 연합뉴스 디자인 토큰(`--yh-red`/`--yh-gray-line`/serif·sans)을 따라 본문 텍스트와 시각적으로 구별된다 (REQ-EDIT-EMBED-006).

### AC-3 — 임베드 round-trip 안정성

- **Given** 본문에 이미지 1개와 내부기사 1개가 인라인 임베드된 상태
- **When** `const m = adapter.getMarkup()` 후 `adapter.setMarkup(m)`를 호출하면
- **Then** 동일한 인라인 임베드 2개가 동일 순서로 복원된다 (유실/중복/순서뒤바뀜 없음) (REQ-EDIT-EMBED-005/007).

### AC-4 — 가드: 어댑터 교체가 DTO 조립에 영향 없음 (브라운필드 회귀)

- **Given** placeholder 어댑터를 concrete 리치텍스트 어댑터로 교체한 상태
- **When** `useWriteController`의 `assembleDto()`를 호출하면
- **Then** 반환 DTO의 `markupVersion`은 `adapter.getMarkup()`과 정확히 일치한다 (DP-F1 계약 불변, REQ-EDIT-ADP-001/002).
- **And** `useWriteController`의 송고/보류·`submitAction`·lifecycle 관련 호출 시퀀스는 교체 전과 동일하다 (DP-F5 불변 — 클라이언트가 다음 상태를 계산하지 않음).

## 엣지 케이스 (Edge Cases)

### EC-1 — 제목만 입력

- **Given** 에디터에 단 한 줄 `"제목만 있음"`만 입력됨 (이후 줄/빈 줄 없음)
- **When** 파싱하면
- **Then** `title = "제목만 있음"`, `subtitle = ""`, `body = ""`이며 에러를 던지지 않는다 (REQ-EDIT-PARSE-004).

### EC-2 — 빈 본문 (제목 + 부제목만)

- **Given** 제목 1줄 + 부제목 2줄만 있고 빈 줄 이후 본문이 없음
- **When** 파싱하면
- **Then** `title`·`subtitle`은 채워지고 `body = ""`이다 (REQ-EDIT-PARSE-003).
- **And** 전체가 빈 문자열이면 `title/subtitle/body` 모두 빈 문자열이며 에러 없음.

### EC-3 — 임베딩 다중 삽입

- **Given** 검색 결과 3개(이미지·유튜브·내부기사 각 1개)를 순차 삽입
- **When** 모두 삽입 후 본문을 확인하면
- **Then** 3개의 distinct 인라인 임베드가 삽입 순서대로 본문에 존재한다 (REQ-EDIT-EMBED-007).
- **And** 각 타입이 올바른 인라인 형태(이미지=이미지요소, 유튜브=비디오참조, 내부기사=기사카드)로 렌더된다 (REQ-EDIT-EMBED-002/003/004).

### EC-4 — 모호한 개행 패턴 (후보 A 확정 기준)

> 파싱 규칙은 **후보 A(빈 줄 블록 분리)** 로 확정됨. 아래 두 시나리오의 기대값은 후보 A 기준 고정값이다.

**EC-4a — 빈 줄 없는 케이스 (2~5줄 부제목, 6줄+ 본문)**

- **Given** 입력에 빈 줄이 전혀 없는 6줄 텍스트:
  ```
  제목줄
  줄2
  줄3
  줄4
  줄5
  줄6
  ```
- **When** 파싱하면 (후보 A 규칙 4: 빈 줄 없으면 2~5번째 줄을 부제목, 6번째 줄부터 본문)
- **Then** `title = "제목줄"`, `subtitle = "줄2\n줄3\n줄4\n줄5"`, `body = "줄6"`이다 (REQ-EDIT-PARSE-003).

**EC-4b — 빈 줄 있는 케이스 (첫 빈 줄이 부제목/본문 경계)**

- **Given** 입력이 다음과 같이 첫 빈 줄로 부제목과 본문이 분리됨:
  ```
  제목줄
  부제목1
  부제목2

  본문줄1
  본문줄2
  ```
- **When** 파싱하면 (후보 A 규칙 2~3: 제목 다음 첫 빈 줄 전까지 부제목(최대 4줄), 빈 줄 이후 전체가 본문)
- **Then** `title = "제목줄"`, `subtitle = "부제목1\n부제목2"`, `body = "본문줄1\n본문줄2"`이다 (REQ-EDIT-PARSE-003).
- **And** 입력이 `제목\n\n본문...`처럼 제목 다음 곧바로 빈 줄이면 `subtitle = ""`, `body`는 빈 줄 이후 전체이다 (후보 A의 명시적 경계).
- **And** 부제목 후보 줄이 4줄을 초과해도(빈 줄 전 6줄 등) 부제목은 최대 4줄(2~5번째 줄)로 캡되고, 첫 빈 줄 이후가 본문이다 (REQ-EDIT-PARSE-003 상한).

### EC-5 — 깨진/부분 검색 결과

- **Given** 임베드하려는 검색 결과에 `thumbnailUrl`이 없음(`{source,title,url}`만)
- **When** 삽입하면
- **Then** `url` 기반으로 인라인 임베드를 렌더하고 크래시하지 않는다 (방어적 렌더, plan.md 위험표).

## 품질 게이트 (Quality Gates — TRUST 5)

- **Tested**: 파서 단위테스트(AC-1, EC-1/2/4), 임베드 round-trip(AC-3), 다중 삽입(EC-3), 어댑터-DTO 가드(AC-4) 통과. Vitest 커버리지 기준 충족 (tech.md `development_mode: tdd`).
- **Readable**: 파서는 순수 함수로 명확히 분리, 임베드 타입별 렌더 명명 일관.
- **Unified**: 연합뉴스 디자인 토큰(`yonhap.css`) 일관 사용 (REQ-EDIT-EMBED-006), Vitest/ESLint 포맷 준수.
- **Secured**: 임베드 url/thumbnailUrl 렌더 시 입력 검증(부분 결과 방어 EC-5). 외부 URL은 검색 백엔드(이미 검증)에서 옴.
- **Trackable**: 커밋에 SPEC-UI-EDITOR-001 및 REQ-EDIT-* 참조.

## Definition of Done

- [ ] REQ-EDIT-ADP-001~003, REQ-EDIT-PARSE-001~006, REQ-EDIT-EMBED-001~007 모두 구현·테스트.
- [ ] AC-1~4, EC-1~5 테스트 통과.
- [ ] **DP-F1 어댑터 계약 불변** 가드(AC-4) 녹색 — 어댑터 교체가 상위 화면/DTO 조립에 영향 없음.
- [ ] **DP-F5 lifecycle 비계산 계약** 불변 — 본 SPEC이 송고/보류 로직을 건드리지 않음 확인.
- [ ] plan.md §4 **파싱 규칙(후보 A/B/C) 사용자 확정** 반영 — REQ-EDIT-PARSE-003 및 EC-4 기대값 고정.
- [ ] 검색 백엔드(SPEC-BACKEND-CORE-001) **재구현 없음** — 결과 소비만 확인.
- [ ] 연합뉴스 디자인 토큰 적용된 인라인 임베드(이미지/유튜브/내부기사 3종).
- [ ] markupVersion round-trip 안정.
