---
id: SPEC-NEWS-REVISE-001
artifact: research
version: 0.1.0
created: 2026-06-02
updated: 2026-06-02
---

# Research — SPEC-NEWS-REVISE-001

본 문서는 SPEC-NEWS-REVISE-001 작성에 활용된 사전 코드베이스 분석(Brownfield Research)을 기록한다. 분석 시점: 2026-06-02. 분석 출처: `news.md`, `.moai/specs/SPEC-*/spec.md`, `web/src/` Grep/Read, `git status` 미커밋 변경.

---

## 1. news.md 개정 차이 (Diff Summary)

| 라인 | 변경 전 (추정) | 변경 후 (현재) |
|------|---------------|---------------|
| 64 | "Z권한은 모든 버튼이 보이고 사용할 수 있다" | "Z권한은 송고/보류/KILL 버튼이 보이고 사용할 수 있다" |
| 84 | 새창 하단에 "제목, 본문을 보여준다" | 새창 하단에 "제목과 본문을 분리해서 보여준다" |
| 111 | 에디터는 텍스트와 이미지/유투브를 임베딩 할 수 있다 (모호) | "/이미지/영상/글기사의 검색 결과에서의 데이터를 본문 커서 위치에 임베딩. 엠베딩 후 결과는 유지" |
| 116 | (없음) | "Ctrl+d를 누르면 해당라인을 제거한다" (신규) |

---

## 2. 기존 SPEC 3종 핵심 발췌

### 2.1 SPEC-UI-EDITOR-001 (draft, v0.1.0)

- **소유 책임 (Owned)**
  - 에디터 구조 파싱: 첫째줄=제목, 둘째~다섯째줄=부제목, 빈 줄 2번 이상이면 둘째 줄 블록부터 본문 (사용자 확정 후보 A)
  - 인라인 임베딩 렌더링: 메타데이터 탭 검색 결과 → 본문 *내부*에 시각적 인라인 노드(이미지 썸네일, 유튜브 카드, 내부기사 카드)
- **명시적 비목표**
  - 구체 리치텍스트 라이브러리 선택 (Run 단계)
  - 인라인 임베드의 DOM/CSS 마크업 세부
  - 검색 백엔드 결과 형태 변경 (SPEC-BACKEND-CORE-001 결과 그대로 소비)
- **계약 제약 (보존 필요)**
  - DP-F1 에디터 어댑터 계약 (`EditorAdapter`: `getMarkup()` / `setMarkup(markup)`)
  - markupVersion 덮어쓰기 (이력 UI 없음)
  - DTO 조립: `{...common, markupVersion: adapter.getMarkup()}`
- **본 SPEC과의 관계**: REQ-EDITOR-EMBED-AND-CTRL-D는 SPEC-UI-EDITOR-001의 어댑터 계약을 *변경 없이* 그 위에 두 책임(커서 위치 삽입 + persist 보장 + Ctrl+D)을 추가. 직렬화 형식은 SPEC-UI-EDITOR-001에 위임 (Pending D-3).

### 2.2 SPEC-FRONTEND-UI-001 (approved, v0.2.0)

- **소유 책임 (Owned)**
  - 3개 페이지: login.do / writer.do / list.do
  - 모든 페이지 우측 상단 사용자 정보 표시
  - 작성 페이지 60:40 레이아웃, 4탭 메타데이터, 상단 송고/보류 버튼군
  - 외부 미디어 검색 (유튜브 → 구글 폴백) 및 내부 글기사 검색
  - 실시간 조회 + 상태바 + 4메뉴
  - **권한 R/D/Z 기반 UI 노출/비활성**
- **현재 정의 (변경 전)**
  - "Z권한은 모든 버튼이 보인다" 가 `news.md`의 원래 표현 — SPEC-FRONTEND-UI-001가 이를 EARS로 어떻게 구체화했는지에 따라 본 SPEC과의 정합 정도가 달라짐
