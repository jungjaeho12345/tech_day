---
id: SPEC-NEWS-REVISE-011
version: 0.2.0
status: Completed
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-007
  - SPEC-NEWS-REVISE-008
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-011 — DPS 기사 고침/포털고침 송고·보류 버튼 + DDH 요약줄 정합

## HISTORY

- 2026-06-10 (v0.2.0): Run+Evaluate 완료 — lifecycle DPS 출발 6전이(send→DPS, hold→DDH 사용자 승인) + SPEC-008 미반영 DDH 출발 4전이 보완, WritePage isDps 송고/보류 게이트(KILL 비표시), 진입 게이트 D-only 유지. 신규 테스트 3파일(+23케이스), 구 단언 3건 신규 진실로 갱신. evaluator-active PASS 0.850(vitest 501/501, node 262/262, build 무경고). status Plan→Completed. (MoAI)
- 2026-06-10 (v0.1.0): 최초 작성. `news.md` "# 기사 작성 페이지 내 버튼" 섹션의 미흡수 델타 2건을 EARS 명세로 흡수.
  - **델타 A (요약줄, Δ-only 재기술)**: 기존 `- 송고/보류 버튼은 권한 R, D 그리고 RDS 기사일 떄 표현한다.` → `- 송고/보류/KILL 버튼은 권한 R, D 그리고 RDS, DDH 기사일 떄 표현한다.` 로 변경됨. 이 줄은 **요약줄**이며, 더 구체적인 인접줄들이 우선한다. 구체줄 분석:
    - (a) `KILL 버튼은 권한 R 그리고 RDS 기사일 때 표현한다.` (불변) → RDS 의 KILL 은 R(+표준 Z 줄에 의한 Z) 한정 유지. 코드 `web/src/view/WritePage.jsx` L878 (KILL: R|Z + isRds + !isDraft) 와 정합.
    - (b) `데스크 보류(DDH) 기사를 편집할 때는 송고와 KILL 버튼을 권한 D, Z에게 표현한다. 보류 버튼은 표현하지 않는다. 권한 R에게는 어떤 버튼도 표현하지 않는다.` (불변) + **SPEC-NEWS-REVISE-008 (2026-06-06 사용자 승인 도메인 결정)** → DDH 는 D/Z 한정·보류 비표시·R 전버튼 비표시 유지. 코드 `WritePage.jsx` L882-889 (isDdh + D|Z → 송고·KILL, 보류 없음) 로 **이미 구현됨**.
    - 따라서 요약줄(델타 A)의 유일한 신규 의미는 **요약줄이 DDH 를 비로소 명시적으로 포함**한다는 점뿐이며, 이는 SPEC-008 로 이미 구현 완료. **Δ-only 재기술**로 처리한다(규칙 변경 아님). 본 SPEC 은 "R 이 DDH 에서 버튼을 본다" 또는 "D 가 RDS 에서 KILL 을 본다" 를 **명세하지 않는다** — 그것은 구체줄·SPEC-008 승인 결정과 모순되기 때문이다.
  - **델타 B (신규 동작)**: `- 송고/보류 버튼은 권한 R, D 그리고 DPS 기사가 포털고침 또는 고침버튼을 눌렀을 때 표현한다.` 줄이 **신규 추가**됨. DPS(배부 대상) 기사를 고침(포털제외)/포털고침으로 열었을 때 송고/보류 버튼을 노출한다(KILL 은 미언급 → 비표시). 본 SPEC 의 1차 흡수 대상이다.
