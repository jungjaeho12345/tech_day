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

# SPEC-NEWS-REVISE-007 — 구현 계획 (Implementation Plan)

부서별 송고 페이지의 편집/고침/포털고침 진입점 3종 와이어링 + ContentsVO 읽기전용 8필드 표시 확장.
모두 프론트엔드 한정 Δ 이며, 데스크 미송고 편집의 기존 동작(포워딩 + 본문/공통정보 로드 + 락)은 회귀 없이 유지한다.

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. news.md 편집/고침/포털고침 포워딩 + ContentsVO 매핑 신규 5문장 흡수.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 brownfield Δ 기준점 (직접 Read 로 검증한 현재 사실)

- `web/src/view/ViewPage.jsx` `buildContextItems()`:
  - 데스크 미송고 메뉴의 `편집` 은 이미 `navigate(ROUTES.WRITE, { id: article.articleId })` 로 포워딩(약 L54).
  - 부서별 작성/송고/개인별 수정 공용 메뉴는 `고침(포털제외)`/`포털고침` 이 `DISABLED` 플레이스홀더(약 L73~74)이고, `편집` 항목 자체가 없다.
- `web/src/view/ViewPage.jsx` `ArticleRow`:
  - DPS 행에서 `고침`/`포털고침` 버튼이 `role === 'D'` 게이팅(`disabled={!canDpsEdit}`)으로 렌더되지만 onClick 은 `stopPropagation` 만 한다(약 L161~162).
- `web/src/controller/useWriteController.js`:
  - `useWriteController(user, { editArticleId })` 가 마운트 시 `model.queryArticles({ articleId })` 로 row 를 로드 → markupVersion 을 에디터에, 공통정보 필드(author/region/... )를 `commonFromRow` 로 매핑.
  - `acquireEditLock`/`releaseEditLock`(sendBeacon) 통합 완료(SPEC-NEWS-REVISE-002 AC-EDIT-LOCK-*).
  - `commonFromRow` 는 `EMPTY_COMMON` 키(author/coAuthor/content/region/.../embargoAt/secondaryEmbargoAt)만 매핑한다. 읽기전용 8필드(기사아이디/수정자/송고자/부서/부서코드/작성시간/편집시간/송고시간)는 현재 작성 페이지에 노출되지 않는다.
- 라우팅: `web/src/app/App.jsx` `navigate(route, params)` → `web/src/app/routing.js` `pathForRoute` (`writer.do?id=...`). `WritePage` 는 `new URLSearchParams(window.location.search).get('id')` 로 `editArticleId` 를 읽어 `useWriteController` 에 전달한다(검증 완료).
- `ContentsVO.md`(리포 루트): 13필드 모두 varchar, PK = 기사아이디.

### 1.2 Δ 요약

- (a) 부서별 송고 진입점 3종 와이어링:
  1. 우클릭 메뉴에 `편집` 항목 신규 추가(부서별 송고에만).
  2. 우클릭 메뉴의 `고침(포털제외)`/`포털고침` 을 `DISABLED` → D 권한 + DPS 조건부 활성 + 포워딩.
  3. DPS 행의 `고침`/`포털고침` 버튼 onClick 을 `stopPropagation` 만 → 포워딩 추가(D 권한 게이팅 유지).
- (b) ContentsVO 읽기전용 8필드 표시 확장: 작성 페이지(편집 컨텍스트)에 읽기전용 표시 영역을 추가하여 8필드를 라벨/값으로 노출.

### 1.3 설계 원칙

- 모든 진입점은 동일하게 `navigate(ROUTES.WRITE, { id: article.articleId })` 로 단일 작성 페이지에 진입한다(데스크 미송고 편집과 동일 경로). 진입점별 별도 모드/플래그/라우트 파라미터를 만들지 않는다(AC-REV-2).
- 고침/포털고침 진입은 단순 편집 진입이다. lifecycle 전이 API 를 호출하지 않으며, 기사 상태값을 바꾸지 않는다(AC-REV-1).
- 읽기전용 8필드 표시는 편집 컨텍스트(`editArticleId` 보유)에서만 렌더하고, 신규 작성에는 렌더하지 않는다(AC-MAP-3).
- 락 계약은 SPEC-NEWS-REVISE-002 의 것을 그대로 재사용한다. 새 락 규칙을 도입하지 않는다(AC-REG-2).
- 디자인은 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 사용한다(신규 토큰 금지).

---

## 2. 마일스톤 (Milestones — Priority 기반, 시간 추정 없음)

### M1 (Priority: High) — 부서별 송고 진입점 3종 와이어링

목표: news.md L77/L149 — 부서별 송고 우클릭 `편집` 추가 + 고침(포털제외)/포털고침 활성화 + DPS 행 버튼 포워딩.

