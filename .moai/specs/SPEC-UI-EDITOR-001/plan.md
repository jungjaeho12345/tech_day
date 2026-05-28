# SPEC-UI-EDITOR-001 — 구현 계획 (Implementation Plan)

> 본 문서는 WHAT/WHY가 아닌 **HOW의 윤곽**을 다룬다. 구체 코드/함수명은 Run 단계 소관이며, 여기서는 작업 분해·기술 후보·위험·**결정 필요 항목**만 기록한다.

## 1. 작업 분해 (Work Breakdown)

우선순위 라벨: High / Medium / Low. 시간 추정 없음.

| ID | 작업 | 우선순위 | 관련 REQ |
|----|------|----------|----------|
| T1 | 구조 파서를 **순수 함수**로 구현 (입력: 본문 텍스트, 출력: `{title, subtitle, body}`). 어댑터/React와 분리하여 Vitest 단위테스트 가능하게. | High | REQ-EDIT-PARSE-001~006 |
| T2 | 파싱 규칙의 **빈 줄 경계 알고리즘** 확정값을 파서에 반영 (아래 §4 결정 필요 항목 확정 후). | High | REQ-EDIT-PARSE-003 |
| T3 | concrete 에디터를 `EditorAdapter` 계약 뒤에 배치 (`createPlainTextEditorAdapter` 대체 또는 신규 `create*EditorAdapter`). 상위 화면/DTO 조립 불변. | High | REQ-EDIT-ADP-001~003 |
| T4 | `markupVersion` 직렬화/역직렬화 — 구조(제목/부제목/본문) + 인라인 임베드가 round-trip 안정하도록 인코딩. | High | REQ-EDIT-PARSE-006, REQ-EDIT-EMBED-005 |
| T5 | 인라인 임베드 렌더링: 이미지/유튜브/내부기사 3종을 `embed(reference)`의 텍스트 append 대신 시각 인라인 요소로. | High | REQ-EDIT-EMBED-001~004, 007 |
| T6 | 연합뉴스 디자인 토큰(`yonhap.css`)으로 임베드 스타일링 (serif/sans, `--yh-red`, `--yh-gray-line`). | Medium | REQ-EDIT-EMBED-006 |
| T7 | Vitest 테스트: 파서 단위테스트 + 임베드 round-trip + WritePage 통합(어댑터 교체가 DTO에 영향 없음 회귀). | High | acceptance.md 전체 |

### 마일스톤 (우선순위 순서)

1. **M1 (High)**: T1 + T2 + T4 — 파서와 markupVersion 직렬화 (순수 로직, UI 비의존). 먼저 완료.
2. **M2 (High)**: T3 + T5 — 어댑터 concrete 구현 + 인라인 임베딩. M1 완료 후 시작.
3. **M3 (Medium)**: T6 — 디자인 토큰 적용. M2 완료 후.
4. 횡단: **T7** 테스트는 각 마일스톤과 병행 (TDD RED-GREEN-REFACTOR, tech.md `development_mode: tdd`).

## 2. 기술 접근 (Technical Approach)

- **어댑터 격리 원칙**: 리치텍스트 라이브러리는 `EditorAdapter` 계약 뒤에 완전히 격리한다. 상위(`WritePage`/`useWriteController`)는 `getMarkup()`/`setMarkup()`만 본다. 라이브러리 교체가 DTO 조립에 새는 것을 막는다 (REQ-EDIT-ADP-001).
- **파서 독립성**: 파싱은 React/에디터 라이브러리와 무관한 **순수 함수**로 둔다. `getMarkup()`이 반환할 직렬화 단계에서, 또는 DTO 조립 직전에 호출 가능. 라이브러리 비의존이라 테스트가 빠르고 안정적.
- **round-trip 직렬화**: 인라인 임베드와 구조는 `markupVersion` 단일 문자열에 인코딩되어야 한다 (DB는 markupVersion 단일 컬럼, 덮어쓰기). `setMarkup(getMarkup())`이 동일 상태를 복원해야 한다 (REQ-EDIT-EMBED-005). 직렬화 포맷(HTML/Markdown/JSON AST)은 Run 단계 선택.

### 리치텍스트 라이브러리 후보 (production-stable만 — 어댑터 뒤 격리 권고)

> 어느 것을 선택해도 `EditorAdapter` 계약 뒤에 숨겨야 한다. 아래는 권고 후보이며 최종 선택은 Run 단계.

| 후보 | 강점 | 비고 |
|------|------|------|
| **TipTap** (ProseMirror 기반) | React 19 호환, 커스텀 노드(인라인 임베드)에 강함, 활발한 유지보수, JSON AST 출력으로 round-trip 직렬화 자연스러움 | 권고 1순위 — 인라인 임베드 노드 모델이 이 SPEC 요구에 적합 |
| **Lexical** (Meta) | 경량, React 친화, 노드 기반 직렬화 | 권고 2순위 — 생태계가 TipTap보다 작음 |
| 네이티브 `contentEditable` + 수제 직렬화 | 의존성 0 | 비권고 — 임베드 round-trip/커서 처리 직접 구현 부담 큼, 회귀 위험 |

- Quill: 인라인 임베드(blot) 가능하나 React 19 통합/커스텀 노드 직렬화가 위 둘보다 번거로움 → 후순위.

