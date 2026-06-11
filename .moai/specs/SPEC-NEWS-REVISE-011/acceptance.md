---
id: SPEC-NEWS-REVISE-011
version: 0.2.0
status: Completed
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-007
  - SPEC-NEWS-REVISE-008
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-011 — 수용 기준 (Acceptance Criteria)

## 테스트 레이아웃 (실제 기준)

- 프론트엔드: `web/src/view/*.test.jsx` (vitest) — 실행 `npm run test:web`.
- 백엔드: `test/*.test.js` (node test runner, node:sqlite) — 실행 `npm test`.
- 빌드: `npm run build` (vite build web) 무경고.
- 락 관련 테스트는 `now` 고정 전달(30분 stale 시한폭탄 방지).

각 시나리오는 Given/When/Then 으로 기술하며, 모든 AC 는 관찰 가능한 증거(렌더된 버튼, Contents.status, 거부 결과)로 단언한다.

---

## §1. REQ-DPS-BUTTONS — DPS 고침/포털고침 송고·보류 버튼 (프론트엔드, `web/src/view/WritePage.test.jsx`)

### AC-DPS-BTN-1 — DPS + R/D/Z 송고·보류 노출

- **Given** 작성 페이지가 편집 컨텍스트로 진입하여 로드된 기사의 상태값이 `DPS` 이고, 사용자 권한이 `D`(그리고 `R`, `Z` 각각)
- **When** 버튼 영역을 렌더한다
- **Then** "송고" 버튼과 "보류" 버튼이 문서에 존재한다(`getByRole('button', { name: '송고' })`, `name: '보류'` 모두 truthy). 세 권한(R/D/Z) 각각에서 동일하게 노출된다.

### AC-DPS-BTN-2 — DPS KILL 비표시

- **Given** 로드된 기사의 상태값이 `DPS`, 권한이 `D`(그리고 `R`, `Z`)
- **When** 버튼 영역을 렌더한다
- **Then** "KILL" 버튼은 문서에 존재하지 않는다(`queryByRole('button', { name: 'KILL' })` 가 null).

### AC-DPS-BTN-3 — DPS 송고 가드(끝/제목/확인창) 적용

- **Given** 상태값 `DPS`, 권한 `D`, 본문에 "(끝)" 마커가 **없는** 기사
- **When** "송고" 버튼을 클릭한다
- **Then** 기존 RDS 송고와 동일하게 본문 끝 "(끝)" 가드가 발화하여 송고가 차단되고(ALERT), `ctrl.send` 의 전이가 적용되지 않는다.
- **And Given** "(끝)" 마커가 있고 제목이 있는 DPS 기사에서 "송고" 클릭 시 `window.confirm('송고하시겠습니까?')` 확인창이 선행하고, 확인 시에만 진행한다(취소 시 미발생).

### AC-DPS-BTN-4 — 상태값 기준 게이트(모드 플래그 무도입)

- **Given** 컨트롤러 반환 객체(`useWriteController`)
- **When** 진입점(데스크 미송고 편집 / 부서별 송고 고침 / 포털고침)이 무엇이든 동일 `{ id }` 로 진입한다
- **Then** 버튼 노출은 오직 `ctrl.status === 'DPS'` 로만 판정되며, 컨트롤러 반환 키에 `reviseMode`/`isRevise`/`mode` 등 어떤 고침 모드 플래그도 추가되지 않는다(SPEC-007 AC-REV-2 회귀 가드 재확인).

---

## §2. REQ-DPS-ENTRY-GATE — 고침/포털고침 진입 게이트 D 한정 (프론트엔드, `web/src/view/ViewPage.contextMenu.test.jsx` / `ViewPage.test.jsx`)

### AC-DPS-GATE-1 — D + DPS 진입 활성/포워딩(회귀)

- **Given** 부서별 송고 메뉴, DPS 기사, 권한 `D`
- **When** 행을 우클릭하여 컨텍스트 메뉴를 연다
- **Then** "고침(포털제외)"/"포털고침" 항목이 enabled 이고, 클릭 시 `navigate(ROUTES.WRITE, { id: article.articleId })` 로 포워딩된다(SPEC-007 AC-FWD-2 회귀).

### AC-DPS-GATE-2 — R/Z 진입 비활성 유지

