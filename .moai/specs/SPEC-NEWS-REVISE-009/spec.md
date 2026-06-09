---
id: SPEC-NEWS-REVISE-009
version: 0.1.0
status: Plan
created: 2026-06-08
updated: 2026-06-08
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-007
  - SPEC-NEWS-REVISE-008
  - SPEC-UI-EDITOR-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-009 — 멀티 탭 에디터 1급 명세화 + 임베드-텍스트 시각 순서 보존(Bug 1) + 클립보드 임베드 17% 사이징

## HISTORY

- 2026-06-08 (v0.1.0): 최초 작성. SPEC-NEWS-REVISE-008(2026-06-06) 이후에도 기존 001~008 SPEC 에 **1급(first-class) EARS 요구사항으로 흡수되지 않은** news.md 항목 4 그룹을 단일 SPEC, 4 REQ 로 정리. Brownfield Δ-only — 해당 동작은 작업 트리/HEAD 에 이미 구현되어 있으며(`WriteWorkspace.jsx`, `editorCaret.readOrderedContentFromDom`, `clipboardEmbed.js`/`yonhap.css`), 본 SPEC 은 이를 회귀 가드 + 명세 잠금으로 고정한다.
  - 미반영 근거: 멀티 탭 라인(news.md L60~62)은 커밋 `59aa7d8`(2026-06-06, SPEC-008 작업)에서 L63(편집 탭 생존 중 락 유지)과 **함께** 추가되었으나, SPEC-008 은 L63(락 유지)과 DDH 규칙만 1급 REQ 로 명세하고 L60~62(탭 동작 자체 — 독립 내용/＋ 버튼/탭 닫기 폐기/마지막 탭 블랭크 유지/편집-새탭/재오픈-활성화/송고 후 블랭크 전환)는 락 의미론의 *보조 사실*로만 참조했다. 본 SPEC 이 L60~62 를 1급으로 승격한다.
  - 임베드-텍스트 시각 순서 보존(news.md L126 "엠베딩 후 결과는 유지", L129 "최종 시각 순서: 본문 텍스트 → 임베드 → (끝)")은 커밋 `4d09a8d`(2026-06-08) Bug 1 수정(`editorCaret.readOrderedContentFromDom`)으로 구현되었으나, SPEC-UI-EDITOR-001 REQ-EDIT-EMBED-007 은 *임베드들 상호 간의 상대 순서*만 다루고 *트레일링 임베드 뒤 입력/Enter 시 텍스트-임베드 시각 순서 보존*은 다루지 않았다. 본 SPEC 이 Bug 1 회귀 가드로 명세한다.
  - 클립보드 임베드 17%×17% / figure 612px / 기사 참조 카드 480px(news.md L127): news.md(source-of-truth)가 10%→17%(1.7배)로 갱신됨에 따라, 갱신된 source-of-truth 를 1급 REQ 로 흡수한다. SPEC-NEWS-REVISE-001/002 의 "10% 불변" 비목표화는 *그 SPEC 작성 시점의 source-of-truth(10%)에 대해 참이었던 기록*으로 보존하며, 본 SPEC 은 그 문서를 수정하지 않는다. news.md 갱신에 따른 정본 이행은 §10 PD1 에서 Plan 단계에 확정한다.
  - (제외) 신규 기사 최초 송고 무전이(news.md L161, 커밋 4d09a8d 추가)는 기존 lifecycle 명세(isDraft/`!isDraft`)와 정합하며 본 SPEC 범위 밖으로 둔다(중복 회피). (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-009 |
| 제목 | 멀티 탭 에디터 1급 명세화 + 임베드-텍스트 시각 순서 보존(Bug 1) + 클립보드 임베드 17% 사이징 |
| 상태 | Plan |
| 생성일 | 2026-06-08 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001/002/007/008, SPEC-UI-EDITOR-001, SPEC-FRONTEND-UI-001, SPEC-AUTH-001 |
| 영향 페이지 | `writer.do` (기사 작성/편집 — 멀티탭 워크스페이스), 기사 에디터 본문 |
| 작업 모드 | Brownfield 확장 (Δ-only, 프론트엔드 한정) |
| 인코딩 | UTF-8 (BOM 없음) |

---

## 1. 목적 (Goal)

`news.md`(source-of-truth)에서 기존 SPEC-NEWS-REVISE-001~008 에 **1급 EARS 요구사항으로 흡수되지 않은** 4 그룹의 동작을 코드/테스트에 정합되도록 정식 명세화한다. 해당 동작은 모두 HEAD/작업 트리에 이미 구현되어 있으므로 본 SPEC 은 회귀 가드 + 명세 잠금(EARS) 을 부여한다.

흡수 대상 news.md 문장:

- (L60) "기사 작성 에디터는 탭(Tab)으로 여러 개 열 수 있다. ＋ 버튼으로 새 작성 탭을 추가하며, 각 탭의 작성 내용은 서로 독립적으로 유지된다. 탭을 닫으면 그 탭의 작성 내용은 폐기되고, 마지막 탭을 닫으면 빈 새 기사 탭 1개가 유지된다."
- (L61) "기사 조회페이지에서 편집 또는 고침/포털고침 기능으로 기사 작성 에디터를 로딩할 때는 해당 기사를 새로운 탭으로 만들어 보여준다. 이미 열려 있는 기사를 다시 열면 새 탭을 만들지 않고 그 탭을 활성화한다 (동시 편집 잠금 규칙과 정합)."
- (L62) "편집 탭에서 송고/보류/KILL이 성공하면 그 탭은 빈 새 기사 탭으로 전환된다 (편집 잠금 해제)."
- (L126) "에디터는 …검색 결과에서의 데이터를 본문 커서 위치에 임베딩 할 수 있다. 엠베딩 후 결과는 유지한다." + (L129) "Alt+Y를 누르면 \"(끝)\"을 임베드 뒤 최종 블록으로 삽입하고(최종 시각 순서: 본문 텍스트 → 임베드 → \"(끝)\") …"
- (L127) "클립보드에서 복사하여 붙여넣기한 이미지/유투브 크기는 에디터크기가 100%이고 가로*세로=17%*17%이다. (기존 10%*10%에 1.7배 적용. 사진/영상 figure 폭도 1.7배=612px, 기사 참조 카드는 480px 유지)"

`why`:

- `news.md` 는 시스템의 source-of-truth 이며, 위 4 그룹의 동작은 사용자 가시 핵심 기능임에도 1급 EARS 잠금 없이 구현되어 있다. 잠금 없는 동작은 회귀 가드가 빈약하여 (a) 멀티탭 독립성/생존/전환 규칙이 리팩토링 중 깨질 위험, (b) Bug 1(트레일링 임베드가 입력/Enter 시 텍스트 아래로 점프)이 재발할 위험, (c) 클립보드 사이징이 구 10% 로 회귀할 위험이 있다.
- 멀티탭 L60~62 는 SPEC-008 이 락 의미론의 보조 사실로만 인용했을 뿐 *탭 동작의 행위 계약*을 EARS 로 명세한 SPEC 이 부재하다.
- Bug 1(L126/L129 시각 순서)은 SPEC-UI-EDITOR-001 REQ-EDIT-EMBED-007(임베드 상호 순서)과 *다른* 차원의 동작(텍스트-임베드 interleave 순서 보존)이며 별도 잠금이 필요하다.
- L127 의 17% 사이징은 news.md(source-of-truth)가 직접 갱신한 정본이며, 갱신된 정본을 EARS 로 흡수하는 forward-only 명세가 필요하다.

본 SPEC 은 기존 SPEC(NEWS-REVISE-001/002/007/008, UI-EDITOR-001, FRONTEND-UI-001, AUTH-001) 계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다. 코드를 변경하지 않는다(Plan 단계 문서만; Run 단계에서 회귀 가드 테스트 추가).

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope) — 프론트엔드 한정