## 3. 위험 및 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| 어댑터 교체가 DTO 조립/상위 화면에 새어나감 | DP-F1 계약 위반, 회귀 | 통합 테스트로 `assembleDto().markupVersion === adapter.getMarkup()` 불변 검증 (acceptance.md AC-가드). 계약 surface(`getMarkup`/`setMarkup`) 외 노출 금지. |
| 파싱 경계 규칙 모호로 인한 비결정성 | 같은 입력이 다른 구조 산출 | 순수 함수 + §4 확정 알고리즘 + 엣지 케이스 단위테스트(제목만/빈 본문/모호 개행). |
| 인라인 임베드 round-trip 불안정 | 저장→재로드 시 임베드 유실/중복 | JSON AST 또는 명확한 직렬화 포맷 선택 후 round-trip 테스트(REQ-EDIT-EMBED-005)를 게이트로. |
| markupVersion 덮어쓰기로 이력 없음 → 임베드 포맷 변경 시 기존 저장본 파싱 실패 | 기존 기사 렌더 깨짐 | 직렬화 포맷에 버전 태그/하위호환 파서. (단 이력 UI는 범위 밖 — DP-F1.) |
| 라이브러리 번들 크기 증가 | 빌드/로딩 성능 | production-stable 경량 후보(Lexical) 비교, 어댑터 뒤 lazy import 가능성 Run 단계 검토. |
| 검색 결과 형태 가정 오류 | 임베드 렌더 실패 | 소비 계약을 SPEC-BACKEND-CORE-001 확정값(`{source,title,url,thumbnailUrl}`)에 고정, 누락 필드 방어. |

## 4. 파싱 규칙 — 확정 (Parsing Rule: CONFIRMED)

> **[CONFIRMED]** **news.md 82줄** "둘째줄부터 5째줄까지 부제목, 단 개행라인이 2번이상 있으면 2번째부터는 본문"의 모호성은 **사용자 확정으로 후보 A(빈 줄 블록 분리)** 로 고정되었다. "개행라인 2번 이상" = 빈 줄(연속 개행)로 해석한다. 후보 B/C는 **기각된 대안**으로 아래에 보존한다.
>
> Reference: `news.md:81` (제목 규칙), `news.md:82` (부제목/본문 경계 규칙), `news.md:83` (임베딩 규칙)

### 후보 A (확정 CONFIRMED) — 빈 줄 블록 분리

- "개행라인이 2번 이상" = **연속된 개행으로 생기는 빈 줄(blank line)** 으로 해석.
- 알고리즘:
  1. `line[0]` = 제목.
  2. 제목 다음부터, **첫 빈 줄(연속 개행)이 나오기 전까지의 줄**을 부제목 블록으로 (단 최대 2~5번째 줄 = 최대 4줄 상한).
  3. 첫 빈 줄 *이후*의 모든 내용 = 본문.
  4. 빈 줄이 전혀 없으면: 2~5번째 줄(최대 4줄)을 부제목, 6번째 줄 이후를 본문.
- **근거**: 신문 작성 관습(제목 → 빈 줄 → 부제목/리드 → 빈 줄 → 본문)과 일치. 빈 줄은 작성자가 의도적으로 만드는 명시적 경계라 결정론적·테스트 가능. "개행 2번 이상"의 자연스러운 한국어 독해(= 한 줄 띄움)와 부합.

### 후보 B (기각) — 줄 인덱스 고정

- "개행라인 2번 이상" 무시. 2~5번째 줄 = 항상 부제목, 6번째 줄부터 본문.
- **근거**: 가장 단순·완전 결정론적. **약점**: 빈 줄 단서를 무시하고, 짧은 부제목(1줄)을 쓰는 작성자가 본문을 6째 줄로 밀어야 하는 부자연스러움.

### 후보 C (기각) — 빈 줄 우선, 없으면 5줄 상한

- 빈 줄이 있으면 후보 A. 없으면 부제목을 2~5줄로 채우되, 부제목으로 쓸 줄이 5줄을 초과하면 초과분을 본문으로.
- **근거**: A와 B의 절충. **약점**: 규칙이 복잡해 테스트 케이스가 늘고 작성자가 예측하기 어려움.

### 확정 결과

**후보 A로 확정됨** (사용자 승인) — 작성 관습 부합, 명시적 경계, 결정론, 최소 복잡도. REQ-EDIT-PARSE-003의 빈 줄 경계 규칙이 후보 A로 고정되었고, acceptance.md의 "모호한 개행 패턴" 엣지 케이스(EC-4)가 A 기준으로 검증된다. 더 이상 결정 대기 항목이 아니다.

## 5. 참조 구현 (Reference Implementations)

- 어댑터 계약: Reference: `web/src/model/editorAdapter.js:7` (`@typedef EditorAdapter`), `web/src/model/editorAdapter.js:17` (`createPlainTextEditorAdapter` — 대체 대상)
- 현행 embed(텍스트 append): Reference: `web/src/controller/useWriteController.js:32` (`embed` — 인라인 임베딩으로 대체 대상)
- DTO 조립(불변 유지): Reference: `web/src/controller/useWriteController.js:46` (`assembleDto`)
- 에디터 영역 View: Reference: `web/src/view/WritePage.jsx:94` (`editor-region` / `textarea`)
- 임베드 호출부(검색 결과 → onEmbed): Reference: `web/src/view/WritePage.jsx:55` (미디어), `web/src/view/WritePage.jsx:79` (글기사)
- 검색 결과 형태(소비): Reference: `src/services/mediaSearch.js:11` (`normalize` → `{source,title,url,thumbnailUrl}`)
- 디자인 토큰: Reference: `web/src/styles/yonhap.css:9` (`:root` 토큰), `web/src/styles/yonhap.css:24` (typography)

## 6. 전문가 자문 권고 (Expert Consultation)

- 프런트엔드(에디터 라이브러리 선택, 인라인 노드 모델, round-trip 직렬화) 도메인 → **expert-frontend** 자문 권고. 키워드: component, UI, state, rich-text editor.
- 백엔드/DevOps 자문은 불필요 (검색 백엔드는 이미 완성, 본 SPEC은 소비만).
