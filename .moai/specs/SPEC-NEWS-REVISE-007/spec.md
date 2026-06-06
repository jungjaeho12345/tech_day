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

# SPEC-NEWS-REVISE-007 — 부서별 송고 편집/고침/포털고침 포워딩 + ContentsVO 13필드 매핑

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. news.md 편집/고침/포털고침 포워딩 + ContentsVO 매핑 신규 5문장 흡수.

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-007 |
| 제목 | 부서별 송고 편집/고침/포털고침 포워딩 + ContentsVO 13필드 매핑 |
| 상태 | Plan |
| 생성일 | 2026-06-06 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001~006, SPEC-FRONTEND-UI-001, SPEC-UI-EDITOR-001, SPEC-AUTH-001 |
| 영향 페이지 | `list.do` (기사 조회 — 부서별 송고), `writer.do` (기사 작성/편집) |
| 작업 모드 | Brownfield 확장 (Δ-only, 프론트엔드 한정) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

`news.md`(source-of-truth)에 2026-06-06 추가된 신규 5문장을 코드/테스트에 정합되도록 정식 명세화한다.

흡수 대상 문장:

- (기사 조회페이지 절, L79) "부서별 송고 페이지의 우클릭 메뉴에는 편집 항목이 추가로 있다."
- (기사 편집 기능 절, L147) "데스크 미송고에서 편집 버튼 사용시 또는 부서별 송고에서 편집, 고침, 포털고침 사용시 기사 작성페이지로 포워딩되어 기사의 정보들(ContentsVO.md)이 매핑되어 보여준다."
- (L148) "매핑 시 제목/본문내용/작성자/엠바고 시간/2차 엠바고 시간은 기존 입력란에 채워지고, 나머지 ContentsVO 필드(기사아이디, 수정자, 송고자, 부서, 부서코드, 작성시간, 편집시간, 송고시간)는 작성 페이지에 읽기전용으로 표시한다."
- (L149) "부서별 송고 페이지의 DPS 행에 있는 고침/포털고침 버튼도 동일하게 기사 작성페이지로 포워딩한다 (D 권한만 사용 가능)."
- (L150) "고침/포털고침으로 진입하는 것은 단순 편집 진입이며 기사 상태값 전이를 일으키지 않는다."

`why`: `news.md` 가 시스템의 source-of-truth 이며 부서별 송고 페이지의 편집 진입점이 신규 정의되었다. 정합 명세 없이 구현하면 (a) 진입점별 동작 불일치, (b) ContentsVO 읽기전용 필드 미표시로 인한 정보 누락, (c) 고침/포털고침이 의도치 않게 상태 전이를 유발하는 회귀가 발생한다. 본 SPEC 은 이를 EARS 형식으로 고정한다.

본 SPEC 은 기존 SPEC(NEWS-REVISE-001~006, FRONTEND-UI-001, UI-EDITOR-001, AUTH-001) 계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope) — 프론트엔드 한정

- 부서별 송고 우클릭 메뉴에 `편집` 항목 신규 추가.
- 부서별 송고 우클릭 메뉴의 `고침(포털제외)`/`포털고침` 을 DISABLED 플레이스홀더 → D 권한 + DPS 조건부 활성 + 작성 페이지 포워딩.
- 부서별 송고 DPS 행의 `고침`/`포털고침` 버튼(현재 무동작) → 작성 페이지 포워딩 와이어링(D 권한 게이팅 유지).
- 모든 진입점이 동일하게 `navigate(ROUTES.WRITE, { id: article.articleId })` 로 단일 작성 페이지 진입.
- ContentsVO 13필드 매핑: 편집 가능 5필드(제목·본문내용→에디터, 작성자·엠바고·2차 엠바고→공통정보 입력란) + 읽기전용 8필드(기사아이디·수정자·송고자·부서·부서코드·작성시간·편집시간·송고시간→작성 페이지 읽기전용 표시 영역).
- 고침/포털고침의 단순 편집 진입(상태값 전이 없음) 시맨틱 고정.
- 데스크 미송고 편집/락 회귀 가드.

