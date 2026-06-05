---
id: SPEC-NEWS-REVISE-006
version: 0.1.1
status: completed
created: 2026-06-05
updated: 2026-06-05
author: manager-spec
priority: medium
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-004
  - SPEC-NEWS-REVISE-005
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-002
---

# SPEC-NEWS-REVISE-006 — 두 평가의 비차단 권고 5건 흡수 — 가드 단언 보강 + 송고 엣지 Named AC 격상 + 동결 예외 명문화

## HISTORY

- 2026-06-05 (v0.1.1): 구현 완료 — 상태 Plan → completed. 3 REQ 충족: REQ-GUARD-ASSERT-HARDEN(AC-LOCKV-4 `SELECT *` 단언 교체 + AC-GRAY-3 주석 명확화 + AC-LOCK-4 어휘 정리), REQ-SEND-EDGE-LOCK(AC-EDGE-EMPTY-BODY / AC-EDGE-TITLE-FIRST Named AC 신설), REQ-DOC-FREEZE-EXCEPTION(본 spec.md §명문화 — v0.1.0 에 기수록). production 코드 0 변경(Δ-only 준수). 게이트: 백엔드 183/183 PASS, 웹 294/294 PASS, vite build 무경고. (sync)
- 2026-06-05 (v0.1.0): 최초 작성. 두 평가의 *비차단(non-blocking) 권고 5건* 을 흡수하는 Brownfield Δ-only SPEC (004 의 production 코드 변경 0 선례 계승 — 테스트/주석/문서만). 3 REQ 로 한정:
  - REQ-GUARD-ASSERT-HARDEN (출처 A 권고 1+2+3): (1) AC-LOCKV-4 항진식 단언 보강 — `SELECT lockerUserId, lockerSessionId, lockedAt` 3컬럼 SELECT 라 `lockerPageId` 부재가 항상 PASS(방어력 0) → `SELECT *` 행의 `Object.keys(row)` 기준 정본 3컬럼 존재 + `lockerPageId` 부재 단언으로 교체(방어력 회복). (2) AC-GRAY-3 범위 명확화 — AC-GRAY-1 과 구조 검증 중복 → 역할을 "정밀화 이후 최소 회귀 확인" 으로 *주석* 명확화(PD1 기본값; 삭제·통합 거부). (3) AC-LOCK-4 주석 어휘 정리(forward-fix) — `lockerPageId(=sessionId)` 혼용 → `lockerSessionId(페이지 단위 식별자)` 단일 표기. 코드/단언 무변경.
  - REQ-SEND-EDGE-LOCK (출처 B 권고 4+5): (4) EC-3 Named AC 격상 — 빈 본문(빈 문자열) 송고 → `(끝)` ALERT 차단 전용 `it` 신설(`hasEndMarker('')===false` 로 구현 이미 정상; 테스트 잠금만). (5) EC-4 Named AC 격상 — 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동(`actionError`, `(끝)` alert 미호출) 전용 `it` 신설.
  - REQ-DOC-FREEZE-EXCEPTION (출처 B 추가): 005 acceptance.md AC-ALIGN-4 "단언 동결" 규정과 본문 입력 변경의 파생 기대값 강화(예: 본문 강조 기대값 `'하세요'`→`'하세요(끝)'`)의 충돌을 본 SPEC spec.md 에서 forward-fix 로 명문화 — "본문 입력 변경의 파생 기대값 변경(강화)은 동결 예외" 원칙을 정본화. 005 문서 자체는 수정하지 않는다(004 PD4 선례).
  출처 A: SPEC-NEWS-REVISE-004 evaluator GAN 라운드 1 PASS(0.838, 커밋 5fb4551). 출처 B: SPEC-NEWS-REVISE-005 verify Independent Re-evaluation 0.90/0.77 PASS(calibration Δ0.13). (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-006 |
| 제목 | 두 평가의 비차단 권고 5건 흡수 — 가드 단언 보강 + 송고 엣지 Named AC 격상 + 동결 예외 명문화 |
| 상태 | completed |
| 생성일 | 2026-06-05 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-004, SPEC-NEWS-REVISE-005, SPEC-NEWS-REVISE-003, SPEC-NEWS-REVISE-002 |
| 영향 페이지 | 없음 (production UI/CSS/DB 무변경) |
| 영향 백엔드 | 없음 (production 코드 무변경; `src/db/schema.js` 락 컬럼 정본을 *읽기 전용*으로 단언) |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only, production 코드 변경 0) |
| 인코딩 | UTF-8 (BOM 없음) |

---

## 1. 목적 (Goal)