- 멀티 탭 워크스페이스(`web/src/view/WriteWorkspace.jsx`)의 행위 계약 EARS 잠금: ＋ 버튼 신규 탭, 탭별 독립 내용, 탭 닫기 시 그 탭 내용 폐기, 마지막 탭 닫으면 빈 새 기사 탭 1개 유지.
- 조회 페이지의 편집/고침/포털고침 진입 시 해당 기사를 새 탭으로 열고, 이미 열린 기사 재오픈 시 새 탭 없이 기존 탭 활성화.
- 편집 탭에서 송고/보류/KILL 성공 시 그 탭이 빈 새 기사 탭으로 전환되는 *UI 탭 전환* 동작(편집 잠금 자체의 획득/해제 메커니즘은 SPEC-008 소관 — 본 SPEC 은 탭 전환만 다룸).
- 임베드-텍스트 시각 순서 보존(Bug 1): 트레일링 임베드 뒤 입력/Enter 후 최종 시각 순서(본문 텍스트 → 임베드 → "(끝)") 보존 — `editorCaret.readOrderedContentFromDom` 의 DOM interleave 순서 보존.
- 클립보드 붙여넣기 이미지/유튜브 사이징 17%×17%, figure 폭 612px, 기사 참조 카드 480px 정본 잠금.
- 기존 SPEC 001~008 의 AC 회귀 가드.

