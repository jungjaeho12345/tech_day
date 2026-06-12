---
id: SPEC-NEWS-REVISE-015
version: 0.1.0
status: Plan
created: 2026-06-12
updated: 2026-06-12
author: manager-spec
priority: medium
issue_number: 0
---

# SPEC-NEWS-REVISE-015 — 구현 계획 (Implementation Plan)

## HISTORY

- 2026-06-12 (v0.1.0): 최초 작성. 근거 커밋 **a8a6c87**(2026-06-11). news.md 추가분의 **명세 흡수 + 기구현
  characterization 고정 + 잔여(테스트) 갭 신규화** 에 대한 구현 접근·마일스톤·리스크 정의. maintenance.md 전수
  대장과 도메인 SSOT(`moai-domain-news-editor/SKILL.md`)로 교차 검증한 결과, 추가분은 대부분 코드로 이미
  구현되어 있어 **운영 코드 변경 없음** 이 본 계획의 대전제다. (manager-spec)

---

## 1. 기술 접근 (Technical Approach)

### 1.1 핵심 결정 — 운영 코드 0줄 변경, 테스트만 추가

a8a6c87 은 "이미 코드로 구현되어 있으나 news.md 에 명세가 없던 항목"을 news.md 로 역반영(reverse-sync)한
**문서 커밋**이다. 따라서 본 SPEC 의 Run 단계는 다음 두 가지만 한다:

1. **[기구현/회귀가드]** 흡수 항목 각각에 대해 **이미 존재하는 테스트가 GREEN 유지됨**을 확인한다. 신규 코드도
   신규 테스트도 만들지 않는다(이미 회귀 가드가 깔려 있는 항목).
2. **[테스트 공백/신설]** 코드 구현은 있으나 **독립 회귀 가드 테스트가 없는** 3개 항목에 대해서만 **테스트 파일을
   신규 작성**한다. 운영 코드(`web/`·`src/`·`server/`)는 변경하지 않는다.

이 결정의 근거는 maintenance.md 전수 대장이다 — news.md 추가분의 모든 주장이 maintenance.md 의 file:line 으로
뒷받침되며, "명세-코드 모순"(L132-135)으로 분류된 두 항목(디자인 레드↔블루, writer.do 오타)은 a8a6c87 이
news.md 를 코드 쪽으로 정정해 **충돌이 이미 해소**되었다.

### 1.2 [테스트 공백/신설] 대상 3종 (Run 단계 신규 작성)

| AC | 신규 테스트(권장 경로) | 검증 대상 | 코드 근거 |
|----|----------------------|-----------|-----------|
| AC-DSN-2 | `web/src/view/ViewPage.statusBadge.test.jsx` | 상태 배지 색 매핑(RDS=회색/DPS=레드/보류=앰버/KILL=슬레이트) | yonhap.css, ViewPage 배지 렌더 |
| AC-UI-1 | `web/src/view/TopBar.test.jsx` | 사용자 정보 '유저아이디 · 부서 · (권한)' 형식 | `web/src/view/TopBar.jsx:23-27` |
| AC-VW-2 | `web/src/model/httpModel.reconnect.test.js`(또는 기존 httpModel 테스트 확장) | EventSource 사용·open/error 핸들러 배선·연결 상태 추적(재연결 자체는 브라우저 위임) | `web/src/model/httpModel.js:258-270` |

- 세 테스트는 모두 **렌더/배선 단언**만 한다. 운영 코드를 건드리지 않으므로 테스트가 RED 면 그것은 "테스트가
  현 동작을 잘못 기술"한 것이고, 동작에 맞게 테스트를 고친다(코드 변경 금지).
- AC-VW-2 는 EventSource 의 자동 재연결이 브라우저 위임임을 테스트 주석에 명시한다 — 재연결 루프를 우리가
  구현하지 않으므로 "재연결됨"을 직접 단언하지 않고, EventSource 채택·error 핸들러 존재만 가드한다.

