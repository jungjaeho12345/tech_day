---
id: SPEC-NEWS-REVISE-006
artifact: acceptance
version: 0.1.0
created: 2026-06-05
updated: 2026-06-05
---

# Acceptance — SPEC-NEWS-REVISE-006

본 파일은 `spec.md` §4 의 EARS 요구사항(3 REQ) 에 대한 **테스트 가능한 Given-When-Then 시나리오** 와 **Definition of Done** 을 정리한다. 프론트엔드는 Vitest(`npm run test:web`, vitest run --root web), 백엔드는 node test runner(`npm test`, node --experimental-sqlite --test, glob `test/*.test.js`) 로 자동화한다. 본 SPEC 의 AC 는 SPEC-NEWS-REVISE-003/004/005 의 기존 AC 를 *대체하지 않고 보강* 한다(단언 정밀화 + Named AC 격상 + 문서 명문화).

각 AC 항목 옆에 `[검증 명령]` + `[통과 기준]` + `[매핑]` 을 표기한다. 모든 [검증 명령] 은 리포 정본 스크립트(`npm test` / `npm run test:web` / `npm run build` / `git diff --stat`) 만 사용하며 `--prefix web` 등 비존재 명령을 사용하지 않는다. evaluator-active 가 별도 해석 없이 PASS/FAIL 산출 가능하도록 작성.

---

## 1. REQ-GUARD-ASSERT-HARDEN — 시나리오 (출처 A 권고 1+2+3)

### Scenario AC-HARDEN-1: AC-LOCKV-4 항진식 단언 보강 — `SELECT *` 행의 `Object.keys` 가드

- **Given** `test/editLockBehavior.test.js` 의 AC-LOCKV-4 가 현재 `SELECT lockerUserId, lockerSessionId, lockedAt FROM Contents ...` 로 3컬럼만 조회하고 그 결과 keys 에서 `lockerPageId` 부재를 단언 — SELECT 목록에 애초에 `lockerPageId` 가 없으므로 컬럼이 실제 추가돼도 항상 PASS(방어력 0)
- **When** 본 SPEC 이 해당 단언을 `SELECT * FROM Contents WHERE articleId = ?` 결과 행의 `Object.keys(row)` 에 대한 단언으로 교체
- **Then** `Object.keys(row)` 가 `lockerUserId` / `lockerSessionId` / `lockedAt` 정본 3컬럼을 모두 포함 (존재 단언)
- **And** `Object.keys(row).includes('lockerPageId') === false` — 전체 컬럼 집합에 대해 `lockerPageId` 부재를 단언하므로, `lockerPageId` 컬럼이 실제 추가되면 이 단언이 FAIL 하여 방어력을 회복
- **And** 실질 컬럼 가드(`PRAGMA table_info('Contents')` 기반 AC-LOCKV-1, `test/schema.test.js`) 는 그대로 유지 — 본 건은 AC-LOCKV-4 *자체* 의 방어력 회복이며 AC-LOCKV-1 을 대체하지 않음
- `[검증 명령]` `npm test`
- `[통과 기준]` `SELECT *` 행의 `Object.keys` 에서 정본 3컬럼 존재 + `lockerPageId` 부재 단언 GREEN
- `[매핑]` REQ-GUARD-ASSERT-HARDEN / 출처 A 권고 1

### Scenario AC-HARDEN-2: AC-GRAY-3 범위 명확화 — "정밀화 이후 최소 회귀 확인" 주석 (PD1 기본값)