- **Given** 부서별 송고 메뉴, DPS 기사, 권한 `R`(그리고 `Z`)
- **When** 행을 우클릭하여 컨텍스트 메뉴를 연다
- **Then** "고침(포털제외)"/"포털고침" 항목이 disabled 로 유지되고 포워딩이 발생하지 않는다(진입 게이트를 R/Z 로 확대하지 않음 — REQ-DPS-ENTRY-GATE Unwanted, SPEC-007 AC-REV-3 회귀).

---

## §3. REQ-DPS-LIFECYCLE — DPS-출발 송고·보류 전이 (백엔드, `test/lifecycleRule.test.js`)

### AC-DPS-LC-1 — DPS|R/D/Z|send → DPS

- **Given** `:memory:` SQLite + `createArticleService`, DPS 상태로 적재된 기사(예: RDS 적재 후 D 송고로 DPS 진입, `now` 고정)
- **When** `svc.applyAction(articleId, role, 'send')` 를 권한 `R`/`D`/`Z` 각각 적용한다
- **Then** `result.ok === true` 이고 `result.status === 'DPS'`, DB `Contents.status === 'DPS'` 로 유지된다(재송고·재배부). 순수 reducer `transition('DPS', role, 'send')` 도 `{ ok: true, status: 'DPS' }` 로 cross-check 된다.

### AC-DPS-LC-HOLD — DPS|R/D/Z|hold → DDH (2026-06-10 사용자 승인)

- **Given** `:memory:` SQLite + `createArticleService`, DPS 상태로 적재된 기사(`now` 고정)
- **When** `svc.applyAction(articleId, role, 'hold')` 를 권한 `R`/`D`/`Z` 각각 적용한다
- **Then** `result.ok === true` 이고 `result.status === 'DDH'`, DB `Contents.status === 'DDH'` 로 전이된다. 순수 reducer `transition('DPS', role, 'hold')` 도 `{ ok: true, status: 'DDH' }` 로 cross-check 된다.
- **And** DDH 로 전이된 기사를 작성 페이지에서 재로드하면 SPEC-008 의 DDH 버튼 매트릭스(D/Z 송고·KILL, 보류 비표시, R 전버튼 비표시)가 그대로 적용된다(AC-SUM-2/AC-SUM-3 와 정합).

### AC-DPS-LC-2 — DPS|*|kill 거부 + DB 무변경

- **Given** DPS 상태 기사
- **When** `svc.applyAction(articleId, role, 'kill')` 를 권한 `R`/`D`/`Z` 각각 적용한다
- **Then** `result.ok === false`(invalid-transition) 이고 DB `Contents.status === 'DPS'` 로 그대로 유지된다(DB 무변경 — KILL 은 DPS 컨텍스트에서 미지원).

### AC-DPS-LC-3 — 기존 13전이 불변

- **Given** TRANSITIONS 테이블
- **When** RDS 소스 6 전이 + Z-mirror 3 전이 + SPEC-008 DDH 출발 4 전이(현 코드 반영분)를 검사한다
- **Then** 본 SPEC 추가(DPS send 3 + DPS hold 3) 전후로 그 전이들의 결과상태가 동일하다(기존 행 불변). 기존 `lifecycleRule.test.js` MATRIX 전부 GREEN 유지.

---

## §4. REQ-SUMMARY-LINE-RECONCILE — 요약줄(델타 A) Δ-only 회귀 (프론트엔드, `web/src/view/WritePage.test.jsx`)

### AC-SUM-1 — RDS 매트릭스 불변

- **Given** 상태값 `RDS` 기사
- **When** 권한 R/D/Z 각각 렌더한다
- **Then** 송고/보류는 R/D/Z 모두 노출, KILL 은 R|Z + `!isDraft` 에서만 노출(D 는 KILL 비표시). 요약줄 변경 전 동작과 동일하다.

### AC-SUM-2 — DDH 매트릭스 불변

- **Given** 상태값 `DDH` 기사
- **When** 권한 D/Z 각각 렌더한다
- **Then** 송고·KILL 노출, 보류 비표시(SPEC-008 AC-BTN-1 회귀).

### AC-SUM-3 — DDH 에서 R 비노출

- **Given** 상태값 `DDH` 기사, 권한 `R`
- **When** 버튼 영역을 렌더한다
- **Then** 송고/보류/KILL 어느 버튼도 존재하지 않는다(요약줄을 곧이곧대로 적용하지 않음 — REQ-SUMMARY-LINE-RECONCILE Unwanted, SPEC-008 AC-BTN-2 회귀).

### AC-SUM-4 — RDS 에서 D 의 KILL 비노출

