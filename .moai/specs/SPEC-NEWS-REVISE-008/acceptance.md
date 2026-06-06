---
id: SPEC-NEWS-REVISE-008
version: 0.1.0
status: Plan
created: 2026-06-06
updated: 2026-06-06
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-007
  - SPEC-BACKEND-CORE-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-NEWS-REVISE-008 — 인수 기준 (Acceptance Criteria)

편집 잠금이 편집 탭 생존 중 유지되고 4시점에 해제됨 + DDH(보류) 기사의 생애주기 전이 4행 + 작성 페이지 DDH 버튼 게이트를
Given-When-Then 으로 고정한다.

## HISTORY

- 2026-06-06 (v0.1.0): 최초 작성. 버그 ①(편집 잠금 조회 이동 시 해제) + 버그 ②(DDH 버튼 미표시·전이 부재) 진단을 흡수.

---

## 공통 전제 (Common Preconditions)

- 모든 시나리오는 로그인된 세션을 전제한다 (SPEC-AUTH-001).
- 검증 테스트 파일은 본 리포의 실제 레이아웃을 따른다:
  - 백엔드 테스트: `test/*.test.js`, 실행 `npm test` (node:test 러너).
  - 프론트 테스트: `web/src/**/*.test.{js,jsx}`, 실행 `npm run test:web` (vitest run --root web).
  - 빌드: `npm run build` (vite build web).
  - 허구 경로 금지: `npm test --prefix web`, `src/services/__tests__/` 는 이 리포에 없다.
- **[HARD] lock 관련 모든 테스트는 `now`(필요 시 `timeoutMs`)를 고정 전달한다.** 생략 시 30분 stale 판정이 날짜 경과 후 FAIL 하는 시한폭탄이 된다(이 리포 알려진 함정).
- 락 도메인 사실(SPEC-NEWS-REVISE-002, 검증됨): `acquireEditLock` 은 same-user+same-session 보유 시 lockedAt 갱신 + `{ok:true}` 멱등 재획득, same-user 다른 session 은 `{ok:false, reason:'locked'}` 거부, 30분 stale 자동 해제.
- lifecycle 도메인 사실(검증됨): TRANSITIONS = RDS 소스 6 전이 + Z-mirror 3 전이. DDH 는 source 로 미정의(추가 대상).
- 데스크 미송고 필터는 status `RDS,DDH` 둘 다 조회(컬럼 8종, LockYN 포함) → DDH 가 작성 페이지로 진입한다.

---

## §1. REQ-LOCK-RETENTION — 편집 잠금 탭 생존 유지

검증 파일: `web/src/controller/useWriteController.editLoad.test.jsx`(또는 신규 `web/src/controller/useWriteController.lockRetention.test.jsx`), `web/src/view/WriteWorkspace.test.jsx`, `test/articleService.test.js`

### AC-LOCK-1 — 편집 탭 생존 중 조회 페이지 이동만으로는 락이 해제되지 않는다

- **Given** 사용자가 RDS 기사를 편집 진입하여 락을 획득했고(lockYN='Y'), 그 기사의 편집 탭이 `newsroom.editorTabs` 에 존재한다.
- **When** 사용자가 조회 페이지(list.do)로 이동하여 작성 페이지 컨트롤러가 unmount 되지만, 편집 탭은 여전히 탭 목록에 남아있다.
- **Then** 그 기사에 대한 `releaseEditLock` 이 호출되지 않는다(락 유지). 다시 작성 페이지로 돌아오면 같은 `pageSessionId` 로 락이 멱등 재획득되어 거부 배너가 뜨지 않는다.

### AC-LOCK-2 — 락 해제 4시점이 모두 동작한다

- **Given** 사용자가 RDS 기사를 편집 진입하여 락을 보유한다.
- **When** (a) 편집 탭의 × 를 눌러 탭을 닫거나, (b) 송고/보류/KILL 이 성공하여 탭이 빈 '새 기사' 탭으로 전환되거나, (c) 로그아웃/세션 만료가 발생하거나, (d) 브라우저(탭)가 닫힌다.
- **Then** 각 경우 그 기사의 편집 락이 해제된다((d)는 기존 `beforeunload`/`visibilitychange:hidden` + `sendBeacon` release 경로).
- **And** 이 네 경우 외(단순 조회 페이지 이동/탭 전환)에는 락이 해제되지 않는다.

### AC-LOCK-3 — 같은 세션 재진입 시 같은 pageSessionId 락 재획득은 멱등 성공이다

