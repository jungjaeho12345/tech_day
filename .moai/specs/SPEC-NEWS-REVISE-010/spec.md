---
id: SPEC-NEWS-REVISE-010
version: 0.2.0
status: Completed
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
  - SPEC-EDIT-LOCK-001
  - SPEC-UI-EDITOR-001
---

# SPEC-NEWS-REVISE-010 — news.md 미흡수 항목 1급 명세화 (조회 목록 페이징 / 세션 sliding 만료 / 행 클릭 상세 새창)

## HISTORY

- 2026-06-10 (v0.2.0): Build+Evaluate 완료 — AC 17건 전수 회귀 잠금 테스트 등재(ViewPage.test.jsx +195, sessionService.test.js +52, serverAuthWiring.test.js +62), evaluator-active PASS 0.855(Must-Pass 3종 통과: vitest 489/489, node 251/251, build 무경고). status Plan→Completed. (MoAI)
- 2026-06-10 (v0.1.0): 최초 작성. `news.md` 전 항목을 기존 SPEC(SPEC-NEWS-REVISE-001~009, SPEC-FRONTEND-UI-001, SPEC-UI-EDITOR-001, SPEC-AUTH-001, SPEC-BACKEND-CORE-001, SPEC-EDIT-LOCK-001, SPEC-DB-FOUNDATION-001)의 REQ/HISTORY와 대조한 결과, **1급(first-class) EARS REQ로 명세되지 않고 보조 참조/Exclusion으로만 다뤄진** 3개 항목을 식별하여 흡수한다. 세 항목 모두 이미 코드에 구현되어 동작 중이므로 **Brownfield Δ-only — 회귀 가드 + 명세 잠금**으로 정식 등재한다. 새 동작을 추가하지 않으며, 구현된 동작의 회귀를 막는 명세 잠금만 추가한다. (manager-spec)
  - **REQ-LIST-PAGINATION** ← `news.md` L92 "기사는 10개씩 보여주며 페이징 처리 해줘". 미반영 근거: `SPEC-FRONTEND-UI-001` REQ-FE-VIEW-008/011 은 목록의 **컬럼 구성**만 1급으로 규정하고 페이징은 침묵. `SPEC-BACKEND-CORE-001` L206, `SPEC-NEWS-REVISE-002` L403, `SPEC-NEWS-REVISE-003` L91/L416 은 **"글기사 탭(검색 결과) 페이징"** 을 Exclusion(Run 단계 소관)으로만 언급 — 이는 조회 목록 4메뉴의 페이징과 무관한 별개 영역이다. 구현체: `web/src/view/ViewPage.jsx`(`PAGE_SIZE = 10`, `slice`, `data-testid="page-prev"/"page-next"/"page-indicator"`).
  - **REQ-SESSION-SLIDING** ← `news.md` L101~104 "세션 정책"(1시간 무동작 만료 + sliding 갱신 + 로그아웃 전까지 유지 + F5 생존). 미반영 근거: `SPEC-AUTH-001` REQ-AUTH-GUARD-003 은 **"만료된 세션을 미인증으로 취급"** 한다는 결과만 1급으로 규정하고, **1시간 idle 임계값 · 활동 기반 sliding 갱신 · 새로고침 생존** 의 구체 정책은 EARS REQ로 명세되지 않았다(REQ-AUTH-SESS-001~004 도 생성/쿠키/로그아웃만 다룸). `SPEC-EDIT-LOCK-001` 의 30분 TTL 은 **편집 잠금(lock)** 의 idle 만료이지 **세션** 만료가 아니다. 구현체: `server/index.js`(`touchSession` — "1h sliding idle window" 주석 L74~75/193/224), `src/services/sessionService.js`(`createSessionService({ ttlMs, now })`, `touchSession`, `validateSession`).
  - **REQ-ROW-CLICK-DETAIL** ← `news.md` L91 "기사를 클릭하면 새로운 창에서 기사의 제목, 내용, 공통정보 내용을 볼 수 있다". 미반영 근거: `SPEC-NEWS-REVISE-001`(REQ-DETAIL-LAYOUT-SPLIT) 과 `SPEC-NEWS-REVISE-003`(REQ-DETAIL-BODY-EMPHASIS) 은 **우클릭 → 상세보기** 새창의 *레이아웃/폰트*만 1급으로 규정한다. **목록 행 자체를 클릭하는 진입점**(우클릭 컨텍스트 메뉴와 별개)은 어떤 SPEC 에도 1급 REQ 가 없다. 구현체: `web/src/view/ViewPage.jsx`(`openArticleDetail` → `window.open`, 행 `onClick={openDetail}`).

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-010 |
| 제목 | news.md 미흡수 항목 1급 명세화 (조회 목록 페이징 / 세션 sliding 만료 / 행 클릭 상세 새창) |
| 상태 | Completed |
| 생성일 | 2026-06-10 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-FRONTEND-UI-001, SPEC-AUTH-001, SPEC-EDIT-LOCK-001, SPEC-UI-EDITOR-001 |
| 영향 페이지 | `list.do` (기사 조회 — 4메뉴 목록 + 행 클릭 상세 새창), 서버 세션 계층 |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only, 회귀 가드 + 명세 잠금) |

