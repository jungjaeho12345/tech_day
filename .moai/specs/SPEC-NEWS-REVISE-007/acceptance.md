---
id: SPEC-NEWS-REVISE-007
version: 0.1.0
status: Plan
created: 2026-06-06
updated: 2026-06-06
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-004
  - SPEC-NEWS-REVISE-005
  - SPEC-NEWS-REVISE-006
  - SPEC-FRONTEND-UI-001
  - SPEC-UI-EDITOR-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-007 — 인수 기준 (Acceptance Criteria)

부서별 송고 페이지의 편집/고침/포털고침 진입점 와이어링 + ContentsVO 13필드 매핑(편집 5 / 읽기전용 8) +
고침/포털고침의 단순 편집 진입(전이 없음) 정합을 Given-When-Then 으로 고정한다.

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. news.md 편집/고침/포털고침 포워딩 + ContentsVO 매핑 신규 5문장 흡수.

---

## 공통 전제 (Common Preconditions)

- 모든 시나리오는 로그인된 세션을 전제한다 (SPEC-AUTH-001).
- 검증 테스트 파일은 본 리포의 실제 레이아웃을 따른다:
  - 프론트 테스트: `web/src/**/*.test.{js,jsx}`, 실행 `npm run test:web` (vitest run --root web).
  - 백엔드 테스트: `test/*.test.js`, 실행 `npm test`.
  - 빌드: `npm run build` (vite build web).
- 본 SPEC 의 모든 AC 는 프론트엔드 동작에 한정되므로 검증 파일은 모두 `web/src/**` 의 프론트 테스트이다.
- ContentsVO 13필드 = 기사아이디, 제목, 본문내용, 작성자, 수정자, 송고자, 부서, 부서코드, 작성시간, 편집시간, 송고시간, 엠바고 시간, 2차 엠바고 시간.
  - 편집 가능 5필드 = 제목·본문내용(→에디터), 작성자·엠바고 시간·2차 엠바고 시간(→공통정보 입력란).
  - 읽기전용 8필드 = 기사아이디, 수정자, 송고자, 부서, 부서코드, 작성시간, 편집시간, 송고시간(→작성 페이지 읽기전용 표시 영역).

---

## §1. REQ-FWD-ENTRYPOINTS — 부서별 송고 진입점 와이어링

검증 파일: `web/src/view/ViewPage.contextMenu.test.jsx`, `web/src/view/ViewPage.test.jsx`

### AC-FWD-1 — 부서별 송고 우클릭 메뉴에 편집 항목이 추가된다

- **Given** 사용자가 기사 조회페이지의 `부서별 송고` 메뉴를 보고 있고, 목록에 DPS 기사 한 행이 있다.
- **When** 해당 행을 우클릭하여 컨텍스트 메뉴를 연다.
- **Then** 컨텍스트 메뉴에 `편집` 항목이 존재하고 활성(enabled) 상태이며, 클릭 시 작성 페이지로 포워딩된다(`navigate(ROUTES.WRITE, { id: article.articleId })` 호출).
- **And** 부서별 작성·개인별 수정 메뉴에는 기존과 동일하게 부서별 송고 전용 `편집` 항목이 추가되지 않는다(부서별 송고에만 추가).

### AC-FWD-2 — 부서별 송고 우클릭의 고침(포털제외)/포털고침이 D 권한+DPS에서 활성화된다

- **Given** 사용자가 `부서별 송고` 메뉴에서 DPS 기사 행을 보고 있다.
- **When** 권한이 `D` 인 사용자가 그 행을 우클릭한다.
- **Then** `고침(포털제외)` 와 `포털고침` 항목이 활성(enabled)이며, 각각 클릭 시 작성 페이지로 포워딩된다(`navigate(ROUTES.WRITE, { id: article.articleId })` 호출).
- **And** 권한이 `R` 또는 `Z` 인 사용자가 같은 행을 우클릭하면 `고침(포털제외)`/`포털고침` 은 비활성(disabled) 플레이스홀더로 남는다(news.md "DPS일 때는 D 권한 사용자만 고침/포털고침 사용").

