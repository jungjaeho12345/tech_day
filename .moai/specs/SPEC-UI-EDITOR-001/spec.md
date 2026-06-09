---
id: SPEC-UI-EDITOR-001
version: 0.1.0
status: draft
created: 2026-05-28
updated: 2026-05-28
author: manager-spec
priority: high
issue_number: 0
---

# SPEC-UI-EDITOR-001 — 기사 에디터 (구조 파싱 + 인라인 임베딩)

## HISTORY

- 2026-05-28 (v0.1.0): 최초 작성. SPEC-FRONTEND-UI-001 [DP-F1] 에디터 어댑터 계약(마크업 in/out, markupVersion 덮어쓰기) 뒤에 들어가는 **concrete 리치텍스트 에디터**의 신규 책임만 정의 — (1) 에디터 입력을 제목/부제목/본문으로 구조화하는 결정론적 파싱, (2) 검색 결과(이미지/유튜브/내부기사)를 본문 내 시각적 인라인으로 삽입·렌더링. 현행 `createPlainTextEditorAdapter`(placeholder)와 `embed()`의 참조-마커 텍스트 append를 대체. news.md 82줄의 부제목/본문 경계 모호성은 결정론적 후보안을 제시하되 **plan.md "결정 필요 항목"**으로 이연. 브라운필드 Delta 마커([EXISTING]/[MODIFY]/[NEW]) 적용. (manager-spec)

---

## 개요 (Overview)

기사 작성 페이지(SPEC-FRONTEND-UI-001)의 **좌측 에디터 영역**을 placeholder(plain-text) 어댑터에서 **concrete 리치텍스트 에디터**로 구체화한다. 본 SPEC이 다루는 신규 책임은 정확히 두 가지다.

1. **구조 파싱 (Structure Parsing)**: 에디터의 텍스트 입력을 *제목 / 부제목 / 본문*의 논리 구조로 결정론적으로 분해하여 DTO의 `markupVersion`(및 그 안에 인코딩되는 구조)으로 매핑한다. 규칙의 원천은 news.md 81~82줄이다 (첫째 줄 = 제목; 둘째~다섯째 줄 = 부제목; "개행라인이 2번 이상 있으면 2번째부터는 본문").
2. **인라인 임베딩 렌더링 (Inline Embedding Rendering)**: 메타데이터 탭(이미지/영상/글기사)의 검색 결과를 본문 *내부*에 시각적 인라인 요소(이미지 썸네일, 유튜브 플레이어/링크 카드, 내부기사 카드)로 삽입·렌더링한다. 현재는 `[source] url` 형태의 참조 마커 텍스트를 본문 끝에 append할 뿐이며(`useWriteController.embed`), 이를 실제 인라인 임베딩으로 대체한다.

본 SPEC은 **관찰 가능한 에디터 동작과 그 동작이 산출하는 데이터(markupVersion 구조)만** 다룬다. 구체 리치텍스트 라이브러리 선택, 인라인 임베드의 정확한 DOM/스타일 마크업, 검색 백엔드는 다루지 않는다 (Exclusions 참조).

### 계층 분해 위치 (이 SPEC의 관계)

| SPEC | 관계 | 내용 |
|------|------|------|
| SPEC-DB-FOUNDATION-001 (승인됨) | 소비 | `Article.markupVersion` 컬럼, 덮어쓰기 저장(이력 미보관) 제약 |
| SPEC-BACKEND-CORE-001 (승인됨) | 소비 | 미디어 검색 결과 형태 `{source,title,url,thumbnailUrl}` (REQ-SRCH-M-*), 글기사 검색 결과. **본 SPEC은 검색 백엔드를 재정의하지 않고 결과를 소비만 한다.** |
| SPEC-FRONTEND-UI-001 (승인됨) | **확장** | [DP-F1] 에디터 어댑터 계약(REQ-FE-WRITE-001/015), 4탭 검색(REQ-FE-WRITE-007~011), embed 동작(REQ-FE-WRITE-010). **본 SPEC은 그 어댑터의 concrete 구현 + 파싱 + 인라인 임베딩이라는 신규 책임만 추가하며, 상위 화면/DTO 조립 계약은 변경하지 않는다.** |
| SPEC-AUTH-001 (승인됨) | 무관 | 인증/세션. 본 SPEC은 lifecycle/세션 로직을 건드리지 않는다. |