- 정합 결정 근거(델타 B):
  - **진입모드 전파 부재 → 상태값 기준 게이팅**: `web/src/view/ViewPage.jsx`(편집/고침/포털고침 모두 `navigate(ROUTES.WRITE, { id })` — `{ id }` 만 전달, 모드 인자 없음)와 `useWriteController.editLoad.test.jsx` AC-REV-2(고침 전용 모드 플래그 무도입, 진입점별 컨트롤러 반환키 동일) 가 "고침 모드" 플래그를 명시적으로 금지(SPEC-NEWS-REVISE-007 REQ-REVISE-SEMANTICS). 따라서 버튼 게이트는 **진입모드가 아니라 로드된 기사 상태값(=DPS)** 으로 판정한다. DPS 기사가 작성 페이지에 진입하는 경로는 부서별 송고 메뉴의 고침/포털고침(또는 편집) 포워딩뿐이므로, 상태값 DPS 가 "고침/포털고침 진입" 의 충실한 대리지표다. 모드 플래그 도입은 SPEC-007 회귀이므로 금지.
  - **고침/포털고침 진입 게이트는 D 한정 유지(R 로 확대하지 않음)**: news.md 불변줄 L86("고침(포털제외)/포털고침은 상태값이 DPS인 기사에서 D 권한 사용자에게만 활성화") + SPEC-007 REQ-FWD-ENTRYPOINTS + 도메인 스킬 §2.1 L149("상태값이 DPS 일 때 D 권한 사용자만 고침/포털고침 메뉴 사용 가능") 가 모두 D-only 를 못박는다. 오케스트레이터 지시 #3 의 규칙("news.md 가 source-of-truth 이므로 도메인 스킬이 반박하지 않는 한 R 로 확대")에서, **도메인 스킬이 명시적으로 반박**하므로 진입 게이트를 확대하지 않는다. 결과적으로 델타 B 의 "권한 R" 은 정상 진입경로로는 도달 불가(공허 표현)다. 버튼 가시성 게이트는 news.md 문자 그대로 R, D 를 포함하되, 진입 D-only 로 인해 실사용은 D(및 표준 Z 줄·Z=D-mirror) 에 한정된다.
  - **KILL 비표시(델타 B)**: 신규줄은 송고/보류만 언급 → DPS 고침/포털고침 컨텍스트에서 KILL 은 표시하지 않는다(Unwanted).
  - **lifecycle DPS-출발 전이 미정의 → 송고는 DPS 재송고로 도출(잠정), 보류 결과상태는 OPEN(블로커)**: `src/services/lifecycle.js` TRANSITIONS 에 DPS 를 source 로 하는 전이가 **전무**하다(RDS 6 + Z-mirror 3 + SPEC-008 DDH 4 만). news.md 생애주기 절(L161-169)·도메인 스킬 §2.2 어디에도 DPS-출발 전이가 정의돼 있지 않다. 송고(고침 재송고)는 도메인상 "DPS 유지(재배부)" 가 유일한 정합 도출이라 잠정 명세하나, **보류의 결과상태는 도메인 사실로 결정 불가**하여 §11 Open Decision + 보고서 블로커로 상정한다. 본 SPEC 의 버튼 가시성·진입 게이트·KILL 비표시·전이 미발생(진입) REQ 는 결정 완료이며, lifecycle 결과상태 REQ 만 사용자 결정에 의존한다.

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-011 |
| 제목 | DPS 기사 고침/포털고침 송고·보류 버튼 + DDH 요약줄 정합 |
| 상태 | Plan |
| 생성일 | 2026-06-10 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001/002/003/007/008, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001, SPEC-AUTH-001 |
| 영향 페이지 | `writer.do` (기사 작성/편집), `list.do` (기사 조회 — 부서별 송고) |
| 작업 모드 | Brownfield 확장 (Δ-only, 프론트엔드 버튼 게이트 + lifecycle 전이표) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

`news.md` "# 기사 작성 페이지 내 버튼" 섹션의 미흡수 델타 2건을 코드/테스트에 정합되도록 정식 명세화한다.

- **델타 A** — 요약줄이 `송고/보류 ... RDS` → `송고/보류/KILL ... RDS, DDH` 로 변경. HISTORY 분석대로 구체줄·SPEC-008 승인 결정이 우선하므로 **Δ-only 재기술**(이미 구현 완료, 규칙 변경 아님)이다.
- **델타 B** — `송고/보류 버튼은 권한 R, D 그리고 DPS 기사가 포털고침 또는 고침버튼을 눌렀을 때 표현한다.` 신규줄. **신규 동작**으로, DPS 기사를 고침/포털고침으로 연 작성 페이지에 송고/보류 버튼을 노출한다(KILL 비표시).

