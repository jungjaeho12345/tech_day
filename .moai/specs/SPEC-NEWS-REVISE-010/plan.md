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

# SPEC-NEWS-REVISE-010 — 구현 계획 (Implementation Plan)

## 1. 개요 (Overview)

본 SPEC 은 `news.md` 의 3개 항목을 1급 EARS 로 잠그는 **Brownfield Δ-only(회귀 가드 + 명세 잠금)** 작업이다. 세 항목 모두 이미 코드에 구현되어 동작 중이므로, 구현 계획의 핵심은 **신규 동작 추가가 아니라 "회귀 잠금 테스트"의 정식 등재** 다. 따라서 Run 단계는 대부분 (a) 기존 동작을 특성화/잠금하는 테스트를 acceptance.md 의 AC 에 맞춰 보강하고, (b) 명세–코드 정합을 단언하는 데 집중한다.

## 2. 항목 → REQ → 구현체 → 검증 매핑

| 항목 (news.md) | REQ | 우선순위 | 구현체(이미 존재) | 검증 레이어 |
|---|---|---|---|---|
| L92 목록 10개/페이징 | REQ-LIST-PAGINATION | High | `web/src/view/ViewPage.jsx` (`PAGE_SIZE=10`, `slice`, `page-prev/next/indicator`) | `npm run test:web` (vitest, `web/src/view/ViewPage.test.jsx`) |
| L101~104 세션 sliding | REQ-SESSION-SLIDING | High | `src/services/sessionService.js` (`createSessionService({ttlMs, now})`, `touchSession`, `validateSession`), `server/index.js` (`touchSession` 와이어링) | `npm test` (node test runner, `test/sessionService.test.js`, `test/serverAuthWiring.test.js`) |
| L91 행 클릭 상세 새창 | REQ-ROW-CLICK-DETAIL | Medium | `web/src/view/ViewPage.jsx` (`openArticleDetail`→`window.open`, 행 `onClick={openDetail}`), `web/src/view/articleDetail.js` (`buildArticleDetailHtml`) | `npm run test:web` (vitest, `web/src/view/ViewPage.test.jsx`) |

## 3. 마일스톤 (우선순위 기반, 시간 추정 없음)

### M1 — 세션 sliding 명세 잠금 (Priority: High)
- `test/sessionService.test.js` 에 REQ-SESSION-SLIDING 의 AC 를 1급 회귀 잠금으로 정식 등재: 1시간 임계, 활동 시 sliding 갱신, 1시간 무동작 만료, 로그아웃 즉시 무효화.
- **[HARD] 모든 세션 만료 테스트는 `createSessionService({ ttlMs, now })` 의 `now`(또는 `ttlMs`)를 명시적으로 주입한다.** 시계 고정 없이 작성하면 실시간 의존으로 비결정적으로 깨진다(NFR 5.1).
- `test/serverAuthWiring.test.js` 에서 보호 요청/액션/저장 경로가 `touchSession` 으로 활동을 갱신함을 단언(이미 존재하는 와이어링의 회귀 가드).

### M2 — 조회 목록 페이징 명세 잠금 (Priority: High)
- `web/src/view/ViewPage.test.jsx` 에 REQ-LIST-PAGINATION 의 AC 를 등재: 10개/페이지, 11건 이상 시 페이지 컨트롤 노출, 다음/이전 이동, 메뉴 전환·조회 시 1페이지 리셋, 페이지 초과 시 마지막 페이지 보정.
- 4메뉴 모두 동일 `PAGE_SIZE=10` 적용 + 8컬럼 무변경 회귀 가드.

### M3 — 행 클릭 상세 새창 명세 잠금 (Priority: Medium)
- `web/src/view/ViewPage.test.jsx` 에 REQ-ROW-CLICK-DETAIL 의 AC 를 등재: 행 클릭 시 `window.open` 호출 + 상세 콘텐츠 생성, 우클릭 상세보기와 동일 렌더 경로(`buildArticleDetailHtml`) 사용.

### M4 — 명세–코드 정합 및 빌드 검증 (Priority: High)
- `npm run test:web` + `npm test` 전체 GREEN.
- `npm run build` (vite build web) 성공.
- Slack tech-day 채널 보고(CLAUDE.md HARD — DoD).

## 4. 기술 접근 (Technical Approach)

- **명세 잠금 우선**: 코드 변경을 최소화하고, 이미 구현된 동작을 단언하는 테스트를 추가/정식화한다. 코드 변경이 필요한 경우는 명세–코드 불일치(예: 페이지 리셋 누락, 만료 임계 불일치)가 발견될 때로 한정한다.
- **결정론 강제**: 세션 시간 의존 테스트는 `now` 주입 패턴 사용(프로젝트 락 테스트 시한폭탄 교훈과 동일 원칙 — 시각 고정 필수).
- **진입점 일관성**: 행 클릭 상세와 우클릭 상세보기는 동일한 `buildArticleDetailHtml` 렌더 경로를 공유함을 잠근다(두 진입점이 갈라지면 회귀로 적발).

## 5. 리스크 (Risks)

| 리스크 | 영향 | 완화 |
|---|---|---|
| R-1: 세션 만료 테스트가 실시간 시계에 의존 | 미래 시점/CI 환경에서 비결정적 FAIL | `now`/`ttlMs` 명시 주입(NFR 5.1, M1 HARD) |
| R-2: 페이징 잠금이 4메뉴 중 일부만 커버 | 일부 메뉴 회귀 미적발 | 4메뉴 전부에 대해 동일 `PAGE_SIZE`·리셋·보정 단언 |
| R-3: "탭/브라우저 닫힘 세션 종료"(L104) 를 본 SPEC 으로 오해 | 범위 혼선 | Exclusion + REQ-SESSION-SLIDING 정합 노트에서 SPEC-NEWS-REVISE-008 로 명시 위임 |
| R-4: 디자인(레드)·우클릭 미구현 메뉴를 본 SPEC 으로 끌어들임 | 범위 비대화(Simplicity 위반) | Exclusion 에 명시 제외 |

## 6. 의존성 (Dependencies)

- SPEC-FRONTEND-UI-001 (조회 페이지 4메뉴/8컬럼 — 회귀 가드 대상)
- SPEC-AUTH-001 (세션 만료 미인증 취급/로그아웃 — 정합 대상)
- SPEC-EDIT-LOCK-001, SPEC-NEWS-REVISE-008 (락 해제 vs 세션 만료 구분)
- SPEC-NEWS-REVISE-001 / 003 (상세 새창 레이아웃/폰트 — 행 클릭 진입점이 공유)

## 7. 검증 명령 (실제 레이아웃 기준)

- 프런트엔드(페이징·행 클릭): `npm run test:web` → `vitest run --root web` (`web/src/view/ViewPage.test.jsx`)
- 백엔드(세션 sliding): `npm test` → `node --experimental-sqlite --test test/*.test.js` (`test/sessionService.test.js`, `test/serverAuthWiring.test.js`)
- 빌드: `npm run build` → `vite build web`

> 주의: 프런트엔드 테스트는 `web/src/view/*.test.jsx` 에 위치하며 `vitest` 로 실행한다. 백엔드 테스트는 루트 `test/*.test.js` 에 위치하며 node test runner 로 실행한다. (`src/services/__tests__/` 같은 경로는 본 리포에 존재하지 않는다.)