- **본 SPEC과의 관계**: REQ-AUTH-Z-BUTTONS는 SPEC-FRONTEND-UI-001의 권한 게이팅 규칙을 **명확화/한정**하는 Δ. 추가적으로 상세보기 새창 호출 트리거(우클릭 컨텍스트 메뉴)는 SPEC-FRONTEND-UI-001 소관이고 본 SPEC은 *그 결과 새창의 하단 레이아웃*만 다룬다.

### 2.3 SPEC-AUTH-001 (draft, v0.1.0)

- **소유 책임 (Owned)**
  - 로그인 인증 동작 (id/pw → DB User 대조 → 성공 시 writer.do, 실패 시 ALERT)
  - 세션 유지 메커니즘 (서버 측 세션 + 쿠키, JWT 아님)
  - 권한 인가 체크 계층 (R/D/Z 권한별 게이팅)
- **본 SPEC과의 관계**: 본 SPEC은 권한 *판정* 자체(어떤 사용자가 Z인지)는 변경하지 않고, *권한값을 받아 UI를 렌더링하는 규칙*만 정의. SPEC-AUTH-001 변경 없음.

---

## 3. 코드베이스 현황 (Grep/Read 결과)

### 3.1 WritePage.jsx — Z권한 버튼 분기 부재

`web/src/view/WritePage.jsx` (미커밋 변경분 포함):

- 송고/보류 분기: `(user.role === 'R' || user.role === 'D') && isRds` (Z 미포함)
- KILL 분기: `user.role === 'R' && isRds` (Z 미포함)
- 주석에도 "송고/보류 for role R|D and KILL for role R" 로 명시 — Z권한이 *의도적으로 제외된* 상태

> **함의**: 본 SPEC의 REQ-AUTH-Z-BUTTONS는 현재 미커밋 코드와 **명백히 충돌**한다. 어느 쪽이 최신 의도인지 사용자 결정 필요 (Pending D-1 관련).

### 3.2 articleDetail.js — 분리 레이아웃 이미 적용됨

`web/src/view/articleDetail.js` (미커밋 변경분):

- 상단 공통정보 섹션: `<section aria-label="공통정보">` + 12 필드 `<dl>` 렌더링
- 하단 제목 섹션: `<section aria-label="제목">` + `<h2>제목</h2>` + `<h1 class="yh-detail__title">${title}</h1>`
- 하단 본문 섹션: `<section aria-label="본문">` + `<h2>본문</h2>` + `<div class="yh-detail__content">${body}</div>`
- 시각적 분리: `yh-detail__section` 클래스에 `border: 1px solid var(--yh-gray-line)` 및 `border-left: 4px solid var(--yh-blue)`
- 색 토큰: 블루 계열 (`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`) — *레드 #C8102E 아님*
- HTML 이스케이프 함수 (`escapeHtml`) 존재

> **함의**: REQ-DETAIL-LAYOUT-SPLIT은 코드 상으로는 거의 완료. 테스트 단언 보강만 필요.

### 3.3 Ctrl+D 핸들러 — 부재

`web/src/` 전역에서 `Ctrl\+[Dd]` / `key === 'd'` / `ctrlKey` 패턴 검색 결과: **No matches found**.

> **함의**: REQ-EDITOR-EMBED-AND-CTRL-D의 Ctrl+D 부분은 **완전 신규 구현** 필요.

### 3.4 인라인 임베딩 관련 파일

존재하는 관련 파일:

- `web/src/view/InlineEmbed.jsx` + `InlineEmbed.test.jsx` (인라인 임베드 컴포넌트)
- `web/src/view/editorCaret.js` (캐럿 관리)
- `web/src/view/clipboardEmbed.js` + `clipboardEmbed.test.js` (붙여넣기 임베드)
- `web/src/controller/useWriteController.js` + `.test.jsx` (controller, embed 동작)
- `web/src/model/editorAdapter.js` + `.test.js` (어댑터 계약)
- `web/src/view/editorColoring.js` + `.test.js` (색상)
- `web/src/view/editorNewline.js` + `.test.js` (개행)

> **함의**: 임베드 인프라는 이미 존재. 본 SPEC은 *행위 단언* (커서 위치 + persist) 회귀 가드만 추가하면 됨.

---

## 4. 충돌/연계 매트릭스 (Conflict & Linkage Matrix)

