---
id: SPEC-NEWS-REVISE-006
artifact: plan
version: 0.1.1
created: 2026-06-05
updated: 2026-06-05
---

## HISTORY

- 2026-06-05 (v0.1.1): 구현 완료 동기화 — 계획대로 production 코드 0 변경, 테스트 3 파일만 수정 (editLockBehavior / useWriteController / articleDetail). 내용 무변경. (sync)


# Plan — SPEC-NEWS-REVISE-006

## 1. 구현 접근 (Implementation Approach)

본 SPEC 은 **Brownfield Δ-only — 두 평가의 비차단 권고 5건 흡수** 이다. 출처 A(SPEC-NEWS-REVISE-004 evaluator 라운드 1 PASS 0.838, 커밋 5fb4551, 3건) 와 출처 B(SPEC-NEWS-REVISE-005 verify Independent Re-evaluation 0.90/0.77 PASS calibration Δ0.13, 2건 + 문서 1건) 를 EARS 가드와 테스트 단언/주석/문서로 고정한다. production 코드 변경은 **0(zero)** 을 기본값으로 하며(004 의 production-zero precedent 계승), 테스트 파일의 *단언 보강* / *Named AC 격상* / *주석 정리* 와 본 SPEC spec.md 의 *문서 명문화* 만 수행한다.

전략 원칙:

- TDD RED-GREEN-REFACTOR. 003 의 30 AC + 004 의 7 AC + 005 의 전체 AC 가 GREEN 인 위에, 본 SPEC 의 단언 보강(AC-LOCKV-4 항진식 제거)과 신규 Named AC(EC-3/EC-4)를 *추가 RED* 로 도입한다.
- production 코드(`web/src/controller/useWriteController.js`, `web/src/view/articleDetail.js`, `web/src/model/editorContent.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 무변경. DB 컬럼 추가/변경 없음(특히 `lockerPageId` 미추가). 새 디자인 토큰 없음.
- 인코딩 UTF-8 강제 (BOM 없음).
- DB 삭제 금지(CLAUDE.md HARD): 본 SPEC 은 컬럼을 추가/삭제하지 않고 *존재/부재* 만 단언한다.
- 검증 명령은 리포 정본 스크립트만 사용 — `npm test`(백엔드, node --experimental-sqlite --test, glob `test/*.test.js`), `npm run test:web`(vitest run --root web), `npm run build`(vite build web). **`--prefix web` 등 비존재 명령 금지** (web/package.json 부재).
- 001~005 SPEC 문서 무수정 (004 PD4 선례). 동결 예외 원칙은 본 SPEC spec.md 에서만 forward-fix 로 명문화.

---

## 2. 권고별 영향 파일 매핑 (출처 → REQ → Files)

| 출처 | 권고 | 본 SPEC REQ | 근거 위치 (정본 측정) | 영향 production 파일 | 영향 테스트/문서 파일 (006) |
|------|------|------------|---------------------|---------------------|---------------------------|
| A | 1. AC-LOCKV-4 항진식 단언 보강 | REQ-GUARD-ASSERT-HARDEN | `test/editLockBehavior.test.js:213-231` (SELECT 3컬럼 → `lockerPageId` 부재 = 방어력 0) | 없음 | `test/editLockBehavior.test.js` — `SELECT *` + `Object.keys(row)` 단언으로 교체 |
| A | 2. AC-GRAY-3 범위 명확화 (PD1) | REQ-GUARD-ASSERT-HARDEN | `web/src/view/articleDetail.test.js:387-411` (AC-GRAY-1 과 구조 검증 반복) | 없음 | `web/src/view/articleDetail.test.js` — AC-GRAY-3 역할 *주석* 명확화만 (단언 불변) |
| A | 3. AC-LOCK-4 주석 어휘 정리 | REQ-GUARD-ASSERT-HARDEN | `test/editLockBehavior.test.js:82, 94` (`lockerPageId(=sessionId)` 혼용) | 없음 | `test/editLockBehavior.test.js` — 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 |
| B | 4. EC-3 Named AC 격상 | REQ-SEND-EDGE-LOCK | `useWriteController.js:252-255` (`hasEndMarker('')===false`), 005 acceptance.md:108 (edge bullet) | 없음 | `web/src/controller/useWriteController.test.jsx` — 빈 본문 송고 차단 전용 `it` 신설 |
| B | 5. EC-4 Named AC 격상 | REQ-SEND-EDGE-LOCK | `useWriteController.js:243-247`(제목 가드)→`252-255`(`(끝)` 가드), 005 acceptance.md:109 (edge bullet) | 없음 | `web/src/controller/useWriteController.test.jsx` — 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동 전용 `it` 신설 |
| B | 추가. 동결 예외 명문화 | REQ-DOC-FREEZE-EXCEPTION | 005 acceptance.md:78 (AC-ALIGN-4 단언 동결) vs 기대값 강화 충돌 | 없음 | 본 SPEC `spec.md` — forward-fix 명문화 (005 문서 무수정) |

> 본 SPEC 의 production 코드 변경은 0(zero). 테스트 파일의 *단언 보강/Named AC 격상/주석 정리* 와 본 SPEC spec.md 의 *문서 명문화* 만 수행한다.

---

## 3. 마일스톤 (Priority-based, No Time Estimates)

각 마일스톤은 SPEC-NEWS-REVISE-003 의 30 AC + 004 의 7 AC + 005 의 전체 AC GREEN 종료를 *전제 조건* 으로 한다.

### M0 — 승인 / 베이스라인 (Priority: High)

- `spec.md` / `plan.md` / `acceptance.md` 사용자 승인 (annotation cycle)
- Pending Decision PD1 잠금 (spec.md §9) — AC-GRAY-3 '주석 명확화 vs 삭제·통합' → 기본값 '주석 명확화만' 확인
- 기존 테스트 베이스라인 캡처 — `npm test` (백엔드), `npm run test:web` (프론트), `npm run build` (vite build web)
- 003 30 AC + 004 7 AC + 005 전체 GREEN + production 무변경 상태 확인 (베이스라인)
- 본 SPEC 의 production 코드 변경 0 원칙 확인

검증 명령:

```
npm test
npm run test:web
npm run build
git diff --stat
```

통과 기준: 기존 SPEC 전체 AC GREEN, 빌드 무경고, working tree 베이스라인 캡처 완료.

### M1 — REQ-GUARD-ASSERT-HARDEN (Priority: High)

전제: 004 AC-LOCKV-4 / AC-GRAY-3 GREEN, 003 AC-LOCK-4 GREEN.

작업:

- AC-HARDEN-1 — `test/editLockBehavior.test.js` AC-LOCKV-4 단언 보강
  - 변경 전(요지): `SELECT lockerUserId, lockerSessionId, lockedAt FROM Contents ...` → `Object.keys(lockRow).includes('lockerPageId') === false` (3컬럼 SELECT 라 항진식)
  - 변경 후(요지): `SELECT * FROM Contents WHERE articleId = ?` → `Object.keys(row)` 에 정본 3컬럼 존재 + `lockerPageId` 부재 단언 (전체 컬럼 집합 기준 → 컬럼 추가 시 FAIL, 방어력 회복)
- AC-HARDEN-2 — `web/src/view/articleDetail.test.js` AC-GRAY-3 역할 주석 명확화 (PD1 기본값: 주석만; 단언/구조 검증 불변)
- AC-HARDEN-3 — `test/editLockBehavior.test.js` L82/L94 주석을 `lockerSessionId(페이지 단위 식별자)` 단일 표기로 정리 (코드/단언 무변경)

검증 명령:

```
npm test
npm run test:web
```

통과 기준: AC-HARDEN-1~3 GREEN. 004 AC-LOCKV-1~3 / AC-GRAY-1~2 + 003 AC-LOCK-1~6 회귀 없음. production 무변경.

### M2 — REQ-SEND-EDGE-LOCK (Priority: High)

전제: 005 AC-SEND-GUARD-1~6 GREEN (`useWriteController.js` 가드 구현 존재).

작업:

- AC-EDGE-EMPTY-BODY (EC-3 격상) — `web/src/controller/useWriteController.test.jsx` 에 빈 본문(빈 문자열) 송고 → `(끝)` ALERT 차단 + saveArticle/applyAction 미호출 전용 `it` 신설
- AC-EDGE-TITLE-FIRST (EC-4 격상) — 제목 비고 + 본문 `(끝)` 있음 → 제목 가드만 발동(`actionError='제목이 없어 송고/보류할 수 없습니다.'`, `(끝)` alert 미호출, saveArticle/applyAction 미호출) 전용 `it` 신설
- AC-EDGE-GUARD-ORDER — 신규 케이스가 005 AC-SEND-GUARD-1~6 단언을 약화시키지 않음(본문 입력만 시나리오별 구성, 단언 동결) 회귀 확인

검증 명령:

```
npm run test:web
```

통과 기준: AC-EDGE-EMPTY-BODY / AC-EDGE-TITLE-FIRST / AC-EDGE-GUARD-ORDER GREEN. 005 AC-SEND-GUARD-1~6 회귀 없음. production 무변경.

### M3 — REQ-DOC-FREEZE-EXCEPTION (Priority: Medium)

전제: 005 acceptance.md AC-ALIGN-4(단언 동결) 규정 존재.

작업:

- AC-FREEZE-EXC-1 — 본 SPEC `spec.md` 에 "본문 입력 변경의 파생 기대값 변경(강화)은 동결 예외" 원칙을 forward-fix 로 명문화 (라우팅 분기 / 송고 DTO / 생애주기 전이 단언은 동결 유지)
- AC-FREEZE-EXC-2 — 005(및 001~004) SPEC 문서 무수정 확인 (`git diff --stat` 으로 SPEC 문서 변경 0; 004 PD4 선례)

검증 명령:

```
git diff --stat
```

통과 기준: spec.md 에 동결 예외 원칙 문장 존재. 001~005 SPEC 문서 변경 0 건.

### M4 — 전체 회귀 + Slack (Priority: High)

작업:

- 전체 테스트 회귀 검증
  - `npm test` (백엔드 전체, glob `test/*.test.js`)
  - `npm run test:web` (프론트엔드 전체, vitest --root web)
  - `npm run build` (vite build web 무경고)
- 003 30 AC + 004 7 AC + 005 전체 AC 회귀 가드 매트릭스 확인 (acceptance.md §4 와 정합)
- production 코드 무변경 단언 — `git diff --stat` 으로 비-테스트 파일 변경 0 확인
- Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)
- 본 SPEC 의 status: Plan → Run → (종료 시) Complete

검증 명령:

```
npm test
npm run test:web
npm run build
git diff --stat
```

통과 기준: 모든 테스트 GREEN, 빌드 무경고, 기존 SPEC 전체 AC 회귀 0 건, production(비-테스트) 파일 변경 0 건.

---

## 4. 구현 순서 권고 (Implementation Order)

1. **M1 (단언 보강 + 주석 정리)** — 가장 격리된 백엔드/프론트 단일 파일 변경. AC-LOCKV-4 항진식 제거가 방어력 회복의 핵심이므로 먼저 잠근다.
2. **M2 (송고 엣지 Named AC 격상)** — `useWriteController.test.jsx` 신규 `it` 2건. 005 의 가드 구현 GREEN 을 전제로 한다.
3. **M3 (동결 예외 명문화)** — 문서 단언. 코드/테스트 무관, 본 SPEC spec.md 에서만 수행.
4. **M4 (전체 회귀 + Slack)** — 5건 흡수 후 003/004/005 의 전체 AC + production 무변경 회귀 게이트.

이유:

- M1 은 단언의 *방어력* 자체를 회복하므로 우선순위 High. AC-LOCKV-4 가 항진식인 채로 두면 컬럼 추가 회귀를 영영 놓친다.
- M2 는 이미 정상 동작하는 가드(EC-3/EC-4)를 테스트로 *잠그는* 작업으로, production 동작 변경 없이 회귀 가드만 추가한다.
- M3 은 005 동결 규정과 기대값 강화의 충돌을 정본화하되 005 문서를 건드리지 않는다(004 PD4 선례).
- M4 는 004 의 production-zero precedent 를 본 SPEC 이 계승했는지 `git diff --stat` 으로 최종 검증한다.

---

## 5. 기존 SPEC AC 회귀 검증 단계

본 SPEC Run 단계의 핵심은 *003 의 30 AC + 004 의 7 AC + 005 의 전체 AC 가 회귀하지 않고 production 이 무변경* 임을 단언하는 것이다.

### 5.1 회귀 매트릭스 (핵심 항목)

| 출처 AC | 본 SPEC 의 보호 메커니즘 |
|--------|----------------------|
| 004 AC-LOCKV-4 (락 어휘 형식 단언) | AC-HARDEN-1 이 항진식을 `SELECT *` + `Object.keys` 로 보강(방어력 회복), AC-LOCKV-1~3 동작 단언 회귀 없음 |
| 004 AC-GRAY-3 (gray-line 분리 구조 회귀) | AC-HARDEN-2 가 역할 주석만 명확화, 단언 불변(PD1) |
| 003 AC-LOCK-4 (같은 user 다른 페이지 차단) | AC-HARDEN-3 가 주석 어휘만 정리, 동작 단언 회귀 없음 |
| 005 AC-SEND-GUARD-1~6 (`(끝)` 가드 + 제목 우선) | AC-EDGE-EMPTY-BODY/TITLE-FIRST 가 EC-3/EC-4 를 Named AC 로 격상, AC-EDGE-GUARD-ORDER 가 회귀 없음 단언 |
| 나머지 003 24 AC + 004 AC-GRAY-1~2 + 005 AC-ALIGN-1~4 | 본 SPEC 이 건드리지 않음 — `npm test` / `npm run test:web` 전체 통과로 회귀 0 확인 |

### 5.2 SPEC-NEWS-REVISE-002 / 001

- D2-5=A strict 정책(002), 분리 구조(001) 변경 없음.
- 본 SPEC 은 새 production 코드를 추가하지 않으므로 회귀 표면이 *테스트 단언 보강 / Named AC 격상 / 주석·문서 정리* 에 한정된다.

---

## 6. 검증 명령 종합 (Run 단계용)

### 6.1 단위 + 가드 테스트

```
# 프론트엔드 (vitest --root web)
npm run test:web

# 백엔드 (node --experimental-sqlite --test, glob test/*.test.js)
npm test
```

### 6.2 회귀 전체 실행

```
npm test
npm run test:web
npm run build
```

### 6.3 production / SPEC 문서 무변경 단언

```
# 비-테스트 production 파일 변경 0 + 001~005 SPEC 문서 변경 0 단언
git diff --stat
```

---

## 7. 위험과 완화 (Run 단계 관점)

| 위험 | 완화 |
|------|------|
| 004/005 가 Complete 가 아닌 상태에서 본 SPEC Run 시도 → 베이스라인 불명확 | M0 의 전제 조건 게이트로 차단. 003/004/005 전체 AC GREEN 확인 후 M1 진행 |
| AC-LOCKV-4 보강이 `SELECT *` 컬럼 순서/추가 컬럼에 민감 | `Object.keys` 집합 기반 단언(`includes`)으로 작성하여 순서 무관. 정본 3컬럼 존재 + `lockerPageId` 부재만 검사 |
| AC-GRAY-3 주석 명확화가 우발적으로 단언을 삭제·통합 | PD1 기본값 = 주석 명확화만. AC-HARDEN-2 가 단언/구조 검증 불변을 단언. 삭제·통합은 회귀 가드 감소 우려로 거부 |
| EC-4 신규 케이스가 `(끝)` alert 호출 카운트를 잘못 단언 | 구현 정본(`useWriteController.js` L243-255) 기준: 제목 가드(`actionError`) 먼저 `return` → `(끝)` 가드 미도달. alert call count 0 단언 |
| 동결 예외 명문화가 005 문서를 건드림 | AC-FREEZE-EXC-2 가 `git diff --stat` 으로 005(및 001~004) SPEC 문서 변경 0 단언. 명문화는 본 SPEC spec.md 에서만 (004 PD4 선례) |
| `--prefix web` 등 비존재 명령 사용 위험 | web/package.json 부재 — 모든 검증 명령은 루트 `npm test` / `npm run test:web` / `npm run build` 만 사용 |
| 테스트 파일 변경이 우발적으로 production 파일을 건드림 | M4 의 `git diff --stat` 게이트로 비-테스트 변경 0 확인 |

---

## 8. Sync 단계 준비 (참고)

본 SPEC 의 Run 종료 후 Sync 단계:

- 본 SPEC 의 status: Plan → Run → Complete
- 본 SPEC 의 단언 보강 / Named AC / 문서 명문화가 CI 에 반영됨
- SPEC-NEWS-REVISE-001~006 의 정합성 보장 (003 30 AC + 004 7 AC + 005 전체 + 본 SPEC 8 AC 모두 GREEN, production 무변경)
- Slack `tech-day` 채널 작업 완료 보고

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-05