### 2.2 제외 (Out of Scope) — Exclusions 절(§11) 참조

[HARD] 편집 잠금의 획득/유지/해제(lockYN, 락 수명 = 편집 탭 수명, 해제 4시점, 멱등 재획득, sendBeacon, D2-5 strict)는 **전부 SPEC-NEWS-REVISE-008/002 소관**이며 본 SPEC 은 락 규칙을 신규/변경/재명세하지 않는다. 본 SPEC 의 멀티탭 REQ 는 *탭 UI 의 생성/활성화/폐기/전환*만 명세하고, 그로 인한 락 효과는 SPEC-008 계약을 **참조만** 한다.

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 멀티 탭 작성 (news.md L60)

- 사용자가 작성 페이지(`writer.do`)에서 ＋ 버튼을 눌러 새 작성 탭을 추가한다. 각 탭에 서로 다른 제목/본문을 작성하면 탭 간 내용이 섞이지 않는다.
- 한 탭을 × 로 닫으면 그 탭의 작성 내용은 폐기된다(복원되지 않음).
- 모든 탭을 닫아 마지막 탭까지 닫으면, 워크스페이스는 빈 새 기사 탭 1개를 유지한다(탭 0개 상태가 되지 않음).

### 3.2 조회→편집/고침 진입과 재오픈 (news.md L61)

- 사용자가 조회 페이지에서 기사 A 를 편집(또는 고침/포털고침)으로 진입한다 → 기사 A 가 새 탭으로 열린다.
- 같은 기사 A 를 다시 편집 진입하면 새 탭을 만들지 않고 기존 A 탭을 활성화한다(중복 탭 금지). 이때 동시 편집 잠금 효과는 SPEC-008/002 계약을 따른다.
- 서로 다른 기사 B 를 편집 진입하면 별도의 새 탭으로 열린다.

### 3.3 송고/보류/KILL 후 탭 전환 (news.md L62)

- 편집 탭에서 송고/보류/KILL 이 성공하면 그 탭은 빈 새 기사 탭으로 전환된다(기사 내용 비워짐). 편집 잠금 해제는 SPEC-008 계약대로 이루어진다(본 SPEC 은 탭 전환 UI 만 단언).

### 3.4 임베드-텍스트 시각 순서 보존 (news.md L126/L129 — Bug 1)

- 사용자가 본문 텍스트를 작성하고 그 뒤에 이미지를 임베드한다(트레일링 임베드). 임베드 뒤에 추가 텍스트를 입력하거나 Enter 를 누른다.
- 최종 시각 순서는 본문 텍스트 → 임베드 → (추가 입력) 순으로 유지되며, 임베드가 입력 텍스트 아래로 점프하지 않는다.
- Alt+Y 로 "(끝)" 을 삽입하면 임베드 뒤 최종 블록(본문 텍스트 → 임베드 → "(끝)")으로 들어가며 임베드/텍스트 순서가 흐트러지지 않는다.

### 3.5 클립보드 붙여넣기 사이징 (news.md L127)

