---
id: SPEC-NEWS-REVISE-002
version: 0.1.0
status: Plan
created: 2026-06-02
updated: 2026-06-04
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-DB-FOUNDATION-001
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-UI-EDITOR-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-002 — news.md / ContentsVO 개정 사이클 2 (lockYN · 편집 락 · Insert/Update 분기 · 상세보기 본문 강조 · 임베드 삭제 · 미디어 검색 명문화 · Alt+Y "(끝)" 단순화)

## HISTORY

- 2026-06-04 (plan-audit): manager-spec 정합 점검(Plan 인텐트, news.md 무변경 확인). 본 SPEC 의 7 REQ 가 main 커밋 `da26c72` 기준 news.md 헤더(L57~58 미디어, L84 상세보기, L86~88 lockYN, L99~103 워크플로우, L117 임베드 삭제, L120 Alt+Y) 와 1:1 정합 유지. SPEC-NEWS-REVISE-001 v0.1.1 (GAN 0.8625 PASS / 355 tests / AC-CTRL-D-5 `(끝)` 단언 갱신 반영) 을 회귀 가드 기준선으로 확정. status: Plan (untracked) 유지, REQ 본문 변경 없음.
- 2026-06-02 (v0.1.0): 최초 작성. `news.md` / `ContentsVO.md` 신규 개정(2차)을 단일 SPEC, 7개 REQ로 정리.
  (1) ContentsVO에 `lockYN` 컬럼 추가(REQ-DB-LOCKYN),
  (2) 기사 편집 락(배타 편집) 정식 도입(REQ-EDIT-LOCK),
  (3) 작성/편집 송고의 `articleInsert` vs `articleUpdate` API 분기(REQ-API-INSERT-UPDATE-SPLIT),
  (4) 상세보기 새창에서 본문 폰트가 제목 폰트보다 크다(REQ-DETAIL-FONT-EMPHASIS) — `web/src/view/articleDetail.js` / `articleDetail.test.js`의 미커밋 변경분이 본 REQ의 부분 GREEN 자산,
  (5) Alt+Y "(끝)" 삽입 문자열을 `"\r\n (끝)"` → `"(끝)"`로 단순화(REQ-EDITOR-END-MARKER),
  (6) 임베드 노드 본문 내 삭제 가능(REQ-EMBED-DELETE),
  (7) 미디어 검색이 Youtube Data API를 사용한다는 점과 글기사 탭이 내부 기사 DB 검색을 한다는 점을 명문화(REQ-SEARCH-YOUTUBE-API).
  본 SPEC은 SPEC-NEWS-REVISE-001의 후속 차수이며, 기존 SPEC(DB-FOUNDATION-001, BACKEND-CORE-001, FRONTEND-UI-001, UI-EDITOR-001, AUTH-001) 계약을 침범하지 않고 명세 보강(Δ-only)만 추가한다. (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-002 |
| 제목 | news.md / ContentsVO 개정 사이클 2 (lockYN, 편집 락, Insert/Update 분기, 본문 강조, 임베드 삭제, 미디어 검색, Alt+Y 단순화) |
| 상태 | Plan |
| 생성일 | 2026-06-02 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001, SPEC-DB-FOUNDATION-001, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001, SPEC-UI-EDITOR-001, SPEC-AUTH-001 |
| 영향 페이지 | `writer.do` (기사 작성/편집), 상세보기 새창, 메타데이터 탭 |
| 영향 백엔드 | `src/db/schema.js`, `src/models/articleModel.js`, `src/services/articleService.js`, `src/services/mediaSearch.js` |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

`news.md` 및 `ContentsVO.md`의 두 번째 개정 사이클에서 도입된 7가지 동작/스키마 변경을 코드와 테스트에 정합되도록 정식 명세화한다.

1. **ContentsVO에 `lockYN` 컬럼 추가** — 모든 컬럼이 `varchar`로 선언되는 기존 정책을 따라, `lockYN`을 신규 컬럼으로 정식화한다. 기본값은 `'N'`(편집 없음).
2. **기사 편집 락** — `lockYN`을 사용하여 한 기사의 동시 편집을 한 페이지로 제한한다. 다른 세션, 또는 동일 세션의 다른 페이지에서의 편집 진입을 차단한다.
3. **작성/편집 송고의 API 분기** — 신규 작성 컨텍스트에서는 송고/보류 시 `articleInsert`를, 편집 컨텍스트에서는 송고/보류/KILL 시 `articleUpdate`를 호출한다. `articleSelect/Insert/Update`는 모두 기사 생애주기 규칙을 따른다.
4. **상세보기 본문 폰트 > 제목 폰트** — 새창 하단의 본문(.yh-detail__content) 폰트가 제목(.yh-detail__title) 폰트보다 항상 크게 표현된다. 현재 미커밋 작업트리에 부분 구현(`.yh-detail__title 1.3rem` / `.yh-detail__content 1.75rem`)이 존재한다.
5. **Alt+Y "(끝)" 단순화** — Alt+Y 삽입 문자열을 `"\r\n (끝)"` → `"(끝)"`로 단순화 (prefix CRLF/공백 제거). 골드색 적용 및 중복 삽입 금지 규칙은 유지.
6. **임베드 노드 삭제 가능** — 본문에 임베드된 노드(이미지/영상/글기사 카드)를 사용자가 선택하여 삭제할 수 있다. 인접한 다른 임베드/텍스트에는 영향을 주지 않는다.
7. **미디어 검색 명문화** — 이미지/영상 탭의 검색이 Youtube Data API를 호출하고 실패 시 Google Custom Search로 fallback한다는 점, 그리고 글기사 탭은 내부 기사 DB(Article+Contents) 검색을 사용한다는 점을 EARS로 고정한다 (기존 `mediaSearch.js` 의도 회귀 가드).

`why`: `news.md` / `ContentsVO.md`가 시스템의 source-of-truth이며, 신규 개정(2차)이 SPEC-NEWS-REVISE-001 직후 추가되었다. 정합 명세 없이 구현하면 (a) 락 충돌로 인한 데이터 손실, (b) `articleInsert`/`articleUpdate` 오호출에 의한 lifecycle 위반, (c) 상세보기 시각 회귀, (d) Alt+Y 회귀 가드 잠금 충돌(SPEC-NEWS-REVISE-001 AC-CTRL-D-5)이 발생한다. 본 SPEC은 그 정합성을 EARS 형식으로 고정한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- `Contents` 테이블의 `lockYN` 컬럼 추가 (`src/db/schema.js`, `src/models/articleModel.js`)
- `ContentsVO.md`의 `lockYN` 필드 명문화 흡수 (미커밋 변경분 정렬)
- 편집 락 획득/검증/해제 백엔드 서비스 (`src/services/articleService.js` 확장 또는 신규 모듈) 및 API
- 프론트엔드 락 통합 (`web/src/controller/useWriteController.js` 진입/해제, `web/src/view/WritePage.jsx` 거부 안내)
- 작성(신규 articleId 미할당) vs 편집(`editArticleId` 보유) 컨텍스트에 따른 `articleInsert` / `articleUpdate` 분기
- 상세보기 새창 CSS: 본문 폰트 > 제목 폰트 (현재 부분 GREEN 흡수 + AC 가드 보강)
- Alt+Y "(끝)" 단순화 및 SPEC-NEWS-REVISE-001 AC-CTRL-D-5 회귀 가드 갱신
- 임베드 노드 삭제 어포던스 및 단일 노드 제거 동작
- 미디어 검색의 Youtube API + Google fallback 명문화, 글기사 탭 내부 검색 명문화

### 2.2 제외 (Out of Scope)

- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 기사 작성기만")
- R/D/Z 권한 의미 변경 (SPEC-AUTH-001 유지)
- lifecycle 전이 표(R/D/Z × send/hold/kill) 변경 (SPEC-NEWS-REVISE-001 D-6 유지)
- 디자인 토큰 신규 도입 (기존 `--yh-blue` `#0A4DA6`, `--yh-gray-line` 등 재사용)
- 클립보드 붙여넣기 이미지 사이즈 정책 변경 (10% × 10% 유지)
- 상세보기 새창 상단 공통정보 12 필드 목록 변경 (SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT 유지)
- 에디터의 구조 파싱(제목/부제목/본문 결정) 알고리즘 변경 (SPEC-UI-EDITOR-001 소관)
- 인증/세션 메커니즘 변경 (SPEC-AUTH-001 유지)
- 락 분산 처리(다중 서버) 또는 Redis 등 외부 락 스토어 도입 — 본 SPEC은 단일 SQLite 인스턴스 기준
- 코드 구현 (본 SPEC은 Plan 단계 문서만)

---

## 3. 사용자 시나리오 (User Scenarios — 권한 R/D/Z 관점)

### 3.1 권한 R (기자 리포터) — 신규 작성

- 기사 작성페이지(`writer.do`, 신규 컨텍스트)에 진입한다.
- 락 진입 단계 없음(신규 작성은 articleId 미할당). 본문 작성 → 송고 → 시스템이 **`articleInsert`** 호출 → DB에 새 기사가 RDS 상태로 적재.

### 3.2 권한 R / D / Z — 데스크 미송고 편집

- 데스크 미송고 페이지에서 RDS 기사를 우클릭 → 편집 → 시스템이 해당 기사의 `lockYN`을 확인.
  - `lockYN === 'N'` (또는 락 보유자가 본인+동일 세션+동일 페이지) → 락 획득(`lockYN := 'Y'`, locker 갱신) → 작성 페이지로 진입.
  - `lockYN === 'Y'` 이고 락 보유자가 본인 아님 → 안내 ALERT + 진입 거부.
- 편집 완료 후 송고/보류/KILL → 시스템이 **`articleUpdate`** 호출 → lifecycle 전이 적용 → 락 해제(`lockYN := 'N'`).
- 사용자가 송고를 안 누르고 페이지를 떠나거나 브라우저를 닫으면 → cleanup 신호로 락 해제.

### 3.3 권한 Z — 동시 편집 차단

- Z 사용자가 RDS 기사 편집을 시도한다.
- 같은 기사를 다른 사용자(또는 동일 사용자의 다른 페이지/세션)가 이미 편집 중(`lockYN === 'Y'`)이면 → 거부.
- 거부 메시지: "해당 기사는 다른 페이지/세션에서 편집 중입니다."

### 3.4 모든 권한 — 상세보기 새창

- 조회 페이지에서 우클릭 → 상세보기 → 새창.
- 상단: 공통정보 12 필드 (SPEC-NEWS-REVISE-001 유지).
- 하단: 제목 블록과 본문 블록이 분리되어 보이며, **본문의 폰트 사이즈가 제목의 폰트 사이즈보다 크다** (시각적 강조).

### 3.5 모든 권한 — 에디터 동작

- 메타데이터 탭(이미지/영상/글기사) 검색 결과의 카드를 본문에 임베드한다 (커서 위치, SPEC-NEWS-REVISE-001 AC-EMB-1).
- 임베드된 카드를 클릭/포커스한 뒤 Backspace 또는 노드의 어포던스(예: × 버튼) 클릭 → 해당 카드만 삭제. 인접 텍스트 및 다른 임베드는 보존.
- 본문 끝에 Alt+Y → `"(끝)"`이 삽입(prefix 없음)되며 골드색. 이미 존재 시 noop.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-DB-LOCKYN — ContentsVO에 lockYN 컬럼 추가 (Priority: High)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL `Contents` 테이블에 `lockYN` 컬럼을 보유한다 (varchar; 의미값 `'Y'`/`'N'`).
- **[Ubiquitous]** THE 시스템 SHALL 신규 행 삽입 시 `lockYN` 컬럼이 지정되지 않으면 기본값 `'N'`을 적용한다.
- **[Ubiquitous]** THE 시스템 SHALL `articleSelect` / `articleInsert` / `articleUpdate` 의 행 직렬화/역직렬화에 `lockYN`을 포함한다 (`createArticleModel`의 insert/findById/query 결과 모두).
- **[Unwanted]** THE 시스템 SHALL NOT `lockYN`을 nullable로 허용하지 않는다 (NULL 금지; 기본값 `'N'`).
- **[State-Driven]** WHILE 신규 DB가 처음 생성될 때, THE 시스템 SHALL `Contents` DDL에 `lockYN VARCHAR NOT NULL DEFAULT 'N'`을 포함한다.

#### Acceptance Criteria 포인터

- AC-LOCKYN-1 (스키마 단언), AC-LOCKYN-2 (기본값), AC-LOCKYN-3 (직렬화 round-trip) — acceptance.md §1

---

### REQ-EDIT-LOCK — 기사 편집 락 (배타 편집) (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 기사 편집 진입을 요청(예: `editArticleId` 보유 상태로 `writer.do` 진입)하면, THE 시스템 SHALL 해당 기사의 `lockYN` 상태를 검사한 후 락이 비어 있을 때(`'N'`)만 `lockYN := 'Y'`로 갱신하고 락 보유자 정보(`lockerUserId`, `lockerSessionId`)를 기록한 뒤 편집 페이지 진입을 허용한다.
- **[State-Driven]** WHILE `lockYN === 'Y'`이고 요청자가 현재 락 보유자가 아닌 경우, THE 시스템 SHALL 해당 사용자에게 편집 페이지 진입을 거부하고 안내 메시지("해당 기사는 다른 페이지/세션에서 편집 중입니다.")를 표시한다.
- **[Unwanted]** THE 시스템 SHALL NOT 동일 기사의 편집 페이지를 두 세션 또는 동일 세션의 다른 페이지에서 동시에 열도록 허용한다 (배타성 보장).
- **[Event-Driven]** WHEN 편집 페이지에서 송고/보류/KILL이 성공적으로 처리되거나, 사용자가 명시적으로 편집을 종료하거나, 세션이 종료되거나, 브라우저가 닫히는 신호(`beforeunload` 또는 `visibilitychange:hidden` + `sendBeacon`) 가 발생하면, THE 시스템 SHALL 해당 기사의 `lockYN`을 `'N'`으로 해제하고 락 보유자 정보를 비운다.
- **[Optional]** WHERE 좀비 락 방지 정책이 활성화된 경우, THE 시스템 SHALL 마지막 갱신 시간(`lockedAt`) 이후 일정 시간(기본 30분, Pending Decision D2-3)이 경과한 락을 자동으로 해제한다.
- **[Unwanted]** THE 시스템 SHALL NOT 락이 비어 있지 않은 기사에 대해 (락 보유자가 아닌 요청자의) `articleUpdate` 호출을 적용한다 (편집 락은 articleUpdate 적용에도 자동 검증된다).

#### Acceptance Criteria 포인터

- AC-EDIT-LOCK-1 (락 획득 성공), AC-EDIT-LOCK-2 (락 충돌 거부), AC-EDIT-LOCK-3 (락 해제 후 재획득), AC-EDIT-LOCK-4 (`beforeunload` 해제), AC-EDIT-LOCK-5 (동일 사용자 다른 페이지 거부), AC-EDIT-LOCK-6 (articleUpdate 자동 검증) — acceptance.md §2

---

### REQ-API-INSERT-UPDATE-SPLIT — 작성/편집 송고의 API 분기 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 신규 작성 컨텍스트(`articleId === 'A-DRAFT'` 또는 동등한 미할당 상태)에서 송고 또는 보류 버튼을 클릭하면, THE 시스템 SHALL `articleInsert` API를 호출하여 새 기사를 `Article` / `Contents` 테이블에 적재한 뒤 lifecycle 전이를 적용한다.
- **[Event-Driven]** WHEN 사용자가 편집 컨텍스트(`editArticleId` 보유 또는 모델이 로드한 기존 articleId)에서 송고/보류/KILL 버튼을 클릭하면, THE 시스템 SHALL `articleUpdate` API를 호출하여 기존 기사의 markupVersion / Contents 필드를 갱신한 뒤 lifecycle 전이를 적용한다.
- **[Ubiquitous]** THE 시스템 SHALL `articleInsert` / `articleUpdate` / `articleSelect`의 상태 전이를 항상 `src/services/lifecycle.js`의 `transition()` 규칙을 따른다 (`TRANSITIONS` 테이블).
- **[Unwanted]** THE 시스템 SHALL NOT 신규 작성 컨텍스트에서 `articleUpdate`를 호출하지 않으며, 편집 컨텍스트에서 `articleInsert`를 호출하지 않는다.
- **[State-Driven]** WHILE 송고/보류 클릭 시 제목이 비어 있으면, THE 시스템 SHALL ALERT("제목이 없어 송고/보류할 수 없습니다.")를 표시하고 어떤 API도 호출하지 않는다 (기존 동작 유지).
- **[Ubiquitous]** THE 시스템 SHALL 권한 R/D/Z에 대해 동일한 분기 규칙을 적용한다 (분기 기준은 권한이 아닌 컨텍스트).

#### Acceptance Criteria 포인터

- AC-API-1 (신규 작성→Insert), AC-API-2 (편집→Update), AC-API-3 (편집+KILL→Update), AC-API-4 (제목 없음 ALERT 회귀), AC-API-5 (lifecycle 규칙 일관) — acceptance.md §3

---

### REQ-DETAIL-FONT-EMPHASIS — 상세보기 본문 폰트 > 제목 폰트 (Priority: Medium)

[SUPERSEDED by SPEC-NEWS-REVISE-013 — 상세보기 별도 제목 요소 폐지] 본 REQ 전체(본문 폰트 > 제목 폰트 비교 + AC-FONT-1~4)는 더 이상 요구되지 않는다. 상세보기 `기사` 영역에서 별도 제목 요소(`.yh-detail__title`)가 폐지되어 비교 대상 자체가 소멸한다. SPEC-NEWS-REVISE-001 AC-DTL-1~6 충족 요구(아래 EARS 마지막 줄)도 제목 요소 부재로 AC-NOTITLE-* 로 대체된다.

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 상세보기 새창의 본문 블록(`.yh-detail__content`) `font-size`를 제목 블록(`.yh-detail__title`) `font-size`보다 크게 설정한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본문 폰트 사이즈가 제목 폰트 사이즈와 같거나 작은 상태를 허용하지 않는다 (시각 회귀 금지).
- **[State-Driven]** WHILE `article.title`이 비어 있어 제목 자리에 `(제목 없음)` 플레이스홀더가 들어가는 경우라도, THE 시스템 SHALL 본문 폰트 사이즈가 제목 폰트 사이즈보다 큰 관계를 유지한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-001 AC-DTL-1~6 (분리 구조, 12 필드, 이스케이프, 회귀 가드)를 그대로 충족한다. [SUPERSEDED by SPEC-NEWS-REVISE-013: AC-DTL-1/4 의 제목 요소 존재 전제는 폐지. 12 필드/이스케이프는 AC-NOTITLE-4 로 계승]

#### Acceptance Criteria 포인터

- AC-FONT-1 (CSS 룰 단언 — body > title), AC-FONT-2 (jsdom getComputedStyle 비교 또는 정규식 fallback), AC-FONT-3 (빈 제목 케이스), AC-FONT-4 (SPEC-NEWS-REVISE-001 회귀) — acceptance.md §4

---

### REQ-EDITOR-END-MARKER — Alt+Y "(끝)" 단순화 (Priority: Low)

#### EARS 문장

- **[Event-Driven]** WHEN 에디터가 포커스를 가진 상태에서 Alt+Y 키 이벤트가 발생하면, THE 시스템 SHALL 본문 끝에 정확히 `"(끝)"` 문자열(prefix CRLF/공백 없음)을 1회 삽입하고 골드색 스타일을 적용한다.
- **[State-Driven]** WHILE 본문의 끝에 이미 `"(끝)"`가 존재하면, THE 시스템 SHALL 추가 삽입을 수행하지 않는다 (noop).
- **[Unwanted]** THE 시스템 SHALL NOT `"\r\n (끝)"` 형식(개행+공백 prefix가 포함된 구 형식)을 삽입하지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-001 AC-CTRL-D-5의 회귀 단언을 본 SPEC을 통해 `"(끝)"`로 갱신하여 본 SPEC의 단언과 정합시킨다 (단언 문자열 동기화).

#### Acceptance Criteria 포인터

- AC-ENDMARK-1 (정확한 문자열), AC-ENDMARK-2 (이미 존재 시 noop), AC-ENDMARK-3 (골드색), AC-ENDMARK-4 (SPEC-NEWS-REVISE-001 AC-CTRL-D-5 갱신 정합) — acceptance.md §5

---

### REQ-EMBED-DELETE — 임베드 노드 삭제 가능 (Priority: Medium)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 본문의 임베드 노드(이미지/영상/글기사 카드)를 선택(클릭 또는 키보드 포커스)한 뒤 삭제 액션(Backspace, 또는 노드에 노출되는 × 어포던스 클릭, Pending Decision D2-5)을 트리거하면, THE 시스템 SHALL 해당 임베드 노드 1개만 본문에서 제거한다.
- **[State-Driven]** WHILE 본문에 임베드 노드가 존재하는 동안, THE 시스템 SHALL 해당 노드에 대한 가시적 삭제 어포던스(예: hover 시 우상단 × 또는 focus ring)를 사용자에게 제공한다.
- **[Unwanted]** THE 시스템 SHALL NOT 임베드 삭제 시 인접한 다른 임베드 노드나 본문 텍스트에 영향을 주지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL 임베드 삭제 결과를 `getMarkup()` round-trip(`getMarkup` → `setMarkup`) 후에도 반영(삭제된 노드가 복원되지 않음)한다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-001 AC-EMB-1~3(커서 위치 삽입 + 영속성)을 회귀 없이 유지한다.

#### Acceptance Criteria 포인터

- AC-EMB-DEL-1 (단일 노드 삭제), AC-EMB-DEL-2 (인접 보존), AC-EMB-DEL-3 (markup round-trip 반영), AC-EMB-DEL-4 (회귀 — 삽입/영속성) — acceptance.md §6

---

### REQ-SEARCH-YOUTUBE-API — 미디어 검색 Youtube API 명시 + 글기사 탭 (Priority: Low)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 이미지/영상 탭의 검색을 Youtube Data API v3 (`googleapis.com/youtube/v3/search`)를 통해 수행한다. 호출은 서버사이드(`src/services/mediaSearch.js`)에서 이루어지고 API 키는 클라이언트로 노출되지 않는다.
- **[Event-Driven]** WHEN Youtube Data API 호출이 실패(HTTP 비-2xx, 네트워크 오류, 빈 결과 정책 — Pending Decision D2-7)하면, THE 시스템 SHALL Google Custom Search API로 fallback 검색을 시도한다.
- **[Ubiquitous]** THE 시스템 SHALL 글기사 탭의 검색을 내부 기사 DB(`Article`/`Contents` 테이블 — `articleService.searchArticles` 또는 동등 메서드)에 대한 title/content LIKE 검색으로 수행하며, 결과를 임베딩 가능한 카드 형태로 반환한다.
- **[Unwanted]** THE 시스템 SHALL NOT Youtube API 또는 Google API 키를 검색 응답 페이로드에 포함시키지 않는다 (기존 `safeSearch`/`normalize` 규칙 유지).

#### Acceptance Criteria 포인터

- AC-SEARCH-1 (Youtube 호출), AC-SEARCH-2 (Google fallback), AC-SEARCH-3 (글기사 내부 검색), AC-SEARCH-4 (키 비노출 회귀) — acceptance.md §7

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 디자인 토큰 (스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC`, `--yh-serif`, `--yh-sans`)을 재사용한다.
- 상세보기 본문 폰트 강조는 `font-size`의 절대값(rem 단위)으로만 표현하며, 새 토큰을 만들지 않는다 (`.yh-detail__title 1.3rem`, `.yh-detail__content 1.75rem` 등 미커밋 작업트리 값을 흡수).
- 임베드 삭제 어포던스의 색은 기존 토큰(`--yh-gray-line` 또는 텍스트 색)을 사용하며, 신규 색을 도입하지 않는다.
- SPEC-NEWS-REVISE-001 D-4(블루 `#0A4DA6` 유지)를 본 SPEC도 그대로 유지한다 (news.md의 레드 `#C8102E`는 CLAUDE.md "파란색과 흰색" 규칙에 따라 미적용).

### 5.2 접근성 (Accessibility)

- 락 거부 ALERT는 키보드 포커스 가능한 dialog 또는 inline 안내로 제공한다. `aria-live="assertive"` 권장.
- 임베드 노드의 × 어포던스는 `aria-label` (예: "임베드 삭제")을 가진다. 키보드(Backspace)로도 삭제 가능해야 한다.
- 상세보기 본문/제목 분리는 SPEC-NEWS-REVISE-001 `aria-label` 구조 그대로 유지.

### 5.3 회귀 방지

- SPEC-NEWS-REVISE-001의 모든 AC(AC-Z-*, AC-DTL-*, AC-EMB-*, AC-CTRL-D-*) 회귀 없음.
  - 단 AC-CTRL-D-5는 본 SPEC의 REQ-EDITOR-END-MARKER에 의해 단언 문자열이 `"\r\n (끝)"` → `"(끝)"`로 갱신된다.
- SPEC-DB-FOUNDATION-001의 `ARTICLE_COLUMNS` / `USER_COLUMNS` / lifecycle 상수 변경 없음. `CONTENTS_COLUMNS`만 `lockYN` 추가.
- SPEC-BACKEND-CORE-001의 `articleService`/`lifecycle.js` 전이표 변경 없음. 락 검증 책임만 추가.
- SPEC-UI-EDITOR-001의 어댑터 계약(`getMarkup`/`setMarkup`, `markupVersion`) 변경 없음. `appendEnd`/`embed` 동작의 *내부 문자열*만 갱신.
- SPEC-AUTH-001의 R/D/Z 권한 의미 / 세션 메커니즘 변경 없음.

### 5.4 성능 (Performance)

- 락 획득/해제 응답시간: 단일 SQLite 환경에서 P95 < 100ms (단일 UPDATE 1건 수준).
- `beforeunload` 해제는 `navigator.sendBeacon`을 사용하여 페이지 unload를 지연시키지 않는다.
- 임베드 삭제는 단일 DOM 노드 제거 + adapter 상태 재계산으로 16ms 이내 (60fps 한 프레임 내).

### 5.5 보안

- 락 보유자 식별(`lockerUserId`, `lockerSessionId`)은 백엔드 세션 컨텍스트(SPEC-AUTH-001)에서 가져온다. 클라이언트가 보유자를 임의로 주장할 수 없다.
- Youtube/Google API 키는 서버 환경변수(`YOUTUBE_API_KEY`, `GOOGLE_API_KEY`)에서 읽으며 응답 페이로드에 포함하지 않는다 (기존 `safeSearch`/`normalize` 정책 유지).

### 5.6 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 6. 현재 진행 상태 (Current Progress — 미커밋 변경분 분석)

> 분석 시점: 2026-06-02. 출처: `git status` 미커밋 변경 + `web/src/` Grep/Read.

| 파일 | REQ | 진행 상태 | 한 줄 요약 |
|------|-----|---------|-----------|
| `ContentsVO.md` | REQ-DB-LOCKYN | **명세 변경(미커밋)** | "이름" 절에 `lockYN` 필드가 추가됨. 본 SPEC이 이를 흡수하여 `src/db/schema.js` / `src/models/articleModel.js` 수정 트리거로 사용 |
| `news.md` | 다수 (REQ-EDIT-LOCK, REQ-API-*, REQ-DETAIL-FONT-*, REQ-EDITOR-END-MARKER, REQ-EMBED-DELETE, REQ-SEARCH-*) | **명세 변경(미커밋)** | "# 기사 lockYN", "##기사 워크플로우", "기사 에디터" 절의 7개 항목이 신규/변경됨 — 본 SPEC의 트리거 |
| `web/src/view/articleDetail.js` | REQ-DETAIL-FONT-EMPHASIS | **부분 GREEN(미커밋)** | `.yh-detail__title 1.6rem → 1.3rem` / `.yh-detail__content 1.02rem → 1.75rem`로 변경됨. 본문 > 제목 폰트 관계가 이미 부분 구현됨. 본 SPEC은 AC-FONT-1~4 가드를 보강 |
| `web/src/view/articleDetail.test.js` | REQ-DETAIL-FONT-EMPHASIS | **부분 GREEN(미커밋)** | "본문 폰트 사이즈가 제목 폰트 사이즈보다 크다" 단언 1건이 추가됨. 본 SPEC은 빈 제목/SPEC-NEWS-REVISE-001 회귀 추가 가드 명세 |
| `src/db/schema.js` | REQ-DB-LOCKYN | **미구현** | `CONTENTS_COLUMNS` 및 `CREATE_CONTENTS` DDL에 `lockYN` 미존재. 본 SPEC에서 추가 필요 |
| `src/models/articleModel.js` | REQ-DB-LOCKYN | **미구현** | `insert` / `findById` / `query` 컬럼 목록에 `lockYN` 미존재 |
| `src/services/articleService.js` | REQ-EDIT-LOCK | **미구현** | 락 획득/해제/검증 메서드 (`acquireEditLock` / `releaseEditLock`) 미존재 |
| `web/src/controller/useWriteController.js` | REQ-API-INSERT-UPDATE-SPLIT, REQ-EDIT-LOCK | **부분 — Insert/Update 통합 호출 존재** | 현재 `submitAction`이 `model.saveArticle` (단일 진입점)을 호출하며 `editArticleId` 분기는 모델 측에 위임. 본 SPEC은 컨트롤러 또는 모델 레이어에서 `articleInsert` vs `articleUpdate` 분기를 *명시적 호출*로 정렬할 것을 요구 |
| `web/src/view/InlineEmbed.jsx`, `web/src/view/editorCaret.js` | REQ-EMBED-DELETE | **부분 — 모델만 존재** | 임베드 모델/캐럿 보정은 SPEC-NEWS-REVISE-001 M3로 도입됨. 삭제 어포던스(× 버튼) 및 Backspace 핸들러 신규 필요 |
| `web/src/view/editorShortcuts.js` (혹은 Alt+Y 처리) | REQ-EDITOR-END-MARKER | **부분 — 단순화 미적용** | `useWriteController.appendEnd` 및 adapter의 Alt+Y 문자열이 현재 `"\r\n (끝)"` 형식일 가능성. 본 SPEC에서 `"(끝)"`로 단순화 |
| `src/services/mediaSearch.js` | REQ-SEARCH-YOUTUBE-API | **GREEN — 회귀 가드만 필요** | 기존 코드가 Youtube provider → Google fallback 구조로 이미 작성됨 (`defaultYoutubeProvider` / `defaultGoogleProvider`). 본 SPEC은 EARS로 잠금 + 회귀 가드 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규/수정될 영역 (예상)

- `src/db/schema.js` — `CONTENTS_COLUMNS`에 `lockYN`, `lockerUserId?`, `lockerSessionId?`, `lockedAt?` (locker 컬럼 추가 여부는 Pending Decision D2-2) 추가. `CREATE_CONTENTS` DDL 변경.
- `src/models/articleModel.js` — `insert` / `findById` / `query` 컬럼 목록에 `lockYN` 포함. (Pending Decision D2-2 결정에 따라 locker 컬럼 포함).
- `src/services/articleService.js` — `acquireEditLock(articleId, userId, sessionId)`, `releaseEditLock(articleId, userId, sessionId)`, `assertLockHolder(articleId, userId, sessionId)` 신규. `applyAction`에 락 보유자 검증 추가 (또는 별도 `applyActionWithLock`).
- `src/server/` (또는 동등 라우터) — `/api/article/lock` (POST 획득, DELETE 해제) 엔드포인트 또는 기존 `articleUpdate` 라우트의 락 자동 검증.
- `web/src/controller/useWriteController.js` — `useEffect`에서 락 획득/해제, `beforeunload`/`visibilitychange:hidden` 리스너로 `navigator.sendBeacon` 호출, `submitAction`에서 신규 vs 편집 컨텍스트에 따라 `articleInsert` vs `articleUpdate` 호출 분기.
- `web/src/view/WritePage.jsx` — 락 거부 시 ALERT/배너 표시.
- `web/src/view/articleDetail.js` — (회귀 보장; 미커밋 변경분 흡수).
- `web/src/view/articleDetail.test.js` — AC-FONT-1~4 가드 추가.
- `web/src/view/InlineEmbed.jsx` — 삭제 어포던스(× 버튼 / focus ring) 추가, `onDelete` prop.
- `web/src/view/editorShortcuts.js` (또는 adapter `appendEnd`) — Alt+Y 삽입 문자열 `"\r\n (끝)"` → `"(끝)"` 단순화.
- 관련 단위/통합 테스트 (다수): `WritePage.test.jsx`, `useWriteController.test.jsx`, `useWriteController.editLoad.test.jsx`, `editorShortcuts.test.js`, `InlineEmbed.test.jsx`, `articleDetail.test.js`, 백엔드 `articleService.test.js`(또는 신규), 통합 락 테스트.

### 7.2 작업트리 미커밋 파일 (분석 대상; 본 SPEC이 흡수)

- `news.md`
- `ContentsVO.md`
- `web/src/view/articleDetail.js`
- `web/src/view/articleDetail.test.js`

---

## 8. 테스트 전략 (TDD)

### 8.1 단위 테스트 (Vitest)

- 백엔드:
  - `schema`/`articleModel`: `CONTENTS_COLUMNS`에 `lockYN` 포함, insert default `'N'`, findById/query round-trip.
  - `articleService.acquireEditLock`/`releaseEditLock`/`assertLockHolder`: 락 충돌/해제/타임아웃(옵션) 시나리오.
  - `applyAction` + 락: 락 보유자 아닌 호출 거부.
- 프론트엔드:
  - `useWriteController`: 신규 vs 편집 컨텍스트에서 호출되는 모델 메서드 (`saveArticleInsert` vs `saveArticleUpdate` 또는 동등) 분기 검증.
  - `useWriteController` + `editArticleId`: `useEffect`로 락 획득 호출, cleanup 시 해제 호출.
  - `WritePage`: 락 거부 시 ALERT/배너 표시.
  - `InlineEmbed`: 삭제 어포던스 클릭 → `onDelete` 호출, Backspace → 동일 동작.
  - `editorShortcuts` (Alt+Y): `"(끝)"` 정확히 삽입, 이미 존재 시 noop, 골드색 데이터 속성.
  - `articleDetail.test`: CSS 룰 파싱 → contentSize > titleSize, 빈 제목 케이스, SPEC-NEWS-REVISE-001 단언 회귀.

### 8.2 통합 테스트

- 두 세션 동시 편집 진입 시뮬레이션 (백엔드 직접 호출 + 두 useWriteController 인스턴스).
- 편집 페이지 unload → `sendBeacon` → 락 해제 → 새 세션 재획득 round-trip.
- 임베드 삽입 → markup round-trip → 삭제 → markup round-trip(삭제 반영).
- mediaSearch Youtube 실패 → Google fallback (mock provider) → 결과 정규화.

### 8.3 회귀 가드

- `npm test` 전체 통과.
- `npm run build` 무경고.
- SPEC-NEWS-REVISE-001 AC 세트 모두 GREEN 유지 (단 AC-CTRL-D-5의 단언 문자열은 `"(끝)"`로 갱신).

---

## 9. 위험 & 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: `beforeunload`/`visibilitychange:hidden` 감지가 일부 브라우저(특히 모바일 Safari)에서 신뢰성 낮음 → 좀비 락 발생 | 다른 사용자가 영구 락 충돌 | (a) `sendBeacon` + `visibilitychange:hidden` 이중 채널, (b) 좀비 락 자동 해제(timeout 30분, Pending D2-3) |
| R2: SQLite 단일 인스턴스 환경에서 동시 두 락 요청이 정확히 동일 ms에 도달하면 race | 두 사용자가 동시 진입 가능 | `UPDATE ... WHERE lockYN = 'N'` 단일 쿼리(affected rows 1만 성공) + 트랜잭션 |
| R3: 동일 사용자가 동일 세션의 다른 탭에서 같은 기사 편집 시도 | UX 혼동 | `lockerSessionId` 비교 → 다른 페이지/탭이면 거부, 동일 페이지 ID(localStorage UUID)이면 허용 (Pending D2-4 결정에 따름) |
| R4: 임베드 삭제 시 `markupVersion` 직렬화 round-trip 손실 가능 | 임베드가 silent 복구 / 영구 손실 | `getMarkup` ↔ `setMarkup` round-trip AC를 SPEC-NEWS-REVISE-001 AC-EMB-3 + 본 SPEC AC-EMB-DEL-3로 이중 가드 |
| R5: `articleUpdate`가 `Article.markupVersion` 외 어떤 `Contents` 컬럼까지 갱신할지의 범위가 SPEC-BACKEND-CORE-001에서 명시되지 않음 | 부분 업데이트로 인한 데이터 누락 | 본 SPEC은 컬럼 범위를 결정하지 않음(SPEC-BACKEND-CORE-001 소관). Pending D2-6에서 기존 모델 `update` 시그니처 확인 후 결정 |
| R6: Alt+Y 단순화가 SPEC-NEWS-REVISE-001 AC-CTRL-D-5 단언과 불일치 | 회귀 테스트 실패 | 본 SPEC에서 명시적으로 단언 갱신 정합(REQ-EDITOR-END-MARKER) 명문화 |
| R7: 임베드 삭제의 UX(키보드 Backspace vs × 버튼 vs 둘 다)가 사용자 학습 비용 차이 발생 | UX 혼동 | Pending D2-5에서 본 SPEC 기본값(둘 다 허용) 명시 |
| R8: 락 거부 시점 ↔ 사용자가 이미 본문을 입력한 직후 → 입력 손실 | 사용자 작업 손실 | 락 획득은 페이지 진입 *직전* 동기 호출 + 락 거부 시 진입 자체 차단 (입력 자체가 발생하지 않음) |

---

## 10. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-001**: 직전 차수. Z권한 버튼 / 상세보기 분리 / 임베드 위치 / Ctrl+D / Alt+Y(구 형식) Decision Lock D-1~D-7. 본 SPEC은 그 위에 *상세보기 폰트 강조, Alt+Y 단순화, 임베드 삭제, 락, Insert/Update 분기*를 추가하고, AC-CTRL-D-5 단언 문자열을 `"(끝)"`로 갱신한다.
- **SPEC-DB-FOUNDATION-001**: `Contents` 테이블 스키마. 본 SPEC은 `CONTENTS_COLUMNS`에 `lockYN` (및 locker 컬럼들) *추가*만 한다. 기존 컬럼/상수 변경 없음.
- **SPEC-BACKEND-CORE-001**: `articleService` / `lifecycle.js`. 본 SPEC은 lifecycle 전이표를 변경하지 않고 락 검증 책임만 추가.
- **SPEC-FRONTEND-UI-001**: 4탭 60:40 레이아웃, 우상단 사용자 정보, 상세보기 새창 호출. 본 SPEC은 그 위에 락 거부 ALERT, 임베드 삭제 어포던스, 상세보기 본문 폰트 강조를 추가.
- **SPEC-UI-EDITOR-001**: 어댑터 계약(`getMarkup`/`setMarkup`). 본 SPEC은 어댑터 계약을 변경하지 않고 *appendEnd 문자열*과 *embed remove 인터페이스*만 보강.
- **SPEC-AUTH-001**: R/D/Z 권한 의미 + 세션. 본 SPEC은 락 보유자(`lockerUserId`, `lockerSessionId`)를 세션에서 가져온다.

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 수집/배부 시스템 (기사 작성기만).
- R/D/Z 권한 의미 변경 또는 신규 권한 도입.
- lifecycle 전이 표(R/D/Z × send/hold/kill) 변경.
- 디자인 토큰 신규 도입 (CSS 변수 추가 금지).
- 클립보드 붙여넣기 이미지 사이즈 정책(10% × 10%) 변경.
- 상세보기 새창 상단 공통정보 12 필드 목록의 추가/삭제/순서 변경.
- 에디터 구조 파싱(제목/부제목/본문 결정) 알고리즘 변경.
- 외부 락 스토어(Redis/etcd 등) 도입 또는 분산 락 처리.
- 인증/세션 메커니즘 자체의 변경.
- DB에 있는 내용 삭제 (CLAUDE.md HARD; 락 컬럼 추가는 ALTER 또는 신규 DDL이며 데이터 삭제 아님).
- Youtube/Google 외 미디어 검색 provider 신규 도입.
- 글기사 탭의 정렬/페이징 정책 변경.
- 코드 구현 (본 SPEC은 Plan 단계 문서만; Run 단계에서 구현).

---

## 12. Definition of Done

- [ ] `Contents` 테이블에 `lockYN` 컬럼이 존재하며 default `'N'` (`schema.js` GREEN)
- [ ] `articleModel`의 insert/select/query가 `lockYN` 포함 round-trip
- [ ] `articleService.acquireEditLock`/`releaseEditLock`/`assertLockHolder` 신규 구현 (locker 컬럼 결정에 따라 시그니처 확정)
- [ ] 두 세션 동시 편집 진입 시 한 쪽만 성공(AC-EDIT-LOCK-2 GREEN)
- [ ] `beforeunload`/`visibilitychange:hidden`에서 `sendBeacon`으로 락 해제 (AC-EDIT-LOCK-4 GREEN)
- [ ] `useWriteController.submitAction`이 신규 컨텍스트에서 `articleInsert`, 편집 컨텍스트에서 `articleUpdate` 호출 (AC-API-1, AC-API-2 GREEN)
- [ ] 제목 없을 시 ALERT 회귀 (AC-API-4 GREEN)
- [ ] `articleDetail.js`의 본문 폰트 사이즈 > 제목 폰트 사이즈 (AC-FONT-1~4 GREEN)
- [ ] Alt+Y 삽입 문자열이 정확히 `"(끝)"` (AC-ENDMARK-1 GREEN)
- [ ] SPEC-NEWS-REVISE-001 AC-CTRL-D-5 단언이 `"(끝)"`로 갱신되어 본 SPEC과 정합
- [ ] 임베드 단일 노드 삭제 (AC-EMB-DEL-1, 2, 3 GREEN)
- [ ] 임베드 삽입/영속성 회귀 없음 (SPEC-NEWS-REVISE-001 AC-EMB-1~3)
- [ ] `mediaSearch.js`의 Youtube + Google fallback 동작 회귀 가드 (AC-SEARCH-1, 2 GREEN), 글기사 내부 검색 (AC-SEARCH-3 GREEN)
- [ ] `npm test` 전체 통과, `npm run build` 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] `news.md` / `ContentsVO.md` / 본 SPEC 정합 확인
- [ ] 기존 SPEC(DB-FOUNDATION-001, BACKEND-CORE-001, FRONTEND-UI-001, UI-EDITOR-001, AUTH-001, NEWS-REVISE-001) AC 회귀 없음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-02
