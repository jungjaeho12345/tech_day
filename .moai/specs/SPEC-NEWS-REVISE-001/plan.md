---
id: SPEC-NEWS-REVISE-001
artifact: plan
version: 0.1.0
created: 2026-06-02
updated: 2026-06-02
---

# Plan — SPEC-NEWS-REVISE-001

## 1. 구현 접근 (Implementation Approach)

본 SPEC은 **Brownfield Δ-only**이다. 기존 SPEC 3종(UI-EDITOR-001, FRONTEND-UI-001, AUTH-001)의 계약을 침범하지 않고, 변경된 `news.md`와 정합하도록 **(1) Z권한 버튼 분기 추가**, **(2) 상세보기 분리 레이아웃 보강(거의 완료)**, **(3) 인라인 임베딩 의미 고정 + Ctrl+D 신규** 세 가지만 적용한다.

전략 원칙:

- 기존 React 컴포넌트에 *분기 추가*만 하고 *기존 분기는 유지* (regression-safe)
- 신규 핸들러는 *순수 함수*로 추출하여 단위테스트 우선 작성 (TDD RED-GREEN-REFACTOR)
- 임베드 영속성은 *직렬화 round-trip 테스트*로 회귀 가드 (`markupVersion` ↔ DOM)
- 디자인 토큰은 **추가 없이** 재사용 (`--yh-blue`, `--yh-gray-line` 등)

## 2. 마일스톤 (Priority-based, No Time Estimates)

### M0 — 준비 (Priority: High)

- spec.md / plan.md / acceptance.md 사용자 승인 (annotation cycle)
- Pending Decisions 잠금 (아래 "Decision Lock" 참조)
- 기존 테스트 베이스라인 캡처 (`npm test -- --run`)

## Decision Lock (2026-06-02 사용자 확정)

| ID | 결정 | 적용 위치 |
|---|---|---|
| **D-1** | Z권한의 송고/보류/KILL 버튼은 `status === 'RDS'`일 때만 표시 (R/D와 동일) | REQ-AUTH-Z-BUTTONS / AC-Z-1~5 / WritePage.jsx 버튼 분기 |
| **D-2** | Ctrl+D 멀티라인 선택 시 선택된 모든 라인을 라인 단위 round-up 으로 전체 삭제 (VSCode 스타일) | REQ-EDITOR-EMBED-AND-CTRL-D / AC-CTRL-D-2 / editorShortcuts 신규 모듈 |
| **D-3** | 임베드 직렬화 형식은 SPEC-UI-EDITOR-001에 위임. 본 SPEC은 round-trip 보존 행위만 단언 | REQ-EDITOR-EMBED-AND-CTRL-D / AC-EMB-2 |
| **D-4** | 포인트 컬러는 파랑 `#0A4DA6` 유지 (CLAUDE.md HARD 규칙 "파란색과 흰색" 우선). news.md의 #C8102E 표현은 적용하지 않음 | 전 컴포넌트 / 디자인 토큰 `--yh-blue` 재사용 |
| **D-5** | 미커밋 작업트리는 SPEC 작성 후 두 갈래 커밋 분리(`chore(hooks)`, `feat(news)`)로 정리됨 — Run은 깨끗한 트리에서 시작 | 운영 결정 (구현 외) |
| **D-6** | Z권한의 송고/보류/KILL 전이는 D권한과 동일 (RDS→DPS/DDH/DDK). 근거: news.md "Z=관리자 + 데스크 편집 권한"이 D와 의미적으로 정렬 | lifecycle.js TRANSITIONS / articleService KILL_BY_ROLE |
| **D-7** | 본문 contentEditable의 IME 합성(composition) 중에는 onInput→state 갱신/useEffect repaint/compositionEnd 내 recolor를 모두 차단. Enter는 합성 여부와 무관하게 항상 preventDefault. 근거: 매 키스트로크 paintEditor(replaceChildren)이 IME 합성 노드를 파괴해 "1글자 지연 + Enter 두 번" 증상을 유발 | WritePage.jsx BodyEditor onInput / useEffect / onCompositionEnd / handleEnter |