- 사용자가 클립보드의 이미지 또는 유튜브 URL 을 본문에 붙여넣는다.
- 임베드는 에디터 100% 기준 가로×세로 17%×17% 로 표시되며, 사진/영상 figure 폭은 612px, 기사 참조 카드는 480px 로 표시된다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-MULTITAB-LIFECYCLE — 멀티 탭 워크스페이스 행위 계약 (Priority: High)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 기사 작성 페이지(`writer.do`)를 멀티 탭 워크스페이스(`WriteWorkspace`)로 렌더하며, ＋ 버튼 클릭 시 빈 새 기사 작성 탭을 추가하고 그 탭을 활성화한다.
- **[State-Driven]** WHILE 둘 이상의 탭이 열려 있는 동안, THE 시스템 SHALL 각 탭의 작성 내용(제목/본문/임베드/공통정보)을 서로 독립적으로 유지하여 한 탭의 편집이 다른 탭의 내용에 영향을 주지 않도록 한다.
- **[Event-Driven]** WHEN 사용자가 한 탭을 × 버튼으로 닫으면, THE 시스템 SHALL 그 탭의 작성 내용(탭별 초안 `newsroom.writeDraft.<tabId>`)을 폐기하고 그 탭을 탭 목록에서 제거한다.
- **[Event-Driven]** WHEN 사용자가 마지막 남은 탭을 닫으면, THE 시스템 SHALL 탭 목록을 빈 상태로 두지 않고 빈 새 기사 탭 1개를 생성하여 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT 탭 닫기 시 폐기된 탭의 작성 내용을 다른 탭이나 단일-에디터 시절의 레거시 초안(`newsroom.writeDraft`)으로 복원하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 멀티 탭 동작을 명세하기 위해 SPEC-008/002 의 편집 잠금 규칙(락 수명/해제 4시점/D2-5 strict)을 변경하거나 새 락 규칙을 도입하지 않는다(락 효과는 그 SPEC 들을 참조만 한다).

#### Acceptance Criteria 포인터

- AC-TAB-1 (＋ 신규 탭 추가/활성), AC-TAB-2 (탭별 독립 내용), AC-TAB-3 (탭 닫기 시 내용 폐기), AC-TAB-4 (마지막 탭 닫으면 빈 새 기사 탭 유지) — acceptance.md §1

---

### REQ-EDIT-TAB-ROUTING — 편집/고침 진입 새 탭 + 재오픈 활성화 + 송고 후 블랭크 전환 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 조회 페이지에서 기사를 편집 또는 고침/포털고침으로 작성 에디터에 로드하면(`writer.do?id=<articleId>`), THE 시스템 SHALL 해당 기사를 새 편집 탭으로 만들어 활성화한다.
- **[State-Driven]** WHILE 어떤 기사(`editArticleId`)의 편집 탭이 이미 열려 있는 동안, THE 시스템 SHALL 같은 기사를 다시 열 때 새 탭을 만들지 않고 기존 탭을 활성화한다(중복 탭 금지 — 동일 세션 두 페이지가 같은 기사 잠금에 자기충돌하는 것을 차단; 잠금 판정 자체는 SPEC-002 D2-5 strict 소관).
- **[Event-Driven]** WHEN 편집 탭에서 송고/보류/KILL 이 성공하면(`editArticleId` 가 null 로 전이), THE 시스템 SHALL 그 탭을 빈 새 기사 탭으로 전환한다.
- **[Unwanted]** THE 시스템 SHALL NOT 서로 다른 기사 두 건을 같은 하나의 탭으로 합쳐 표시하지 않는다(각 편집 기사는 자신의 탭을 가진다).
- **[Unwanted]** IF 송고/보류/KILL 이 실패(가드 차단/확인창 취소/서버 오류)하면, THEN THE 시스템 SHALL 그 편집 탭을 블랭크로 전환하지 않고 기사 내용을 유지한다.

#### Acceptance Criteria 포인터

- AC-EDTAB-1 (편집 진입 새 탭), AC-EDTAB-2 (재오픈 기존 탭 활성화), AC-EDTAB-3 (다른 기사 별도 탭), AC-EDTAB-4 (송고 성공 후 블랭크 전환), AC-EDTAB-5 (실패 시 미전환) — acceptance.md §2

---

### REQ-EMBED-TEXT-ORDER — 임베드-텍스트 시각 순서 보존 (Bug 1) (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 본문 텍스트 뒤에 트레일링 임베드가 존재하는 상태에서 사용자가 임베드 뒤에 텍스트를 입력하거나 Enter 를 누르면, THE 시스템 SHALL 본문 repaint/직렬화 후에도 라이브 DOM 의 텍스트-임베드 interleave 순서(본문 텍스트 → 임베드 → 추가 입력)를 그대로 보존한다(`editorCaret.readOrderedContentFromDom`).
- **[Ubiquitous]** THE 시스템 SHALL 임베드 삽입 이후 본문에 임베드 결과를 유지하며(news.md L126 "엠베딩 후 결과는 유지"), repaint 시 `[...textBlocks, ...embeds]` 처럼 텍스트를 앞으로/임베드를 뒤로 강제 재배치하지 않는다.
- **[State-Driven]** WHILE 본문에 텍스트와 임베드가 혼재(interleave)하는 동안, THE 시스템 SHALL 각 임베드를 자신의 실제 DOM 위치(앞 텍스트 블록과 뒤 텍스트 블록 사이)에 유지한다.
- **[Event-Driven]** WHEN 사용자가 Alt+Y 로 "(끝)" 을 삽입하면, THE 시스템 SHALL "(끝)" 을 임베드 뒤 최종 블록으로 배치하여 최종 시각 순서가 (본문 텍스트 → 임베드 → "(끝)") 가 되도록 한다.
- **[Unwanted]** THE 시스템 SHALL NOT 트레일링 임베드를 입력된 텍스트 라인 아래로 점프시키지 않는다(Bug 1 회귀 금지).
- **[Unwanted]** THE 시스템 SHALL NOT 본 SPEC 의 순서 보존을 위해 SPEC-UI-EDITOR-001 의 어댑터 계약(`getMarkup`/`setMarkup`, `markupVersion`)이나 임베드 상호 순서(REQ-EDIT-EMBED-007), SPEC-NEWS-REVISE-001 커서 위치 임베드 삽입/Ctrl+D 동작을 변경하지 않는다.