- **Given** articleId='AKR20260606XYZ' 기사를 user='u1', sessionId='s1' 이 보유(lockYN='Y')한다. now 는 고정값으로 전달한다.
- **When** 같은 user='u1', 같은 sessionId='s1' 이 `acquireEditLock(articleId, { userId:'u1', sessionId:'s1', now })` 를 다시 호출한다(WRITE 라우트 재마운트로 acquire 재발사).
- **Then** 결과는 `{ ok: true }` 이며(거부 아님), lockedAt 이 전달한 now 로 갱신된다. 자기 자신을 'locked' 로 거부하지 않는다.
- **And** 같은 user='u1' 이지만 다른 sessionId='s2' 가 호출하면 `{ ok:false, reason:'locked' }` 로 거부된다(D2-5 strict 불변).

### AC-LOCK-4 — 송고/보류/KILL 성공은 그 기사의 락을 해제한다

- **Given** 사용자가 RDS 기사를 편집 진입하여 락을 보유하고, 편집 탭이 살아있다.
- **When** 송고(또는 보류, KILL)가 성공하여 편집 컨텍스트가 종료된다(editArticleId 가 null 로 바뀜, 탭이 빈 '새 기사' 탭으로 전환).
- **Then** 그 기사의 `releaseEditLock` 이 호출되어 락이 해제된다(다음 편집자가 진입 가능).
- **And** 락 해제가 누락되어 락이 영구히 남는 일이 없다(REQ-LOCK-RELEASE-EXPLICIT §2 와 정합).

---

## §2. REQ-LOCK-RELEASE-EXPLICIT — 성공·탭닫기 경로 명시적 해제 보장

검증 파일: `web/src/controller/useWriteController.editLoad.test.jsx`(또는 신규 `web/src/controller/useWriteController.lockRetention.test.jsx`), `web/src/view/WriteWorkspace.test.jsx`

### AC-REL-1 — 송고/보류/KILL 성공 경로에서 락 해제가 보장된다

- **Given** 편집 탭에서 락을 보유한 기사가 로드되어 있다(editArticleId 존재).
- **When** 송고/보류/KILL 이 성공하여 editArticleId 가 null 로 바뀐다.
- **Then** 그 기사의 `releaseEditLock(articleId, { sessionId })` 이 호출된다(unmount cleanup 의 조건부 발화이든 명시 호출이든, release 가 누락되지 않는다).

### AC-REL-2 — 편집 탭 닫기(×) 경로에서 락 해제가 보장된다

- **Given** 편집 탭(`newsroom.editorTabs` 에 존재)에서 락을 보유한 기사가 로드되어 있다.
- **When** 사용자가 그 탭의 × 버튼을 눌러 탭을 닫는다(탭 목록에서 제거).
- **Then** 그 기사의 `releaseEditLock(articleId, { sessionId })` 이 호출된다(명시 호출 또는 "탭 목록에 더 이상 없으면 release" 조건부 cleanup).

### AC-REL-3 — 조회 페이지 이동으로 인한 unmount cleanup 은 락을 해제하지 않는다

- **Given** 편집 탭이 탭 목록에 살아있는 상태에서 작성 페이지 컨트롤러가 조회 페이지 이동으로 unmount 된다.
- **When** 편집-락 effect 의 cleanup 이 발화한다.
- **Then** 탭이 아직 살아있으므로 그 기사의 `releaseEditLock` 이 호출되지 않는다(AC-LOCK-1 과 동일 동작의 cleanup 관점 단언).

---

## §3. REQ-DDH-LIFECYCLE — DDH 생애주기 전이 추가

검증 파일: `test/lifecycleRule.test.js`, `test/articleService.test.js`

### AC-DDH-1 — DDH 기사에 D/Z 권한 송고는 DPS 로 전이한다

- **Given** RDS 기사를 `applyAction(id, 'D', 'hold')`(또는 'Z','hold')로 DDH 로 만든다. now 는 고정값으로 전달한다.
- **When** `applyAction(id, 'D', 'send')`(그리고 별도 케이스로 'Z','send')를 호출한다.
- **Then** 결과는 `{ ok:true, status:'DPS' }` 이고, Contents.status 가 DPS 로 영속된다.
- **And** pure reducer `transition('DDH','D','send')` 와 `transition('DDH','Z','send')` 모두 `{ ok:true, status:'DPS' }` 를 반환한다.

### AC-DDH-2 — DDH 기사에 D/Z 권한 KILL 은 DDK 로 전이한다