### M1 — REQ-DETAIL-LAYOUT-SPLIT (Priority: High, 가장 단순)

- `articleDetail.js` 상태 확인 (이미 분리 구조 존재)
- `articleDetail.test.js`에 AC-DTL-1~6 단언 보강
  - DOMParser 기반 섹션 구조 검증
  - 12 공통정보 필드 enumerate 검증
  - 빈 제목/이스케이프 케이스
- 모든 단언 GREEN 확인
- (선택) 미커밋 변경분 commit 분리 가능성 검토

### M2 — REQ-AUTH-Z-BUTTONS (Priority: High)

- `WritePage.test.jsx`에 RED 테스트 작성 (AC-Z-1, AC-Z-2, AC-Z-3, AC-Z-5)
- `WritePage.jsx` 버튼 분기에 Z 추가:
  - 송고/보류 분기: `(role === 'R' || role === 'D' || role === 'Z') && isRds`
  - KILL 분기: `(role === 'R' || role === 'Z') && isRds`
- (확정) Z 권한도 R/D 동일하게 `isRds` gating 유지 — Pending Decisions에서 사용자 확정 필요
- R/D 회귀 테스트(AC-Z-4) 통과 재확인
- 접근성: `aria-label` 추가 또는 visible label 유지

### M3 — REQ-EDITOR-EMBED-AND-CTRL-D (Priority: Medium)

- M3.1 인라인 임베딩 영속성 회귀 가드 (AC-EMB-1~3)
  - `useWriteController.test.jsx` 또는 새 테스트 파일에 round-trip 단언 추가
  - SPEC-UI-EDITOR-001 구현이 이미 커서 위치 삽입을 지원한다는 전제 — 미지원 시 별도 이슈 raise
- M3.2 Ctrl+D 라인 삭제 핸들러 신규 (AC-CTRL-D-1~5)
  - 순수 함수 추출: `deleteLineAtSelection(text, selection) → { text, selection }`
  - 단위테스트 RED → GREEN (단일/멀티라인/경계/스코프)
  - React 통합: 에디터 컨테이너에 `onKeyDown` 핸들러 + `preventDefault`
  - Alt+Y 회귀 보호 (AC-CTRL-D-5)

### M4 — 통합 회귀 (Priority: High)

- `npm test` 전체 통과
- `npm run build` 무경고
- TRUST 5 self-check
- (선택) E2E 시나리오 수동 검증

### M5 — 동기 및 문서화 (Priority: Medium)

- `/moai sync SPEC-NEWS-REVISE-001`
- `news.md` 변경 이력 commit 메시지에 SPEC ID 포함
- Slack `tech-day` 채널에 작업 완료 보고 (CLAUDE.md HARD 규칙)

## 3. 기술 접근 (Technical Approach)

### 3.1 REQ-AUTH-Z-BUTTONS

- 최소 변경: `WritePage.jsx`의 두 조건식에 `|| user.role === 'Z'` 추가
- 위험: 기존 주석 `// KILL for role R, both only while the editing article's status is RDS.` 를 Z 포함하도록 갱신 필요
- 회귀: 기존 R/D 케이스 테스트는 그대로 유지

### 3.2 REQ-DETAIL-LAYOUT-SPLIT

- 변경 거의 없음. `articleDetail.js`의 두 `<section aria-label="제목">` / `<section aria-label="본문">` 분리 구조와 12 필드 출력이 이미 미커밋 변경에 포함됨
- 추가 작업: 테스트 단언 보강 (jsdom 기반 파싱 + enumerate)

### 3.3 REQ-EDITOR-EMBED-AND-CTRL-D