#### Acceptance Criteria 포인터

- AC-ORDER-1 (트레일링 임베드 뒤 입력 후 순서 보존), AC-ORDER-2 (Enter 후 임베드 미점프), AC-ORDER-3 (Alt+Y "(끝)" 임베드 뒤 최종 블록), AC-ORDER-4 (interleave round-trip) — acceptance.md §3

---

### REQ-CLIPBOARD-EMBED-SIZE — 클립보드 임베드 17% 사이징 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 클립보드에서 붙여넣기한 이미지/유튜브 임베드를 에디터 100% 기준 가로×세로 17%×17% 로 표시한다(news.md L127 갱신 정본; 기존 10%×10% 에 1.7배 적용).
- **[Ubiquitous]** THE 시스템 SHALL 사진/영상 figure 의 폭을 612px(1.7배)로, 기사 참조 카드의 폭을 480px 로 표시한다.
- **[Unwanted]** THE 시스템 SHALL NOT 클립보드 임베드를 구 정책 10%×10% 또는 figure 360px 로 표시하지 않는다(news.md L127 이 정본; 본 SPEC 은 갱신된 source-of-truth 를 흡수하며 SPEC-001/002 문서는 수정하지 않는다 — §10 PD1).
- **[Unwanted]** THE 시스템 SHALL NOT 17% 사이징을 위해 신규 디자인 토큰/CSS 변수를 도입하지 않는다(기존 `.yh-embed`/`yonhap.css` 사이징 규칙을 사용).

#### Acceptance Criteria 포인터

- AC-SIZE-1 (17%×17% 사이징), AC-SIZE-2 (figure 612px / 카드 480px), AC-SIZE-3 (10% 회귀 금지) — acceptance.md §4

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰/사이징(`--yh-blue`, `--yh-gray-line` `#DDE3EC`, `.yh-embed`)만 재사용한다.
- 클립보드 임베드 사이징(17%×17% / 612px / 480px)은 기존 `web/src/styles/yonhap.css` 의 `.yh-embed` 계열 규칙으로 표현하며 신규 토큰을 만들지 않는다.
- 디자인 톤은 news.md "디자인(스타일)" 섹션(브랜드 레드 `#C8102E`, 명조 제목/고딕 본문, 1px `#DDD` 회색선)을 따른다. 단 에디터 본문 색 규칙(제목 파란색/부제목 빨간색/본문 검정/"(끝)" 골드 — news.md L128~129)은 그대로 유지한다(SPEC-NEWS-REVISE-001/002 정합).

### 5.2 접근성 (Accessibility)

- 멀티 탭의 ＋ 버튼/탭 닫기 × 버튼은 접근 가능한 텍스트(`aria-label`)와 키보드 조작을 가진다(기존 구현 유지).
- 임베드 노드는 SPEC-NEWS-REVISE-001/002/003 의 `aria-label`/삭제 어포던스 규약을 그대로 유지한다.

### 5.3 회귀 방지

- SPEC-NEWS-REVISE-001~008 의 모든 AC 회귀 없음. 특히 SPEC-008 락 수명(편집 탭 수명) 계약, SPEC-002 D2-5 strict, SPEC-001 커서 위치 임베드/Ctrl+D, SPEC-002/003 Alt+Y "(끝)" 단순화/임베드 삭제, SPEC-UI-EDITOR-001 임베드 상호 순서(REQ-EDIT-EMBED-007) 회귀 없음.
- SPEC-FRONTEND-UI-001 의 4탭 60:40 레이아웃·우상단 사용자 정보·상세보기 호출 회귀 없음.