---

## 1. 목적 (Goal)

`news.md`(시스템 source-of-truth)의 다음 3개 동작 규칙은 **이미 코드에 구현되어 동작 중**이나, 기존 SPEC 군에서 **1급 EARS 요구사항으로 잠겨 있지 않다**(보조 참조 또는 별개 영역 Exclusion 으로만 언급됨). 명세 공백 상태에서 회귀가 발생하면 source-of-truth 위반을 탐지할 1급 단언이 없으므로, 본 SPEC 은 그 공백을 EARS 형식으로 정식 잠금한다.

1. **조회 목록 페이징 (10개/페이지)** — 기사 조회 페이지 4개 메뉴(데스크 미송고/부서별 작성/부서별 송고/개인별 수정) 목록은 한 페이지에 10개씩 표시하고 페이지 이동 컨트롤을 제공한다.
2. **세션 sliding idle 만료 정책** — 인증 세션은 1시간 무동작 시 만료되며, 인증된 활동(요청/액션/저장/새로고침)이 있을 때마다 만료 시점이 갱신(sliding)되어 활동이 있는 한 무한 유지된다. 로그아웃 전까지(활동이 있는 한) 세션이 유지되고, 새로고침(F5)은 활동으로 간주되어 세션을 끊지 않는다.
3. **행 클릭 상세 새창** — 조회 목록의 기사 행 자체를 클릭하면(우클릭 상세보기와 동일한 진입 콘텐츠) 새 창에서 제목/본문/공통정보를 표시한다.

`why`: 본 SPEC 은 신규 기능을 도입하지 않는다. 이미 구현·검증된 동작이 `news.md` 와 정합함을 1급 EARS 로 고정하여, 향후 리팩터링/회귀가 source-of-truth 를 깨뜨릴 때 테스트가 즉시 적발하도록 만든다(명세 잠금).

---

## 2. 범위 (Scope)

### 본 SPEC 이 잠그는 것 (IN)

- `list.do` 조회 목록 4메뉴 공통 페이징 동작(페이지 크기 10, 페이지 이동 컨트롤, 메뉴/조회 전환 시 1페이지 리셋, 페이지 수 경계 보정).
- 인증 세션의 1시간 sliding idle 만료 정책(만료 임계, 활동 기반 갱신, 새로고침 생존).
- 조회 목록 행 클릭 → 상세 새창 진입점(우클릭 상세보기와 동일 콘텐츠).

### 본 SPEC 이 잠그지 않는 것 (OUT — 아래 `## Exclusions` 참조)

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 조회 목록 페이징 — 11건 이상일 때 페이지 분할
- 사용자가 `list.do` 의 임의 메뉴(예: 데스크 미송고)에 진입한다. 해당 메뉴의 기사가 23건 조회된다.
- 시스템은 첫 페이지에 10건만 표시하고, 페이지 이동 컨트롤(이전/다음 + 현재/전체 표시)을 노출한다.
- 사용자가 "다음" 을 누르면 다음 10건이, 마지막 페이지에서는 나머지 3건이 표시된다.
- 사용자가 다른 메뉴로 전환하거나 부서별 조회 버튼을 누르면 페이지가 1로 리셋된다.

### 3.2 세션 sliding 만료 — 활동 중 유지 / 1시간 무동작 시 만료
- 로그인한 사용자가 50분 동안 작업하다가 요청(또는 송고/보류/KILL/저장)을 보낸다 → 만료 시점이 현재로부터 다시 1시간 뒤로 갱신된다(sliding).
- 사용자가 새로고침(F5)을 누른다 → 새로고침도 인증된 요청이므로 활동으로 간주되어 세션이 유지되고 만료 시점이 갱신된다.
- 사용자가 마지막 활동 이후 1시간 동안 아무 동작도 하지 않는다 → 다음 보호 요청에서 세션이 만료된 것으로 판정되어 미인증으로 취급된다.

### 3.3 행 클릭 상세 새창
- 사용자가 조회 목록에서 기사 행을 (좌)클릭한다.
- 시스템은 새 창을 열어 그 기사의 제목/본문/공통정보를 표시한다(우클릭 → 상세보기와 동일 콘텐츠).

