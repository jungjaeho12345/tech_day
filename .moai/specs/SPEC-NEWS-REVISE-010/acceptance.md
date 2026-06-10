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

# SPEC-NEWS-REVISE-010 — 인수 기준 (Acceptance Criteria)

> 모든 AC 는 **실제 테스트 레이아웃** 기준으로 검증 가능하다.
> - 프런트엔드: `web/src/view/*.test.jsx` → `npm run test:web` (vitest, `--root web`)
> - 백엔드: `test/*.test.js` → `npm test` (node test runner)
> - 빌드: `npm run build` (vite build web)
>
> 본 SPEC 은 Brownfield Δ-only(회귀 잠금)이므로, 각 AC 는 **이미 구현된 동작**을 단언한다.

---

## §1. REQ-LIST-PAGINATION — 조회 목록 4메뉴 10개/페이지

검증 위치: `web/src/view/ViewPage.test.jsx` (`npm run test:web`)

### AC-PAGE-1 — 페이지당 10개 표시
- **Given** 임의 메뉴(예: 데스크 미송고)에서 23건의 기사가 조회된 상태
- **When** 조회 페이지가 렌더링된다
- **Then** 첫 페이지에 정확히 10개 행만 표시된다
- **And** 페이지 지시자(`data-testid="page-indicator"`)가 `1 / 3` 을 표시한다

### AC-PAGE-2 — 다음/이전 이동
- **Given** 23건 조회로 3페이지가 존재하는 상태
- **When** "다음"(`data-testid="page-next"`)을 누른다
- **Then** 2페이지 구간(11~20번째)의 10개 행이 표시되고 지시자가 `2 / 3` 으로 갱신된다
- **And** 마지막 페이지(3페이지)에서는 나머지 3개 행만 표시된다
- **And** 1페이지에서 "이전"(`data-testid="page-prev"`)은 비활성(`disabled`)이다

### AC-PAGE-3 — 10개 이하일 때 페이지 컨트롤 미노출
- **Given** 조회된 기사가 10건 이하인 상태
- **When** 조회 페이지가 렌더링된다
- **Then** 페이지 이동 컨트롤(`yh-pagination`)이 노출되지 않는다

### AC-PAGE-4 — 메뉴 전환/조회 시 1페이지 리셋
- **Given** 사용자가 3페이지를 보고 있는 상태
- **When** 다른 메뉴로 전환하거나 부서별 조회 버튼을 누른다
- **Then** 현재 페이지가 1페이지로 리셋된다

### AC-PAGE-5 — 페이지 초과 시 마지막 페이지 보정
- **Given** 사용자가 3페이지를 보고 있고, 목록이 실시간 갱신으로 8건(1페이지 분량)으로 축소된 상태
- **When** 목록이 갱신된다
- **Then** 현재 페이지가 마지막 유효 페이지(1페이지)로 보정된다

### AC-PAGE-6 — 4메뉴 8컬럼 무변경 (회귀 가드)
- **Given** 페이징이 적용된 4개 메뉴 각각
- **When** 목록 행이 렌더링된다
- **Then** 각 행은 SPEC-FRONTEND-UI-001 REQ-FE-VIEW-011 의 8컬럼(기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN) 구성을 유지한다

---

## §2. REQ-SESSION-SLIDING — 세션 1시간 sliding idle 만료

검증 위치: `test/sessionService.test.js`, `test/serverAuthWiring.test.js` (`npm test`)

> [HARD] 모든 시간 의존 AC 는 `createSessionService({ ttlMs, now })` 의 **`now`(또는 `ttlMs`)를 명시적으로 주입** 하여 검증한다. 실시간 시계에 의존하면 미래 시점/CI 에서 비결정적으로 깨진다.

### AC-SESS-1 — 활동 시 sliding 갱신 (1시간 임계)
- **Given** `createSessionService({ ttlMs: 60*60*1000, now: () => clock })` 로 세션을 생성하고 `clock` 을 제어하는 상태
- **When** 만료 직전(예: 59분 시점)에 `touchSession(sessionId)` 을 호출한다
- **Then** 만료 시점이 현재 `clock` 기준 1시간 뒤로 갱신되어, 그 시점부터 다시 1시간 동안 세션이 유효하다
- **And** 갱신 후 `clock` 을 추가 59분 진행시켜 `validateSession` 하면 여전히 유효하다

### AC-SESS-2 — 1시간 무동작 만료
- **Given** `ttlMs: 60*60*1000`, `now` 주입으로 세션을 생성한 상태
- **When** 마지막 활동 이후 `clock` 을 60분 이상(예: 60분 1ms) 진행시킨다
- **Then** `validateSession(sessionId)` 가 `undefined`(미인증) 를 반환한다
- **And** `getSession(sessionId)` 도 만료 세션을 읽지 못한다 (SPEC-AUTH-001 REQ-AUTH-GUARD-003 정합)