### AC-FWD-3 — 부서별 송고 DPS 행의 고침/포털고침 버튼이 작성 페이지로 포워딩된다

- **Given** 사용자가 `부서별 송고` 메뉴에서 DPS 기사 행을 보고 있고, 권한이 `D` 이다.
- **When** 행에 렌더된 `고침` 버튼 또는 `포털고침` 버튼을 클릭한다.
- **Then** 시스템은 작성 페이지로 포워딩한다(`navigate(ROUTES.WRITE, { id: article.articleId })` 호출). 버튼 클릭은 행 클릭(상세보기 새창)을 동시 발생시키지 않는다(이벤트 전파 차단 유지).
- **And** 권한이 `D` 가 아니면 두 버튼은 비활성(disabled)으로 남고 클릭해도 포워딩이 발생하지 않는다.

### AC-FWD-4 — 모든 진입점이 동일한 articleId 로 동일 경로 포워딩한다

- **Given** `부서별 송고` 메뉴의 동일한 DPS 기사 행(`article.articleId === 'AKR20260606XYZ'`)이 있고 권한이 `D` 이다.
- **When** (a) 우클릭 `편집`, (b) 우클릭 `고침(포털제외)`, (c) 우클릭 `포털고침`, (d) 행 `고침` 버튼, (e) 행 `포털고침` 버튼 중 어느 것이든 트리거한다.
- **Then** 다섯 경로 모두 동일하게 `navigate(ROUTES.WRITE, { id: 'AKR20260606XYZ' })` 를 호출하여 같은 작성 페이지(`writer.do?id=AKR20260606XYZ`)로 진입한다.

---

## §2. REQ-VO-MAPPING — ContentsVO 13필드 매핑

검증 파일: `web/src/controller/useWriteController.editLoad.test.jsx`, `web/src/view/WritePage.test.jsx`

### AC-MAP-1 — 편집 가능 5필드가 에디터/공통정보 입력란에 채워진다

- **Given** 작성 페이지가 `editArticleId` 를 가지고 마운트되고, 모델 `queryArticles({ articleId })` 가 제목/본문내용/작성자/엠바고 시간/2차 엠바고 시간을 포함한 행을 반환한다.
- **When** 편집 로드가 완료된다.
- **Then** 제목·본문내용은 에디터 본문에 로드되고(markupVersion → 에디터), 작성자·엠바고 시간·2차 엠바고 시간은 공통정보 탭의 기존 입력란(`author`, `embargoAt`, `secondaryEmbargoAt`)에 채워진다.
- **And** 이 5필드 입력란은 편집 가능(읽기전용 아님) 상태로 유지된다(기존 데스크 미송고 편집 동작 회귀 없음).

### AC-MAP-2 — 읽기전용 8필드가 작성 페이지의 읽기전용 표시 영역에 노출된다

- **Given** 모델이 반환한 행에 기사아이디/수정자/송고자/부서/부서코드/작성시간/편집시간/송고시간 8필드 값이 있다.
- **When** 편집 로드가 완료되어 작성 페이지가 렌더된다.
- **Then** 8필드가 각 라벨과 함께 읽기전용 표시 영역에 노출된다(예: `data-testid="readonly-meta"` 컨테이너 안에서 8필드의 라벨/값이 모두 조회된다).
- **And** 8필드는 어떤 사용자 입력으로도 편집할 수 없다(텍스트 입력 요소가 아니거나 `readOnly`/`disabled` 로 렌더되며, 변경 핸들러가 없다).

### AC-MAP-3 — 읽기전용 8필드 표시 영역은 편집 로드 컨텍스트에서만 나타난다

