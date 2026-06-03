---
id: SPEC-NEWS-REVISE-004
artifact: plan
version: 0.1.0
created: 2026-06-04
updated: 2026-06-04
---

# Plan — SPEC-NEWS-REVISE-004

## 1. 구현 접근 (Implementation Approach)

본 SPEC 은 **Brownfield Δ-only — evaluator 권고 흡수(가드 정밀화 + 어휘 정합)** 이다. SPEC-NEWS-REVISE-003 Run 의 evaluator-active 라운드 1/5 PASS(0.95) 비차단 권고 2건을 EARS 가드와 테스트 단언으로 고정한다. production 코드 변경은 **0(zero)** 을 기본값으로 하며(003 의 production-zero precedent 계승), 테스트 파일의 *가드 정밀화* 와 *형식 단언 승격* 만 수행한다.

전략 원칙:

- TDD RED-GREEN-REFACTOR. 003 이 GREEN 으로 만들어 둔 30 AC 위에 본 SPEC 의 정밀화 가드를 *추가 RED* 로 도입하여, 의도하지 않은 토큰/어휘 회귀를 검출한다.
- production 코드(`web/src/view/articleDetail.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 무변경. 디자인 토큰 값(`--yh-gray-line: #DDE3EC`) 불변, DB 스키마 불변(특히 `lockerPageId` 컬럼 *미추가* — PD1).
- 인코딩 UTF-8 강제 (BOM 없음).
- DB 삭제 금지(CLAUDE.md HARD): 본 SPEC 은 컬럼을 추가/삭제하지 않고 *존재/부재* 만 단언한다.
- 검증 명령은 리포 정본 스크립트만 사용 — `npm test`(백엔드, node --experimental-sqlite --test, glob `test/*.test.js`), `npm run test:web`(vitest run --root web), `npm run build`(vite build web). **`--prefix web` 등 비존재 명령 금지** (web/package.json 부재).

---

## 2. 권고별 영향 파일 매핑 (권고 → REQ → Files)

| 권고 | 본 SPEC REQ | 003 근거 | 영향 production 파일 | 영향 테스트 파일 (004 정밀화/승격) |
|------|------------|---------|---------------------|-----------------------------------|
| 1. gray-line 가드 정밀화 (정확 토큰 #DDE3EC) | REQ-GUARD-GRAYLINE-EXACT | AC-EMPH-4 (`articleDetail.test.js:352`) | 없음 (`articleDetail.js:88` 토큰 불변) | `web/src/view/articleDetail.test.js` — AC-EMPH-4 의 gray-line 단언 1줄 정밀화 + (옵션) `#DD0000` negative 보조 단언 |
| 2. 락 보유자 어휘 정합 (lockerSessionId 정본) | REQ-LOCK-VOCAB-ALIGN | AC-LOCK-1/4, `schema.js:65-68`, `editLockBehavior.test.js:6-8/82/94` | 없음 (스키마/서비스 불변; `lockerPageId` 미추가) | `test/editLockBehavior.test.js` — 주석 어댑테이션 → 형식 단언 승격; `test/schema.test.js` 보강(또는 신규 `test/` 파일) — schema-vocab 가드 |

> 본 SPEC 의 production 코드 변경은 0(zero). 테스트 파일의 *정밀화/승격* 만 수행한다.

---

## 3. 마일스톤 (Priority-based, No Time Estimates)

각 마일스톤은 SPEC-NEWS-REVISE-003 의 30 AC GREEN 종료를 *전제 조건* 으로 한다 (003 status Complete).

### M0 — 승인 / 베이스라인 (Priority: High)

- `spec.md` / `plan.md` / `acceptance.md` 사용자 승인 (annotation cycle)
- Pending Decisions PD1~PD4 잠금 (spec.md §9). 특히 PD1: add-only `lockerPageId` 컬럼 거부 → (i) 어휘 정합 채택 확인
- 기존 테스트 베이스라인 캡처 — `npm test` (백엔드), `npm run test:web` (프론트), `npm run build` (vite build web)
- 003 의 30 AC GREEN + production 무변경 상태 확인 (베이스라인)
- 본 SPEC 의 production 코드 변경 0 원칙 확인

검증 명령:

```
npm test
npm run test:web
npm run build
git diff --stat
```

통과 기준: 003 베이스라인 30 AC GREEN, 빌드 무경고, working tree 베이스라인 캡처 완료.

### M1 — REQ-GUARD-GRAYLINE-EXACT (Priority: Medium)

전제: 003 AC-EMPH-4 GREEN (`articleDetail.test.js:352` 의 느슨한 가드 존재).

작업:

- `web/src/view/articleDetail.test.js` AC-EMPH-4 의 gray-line 단언 1줄을 정확 토큰으로 정밀화
  - 변경 전: `expect(styleText).toMatch(/--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/);`
  - 변경 후(예): `expect(styleText).toMatch(/--yh-gray-line:\s*#DDE3EC/i);`
  - AC-GRAY-1: 정확 토큰 `#DDE3EC` 매치 GREEN
  - AC-GRAY-2: false-positive 제거 보조 단언 — 정밀화 정규식이 샘플 `--yh-gray-line: #DD0000` 문자열에 매치하지 않음 (PD3 기본값: negative 보조 단언 1줄)
  - AC-GRAY-3: 기존 `1px solid var(--yh-gray-line)` 단언 + 12 dt label + 두 섹션 형제 단언 회귀 없음

검증 명령:

```
npm run test:web
```

통과 기준: AC-GRAY-1~3 GREEN. 003 AC-EMPH-4 나머지 단언 회귀 없음. `articleDetail.js`(production) 무변경.

### M2 — REQ-LOCK-VOCAB-ALIGN (Priority: Medium)

전제: 003 AC-LOCK-1~6 GREEN (`test/editLockBehavior.test.js` 존재, D2-5=A 동작 구현 완료).

작업:

- `test/editLockBehavior.test.js` 의 주석 어댑테이션(L6-8 `sessionId = page-scoped UUID`, L82/L94 `lockerPageId(=sessionId)`) 을 형식 단언으로 승격
  - AC-LOCKV-2: 동일 user U1 다른 sessionId(P2) 진입 거부 + `lockerSessionId` 가 P1 유지 (003 AC-LOCK-4 회귀 가드, 002 D2-5=A)
  - AC-LOCKV-3: 동일 user U1 동일 sessionId(P1) 재진입 → idempotent 재획득(lockedAt refresh, ok:true) (002 D2-5=A)
  - AC-LOCKV-4: 정본 어휘 문서화 — 단언 인접 주석/단언이 `lockerSessionId` = "페이지 단위 식별자" 의미를 명시 (주석 승격)
- schema-vocab 가드 (PD2 기본값: 기존 `test/schema.test.js` 보강; 또는 신규 `test/schemaVocab.lockColumns.test.js` 택1)
  - AC-LOCKV-1: `PRAGMA table_info('Contents')` 결과에서 `lockerUserId`/`lockerSessionId`/`lockedAt` 존재 + `lockerPageId` 부재 단언

검증 명령:

```
npm test
```

통과 기준: AC-LOCKV-1~4 GREEN. 003 AC-LOCK-1~6 회귀 없음. `schema.js`/`articleService.js`(production) 무변경. `lockerPageId` 컬럼 미추가.

### M3 — 전체 회귀 + Slack (Priority: High)

작업:

- 전체 테스트 회귀 검증
  - `npm test` (백엔드 전체, glob `test/*.test.js`)
  - `npm run test:web` (프론트엔드 전체, vitest --root web)
  - `npm run build` (vite build web 무경고)
- 003 의 30 AC 회귀 가드 매트릭스 확인 (acceptance.md §3 와 정합)
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

통과 기준: 모든 테스트 GREEN, 빌드 무경고, 003 의 30 AC 회귀 0 건, production(비-테스트) 파일 변경 0 건.

---

## 4. 구현 순서 권고 (Implementation Order)

1. **M1 (gray-line 가드 정밀화)** — 단일 라인 정규식 교체로 가장 격리된 변경. 먼저 잠근다.
2. **M2 (락 어휘 정합)** — `editLockBehavior.test.js` 형식 단언 승격 + schema-vocab 가드. 003 의 D2-5=A 동작 GREEN 을 전제로 한다.
3. **M3 (전체 회귀 + Slack)** — 두 권고 흡수 후 003 의 30 AC + production 무변경 회귀 게이트.

이유:

- M1 은 프론트 단일 파일 단일 라인 변경으로 회귀 표면이 가장 작다.
- M2 는 백엔드 어휘/단언 정합으로, schema-vocab 가드가 `lockerPageId` 부재를 잠가 PD1(컬럼 추가 거부) 을 테스트로 보강한다.
- M3 은 003 의 production-zero precedent 를 본 SPEC 이 계승했는지 `git diff --stat` 으로 최종 검증한다.

---

## 5. 기존 SPEC AC 회귀 검증 단계

본 SPEC Run 단계의 핵심은 *003 의 30 AC 가 회귀하지 않고 production 이 무변경* 임을 단언하는 것이다.

### 5.1 SPEC-NEWS-REVISE-003 회귀 매트릭스 (핵심 항목)

| 003 의 AC | 본 SPEC 의 보호 메커니즘 |
|----------|----------------------|
| AC-EMPH-4 (gray-line 가드 + 분리 구조) | M1 의 AC-GRAY-1~3 가 정밀화하되 형제/구분선/12 dt label 단언은 회귀 없이 유지 |
| AC-LOCK-1~6 (락 획득/해제/충돌/TTL/자동검증) | M2 의 AC-LOCKV-1~4 가 어휘/단언만 정합, 동작 단언 회귀 없음 (특히 AC-LOCK-4 → AC-LOCKV-2) |
| 나머지 24 AC (AC-MEDIA-*, AC-EMPH-1~3, AC-WLC-*, AC-EMB-DEL-*, AC-ALTY-*, AC-LIFE-*, AC-INT-1) | 본 SPEC 이 건드리지 않음 — `npm test` / `npm run test:web` 전체 통과로 회귀 0 확인 |

### 5.2 SPEC-NEWS-REVISE-002 / 001 / DB-FOUNDATION-001

- D2-5=A strict 정책(002), 분리 구조(001), `Contents` 컬럼/기본키(DB-FOUNDATION-001) 변경 없음.
- 본 SPEC 은 새 production 코드를 추가하지 않으므로 회귀 표면이 *테스트 정밀화/승격* 에 한정된다.

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

### 6.3 production 무변경 단언

```
# 비-테스트 파일 변경 0 단언 (예상: articleDetail.test.js / editLockBehavior.test.js / schema.test.js 등 테스트만 변경)
git diff --stat
```

---

## 7. 위험과 완화 (Run 단계 관점)

| 위험 | 완화 |
|------|------|
| 003 이 Complete 가 아닌 상태에서 본 SPEC Run 시도 → 베이스라인 불명확 | M0 의 전제 조건 게이트로 차단. 003 status Complete + 30 AC GREEN 확인 후 M1 진행 |
| gray-line 정밀화가 다른 `#DD**` 토큰(다른 변수) 까지 영향 | 정규식이 `--yh-gray-line:` 접두를 포함하므로 다른 변수에 영향 없음. AC-GRAY-3 가 회귀 없음 단언 |
| `lockerPageId` 부재 단언이 미래 스키마 변경 시 false alarm | 그것이 의도 — PD1 기본값이 `lockerPageId` 추가를 거부하므로 부재 단언이 정책 가드로 작동. 사용자가 (ii) 를 채택하면 별도 SPEC 으로 분리 |
| `--prefix web` 등 비존재 명령 사용 위험 | web/package.json 부재 — 모든 검증 명령은 루트 `npm test` / `npm run test:web` / `npm run build` 만 사용 (003 HISTORY v0.1.1 경로 어댑테이션 정합) |
| 테스트 파일 변경이 우발적으로 production 파일을 건드림 | M3 의 `git diff --stat` 게이트로 비-테스트 변경 0 확인 |

---

## 8. Sync 단계 준비 (참고)

본 SPEC 의 Run 종료 후 Sync 단계:

- 본 SPEC 의 status: Plan → Run → Complete
- 본 SPEC 의 정밀화/승격 가드가 CI 에 반영됨
- SPEC-NEWS-REVISE-001 / 002 / 003 / 004 의 정합성 보장 (003 의 30 AC + 본 SPEC 의 6+ AC 모두 GREEN, production 무변경)
- Slack `tech-day` 채널 작업 완료 보고

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-04