`why`: news.md 가 시스템의 source-of-truth 이며, DPS 기사의 고침/포털고침 재송고/보류 동작이 신규 정의되었다. 정합 명세 없이 구현하면 (a) 진입모드 구분을 위해 SPEC-007 이 금지한 "고침 모드" 플래그를 도입하는 회귀, (b) DPS-출발 lifecycle 전이가 미정의되어 송고/보류 버튼이 invalid-transition 으로 무력화(송고→DPS, 보류→DDH 전이 추가로 해소), (c) 고침/포털고침 진입 게이트가 의도치 않게 R 로 새는 회귀, (d) 요약줄을 곧이곧대로 읽어 DDH 에서 R 버튼을 노출하거나 RDS 에서 D 의 KILL 을 노출하는 SPEC-008/구체줄 위반이 발생한다. 본 SPEC 은 이를 EARS 형식으로 고정한다.

본 SPEC 은 기존 SPEC(NEWS-REVISE-001/002/003/007/008, BACKEND-CORE-001, FRONTEND-UI-001, AUTH-001) 계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- **델타 A (Δ-only 재기술)**: 요약줄의 DDH 포함은 SPEC-008 로 이미 구현 완료임을 회귀 가드로 명문화. 신규 버튼 규칙을 추가하지 않는다.
- **델타 B (신규 동작)**:
  - `web/src/view/WritePage.jsx` 버튼 게이트에 DPS 분기 추가: 로드된 기사 상태값이 DPS 이고 권한이 R/D/Z 일 때 송고/보류 버튼 노출. KILL 비표시.
  - DPS 송고에도 RDS 송고와 동일한 송고 가드(본문 끝 "(끝)" 마커 가드, 제목 가드, `window.confirm` 확인창) 적용.
  - `src/services/lifecycle.js` TRANSITIONS 에 DPS-출발 전이 추가: 송고 `DPS|R/D/Z|send`→**DPS 유지(재송고/재배부)**, 보류 `DPS|R/D/Z|hold`→**DDH**(2026-06-10 사용자 승인, §11). `DPS|*|kill` 은 미정의(거부) 유지.
  - 진입 게이트(고침/포털고침 활성)는 D-only 유지(SPEC-007/news.md L86/도메인 스킬). 본 SPEC 은 진입 게이트를 변경하지 않는다.

### 2.2 제외 (Out of Scope) — Exclusions 절(§10) 참조

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 DPS 기사 고침/포털고침 송고 (델타 B, 신규)

- D 권한 사용자가 부서별 송고 메뉴(DPS 기사만 조회)에서 DPS 기사를 우클릭하여 고침(포털제외) 또는 포털고침을 누른다(또는 편집).
- 작성 페이지로 포워딩되어 ContentsVO 가 매핑되고, 진입만으로는 상태값이 전이하지 않는다(SPEC-007 REQ-REVISE-SEMANTICS).
- 작성 페이지에 **송고/보류 버튼이 노출**된다. KILL 버튼은 노출되지 않는다.
- 본문 끝에 "(끝)" 이 있고 제목이 있을 때 송고를 누르면 확인창 후 송고된다. lifecycle 전이 `DPS|D|send`→`DPS`(재송고) 가 적용되어 상태값은 DPS 로 유지된다.

### 3.2 DPS 기사 고침/포털고침 보류 (델타 B, 신규 — 결과상태 = DDH)

- 같은 컨텍스트에서 보류 버튼을 누르면 확인창 후 보류 요청이 발생한다.
- lifecycle 전이 `DPS|R/D/Z|hold`→`DDH`(2026-06-10 사용자 승인, §11) 가 적용되어 상태값이 DDH 로 전이된다. 이후 그 기사는 SPEC-008 의 DDH 규칙(D/Z 재송고·KILL, 보류 비표시, R 전버튼 비표시)을 따른다.

### 3.3 RDS / DDH 회귀 (델타 A)