### 2.2 제외 (Out of Scope) — Exclusions 절(§9) 참조

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 권한 D — 부서별 송고 편집/고침/포털고침 진입

- 부서별 송고 메뉴(DPS 기사만 조회)에서 DPS 기사를 우클릭한다.
- 컨텍스트 메뉴에 `편집`(신규)이 활성이고, `고침(포털제외)`/`포털고침` 이 D 권한이므로 활성이다.
- 어느 항목을 클릭하든 작성 페이지(`writer.do?id=<articleId>`)로 포워딩되어 기사 정보가 매핑되어 보인다.
- DPS 행에 직접 노출된 `고침`/`포털고침` 버튼을 클릭해도 동일하게 작성 페이지로 포워딩된다.
- 진입은 단순 편집 진입이며, 진입만으로 DPS 가 다른 상태로 전이하지 않는다.

### 3.2 권한 R / Z — 부서별 송고에서 고침/포털고침 제한

- R/Z 사용자가 같은 DPS 행을 우클릭하면 `고침(포털제외)`/`포털고침` 은 비활성(disabled)으로 남는다.
- `편집` 항목은 권한 제약이 없으므로 활성이며 작성 페이지로 포워딩된다.

### 3.3 모든 권한 — 작성 페이지 매핑

- 작성 페이지 진입 후 제목/본문내용이 에디터에, 작성자/엠바고 시간/2차 엠바고 시간이 공통정보 입력란에 채워진다.
- 기사아이디/수정자/송고자/부서/부서코드/작성시간/편집시간/송고시간 8필드가 읽기전용 표시 영역에 라벨/값으로 노출되며 편집할 수 없다.
- 신규 작성으로 진입한 경우(편집 컨텍스트 아님) 읽기전용 영역은 표시되지 않는다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-FWD-ENTRYPOINTS — 부서별 송고 진입점 와이어링 (Priority: High)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 부서별 송고 페이지의 우클릭 컨텍스트 메뉴에 `편집` 항목을 제공한다.
- **[Event-Driven]** WHEN 사용자가 부서별 송고 페이지에서 `편집` 항목을 클릭하면, THE 시스템 SHALL `navigate(ROUTES.WRITE, { id: article.articleId })` 를 호출하여 기사 작성 페이지로 포워딩한다.
- **[State-Driven]** WHILE 기사 상태값이 `DPS` 이고 사용자 권한이 `D` 인 동안, THE 시스템 SHALL 부서별 송고 우클릭 메뉴의 `고침(포털제외)`/`포털고침` 항목과 DPS 행의 `고침`/`포털고침` 버튼을 활성화하고, 클릭 시 동일하게 작성 페이지로 포워딩한다.
- **[Event-Driven]** WHEN 사용자가 DPS 행의 `고침`/`포털고침` 버튼을 클릭하면, THE 시스템 SHALL 작성 페이지로 포워딩하되 동일 클릭이 행 클릭(상세보기 새창)을 동시에 발생시키지 않도록 이벤트 전파를 차단한다.
- **[Unwanted]** IF 사용자 권한이 `D` 가 아니거나(`R`/`Z`) 기사 상태값이 `DPS` 가 아니면, THEN THE 시스템 SHALL `고침(포털제외)`/`포털고침`(우클릭 항목 및 행 버튼)을 비활성(disabled)으로 유지하고 포워딩을 수행하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 부서별 송고 전용 `편집` 항목을 데스크 미송고·부서별 작성·개인별 수정 메뉴에 중복 추가하지 않는다.

#### Acceptance Criteria 포인터

- AC-FWD-1 (편집 항목 추가/포워딩), AC-FWD-2 (고침/포털고침 D+DPS 활성), AC-FWD-3 (행 버튼 포워딩/전파 차단), AC-FWD-4 (5진입점 동일 경로) — acceptance.md §1

---