- **Given** `web/src/view/articleDetail.test.js` 의 AC-GRAY-3 이 AC-GRAY-1 과 구조 검증(제목/본문 섹션 각 1개 형제 + 12 dt label)을 동일하게 반복하여 역할이 중복으로 보이는 상태
- **When** 본 SPEC 이 AC-GRAY-3 의 역할을 "(AC-GRAY-1 의 정확 토큰 정밀화 *이후*) 분리 구조 단언이 회귀하지 않았음을 확인하는 최소 회귀 가드" 로 *주석* 명확화 (PD1 기본값: 주석 명확화만; 테스트 삭제/통합은 채택하지 않음)
- **Then** AC-GRAY-3 의 단언 코드(제목/본문 형제 + 12 dt label)는 *변경되지 않고* 인접 주석만 역할을 명시 — 회귀 가드 개수 감소 없음
- **And** AC-GRAY-1 / AC-GRAY-2 / AC-GRAY-3 이 모두 회귀 없이 GREEN
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` AC-GRAY-3 단언 불변 + 주석 역할 명확화 + AC-GRAY-1~3 GREEN
- `[매핑]` REQ-GUARD-ASSERT-HARDEN / 출처 A 권고 2 (PD1 기본값)

### Scenario AC-HARDEN-3: AC-LOCK-4 주석 어휘 정리 (forward-fix) — `lockerSessionId` 단일 표기

- **Given** `test/editLockBehavior.test.js` 의 AC-LOCK-4 인접 주석(파일 L82 부근, L94)이 `lockerPageId(=sessionId)` / `lockerPageId(=lockerSessionId)` 혼용 표기를 유지하는 상태
- **When** 본 SPEC 이 해당 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (코드/단언 무변경, 주석만)
- **Then** AC-LOCK-4 의 단언 코드(`acquireEditLock` 결과 / `lockerUserId` / `lockerSessionId` 값 단언)는 변경되지 않음
- **And** 락 보유자 어휘가 SPEC-NEWS-REVISE-004 정본(`lockerUserId` / `lockerSessionId` / `lockedAt`) 과 정합하며 `lockerPageId` 어휘 표기가 주석에서 제거됨
- **And** 003 AC-LOCK-1~6 의 동작 단언이 회귀 없이 GREEN
- `[검증 명령]` `npm test`
- `[통과 기준]` AC-LOCK-4 주석 단일 표기(`lockerSessionId`) + 단언 불변 + 003 AC-LOCK-1~6 회귀 없음 GREEN
- `[매핑]` REQ-GUARD-ASSERT-HARDEN / 출처 A 권고 3 (주석만 정리)

---

## 2. REQ-SEND-EDGE-LOCK — 시나리오 (출처 B 권고 4+5)

### Scenario AC-EDGE-EMPTY-BODY: EC-3 Named AC 격상 — 빈 본문 송고 → `(끝)` 가드 차단(ALERT)

- **Given** 로그인 상태에서 제목이 채워지고 본문이 *빈 문자열* 인 기사 작성 상태 (`hasEndMarker('') === false` — 구현은 이미 정상; 본 AC 는 동작을 *잠그는* 테스트만 신설)
- **When** 송고(`action === 'send'`) 를 시도한다 (`web/src/controller/useWriteController.test.jsx` 전용 `it` 케이스)
- **Then** `window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.')` 가 정확히 1회 표시되고, `model.saveArticle` / `model.applyAction` 에 진입하지 않는다(call count 0)
- **And** 빈 본문 케이스가 005 acceptance.md §EC-3 의 edge-case 불릿에서 전용 Named AC(`it`) 로 격상되어 회귀 가드로 잠긴다
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` 빈 본문 송고 시 `(끝)` ALERT 1회 + saveArticle/applyAction 미호출 GREEN
- `[매핑]` REQ-SEND-EDGE-LOCK / 출처 B 권고 4 (EC-3 Named AC 격상)

### Scenario AC-EDGE-TITLE-FIRST: EC-4 Named AC 격상 — 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동

- **Given** 로그인 상태에서 제목이 *비어 있고* 본문은 `(끝)` 마커로 끝나는 기사 작성 상태 (가드 순서: 제목 → `(끝)`; 구현은 `useWriteController.js` L243-247 제목 가드 → L252-255 `(끝)` 가드)
- **When** 송고(`action === 'send'`) 를 시도한다 (`web/src/controller/useWriteController.test.jsx` 전용 `it` 케이스)
- **Then** 제목 가드만 발동 — `actionError === '제목이 없어 송고/보류할 수 없습니다.'` 가 설정되고 `(끝)` ALERT(`window.alert`) 는 호출되지 않는다(alert call count 0)
- **And** `model.saveArticle` / `model.applyAction` 에 진입하지 않는다(call count 0)
- **And** 본 케이스는 AC-SEND-GUARD-5(제목 비고 + 본문 `(끝)` *없음*) 와 구별되는 EC-4(제목 비고 + 본문 `(끝)` *있음*) 시나리오로, "제목 가드가 `(끝)` 가드보다 우선" 임을 *본문에 마커가 있어도* 성립함을 잠근다
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` 제목 `actionError` 발동 + `(끝)` alert 미호출 + saveArticle/applyAction 미호출 GREEN
- `[매핑]` REQ-SEND-EDGE-LOCK / 출처 B 권고 5 (EC-4 Named AC 격상)