- **임베드 위치/영속성**: SPEC-UI-EDITOR-001가 정의한 어댑터 계약(`markupVersion`) 위에 *행위 단언*만 추가. 본 SPEC은 구체 직렬화 포맷을 강제하지 않음
- **Ctrl+D**: 새 순수 함수 모듈 (예: `web/src/view/editorShortcuts.js`) — 텍스트 + 선택 상태에서 라인 단위 round-up 삭제
  - 알고리즘 (의사 코드 — 문장 형식): 입력 텍스트를 `\n`으로 분할한 라인 배열로 변환. 선택 시작/끝의 line index를 산출 (시작=`start`, 끝=`end`, end가 라인 시작 offset이면 end-1). `start..end` 라인을 제거. 다시 join. 새 캐럿은 `start` 라인의 시작 (그 라인이 사라졌으면 새 라인 배열의 동일 인덱스 시작)
- React 통합: 에디터 컨테이너의 `onKeyDown`에서 `event.ctrlKey && event.key === 'd'` → `event.preventDefault()` → 핸들러 호출
- 포커스 스코프: 에디터 컨테이너의 `onKeyDown`에만 바인딩 (전역 `window` 리스너 금지)

## 4. 의존성 (Dependencies)

- React 19, Vite 7, Vitest ^3.2.4, jsdom — 이미 설치됨
- `web/src/view/WritePage.jsx` (수정)
- `web/src/view/articleDetail.js` (확인만)
- `web/src/view/editorAdapter.js` 계약 (소비만, 변경 없음)
- `web/src/controller/useWriteController.js` (round-trip 테스트 추가)

## 5. 결정 필요 항목 (Pending Decisions — 사용자 승인 필요)

| ID | 결정 항목 | 옵션 | 본 SPEC의 추정 기본값 |
|----|----------|------|---------------------|
| D-1 | Z권한 송고/보류/KILL이 `status === 'RDS'`에만 가시인가? 아니면 Z는 status 무관? | (A) R/D와 동일하게 RDS gate / (B) status 무관 (Z 전권) | (A) RDS gate — `news.md`의 R/D status gating과 일관 |
| D-2 | Ctrl+D 멀티라인 선택 거동 | (A) 라인 단위 round-up (선택 일부 포함 라인 전체 삭제) / (B) 선택만 삭제 후 한 라인만 삭제 | (A) round-up — VSCode `Ctrl+Shift+K`와 유사 |
| D-3 | 임베드 직렬화 형식 (markupVersion 내 표현) | (A) HTML data-attr / (B) JSON 노드 / (C) SPEC-UI-EDITOR-001 결정 위임 | (C) SPEC-UI-EDITOR-001에 위임 |
| D-4 | 색 토큰 (블루 vs 레드) | (A) 현 구현 유지 (블루 `#0A4DA6`) / (B) 사용자 지시문대로 레드 `#C8102E` 추가 적용 | (A) 블루 유지 — CLAUDE.md 디자인 규칙("파란색과 흰색")과 정합 |
| D-5 | 작업 분할 — Z권한과 Ctrl+D를 한 SPEC에 묶을지 분리할지 | (A) 단일 SPEC 3 REQ (현 형식) / (B) SPEC 3개로 분할 | (A) 단일 SPEC — news.md 단일 개정 트리거 |

## 6. 위험 (Risks)

위험 표는 spec.md §9에 정리되어 있다. 추가로:

- **R-PLAN-1**: 미커밋 변경분(`WritePage.jsx`, `articleDetail.js`)이 이미 본 SPEC의 일부를 부분 구현하고 있어, 변경분의 의도와 본 SPEC의 의도가 미세하게 다를 가능성. → Run 단계 진입 전 작업트리 commit 또는 stash 결정 필요 (수정/되돌리기는 사용자 권한)
- **R-PLAN-2**: `news.md` 64줄 변경 표현("Z권한은 송고/보류/KILL")이 단순 권한 추가인지, "R/D와 동일 매트릭스"인지의 해석 차 → D-1 결정에 의존

## 7. 출력물 (Deliverables)

- `web/src/view/WritePage.jsx` (수정)
- `web/src/view/WritePage.test.jsx` (확장)
- `web/src/view/articleDetail.test.js` (보강)
- `web/src/view/editorShortcuts.js` 또는 동등 모듈 (신규)
- 해당 단위/통합 테스트
- Slack `tech-day` 채널 작업 완료 보고

Version: 0.1.0