---

## 4. 요구사항 (EARS Requirements)

> 표기: 본 SPEC 의 3개 REQ 는 모두 **이미 구현된 동작의 회귀 잠금(Δ-only)** 이다. 신규 동작 추가 없음.

### REQ-LIST-PAGINATION — 조회 목록 4메뉴 10개/페이지 페이징 (Priority: High)

- **[Ubiquitous]** THE 시스템 SHALL 기사 조회 페이지(`list.do`)의 4개 메뉴(데스크 미송고, 부서별 작성, 부서별 송고, 개인별 수정) 목록을 **한 페이지당 정확히 10개** 까지만 표시한다.
- **[Event-Driven]** WHEN 조회된 기사 수가 10개를 초과하면, THE 시스템 SHALL 페이지 이동 컨트롤(이전/다음 버튼 + `현재페이지 / 전체페이지` 지시자)을 노출한다.
- **[Event-Driven]** WHEN 사용자가 다음/이전 페이지로 이동하면, THE 시스템 SHALL 해당 페이지 구간의 기사(최대 10개)만 표시하고 페이지 지시자를 갱신한다.
- **[Event-Driven]** WHEN 사용자가 메뉴를 전환하거나 부서별 조회 버튼을 누르면, THE 시스템 SHALL 현재 페이지를 1페이지로 리셋한다.
- **[State-Driven]** WHILE 현재 페이지 번호가 (목록 축소로 인해) 전체 페이지 수를 초과한 상태가 되면, THE 시스템 SHALL 현재 페이지를 마지막 유효 페이지로 보정한다.
- **[Ubiquitous]** THE 시스템 SHALL 페이징 적용 후에도 각 행의 컬럼 구성(SPEC-FRONTEND-UI-001 REQ-FE-VIEW-011 의 8컬럼)을 변경 없이 유지한다(회귀 가드).

### REQ-SESSION-SLIDING — 세션 1시간 sliding idle 만료 정책 (Priority: High)

- **[Ubiquitous]** THE 시스템 SHALL 인증 세션의 idle 만료 임계값을 **1시간(무동작)** 으로 적용한다.
- **[Event-Driven]** WHEN 인증된 사용자의 활동(보호 요청, 송고/보류/KILL 액션, 기사 저장, 새로고침 포함)이 발생하면, THE 시스템 SHALL 해당 세션의 만료 시점을 현재 시각 기준 1시간 뒤로 갱신한다(sliding expiration).
- **[State-Driven]** WHILE 마지막 활동 이후 경과 시간이 1시간 미만인 동안, THE 시스템 SHALL 세션을 유효(인증됨)로 유지한다.
- **[Unwanted]** IF 마지막 활동 이후 1시간 이상 무동작이 지속되면, THEN THE 시스템 SHALL 후속 보호 요청에서 세션을 만료로 판정하고 미인증으로 취급한다(SPEC-AUTH-001 REQ-AUTH-GUARD-003 와 정합).
- **[Event-Driven]** WHEN 사용자가 로그아웃하면, THE 시스템 SHALL 활동 여부와 무관하게 세션을 즉시 무효화한다(SPEC-AUTH-001 REQ-AUTH-SESS-004 와 정합 — sliding 갱신은 로그아웃을 연장하지 않는다).

> 정합 노트: 새로고침(F5)은 인증된 요청이므로 위 "활동" 정의에 포함되어 세션이 유지된다. `news.md` L104 의 "탭/브라우저 닫힘 시 세션 종료" 는 클라이언트 생애주기 이벤트로, 본 SPEC 의 서버측 idle 만료와 별개이며 **SPEC-NEWS-REVISE-008**(편집 잠금 해제 시점 — `lockYN` 규칙)에서 다룬다. 본 SPEC 은 서버측 1시간 sliding idle 만 잠근다.

### REQ-ROW-CLICK-DETAIL — 조회 목록 행 클릭 상세 새창 (Priority: Medium)

- **[Event-Driven]** WHEN 사용자가 조회 목록의 기사 행을 클릭하면, THE 시스템 SHALL 새 창(별도 브라우저 창)을 열어 그 기사의 제목/본문/공통정보 내용을 표시한다.
- **[Ubiquitous]** THE 시스템 SHALL 행 클릭으로 여는 상세 콘텐츠를 우클릭 → 상세보기(SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT / SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS) 와 동일한 렌더 경로로 표시한다(두 진입점의 콘텐츠 일관성 — 회귀 가드).

---

## 5. 비기능 요구사항 (NFR)