- `buildContextItems({ article, menu, navigate, role })` 에 `role` 전달을 추가하고, 부서별 송고 메뉴 분기를 신설:
  - `편집` 항목을 데스크 미송고와 동일하게 `navigate(ROUTES.WRITE, { id })` 로 추가(권한 무관 활성).
  - `고침(포털제외)`/`포털고침` 을 `DISABLED` 대신, `article.status === 'DPS' && role === 'D'` 일 때 `onSelect: () => navigate(ROUTES.WRITE, { id })` 로 활성, 아니면 기존처럼 `DISABLED` 유지.
- `ViewPage` 가 `buildContextItems` 호출 시 `role`(=`ctrl.menu` 시점의 `user.role`)을 전달하도록 `ContextMenu` items 빌더 호출부를 보강.
- `ArticleRow` DPS 행의 `고침`/`포털고침` 버튼 onClick 을 `navigate(ROUTES.WRITE, { id: article.articleId })` 호출로 변경하되, `e.stopPropagation()` 을 유지하여 행 클릭(상세보기 새창) 동시 발생을 막는다. `disabled={!canDpsEdit}` 게이팅은 그대로 둔다.
- `ArticleRow` 가 `navigate` 를 받을 수 있도록 prop 전달 경로 추가(현재 `ViewPage` 가 `session.navigate` 를 보유).

AC 매핑: AC-FWD-1, AC-FWD-2, AC-FWD-3, AC-FWD-4, AC-REV-3.

### M2 (Priority: High) — ContentsVO 읽기전용 8필드 표시 영역

목표: news.md L148 — 매핑 시 읽기전용 8필드(기사아이디/수정자/송고자/부서/부서코드/작성시간/편집시간/송고시간)를 작성 페이지에 읽기전용으로 표시.

- `useWriteController` 가 편집 로드 시 읽기전용 8필드 값을 별도 상태(예: `readonlyMeta`)로 노출한다. `commonFromRow` 의 편집 5필드 매핑은 그대로 두고, 8필드는 행에서 직접 추출(누락 필드는 빈 문자열).
  - 행의 필드명 매핑(검증 필요, M2 구현 시 모델 row 형태 확인): `articleId`, `modifier`, `sender`/`송고자`, `department`/`부서`, `departmentCode`/`부서코드`, `createdAt`(작성시간), `editedAt`(편집시간), `sentAt`(송고시간). 실제 row 키는 `httpModel`/`articleModel` 반환 스키마를 Run 단계에서 확인하여 확정한다.
- `WritePage` 가 편집 컨텍스트(`editArticleId` 존재)에서만 읽기전용 표시 영역(`data-testid="readonly-meta"`)을 렌더한다. 8필드를 라벨/값 쌍으로 표시하며, 입력 요소가 아니거나 `readOnly`/`disabled` 로 렌더한다(편집 불가).
- 신규 작성 컨텍스트에서는 영역을 렌더하지 않는다(AC-MAP-3).
- `web/src/styles/yonhap.css` 에 읽기전용 영역 스타일을 기존 토큰만 사용해 추가(예: `--yh-gray-line` 구분선, `--yh-blue` 라벨색). 신규 변수 정의 금지.

AC 매핑: AC-MAP-1, AC-MAP-2, AC-MAP-3, AC-MAP-4, AC-REG-3.

### M3 (Priority: Medium) — 단순 편집 진입 시맨틱 가드 + 회귀 가드

목표: 고침/포털고침이 전이를 일으키지 않음(AC-REV-1/2) + 데스크 미송고 편집/락 회귀 없음(AC-REG-*).

- 진입점 와이어링이 lifecycle 전이 API 를 호출하지 않음을 테스트로 고정(진입은 `navigate` 만, `applyAction`/송고·보류·KILL 미호출).
- 데스크 미송고 우클릭 `편집` 항목 집합/포워딩 회귀 가드(AC-REG-1).
- 편집 진입 시 SPEC-NEWS-REVISE-002 락 계약(`acquireEditLock`/`sendBeacon` 해제) 회귀 가드(AC-REG-2).
- 공통정보 5필드 로드 회귀 가드(AC-REG-3).

AC 매핑: AC-REV-1, AC-REV-2, AC-REG-1, AC-REG-2, AC-REG-3.

---

## 3. 파일 단위 변경 계획 (File-Level Change Plan)