### REQ-VO-MAPPING — ContentsVO 13필드 매핑 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 작성 페이지가 편집 컨텍스트(`editArticleId` 보유)로 진입하면, THE 시스템 SHALL 로드된 기사의 제목/본문내용을 에디터 본문에, 작성자/엠바고 시간/2차 엠바고 시간을 공통정보 탭의 기존 입력란(`author`/`embargoAt`/`secondaryEmbargoAt`)에 채운다.
- **[Ubiquitous]** THE 시스템 SHALL 편집 컨텍스트에서 ContentsVO 의 읽기전용 8필드(기사아이디, 수정자, 송고자, 부서, 부서코드, 작성시간, 편집시간, 송고시간)를 작성 페이지의 읽기전용 표시 영역에 라벨/값으로 노출한다.
- **[State-Driven]** WHILE 작성 페이지가 신규 작성 컨텍스트(`editArticleId` 미보유)인 동안, THE 시스템 SHALL 읽기전용 8필드 표시 영역을 렌더하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 읽기전용 8필드를 사용자 편집 가능 입력 요소로 렌더하지 않는다(읽기전용/비입력으로만 표시).
- **[Unwanted]** IF 읽기전용 필드 값이 `undefined`/`null` 이면, THEN THE 시스템 SHALL 해당 필드를 빈 문자열로 표시하고 `undefined`/`null` 문자열을 노출하지 않으며 다른 필드 표시에 영향을 주지 않는다.

#### Acceptance Criteria 포인터

- AC-MAP-1 (편집 5필드 채움), AC-MAP-2 (읽기전용 8필드 노출), AC-MAP-3 (신규 컨텍스트 미렌더), AC-MAP-4 (누락 안전 표시) — acceptance.md §2

---

### REQ-REVISE-SEMANTICS — 고침/포털고침 단순 편집 진입(전이 없음) (Priority: Medium)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 부서별 송고에서 `고침(포털제외)`/`포털고침`(우클릭 항목 또는 행 버튼)으로 작성 페이지에 진입하면, THE 시스템 SHALL 작성 페이지 포워딩 + 편집 로드만 수행하고 lifecycle 전이 API(송고/보류/KILL/`applyAction`)를 호출하지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL 고침/포털고침 진입을 데스크 미송고 `편집` 진입과 동일한 단일 편집 컨텍스트(`editArticleId` 보유)로 처리하며, 별도의 "고침 모드" 플래그/상태/라우트 파라미터를 도입하지 않는다.
- **[State-Driven]** WHILE 고침/포털고침으로 진입한 기사가 작성 페이지에 로드된 동안, THE 시스템 SHALL 그 기사의 편집 상태값으로 원래 상태값(`DPS`)을 그대로 채택하며 진입 자체로 상태값을 변경하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 고침/포털고침 진입을 D 권한이 아닌 사용자 또는 DPS 가 아닌 기사에 대해 허용하지 않는다(D 권한 + DPS 게이팅 유지).

#### Acceptance Criteria 포인터

- AC-REV-1 (전이 미발생), AC-REV-2 (고침 모드 플래그 없음), AC-REV-3 (D+DPS 게이팅) — acceptance.md §3

---

### REQ-REGRESSION-GUARD — 데스크 미송고 편집/락 회귀 가드 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 데스크 미송고 우클릭 `편집` 의 기존 동작(작성 페이지 포워딩 + 메뉴 항목 집합 편집/상세보기/이력보기/본문복사/제목만복사)을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL 편집 진입 시 SPEC-NEWS-REVISE-002 의 lockYN 락 계약(`acquireEditLock` 마운트 시 획득, `beforeunload`/`visibilitychange:hidden` + `sendBeacon` 해제)을 그대로 재사용한다.
- **[Ubiquitous]** THE 시스템 SHALL 공통정보 편집 5필드 로드 동작(`commonFromRow` 기반 작성자/엠바고/2차 엠바고 매핑)을 회귀 없이 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본 SPEC 의 진입점/표시 추가로 인해 새로운 락 규칙, lifecycle 전이 규칙, 또는 디자인 토큰을 도입하지 않는다.

#### Acceptance Criteria 포인터

