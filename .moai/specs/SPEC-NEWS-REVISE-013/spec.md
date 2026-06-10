---
id: SPEC-NEWS-REVISE-013
version: 0.1.0
status: Plan
created: 2026-06-09
updated: 2026-06-09
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-004
  - SPEC-FRONTEND-UI-001
  - SPEC-UI-EDITOR-001
supersedes:
  - "SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT (제목 블록/별도 제목 요소 부분)"
  - "SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS"
  - "SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS"
  - "SPEC-NEWS-REVISE-004 AC-GRAY-1 / AC-GRAY-3 (제목 요소 전제 부분)"
---

# SPEC-NEWS-REVISE-013 — 상세보기 별도 제목 요소 폐지 (본문 첫 줄이 제목)

## HISTORY

- 2026-06-10: SPEC-NEWS-REVISE-010 → SPEC-NEWS-REVISE-013 재번호. origin/main 의 SPEC-NEWS-REVISE-010(조회 페이징·세션 sliding·행클릭 상세, Completed)과 ID 가 충돌하여 merge 시 본 SPEC(상세보기 별도 제목 요소 폐지)을 013 으로 이동. 내용 변경 없음, 모든 코드/문서 참조(articleDetail.js/test, SKILL.md, supersession 마커) 동기 갱신. (MoAI)
- 2026-06-09 (v0.1.0): 최초 작성. 사용자 구두 지시(승인됨) — "기사 상세보기 새창에서 별도 '제목' 표시를 없앤다. 본문(`기사` 영역)이 markupVersion 첫 줄=제목을 이미 포함하므로 중복이다." 를 정식 명세화한다. 에디터 본문 구조상 첫째 줄이 제목이며(`moai-domain-news-editor` §2.5), 상세보기 본문은 `web/src/view/articleDetail.js` `buildBodyHtml` 이 `a.markupVersion` 을 파싱해 첫 줄(제목) 포함 전체를 렌더한다. 따라서 `section[aria-label="기사"]` 안의 별도 `<h1 class="yh-detail__title">` 요소는 제목 중복이다. 본 SPEC 은 별도 제목 요소를 폐지하고, 이로 인해 더 이상 성립하지 않는 폰트 강조 비교(본문 폰트 > 제목 폰트)를 폐지한다. SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT 의 제목 블록/별도 제목 요소 부분, SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS, SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS, SPEC-NEWS-REVISE-004 AC-GRAY-1/3 의 제목 요소 전제 부분을 supersede 한다 (해당 SPEC 본문은 이력 보존을 위해 삭제하지 않고 supersession 마커만 부착). (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-013 |
| 제목 | 상세보기 별도 제목 요소 폐지 (본문 첫 줄이 제목) |
| 상태 | Plan |
| 생성일 | 2026-06-09 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001/002/003/004, SPEC-FRONTEND-UI-001, SPEC-UI-EDITOR-001 |
| supersede 대상 | 위 frontmatter `supersedes` 참조 |
| 영향 페이지 | 상세보기 새창 (`web/src/view/articleDetail.js`) |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 정정 (제목 요소 폐지) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

상세보기 새창의 `기사` 영역에서 **본문과 별개로 출력되던 제목 요소(`.yh-detail__title` / `<h1>`)를 폐지**한다.

배경/문제:

- 에디터 본문은 **첫째 줄이 제목**이다 (`moai-domain-news-editor` §2.5: "첫째 줄: 제목").
- 저장 시 본문은 `a.markupVersion` (에디터 직렬화 JSON) 으로 보관되며, 첫 줄(제목)을 포함한 전체가 직렬화된다.
- 상세보기 본문은 `web/src/view/articleDetail.js` `buildBodyHtml(article)` 이 `a.markupVersion` 을 deserialize 하여 첫 줄(제목)부터 임베드·`(끝)` 까지 순서대로 렌더한다.
- 그런데 같은 `section[aria-label="기사"]` 안에 `<h1 class="yh-detail__title">${title}</h1>` 가 본문 위에 별도로 출력되어 **제목이 두 번** 보인다 (h1 의 `${title}` = `a.title`, 본문 첫 줄 = markupVersion 첫 줄 = 동일 제목).
- 따라서 별도 제목 요소는 중복이며 사용자 지시에 따라 폐지한다.

`why`: 제목 중복은 사용자 혼동을 유발하고, 기존 SPEC(001/002/003/004)의 "제목 블록/제목 폰트" 요구사항은 이 폐지와 정면충돌한다. 품질 게이트(LLM)가 "제목 요소는 이제 요구되지 않는다"를 명확히 인식하도록 본 SPEC 이 신규 요구사항으로 기존 요구사항을 supersede 한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- 상세보기 새창 `section[aria-label="기사"]` 에서 별도 제목 요소(`.yh-detail__title` / `<h1>`) 제거.
- 제거에 따른 불필요 CSS(`.yh-detail__title` 룰) 정리 — 본문(`.yh-detail__content`) 렌더는 유지.
- 브라우저 탭 제목용 `<head><title>` 유지 (`a.title` 또는 빈 값 시 `(제목 없음)`).
- 빈 제목(`a.title` 비어있음) 상태에서 본문 영역이 markupVersion 본문만 렌더하고 별도 제목 placeholder 요소를 만들지 않음을 보장.

### 2.2 제외 (Out of Scope)

- 공통정보 12 필드의 추가/삭제/순서/라벨 변경 (그대로 유지).
- 공통정보 12 필드 **가로 나열**(flex wrap) 레이아웃 변경 (그대로 유지).
- gray-line 디자인 토큰 값(`--yh-gray-line: #DDE3EC`) 변경 (그대로 유지).
- 섹션 순서(공통정보 → 기사) 변경 (그대로 유지).
- markupVersion 본문 파싱/임베드 렌더 순서(본문 텍스트 → 임베드 → `(끝)`) 변경 (그대로 유지).
- XSS escape 정책 변경 (그대로 유지).
- 에디터 본문 구조 파싱(제목/부제목/본문 결정) 알고리즘 변경 (SPEC-UI-EDITOR-001 소관).
- 수집/배부 시스템 (기사 작성기만).
- DB 데이터 삭제 (CLAUDE.md HARD).
- 코드/테스트 구현 (본 SPEC 은 Plan 단계 문서만; Run 단계에서 구현).

---

## 3. 요구사항 (Requirements — EARS)

### REQ-DETAIL-NO-SEPARATE-TITLE — 상세보기 별도 제목 요소 폐지 (Priority: High)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 상세보기 새창의 `기사` 영역(`section[aria-label="기사"]`)에 섹션 헤더(`기사`)와 본문(`.yh-detail__content`)만 렌더하고, **별도 제목 요소(`.yh-detail__title` / `<h1>`)를 두지 않는다**.
- **[Unwanted]** THE 시스템 SHALL NOT 본문과 별개의 제목 요소를 출력한다 (제목 중복 금지).
- **[Ubiquitous]** THE 시스템 SHALL 브라우저 탭 제목용 `<head><title>` 은 기존대로 유지한다 (`article.title`, 빈 값일 때 `(제목 없음)`).
- **[State-Driven]** WHILE `article.title` 이 비어 있어도, THE 시스템 SHALL 상세보기 본문 영역에 markupVersion 본문만 렌더하며, 별도 제목 placeholder 요소(예: `(제목 없음)` 을 담는 `.yh-detail__title`/`<h1>`)를 만들지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL 공통정보 12 필드의 가로 나열, gray-line 토큰(`--yh-gray-line: #DDE3EC`), XSS escape, 섹션 순서(공통정보 → 기사)를 그대로 유지한다.

#### Acceptance Criteria 포인터

- AC-NOTITLE-1 (제목 요소 부재), AC-NOTITLE-2 (본문 요소 존재), AC-NOTITLE-3 (head title 유지), AC-NOTITLE-4 (공통정보 12 dt / gray-line / 섹션 순서 회귀 없음) — acceptance.md §1

---

## 4. 비기능 요건 (Non-Functional Requirements)

### 4.1 디자인 토큰 (스타일)

- 신규 CSS 변수 도입 없음. 기존 토큰(`--yh-blue`, `--yh-blue-deep`, `--yh-gray-line` `#DDE3EC`, `--yh-serif`, `--yh-sans`) 재사용.
- `.yh-detail__title` CSS 룰은 별도 제목 요소 폐지에 따라 제거 가능(본문 `.yh-detail__content` 룰은 유지). 제거하더라도 다른 토큰/룰에 영향이 없어야 한다.

### 4.2 접근성 (Accessibility)

- `section[aria-label="기사"]` 의 aria-label 은 유지. 섹션 헤더 `<h2>기사</h2>` 는 유지.
- 본문(`.yh-detail__content`) 은 markupVersion 본문(첫 줄=제목 포함)을 그대로 노출하므로, 문서상 제목 정보는 본문 첫 줄 + `<head><title>` 로 보존된다.

### 4.3 회귀 방지

- 공통정보 12 필드 가로 나열, gray-line 토큰(`#DDE3EC`), 공통정보 → 기사 섹션 순서, markupVersion 본문 파싱·임베드 순서, XSS escape 회귀 없음.
- 본 SPEC 으로 폐지되는 검증(별도 제목 요소 존재 / 본문 폰트 > 제목 폰트 비교)은 제목 요소 부재로 더 이상 성립하지 않으므로 제거 또는 AC-NOTITLE-1 로 대체된다 (§6 참조).

### 4.4 인코딩

- 모든 문서/소스/테스트는 UTF-8 (CLAUDE.md HARD 규칙).

---

## 5. 영향 영역 (Affected Files)

- `web/src/view/articleDetail.js` — `buildArticleDetailHtml` 의 `section[aria-label="기사"]` 에서 `<h1 class="yh-detail__title">${title}</h1>` 제거. `<head><title>${title}</title>` 유지. `.yh-detail__title` CSS 룰 정리. (Run 단계 구현)
- `web/src/view/articleDetail.test.js` — 별도 제목 요소 존재 단언 / 본문 폰트 > 제목 폰트 비교 단언 제거, AC-NOTITLE-1~4 가드 추가. (Run 단계 구현)

> 본 SPEC(Plan) 단계에서는 위 파일을 수정하지 않는다.

---

## 6. 폐지되는 기존 자산 (Superseded Assets)

별도 제목 요소가 사라지면서 다음 GREEN 자산/비교는 더 이상 성립하지 않으므로 폐지(또는 AC-NOTITLE-* 로 대체)된다. 기존 SPEC 본문은 이력 보존을 위해 삭제하지 않고 supersession 마커만 부착한다.

| 폐지 대상 | 출처 | 폐지 사유 |
|-----------|------|----------|
| 제목 섹션·`<h1>` 존재 단언 (AC-DTL-1/4) | SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT | 별도 제목 요소 폐지 → 제목 섹션/h1 부재 |
| 빈 제목 시 `(제목 없음)` placeholder *요소* 유지 (AC-DTL-4) | SPEC-NEWS-REVISE-001 | 제목 요소 자체 부재. `(제목 없음)` 은 `<head><title>` 에만 잔존 |
| 본문 폰트 > 제목 폰트 (AC-FONT-1~4) | SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS | 제목 요소 부재 → 비교 대상(`.yh-detail__title` font-size) 소멸 |
| 본문 폰트 > 제목 폰트 회귀 가드 (AC-EMPH-1~4) | SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS | 동일 — 제목 폰트 비교 폐지 |
| 제목 요소 전제의 가드 (AC-GRAY-1/3 의 제목-요소 전제 부분) | SPEC-NEWS-REVISE-004 | gray-line 토큰 단언(#DDE3EC)·공통정보 12 dt·공통정보/기사 두 섹션 형제 가드는 AC-NOTITLE-4 로 계승. 단 제목 요소 존재를 전제하던 부분은 폐지 |

주의 — AC-GRAY-1/3 의 gray-line 토큰(`#DDE3EC`) 정확 매치 단언과 공통정보 12 dt 단언, 그리고 **공통정보 섹션 ↔ 기사 섹션** 두 형제 구조 가드는 본 SPEC 에서도 그대로 유효하며 AC-NOTITLE-4 로 계승된다. 폐지되는 것은 "제목 요소(`.yh-detail__title`/`<h1>`)가 존재한다"는 전제뿐이다.

---

## 7. Exclusions (What NOT to Build) — 명시적 비목표

- 수집/배부 시스템 (기사 작성기만).
- 공통정보 12 필드 목록/순서/라벨/가로 나열 레이아웃 변경.
- gray-line 디자인 토큰 값(`#DDE3EC`) 변경.
- 섹션 순서(공통정보 → 기사) 변경.
- markupVersion 본문 파싱·임베드 렌더 순서(본문 텍스트 → 임베드 → `(끝)`) 변경.
- XSS escape 정책 변경.
- `<head><title>` 의 `(제목 없음)` 폴백 제거 (탭 제목 폴백은 유지).
- 에디터 본문 구조 파싱(제목/부제목/본문 결정) 알고리즘 변경.
- 본문(`.yh-detail__content`) 렌더 또는 폰트 사이즈 절대값 변경 (제목 비교만 폐지; 본문 자체 스타일은 유지).
- DB 데이터 삭제.
- 코드/테스트 구현 (본 SPEC 은 Plan 단계 문서만).

---

## 8. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT** — 제목 블록/별도 제목 요소(제목 섹션·`<h1>`·빈 제목 placeholder 요소) 부분을 본 SPEC 이 supersede. 단 상단 공통정보 12 필드 / 섹션 분리 시각·gray-line 구분선 / XSS escape 부분은 본 SPEC AC-NOTITLE-4 로 계승. (참고: 001 spec.md 는 "분리 2섹션 aria-label=제목/본문"으로 적혀 있으나 현 코드·도메인 스킬 v0.1.5 는 이미 "분리 폐지 → 단일 `aria-label=기사` 섹션에 h1 제목 + 본문 통합"으로 진화 — 본 SPEC 은 그 위에서 h1 제목 요소까지 폐지한다.)
- **SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS** — 본문 폰트 > 제목 폰트 비교를 본 SPEC 이 supersede(제목 요소 부재로 비교 폐지).
- **SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS** — 동일 폰트 강조 회귀 가드를 본 SPEC 이 supersede.
- **SPEC-NEWS-REVISE-004 AC-GRAY-1/3** — 제목 요소 전제 부분만 본 SPEC 이 supersede. gray-line 토큰 정확 매치(#DDE3EC) / 12 dt / 공통정보-기사 두 섹션 형제 가드는 AC-NOTITLE-4 로 계승.
- **SPEC-FRONTEND-UI-001** — 상세보기 새창 호출/레이아웃. 본 SPEC 은 그 안에서 별도 제목 요소만 제거.
- **SPEC-UI-EDITOR-001** — 에디터 어댑터·markupVersion 직렬화. 본 SPEC 은 본문 파싱 계약을 변경하지 않는다(첫 줄=제목 규약 그대로 사용).

---

## 9. Definition of Done

- [ ] `buildArticleDetailHtml` 출력의 `section[aria-label="기사"]` 안에 `.yh-detail__title`/`<h1>` 이 존재하지 않음 (AC-NOTITLE-1 GREEN)
- [ ] 같은 섹션에 `.yh-detail__content`(본문)가 존재함 (AC-NOTITLE-2 GREEN)
- [ ] `<head><title>` 이 title(또는 `(제목 없음)`) 을 유지함 (AC-NOTITLE-3 GREEN)
- [ ] 공통정보 12 dt / gray-line `#DDE3EC` / 공통정보 → 기사 섹션 순서 회귀 없음 (AC-NOTITLE-4 GREEN)
- [ ] SPEC-NEWS-REVISE-001/002/003/004 의 폐지 대상 AC(제목 요소 존재·본문>제목 폰트)는 제거되거나 AC-NOTITLE-* 로 대체됨
- [ ] `npm test` 전체 통과, `npm run build` 무경고
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] 기존 SPEC 4개에 supersession 마커가 부착되어 품질 게이트가 제목 요소 부재를 인식
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-09