### 5.4 성능 (Performance)

- 멀티 탭은 추가 폴링/타이머를 도입하지 않고 기존 sessionStorage 영속(`newsroom.editorTabs`)과 마운트/hidden 토글만 사용한다.
- 임베드-텍스트 순서 보존은 추가 네트워크 호출 없이 라이브 DOM 읽기(`readOrderedContentFromDom`)로 처리한다.

### 5.5 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 구현 사실 (Brownfield Δ 기준점)

> 직접 Read/Grep 로 검증한 현재 상태(2026-06-08, HEAD = 4d09a8d).

| 파일 | 현재 상태 | Δ |
|------|-----------|---|
| `web/src/view/WriteWorkspace.jsx` | 멀티탭 구현 존재. `newsroom.editorTabs` sessionStorage 영속, ＋ 신규 탭, `withEditTab` 으로 재오픈 시 기존 탭 활성화(중복 금지), 모든 탭 mounted/비활성 hidden, 마지막 탭 처리 | 본 SPEC 은 탭 UI 행위 계약을 1급 EARS 로 잠금(코드 무변경, 회귀 가드 테스트 추가) |
| `web/src/view/editorCaret.js` `readOrderedContentFromDom` (L112~154) | Bug 1 수정 구현. 라이브 DOM 자식을 순회하여 text run / `[data-embed-index]` embed 블록을 실제 interleave 순서대로 읽음 (`[...textBlocks,...embeds]` 강제 재배치 제거) | 본 SPEC 은 Bug 1 회귀 가드를 1급 EARS 로 잠금 |
| `web/src/view/clipboardEmbed.js` + `web/src/styles/yonhap.css` (`.yh-embed`) | 클립보드 이미지/유튜브 임베드. 사이징(17%×17% / figure 612px / 카드 480px)은 `yonhap.css` `.yh-embed` 가 담당 | 본 SPEC 은 17% 사이징을 1급 EARS 로 잠금(주석 정합은 Run 옵션 — PD5) |
| `web/src/view/useViewController.js` / `ViewPage.jsx` | 편집/고침/포털고침 진입 시 `navigate(ROUTES.WRITE, { id })` (SPEC-007) | 변경 없음(편집-새탭 라우팅의 근거) |
| `.claude/skills/moai-domain-news-editor/SKILL.md` | 17%×17% / 612px / 480px / Alt+Y embeds 뒤 배치 도메인 사실 기록(L74, L212) | 본 SPEC 의 도메인 정합 근거(권한 매트릭스 R/D/Z, 생애주기, 12 공통정보, 단축키) |

---

## 7. 영향 영역 (Affected Files)

> 본 SPEC 은 Plan 단계 문서만. Run 단계에서 아래 테스트 파일에 회귀 가드를 추가하며 production 코드는 무변경을 기본값으로 한다.

- `web/src/view/WriteWorkspace.test.jsx` — REQ-MULTITAB-LIFECYCLE / REQ-EDIT-TAB-ROUTING 회귀 가드.
- `web/src/view/editorCaret.test.js` (또는 `editorAdapter.test.js`) — REQ-EMBED-TEXT-ORDER (Bug 1) 회귀 가드.
- `web/src/view/clipboardEmbed.test.js` / `web/src/styles/yonhap.css` 사이징 룰 단언 — REQ-CLIPBOARD-EMBED-SIZE 회귀 가드.
- 회귀 매트릭스: 기존 001~008 의 AC GREEN 유지(`web/src/view/WritePage.test.jsx`, `useWriteController.*.test.jsx`, `InlineEmbed.test.jsx`, `editorShortcuts.test.js`, `editorColoring.test.js` 등).

---

