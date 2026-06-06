# SPEC-FRONTEND-UI-001 — 구현 계획 (Implementation Plan)

> 본 계획은 WHAT/WHY를 구현으로 옮기기 위한 마일스톤·기술 접근·위험을 정의한다. 구체 컴포넌트명/파일 구조는 Run 단계 소관이다.

> [v0.5.0 개정 — 2026-06-06 사용자 요청] (1) 조회 4개 메뉴 공통 목록에 기사상태(status) 컬럼 추가 —
> 7컬럼 → 8컬럼(기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN), 상태값은
> RDS/DPS/RRH/RRK/DDH/DDK 원시 값 표시, (2) 개인별 수정 author 필터를 저장 값과 동일한 표시 이름
> (user.name) 기준으로 정정 — 종전 userId 매칭은 항상 0건, (3) 기사 생성 시 서버가 세션 사용자의
> department/departmentCode를 스탬프 + 레거시 행 비파괴 백필(작성자 이름→User.department) —
> 부서별 작성/송고 조회 매칭 복구, (4) 편집 진입 로드 복구 — articleModel.query에 Article LEFT JOIN
> (markupVersion 포함) + Contents에 공통정보 8컬럼 영속화(coAuthor/region/attribute/keyword/
> internalComment/externalComment/attachmentFile/referenceFile) + secondEmbargoAt 매핑, (5) 송고/보류/
> KILL action 라우트에도 락 게이트 적용(AC-EDIT-LOCK-6) — 타 보유자 live 락 중 lock-required 거부,
> 편집 컨텍스트 applyAction에 페이지 락 sessionId 동반.
>
> [v0.4.0 개정 — 2026-06-06 사용자 요청] (1) 조회 4개 메뉴 전부 기사 목록을 데스크 미송고와 동일한
> 7컬럼(기사아이디/제목/작성자/수정자/작성시간/수정시간/LockYN)으로 통일 — 상태 배지·인라인 액션
> 버튼 제거, (2) 부서별 작성 = 부서 Select(분리된 데이터-소스 인터페이스 재사용, 초기값 로그인
> 사용자 부서 + 자동 조회) + 조회 버튼 재조회, 필터는 `{ department, statusNot: 'DPS,RRH' }` —
> 백엔드 articleModel.query에 statusNot(NOT IN) 필터 신설 및 누락돼 있던 department 동등 필터 추가,
> (3) 개인별 수정 = `{ author, status: 'RDS,RRK' }`, (4) DPS 고침/포털고침 게이팅은 우클릭 컨텍스트
> 메뉴의 고침(포털제외)/포털고침 항목으로 이동 — DPS + D 권한일 때만 활성화, 선택 시 기사작성(편집)
> 페이지로 이동.
>
> [v0.3.0 개정 — 2026-06-06 사용자 요청] (1) 송고/보류/KILL은 `window.confirm` 확인창 선행 + 성공 시
> 버튼 아래 상태 메시지 미표시(작성 페이지 초기화는 유지), (2) 보류/KILL도 송고와 동일하게 DTO 저장
> (saveArticle) 후 applyAction — 미저장 초안에 대한 not-found 거부 해소, (3) 데스크 미송고 = status
> IN (RDS, DDH) + 7컬럼 테이블(기사아이디/제목/작성자/수정자/작성시간/수정시간/LockYN) — 백엔드
> articleModel.query에 status 다중값(IN) 필터 추가, (4) 에디터 '본문' 라벨 텍스트 제거(aria-label 유지),
> (5) 문말 trailing '\n'이 pre-wrap에서 줄박스를 만들지 않아 Enter가 두 번 필요해 보이던 렌더 증상을
> trailing <br> 패딩으로 보정.

## 기술 접근 (Technical Approach)