- **Given** RDS 기사를 DDH 로 만든다(D 또는 Z 의 hold). now 고정.
- **When** `applyAction(id, 'D', 'kill')`(그리고 'Z','kill')를 호출한다.
- **Then** 결과는 `{ ok:true, status:'DDK' }` 이고 Contents.status 가 DDK 로 영속된다.
- **And** pure reducer `transition('DDH','D','kill')` 와 `transition('DDH','Z','kill')` 모두 `{ ok:true, status:'DDK' }` 를 반환한다.

### AC-DDH-3 — DDH|R|* 및 DDH|*|hold 는 거부되고 DB 가 그대로 유지된다

- **Given** DDH 상태 기사가 있다. now 고정.
- **When** `applyAction(id, 'R', 'send')`, `applyAction(id, 'R', 'hold')`, `applyAction(id, 'R', 'kill')`, `applyAction(id, 'D', 'hold')`, `applyAction(id, 'Z', 'hold')` 중 어느 것이든 호출한다.
- **Then** 모두 `{ ok:false, reason:'invalid-transition' }` 이고 Contents.status 가 DDH 로 유지된다.
- **And** pure reducer `transition('DDH','R','send')` / `transition('DDH','D','hold')` 등은 `{ ok:false }`(status 없음)를 반환한다.

### AC-DDH-4 — 기존 RDS 6 전이 + Z-mirror 3 전이가 불변이다

- **Given** 전이표 회귀 매트릭스(R/D/Z × send/hold/kill, source=RDS).
- **When** 각 (role, action) 으로 RDS 기사에 `applyAction` 을 적용한다.
- **Then** 결과 status 가 기존과 동일하다: R(send→RDS, hold→RRH, kill→RRK), D(send→DPS, hold→DDH, kill→DDK), Z(send→DPS, hold→DDH, kill→DDK).
- **And** DDH 4 전이 추가가 이 9 전이의 어떤 결과도 바꾸지 않는다(`test/lifecycleRule.test.js` 기존 매트릭스 GREEN 유지).

---

## §4. REQ-DDH-BUTTONS — DDH 버튼 게이트 확장

검증 파일: `web/src/view/WritePage.test.jsx`

### AC-BTN-1 — DDH 기사 편집 시 D/Z 권한에 송고·KILL 이 노출되고 보류는 비표시된다

- **Given** 작성 페이지가 편집 컨텍스트로 status='DDH' 기사를 로드했고(따라서 `!isDraft`), 사용자 권한이 `D`(별도 케이스 `Z`)이다.
- **When** 작성 페이지가 렌더된다.
- **Then** 송고 버튼과 KILL 버튼이 노출된다.
- **And** 보류 버튼은 노출되지 않는다(이미 보류 상태이므로).

### AC-BTN-2 — DDH 기사 편집 시 R 권한에는 송고/보류/KILL 세 버튼이 모두 비표시된다

- **Given** 작성 페이지가 status='DDH' 기사를 로드했고, 사용자 권한이 `R` 이다.
- **When** 작성 페이지가 렌더된다.
- **Then** 송고/보류/KILL 어느 버튼도 노출되지 않는다.

### AC-BTN-3 — DDH 송고에도 (끝) 마커/제목/확인창 가드가 동일하게 적용된다

- **Given** status='DDH' 기사를 D/Z 권한으로 편집하고 있다.
- **When** 송고 버튼을 누른다.
- **Then** 본문 끝 "(끝)" 마커 가드, 제목 가드, `window.confirm('송고하시겠습니까?')` 확인창이 RDS 송고와 동일하게 선행되며, 확인했을 때만 전이가 진행된다(취소 시 미발생).

### AC-BTN-4 — 기존 RDS 버튼 매트릭스는 회귀 없이 유지된다

- **Given** 작성 페이지가 status='RDS' 기사(또는 신규 초안)를 로드했다.
- **When** 각 권한으로 작성 페이지가 렌더된다.
- **Then** 송고/보류는 R|D|Z 에 노출(RDS), KILL 은 R|Z 에 노출(RDS + `!isDraft`)되며, status 가 RDS 가 아닌(예: 신규 초안의 `isDraft`) 기존 조건이 그대로 유지된다.
- **And** DDH 분기 추가가 RDS 게이트의 어떤 노출 조건도 바꾸지 않는다.

---

## §5. REQ-REGRESSION-GUARD — 락/전이/버튼 회귀 가드

검증 파일: `web/src/controller/useWriteController.editLoad.test.jsx`, `web/src/view/WritePage.test.jsx`, `test/lifecycleRule.test.js`, `test/articleService.test.js`

### AC-REG-1 — SPEC-NEWS-REVISE-002 락 계약이 그대로 재사용된다

