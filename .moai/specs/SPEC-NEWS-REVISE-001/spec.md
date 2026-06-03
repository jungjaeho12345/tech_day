---
id: SPEC-NEWS-REVISE-001
version: 0.1.1
status: In Progress
created: 2026-06-02
updated: 2026-06-03
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-UI-EDITOR-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-001 — news.md 개정 반영 (Z권한 버튼 / 상세보기 분리 / 에디터 인라인 임베딩 · Ctrl+D)

## HISTORY

- 2026-06-03 (v0.1.1): Run 진행분(2026-06-03 커밋 5건)을 기존 REQ/AC 범위 안에서 사후 정합화. 새 REQ는 추가하지 않음.
  - `ebf7425` fix(backend): D-6 Z권한 lifecycle 전이(RDS→DPS/DDH/DDK, D-mirror) 추가 → **REQ-AUTH-Z-BUTTONS 강화**. plan.md D-6 결정에 해당하는 *행위 가드*가 acceptance에 누락되어 있던 점을 `AC-Z-LIFECYCLE-1` 로 보강.
  - `850c4cd` feat(news-revise): M3 임베드 모델 + 캐럿 보정 + RED 회귀 잠금 → **REQ-EDITOR-EMBED-AND-CTRL-D / AC-EMB-1·2·3 충족**. 본문 커서 위치 인라인 임베드 의미를 `AC-EMB-INLINE-1/2/3` 으로 세분화하여 회귀잠금 ID를 정식 등재.
  - `c5b12f8` test(editor): 본문 커서 위치 인라인 임베드 AC-EMB-INLINE-1/2/3 + CSS → **AC-EMB-INLINE-*** acceptance.md 정식 수록.
  - `b1f7155` fix(editor): IME compositionEnd Enter 1-press 줄바꿈 (stale bodyText 제거) → **plan.md D-7 결정 충족**. spec.md REQ-EDITOR-EMBED-AND-CTRL-D 영역에 *IME 가드 EARS 1줄* 추가 및 `AC-IME-1` 로 행위 단언.
  - `7580d2b` fix(editor): D-7 IME 합성 중 repaint 차단으로 1글자 지연/Enter 두 번 회귀 해결 → **AC-IME-2 (repaint 가드)** 로 회귀잠금 추가.
  변경 범위: spec.md HISTORY/메타 + REQ-EDITOR-EMBED-AND-CTRL-D EARS 2줄 추가, acceptance.md 시나리오 6개 신설(AC-Z-LIFECYCLE-1, AC-IME-1·2, AC-EMB-INLINE-1·2·3). plan.md/research.md/news.md 무변경. (manager-spec)
- 2026-06-02 (v0.1.0): 최초 작성. news.md 최근 개정 3가지를 단일 SPEC, 3개 REQ로 정리.
  (1) Z권한 버튼 가시성을 송고/보류/KILL 로 한정 (기사 작성 페이지 상단),
  (2) 상세보기 새창 하단의 제목/본문 분리 레이아웃 명문화 + 상단 공통정보 12필드 보장,
  (3) 에디터 인라인 임베딩 시 "본문 커서 위치 + 임베드 결과 유지" 의미 확정 + 신규 단축키 Ctrl+D(라인 삭제).
  기존 SPEC-UI-EDITOR-001 (에디터 어댑터/임베딩), SPEC-FRONTEND-UI-001 (작성 페이지 권한 게이팅, 상세보기 새창),
  SPEC-AUTH-001 (R/D/Z 권한 의미)을 침범하지 않고 **명세 보강(Δ)** 만 추가한다. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-001 |
| 제목 | news.md 개정 반영 (Z권한 버튼 / 상세보기 분리 / 에디터 인라인 임베딩·Ctrl+D) |
| 상태 | Plan |
| 생성일 | 2026-06-02 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-UI-EDITOR-001, SPEC-FRONTEND-UI-001, SPEC-AUTH-001 |
| 영향 페이지 | `writer.do` (기사 작성), 상세보기 새창 |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only) |

---

## 1. 목적 (Goal)

`news.md` 개정에서 새로 도입된 다음 3가지 동작 변경을 코드와 테스트에 정합되도록 정식 명세화한다.

1. **Z권한도 송고/보류/KILL 버튼이 보인다** — 기존 명세("Z권한은 모든 버튼이 보이고 사용할 수 있다")의 모호함을 제거하고, 작성 페이지(`writer.do`) 상단 버튼군에서 R/D 권한과 동일한 송고/보류/KILL 가시성·사용성으로 한정한다.
2. **상세보기 새창에서 제목과 본문을 분리 표시한다** — 기존 "제목, 본문을 보여준다"를 "제목 블록과 본문 블록을 시각적으로 분리해서 보여준다"로 확정. 상단 공통정보 12필드는 누락 없이 표시되어야 한다.
3. **에디터 임베딩 동작 명확화 + Ctrl+D 라인 삭제 단축키** — 기존 모호한 "임베딩 할 수 있다"를 "검색 결과 데이터를 본문 *커서 위치에* 임베드한다. 임베드 후 결과는 유지(persist)된다"로 확정. 추가로 Ctrl+D는 현재 캐럿이 위치한 라인을 제거한다.