- RDS 기사: 송고/보류는 R|D|Z, KILL 은 R|Z(+`!isDraft`) — 기존 매트릭스 불변.
- DDH 기사: 송고/KILL 은 D|Z, 보류 비표시, R 전버튼 비표시 — SPEC-008 불변.
- 요약줄 변경(델타 A)은 위 두 매트릭스에 어떤 변화도 주지 않는다.

### 3.4 진입 게이트 제한 (불변)

- R/Z 사용자는 부서별 송고에서 고침/포털고침을 트리거할 수 없다(disabled 유지 — SPEC-007/news.md L86/도메인 스킬). 따라서 정상 경로로 DPS 작성 페이지에 도달하는 권한은 D(및 부서별 송고 `편집` 항목 경로)뿐이다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-DPS-BUTTONS — DPS 고침/포털고침 송고·보류 버튼 노출 (Priority: High)

#### EARS 문장

- **[State-Driven]** WHILE 작성 페이지에 로드된 기사의 상태값이 `DPS` 이고 사용자 권한이 `R`, `D`, 또는 `Z` 인 동안, THE 시스템 SHALL 송고 버튼과 보류 버튼을 노출한다.
- **[Unwanted]** THE 시스템 SHALL NOT 작성 페이지에 로드된 기사의 상태값이 `DPS` 인 동안 KILL 버튼을 표시하지 않는다(델타 B 신규줄은 송고/보류만 명시).
- **[Ubiquitous]** THE 시스템 SHALL DPS 송고에도 기존 송고 가드(본문 끝 "(끝)" 마커 가드, 제목 가드, `window.confirm` 확인창)를 RDS 송고와 동일하게 적용한다.
- **[Unwanted]** THE 시스템 SHALL NOT DPS 버튼 노출을 위해 "고침 모드" 플래그/별도 상태/별도 라우트 파라미터를 도입하지 않는다(SPEC-007 REQ-REVISE-SEMANTICS 회귀 금지 — 게이트는 로드된 기사 상태값으로만 판정).

#### Acceptance Criteria 포인터

- AC-DPS-BTN-1 (DPS + R/D/Z 송고·보류 노출), AC-DPS-BTN-2 (DPS KILL 비표시), AC-DPS-BTN-3 (DPS 송고 가드 적용), AC-DPS-BTN-4 (모드 플래그 무도입 — 상태값 게이트) — acceptance.md §1

---

### REQ-DPS-ENTRY-GATE — 고침/포털고침 진입 게이트 D 한정 유지 (Priority: High)

#### EARS 문장

- **[State-Driven]** WHILE 기사 상태값이 `DPS` 이고 사용자 권한이 `D` 인 동안, THE 시스템 SHALL 부서별 송고 우클릭 메뉴의 `고침(포털제외)`/`포털고침` 을 활성화하고 작성 페이지로 포워딩한다(SPEC-007 계약 그대로).
- **[Unwanted]** IF 사용자 권한이 `R` 또는 `Z` 이거나 기사 상태값이 `DPS` 가 아니면, THEN THE 시스템 SHALL `고침(포털제외)`/`포털고침` 을 비활성(disabled)으로 유지하고 포워딩하지 않는다(진입 게이트를 R/Z 로 확대하지 않는다 — news.md L86 + 도메인 스킬 §2.1 + SPEC-007).
- **[Ubiquitous]** THE 시스템 SHALL 델타 B 신규줄의 "권한 R" 버튼 가시성을 진입 게이트 확대로 해석하지 않는다 — R 은 정상 진입경로로 DPS 작성 페이지에 도달할 수 없으므로 그 가시성은 공허(unreachable)하다.

#### Acceptance Criteria 포인터

- AC-DPS-GATE-1 (D+DPS 진입 활성/포워딩 회귀), AC-DPS-GATE-2 (R/Z 진입 비활성 유지) — acceptance.md §2

---