- **Given** 작성 페이지가 `editArticleId` 없이(신규 작성 컨텍스트) 마운트된다.
- **When** 페이지가 렌더된다.
- **Then** 읽기전용 8필드 표시 영역은 렌더되지 않는다(신규 작성에는 기사아이디/송고자/송고시간 등이 아직 존재하지 않으므로 빈 영역을 만들지 않는다).
- **And** 신규 작성 페이지의 송고/보류/KILL 버튼, 4탭, 에디터 동작은 기존과 동일하다(회귀 없음).

### AC-MAP-4 — 누락 필드는 빈 값으로 안전하게 표시된다

- **Given** 모델이 반환한 행에서 일부 읽기전용 필드(예: 송고시간)가 `undefined`/`null` 이다.
- **When** 편집 로드가 완료되어 읽기전용 영역이 렌더된다.
- **Then** 해당 필드는 빈 값(빈 문자열)으로 표시되며 `undefined`/`null` 문자열을 노출하지 않고, 다른 필드 표시는 영향받지 않는다.

---

## §3. REQ-REVISE-SEMANTICS — 고침/포털고침 단순 편집 진입(전이 없음)

검증 파일: `web/src/view/ViewPage.contextMenu.test.jsx`, `web/src/controller/useWriteController.editLoad.test.jsx`

### AC-REV-1 — 고침/포털고침 진입은 기사 상태값 전이를 일으키지 않는다

- **Given** 권한 `D` 사용자가 `부서별 송고` 메뉴에서 DPS 기사를 본다.
- **When** 우클릭 `고침(포털제외)`/`포털고침` 또는 행 버튼으로 작성 페이지에 진입한다.
- **Then** 진입 시점에 lifecycle 전이 API(`applyAction`/송고·보류·KILL)가 호출되지 않는다. 진입은 단순히 작성 페이지 포워딩 + 편집 로드만 수행한다.
- **And** 진입 후 작성 페이지에 로드된 기사의 편집 상태값은 행의 원래 상태값(DPS)을 그대로 채택하며, 진입 자체가 DPS 를 다른 값으로 바꾸지 않는다.

### AC-REV-2 — 고침/포털고침에는 고침 모드 플래그가 도입되지 않는다

- **Given** 본 SPEC 의 진입 경로(편집/고침/포털고침)가 작성 페이지로 포워딩된다.
- **When** 다섯 진입점 중 어느 것으로든 진입한다.
- **Then** 작성 페이지는 데스크 미송고 `편집` 진입과 동일한 단일 편집 컨텍스트(`editArticleId` 보유)만 사용하며, "고침 전용" 모드 플래그/별도 상태/별도 라우트 파라미터를 추가하지 않는다(진입점이 달라도 작성 페이지 동작은 동일).

### AC-REV-3 — D 권한 + DPS 게이팅이 유지된다

- **Given** `부서별 송고` 메뉴는 DPS 기사만 조회한다(news.md 부서별 송고페이지는 DPS기사만 조회).
- **When** 권한이 `D` 가 아닌(`R`/`Z`) 사용자가 우클릭 메뉴 또는 행 버튼의 고침/포털고침에 접근한다.
- **Then** 고침(포털제외)/포털고침은 비활성(disabled)으로 남아 포워딩이 발생하지 않는다(D 권한만 사용 가능).
- **And** `편집` 항목(부서별 송고 우클릭 신규 항목)은 게이팅 대상이 아니므로 권한과 무관하게 활성이며 포워딩한다(news.md 편집 항목은 별도 권한 제약 없음).

---

## §4. (선택) REQ-REGRESSION-GUARD — 데스크 미송고 편집/락 회귀 가드

검증 파일: `web/src/view/ViewPage.contextMenu.test.jsx`, `web/src/controller/useWriteController.editLoad.test.jsx`, `web/src/view/WritePage.test.jsx`

### AC-REG-1 — 데스크 미송고 우클릭 편집 동작은 회귀 없이 유지된다