- **스택**: React + Vite. MVC 분리 — View(화면/컴포넌트), Model(서버 데이터·앱 상태·인증 사용자), Controller(액션 핸들러·서버 호출·라우팅·상태 전이 조정).
- **라우팅**: 3개 페이지(login / write / view) 간 클라이언트 라우팅. 인증 가드로 미인증 시 login으로 리다이렉트(REQ-FE-APP-004).
- **공통 셸(shell)**: 우측 상단 사용자 정보(name, role) 표시 요소를 인증된 모든 페이지의 공통 레이아웃으로 둔다(REQ-FE-APP-003).
- **백엔드 연동**: SPEC-BACKEND-CORE-001의 함수/서비스 계약을 소비. 구체 REST 경로는 Run 단계에서 백엔드와 함께 확정([DP-2] 연계). UI는 "동작 + 필요한 데이터" 기준으로 호출 추상화 계층(Model 측)을 둔다.
- **에디터**: [DP-F1 확정] 좌측 에디터는 마크업 in/out 계약만 노출하는 교체 가능한 어댑터로 래핑한다. 구체 라이브러리는 Run 단계에서 선택. `markupVersion`은 덮어쓰기(이력 UI 없음).
- **실시간**: [DP-F2 확정] 갱신 계약(데이터 변경 시 목록·상태바 반영)을 구독 인터페이스로 캡슐화하여, WebSocket/폴링 중 무엇이 선택돼도 View가 영향받지 않게 한다. 전송 방식은 Run 단계 인프라 결정.
- **외부 검색**: [DP-F3 확정] 검색은 **백엔드 검색 프록시(search-proxy)** 인터페이스를 경유한다(키 서버 보관, CORS 회피, YouTube→Google 폴백 로직 서버 집중). 프런트엔드 Model 계층이 프록시 호출을 추상화하여 단일 검색 인터페이스를 노출한다. 프록시 엔드포인트·구현은 Run 단계(또는 후속 backend API) 소관 — 본 프런트엔드 SPEC 범위 밖의 신규 백엔드 책임.
- **부서 목록**: [DP-F4 확정] 부서별 송고 드롭다운은 분리된 데이터-소스 인터페이스(예: User.department distinct)에서 채운다. 구체 소스는 Run 단계.
- **송고/보류 상태**: [DP-F5 확정] UI는 액션+DTO만 전송하고 백엔드가 다음 상태를 계산하며, UI는 백엔드 반환 상태를 표시한다(클라이언트 미계산).

## 마일스톤 (Milestones — 우선순위 기반, 기간 추정 없음)

### Priority High — M1: 앱 골격 + 인증 흐름
- React/Vite 프로젝트 골격, MVC 레이어 분리, 라우팅(login/write/view).
- 공통 셸 + 우측 상단 사용자 정보 요소.
- 로그인 폼(아이디/암호, 마스킹), 백엔드 인증 호출, 성공 시 write 이동, 실패 시 에러 표시.
- 인증 가드(미인증 → login).
- 커버 요구사항: REQ-FE-APP-001~004, REQ-FE-LOGIN-001~005.

### Priority High — M2: 기사 작성 페이지 레이아웃 + 공통정보 탭
- 좌측 에디터(교체 가능한 어댑터 래핑, [DP-F1]) + 우측 메타데이터 2영역 레이아웃.
- 4탭(공통정보/이미지/영상/글기사) 탭 전환.
- 송고/보류 버튼(탭 위).
- 공통정보 탭 전체 입력 필드(작성자~2차 엠바고).
- 커버 요구사항: REQ-FE-WRITE-001~006, REQ-FE-WRITE-015.

### Priority Medium — M3: 검색 탭(이미지/영상/글기사) + 임베딩
- 이미지/영상 검색: 백엔드 검색 프록시 경유([DP-F3]) — 프록시가 YouTube → 실패 시 Google 폴백, 결과 표시, 선택 시 본문 임베딩. 프런트엔드 Model이 프록시 호출 추상화.
- 글기사 검색: 내부 기사 제목/본문 검색, 선택 시 임베딩.
- 커버 요구사항: REQ-FE-WRITE-007~011.