- **Given** 작성 페이지가 편집 컨텍스트로 마운트된다.
- **When** 편집 진입/이탈/탭 닫힘이 발생한다.
- **Then** `acquireEditLock` 마운트 시 호출, 30분 stale 자동 해제, 타 세션 'locked' 거부 + lock-banner(`role="alert"` `aria-live="assertive"`) + ALERT 1회, `sendBeacon` 해제, same-session 멱등 재획득이 모두 기존 동작과 동일하다(본 SPEC 은 새 락 규칙을 도입하지 않는다).

### AC-REG-2 — SSE 재조회와 데스크 미송고 필터가 회귀 없이 유지된다

- **Given** SSE `type:'lock'` 이벤트가 발생하고 데스크 미송고 메뉴가 표시된다.
- **When** 락 변화로 인한 SSE 재조회가 일어나고 목록이 갱신된다.
- **Then** SSE 재조회 동작이 기존과 동일하고, 데스크 미송고 필터가 status `RDS,DDH` 둘 다 조회하며 컬럼 8종(LockYN 포함)이 그대로 표시된다.

### AC-REG-3 — SPEC-NEWS-REVISE-007 동작이 회귀 없이 유지된다

- **Given** 부서별 송고 진입점과 작성 페이지 읽기전용 8필드 표시가 동작 중이다.
- **When** 편집/고침/포털고침 진입 및 편집 로드가 일어난다.
- **Then** 부서별 송고 `편집`/고침/포털고침 포워딩, ContentsVO 읽기전용 8필드 표시(`data-testid="readonly-meta"`), 편집 5필드 매핑이 모두 SPEC-NEWS-REVISE-007 의 AC 와 동일하게 유지된다.

---

## §6. 품질 게이트 / Definition of Done

- [ ] `npm test` 백엔드 테스트 전체 통과
- [ ] `npm run test:web` 프론트 테스트 전체 통과
- [ ] `npm run build` 무경고
- [ ] AC-LOCK-1~4, AC-REL-1~3, AC-DDH-1~4, AC-BTN-1~4, AC-REG-1~3 모두 GREEN
- [ ] lock 관련 테스트는 now 고정 전달(30분 stale 시한폭탄 방지)
- [ ] 기존 디자인 토큰(`--yh-blue` `#0A4DA6`, `--yh-gray-line` `#DDE3EC` 등)만 사용, 신규 토큰/버튼 스타일 미도입
- [ ] SPEC-NEWS-REVISE-001/002/003/007 / SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001 / SPEC-AUTH-001 AC 회귀 없음
- [ ] `news.md` 미변경 확인(구현 완료 후 오케스트레이터가 별도 반영)
- [ ] DB 내용 삭제 없음(CLAUDE.md HARD 규칙)
- [ ] Slack `tech-day` 채널 작업 완료 보고(CLAUDE.md HARD 규칙)

---

## 엣지 케이스 (Edge Cases)

| ID | 케이스 | 기대 동작 | 검증 AC |
|----|--------|-----------|---------|
| EC-1 | 편집 탭이 살아있는 상태에서 30분 stale 타임아웃 경과 | 서버 stale 안전망으로 다른 세션이 acquire 가능; 본인 재진입 시 same-session 멱등 재획득(lockedAt 갱신) | AC-LOCK-3, AC-REG-1 |
| EC-2 | 같은 기사를 같은 세션에서 두 번 열려는 시도 | WriteWorkspace 가 중복 탭을 만들지 않고 기존 탭 활성화(자기충돌 방지) → 락 자기충돌 없음 | AC-LOCK-1, AC-LOCK-3 |
| EC-3 | DDH 기사에 신규 초안 플래그(`isDraft`)가 거짓인지 | DDH 는 항상 편집 로드된 기존 기사라 `!isDraft` 자동 충족 → KILL 게이트 통과 | AC-BTN-1 |
| EC-4 | DDH 기사에 보류 재시도(`DDH|D|hold`) | invalid-transition 거부, status DDH 유지(이미 보류) | AC-DDH-3 |
| EC-5 | DDH 기사에 R 권한 송고 시도(`DDH|R|send`) | invalid-transition 거부 + R 은 버튼 자체가 비표시(이중 방어) | AC-DDH-3, AC-BTN-2 |
| EC-6 | 비정상 종료(브라우저 크래시)로 4시점 해제가 모두 누락 | 30분 stale 타임아웃이 자동 해제(안전망, 본 SPEC 신규 규칙 없음) | AC-REG-1 |
| EC-7 | 로그아웃 시 여러 편집 탭이 열려 있음 | 그 세션이 보유한 모든 편집 탭의 락이 해제됨 | AC-LOCK-2 |

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-06