- **5.1 결정론/테스트 가능성**: 세션 만료 판정은 주입 가능한 시각(`now`)과 임계(`ttlMs`)에 의존하는 순수 로직으로 검증한다. 테스트는 **반드시 `now`(또는 `ttlMs`)를 명시적으로 주입** 하여 실시간 시계 의존을 제거한다(시계 고정 없이 작성하면 미래 시점에 비결정적으로 깨진다).
- **5.2 페이지 크기 상수**: 페이지 크기 10 은 단일 상수(`PAGE_SIZE`)로 표현되어 4메뉴에 동일 적용된다.
- **5.3 회귀 무손상**: 본 SPEC 의 잠금은 SPEC-FRONTEND-UI-001 / SPEC-AUTH-001 / SPEC-EDIT-LOCK-001 의 기존 동작을 변경하지 않는다.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC 은 이미 구현된 3개 동작의 **명세 잠금(회귀 가드)** 만 다룬다. 아래는 명시적으로 범위 밖이다.

- **글기사 탭(검색 결과) 페이징/정렬 정책**: SPEC-NEWS-REVISE-002/003 Exclusion 및 SPEC-BACKEND-CORE-001(REQ-SRCH-* 영역)의 Run 단계 소관. 본 SPEC 의 페이징은 **조회 목록 4메뉴** 에만 적용된다.
- **페이지 크기(10) 변경/사용자 설정/무한 스크롤**: 현재 고정값 10 만 잠근다. 변경 가능 페이지 크기는 별도 SPEC.
- **세션 저장소/쿠키 구현 세부(쿠키 속성, 서버 세션 스토어 종류, 클러스터 공유)**: SPEC-AUTH-001(REQ-AUTH-SESS-*) 및 Run 단계 소관. 본 SPEC 은 **idle 만료 임계 + sliding 갱신 정책** 만 잠근다.
- **편집 잠금(lockYN) 해제 시점 / 탭·브라우저 닫힘 처리**: SPEC-EDIT-LOCK-001 및 SPEC-NEWS-REVISE-008 소관. 본 SPEC 은 세션 만료와 잠금 해제를 혼동하지 않는다.
- **상세 새창의 레이아웃/폰트/공통정보 12필드 구성**: SPEC-NEWS-REVISE-001(REQ-DETAIL-LAYOUT-SPLIT) / SPEC-NEWS-REVISE-003(REQ-DETAIL-BODY-EMPHASIS) 소관. 본 SPEC 은 **행 클릭 진입점** 과 두 진입점의 콘텐츠 일관성만 잠근다.
- **우클릭 컨텍스트 메뉴의 미구현 항목**(이력보기/송고이력/번역/매핑/후속기사/계속기사/재송/삭제요청 등): 다수가 미구현 기능 후보로, 본 SPEC 범위 밖. 별도 feature SPEC 으로 다룬다.
- **디자인 토큰(레드 #C8102E 등)**: SPEC-NEWS-REVISE-002 NFR 에서 `--yh-blue #0A4DA6` 유지로 의도적 미적용 결정됨(상충 해소 완료). 본 SPEC 은 디자인을 다루지 않는다.

---

## 참조 (References)

- 원천 명세: `news.md` L91(행 클릭 상세), L92(목록 페이징), L101~104(세션 정책)
- 의존 SPEC: `.moai/specs/SPEC-FRONTEND-UI-001/spec.md`(조회 페이지 4메뉴/8컬럼 — REQ-FE-VIEW-004~011)
- 의존 SPEC: `.moai/specs/SPEC-AUTH-001/spec.md`(세션 만료 미인증 취급 — REQ-AUTH-GUARD-003, 로그아웃 — REQ-AUTH-SESS-004)
- 정합 SPEC: `.moai/specs/SPEC-EDIT-LOCK-001/spec.md`(락 TTL ≠ 세션 만료 — 구분), `.moai/specs/SPEC-NEWS-REVISE-008/spec.md`(탭/브라우저 닫힘 시 잠금 해제)
- 상세 새창 레이아웃: `.moai/specs/SPEC-NEWS-REVISE-001/spec.md`(REQ-DETAIL-LAYOUT-SPLIT), `.moai/specs/SPEC-NEWS-REVISE-003/spec.md`(REQ-DETAIL-BODY-EMPHASIS)
- 도메인 사실 단일 출처: `Skill("moai-domain-news-editor")`(권한 매트릭스/생애주기/12 공통정보/단축키/임베딩/디자인 토큰)
- 구현체(회귀 잠금 대상): `web/src/view/ViewPage.jsx`(페이징·행 클릭 상세), `server/index.js` + `src/services/sessionService.js`(세션 sliding)
- 프로젝트 HARD 규칙: `CLAUDE.md`(UTF-8, DB 삭제 금지, 작업 완료 시 Slack tech-day 보고)