### Scenario AC-EDGE-GUARD-ORDER: 가드 순서 회귀 — 005 AC-SEND-GUARD-1~6 무회귀

- **Given** AC-EDGE-EMPTY-BODY / AC-EDGE-TITLE-FIRST 신규 `it` 케이스가 추가된 상태
- **When** `web/src/controller/useWriteController.test.jsx` 전체와 `web/src/view/WritePage.test.jsx` 전체를 실행
- **Then** 005 의 AC-SEND-GUARD-1~6 (송고 `(끝)` 가드 + 제목 우선 + 보류/KILL 비차단) 단언이 회귀 없이 GREEN
- **And** 신규 케이스가 기존 단언의 기대값/호출 카운트를 약화시키지 않음 (본문 입력만 시나리오별로 구성, 단언 동결)
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` 005 AC-SEND-GUARD-1~6 + 신규 EC-3/EC-4 케이스 모두 GREEN
- `[매핑]` REQ-SEND-EDGE-LOCK / 출처 B (가드 순서 회귀 가드)

---

## 3. REQ-DOC-FREEZE-EXCEPTION — 시나리오 (출처 B 추가 — 동결 예외 명문화)

### Scenario AC-FREEZE-EXC-1: 동결 예외 원칙 정본화 (본 SPEC spec.md forward-fix)

- **Given** SPEC-NEWS-REVISE-005 acceptance.md AC-ALIGN-4 가 "검증 의도 보존(단언 동결)" 을 규정하는 한편, 본문 입력 변경에 따른 파생 기대값 강화(예: 본문 강조 기대값 `'하세요'` → `'하세요(끝)'`)가 동결과 표면적으로 충돌하는 상태
- **When** 본 SPEC 의 `spec.md` 가 forward-fix 로 "본문 입력 변경의 *파생 기대값 변경(강화)* 은 동결 예외" 원칙을 명문화 (라우팅 분기 / 송고 DTO / 생애주기 전이 단언은 동결 유지; 입력 본문 자체 변경에 따라 결정론적으로 따라오는 기대 문자열만 예외)
- **Then** 본 SPEC `spec.md` 본문에 동결 예외 원칙 문장이 존재 (정적 grep: `동결 예외` 토큰 + "파생 기대값" 문구)
- **And** 본 원칙이 005 의 AC-ALIGN-4 동결 규정과 AC-EMB-INLINE-1 류 기대값 강화의 충돌을 해소하는 정본으로 기능
- `[검증 명령]` `grep -n "동결 예외" .moai/specs/SPEC-NEWS-REVISE-006/spec.md`
- `[통과 기준]` spec.md 에 동결 예외 원칙 문장 존재 (1건 이상)
- `[매핑]` REQ-DOC-FREEZE-EXCEPTION / 출처 B 추가 (forward-fix 정본화)

### Scenario AC-FREEZE-EXC-2: 005 문서 무수정 (004 PD4 선례)

- **Given** 본 SPEC 의 동결 예외 명문화가 *본 SPEC spec.md 에서만* 이뤄짐
- **When** `git diff --stat` 및 정적 검사로 SPEC-NEWS-REVISE-005 문서를 점검
- **Then** `.moai/specs/SPEC-NEWS-REVISE-005/spec.md` / `plan.md` / `acceptance.md` 가 변경 목록에 *없음* (005 문서 무수정 — 004 PD4 선례 계승)
- **And** SPEC-NEWS-REVISE-001~004 의 문서도 변경 목록에 없음
- `[검증 명령]` `git diff --stat`
- `[통과 기준]` 001~005 SPEC 문서(`*.md`) 변경 0 건
- `[매핑]` REQ-DOC-FREEZE-EXCEPTION / 출처 B 추가 (004 PD4 선례)

---

## 4. 회귀 가드 매트릭스 (003 30 AC + 004 7 AC + 005 전체 + production 무변경)

본 SPEC 의 Run 단계 종료 시 다음 매트릭스가 모두 GREEN 이어야 한다.

### 4.1 기존 SPEC AC GREEN 유지

| 출처 SPEC | AC 그룹 | 본 SPEC 의 보호 | 검증 명령 |
|----------|--------|---------------|---------|
| 003 | AC-MEDIA / AC-EMPH-1~3 / AC-WLC / AC-EMB-DEL / AC-ALTY / AC-LIFE / AC-INT (30 AC 전체) | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm test` + `npm run test:web` |
| 003 | AC-EMPH-4 (gray-line + 분리 구조) | AC-HARDEN-2 가 주석만 명확화, 단언 회귀 없음 | `npm run test:web` |
| 003 | AC-LOCK-1~6 (락 동작) | AC-HARDEN-3 가 주석만 정리, 동작 단언 회귀 없음 | `npm test` |
| 004 | AC-GRAY-1~3 (gray-line 정밀화) | AC-HARDEN-2 가 AC-GRAY-3 주석 명확화, 단언 회귀 없음 | `npm run test:web` |
| 004 | AC-LOCKV-1~4 (락 어휘 정합) | AC-HARDEN-1 이 AC-LOCKV-4 단언 보강, AC-LOCKV-1~3 회귀 없음 | `npm test` |
| 005 | AC-SEND-GUARD-1~6 / AC-ALIGN-1~4 (`(끝)` 가드 + 테스트 정합) | AC-EDGE-GUARD-ORDER 가 회귀 가드, EC-3/EC-4 Named AC 격상 | `npm run test:web` |
| **합계** | **003: 30 + 004: 7 + 005: 전체** | 모두 GREEN 유지 | `npm test` + `npm run test:web` |