### 1.3 [기구현/회귀가드] 항목 — 확인만 (코드·테스트 모두 존재)

아래 항목은 maintenance.md 근거 + 기존 테스트가 이미 있어 **GREEN 유지 확인**만 한다(작업 = 테스트 실행).

- 생애주기: `test/lifecycleDps.test.js`, `test/lifecycleRule.test.js`, `test/lifecycle.test.js`,
  `test/lifecycleBypass.test.js` (AC-LC-1~3)
- 잠금/세션/인증: `test/editLockBehavior.test.js`, `test/forceUnlock.test.js`,
  `test/integration.lockLifecycle.test.js`, `test/sessionService.test.js`, `test/userService.test.js`,
  `test/userSoftDelete.test.js`, `test/authControllers.test.js`, `test/authorization.test.js` (AC-SES/LK/LG/SEC)
- SP/미디어/스키마/모델: `test/articleId.test.js`, `test/mediaSearch*.test.js`, `test/schema.test.js`,
  `test/articleModel*.test.js`, `test/articleService.test.js`, `test/serverRoutes.test.js`,
  `test/serverAuthWiring.test.js` (AC-SP/CMN-1/DB/API)
- 조회/작성/에디터/상세/세션(프론트): `web/src/view/ViewPage*.test.jsx`,
  `web/src/view/WriteWorkspace.test.jsx`, `web/src/view/WritePage*.test.jsx`,
  `web/src/controller/useWriteController*.test.jsx`, `web/src/model/editorContent.test.js`,
  `web/src/view/editorShortcuts.test.js`, `web/src/view/editorColoring.test.js`,
  `web/src/view/articleDetail.test.js`, `web/src/view/columnConfig.test.js`,
  `web/src/app/App.session.test.jsx`, `web/src/app/routing.test.js` (AC-VW/CMN-2~4/ED/DT/RT/SES-3/LG-3)

### 1.4 메모리 정합 — DPS lifecycle gap 해소 기록

`src/services/lifecycle.js:24-29` 를 직접 Read 한 결과, DPS-출발 전이(송고→DPS, 보류→DDH; KILL 미정의=거부)가
코드로 구현되어 있고 news.md a8a6c87 이 이를 명세화했다. 즉 종전 메모리에 블로커로 기록된 "DPS 보류 결과상태
미결"은 **DDH 로 확정**되었다. 본 SPEC 은 이 사실을 AC-LC-2 에 흡수 기록한다(생애주기 전이의 소유 SPEC 은
NEWS-REVISE-011 이며, 본 SPEC 은 명세 정합 회귀 가드만 담당).

---

## 2. 마일스톤 (Milestones — 우선순위 기반, 시간 추정 없음)

### M1 (Priority High) — 기구현 항목 회귀 가드 확인 (코드 변경 없음)
- `npm test` + `npm run test:web` 전체 실행 → §1.3 의 기존 테스트가 모두 GREEN 임을 확인.
- 흡수 매핑표(spec.md §5 REQ 분류)와 실제 GREEN 결과를 대조해 news.md 추가분이 코드와 정합함을 확인.
- 충족 AC: AC-DSN-1, AC-RT-1/2, AC-CMN-1~4, AC-VW-1/3~7, AC-DT-1~3, AC-SES-1~3, AC-LK-1/2, AC-LG-1~3,
  AC-WR-1, AC-SP-1, AC-ED-1~3, AC-API-1, AC-LC-1~3, AC-DB-1~3, AC-SEC-1/2.

### M2 (Priority Medium) — 테스트 공백 3종 신설 (운영 코드 무변경)
- AC-DSN-2: `ViewPage.statusBadge.test.jsx` — 6 상태 배지 색 매핑 단언.
- AC-UI-1: `TopBar.test.jsx` — '유저아이디 · 부서 · (권한)' 렌더 단언.
- AC-VW-2: `httpModel.reconnect.test.js` — EventSource 채택 + open/error 핸들러 + 상태 추적 단언(재연결 위임
  한계 주석).