SPEC-NEWS-REVISE-004(evaluator GAN 라운드 1 PASS 0.838) 와 SPEC-NEWS-REVISE-005(verify Independent Re-evaluation 0.90/0.77 PASS, calibration Δ0.13) 는 각각 *비차단 권고* 를 남겼다. 본 SPEC-006 은 이 5건(+ 문서 1건)을 EARS 명세 가드 + 테스트 가능한 Given-When-Then AC 로 흡수한다.

`why`:

- **출처 A 권고 1 (AC-LOCKV-4 항진식 단언 보강)**: `test/editLockBehavior.test.js` 의 AC-LOCKV-4(라인 213-231)는 `SELECT lockerUserId, lockerSessionId, lockedAt FROM Contents ...` 결과 행의 `Object.keys` 에서 `lockerPageId` 부재를 단언한다. 그러나 SELECT 목록에 애초에 `lockerPageId` 가 *없으므로*, DB 에 `lockerPageId` 컬럼이 실제 추가돼도 이 조회 행에는 나타나지 않아 단언이 *항상 PASS* 한다(방어력 0 = 항진식). 개선: `SELECT * FROM Contents WHERE articleId = ?` 행의 `Object.keys(row)` 에 대해 정본 3컬럼(`lockerUserId`/`lockerSessionId`/`lockedAt`) 존재 + `lockerPageId` 부재를 단언하도록 교체한다 — 전체 컬럼 집합 기준이므로 컬럼이 실제 추가되면 FAIL 하여 방어력을 회복한다. (실질 컬럼 가드는 `test/schema.test.js` 의 AC-LOCKV-1 `PRAGMA table_info` 가드가 이미 담당하며, 본 건은 AC-LOCKV-4 *자체* 의 방어력 회복이다.)
- **출처 A 권고 2 (AC-GRAY-3 범위 명확화)**: `web/src/view/articleDetail.test.js` 의 AC-GRAY-3(라인 387-411)이 AC-GRAY-1 과 구조 검증(제목/본문 섹션 각 1개 형제 + 12 dt label)을 동일하게 반복한다. 개선: AC-GRAY-3 의 역할을 "(AC-GRAY-1 의 정확 토큰 정밀화 *이후*) 분리 구조 단언이 회귀하지 않았음을 확인하는 최소 회귀 가드" 로 *주석* 명확화한다. 테스트 삭제/통합은 회귀 가드 감소 우려로 거부하며, PD1 기본값을 '주석 명확화만' 으로 둔다.
- **출처 A 권고 3 (AC-LOCK-4 주석 어휘 정리, forward-fix)**: `test/editLockBehavior.test.js` L82/L94 의 주석이 `lockerPageId(=sessionId)` / `lockerPageId(=lockerSessionId)` 혼용 표기를 유지한다. 개선: 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리한다(코드/단언 무변경, 주석만). 004 정본 어휘(`lockerUserId`/`lockerSessionId`/`lockedAt`) 와 정합한다.
- **출처 B 권고 4 (EC-3 Named AC 격상)**: 005 acceptance.md §EC-3(라인 108)은 "빈 본문/`undefined` 송고 → 가드 차단(ALERT)" 을 *edge-case 불릿* 으로만 둔다. 구현(`useWriteController.js` L252-255, `hasEndMarker('')===false`)은 이미 정상이나 전용 테스트가 없다. 개선: `web/src/controller/useWriteController.test.jsx` 에 빈 본문 송고 차단 전용 `it` 케이스를 신설하여 동작을 잠근다.
- **출처 B 권고 5 (EC-4 Named AC 격상)**: 005 §EC-4(라인 109)는 "제목 비고 본문 `(끝)` 있음 → 제목 가드 우선" 을 edge-case 불릿으로만 둔다. AC-SEND-GUARD-3 은 *제목 있음 + 본문 `(끝)` 있음* 정상 송고를, AC-SEND-GUARD-5 는 *제목 비고 + 본문 `(끝)` 없음* 을 커버한다. 개선: **제목 비고 + 본문 `(끝)` 있음** → 제목 가드만 발동(`actionError='제목이 없어 송고/보류할 수 없습니다.'`, `(끝)` alert 미호출, saveArticle/applyAction 미호출) 전용 케이스를 신설한다. 가드 순서(제목 → `(끝)`)가 *본문에 마커가 있어도* 성립함을 잠근다.
- **출처 B 추가 (동결 예외 명문화)**: 005 acceptance.md AC-ALIGN-4(라인 78)는 "검증 의도 보존(단언 동결)" 을 규정한다. 한편 본문 입력 변경에 따른 *파생 기대값 강화*(예: 본문 강조 기대 문자열 `'하세요'`→`'하세요(끝)'`)는 입력이 결정론적으로 바뀜에 따라 따라오는 변경이라 동결과 표면적으로 충돌한다. 개선: 본 SPEC spec.md 에서 forward-fix 로 "본문 입력 변경의 *파생 기대값 변경(강화)* 은 동결 예외" 원칙을 정본화한다. 005 문서 자체는 수정하지 않는다(004 PD4 선례).