- **Given** 사용자가 `데스크 미송고` 메뉴에서 RDS/DDH 기사 행을 본다.
- **When** 행을 우클릭하여 `편집` 을 클릭한다.
- **Then** 기존과 동일하게 `navigate(ROUTES.WRITE, { id: article.articleId })` 로 포워딩되고(본 SPEC 의 부서별 송고 진입점 추가가 데스크 미송고 메뉴 항목 구성을 바꾸지 않는다), 데스크 미송고 메뉴 항목 집합(편집/상세보기/이력보기/본문복사/제목만복사)은 그대로다.

### AC-REG-2 — 편집 진입 시 lockYN 락 계약이 그대로 재사용된다

- **Given** 작성 페이지가 `editArticleId` 를 가지고 마운트된다(어느 진입점에서 왔든 동일).
- **When** 편집 컨텍스트로 진입한다.
- **Then** SPEC-NEWS-REVISE-002 의 락 계약(`acquireEditLock` 마운트 시 호출, `beforeunload`/`visibilitychange:hidden` + `sendBeacon` 해제)이 그대로 동작하며, 본 SPEC 은 새 락 규칙을 도입하지 않는다(락 충돌 시 기존 배너/ALERT 동작 유지).

### AC-REG-3 — 공통정보 편집 5필드 로드 동작은 회귀 없이 유지된다

- **Given** 편집 로드 시 모델이 작성자/엠바고/2차 엠바고를 반환한다.
- **When** 편집 로드가 완료된다.
- **Then** 공통정보 입력란 매핑(작성자→`author`, 엠바고→`embargoAt`, 2차 엠바고→`secondaryEmbargoAt`)은 기존 `commonFromRow` 동작과 동일하게 채워지며, 읽기전용 8필드 표시 영역 추가가 이 5필드 입력란을 읽기전용으로 바꾸지 않는다.

---

## §5. 품질 게이트 / Definition of Done

- [ ] `npm run test:web` 프론트 테스트 전체 통과
- [ ] `npm test` 백엔드 테스트 전체 통과(본 SPEC 은 백엔드 미변경이나 회귀 없음 확인)
- [ ] `npm run build` 무경고
- [ ] AC-FWD-1~4, AC-MAP-1~4, AC-REV-1~3, AC-REG-1~3 모두 GREEN
- [ ] 기존 디자인 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 사용, 신규 토큰 미도입
- [ ] SPEC-NEWS-REVISE-001~006 / SPEC-FRONTEND-UI-001 / SPEC-UI-EDITOR-001 / SPEC-AUTH-001 AC 회귀 없음
- [ ] news.md / 본 SPEC 정합 확인(news.md 미변경 — 이미 반영됨)
- [ ] Slack `tech-day` 채널 작업 완료 보고(CLAUDE.md HARD 규칙)

---

## 엣지 케이스 (Edge Cases)

| ID | 케이스 | 기대 동작 | 검증 AC |
|----|--------|-----------|---------|
| EC-1 | 부서별 송고 목록에 DPS 가 아닌 행이 섞여 표시되는 경우(이론상 미발생, 방어) | 고침/포털고침은 DPS 가 아니면 활성화되지 않는다 | AC-FWD-2, AC-REV-3 |
| EC-2 | `D` 권한이지만 행에 `articleId` 가 없는 비정상 행 | 포워딩하지 않거나 빈 id 로 진입을 방지(빈 id 는 URL 쿼리에 포함되지 않음, routing.js 규칙) | AC-FWD-4 |
| EC-3 | 읽기전용 8필드 전체가 비어 있는 신규-유사 행 | 신규 컨텍스트가 아니라 편집 컨텍스트면 영역은 표시하되 빈 값으로 렌더 | AC-MAP-3, AC-MAP-4 |
| EC-4 | 동일 기사를 다른 세션이 편집 중(락 보유) 상태에서 고침/포털고침 진입 | 기존 락 계약대로 거부 배너/ALERT 표시(본 SPEC 신규 규칙 없음) | AC-REG-2 |
| EC-5 | 우클릭 메뉴를 연 채 활성 메뉴가 바뀌는 경우 | 기존 ViewPage 동작대로 컨텍스트 메뉴가 닫힌다 | AC-FWD-1 |

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