### 보존해야 할 기존 계약 (Brownfield Contracts — 절대 위반 금지)

- **[HARD] DP-F1 에디터 어댑터 계약** (`web/src/model/editorAdapter.js`): concrete 에디터는 `EditorAdapter`(`getMarkup()` / `setMarkup(markup)`) 계약 *뒤에* 들어가야 한다. `markupVersion`은 덮어쓰기-온-세이브이며 이력 UI는 없다. 어댑터 교체가 상위 화면 또는 DTO 조립에 영향을 주면 안 된다.
- **[HARD] DP-F5 lifecycle 비계산 계약** (`web/src/controller/useWriteController.js`): 클라이언트는 송고/보류의 다음 상태를 절대 계산하지 않는다(액션+DTO만 전송). 본 SPEC은 lifecycle 로직을 일절 건드리지 않는다.
- **DTO 조립 계약** (`useWriteController.assembleDto`): `{...common, markupVersion: adapter.getMarkup()}`. 본 SPEC은 `getMarkup()`이 반환하는 *값의 내용*(구조화된 마크업)만 정의하며, DTO 조립 코드의 *형태*는 변경하지 않는다.
- **검색 결과 소비 계약** (`web/src/controller/useSearchController.js`, `src/services/mediaSearch.js`): 미디어 결과는 `{source,title,url,thumbnailUrl}`, 글기사 결과는 `{articleId,title,...}`. 본 SPEC은 이 결과 형태를 입력으로 받아 임베드한다.

---

## 환경 및 가정 (Environment & Assumptions)