### 4.2 production 코드 무변경 단언

- **Given** 본 SPEC 의 모든 변경이 적용된 working tree
- **When** `git diff --stat` 실행
- **Then** 변경 목록에 비-테스트 production 파일(`web/src/controller/useWriteController.js`, `web/src/view/articleDetail.js`, `web/src/model/editorContent.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/` 등) 이 *없음*
- **And** 변경 목록은 테스트 파일(`test/editLockBehavior.test.js`, `web/src/view/articleDetail.test.js`, `web/src/controller/useWriteController.test.jsx`) + 본 SPEC 문서(`.moai/specs/SPEC-NEWS-REVISE-006/*`) 로만 구성
- `[검증 명령]` `git diff --stat`
- `[통과 기준]` 비-테스트 production 파일 변경 0 건 (004 의 production-zero precedent 계승)
- `[매핑]` 전 REQ / production 무변경 회귀 가드

### 4.3 빌드 무경고

- **Given** 본 SPEC 의 모든 변경이 적용된 상태
- **When** `npm run build` (vite build web) 실행
- **Then** 빌드가 무경고로 성공
- `[검증 명령]` `npm run build`
- `[통과 기준]` vite build 무경고 성공

---

## 5. Quality Gate Criteria (TRUST 5)

- **T (Tested)** — 본 문서의 8 Named AC(AC-HARDEN-1~3 + AC-EDGE-EMPTY-BODY/TITLE-FIRST/GUARD-ORDER + AC-FREEZE-EXC-1~2) 모두 GREEN. 003 30 AC + 004 7 AC + 005 전체 회귀 0. coverage 회귀 0(production 무변경으로 분모 불변).
- **R (Readable)** — AC 시나리오 문장이 한국어로 명확. 테스트 변경이 단언 보강 / Named AC 격상 / 주석 정리에 한정되어 가독성↑.
- **U (Unified)** — 003/004/005 의 AC 명명 규칙과 정합. 본 SPEC 신규 AC 는 `AC-HARDEN-N` / `AC-EDGE-*` / `AC-FREEZE-EXC-N` 으로 일관. EARS 키워드(WHEN / WHILE / WHERE / IF-THEN / SHALL / SHALL NOT) 사용 일관.
- **S (Secured)** — 본 SPEC 은 보안 표면을 추가하지 않음. 003 의 AC-MEDIA-4 / AC-LOCK-6 / AC-LIFE-4 보안 회귀 가드 침범 없음.
- **T (Trackable)** — 본 SPEC 의 모든 AC 가 spec.md §4 의 EARS 단언과 1:1 또는 1:N 매핑. 출처 A(004 evaluator 3건) / 출처 B(005 verify 2건 + 문서 1건) 추적 가능.