### AC-SESS-3 — 활동 미만 시 유지
- **Given** `now` 주입 세션
- **When** 마지막 활동 이후 경과 시간이 1시간 미만(예: 59분 59초)인 상태에서 `validateSession` 한다
- **Then** 세션이 유효(인증됨)로 유지된다

### AC-SESS-4 — 로그아웃 즉시 무효화 (sliding 무관)
- **Given** 활동으로 갱신되어 만료 시점이 1시간 뒤로 미뤄진 유효 세션
- **When** 사용자가 로그아웃하여 세션을 무효화한다
- **Then** 남은 sliding 시간과 무관하게 세션이 즉시 무효가 되어 `validateSession` 이 `undefined` 를 반환한다 (SPEC-AUTH-001 REQ-AUTH-SESS-004 정합)

### AC-SESS-5 — 새로고침/요청/액션/저장이 활동으로 갱신 (와이어링 회귀 가드)
- **Given** 서버 보호 경로(요청 검증, 송고/보류/KILL 액션, 기사 저장)가 와이어링된 상태 (`test/serverAuthWiring.test.js`)
- **When** 인증된 보호 요청(새로고침 포함)·액션·저장 경로가 호출된다
- **Then** 각 경로가 `touchSession` 을 호출하여 세션 만료 시점을 갱신한다(`server/index.js` 의 sliding 와이어링 회귀 가드)

---

## §3. REQ-ROW-CLICK-DETAIL — 행 클릭 상세 새창

검증 위치: `web/src/view/ViewPage.test.jsx` (`npm run test:web`)

### AC-ROW-1 — 행 클릭 시 새 창 상세
- **Given** 조회 목록에 기사 행이 표시된 상태
- **When** 사용자가 기사 행을 (좌)클릭한다
- **Then** `window.open` 이 호출되어 새 창이 열리고, 그 창에 해당 기사의 제목/본문/공통정보가 표시된다

### AC-ROW-2 — 우클릭 상세보기와 동일 렌더 경로 (일관성 회귀 가드)
- **Given** 동일 기사에 대해 (a) 행 클릭과 (b) 우클릭 → 상세보기 두 진입점이 존재
- **When** 두 진입점 각각으로 상세를 연다
- **Then** 두 경로 모두 동일한 상세 렌더 경로(`articleDetail.js` `buildArticleDetailHtml`)를 사용하여 동일 콘텐츠를 표시한다 (SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT / SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS 와 정합)

---

## §4. 엣지 케이스 (Edge Cases)

- **EC-1 — 정확히 10건**: 조회 결과가 정확히 10건이면 단일 페이지로 표시되고 페이지 컨트롤은 노출되지 않는다(AC-PAGE-3 경계).
- **EC-2 — 0건**: 조회 결과가 0건이면 빈 목록 안내가 표시되고 페이지 컨트롤은 노출되지 않으며 페이지 지시자는 `1 / 1` 경계에서 오류 없이 처리된다.
- **EC-3 — 만료 직전 활동의 경계**: 마지막 활동 후 정확히 ttl 경계(예: 60분 0ms)에서의 판정이 결정론적이다(`now` 고정으로 검증, `>=` vs `>` 경계 명시).
- **EC-4 — 로그아웃 후 재요청**: 로그아웃으로 무효화된 세션 식별자로 보호 요청 시 미인증으로 거부된다(AC-SESS-4 + SPEC-AUTH-001 EC 정합).

---

## §5. 품질 게이트 (Quality Gate)

- [ ] `npm run test:web` (vitest) — §1, §3 AC 전부 GREEN
- [ ] `npm test` (node test runner) — §2 AC 전부 GREEN, 모든 세션 시간 테스트가 `now`/`ttlMs` 주입 사용
- [ ] `npm run build` (vite build web) 성공
- [ ] 4메뉴 8컬럼 회귀 무손상(AC-PAGE-6)
- [ ] 행 클릭/우클릭 상세 진입점 콘텐츠 일관성(AC-ROW-2)
- [ ] 세션 만료 vs 편집 잠금(lockYN) 해제 혼동 없음(Exclusion 준수)

---

## §6. Definition of Done

- [ ] REQ-LIST-PAGINATION / REQ-SESSION-SLIDING / REQ-ROW-CLICK-DETAIL 의 모든 AC 가 회귀 잠금 테스트로 등재되고 GREEN
- [ ] 신규 동작 추가 없음 — 기존 구현의 명세 잠금만 수행됨을 확인(Δ-only)
- [ ] spec.md / plan.md / acceptance.md 3종 version 0.2.0 동기화 유지
- [ ] 작업 완료 후 Slack tech-day 채널 보고(CLAUDE.md HARD)
- [ ] DB 변경 없음, 코드 동작 변경 없음(명세–코드 정합 단언만) 확인