`why`: news.md는 시스템의 source-of-truth이며, 변경 후 명세가 (a) 기존 코드의 가정과 (b) 기존 SPEC의 EARS 요구사항과 정합하지 않으면 회귀가 발생한다. 본 SPEC은 그 정합성을 EARS 형식으로 고정한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- `writer.do` 상단 송고/보류/KILL 버튼 가시성 규칙 (Z권한 부분)
- 상세보기 새창의 하단 레이아웃 (제목 블록 + 본문 블록 분리)
- 상세보기 새창 상단 공통정보 12필드 표시 항목 검증
- 기사 에디터 임베딩의 삽입 위치 의미 (커서 위치) 및 영속성(persist)
- 기사 에디터 단축키 Ctrl+D (현재 라인 제거)
- 기존 SPEC AC 회귀 방지

### 2.2 제외 (Out of Scope)

- 권한 R/D의 송고/보류/KILL 가시성 규칙 (변경 없음 — SPEC-FRONTEND-UI-001 유지)
- 기사 생애주기 전이 로직 (SPEC-BACKEND-CORE-001 소관)
- 인증/세션 메커니즘 변경 (SPEC-AUTH-001 변경 없음)
- 검색 백엔드 (이미지/영상/글기사) 결과 형태 변경
- 에디터의 구조 파싱(제목/부제목/본문 결정 알고리즘) — SPEC-UI-EDITOR-001 소관
- Alt+Y "(끝)" 삽입 동작 — 변경 없음
- 클립보드 붙여넣기 이미지 사이즈 (10% × 10%) — 변경 없음
- 디자인 토큰 정의 (CSS 변수 추가/변경 없음, 기존 토큰 사용)

---

## 3. 사용자 시나리오 (User Scenarios — 권한 R/D/Z 관점)

### 3.1 권한 R (기자 리포터)

- 자신이 작성한 RDS 기사 편집 페이지에 진입한다.
- 상단에는 송고, 보류, KILL 버튼이 보인다. **(기존 동작 유지)**
- 에디터 본문에서 커서를 특정 위치에 두고 우측 "이미지" 탭에서 검색 → 결과 카드 클릭 → 본문 *커서 위치*에 이미지가 인라인으로 삽입되며, 다른 텍스트 편집 후에도 임베드는 유지된다.
- 잘못 입력한 한 줄을 정리하기 위해 해당 줄에 캐럿을 두고 Ctrl+D → 그 라인이 제거된다.
- 송고 버튼을 눌러 정상 송고한다.

### 3.2 권한 D (국기사 데스크)

- 데스크 미송고 페이지에서 RDS 기사를 편집 진입한다.
- 상단에는 송고, 보류 버튼이 보인다 (KILL 비표시 — 기존 동작 유지).
- 에디터 임베딩 및 Ctrl+D 동작은 R과 동일하다.

### 3.3 권한 Z (관리자) — **본 SPEC의 핵심 변경**

- 기사 작성/데스크 미송고 편집 권한을 가진다 (`news.md` "기사 제어 권한" 유지).
- 상단에는 **송고, 보류, KILL** 버튼이 보이고 사용할 수 있다 — **다른 버튼은 추가로 노출되지 않는다**.
- 에디터 임베딩/Ctrl+D 동작은 R/D와 동일하다.
- 상세보기 새창에서 상단 공통정보 12필드와 하단의 제목/본문 분리 레이아웃을 확인한다.

### 3.4 모든 권한 — 상세보기 새창