## 8. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-008** — 편집 탭 생존 중 락 유지(news.md L63)와 DDH 규칙을 1급으로 명세하며 멀티탭 L60~62 를 락 의미론의 보조 사실로만 인용. 본 SPEC 은 그 보조 사실을 1급 *탭 UI* 행위 계약으로 승격하되, 락 수명/해제 4시점 동작은 변경하지 않고 SPEC-008 계약을 참조만 한다(§2.2 HARD 경계).
- **SPEC-NEWS-REVISE-002** — D2-5 strict(동일 user 다른 session 거부)와 lockYN 락 계약. 본 SPEC 의 재오픈-기존탭-활성화(중복 탭 금지)는 이 자기충돌 방지와 정합하며 락 판정 자체는 SPEC-002 소관.
- **SPEC-NEWS-REVISE-007** — 편집/고침/포털고침 진입점(`navigate(ROUTES.WRITE,{id})`). 본 SPEC 의 편집-새탭 라우팅이 이 진입점을 소비한다(진입점 정의는 SPEC-007 소관).
- **SPEC-UI-EDITOR-001 REQ-EDIT-EMBED-007** — *임베드들 상호 간 상대 순서* 보존. 본 SPEC 의 REQ-EMBED-TEXT-ORDER 는 *텍스트-임베드 interleave 순서* 보존(Bug 1)으로 차원이 다르며 그 위에 추가된다(어댑터 계약 불변).
- **SPEC-NEWS-REVISE-001** — 커서 위치 임베드 삽입/영속성/Ctrl+D. 본 SPEC 은 그 위에 시각 순서 보존만 추가(불변).
- **SPEC-NEWS-REVISE-002/003** — Alt+Y "(끝)" 단순화 + 임베드 삭제. 본 SPEC 은 "(끝)" 이 임베드 뒤 최종 블록임을 순서 관점에서 잠그되 단순화/삭제 동작은 불변.
- **SPEC-FRONTEND-UI-001** — 작성 페이지 레이아웃. 본 SPEC 의 멀티탭은 그 위에 워크스페이스 셸을 추가.
- **SPEC-AUTH-001** — R/D/Z 권한 + 세션. 본 SPEC 은 권한 의미를 변경하지 않는다.

---

## 9. 도메인 정합 (moai-domain-news-editor 참조)

- 권한 매트릭스(R 기자 / D 데스크 / Z 관리자), 생애주기(RDS/DPS/RRH/RRK/DDH/DDK), 12 공통정보, 단축키(Alt+Y "(끝)", Ctrl+D 라인 삭제)는 `moai-domain-news-editor` 스킬 정본과 정합 확인.
- 17%×17% / figure 612px / 기사 카드 480px / Alt+Y embeds 뒤 최종 블록 배치는 스킬 SKILL.md L74·L212 의 도메인 사실과 정합.
- 본 SPEC 은 권한/생애주기/공통정보/단축키 *의미*를 변경하지 않으며, 멀티탭·시각 순서·클립보드 사이징의 *프론트엔드 행위 계약*만 잠근다.

---

## 10. 위험과 완화 (Risks & Mitigation — Plan 단계 결정 확정)

| ID | 위험 | 영향 | 결정 (Plan 단계 확정) |
|----|------|------|----------------------|
| PD1 | news.md L127(17%) 갱신과 SPEC-001/002 의 "10% 불변" 비목표화 기록의 표면적 충돌 | 정본 모순처럼 보임 | **[확정] news.md(source-of-truth)가 정본이므로 L127(17%)을 채택.** SPEC-001/002 의 10% 비목표화는 *그 작성 시점의 source-of-truth(10%)에 대한 참인 기록*으로 보존하며 수정하지 않는다(타 SPEC 무수정 HARD 준수). 본 SPEC 이 갱신분을 forward-only 로 흡수 — 두 문서는 시간축상 모순이 아니라 *버전 차이*다. |
| PD2 | 멀티탭 행위 가드 테스트 배치: 기존 `WriteWorkspace.test.jsx` 보강 vs 신규 파일 | 둘 다 `npm run test:web` glob 포함 — 동작 동일 | **[확정] 기존 `WriteWorkspace.test.jsx` 보강**(파일수 최소, 004 production-zero precedent 정합). |
| PD3 | Bug 1 가드 레벨: 단위(editorCaret) vs 통합(WritePage) | 단위만이면 통합 회귀 누락 위험 | **[확정] `editorCaret.test.js` 단위 가드(`readOrderedContentFromDom` interleave) 필수 + WritePage 통합 1건 권장**(통합 1건은 jsdom 한계 시 단위로 대체 가능). |
| PD4 | 클립보드 사이징 CSS 검증 시 jsdom getComputedStyle 제한 | AC-SIZE false negative 가능 | **[확정] `yonhap.css` 텍스트의 사이징 규칙 정규식/문자열 단언(612px/480px/17%) 우선 + jsdom 보조**(SPEC-002 AC-FONT-2 전략 재사용). |
| PD5 | `clipboardEmbed.js` 주석 "10%x10% sizing" 이 17% 정본과 불일치 | 문서-코드 어휘 혼동 | **[확정] Run 단계에서 주석만 17% 로 정합(동작 무변경)**. production 사이징 로직(이미 17%)은 변경하지 않으므로 Δ-only/production-zero 원칙과 정합(주석은 비-동작 변경). |