---

## 6. Definition of Done

본 SPEC Run 단계의 *완료 조건*:

- [ ] M0 ~ M4 전 마일스톤 종료
- [ ] AC-HARDEN-1, 2, 3 (REQ-GUARD-ASSERT-HARDEN) 모두 GREEN
- [ ] AC-EDGE-EMPTY-BODY, AC-EDGE-TITLE-FIRST, AC-EDGE-GUARD-ORDER (REQ-SEND-EDGE-LOCK) 모두 GREEN
- [ ] AC-FREEZE-EXC-1, 2 (REQ-DOC-FREEZE-EXCEPTION) 모두 GREEN
- [ ] SPEC-NEWS-REVISE-003 의 30 AC 회귀 가드 §4.1 모두 GREEN (30/30)
- [ ] SPEC-NEWS-REVISE-004 의 7 AC(AC-GRAY-1~3 + AC-LOCKV-1~4) 회귀 0
- [ ] SPEC-NEWS-REVISE-005 의 AC-SEND-GUARD-1~6 + AC-ALIGN-1~4 회귀 0
- [ ] production 코드(비-테스트 파일) 변경 0 — `git diff --stat` §4.2 단언 통과
- [ ] `npm test` (백엔드, node --experimental-sqlite --test) 전체 통과
- [ ] `npm run test:web` (프론트, vitest run --root web) 전체 통과
- [ ] `npm run build` (vite build web) 무경고
- [ ] TRUST 5 게이트 (T / R / U / S / T) 통과 (§5)
- [ ] PD1 기본값 준수 — AC-GRAY-3 주석 명확화만 (테스트 삭제/통합 미수행; AC-HARDEN-2 가 단언 불변 단언)
- [ ] DB 컬럼 미추가 (특히 `lockerPageId` 미추가; AC-HARDEN-1 이 `SELECT *` 부재 단언으로 잠금)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001~005 의 `spec.md` / `plan.md` / `acceptance.md` 를 수정하지 않음 (AC-FREEZE-EXC-2 정적 grep 단언)
- [ ] 모든 [검증 명령] 이 실제 명령(`npm test` / `npm run test:web` / `npm run build` / `git diff --stat`) 만 사용 (`--prefix web` 금지)
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-05