| 영역 | SPEC-NEWS-REVISE-001 | SPEC-UI-EDITOR-001 | SPEC-FRONTEND-UI-001 | SPEC-AUTH-001 |
|------|---------------------|---------------------|---------------------|----------------|
| 에디터 어댑터 계약 | 소비만 | **소유** | 소비 | 무관 |
| 권한 R/D 버튼 가시성 | 회귀 가드만 | 무관 | **소유** | 권한 판정만 |
| 권한 Z 버튼 가시성 | **소유** (Δ) | 무관 | (기존 표기 모호) | 권한 판정만 |
| 상세보기 새창 호출 | 무관 (트리거는 FE-UI 소관) | 무관 | **소유** | 무관 |
| 상세보기 새창 하단 분리 | **소유** (Δ) | 무관 | 위임 가능 | 무관 |
| 인라인 임베딩 (구체 알고리즘) | 무관 | **소유** | 무관 | 무관 |
| 인라인 임베딩 (커서 위치 + persist 단언) | **소유** (Δ) | 소유 (어댑터 계약) | 무관 | 무관 |
| Ctrl+D 라인 삭제 | **소유** (신규) | 무관 (다른 단축키 Alt+Y는 그 SPEC) | 무관 | 무관 |
| 세션/인증 | 무관 | 무관 | 소비 | **소유** |

**충돌 없음**: 본 SPEC은 모든 기존 SPEC의 소유 영역을 침범하지 않고 **Δ-only** 보강.

---

## 5. 결정 트리거 (Decision Triggers for Pending Items)

### D-1 (Z권한 status gating)

- `news.md` 64줄 본문은 "보이고 사용할 수 있다"만 명시. RDS gating 여부 무명시.
- `news.md` R/D 규칙은 RDS gating을 명시. 일관성을 위해 Z도 RDS gating이 자연스러움.
- 결정: 사용자 확정 필요.

### D-2 (멀티라인 Ctrl+D)

- `news.md` 116줄 "해당라인을 제거한다" — 단일 캐럿 시나리오만 명시.
- 멀티라인 선택 시 동작 명시 없음 → 본 SPEC이 "round-up"으로 추정 (VSCode 패턴).
- 결정: 사용자 확정 필요.

### D-3 (임베드 직렬화 형식)

- SPEC-UI-EDITOR-001가 `markupVersion`을 어떤 형식으로 직렬화할지 미확정 (그 SPEC도 draft).
- 본 SPEC은 결정을 SPEC-UI-EDITOR-001에 위임. Round-trip 보존만 단언.

### D-4 (색 토큰 — 블루 vs 레드)

- 사용자 지시문: "디자인 토큰: #C8102E (레드), Serif/Sans" — **CLAUDE.md와 충돌**.
- CLAUDE.md: "디자인 — 스타일, 파란색과 흰색을 적절히 섞어준다" + "글자색은 파란색".
- 현재 `articleDetail.js` 구현: 블루 (`#0A4DA6`).
- 결정: 본 SPEC은 CLAUDE.md HARD 규칙을 따라 블루를 기본값으로 두되 사용자 재확정 권유.

### D-5 (SPEC 분할)

- 단일 `news.md` 개정에서 파생된 3개 REQ — 단일 SPEC이 트레이스 단위로 자연스러움.
- 분할 시 SPEC 간 cross-reference 관리 비용 증가.
- 결정: 단일 SPEC 권장.

---

## 6. 관찰 (Observations) — 학습 후보

- `WritePage.jsx`의 미커밋 변경분이 `news.md` 변경 의도와 명백히 충돌하는 상태로 작업트리에 남아 있다 — 본 SPEC을 통해 의도를 고정한 뒤 Run 단계에서 정합화하는 것이 안전하다.
- `articleDetail.js`는 미커밋 단계에서 이미 분리 레이아웃을 만족 — 변경 후 명세에 빠르게 반응한 사례.
- Ctrl+D는 브라우저 북마크 단축키와 충돌하므로 *반드시* `preventDefault` + 에디터 스코프 한정이 필요.

Version: 0.1.0