> 본 SPEC 은 모든 결정을 Plan 단계에서 확정하여 Run 단계 충돌 가능성을 제거한다. Run 단계는 확정값을 그대로 구현한다.

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 기능 *구현* (본 SPEC 은 Plan 단계 문서만; Run 단계는 회귀 가드 테스트 추가 + PD5 주석 정합만).
- **편집 잠금 규칙(lockYN, 락 수명/해제 4시점/멱등 재획득/sendBeacon/D2-5 strict)의 신규·변경·재명세 — 전부 SPEC-NEWS-REVISE-008/002 소관(§2.2 HARD).** 본 SPEC 은 락 효과를 참조만 한다.
- 멀티탭의 news.md 미명시 신규 동작 추가(탭 드래그 재정렬, 탭 고정, 탭 수 제한 등).
- 신규 기사 최초 송고 무전이(news.md L161) 재명세 — 기존 lifecycle/isDraft 명세와 정합하므로 본 SPEC 범위 밖(중복 회피).
- 임베드 상호 순서(SPEC-UI-EDITOR-001 REQ-EDIT-EMBED-007) 또는 어댑터 계약(`getMarkup`/`setMarkup`/`markupVersion`) 변경.
- SPEC-NEWS-REVISE-001/002 의 커서 위치 임베드 삽입/Ctrl+D/Alt+Y "(끝)" 단순화/임베드 삭제 *동작* 변경.
- 신규 디자인 토큰/CSS 변수 도입.
- 수집/배부 시스템 (기사 작성기만; CLAUDE.md "현재 구현 범위는 기사 작성기만").
- DB 스키마/데이터 변경 (CLAUDE.md HARD).
- `news.md` 수정(이미 반영됨 — source-of-truth 불변).
- 타 SPEC(SPEC-NEWS-REVISE-001~008 및 기타 SPEC)의 3파일(spec/plan/acceptance) 수정.
- 새 `.claude/agents` 또는 `.claude/skills` 정의.
- AskUserQuestion 호출 (subagent boundary).

---

## 12. Definition of Done

- [ ] 3 파일 생성 + UTF-8 BOM 없음 (`spec.md`, `plan.md`, `acceptance.md`), 3종 version 0.1.0 일치
- [ ] 4 REQ 각각 EARS 문장 보유 + 모든 REQ 에 [Unwanted] 절 포함
- [ ] ＋ 신규 탭/탭별 독립 내용/탭 닫기 폐기/마지막 탭 블랭크 유지 (AC-TAB-1~4 GREEN)
- [ ] 편집 진입 새 탭/재오픈 기존 탭 활성화/송고 성공 후 블랭크 전환 (AC-EDTAB-1~5 GREEN)
- [ ] 트레일링 임베드 뒤 입력/Enter 후 시각 순서 보존 + Alt+Y "(끝)" 임베드 뒤 최종 블록 (AC-ORDER-1~4 GREEN)
- [ ] 클립보드 임베드 17%×17% / figure 612px / 카드 480px / 10% 회귀 금지 (AC-SIZE-1~3 GREEN)
- [ ] §2.2 + Exclusions 가 편집 잠금 규칙을 SPEC-008/002 소관으로 명시 격리(본 SPEC 은 락 규칙 무도입)
- [ ] §10 PD1~PD5 가 Plan 단계에서 모두 확정(Run 이연 없음)
- [ ] Cross-References 에 SPEC-008/002/007/UI-EDITOR-001/001/FRONTEND-UI-001/AUTH-001 회귀 가드 명시
- [ ] plan.md 의 마일스톤이 time estimates 없이 priority-based (CLAUDE.md HARD)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001~008 의 `spec.md`/`plan.md`/`acceptance.md` 를 수정하지 않음
- [ ] 본 SPEC 은 production 코드를 수정하지 않음(PD5 주석 정합은 Run 단계 옵션)
- [ ] 기존 SPEC(NEWS-REVISE-001~008, UI-EDITOR-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음
- [ ] `npm run test:web` 전체 통과, `npm test` 전체 통과, `npm run build` 무경고
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-08