- **Given** 상태값 `RDS` 기사, 권한 `D`
- **When** 버튼 영역을 렌더한다
- **Then** "KILL" 버튼이 존재하지 않는다(구체줄 `KILL 버튼은 권한 R 그리고 RDS` 우선 — 요약줄의 "송고/보류/KILL ... R, D" 를 곧이곧대로 적용하지 않음).

---

## §5. REQ-REGRESSION-GUARD — 진입/락/전이/매핑 회귀 (프론트엔드 + 백엔드)

### AC-REG-1 — SPEC-007 회귀 (`ViewPage.contextMenu.test.jsx`, `useWriteController.editLoad.test.jsx`)

- **Given** 부서별 송고 진입점(편집/고침/포털고침) + ContentsVO 읽기전용 8필드
- **When** 진입/매핑을 수행한다
- **Then** SPEC-007 의 D-only 포워딩, 읽기전용 8필드 표시, 고침/포털고침 진입 무전이(AC-REV-1) 가 회귀 없이 유지된다.

### AC-REG-2 — SPEC-008 회귀 (`WritePage.test.jsx`, `useWriteController.lock.test.jsx`, `lifecycleRule.test.js`)

- **Given** 편집 잠금 탭 생존 유지 + DDH 전이/버튼 게이트
- **When** 편집 탭 생존/락 해제/DDH 전이를 수행한다
- **Then** SPEC-008 의 락 유지·DDH D/Z 송고·KILL·R 비노출이 회귀 없이 유지된다.

### AC-REG-3 — SPEC-002 락 계약 재사용 (`useWriteController.lock.test.jsx`)

- **Given** lockYN 락 계약(acquire/release/sendBeacon, 30분 stale, same-session 멱등, 타 세션 'locked' 거부)
- **When** 편집 진입/이탈/타 세션 충돌을 수행한다(`now` 고정)
- **Then** 기존 락 계약이 회귀 없이 유지되며, 본 SPEC 으로 새 락 규칙/스토어/세션/토큰이 도입되지 않는다.

---

## §6. 엣지 케이스 (Edge Cases)

- **DPS + lockError**: DPS 송고/보류 버튼도 `disabled={!!ctrl.lockError}` 로 잠금 중 비활성(기존 RDS 버튼과 동일 동작).
- **DPS + 본문 "(끝)" 없음**: 송고 차단(ALERT), 보류는 "(끝)" 없이도 진행되어 DDH 로 전이된다(2026-06-10 결정).
- **DPS + 제목 없음**: 송고/보류 제목 가드 ALERT(기존 가드 재사용).
- **상태값이 DPS 가 아님(RDS/DDH/RRH/RRK/DDK)**: DPS 분기 미발화, 기존 RDS/DDH 분기만 적용(매트릭스 불변).
- **R 가 DPS 작성 페이지에 도달**: 정상 진입경로(D-only 고침/포털고침) 로는 불가. 가정상 도달 시 버튼 가시성은 공허(REQ-DPS-ENTRY-GATE Ubiquitous) — 테스트는 진입 게이트 차단(AC-DPS-GATE-2)으로 검증.

---

## §7. 품질 게이트 (Quality Gate)

- [ ] `npm test` (백엔드, `test/*.test.js`) 전체 통과
- [ ] `npm run test:web` (프론트엔드, vitest) 전체 통과
- [ ] `npm run build` (vite build web) 무경고
- [ ] 락 관련 테스트 `now` 고정 전달
- [ ] 신규 디자인 토큰/CSS 변수/버튼 스타일 미도입
- [ ] 모드 플래그 미도입(상태값 게이트)
- [ ] 진입 게이트 D-only 불변
- [ ] DPS 보류 → DDH 전이(2026-06-10 결정) 구현 + 이후 DDH 매트릭스 정합
- [ ] TRUST 5(Tested/Readable/Unified/Secured/Trackable) 통과

---

## §8. Definition of Done (요약 — spec.md §12 참조)

- AC-DPS-BTN-1~4, AC-DPS-GATE-1~2, AC-DPS-LC-1/HOLD/2/3, AC-SUM-1~4, AC-REG-1~3 전부 GREEN
- 기존 SPEC(NEWS-REVISE-001~010, BACKEND-CORE-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음
- `news.md` 미변경 확인
- DPS 보류 결과상태 = DDH (2026-06-10 사용자 승인) 반영 완료
- Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.2.0
Status: Completed
Last Updated: 2026-06-10