### REQ-DPS-LIFECYCLE — DPS-출발 송고·보류 전이 추가 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN DPS 기사에 권한 `R`, `D`, 또는 `Z` 가 `send` 액션을 적용하면, THE 시스템 SHALL lifecycle 전이 `DPS|R|send`→`DPS` / `DPS|D|send`→`DPS` / `DPS|Z|send`→`DPS`(재송고·재배부) 를 적용하여 상태값을 `DPS` 로 유지한다.
- **[Event-Driven]** WHEN DPS 기사에 권한 `R`, `D`, 또는 `Z` 가 `hold` 액션을 적용하면, THE 시스템 SHALL lifecycle 전이 `DPS|R|hold`→`DDH` / `DPS|D|hold`→`DDH` / `DPS|Z|hold`→`DDH`(2026-06-10 사용자 승인) 를 적용하여 상태값을 `DDH` 로 전이한다.
- **[Ubiquitous]** THE 시스템 SHALL `DPS|*|hold` 로 `DDH` 가 된 기사를 이후 기존 DDH 규칙(SPEC-008: D/Z 재송고·KILL, 보류 비표시, R 전버튼 비표시 + DDH 출발 전이)을 그대로 따르게 한다(출처와 무관하게 DDH 단일 상태로 통합).
- **[Unwanted]** IF DPS 기사에 어떤 권한이든 `kill` 액션을 적용하면(`DPS|*|kill` 미정의 유지), THEN THE 시스템 SHALL 그 전이를 거부하고(`{ ok: false }`/invalid-transition) Contents.status 를 `DPS` 로 그대로 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 기존 RDS 소스 6 전이, SPEC-NEWS-REVISE-001 D-6 Z-mirror 3 전이, SPEC-008 DDH 출발 4 전이를 변경하지 않는다(전이표 추가만, 기존 행 불변).

> 주: `send`→`DPS`(재송고) 와 `hold`→`DDH`(데스크 보류) 매핑은 도메인 사실(DPS = 배부 대상; 고침 = 재송고; 데스크 보류 = DDH)에 기반하며, 보류 결과상태(DDH)는 2026-06-10 사용자 승인으로 확정되었다(§11).

#### Acceptance Criteria 포인터

- AC-DPS-LC-1 (DPS|R/D/Z|send → DPS), AC-DPS-LC-HOLD (DPS|R/D/Z|hold → DDH + 이후 DDH 매트릭스 정합), AC-DPS-LC-2 (DPS|*|kill 거부 + DB 무변경), AC-DPS-LC-3 (기존 13전이 불변) — acceptance.md §3

---

### REQ-SUMMARY-LINE-RECONCILE — 요약줄(델타 A) Δ-only 재기술 회귀 가드 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL RDS 기사의 버튼 매트릭스(송고/보류: R|D|Z, KILL: R|Z + `!isDraft`)를 요약줄 변경과 무관하게 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL DDH 기사의 버튼 매트릭스(송고/KILL: D|Z, 보류 비표시, R 전버튼 비표시 — SPEC-008)를 요약줄 변경과 무관하게 회귀 없이 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 요약줄(`송고/보류/KILL ... RDS, DDH`)을 곧이곧대로 적용하여 DDH 기사에서 권한 `R` 에게 버튼을 노출하지 않는다(구체줄·SPEC-008 승인 결정 우선).
- **[Unwanted]** THE 시스템 SHALL NOT 요약줄을 곧이곧대로 적용하여 RDS 기사에서 권한 `D` 에게 KILL 버튼을 노출하지 않는다(구체줄 `KILL 버튼은 권한 R 그리고 RDS` 우선).

#### Acceptance Criteria 포인터

- AC-SUM-1 (RDS 매트릭스 불변), AC-SUM-2 (DDH 매트릭스 불변), AC-SUM-3 (DDH R 비노출), AC-SUM-4 (RDS D-KILL 비노출) — acceptance.md §4

---