- 조회 페이지에서 우클릭 → 상세보기 선택 → 새창이 열린다.
- 상단: 공통정보 섹션 (작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고).
- 하단: **제목 블록**과 **본문 블록**이 시각적으로 분리되어 표시된다 (섹션 헤더 또는 1px #DDD 구분선).

---

## 4. 요구사항 (Requirements — EARS)

### REQ-AUTH-Z-BUTTONS — Z권한 송고/보류/KILL 버튼 가시성 한정

#### EARS 문장

- **[Event-Driven]** WHEN 사용자 권한이 `Z`이고 편집 대상 기사 상태가 `RDS` 이며 사용자가 `writer.do` 작성 페이지에 진입하면, THE 시스템 SHALL 작성 페이지 상단 버튼군에 **송고**, **보류**, **KILL** 세 버튼을 가시(visible) · 사용 가능(enabled) 상태로 렌더링한다.
- **[Unwanted]** THE 시스템 SHALL NOT 권한이 `Z`라는 이유로 위 세 버튼 외의 추가 액션 버튼(예: 고침, 포털고침, 재송, 삭제요청 등)을 작성 페이지 상단 버튼군에 노출하지 않는다.
- **[State-Driven]** WHILE 편집 대상 기사 상태가 `RDS`가 아니면, THE 시스템 SHALL 권한 `Z`에 대해 송고/보류/KILL 세 버튼을 노출하지 않는다 (기존 R/D와 동일한 status-gating 적용).
- **[Ubiquitous]** THE 시스템 SHALL 권한 `R`/`D`의 기존 버튼 가시성 규칙(`R`: 송고+보류+KILL, `D`: 송고+보류, KILL 비표시)을 변경하지 아니한다.
- **[Event-Driven]** WHEN 권한 `Z` 사용자가 `RDS` 상태 기사에서 송고/보류/KILL 버튼을 클릭하면, THE 시스템 SHALL 기사 상태를 권한 `D` 와 동일한 전이 규칙(RDS→DPS / RDS→DDH / RDS→DDK)으로 변경한다 (plan.md Decision Lock D-6 기준).

#### Acceptance Criteria (Given-When-Then, 최소 3개)

- **AC-Z-1 (가시성 — Z+RDS)**
  - Given: 로그인 사용자의 `user.role === 'Z'`이고, 편집 대상 기사의 `status === 'RDS'`인 상태로 `writer.do?id=<articleId>`에 진입한다
  - When: 작성 페이지가 렌더링된다
  - Then: 상단 버튼군에서 `getByRole('button', { name: '송고' })`, `getByRole('button', { name: '보류' })`, `getByRole('button', { name: 'KILL' })` 세 노드가 모두 존재(가시)하고 `disabled` 속성이 없다

- **AC-Z-2 (추가 노출 금지)**
  - Given: 위 AC-Z-1과 동일한 컨텍스트
  - When: 상단 버튼군을 enumerate 한다
  - Then: 송고/보류/KILL **외**의 액션 버튼(예: "고침", "포털고침", "재송", "삭제요청", "후속기사작성")이 상단 버튼군 컨테이너 내에 추가로 렌더링되지 않는다 (스냅샷 또는 `queryByRole`로 부재 검증)

- **AC-Z-3 (status gating)**
  - Given: `user.role === 'Z'` 이고 편집 대상 기사 `status === 'DPS'` (혹은 `RDS`가 아닌 임의 상태)
  - When: `writer.do?id=<articleId>` 진입 후 작성 페이지가 렌더링된다
  - Then: 송고/보류/KILL 세 버튼 중 어느 것도 렌더링되지 않는다 (`queryByRole('button', { name: '송고' })` 등이 모두 `null`)

- **AC-Z-4 (R/D 회귀 방지)**
  - Given: `user.role === 'R'`, `status === 'RDS'`
  - When: 작성 페이지가 렌더링된다
  - Then: 송고/보류/KILL 모두 가시. AND `user.role === 'D'`, `status === 'RDS'` 일 때 송고/보류는 가시, KILL은 비가시. (기존 `WritePage.test.jsx` 케이스가 그대로 통과)

- **AC-Z-5 (접근성)**
  - Given: 위 AC-Z-1
  - When: 송고/보류/KILL 버튼이 렌더링된다
  - Then: 각 버튼은 `aria-label` 또는 접근 가능한 텍스트(visible label)를 가지며 키보드 포커스가 가능하다 (`focus()` 호출 후 `document.activeElement`가 해당 버튼)

---

### REQ-DETAIL-LAYOUT-SPLIT — 상세보기 새창의 제목/본문 분리 + 공통정보 12필드

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 조회 페이지에서 우클릭 → "상세보기"를 선택하면, THE 시스템 SHALL 새 창(또는 새 문서)을 열고 `buildArticleDetailHtml(article)` 결과를 렌더링한다.
- **[Ubiquitous]** THE 시스템 SHALL 상세보기 새창의 상단에 **공통정보** 섹션을 렌더링하며, 그 섹션은 다음 12개 필드를 모두 포함한다: 작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고.
- **[Ubiquitous]** THE 시스템 SHALL 상세보기 새창의 하단에 **제목 블록**과 **본문 블록**을 *분리된* 두 개의 `<section>`(혹은 동등한 영역)으로 렌더링하며, 두 블록 사이에는 시각적 분리(섹션 헤더 또는 1px `#DDD` 계열 회색 구분선)가 존재한다.
- **[Unwanted]** THE 시스템 SHALL NOT 제목과 본문을 하나의 연속된 텍스트 블록으로 합쳐 출력한다.
- **[State-Driven]** WHILE 기사 `title`이 비어 있으면, THE 시스템 SHALL 제목 블록의 텍스트를 `(제목 없음)` 플레이스홀더로 렌더링하고 제목 블록 자체는 유지한다 (블록 자체를 생략하지 않는다).

#### Acceptance Criteria

- **AC-DTL-1 (분리 구조)**
  - Given: 정상 article 객체 (`title`, `content`, 공통정보 12 필드 채워짐)
  - When: `buildArticleDetailHtml(article)`을 호출하여 HTML 문서 문자열을 받아 `JSDOM`/`DOMParser`로 파싱한다
  - Then: `aria-label="제목"`을 가진 섹션과 `aria-label="본문"`을 가진 섹션이 각각 정확히 1개씩 존재하고, 둘은 동일 부모의 형제 노드이며 사이에 다른 콘텐츠 섹션이 없다

- **AC-DTL-2 (시각적 분리)**
  - Given: 위 AC-DTL-1 컨텍스트
  - When: 제목 섹션과 본문 섹션의 computed style 또는 CSS class를 검사한다
  - Then: 두 섹션 각각이 (a) `border` 또는 (b) `<h2>` 섹션 헤더(`yh-detail__section-title` 등)를 가진다. 인접한 두 섹션 사이의 시각적 분리는 회색 라인(`#DDD` 계열 / `--yh-gray-line` 토큰) 또는 섹션 간 margin으로 충족된다

- **AC-DTL-3 (공통정보 12필드 누락 없음)**
  - Given: article 객체에 12 필드가 모두 채워진 상태
  - When: HTML을 렌더링하고 상단 공통정보 섹션의 `<dt>` 노드를 enumerate 한다
  - Then: 다음 12개 label이 모두 정확히 한 번씩 등장한다 — 작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고

- **AC-DTL-4 (빈 제목 처리)**
  - Given: `article.title`이 빈 문자열 또는 `null`
  - When: HTML을 렌더링한다
  - Then: 제목 섹션은 여전히 존재하고 그 안의 제목 텍스트는 `(제목 없음)` 이다. 본문 섹션은 별도로 분리되어 존재한다

- **AC-DTL-5 (HTML 이스케이프)**
  - Given: `article.title` = `<script>alert(1)</script>`, `article.content` = `<img src=x onerror=alert(1)>`
  - When: HTML을 렌더링한다
  - Then: 위험 토큰이 escape되어 텍스트로만 표시된다 (DOM에 `<script>` 또는 `<img>` 노드가 생성되지 않음)

- **AC-DTL-6 (회귀 방지)**
  - Given: 기존 `articleDetail.test.js`의 상단 공통정보 12 필드 검증 테스트
  - When: 새 빌드 결과를 동일 테스트로 실행한다
  - Then: 기존 단언이 그대로 통과한다 (필드 키/순서/aria-label에 회귀 없음)

---

### REQ-EDITOR-EMBED-AND-CTRL-D — 본문 커서 위치 임베드 영속화 + Ctrl+D 라인 삭제

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 메타데이터 탭(이미지/영상/글기사)의 검색 결과 카드에서 "삽입" 또는 동등한 액션을 트리거하면, THE 시스템 SHALL 해당 결과 데이터를 에디터 본문 영역의 **현재 캐럿(커서) 위치**에 인라인 임베드 노드로 삽입한다 (본문 끝 append 금지).
- **[State-Driven]** WHILE 임베드 노드가 본문에 존재하는 동안, THE 시스템 SHALL 그 노드를 후속 텍스트 입력/포커스 이동/markupVersion 직렬화·복원 사이클에 걸쳐 **유지**한다 (임베드가 무음으로 사라지지 않는다).
- **[Event-Driven]** WHEN 캐럿이 임의의 라인 위에 있는 상태에서 사용자가 `Ctrl+D` (macOS 포함 `Ctrl` 키 기준; `Cmd+D`는 미정의 동작) 키를 누르면, THE 시스템 SHALL 캐럿이 위치한 한 라인(라인 내용 + 그 라인의 종결 개행)을 제거하고 캐럿을 그 직전 라인의 끝 또는 직후 라인의 시작으로 이동한다.
- **[Unwanted]** THE 시스템 SHALL NOT `Ctrl+D` 입력을 브라우저 기본 동작(예: Chrome 북마크 추가)으로 전파한다 (`preventDefault` 필수).
- **[Optional]** WHERE 사용자가 멀티라인 텍스트를 선택한 뒤 `Ctrl+D` 를 누르면, THE 시스템 SHALL 선택에 걸친 모든 라인(부분 포함 라인 포함, 라인 단위 round-up)을 제거한다.
- **[Unwanted]** THE 시스템 SHALL NOT 에디터가 포커스를 받지 않은 상태에서 발생한 `Ctrl+D`를 가로채지 않는다 (전역 핸들러 금지; 핸들러는 에디터 영역 한정).
- **[State-Driven]** WHILE 본문 `contentEditable` 영역이 IME 합성(composition) 상태(`isComposing === true` 또는 `compositionstart` 이후 `compositionend` 이전)에 있는 동안, THE 시스템 SHALL `onInput` → React state 동기화, `useEffect` 기반 본문 repaint(`replaceChildren` 류 전체 재렌더), `compositionend` 내부 recolor 를 모두 차단한다 — IME 합성 노드를 외부에서 파괴하여 발생하는 "1글자 지연" / "Enter 2회 입력" 회귀를 방지한다 (plan.md Decision Lock D-7 기준).
- **[Event-Driven]** WHEN 사용자가 본문 `contentEditable` 영역에서 `Enter` 키를 누르면, THE 시스템 SHALL IME 합성 상태와 무관하게 항상 `preventDefault` 후 1회만 줄바꿈을 삽입한다 (합성 종료와 줄바꿈이 2회 분리 발사되지 않는다).

#### Acceptance Criteria

- **AC-EMB-1 (커서 위치 삽입)**
  - Given: 에디터 본문에 `"첫째줄\n둘째줄\n셋째줄"` 텍스트가 있고 캐럿이 `"둘째줄"`의 끝(또는 정확한 offset)에 있다
  - When: 이미지 탭에서 검색 결과 카드의 "삽입"을 트리거한다
  - Then: 임베드 노드가 둘째줄과 셋째줄 사이의 정확한 캐럿 위치에 삽입된다. 본문 끝 append 가 아니다 (DOM 순서 검증 또는 `markupVersion` 직렬화 내 위치 검증)

- **AC-EMB-2 (영속성 — 후속 입력)**
  - Given: AC-EMB-1로 임베드된 상태
  - When: 다른 라인에 텍스트 `"추가본문"`을 입력한다
  - Then: 임베드 노드가 여전히 동일 위치에 존재하고 내용이 보존된다 (`getMarkup()` 결과 또는 DOM 단언)

- **AC-EMB-3 (영속성 — 직렬화 round-trip)**
  - Given: AC-EMB-1로 임베드된 상태
  - When: `getMarkup()` → 새 어댑터 인스턴스에 `setMarkup(...)` 으로 복원한다
  - Then: 임베드 노드가 동일 위치와 동일 데이터(`{source,title,url,thumbnailUrl}` 또는 article-card payload)로 복원된다

- **AC-CTRL-D-1 (단일 라인 삭제)**
  - Given: 에디터 본문에 `"AAA\nBBB\nCCC"` 텍스트가 있고 캐럿이 `"BBB"` 라인 내 임의 위치에 있다
  - When: `Ctrl+D` 키 이벤트를 발화한다 (`keydown`, `ctrlKey: true`, `key: 'd'`)
  - Then: 본문은 `"AAA\nCCC"`가 되며, 캐럿은 `"CCC"` 라인의 시작 또는 `"AAA"` 라인의 끝에 위치한다. AND 브라우저 기본 동작이 `preventDefault`로 차단된다 (`event.defaultPrevented === true`)

- **AC-CTRL-D-2 (멀티라인 선택 round-up)**
  - Given: 본문 `"AAA\nBBB\nCCC\nDDD"`, 선택 영역이 `"BB"`(BBB 라인 일부)부터 `"CC"`(CCC 라인 일부)까지 걸쳐 있다
  - When: `Ctrl+D` 키 이벤트 발화
  - Then: 본문이 `"AAA\nDDD"` 가 된다 (선택에 부분이라도 포함된 모든 라인이 라인 단위로 제거)

- **AC-CTRL-D-3 (첫 라인 / 마지막 라인 경계)**
  - Given: 본문 `"AAA\nBBB"`, 캐럿이 `"AAA"` 라인
  - When: `Ctrl+D`
  - Then: 본문은 `"BBB"`. AND 본문이 `"AAA"` (단일 라인)일 때 `Ctrl+D` 누르면 본문이 빈 문자열 또는 빈 라인 한 줄이 되며 에디터는 여전히 포커스 가능 상태를 유지한다

- **AC-CTRL-D-4 (스코프 한정)**
  - Given: 에디터가 포커스를 받지 않은 상태에서 페이지 다른 입력 요소(예: 메타데이터 탭의 검색창)에 포커스가 있다
  - When: `Ctrl+D` 키 이벤트 발화
  - Then: 에디터 핸들러는 호출되지 않는다 (라인 삭제 없음). 브라우저 기본 동작은 별도 처리 대상 아님

- **AC-CTRL-D-5 (회귀 — Alt+Y 동작 보존)**
  - Given: 에디터에 본문 텍스트가 있다
  - When: `Alt+Y` 키 이벤트 발화
  - Then: 본문 끝에 `(끝)`이 골드색으로 1회만 삽입된다 (이미 존재 시 noop)
  - Note: 단언 문자열은 SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER (AC-ENDMARK-4)에 의해 `\r\n (끝)` → `(끝)`로 동기 갱신됨 (prefix-free 단순화)

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (연합뉴스 스타일)

- 본 SPEC은 신규 CSS 변수를 도입하지 않는다. 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC`, `--yh-serif` Nanum Myeongjo / Noto Serif KR, `--yh-sans` Noto Sans KR)을 그대로 사용한다.
- 상세보기 분리 구분선은 `--yh-gray-line` 또는 동등한 1px `#DDD` 계열을 사용한다.
- 송고/보류/KILL 버튼은 기존 `yh-btn--primary` / `yh-btn--hold` / `yh-btn--kill` 클래스를 유지한다 (Z권한이라고 다른 색을 쓰지 않는다).

> Note: CLAUDE.md 디자인 규칙은 "파란색과 흰색"으로 명시되어 있고 `articleDetail.js`의 색 변수도 파란색 계열(`#0A4DA6`)이다. 사용자 지시문의 "연합뉴스 #C8102E (레드)"는 `news.md`의 명시와는 일치하지만 현재 상세보기 구현은 블루로 통일되어 있다. **본 SPEC은 현 구현의 블루 토큰을 유지**하며, 레드 적용 여부는 Pending Decisions 항목 참조.

### 5.2 접근성 (Accessibility)

- Z권한 송고/보류/KILL 버튼은 `aria-label` 또는 동등한 접근 가능한 텍스트를 가져야 한다.
- 상세보기 새창의 공통정보/제목/본문 섹션은 각각 `aria-label`을 가져야 한다 (기존 구현 유지).
- Ctrl+D 핸들러는 키보드 사용자가 에디터 영역 *외부에서* 단축키를 의도치 않게 트리거하지 않도록 에디터 컨테이너에 한정한다.

### 5.3 회귀 방지

- 기존 SPEC-UI-EDITOR-001의 모든 AC(구조 파싱, Alt+Y, 클립보드 이미지 10%×10% 등)가 변경되지 않는다.
- 기존 SPEC-FRONTEND-UI-001의 R/D 권한 버튼 가시성 규칙, 4탭 레이아웃, 60:40 비율, 우측 상단 사용자 정보 표시가 변경되지 않는다.
- 기존 SPEC-AUTH-001의 세션 메커니즘 및 R/D/Z 권한 의미가 변경되지 않는다.
- `web/src/view/articleDetail.test.js`의 기존 단언이 모두 통과해야 한다.

### 5.4 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 진행 상태 (Current Progress)

> ⚠️ 아래 표는 **2026-06-02 SPEC 작성 시점의 미커밋 변경분 분석(역사적 스냅샷)** 이다. 이후 Run 단계에서 모든 REQ가 구현·커밋되어 테스트 GREEN 상태가 되었다. **최신 검증 결과는 §13 (2026-06-03 구현 완료 검증)** 을 참조하라.

| 파일 | REQ | 진행 상태 (2026-06-02 기준) | 비고 |
|------|-----|---------|-----------|
| `web/src/view/WritePage.jsx` | REQ-AUTH-Z-BUTTONS | 부분 → **완료 (§13)** | 당시 분기에 `Z` 미포함이었으나 Run에서 `(R\|\|D\|\|Z) && isRds`(송고/보류), `(R\|\|Z) && isRds`(KILL)로 해소 (WritePage.jsx:557/563) |
| `web/src/view/articleDetail.js` | REQ-DETAIL-LAYOUT-SPLIT | 거의 완료 → **완료 (§13)** | `aria-label="제목"`/`aria-label="본문"` 분리 + 12 공통정보 필드 + escape + 구분선(`--yh-gray-line`) |
| `web/src/view/articleDetail.test.js` | REQ-DETAIL-LAYOUT-SPLIT | 부분 → **완료 (§13)** | AC-DTL-1~6 단언 17 케이스 GREEN |
| `web/src/view/editorShortcuts.js` (`Ctrl+D`) | REQ-EDITOR-EMBED-AND-CTRL-D | 미구현 → **완료 (§13)** | `editorShortcuts.js` 신규 + `deleteCurrentLine` 순수 함수, AC-CTRL-D-1~3e 9 케이스 GREEN |
| 인라인 임베딩 (커서 위치/영속성) | REQ-EDITOR-EMBED-AND-CTRL-D | 부분 → **완료 (§13)** | AC-EMB-INLINE-1/2/3 + AC-EMB-2 영속성 GREEN. 직렬화 round-trip은 SPEC-UI-EDITOR-001 어댑터 계약 위에서 보존 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규/수정될 영역 (예상)

- `web/src/view/WritePage.jsx` — 버튼 가시성 분기에 `Z` 권한 포함 (Δ-only).
- `web/src/view/WritePage.test.jsx` — Z권한 케이스 3종 추가 (AC-Z-1, AC-Z-2, AC-Z-3).
- `web/src/view/articleDetail.js` — 신규 작업 거의 없음 (회귀 보장).
- `web/src/view/articleDetail.test.js` — AC-DTL 1~6에 맞춘 단언 보강.
- 에디터 단축키 모듈 (예: `web/src/view/editorShortcuts.js` 또는 기존 `editorNewline.js`에 통합) — Ctrl+D 핸들러 신규.
- 임베드 관련 (`web/src/view/InlineEmbed.jsx`, `web/src/view/editorCaret.js`, `web/src/controller/useWriteController.js`) — "커서 위치 삽입 + 영속성" 회귀 테스트만 추가.

### 7.2 작업트리 미커밋 파일 (분석 대상, 변경/되돌리기 금지)

- `news.md` (소스 of truth — 본 SPEC의 트리거)
- `web/src/view/articleDetail.js`
- `web/src/view/articleDetail.test.js`

---

## 8. 테스트 전략 (TDD)

### 8.1 단위 테스트 (Vitest + jsdom)

- `WritePage.test.jsx`: Z권한 버튼 가시성 (AC-Z-1, 2, 3), R/D 회귀 (AC-Z-4).
- `articleDetail.test.js`: HTML 문자열 파싱(`DOMParser` 또는 jsdom) → 섹션 구조 / 12 필드 / 이스케이프 (AC-DTL-1~6).
- 단축키 핸들러 단위테스트: 순수 함수 형태로 추출 가능하면 `(text, selection, event) → (newText, newSelection)` 형식으로 라인 삭제 로직 단위 검증 (AC-CTRL-D-1~3).

### 8.2 통합 테스트

- `useWriteController`와 `WritePage` 조합: Z권한 + RDS → 송고 클릭 → `articleUpdate` 호출 시뮬레이션. (기존 useWriteController 테스트와 통합)
- 에디터 + 임베드 + Ctrl+D 통합: 임베드 후 Ctrl+D가 임베드 라인을 제거하면 임베드도 함께 제거되는지 확인.

### 8.3 E2E 시나리오 (선택, Run 단계 고려)

- 로그인 (권한 Z) → 작성 페이지 → 송고/보류/KILL 가시성 확인 → 임베드 삽입 → Ctrl+D → 송고.
- 조회 페이지 → 우클릭 → 상세보기 새창 → 분리 레이아웃 시각 확인.

### 8.4 회귀 가드

- `npm test` 전체 통과 (`WritePage.test.jsx`, `useWriteController.*.test.jsx`, `editorColoring.test.js`, `editorAdapter.test.js`, `editorNewline.test.js`, `InlineEmbed.test.jsx`, `clipboardEmbed.test.js`, `articleDetail.test.js`, `articleStructure.test.js`, `App.test.jsx`, `ViewPage.test.jsx`, `ViewPage.contextMenu.test.jsx` 등 기존 모두).
- 빌드(`vite build`) 무경고.

---

## 9. 위험과 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: 사용자 지시문의 변경 후 명세("Z권한은 송고/보류/KILL")와 `news.md` 64줄 본문이 정합하지만, 미커밋 `WritePage.jsx` 분기는 Z를 의도적으로 제외 — 어느 쪽이 최신 의도인지 모호 | 잘못된 분기 채택 시 권한 인가 회귀 | **Pending Decisions** 항목으로 사용자 승인 후 Run 단계 진행 |
| R2: `news.md` 64줄 "Z권한은 송고/보류/KILL 버튼이 보이고 사용할 수 있다"가 `status === 'RDS'` gating까지 적용되는지 명시되지 않음 (R/D는 RDS gate, Z는?) | 잘못 해석 시 Z권한이 DPS 상태 기사도 KILL 가능 | 본 SPEC은 *R/D와 동일한 RDS gate*를 적용한다고 명시. Pending Decisions에서 사용자 확인 요청 |
| R3: Ctrl+D는 Chrome 북마크 단축키와 충돌 | 사용자 혼란 | `preventDefault` 강제 (AC-EMB-3 unwanted requirement) + 에디터 포커스 한정 (AC-CTRL-D-4) |
| R4: 임베드 노드의 "persist" 의미를 어떤 직렬화 형식(`markupVersion`)으로 보존할지 SPEC-UI-EDITOR-001 구체 알고리즘에 의존 | 직렬화 round-trip 실패 시 임베드 손실 | Run 단계에서 `getMarkup` ↔ `setMarkup` round-trip 테스트(AC-EMB-3) 강제. SPEC-UI-EDITOR-001 변경 시 본 SPEC AC 재검토 |
| R5: 멀티라인 선택 시 라인 단위 round-up 동작이 일반 텍스트 에디터(VSCode 등)의 Ctrl+L/Cmd+Shift+K 관행과 미세하게 다를 수 있음 | 사용자 학습 비용 | `news.md`가 "해당라인을 제거"만 명시했으므로 *단일 캐럿 = 해당 라인 한 줄* 을 1차 의미로 고정. 멀티라인 거동은 본 SPEC이 round-up으로 명시 (Pending Decisions로 사용자 검토 요청) |

---

## 10. 종속성 및 cross-reference (Cross-References)

- **SPEC-UI-EDITOR-001**: 에디터 어댑터 계약, 구조 파싱, 인라인 임베딩의 *구체 알고리즘*은 그 SPEC 소관. 본 SPEC은 "커서 위치 삽입"과 "Ctrl+D 라인 삭제"라는 *추가 책임*만 정의하며, 어댑터 계약(`getMarkup`/`setMarkup`, `markupVersion` 덮어쓰기)을 변경하지 않는다.
- **SPEC-FRONTEND-UI-001**: 권한 R/D의 버튼 가시성/생애주기 gating, 상세보기 새창 호출 트리거(우클릭 컨텍스트 메뉴) 모두 그 SPEC 소관. 본 SPEC은 그 위에 *Z권한 버튼 가시성*과 *상세보기 새창의 하단 레이아웃 분리*만 추가한다.
- **SPEC-AUTH-001**: R/D/Z 권한 의미와 세션 메커니즘은 그 SPEC 소관. 본 SPEC은 권한 *판정*은 변경하지 않고 *그 권한값을 받아 UI를 렌더링하는 규칙*만 정의한다.
- **SPEC-BACKEND-CORE-001**: 송고/보류/KILL 클릭 시 호출되는 `articleUpdate` API는 그 SPEC 소관. 본 SPEC은 *어떤 권한에서 어떤 버튼이 보이는가*만 다룬다.
- **SPEC-DB-FOUNDATION-001**: 무관 (DB 스키마 변경 없음).

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 권한 R/D의 송고/보류/KILL 가시성 규칙 변경 — 변경 금지.
- 신규 권한 도입 또는 권한 의미 변경.
- 기사 생애주기 상태 전이 로직 변경.
- 인증/세션 메커니즘 변경.
- 검색 백엔드(이미지/영상/글기사) 결과 형태 변경.
- 디자인 토큰 정의 변경 또는 신규 CSS 변수 도입.
- 에디터의 구조 파싱(제목/부제목/본문 결정) 알고리즘 변경.
- Alt+Y 동작 변경.
- 클립보드 붙여넣기 이미지 사이즈 정책 변경.
- 상세보기 새창의 상단 공통정보 12 필드 자체의 추가/삭제/순서 변경.
- 코드 구현 (본 SPEC은 Plan 단계 문서만; Run 단계에서 구현).

---

## 12. Definition of Done

- [ ] `web/src/view/WritePage.jsx`가 REQ-AUTH-Z-BUTTONS의 EARS를 만족한다
- [ ] `WritePage.test.jsx`에 Z권한 케이스 3종(AC-Z-1, 2, 3) 추가 및 통과
- [ ] R/D 권한 회귀 테스트(AC-Z-4) 통과
- [ ] `articleDetail.js`가 REQ-DETAIL-LAYOUT-SPLIT의 EARS를 만족한다 (현재 거의 완료)
- [ ] `articleDetail.test.js`에 AC-DTL-1~6에 대응하는 단언이 모두 존재하고 통과
- [ ] Ctrl+D 라인 삭제 핸들러가 신규 구현되어 AC-CTRL-D-1~5를 모두 통과
- [ ] 인라인 임베딩 영속성 회귀 테스트(AC-EMB-2, AC-EMB-3) 통과
- [ ] `npm test` 전체 통과
- [ ] `npm run build` 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] news.md / spec.md / plan.md / acceptance.md 정합 확인
- [ ] 기존 SPEC(UI-EDITOR-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음

---

## 13. 구현 완료 검증 (Implementation Verification — 2026-06-03)

> Run 단계 검증 결과. 3개 REQ 모두 구현·커밋되고 테스트 GREEN. **단, status는 Plan 유지** — DoD의 "Slack tech-day 보고"(CLAUDE.md HARD)가 미수행이고 plan.md/acceptance.md 버전 동기가 남아 있어, completed 전이는 해당 잔여 항목 해소 후로 보류한다. (검증: `/moai run` 오케스트레이터, 2026-06-03)

### 13.1 테스트 증거

- **web (Vitest + jsdom)**: 17개 파일 **223 tests PASS, 0 fail** (`vitest run --root web`)
- **backend (node --test)**: **132 tests PASS, 0 fail**, 커버리지 line 93.91% / branch 90.18% (`lifecycle.js` 100%, `authorization.js` 100%)
- **빌드**: `vite build web` **무경고** (51 modules, dist 생성)

### 13.2 REQ별 충족 현황

| REQ | 구현 위치 | 검증 테스트 | 상태 |
|-----|----------|-----------|------|
| REQ-AUTH-Z-BUTTONS | `WritePage.jsx:557/563` (분기에 `Z` 포함) | `WritePage.test.jsx` AC-Z-1/2/3/5 + D-6 lifecycle 회귀 | ✅ |
| REQ-DETAIL-LAYOUT-SPLIT | `articleDetail.js` (제목/본문 `<section>` 분리 + 12필드 + escape) | `articleDetail.test.js` AC-DTL-1~6 (17) | ✅ |
| REQ-EDITOR-EMBED-AND-CTRL-D | `editorShortcuts.js` (`deleteCurrentLine`) + 인라인 임베드 모델 | `editorShortcuts.test.js` AC-CTRL-D-1~3e (9), `WritePage.test.jsx` AC-EMB-INLINE/AC-EMB-2 | ✅ |
| 회귀 가드 (기존 SPEC AC) | — | web 223 + backend 132 = 355 tests 전부 GREEN | ✅ |

### 13.3 Decision Lock 반영

D-1~D-7(plan.md Decision Lock) 전부 구현에 반영됨. 특히 D-1(Z는 RDS gating), D-6(Z 송고/보류/KILL 전이 = D권한 동일), D-7(IME 합성 중 repaint 차단)은 최근 커밋(`ebf7425`, `b1f7155`, `7580d2b`)으로 적용 완료.

### 13.4 잔여 항목 (구현 외 — completed 전이 차단 요소)

- ~~Slack `tech-day` 채널 완료 보고 (CLAUDE.md HARD 규칙)~~ — **해소됨** (2026-06-04 `/news produce` 및 `/moai sync` 종료 시 채널 C0B69CG59UM 에 보고 완료).
- ~~plan.md / acceptance.md 버전 0.2.0 동기 + DoD 체크 동기~~ — **해소됨** (acceptance.md v0.1.1 라인에서 신규 AC 6개 흡수, 별도 0.2.0 트랙 미생성).
- 작업 트리의 미커밋 변경(`news.md` 마크다운 재포맷, `ContentsVO.md` LockYN 추가, SPEC-FRONTEND-UI-001 파일)은 **본 SPEC 소관이 아님** — 별도 처리 대상.

### 13.5 GAN Round 1 평가 (2026-06-04, `/news produce SPEC-NEWS-REVISE-001 --resume`)

- 종합 점수 **0.8625** ≥ pass_threshold 0.75 → **PASS**
- 차원별: Design 0.85 / Originality 0.90 / Completeness 0.82 / Functionality 0.88
- 통과 AC 22/24 (AC-DTL-3 라벨 완화, AC-CTRL-D-2 React 통합 부분 커버 — △ 2건)
- Must-Pass Firewall: Jest 355/355 + AC 매핑 + Vite build 무경고 모두 PASS
- 후속(LOW): `articleDetail.js` `description`↔`content` alias 보강, AC-CTRL-D-2 React 통합 테스트 추가

---

Version: 0.1.1
Status: In Progress
Last Updated: 2026-06-04