본 SPEC 의 Plan 단계는 코드를 작성하지 않았다(문서만; v0.1.1 에서 Run 완료로 상태 전환). Run 단계에서도 production 코드 변경은 0 을 기본값으로 하며, 테스트 파일의 *단언 보강 / Named AC 격상 / 주석 정리* 와 본 SPEC spec.md 의 *문서 명문화* 만 수행한다 (004 의 Δ-only precedent 계승).

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- 출처 A 권고 1 — `test/editLockBehavior.test.js` AC-LOCKV-4 의 항진식 단언을 `SELECT *` 행의 `Object.keys` 기준 단언으로 보강(방어력 회복)
- 출처 A 권고 2 — `web/src/view/articleDetail.test.js` AC-GRAY-3 의 역할을 "정밀화 이후 최소 회귀 확인" 으로 *주석* 명확화 (PD1 기본값; 단언 불변)
- 출처 A 권고 3 — `test/editLockBehavior.test.js` L82/L94 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (코드/단언 무변경)
- 출처 B 권고 4 — `web/src/controller/useWriteController.test.jsx` 에 빈 본문 송고 차단 전용 `it` 신설 (EC-3 Named AC 격상)
- 출처 B 권고 5 — 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동 전용 `it` 신설 (EC-4 Named AC 격상)
- 출처 B 추가 — 본 SPEC spec.md 에 "본문 입력 변경의 파생 기대값 변경(강화)은 동결 예외" 원칙 명문화 (forward-fix)
- SPEC-NEWS-REVISE-003 의 30 AC + 004 의 7 AC + 005 의 전체 AC 회귀 가드 (전부 GREEN 유지)
- production 코드 무변경 회귀 가드 (`git diff --stat` 으로 비-테스트 파일 변경 0 단언)

### 2.2 제외 (Out of Scope)