### REQ-REGRESSION-GUARD — 진입/락/전이/매핑 회귀 가드 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-007 의 진입점(부서별 송고 편집/고침/포털고침 포워딩 D-only) + ContentsVO 읽기전용 8필드 표시 + 고침/포털고침 진입 무전이 시맨틱을 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-008 의 편집 잠금 탭 생존 유지 + DDH 전이/버튼 게이트를 회귀 없이 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-002 락 계약(acquire/release/sendBeacon, 30분 stale, same-session 멱등, 타 세션 'locked' 거부)을 회귀 없이 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본 SPEC 으로 인해 새로운 락 규칙/락 스토어/세션 메커니즘/디자인 토큰/버튼 스타일을 도입하지 않는다.

#### Acceptance Criteria 포인터

- AC-REG-1 (007 회귀), AC-REG-2 (008 회귀), AC-REG-3 (002 락 계약 재사용) — acceptance.md §5

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 재사용한다.
- DPS 송고/보류 버튼은 기존 RDS/DDH 버튼과 동일한 클래스(`yh-btn--primary`/`yh-btn--hold`)를 재사용한다(신규 버튼 스타일 금지).

### 5.2 접근성 (Accessibility)

- DPS 편집 시 노출되는 송고/보류 버튼은 기존 RDS 버튼과 동일한 마크업/role/키보드 조작/확인창을 따른다.
- 락 거부 배너(`role="alert"` `aria-live="assertive"`)는 SPEC-NEWS-REVISE-002 동작을 그대로 따른다.

### 5.3 회귀 방지

- SPEC-NEWS-REVISE-001/002/003/007/008 의 모든 AC 회귀 없음.
- SPEC-BACKEND-CORE-001 lifecycle reducer 의 RDS 소스 6 + Z-mirror 3 + DDH 4 전이 불변.
- SPEC-FRONTEND-UI-001 의 4탭 60:40 레이아웃·우상단 사용자 정보·상세보기 호출 회귀 없음.
- SPEC-AUTH-001 의 R/D/Z 권한 의미/세션 메커니즘 변경 없음.

### 5.4 성능 (Performance)

- DPS 버튼 게이트는 추가 네트워크 호출 없이 기존 편집 로드 결과(`queryArticles`)와 로드된 상태값을 재사용한다.
- DPS 송고 전이는 기존 `applyAction` 경로를 재사용하며 추가 폴링/타이머를 도입하지 않는다.

### 5.5 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 구현 사실 (Brownfield Δ 기준점)

> 직접 Read 로 검증한 현재 상태(2026-06-10).

| 파일 | 현재 상태 | Δ |
|------|-----------|---|
| `web/src/view/WritePage.jsx` (L814-816, L870-890) | `isRds = ctrl.status === 'RDS'`, `isDdh = ctrl.status === 'DDH'`. 송고/보류: R\|D\|Z + isRds. KILL: R\|Z + isRds + `!isDraft`. DDH + (D\|Z): 송고·KILL(보류 없음). **DPS 분기 없음** → DPS 면 어떤 버튼도 미렌더 | DPS + (R\|D\|Z): 송고·보류 노출(KILL 비표시). 기존 RDS/DDH 분기 불변 |
| `src/services/lifecycle.js` TRANSITIONS (L9-21) | RDS 소스 6 + Z-mirror 3 정의(현 파일). SPEC-008 의 DDH 출발 4 전이는 별도 SPEC(미반영분일 수 있음). DPS 는 source 로 미정의(invalid-transition) | DPS 출발 송고 3 + 보류 3 전이 추가: `DPS\|R/D/Z\|send`→`DPS`, `DPS\|R/D/Z\|hold`→`DDH`(2026-06-10 승인). `DPS\|*\|kill` 는 미정의 유지(거부) |
| `web/src/view/ViewPage.jsx` (L52) | `canDpsEdit = article.status === 'DPS' && role === 'D'` — 고침/포털고침 D-only 진입 게이트 | 변경 없음(D-only 유지가 본 SPEC 의 정합 결정) |
| `web/src/controller/useWriteController.js` (L268-279, L517) | `editArticleId` 로 load + `setStatus(row.status)` 로 로드된 상태값 채택. `isDraft: articleId === 'A-DRAFT'`. 모드 플래그 없음 | 변경 없음(상태값 기준 게이트의 근거 — `ctrl.status === 'DPS'`) |

