# SPEC-NEWS-REVISE-009 — Implementation Plan

> 작업 모드: Brownfield Δ-only (프론트엔드 한정). 대상 동작은 HEAD/작업 트리에 이미 구현되어 있으므로 Run 단계는 **회귀 가드 테스트 추가** + (PD5) 주석 정합만 수행한다. production 동작 코드 변경 0 을 기본값으로 한다.
> 우선순위는 High/Medium/Low 라벨만 사용한다(시간 추정 금지 — CLAUDE.md HARD).

---

## 1. 구현 접근 (Approach)

본 SPEC 의 4 REQ 는 모두 *이미 구현된 동작에 대한 명세 잠금*이다. 따라서 TDD RED 단계는 "현재 GREEN 인 동작을 표현하는 회귀 가드 테스트가 부재함"을 채우는 형태(가드 신설 → 즉시 GREEN 확인 → 회귀 시 RED 검출 보장)로 진행한다.

원칙:

- production 동작 코드(`WriteWorkspace.jsx`, `editorCaret.js`, `clipboardEmbed.js`, `yonhap.css` 의 사이징 값)는 변경하지 않는다.
- 유일한 production-인접 변경 후보는 PD5(`clipboardEmbed.js` 주석의 "10%x10%" 문구를 17% 로 정합) — 비-동작 주석 1줄.
- 타 SPEC(001~008)의 spec/plan/acceptance 3파일 및 news.md 는 수정하지 않는다(HARD).
- 편집 잠금 규칙은 SPEC-008/002 소관 — 본 SPEC 은 락 규칙을 신규/변경하지 않고 탭 UI 만 가드한다.

---

## 2. 영향 파일 목록 (Affected Files)

### 2.1 신규/수정 (테스트만 — Run 단계)

| 파일 | REQ | 변경 |
|------|-----|------|
| `web/src/view/WriteWorkspace.test.jsx` | REQ-MULTITAB-LIFECYCLE, REQ-EDIT-TAB-ROUTING | ＋ 신규 탭/독립 내용/탭 닫기 폐기/마지막 탭 블랭크/편집-새탭/재오픈-활성화/다른 기사 별도 탭/송고 성공 후 블랭크/실패 미전환 가드 추가 (AC-TAB-1~4, AC-EDTAB-1~5) |
| `web/src/view/editorCaret.test.js` | REQ-EMBED-TEXT-ORDER | `readOrderedContentFromDom` interleave 순서 보존 + Alt+Y "(끝)" 임베드 뒤 최종 블록 + round-trip 가드 (AC-ORDER-1~4) |
| `web/src/view/WritePage.test.jsx` | REQ-EMBED-TEXT-ORDER (통합) | (PD3 권장) 트레일링 임베드 뒤 입력/Enter 통합 가드 1건 (jsdom 한계 시 단위로 대체) |
| `web/src/view/clipboardEmbed.test.js` | REQ-CLIPBOARD-EMBED-SIZE | `yonhap.css` 사이징 규칙(17% / 612px / 480px) 텍스트 단언 + 10%/360px negative 가드 (AC-SIZE-1~3) |

### 2.2 production-인접 (PD5 — 주석만, 옵션)

| 파일 | 변경 |
|------|------|
| `web/src/view/clipboardEmbed.js` | 주석 "10%x10% sizing handled by CSS" → "17%x17% sizing handled by CSS"(news.md L127 정합). 동작 무변경 — 사이징은 `yonhap.css` 소관. |

### 2.3 절대 수정하지 않는 파일 [HARD]

- `.moai/specs/SPEC-NEWS-REVISE-001~008/*.md` (각 3파일)
- `news.md` (source-of-truth — 이미 반영됨)
- production 동작 코드(`WriteWorkspace.jsx` 로직, `editorCaret.js` 로직, `yonhap.css` 사이징 값, `useViewController.js`, `ViewPage.jsx`)
- `src/`, `server/` 백엔드 (본 SPEC 은 프론트 한정)

---

## 3. 마일스톤 (Priority-based, 시간 추정 없음)

### M1 — 멀티 탭 행위 가드 (Priority: High)

- 대상 REQ: REQ-MULTITAB-LIFECYCLE, REQ-EDIT-TAB-ROUTING
- `WriteWorkspace.test.jsx` 에 AC-TAB-1~4 + AC-EDTAB-1~5 가드 추가.
- 락 효과는 SPEC-008/002 계약 참조만 — 본 마일스톤은 탭 생성/활성화/폐기/전환 UI 만 단언.
- 완료 기준: 9개 AC GREEN, 기존 `WriteWorkspace.test.jsx` 회귀 없음.

### M2 — 임베드-텍스트 시각 순서 보존(Bug 1) 가드 (Priority: High)