- 코드 구현 (본 SPEC 은 Plan 단계 문서만)
- production 코드(`web/src/controller/useWriteController.js`, `web/src/view/articleDetail.js`, `web/src/model/editorContent.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 변경
- DB 컬럼 추가/이름변경 — 특히 `lockerPageId` 컬럼 도입은 명시적 거부 (004 PD1 계승)
- AC-GRAY-3 테스트 *삭제/통합* (PD1 기본값: 주석 명확화만 — 회귀 가드 감소 우려로 거부)
- 송고 `(끝)` 가드 / 제목 가드 / Alt+Y 동작의 *동작* 변경 (005/002 그대로; 본 SPEC 은 Named AC 격상만)
- SPEC-NEWS-REVISE-001/002/003/004/005 의 `spec.md` / `plan.md` / `acceptance.md` 수정
- 새 디자인 토큰 정의 또는 CSS 변수 추가
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 제작 시스템만")
- 새 `.claude/agents` 또는 `.claude/skills` 정의

---

## 3. 사용자 시나리오 (User Scenarios)

> 본 SPEC 은 사용자 가시 동작을 변경하지 않는다. 아래 시나리오는 *회귀 가드/명세 정합* 관점의 개발자 시나리오다.

### 3.1 락 컬럼 회귀 검출 — 항진식 제거 (출처 A 권고 1)

- 개발자가 실수로 `Contents` 테이블에 `lockerPageId` 컬럼을 추가한다.
- 004 의 AC-LOCKV-4(3컬럼 SELECT 기준 부재 단언) 라면 이 변경을 *통과시켜* 회귀를 놓친다(항진식).
- 본 SPEC 의 보강 가드(`SELECT *` 행의 `Object.keys` 기준) 는 전체 컬럼 집합에 `lockerPageId` 가 나타나므로 즉시 FAIL 하여 의도하지 않은 컬럼 추가를 회귀로 검출한다.

### 3.2 빈 본문/제목-우선 송고 엣지 잠금 (출처 B 권고 4+5)

- 개발자가 송고 가드 로직을 리팩토링하다 빈 본문 케이스 또는 제목 가드 우선순위를 깨뜨린다.
- 005 의 edge-case 불릿(EC-3/EC-4)만 있었다면 전용 테스트가 없어 회귀가 잡히지 않는다.
- 본 SPEC 의 Named AC(`it` 케이스) 는 빈 본문 송고 차단(ALERT)과 제목 가드 우선(`actionError`, `(끝)` alert 미호출)을 잠가 회귀를 검출한다.

### 3.3 동결 예외 충돌 해소 (출처 B 추가)

- 개발자가 본문 강조 테스트에서 입력 본문을 `'...하세요'` → `'...하세요(끝)'` 로 바꾸고 기대 문자열도 따라 강화한다.
- 005 AC-ALIGN-4(단언 동결) 만 보면 이 변경이 동결 위반처럼 보인다.
- 본 SPEC spec.md 의 "파생 기대값 강화는 동결 예외" 원칙이 이 충돌을 해소한다 — 라우팅 분기/송고 DTO/생애주기 전이 단언은 여전히 동결, 입력 변경에 결정론적으로 따라오는 기대 문자열만 예외.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-GUARD-ASSERT-HARDEN — 가드 단언 보강 + 주석 정밀화 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN AC-LOCKV-4 가드가 락 보유자 컬럼 집합을 검사하면, THE 가드 SHALL `SELECT * FROM Contents WHERE articleId = ?` 행의 `Object.keys(row)` 에 대해 정본 3컬럼(`lockerUserId`/`lockerSessionId`/`lockedAt`) 존재 + `lockerPageId` 부재를 단언한다 (3컬럼 SELECT 항진식 제거 → 방어력 회복).
- **[Ubiquitous]** THE 가드 SHALL `web/src/view/articleDetail.test.js` AC-GRAY-3 의 역할을 "(AC-GRAY-1 정밀화 *이후*) 분리 구조 회귀가 없음을 확인하는 최소 회귀 가드" 로 인접 *주석* 에 명시한다 (PD1 기본값: 주석만; 단언/구조 검증 불변).
- **[Ubiquitous]** THE 문서/테스트 SHALL `test/editLockBehavior.test.js` 의 AC-LOCK-4 인접 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리한다 (`lockerPageId(=...)` 혼용 표기 제거; 코드/단언 무변경, 004 정본 어휘 정합).
- **[Unwanted]** IF AC-GRAY-3 의 단언/구조 검증을 *삭제하거나 통합* 하려는 시도가 있으면, THEN THE 시스템 SHALL 이를 거부한다 — PD1 기본값은 주석 명확화만이며, 삭제·통합은 회귀 가드 감소 우려로 채택하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT production 코드(`src/db/schema.js`, `src/services/articleService.js`, `web/src/view/articleDetail.js`, `server/` 등 비-테스트 파일) 를 변경한다.
- **[Unwanted]** THE 시스템 SHALL NOT DB 컬럼을 추가/이름변경한다 — 특히 `lockerPageId` 컬럼 도입은 거부한다 (004 PD1 계승; 본 가드는 그 부재를 잠근다).

#### Acceptance Criteria 포인터

- AC-HARDEN-1 (AC-LOCKV-4 `SELECT *` + `Object.keys` 보강), AC-HARDEN-2 (AC-GRAY-3 주석 명확화 + 단언 불변), AC-HARDEN-3 (AC-LOCK-4 주석 `lockerSessionId` 단일 표기) — acceptance.md §1

---

### REQ-SEND-EDGE-LOCK — 송고 엣지 Named AC 격상 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 송고(`action === 'send'`) 가 요청되고 본문이 *빈 문자열* 이면(`hasEndMarker('') === false`), THE 테스트 SHALL 전용 `it` 케이스로 `window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.')` 1회 표시 + `model.saveArticle`/`model.applyAction` 미호출(call count 0) 을 단언한다 (EC-3 Named AC 격상).
- **[Complex]** WHILE 제목이 비어 있고 본문이 `(끝)` 마커로 끝나는 상태에서, WHEN 송고가 요청되면, THE 테스트 SHALL 전용 `it` 케이스로 제목 가드만 발동(`actionError === '제목이 없어 송고/보류할 수 없습니다.'`) + `(끝)` alert 미호출(call count 0) + saveArticle/applyAction 미호출 을 단언한다 (EC-4 Named AC 격상; 가드 순서 제목 → `(끝)` 이 본문 마커 유무와 무관히 성립).
- **[Ubiquitous]** THE 테스트 스위트 SHALL 신규 EC-3/EC-4 `it` 케이스 추가 후에도 005 의 AC-SEND-GUARD-1~6 단언이 회귀 없이 GREEN 임을 유지한다.
- **[Unwanted]** IF 신규 케이스가 005 의 기존 단언(라우팅 분기/송고 DTO/제목 가드 우선/보류·KILL 비차단)의 *기대값이나 호출 카운트를 약화* 시키려 하면, THEN THE 시스템 SHALL 이를 거부한다 — 신규 케이스는 본문/제목 입력만 시나리오별로 구성하고 기존 단언은 동결한다.
- **[Unwanted]** THE 시스템 SHALL NOT `web/src/controller/useWriteController.js` 의 가드 동작(제목 가드 → `(끝)` 가드 순서) 또는 `web/src/model/editorContent.js` 의 `END_MARKER`/`hasEndMarker` 정본을 변경한다 (Named AC 격상만; 동작 불변).

#### Acceptance Criteria 포인터

- AC-EDGE-EMPTY-BODY (EC-3 격상), AC-EDGE-TITLE-FIRST (EC-4 격상), AC-EDGE-GUARD-ORDER (005 AC-SEND-GUARD-1~6 무회귀) — acceptance.md §2

---

### REQ-DOC-FREEZE-EXCEPTION — 동결 예외 명문화 (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 문서(본 SPEC spec.md) SHALL "본문 입력 변경의 *파생 기대값 변경(강화)* 은 동결 예외" 원칙을 명문화한다 — 입력 본문이 결정론적으로 바뀜에 따라 따라오는 기대 문자열(예: 본문 강조 기대값 `'하세요'`→`'하세요(끝)'`)의 변경은 005 AC-ALIGN-4 동결의 예외로 간주한다.
- **[Where]** WHERE 단언이 라우팅 분기 / 송고 DTO / 기사 생애주기 전이 / 권한 검증을 검사하는 경우, THE 원칙 SHALL 동결을 유지한다 — 이들은 입력 본문과 무관하므로 예외에 해당하지 않는다.
- **[Unwanted]** IF 동결 예외 명문화를 위해 SPEC-NEWS-REVISE-005(또는 001~004)의 문서를 수정하려는 시도가 있으면, THEN THE 시스템 SHALL 이를 거부한다 — 명문화는 본 SPEC spec.md 에서만 수행하며(forward-fix), 005 문서는 무수정한다 (004 PD4 선례).
- **[Unwanted]** THE 시스템 SHALL NOT 동결 예외를 이용해 라우팅/DTO/생애주기/권한 단언의 기대값을 변경한다 (예외 범위를 입력 파생 기대값으로 한정).

#### Acceptance Criteria 포인터

- AC-FREEZE-EXC-1 (spec.md 에 동결 예외 원칙 문장 존재 — 정적 grep), AC-FREEZE-EXC-2 (001~005 SPEC 문서 무수정 — `git diff --stat`) — acceptance.md §3

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 인코딩

- 모든 문서/테스트 파일은 UTF-8 BOM 없음 (CLAUDE.md HARD 규칙).
- 본 SPEC 의 3 파일(spec.md / plan.md / acceptance.md) 도 UTF-8 BOM 없음, 3종 version 일치 (버전 정합 게이트 통과; 현행 v0.1.1 — 구현 완료 동기화).

### 5.2 디자인 토큰

- 본 SPEC 은 새 CSS 변수를 도입하지 않으며, 기존 토큰 값을 변경하지 않는다. `--yh-gray-line: #DDE3EC` (articleDetail.js) 값은 불변. AC-GRAY-3 은 주석만 명확화하며 토큰/구조 단언은 불변.

### 5.3 보안

- 본 SPEC 은 보안 표면을 추가/변경하지 않는다. 003 의 AC-MEDIA-4(API 키 비노출), AC-LOCK-6(락 우회 차단), AC-LIFE-4(직접 SQL 우회 차단) 회귀 가드를 침범하지 않는다.

### 5.4 동시성

- REQ-GUARD-ASSERT-HARDEN: 1 인 1 페이지 정책(002 D2-5=A)의 동시성 동작은 003/004 에서 이미 GREEN 이며 본 SPEC 은 *단언 보강/주석 정리* 만 한다 — 동시성 동작 자체는 불변.

### 5.5 동결 예외 원칙 (Frozen-Assertion Exception)

- **정본 원칙**: 005 AC-ALIGN-4 "단언 동결" 은 *검증 의도* (라우팅 분기, 송고 DTO 단언, 기사 생애주기 전이 단언, 권한 검증)를 보존하기 위한 것이다. 그러나 *본문 입력 변경* 에 따라 결정론적으로 따라오는 *파생 기대값 강화* (예: 본문 강조 기대 문자열 `'하세요'`→`'하세요(끝)'`)는 동결의 예외다. 입력이 바뀌면 그 입력에 대한 기대 출력 문자열이 바뀌는 것은 검증 의도의 약화가 아니라 *입력 정합* 이기 때문이다.
- **적용 경계**: 예외는 *입력 본문에 결정론적으로 종속된 기대 문자열* 에만 적용된다. 호출 카운트, 라우팅 분기 선택, DTO 필드 집합, 생애주기 상태 전이, 권한 결과는 입력 본문과 무관하므로 *동결 유지* 한다.
- **005 문서 무수정**: 본 원칙은 본 SPEC spec.md 에서만 forward-fix 로 정본화하며, SPEC-NEWS-REVISE-005 의 `spec.md`/`plan.md`/`acceptance.md` 는 수정하지 않는다 (004 PD4 선례 — 후속 SPEC 의 spec.md 가 정본 어휘/원칙을 forward-fix 로 명문화).

### 5.6 회귀 방지

- SPEC-NEWS-REVISE-003 의 30 AC + 004 의 7 AC(AC-GRAY-1~3 + AC-LOCKV-1~4) + 005 의 전체 AC(AC-SEND-GUARD-1~6 + AC-ALIGN-1~4) 전부 GREEN 유지.
- production 코드(`web/`, `src/`, `server/` 의 비-테스트 파일) 변경 0 (`git diff --stat` 검증).
- 001~005 SPEC 문서(`*.md`) 변경 0 (`git diff --stat` 검증).

---

## 6. 현재 진행 상태 (Current Progress — 권고 분석)

> 분석 시점: 2026-06-05. 출처 A: SPEC-NEWS-REVISE-004 evaluator GAN 라운드 1 PASS(0.838, 커밋 5fb4551). 출처 B: SPEC-NEWS-REVISE-005 verify Independent Re-evaluation 0.90/0.77 PASS(calibration Δ0.13). 라이브 리포 측정 병행.

| 권고 | 영향 파일 (정본 측정) | 현재 상태 | 한 줄 요약 |
|------|---------------------|---------|-----------|
| A-1 — AC-LOCKV-4 항진식 | `test/editLockBehavior.test.js:213-231` (`SELECT lockerUserId, lockerSessionId, lockedAt`) | **항진식(방어력 0)** | 3컬럼 SELECT 라 `lockerPageId` 부재가 항상 PASS. `SELECT *` + `Object.keys` 로 보강 |
| A-2 — AC-GRAY-3 범위 | `web/src/view/articleDetail.test.js:387-411` | **AC-GRAY-1 과 구조 검증 중복** | 역할을 "정밀화 이후 최소 회귀 확인" 으로 주석 명확화 (PD1 기본값) |
| A-3 — AC-LOCK-4 주석 | `test/editLockBehavior.test.js:82, 94` | **`lockerPageId(=sessionId)` 혼용** | `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (주석만) |
| B-4 — EC-3 | `useWriteController.js:252-255` (`hasEndMarker('')===false`); 005 acceptance.md:108 | **edge bullet (전용 테스트 부재)** | 빈 본문 송고 차단 전용 `it` 신설 |
| B-5 — EC-4 | `useWriteController.js:243-247`→`252-255`; 005 acceptance.md:109 | **edge bullet (전용 테스트 부재)** | 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동 전용 `it` 신설 |
| B-추가 — 동결 예외 | 005 acceptance.md:78 (AC-ALIGN-4) | **충돌 미명문화** | "파생 기대값 강화는 동결 예외" 원칙을 본 SPEC spec.md 에 정본화 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규/수정될 영역 (단언 보강 + Named AC + 주석/문서; 테스트·문서만)

- `test/editLockBehavior.test.js` — AC-LOCKV-4 단언을 `SELECT *` + `Object.keys` 로 보강 (AC-HARDEN-1); L82/L94 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (AC-HARDEN-3). 기존 AC-LOCK-1~6 / AC-LOCKV-1~3 동작 단언은 회귀 없음.
- `web/src/view/articleDetail.test.js` — AC-GRAY-3 역할을 주석으로 명확화 (AC-HARDEN-2). 단언/구조 검증 불변.
- `web/src/controller/useWriteController.test.jsx` — 빈 본문 송고 차단(EC-3) + 제목 비고 본문 `(끝)` 있음 제목 가드 우선(EC-4) 전용 `it` 2건 신설 (AC-EDGE-EMPTY-BODY, AC-EDGE-TITLE-FIRST). 기존 AC-SEND-GUARD 단언은 회귀 없음.
- 본 SPEC `spec.md` — §5.5 동결 예외 원칙 명문화 (AC-FREEZE-EXC-1).

### 7.2 본 SPEC 이 절대 수정하지 않는 파일 [HARD]

- `.moai/specs/SPEC-NEWS-REVISE-001/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-002/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-003/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-004/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-005/*.md` (3 파일)
- 모든 production 코드 (`web/src/controller/useWriteController.js`, `web/src/view/articleDetail.js`, `web/src/model/editorContent.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`, 그 외 비-테스트 파일)

---

## 8. 테스트 전략 (TDD)

### 8.1 백엔드 가드 (node --experimental-sqlite --test, `npm test`)

- `test/editLockBehavior.test.js` AC-LOCKV-4:
  - `SELECT * FROM Contents WHERE articleId = ?` 행의 `Object.keys(row)` 에서 정본 3컬럼 존재 + `lockerPageId` 부재 단언 (AC-HARDEN-1).
  - AC-LOCK-4 인접 주석(L82/L94)을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (AC-HARDEN-3; 단언 불변).

### 8.2 프론트엔드 가드 (vitest, `npm run test:web`)

- `web/src/view/articleDetail.test.js` AC-GRAY-3:
  - 역할 주석 명확화 (AC-HARDEN-2; PD1 기본값, 단언/구조 검증 불변).
- `web/src/controller/useWriteController.test.jsx`:
  - 빈 본문(빈 문자열) 송고 → `(끝)` ALERT 1회 + saveArticle/applyAction 미호출 전용 `it` (AC-EDGE-EMPTY-BODY).
  - 제목 비고 + 본문 `(끝)` 있음 → `actionError` 설정 + `(끝)` alert 미호출 + saveArticle/applyAction 미호출 전용 `it` (AC-EDGE-TITLE-FIRST).
  - 신규 케이스 추가 후 005 AC-SEND-GUARD-1~6 회귀 없음 (AC-EDGE-GUARD-ORDER).

### 8.3 문서 가드

- 본 SPEC `spec.md` 에 "동결 예외" 원칙 문장 존재 — 정적 grep `grep -n "동결 예외" .moai/specs/SPEC-NEWS-REVISE-006/spec.md` (AC-FREEZE-EXC-1).
- 001~005 SPEC 문서 무수정 — `git diff --stat` (AC-FREEZE-EXC-2).

### 8.4 회귀 가드

- `npm test` (백엔드 전체) 통과.
- `npm run test:web` (프론트 전체) 통과.
- `npm run build` (vite build web) 무경고.
- 003 30 AC + 004 7 AC + 005 전체 AC 회귀 없음 (acceptance.md §4 회귀 매트릭스).
- production 코드 변경 0 + 001~005 SPEC 문서 변경 0 — `git diff --stat` 으로 확인.

---

## 9. 위험과 완화 (Risks & Mitigation — Pending Decision 포함)

| ID | 위험 | 영향 | 완화 / 결정 필요 |
|----|------|------|----------------|
| **PD1** | AC-GRAY-3 처리: (i) 주석 명확화만 vs (ii) AC-GRAY-3 삭제·AC-GRAY-1 통합 | (ii) 는 회귀 가드 개수를 줄여 정밀화 이후 분리 구조 회귀 검출력을 약화시킨다 | **본 SPEC 기본값: (i) 주석 명확화만 채택. (ii) 삭제·통합은 거부** (REQ-GUARD-ASSERT-HARDEN Unwanted 단언). 사용자가 (ii) 를 원하면 별도 판단 — 본 SPEC 기본값은 회귀 가드 보존 |
| R1 | AC-LOCKV-4 `SELECT *` 보강이 컬럼 순서/추가에 민감 | `Object.keys` 순서 의존 시 brittle | `includes` 기반 집합 단언으로 작성 → 순서 무관. 정본 3컬럼 존재 + `lockerPageId` 부재만 검사 |
| R2 | EC-4 신규 케이스가 `(끝)` alert 호출 카운트를 오단언 | 가드 순서 오해 시 FAIL | 구현 정본(`useWriteController.js` L243-255): 제목 가드 먼저 `return` → `(끝)` 가드 미도달. alert call count 0 단언 |
| R3 | 동결 예외 명문화가 005 문서를 건드림 | 004 PD4 선례 위반 | AC-FREEZE-EXC-2 가 `git diff --stat` 으로 001~005 SPEC 문서 변경 0 단언. 명문화는 본 SPEC spec.md 에서만 |
| R4 | `--prefix web` 등 비존재 명령 사용 | 검증 실패 | web/package.json 부재 — `npm test` / `npm run test:web` / `npm run build` 만 사용 |

> PD1 은 Run 단계 진입 전 사용자 결정 후 잠금. 미결 시 본 SPEC 기본값((i) 주석 명확화만)을 임시 적용한다.

---

## 10. 종속성 및 Cross-References (회귀 가드 명시)

- **SPEC-NEWS-REVISE-004 REQ-LOCK-VOCAB-ALIGN / AC-LOCKV-4** — 본 SPEC REQ-GUARD-ASSERT-HARDEN 이 AC-LOCKV-4 의 항진식을 `SELECT *` + `Object.keys` 로 보강(방어력 회복). AC-LOCKV-1~3 동작 단언은 회귀 없이 유지.
- **SPEC-NEWS-REVISE-004 REQ-GUARD-GRAYLINE-EXACT / AC-GRAY-3** — 본 SPEC 이 AC-GRAY-3 역할을 주석 명확화. AC-GRAY-1~2 + 구조 단언 회귀 없음 (PD1 기본값).
- **SPEC-NEWS-REVISE-003 REQ-ARTICLE-LOCK-YN / AC-LOCK-4** — 본 SPEC 이 AC-LOCK-4 인접 주석을 `lockerSessionId` 단일 표기로 정리. 락 획득/해제/충돌/TTL 동작 단언은 회귀 없이 유지.
- **SPEC-NEWS-REVISE-005 REQ-SEND-END-MARKER-GUARD / AC-SEND-GUARD-1~6** — 본 SPEC REQ-SEND-EDGE-LOCK 가 EC-3/EC-4 를 Named AC 로 격상. 송고 `(끝)` 가드 / 제목 우선 / 보류·KILL 비차단 동작은 회귀 없이 유지.
- **SPEC-NEWS-REVISE-005 REQ-SEND-TESTS-ALIGN / AC-ALIGN-4** — 본 SPEC §5.5 가 "단언 동결" 의 *입력 파생 기대값 강화 예외* 를 forward-fix 로 명문화. 005 문서 무수정.
- **SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN / D2-5=A** — `lockYN`/`lockerUserId`/`lockerSessionId`/`lockedAt` 컬럼 정의와 strict 정책을 정본으로 단언. 컬럼 추가/이름변경 없음 (`lockerPageId` 부재 잠금).

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 기능 *구현* (본 SPEC 은 Plan 단계 문서만; Run 단계는 테스트 단언 보강 / Named AC 격상 / 주석·문서 정리만).
- production 코드(`web/src/controller/useWriteController.js`, `web/src/view/articleDetail.js`, `web/src/model/editorContent.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 변경.
- DB 컬럼 추가/이름변경 — 특히 `lockerPageId` 컬럼 도입은 명시적 거부 (004 PD1 계승).
- AC-GRAY-3 테스트 *삭제/통합* (PD1 기본값: 주석 명확화만 — 회귀 가드 감소 우려로 거부).
- 송고 `(끝)` 가드 / 제목 가드 / Alt+Y 동작의 *동작* 변경 (005/002 그대로; Named AC 격상만).
- SPEC-NEWS-REVISE-001/002/003/004/005 의 `spec.md` / `plan.md` / `acceptance.md` 수정.
- 새 디자인 토큰 정의 또는 CSS 변수 추가.
- 동결 예외를 이용한 라우팅/DTO/생애주기/권한 단언 기대값 변경 (예외 범위를 입력 파생 기대값으로 한정).
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 제작 시스템만").
- 새 `.claude/agents` 또는 `.claude/skills` 정의.
- AskUserQuestion 호출 (subagent boundary).

---

## 12. Definition of Done

- [ ] 3 파일 생성 + UTF-8 BOM 없음 (`spec.md`, `plan.md`, `acceptance.md`), 3종 version 0.1.0 일치
- [ ] 3 REQ 각각 EARS 문장 보유 (REQ-GUARD-ASSERT-HARDEN: Event-Driven + Ubiquitous×2 + Unwanted×3; REQ-SEND-EDGE-LOCK: Event-Driven + Complex + Ubiquitous + Unwanted×2; REQ-DOC-FREEZE-EXCEPTION: Ubiquitous + Where + Unwanted×2)
- [ ] [Unwanted] 절을 모든 REQ 가 포함
- [ ] Risks 섹션에 PD1 명시 (AC-GRAY-3 주석 명확화 vs 삭제·통합 → 기본값 주석 명확화만)
- [ ] Cross-References 에 SPEC-NEWS-REVISE-004 / 005 / 003 / 002 회귀 가드 명시
- [ ] Exclusions 절이 코드 구현 / DB 컬럼 추가 / 001~005 spec 수정 / 새 agents·skills 정의를 명시적으로 비목표화
- [ ] DoD 체크리스트가 spec.md 말미에 존재 (본 절)
- [ ] §5.5 에 동결 예외 원칙(`동결 예외` 토큰) 명문화 — AC-FREEZE-EXC-1 정적 grep 대상
- [ ] acceptance.md 의 AC 총 개수가 REQ당 최소 2개 이상 보장 (총 8개; AC-HARDEN-1~3 + AC-EDGE-EMPTY-BODY/TITLE-FIRST/GUARD-ORDER + AC-FREEZE-EXC-1~2)
- [ ] acceptance.md 의 모든 [검증 명령] 이 실제 명령(`npm test` / `npm run test:web` / `npm run build` / `git diff --stat`) 만 사용 (`--prefix web` 금지)
- [ ] acceptance.md 에 003 30 AC + 004 7 AC + 005 전체 GREEN 유지 + production 무변경(`git diff --stat`) 회귀 매트릭스 포함
- [ ] plan.md 의 마일스톤이 time estimates 없이 priority-based (CLAUDE.md HARD)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001~005 의 `spec.md`/`plan.md`/`acceptance.md` 를 수정하지 않음
- [ ] 본 SPEC 은 production 코드 (비-테스트 파일) 를 수정하지 않음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙) — Run 단계 진입/종료 시점에 수행

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-05