---

## 7. 영향 영역 (Affected Files)

- `web/src/view/WritePage.jsx` — DPS 버튼 게이트(송고/보류 on R\|D\|Z, KILL 비표시) 추가.
- `src/services/lifecycle.js` — DPS 출발 송고 3 전이(→DPS) + 보류 3 전이(→DDH) 추가.
- 테스트: `test/lifecycleRule.test.js`(DPS 송고·보류 전이 가드), `web/src/view/WritePage.test.jsx`(DPS 버튼 게이트), 필요 시 `web/src/view/WritePage.dps.test.jsx`(신규).

---

## 8. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-007**: 부서별 송고 진입점(고침/포털고침 D-only 포워딩) + 고침/포털고침 무전이 진입 시맨틱 + 모드 플래그 무도입. 본 SPEC 은 그 진입점 위에서 DPS 버튼/전이를 추가하며 007 의 D-only·무모드플래그 계약을 그대로 따른다.
- **SPEC-NEWS-REVISE-008**: DDH 전이/버튼 게이트 + 편집 잠금. 본 SPEC 의 요약줄(델타 A) 정합은 008 의 DDH 결정을 회귀 가드로 재확인한다.
- **SPEC-NEWS-REVISE-002**: lockYN 락 계약. 본 SPEC 은 그대로 재사용(새 규칙 없음).
- **SPEC-NEWS-REVISE-003**: lifecycle 전이표 회귀 가드(`test/lifecycleRule.test.js`). 본 SPEC 은 DPS 송고(→DPS)·보류(→DDH) 전이를 추가하되 기존 전이를 불변으로 유지한다.
- **SPEC-BACKEND-CORE-001**: lifecycle reducer. 본 SPEC 의 DPS 전이가 이를 확장한다(기존 행 불변).
- **SPEC-FRONTEND-UI-001 / SPEC-AUTH-001**: 작성 페이지 버튼·레이아웃 / R/D/Z 권한·세션. 본 SPEC 의 DPS 버튼 노출이 이를 확장(RDS/DDH 매트릭스 불변), 권한 의미 불변.

---

## 9. (예비)

> 본 절은 의도적으로 비워둔다.

---

## 10. Exclusions (What NOT to Build) — 명시적 비목표

- **요약줄(델타 A)을 곧이곧대로 적용한 신규 버튼 규칙** — DDH 의 R 노출, RDS 의 D-KILL 노출 등은 구체줄·SPEC-008 승인 결정과 모순이므로 명세/구현하지 않는다(Δ-only 재기술).
- **고침/포털고침 진입 게이트의 R/Z 확대** — D-only 유지(news.md L86 + 도메인 스킬 + SPEC-007). 진입 게이트를 변경하지 않는다.
- **"고침 모드" 플래그/별도 상태/별도 라우트 파라미터 도입** — SPEC-007 AC-REV-2 회귀이므로 금지. 게이트는 로드된 기사 상태값으로만 판정.
- **DPS KILL 전이/버튼** — 델타 B 신규줄은 송고/보류만 언급. `DPS|*|kill` 미정의 유지, KILL 버튼 비표시.
- **DPS 보류의 신규 상태 도입** — `DPS|*|hold` 는 DDH 로 통합(2026-06-10 결정 옵션 1). 6-상태 외 신규 상태(옵션 2)는 도입하지 않는다.
- **DPS 외 다른 막다른 상태(RRH/RRK/DDK)의 신규 전이 추가.**
- 새 락 규칙/락 스토어/세션 메커니즘 변경, 새 폴링/타이머 도입.
- 신규 디자인 토큰/CSS 변수/버튼 스타일 도입.
- 수집/배부 시스템 (기사 작성기만; CLAUDE.md "현재 구현 범위는 기사 작성기만").
- DB 스키마 변경(기존 컬럼 재사용; 컬럼 추가/변경 없음, DB 내용 삭제 없음).
- `news.md` 수정(본 SPEC/Run 은 news.md 를 수정하지 않는다).
- 타 SPEC(SPEC-NEWS-REVISE-001~010 및 기타 SPEC)의 3파일(spec/plan/acceptance) 수정.
- 코드 구현 (본 SPEC 은 Plan 단계 문서만; Run 단계에서 구현).