- 세 테스트는 현 동작에 맞춰 작성 — RED 가 나면 테스트를 동작에 맞게 고친다(코드 수정 금지).

### M3 (Priority Low) — 품질 게이트 + 보고
- `npm test` + `npm run test:web` + `npm run build` GREEN/무경고, `npm run lint` 무경고, 커버리지 확인.
- TRUST 5 게이트, 3파일 frontmatter 정합(0.1.0/Plan), news.md 미변경 + 기존 SPEC 본문 미수정 확인.
- Slack `tech-day` 보고.

---

## 3. 개발 방법론

- `.moai/config/sections/quality.yaml` `development_mode` 를 따른다. 본 작업은 **신규 운영 코드가 없는 흡수 +
  회귀 가드 테스트 추가**이므로, 신설 3종은 **TDD 의 특수형(characterization-first)**: 현 동작을 기술하는 테스트를
  먼저 쓰고 GREEN 임을 확인한다(테스트가 RED 면 동작에 맞게 테스트를 고친다 — 코드 변경 금지).
- 시간 의존 테스트(articleId, lock stale)는 now/시각을 명시 주입한다(시한폭탄 회피 — 미주입 시 익일부터 30분
  stale·날짜 경계로 비결정 FAIL).

---

## 4. 리스크 및 완화 (Risks & Mitigation)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 흡수를 구현으로 오해해 운영 코드를 손댐 | a8a6c87 는 문서 커밋 — 코드 변경 시 scope 위반·회귀 | spec.md §9 Exclusions [HARD] "운영 코드 0줄". Run 은 테스트 파일만 생성/수정 |
| 신설 테스트가 동작과 불일치(RED) | 거짓 실패로 작업 중단 | 신설은 characterization-first — 현 동작에 맞게 테스트를 고친다(코드 불변) |
| SSE 자동 재연결을 직접 단언하려다 실패 | EventSource 위임은 단위 테스트 불가 | AC-VW-2 는 채택·핸들러·상태 추적만 단언, 재연결 위임 한계를 주석화 |
| 라인 인용(L##) drift | 도메인 스킬·maintenance.md 라인 번호 노후화 | 본 SPEC 은 file 근거를 우선하고 라인은 보조 — Read 로 검증한 lifecycle.js 만 라인 확정 인용 |
| DPS 보류 결과상태를 임의 확정 | 메모리상 미결 항목 오확정 | lifecycle.js:24-29 + SPEC-011 코드 근거로 DDH 확정 — 흡수 기록만, 신규 결정 아님 |
| 시간 의존 테스트 비결정 | 익일부터 FAIL(시한폭탄) | articleId/lock 테스트는 now/시각 명시 주입 |
| 게이트 버전 불일치 차단 | PreToolUse 버전 동기화 게이트 실패 | 3파일 모두 v0.1.0/Plan, 작성 순서 acceptance→plan→spec |

---

## 5. 검증 명령 (실제 레이아웃 기준)

- 백엔드: `npm test` (= `node --experimental-sqlite --test --experimental-test-coverage test/*.test.js`)
- 프론트: `npm run test:web` (= `vitest run --root web`)
- 빌드: `npm run build` (= `vite build web`)
- 린트: `npm run lint` (ESLint 9 flat config)
- ※ `src/services/__tests__/`·`npm test --prefix web` 같은 경로는 이 리포에 존재하지 않는다(쓰지 말 것).

---

## 6. Exclusions (계획 범위 밖)

spec.md §9 Exclusions 를 그대로 따른다. 특히: 운영 코드(`web/`·`src/`·`server/`) 변경(테스트 파일 외), news.md
수정(a8a6c87 에서 반영 완료), 기존 SPEC-NEWS-REVISE-001~014 본문 수정, DB 스키마/내용 변경·삭제, 생애주기/잠금/
세션/보안 등 도메인 동작의 신규 발명(흡수·회귀 가드만), 수집/배부 시스템.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-12