- AC-REG-1 (데스크 미송고 편집 회귀), AC-REG-2 (락 계약 재사용), AC-REG-3 (편집 5필드 회귀) — acceptance.md §4

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (연합뉴스 스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 재사용한다.
- 읽기전용 표시 영역의 라벨색/구분선은 기존 토큰(`--yh-blue`, `--yh-gray-line`)을 사용한다.

### 5.2 접근성 (Accessibility)

- 읽기전용 8필드 영역은 라벨과 값을 명확히 연관시킨다(라벨 텍스트 노출).
- 부서별 송고 우클릭 메뉴 항목은 기존 ContextMenu 의 `menuitem` role/키보드 조작 규약을 그대로 따른다.
- 비활성 항목(고침/포털고침)은 `disabled` 상태로 키보드/스크린리더에 일관되게 노출한다.

### 5.3 회귀 방지

- SPEC-NEWS-REVISE-001~006 의 모든 AC 회귀 없음.
- SPEC-FRONTEND-UI-001 의 4탭 60:40 레이아웃, 우상단 사용자 정보, 상세보기 호출 회귀 없음.
- SPEC-UI-EDITOR-001 의 어댑터 계약(`getMarkup`/`setMarkup`, `markupVersion`) 변경 없음.
- SPEC-AUTH-001 의 R/D/Z 권한 의미/세션 메커니즘 변경 없음.

### 5.4 성능 (Performance)

- 진입점 와이어링/읽기전용 표시는 추가 네트워크 호출 없이 기존 편집 로드(`queryArticles`) 결과를 재사용한다(별도 fetch 추가 금지).

### 5.5 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 구현 사실 (Brownfield Δ 기준점)

> 직접 Read 로 검증한 현재 상태(2026-06-06).

| 파일 | 현재 상태 | Δ |
|------|-----------|---|
| `web/src/view/ViewPage.jsx` `buildContextItems` | 데스크 미송고 `편집` 은 포워딩 wired(L54). 부서별 작성/송고/개인별 수정 공용 메뉴는 `고침(포털제외)`/`포털고침` DISABLED(L73~74), `편집` 항목 없음 | 부서별 송고 분기 신설: `편집` 추가, 고침/포털고침 D+DPS 활성 |
| `web/src/view/ViewPage.jsx` `ArticleRow` | DPS 행 `고침`/`포털고침` 버튼이 `role==='D'` 게이팅으로 렌더되나 onClick 은 `stopPropagation` 만(L161~162) | onClick 에 포워딩 추가(stopPropagation 유지, 게이팅 유지) |
| `web/src/controller/useWriteController.js` | `editArticleId` 로 `queryArticles` → markupVersion + `commonFromRow`(편집 5필드 매핑). 락/Insert·Update 분기 완료 | 읽기전용 8필드 상태 노출 추가(기존 동작 불변) |
| `web/src/view/WritePage.jsx` | `?id` → `editArticleId` → `useWriteController`. 읽기전용 8필드 표시 영역 없음 | 편집 컨텍스트에서 읽기전용 8필드 표시 영역 렌더 |
| `web/src/app/routing.js` `pathForRoute` | `writer.do?id=<id>` 생성(빈 id 는 쿼리 생략) | 변경 없음(재사용) |
| `ContentsVO.md` | 13필드 varchar, PK=기사아이디 | 변경 없음(매핑 근거) |

---

## 7. 영향 영역 (Affected Files)

- `web/src/view/ViewPage.jsx` — 부서별 송고 진입점 3종 와이어링.
- `web/src/view/WritePage.jsx` — 읽기전용 8필드 표시 영역.
- `web/src/controller/useWriteController.js` — 읽기전용 8필드 상태 노출.
- `web/src/styles/yonhap.css` — 읽기전용 영역 스타일(기존 토큰만).
- 테스트: `web/src/view/ViewPage.contextMenu.test.jsx`, `web/src/view/ViewPage.test.jsx`, `web/src/controller/useWriteController.editLoad.test.jsx`, `web/src/view/WritePage.test.jsx`.

---

## 8. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-001~006**: 직전 차수들(Z권한 버튼/상세보기 분리/임베드 위치·삭제/Ctrl+D/Alt+Y/락/Insert·Update 분기 등). 본 SPEC 은 그 위에 부서별 송고 진입점과 읽기전용 필드 표시를 추가하며 기존 AC 를 회귀 없이 유지한다.
- **SPEC-FRONTEND-UI-001**: 조회 4메뉴, 우클릭 메뉴, 작성 페이지 4탭 60:40 레이아웃. 본 SPEC 은 그 위에 부서별 송고 메뉴 항목 + 작성 페이지 읽기전용 영역을 추가.
- **SPEC-UI-EDITOR-001**: 어댑터 계약. 본 SPEC 은 계약 변경 없이 편집 로드 결과를 재사용.
- **SPEC-NEWS-REVISE-002**: lockYN 락 계약 + Insert/Update 분기. 본 SPEC 은 그 계약을 그대로 재사용(새 규칙 없음).
- **SPEC-AUTH-001**: R/D/Z 권한 + 세션. 본 SPEC 의 D 권한 + DPS 게이팅이 이를 따른다.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- 기사 상태값 전이(lifecycle) 발생 또는 "고침 모드" 플래그/별도 상태/별도 라우트 파라미터 도입.
- 수집/배부 시스템 (제작 시스템만; CLAUDE.md "현재 구현 범위는 제작 시스템만").
- 신규 디자인 토큰/CSS 변수 도입.
- 타 SPEC(SPEC-NEWS-REVISE-001~006 및 기타 SPEC) 의 3파일(spec/plan/acceptance) 수정.
- DB 스키마 변경(ContentsVO 13필드는 매핑 근거일 뿐 본 SPEC 은 컬럼을 추가/변경하지 않음).
- 이력보기/송고이력보기/번역/매핑/후속기사작성/계속기사작성/삭제요청/재송 등 다른 DISABLED 메뉴 항목 활성화.
- 새 락 규칙/락 스토어/세션 메커니즘 변경.
- `news.md` 수정(이미 반영됨).
- 코드 구현 (본 SPEC 은 Plan 단계 문서만; Run 단계에서 구현).

---

## 10. Definition of Done

- [ ] 부서별 송고 우클릭 메뉴에 `편집` 항목 추가 + 포워딩 (AC-FWD-1 GREEN)
- [ ] 부서별 송고 우클릭 `고침(포털제외)`/`포털고침` 이 D+DPS 에서 활성 + 포워딩 (AC-FWD-2 GREEN)
- [ ] 부서별 송고 DPS 행 `고침`/`포털고침` 버튼 포워딩 + 전파 차단 (AC-FWD-3 GREEN)
- [ ] 5진입점 모두 동일 `navigate(ROUTES.WRITE, { id })` 경로 (AC-FWD-4 GREEN)
- [ ] 편집 5필드(제목·본문·작성자·엠바고·2차 엠바고) 채움 (AC-MAP-1 GREEN)
- [ ] 읽기전용 8필드 표시 영역 노출 + 편집 불가 (AC-MAP-2 GREEN)
- [ ] 신규 작성 컨텍스트에서 읽기전용 영역 미렌더 (AC-MAP-3 GREEN)
- [ ] 누락 필드 빈 값 안전 표시 (AC-MAP-4 GREEN)
- [ ] 고침/포털고침 진입 시 lifecycle 전이 미발생 (AC-REV-1 GREEN)
- [ ] 고침 모드 플래그 미도입(단일 편집 컨텍스트) (AC-REV-2 GREEN)
- [ ] D 권한 + DPS 게이팅 유지 (AC-REV-3 GREEN)
- [ ] 데스크 미송고 편집/락/공통정보 5필드 회귀 없음 (AC-REG-1, 2, 3 GREEN)
- [ ] 기존 토큰만 사용, 신규 토큰 미도입
- [ ] `npm run test:web` 전체 통과, `npm test` 전체 통과, `npm run build` 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] `news.md` / 본 SPEC 정합 확인 (news.md 미변경 — 이미 반영됨)
- [ ] 기존 SPEC(NEWS-REVISE-001~006, FRONTEND-UI-001, UI-EDITOR-001, AUTH-001) AC 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