- 프레임워크/빌드: **React 19 + Vite 7** (tech.md 확정).
- 아키텍처: **클라이언트 MVC** — 에디터는 View 계층에서 어댑터 계약을 통해 노출, Controller(`useWriteController`)가 DTO 조립.
- 테스트: **Vitest ^3.2.4** + jsdom + `@testing-library/react` (tech.md 확정). 파싱은 순수 함수로 단위테스트 가능해야 한다.
- 디자인: 스타일 토큰 `web/src/styles/yonhap.css` (명조 헤드라인 `--yh-serif`, 본문 고딕 `--yh-sans`, 브랜드 레드 `--yh-red` #C8102E, 회색 구분선 `--yh-gray-line`). 인라인 임베드는 이 토큰 체계를 따른다.
- 인코딩: 모든 텍스트 입출력 **UTF-8** (CLAUDE.md HARD 규칙).
- 검색 백엔드 결과 형태는 SPEC-BACKEND-CORE-001 확정 사항을 소비한다.

### 파싱 규칙 (Parsing Rule — 사용자 확정됨: 후보 A)

> **[확정]** news.md 82줄 "둘째줄부터 5째줄까지 부제목, 단 개행라인이 2번이상 있으면 2번째부터는 본문"의 부제목/본문 경계 규칙은 **사용자 확정으로 후보 A(빈 줄 블록 분리)** 로 고정되었다. 더 이상 미해결 항목이 아니다. 확정 알고리즘:
>
> 1. `line[0]` = 제목.
> 2. 제목 다음부터 **첫 빈 줄(연속 개행)** 전까지의 줄을 부제목 블록으로 (단 최대 4줄 = 2~5번째 줄 상한).
> 3. 첫 빈 줄 **이후 전체** = 본문.
> 4. 빈 줄이 전혀 없으면: 2~5번째 줄(최대 4줄)을 부제목, **6번째 줄 이후**를 본문.
>
> 이 규칙은 REQ-EDIT-PARSE-002/003에 반영되어 있으며, 후보 B/C는 기각된 대안으로 plan.md §4에 보존된다. "개행라인 2번 이상" = 빈 줄(한 줄 띄움)로 해석한다.

---

## 요구사항 (Requirements — EARS)

> Delta 마커: **[EXISTING]** 기존 동작 유지, **[MODIFY]** 기존 동작 대체/강화, **[NEW]** 신규 동작.

### 모듈 1 — 에디터 어댑터 concrete 구현 (Editor Adapter Concrete Implementation)

- **REQ-EDIT-ADP-001 (Ubiquitous) [MODIFY]**: The editor region **shall** be backed by a concrete rich-text editor that implements the existing `EditorAdapter` contract (`getMarkup()` / `setMarkup(markup)`), replacing the plain-text placeholder adapter, **without** changing the contract surface consumed by the article-write page.
- **REQ-EDIT-ADP-002 (Ubiquitous) [EXISTING]**: The editor's `getMarkup()` return value **shall** remain the single value persisted to `Article.markupVersion` (overwrite-on-save, no markup-version history), preserving the DP-F1 contract.
- **REQ-EDIT-ADP-003 (Event-Driven) [EXISTING]**: **When** `setMarkup(markup)` is called, the editor **shall** load (overwrite) the supplied markup into the editor view.

### 모듈 2 — 구조 파싱: 제목/부제목/본문 (Structure Parsing)

- **REQ-EDIT-PARSE-001 (Event-Driven) [NEW]**: **When** the editor content is read for DTO assembly, the system **shall** parse the content into a deterministic structure of exactly three logical roles — title (제목), subtitle (부제목), and body (본문) — derived solely from the content text.
- **REQ-EDIT-PARSE-002 (Ubiquitous) [NEW]**: The parser **shall** treat the first line of the content as the article title (제목).
- **REQ-EDIT-PARSE-003 (Ubiquitous) [NEW]**: Starting from the line after the title, the parser **shall** take the lines up to (but not including) the first blank line (a blank line being produced by consecutive newlines), capped at a maximum of 4 lines (the 2nd through 5th lines), as the subtitle (부제목), and **shall** treat all content after that first blank line as the body (본문); **and where** the content contains no blank line, the parser **shall** take the 2nd through 5th lines (up to 4 lines) as the subtitle and all content from the 6th line onward as the body (확정 규칙 = 후보 A, 상세 plan.md §4).
- **REQ-EDIT-PARSE-004 (Unwanted Behavior) [NEW]**: **If** the content contains only a single line (title only) with no further lines, **then** the parser **shall** produce a non-empty title and an empty subtitle and an empty body, without error.
- **REQ-EDIT-PARSE-005 (Ubiquitous) [NEW]**: The parser **shall** be a pure, side-effect-free function such that the same input content always produces the same `{title, subtitle, body}` result (deterministic and unit-testable).
- **REQ-EDIT-PARSE-006 (Ubiquitous) [MODIFY]**: The parsed structure **shall** be encoded into the `markupVersion` value returned by `getMarkup()`, so that DTO assembly (`assembleDto`) consumes the structured markup through the unchanged adapter contract.

### 모듈 3 — 인라인 임베딩 렌더링 (Inline Embedding Rendering)

- **REQ-EDIT-EMBED-001 (Event-Driven) [MODIFY]**: **When** the user selects a media or text-article search result for embedding, the system **shall** insert a visual inline embed into the editor body at the insertion point, replacing the previous behavior of appending a plain reference-marker string to the end of the body.
- **REQ-EDIT-EMBED-002 (Event-Driven) [NEW]**: **When** an image search result (`{source, title, url, thumbnailUrl}`) is embedded, the system **shall** render it inline as a visual image element (using `thumbnailUrl`/`url`) rather than as marker text.
- **REQ-EDIT-EMBED-003 (Event-Driven) [NEW]**: **When** a YouTube/video search result is embedded, the system **shall** render it inline as a visual video reference (player or link card) rather than as marker text.
- **REQ-EDIT-EMBED-004 (Event-Driven) [NEW]**: **When** an internal text-article search result (`{articleId, title}`) is embedded, the system **shall** render it inline as a visual article reference card (showing at least the article title) rather than as the prior `기사:{articleId}` marker text.
- **REQ-EDIT-EMBED-005 (Ubiquitous) [NEW]**: Inline embeds **shall** be preserved within the `markupVersion` value such that re-loading the markup via `setMarkup()` reconstructs the same inline embeds (round-trip stable).
- **REQ-EDIT-EMBED-006 (Ubiquitous) [NEW]**: Inline embeds **shall** follow the design tokens (`web/src/styles/yonhap.css`: serif headlines, sans body, brand red `--yh-red`, gray separators), visually distinguishing an embed from surrounding body text.
- **REQ-EDIT-EMBED-007 (Optional) [NEW]**: **Where** multiple search results are embedded in sequence, the system **shall** insert each as a distinct inline embed, preserving their relative order in the body.

---

## Exclusions (What NOT to Build)

> [HARD] 본 SPEC은 에디터 어댑터의 concrete 구현 + 구조 파싱 + 인라인 임베딩이라는 신규 책임만 다룬다. 아래는 **명시적으로 범위 밖**이다.

- **검색 백엔드의 재정의/재구현**: 이미지·영상(유튜브→구글 폴백), 글기사 검색은 SPEC-BACKEND-CORE-001(REQ-SRCH-*)에서 이미 완성됨. 본 SPEC은 그 결과(`{source,title,url,thumbnailUrl}` / 글기사)를 **소비**만 하며 검색 로직·프록시·API 키를 다루지 않는다.
- **lifecycle 상태 계산 / 송고·보류 로직**: [DP-F5] 클라이언트는 다음 상태를 계산하지 않는다. 본 SPEC은 `useWriteController`의 송고/보류·`submitAction`·DTO 조립 *코드 형태*를 변경하지 않는다.
- **markupVersion 이력 UI / 버전 관리**: [DP-F1 / DB D-A1] 덮어쓰기-온-세이브, 이력 미보관. 본 SPEC은 단일 현행 마크업만 다룬다.
- **구체 리치텍스트 라이브러리 선택**: TipTap/Quill/ProseMirror/Lexical/contentEditable 등 어떤 라이브러리를 쓸지는 Run 단계 소관. 본 SPEC은 어댑터 계약을 만족하는 *동작*만 정의 (plan.md에서 production-stable 후보를 권고).
- **인라인 임베드의 정확한 마크업 직렬화 포맷(HTML vs Markdown vs JSON AST)**: `markupVersion` 내부 인코딩의 구체 포맷은 Run 단계 소관. 본 SPEC은 round-trip 안정성(REQ-EDIT-EMBED-005)이라는 관찰 가능한 속성만 요구한다.
- **임베드 미디어의 실제 호스팅/프록시/CORS 처리, 썸네일 캐싱, 지연 로딩(lazy-load)**: 범위 밖.
- **에디터 협업(동시편집)·실시간 동기화·undo/redo 이력 깊이 등 고급 에디터 기능**: 범위 밖.
- **접근성(WCAG) 세부 준수, i18n/다국어, 다크모드**: 범위 밖 (상위 SPEC-FRONTEND-UI-001과 동일).
- **DB 스키마/DDL 변경**: `Article.markupVersion` 컬럼은 이미 존재(SPEC-DB-FOUNDATION-001). 신규 컬럼/마이그레이션은 도입하지 않는다.

---

## 참조 (References)

- 확장 대상 SPEC: `.moai/specs/SPEC-FRONTEND-UI-001/spec.md` (승인됨 — DP-F1 에디터 어댑터, REQ-FE-WRITE-007~011 검색/임베드)
- 의존(소비) SPEC: `.moai/specs/SPEC-BACKEND-CORE-001/spec.md` (승인됨 — REQ-SRCH-* 검색 결과 형태), `.moai/specs/SPEC-DB-FOUNDATION-001/spec.md` (승인됨 — markupVersion 컬럼/덮어쓰기 제약)
- 원천 명세: `news.md` 80~83줄 "기사 에디터", 48~56줄 "기사 작성페이지"
- 보존 계약 코드: `web/src/model/editorAdapter.js`, `web/src/controller/useWriteController.js`, `web/src/view/WritePage.jsx`, `web/src/controller/useSearchController.js`, `web/src/model/contract.js`, `src/services/mediaSearch.js`
- 디자인 토큰: `web/src/styles/yonhap.css`
- 프로젝트 HARD 규칙: `CLAUDE.md` — "모든 텍스트는 UTF-8", 현재 구현 범위는 기사 작성기