---

## 11. Resolved Decision — DPS-출발 lifecycle 결과상태 (2026-06-10 사용자 승인)

DPS 기사에 대한 송고/보류 액션의 결과상태는 `news.md` 생애주기 절·도메인 스킬 §2.2 에 명시돼 있지 않아 v0.1.0 에서 블로커로 상정했으나, **2026-06-10 사용자 승인(AskUserQuestion 경유)으로 확정**되었다.

- **송고(`DPS|R/D/Z|send`) → DPS**: "DPS = 배부 대상" + "고침 = 재송고" 로부터 재송고·재배부로 상태값 유지. (확정)
- **보류(`DPS|R/D/Z|hold`) → DDH** (옵션 1 채택, 확정): DPS 를 데스크 보류로 끌어내림. 도메인상 데스크 보류 = DDH 와 동일 의미이므로 기존 DDH 상태로 통합한다. DDH 로 전이된 기사는 출처(원래 RDS 보류 vs DPS 보류)와 무관하게 기존 DDH 규칙(SPEC-008: D/Z 재송고·KILL, 보류 비표시, R 전버튼 비표시 + DDH 출발 전이)을 그대로 따른다.

기각된 대안: (옵션 2) 신규 상태 도입 — 6-상태 생애주기·스키마 확장 부담으로 기각. (옵션 3) 보류 미지원 — news.md 델타 B 의 보류 버튼 명시와 충돌하므로 기각.

본 결정은 REQ-DPS-LIFECYCLE 의 hold 전이 3행으로 정식 반영되었고, Run 단계는 송고·보류 전이를 모두 구현한다(추가 블로커 없음).

---

## 12. Definition of Done

- [ ] DPS + R/D/Z: 송고·보류 버튼 노출, KILL 비표시 (AC-DPS-BTN-1, 2 GREEN)
- [ ] DPS 송고 (끝)·제목·확인창 가드 적용 (AC-DPS-BTN-3 GREEN)
- [ ] DPS 버튼 게이트가 상태값 기준(모드 플래그 무도입) (AC-DPS-BTN-4 GREEN)
- [ ] D+DPS 고침/포털고침 진입 활성/포워딩 회귀 없음, R/Z 진입 비활성 유지 (AC-DPS-GATE-1, 2 GREEN)
- [ ] DPS|R/D/Z|send → DPS 전이 (AC-DPS-LC-1 GREEN)
- [ ] DPS|R/D/Z|hold → DDH 전이(2026-06-10 승인) + 이후 DDH 매트릭스 정합 (AC-DPS-LC-HOLD GREEN)
- [ ] DPS|*|kill 거부 + DB 무변경 (AC-DPS-LC-2 GREEN)
- [ ] 기존 RDS 6 + Z-mirror 3 + DDH 4 전이 불변 (AC-DPS-LC-3 GREEN)
- [ ] RDS 매트릭스 불변, DDH 매트릭스 불변 (AC-SUM-1, 2 GREEN)
- [ ] DDH R 비노출, RDS D-KILL 비노출 (AC-SUM-3, 4 GREEN)
- [ ] 007/008/002 회귀 없음 (AC-REG-1, 2, 3 GREEN)
- [ ] 기존 토큰만 사용, 신규 토큰 미도입
- [ ] `npm test` 전체 통과, `npm run test:web` 전체 통과, `npm run build` 무경고
- [ ] lock 관련 테스트는 now 고정 전달(30분 stale 시한폭탄 방지)
- [ ] §11 DPS 보류 결과상태 = DDH (2026-06-10 사용자 승인) 반영 완료
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] `news.md` 미변경 확인
- [ ] 기존 SPEC(NEWS-REVISE-001~010, BACKEND-CORE-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.2.0
Status: Completed
Last Updated: 2026-06-10