- 대상 REQ: REQ-EMBED-TEXT-ORDER
- `editorCaret.test.js` 에 `readOrderedContentFromDom` interleave 보존 단위 가드(AC-ORDER-1·2·4) + Alt+Y "(끝)" 임베드 뒤 최종 블록(AC-ORDER-3) 추가.
- (PD3) `WritePage.test.jsx` 통합 가드 1건 권장.
- 완료 기준: 4개 AC GREEN, SPEC-001 커서/Ctrl+D, UI-EDITOR-001 임베드 상호 순서 회귀 없음.

### M3 — 클립보드 17% 사이징 가드 + 주석 정합 (Priority: Medium)

- 대상 REQ: REQ-CLIPBOARD-EMBED-SIZE
- `clipboardEmbed.test.js` 에 `yonhap.css` 사이징 단언(17% / 612px / 480px) + 10%/360px negative 가드 추가(AC-SIZE-1~3, PD4 전략).
- (PD5) `clipboardEmbed.js` 주석 1줄 17% 정합(동작 무변경).
- 완료 기준: 3개 AC GREEN, news.md L127 정본 잠금.

### M4 — 회귀 매트릭스 + 게이트 (Priority: High)

- §5 RG-1~7 검증: 001~008 AC GREEN, production 동작 무변경(`git diff --stat`), 빌드 무경고.
- 완료 기준: `npm run test:web` + `npm test` 전체 GREEN, `npm run build` 무경고, production 동작 변경 0.

---

## 4. 위험 (Risks) — §10 Pending Decisions 는 Plan 단계에서 모두 확정됨

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: 멀티탭 가드가 SPEC-008 락 동작과 결합되어 락 규칙을 의도치 않게 단언/변경 | 소관 침범 + 회귀 충돌 | M1 가드는 탭 UI(생성/활성/폐기/전환)만 단언하고 락 호출/해제는 SPEC-008/002 테스트에 위임. 본 SPEC 가드에서 lockYN/releaseEditLock 동작을 새로 단언하지 않음 |
| R2: Bug 1 단위 가드(editorCaret)가 통합 경로(repaint/Enter)를 충분히 커버하지 못함 | 통합 회귀 누락 | PD3 확정대로 단위 필수 + WritePage 통합 1건 권장. jsdom 한계 시 단위 가드를 강화 |
| R3: jsdom getComputedStyle 한계로 CSS 사이징 검증 false negative | AC-SIZE 신뢰성 저하 | PD4 확정대로 `yonhap.css` 텍스트 정규식/문자열 단언 우선(612px/480px/17%) + jsdom 보조 |
| R4: PD5 주석 변경이 production 변경으로 오분류되어 Δ-only 위반 판정 | 회귀 게이트 실패 | 주석은 비-동작 변경 — RG-6 에서 "비-테스트 production *동작* 변경 0" 으로 단언하고 주석 1줄은 명시적 허용 범위로 기록 |
| R5: 17% 정본과 SPEC-001/002 의 10% 기록의 표면적 충돌이 평가에서 모순으로 오인 | 정본 모순 플래그 | §10 PD1 확정: news.md(source-of-truth) 갱신을 forward-only 흡수, 타 SPEC 무수정 — *버전 차이*이지 모순 아님을 spec.md 에 명문화 |

---

## 5. 테스트 전략 (TDD — 회귀 가드 중심)

- 프론트(vitest, `npm run test:web`):
  - `WriteWorkspace.test.jsx`: ＋/독립 내용/탭 닫기 폐기/마지막 탭 블랭크/편집-새탭/재오픈-활성화/다른 기사 별도 탭/송고 성공 블랭크/실패 미전환.
  - `editorCaret.test.js`: `readOrderedContentFromDom` interleave(text→embed→text) 보존, `[...textBlocks,...embeds]` 미발생, Alt+Y "(끝)" 임베드 뒤 최종 블록, round-trip.
  - `clipboardEmbed.test.js`: `yonhap.css` 17%/612px/480px 단언 + 10%/360px negative.
- 백엔드(`npm test`): 본 SPEC 은 프론트 한정이므로 백엔드 신규 가드 없음 — 기존 백엔드 전체 GREEN 회귀 확인만.
- 회귀 가드: 001~008 AC GREEN, `npm run build` 무경고, `git diff --stat` 으로 production 동작 무변경.

---

## 6. 도메인 정합 체크리스트 (moai-domain-news-editor)

- [ ] 권한 매트릭스 R/D/Z 의미 불변(본 SPEC 은 권한을 다루지 않음).
- [ ] 생애주기 RDS/DPS/RRH/RRK/DDH/DDK 불변(본 SPEC 은 lifecycle 을 다루지 않음).
- [ ] 12 공통정보/단축키(Alt+Y "(끝)", Ctrl+D) 의미 불변 — Alt+Y 는 순서 관점만 잠금.
- [ ] 17%×17% / figure 612px / 카드 480px / Alt+Y embeds 뒤 배치가 SKILL.md 도메인 사실(L74·L212)과 정합.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-08