| 파일 | 마일스톤 | 변경 요지 |
|------|----------|-----------|
| `web/src/view/ViewPage.jsx` | M1 | `buildContextItems` 에 부서별 송고 분기 신설(`편집` 추가, 고침/포털고침 D+DPS 활성), `role` 전달; `ArticleRow` 의 고침/포털고침 버튼 onClick 포워딩(+`stopPropagation` 유지); `navigate` prop 전달 경로 |
| `web/src/view/WritePage.jsx` | M2 | 편집 컨텍스트에서 읽기전용 8필드 표시 영역(`data-testid="readonly-meta"`) 렌더; 신규 작성 시 미렌더 |
| `web/src/controller/useWriteController.js` | M2 | 편집 로드 시 읽기전용 8필드 상태(`readonlyMeta`) 노출(누락 필드 빈 문자열); 기존 `commonFromRow`/락/Insert·Update 분기 동작 불변 |
| `web/src/styles/yonhap.css` | M2 | 읽기전용 표시 영역 스타일 추가(기존 토큰만 사용, 신규 변수 금지) |
| `web/src/view/ViewPage.contextMenu.test.jsx` | M1, M3 | 부서별 송고 `편집`/고침/포털고침 활성·포워딩, D 권한 게이팅, 전이 미호출, 데스크 미송고 회귀 |
| `web/src/view/ViewPage.test.jsx` | M1 | 부서별 송고 DPS 행 버튼 포워딩, 비 D 권한 disabled |
| `web/src/controller/useWriteController.editLoad.test.jsx` | M2, M3 | 읽기전용 8필드 노출, 편집 5필드 매핑 회귀, 락/전이 미호출 회귀 |
| `web/src/view/WritePage.test.jsx` | M2, M3 | 편집 컨텍스트 읽기전용 영역 렌더/신규 미렌더, 8필드 편집 불가 |

> 비고: 위 표의 컨트롤러 함수 시그니처/필드명(예: `readonlyMeta`, row 키 매핑)은 Run 단계에서 실제 모델 반환 스키마를 Read 로 확인하여 확정한다. 본 plan 은 WHAT/우선순위만 고정하고 내부 구현 형태를 강제하지 않는다.

---

## 4. 위험 & 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: 모델 row 의 읽기전용 8필드 키 이름이 실제와 다를 수 있음(송고자/부서/송고시간 등) | 읽기전용 영역에 빈 값만 표시 | Run 단계에서 `articleModel`/`httpModel` 반환 스키마 Read 후 키 매핑 확정; 누락 필드는 빈 문자열로 안전 처리(AC-MAP-4) |
| R2: 고침/포털고침 버튼 포워딩 추가 시 행 클릭(상세보기 새창)이 동시 발생 | 의도치 않은 새창 | 버튼 onClick 에서 `e.stopPropagation()` 유지(AC-FWD-3) |
| R3: 부서별 송고 `편집` 항목이 다른 메뉴(부서별 작성/개인별 수정)에도 새어 추가됨 | 메뉴 항목 회귀 | `menu === '부서별 송고'` 분기로만 추가하고 테스트로 다른 메뉴 미추가 단언(AC-FWD-1) |
| R4: 읽기전용 영역이 신규 작성에도 렌더되어 빈 칸 노출 | 신규 작성 UX 저하 | `editArticleId` 존재 조건으로만 렌더(AC-MAP-3) |
| R5: 락 계약/Insert·Update 분기 동작에 영향 | 데이터 손실/오호출 | 본 SPEC 은 진입점·표시만 추가; `submitAction`/락 useEffect 미변경 회귀 가드(AC-REG-2) |
| R6: 신규 디자인 토큰 도입 유혹(읽기전용 영역 색) | 디자인 일관성 위반 | 기존 토큰만 사용, CSS 변수 추가 금지(news.md/도메인 스킬 D-4) |

---

## 5. 테스트 전략 (Test Strategy)

- 실행: 프론트 `npm run test:web`(vitest run --root web), 백엔드 `npm test`, 빌드 `npm run build`.
- 프론트 단위/통합:
  - `ViewPage.contextMenu.test.jsx`: 부서별 송고 `편집`/고침/포털고침 활성·포워딩, D 권한 게이팅, 전이 미호출, 데스크 미송고 회귀.
  - `ViewPage.test.jsx`: 부서별 송고 DPS 행 버튼 포워딩, 비 D disabled.
  - `useWriteController.editLoad.test.jsx`: 읽기전용 8필드 노출(누락 빈 값), 편집 5필드 매핑 회귀, 락/전이 미호출.
  - `WritePage.test.jsx`: 편집 컨텍스트 읽기전용 영역 렌더 / 신규 미렌더, 8필드 편집 불가.
- 회귀 가드: SPEC-NEWS-REVISE-001~006 / FRONTEND-UI-001 / UI-EDITOR-001 / AUTH-001 AC 전체 GREEN 유지, `npm run build` 무경고.

---

## 6. 개발 방법론

- TDD (Brownfield Enhancement): 진입점·표시 추가 전에 실패하는 테스트를 먼저 작성한다(RED → GREEN → REFACTOR). 기존 코드 동작을 Read 로 이해한 뒤 진행한다.
- 작업 모드: Brownfield 확장(Δ-only). news.md / 다른 SPEC 3파일 / 코드 외 영역 미변경.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