### Priority High — M4: 송고/보류 제출 + DTO 조립
- 에디터 + 4탭 입력을 기사 DTO로 조립, 송고/보류 액션 제출.
- 백엔드 반환 결과 상태 표시(클라이언트가 다음 상태 미계산).
- 커버 요구사항: REQ-FE-WRITE-012~014.

### Priority High — M5: 기사 조회 페이지 (실시간 + 4메뉴 + 권한 게이팅)
- 실시간 갱신 + 우측 상단 실시간 상태바.
- 4개 메뉴(부서별 작성 / 부서별 송고 / 개인별 수정 / 데스크 미송고) 각 필터 의미.
- 부서별 송고: 부서 드롭다운 + 조회 버튼.
- DPS 기사 고침/포털고침 D 권한만 노출, R/Z 숨김·비활성.
- 커버 요구사항: REQ-FE-VIEW-001~010.

## 위험 (Risks)

- **[R1] 백엔드 REST 계약 미확정**: 구체 경로/스키마가 Run 단계로 이연됨. 완화: Model 측 API 추상화 계층을 두어 경로 확정 시 View 영향 최소화. 의존: [DP-2].
- **[R2] 실시간 메커니즘([DP-F2 확정])**: 전송 방식(WebSocket vs 폴링)은 Run 단계 인프라 결정. 완화: 구독 인터페이스 캡슐화로 전송 방식 교체 가능하게 설계 — UI 계약은 이미 확정.
- **[R3] 백엔드 검색 프록시 신규 의존성([DP-F3 확정])**: 검색 프록시는 SPEC-BACKEND-CORE-001 현 범위에 없는 신규 백엔드 책임 — Run 단계(또는 후속 backend API)에서 정의/구현되어야 하며, 미정의 시 M3 검색 기능 차단. 완화: 프런트엔드 Model에 프록시 인터페이스를 추상화하여 엔드포인트 확정 시 View 영향 최소화. 오케스트레이터가 backend 측에 프록시 추가 필요성을 전달해야 함.
- **[R4] 부서 목록 출처([DP-F4 확정])**: 구체 데이터 소스는 Run 단계. 완화: 데이터-소스 인터페이스 분리 — UI 계약은 이미 확정.
- **[R5] 에디터 라이브러리 선택([DP-F1 확정])**: 구체 리치텍스트 라이브러리는 Run 단계. 완화: 에디터를 교체 가능한 어댑터(마크업 in/out 계약)로 래핑 — 이미 확정.
- **[R6] 권한 게이팅 우회**: UI 숨김만으로는 보안 강제 불가. 완화: 실제 인가는 백엔드(REQ-ART-AUTH-002)가 강제, UI는 UX 차원 노출/비활성만 담당(SPEC에 명시).

## 의존성 정렬 확인 (Dependency Alignment)

- 권한 R/D/Z, 생애주기 RDS/DPS/RRH/DDH/RRK/DDK: SPEC-BACKEND-CORE-001과 동일 값 사용.
- 조회 필터(distributedAt/createdAt/articleId/author/sender): 백엔드 REQ-ART-Q-001 제공 필터를 UI 메뉴 의미에 매핑.
- 로그인 응답에 비밀번호 해시 미포함(REQ-USR-LOGIN-004): UI는 사용자 정보 표시에 password 미사용.

## 결정 포인트 처리 (Decision Points)

[DP-F1]~[DP-F5]는 2026-05-27 사용자 확인으로 모두 **확정**되었으며 spec.md "확정 결정" 절에 반영. status: draft → approved (v0.2.0). 단, [DP-F3]의 백엔드 검색 프록시는 SPEC-BACKEND-CORE-001 범위 밖의 신규 백엔드 책임으로, Run 단계 또는 후속 backend API SPEC에서 엔드포인트 정의가 필요함(R3 참조).
