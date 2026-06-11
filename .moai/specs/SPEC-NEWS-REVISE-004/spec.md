---
id: SPEC-NEWS-REVISE-004
version: 0.1.0
status: Plan
created: 2026-06-04
updated: 2026-06-04
author: manager-spec
priority: medium
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-001
---

# SPEC-NEWS-REVISE-004 — 003 evaluator 권고 흡수 — 가드 정밀화 (gray-line 정확 토큰) + 락 보유자 어휘 정합 (lockerSessionId)

## HISTORY

- 2026-06-04 (v0.1.0): 최초 작성. SPEC-NEWS-REVISE-003 `/news produce` Run 단계 종료 시 evaluator-active 라운드 1/5 PASS(점수 0.95) 의 *비차단(non-blocking) 개선 권고* 2건을 흡수한다. Brownfield Δ-only — production 코드 변경 0 을 기본값으로 하며, 003 의 30 AC 와 production 무변경을 회귀 가드로 보장한다. 2 REQ 로 한정:
  - REQ-GUARD-GRAYLINE-EXACT (토픽 1): AC-EMPH-4 의 gray-line 구분선 가드를 느슨한 `/--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/` 에서 *정확 토큰* `#DDE3EC` 로 정밀화. 느슨한 정규식이 `#DD0000` 등 의도하지 않은 `#DD**` 계열 값까지 매치하던 false-positive 구멍을 막는다. 영향 파일: `web/src/view/articleDetail.test.js` (테스트 1개 라인 변경) 뿐.
  - REQ-LOCK-VOCAB-ALIGN (토픽 2): 락 보유자 어휘를 구현 정본(`lockerUserId` / `lockerSessionId` / `lockedAt`) 에 정합. `sessionId` 가 SPEC-NEWS-REVISE-002 D2-5=A 정책(1 인 1 페이지 = 페이지 단위 식별자) 을 운반하는 정본 어휘임을 명문화하고, `editLockBehavior.test.js` 의 주석 어댑테이션(comments-only) 을 *형식 단언* 으로 승격한다. DB 컬럼 추가/이름변경(option (ii) add-only `lockerPageId`)은 over-engineering 으로 *명시적 거부* — Pending Decision 으로 기본값 (i) 어휘 정합 채택. 영향 파일: `test/editLockBehavior.test.js`, schema-vocab 가드 테스트(기존 `test/schema.test.js` 보강 또는 신규 `test/` 파일 1개).
- 2026-06-04 (v0.1.0, audit-minor): acceptance.md 감사 정합 2건 (버전 불변). (1) AC-LOCKV-2 에 caveat 1줄 추가 — 003 AC-LOCK-4 의 3좌표(sessionId+pageId) 모델과 구현 정본 2좌표(`{userId, sessionId}`) 의 차이를 명문화하고, `editLockBehavior.test.js` L6-8 의 P1/P2→sessionId 어댑테이션을 AC-LOCKV-2 정본으로 확정. (2) AC-LOCKV-3 의 헤지 표현("또는 최소한 락이 U1/P1 보유로 유지") 제거 — same-user same-sessionId 재획득이 `lockedAt === T2` 로 refresh 됨을 구체 단언으로 강화 (구현 근거: `articleService.js` idempotent re-acquire 의 `UPDATE Contents SET lockedAt = ?`).

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-004 |
| 제목 | 003 evaluator 권고 흡수 — 가드 정밀화 (gray-line 정확 토큰) + 락 보유자 어휘 정합 (lockerSessionId) |
| 상태 | Plan |
| 생성일 | 2026-06-04 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-003, SPEC-NEWS-REVISE-002, SPEC-NEWS-REVISE-001 |
| 영향 페이지 | 없음 (production UI/CSS/DB 무변경) |
| 영향 백엔드 | 없음 (production 코드 무변경; `src/db/schema.js` 의 `lockYN`/`lockerUserId`/`lockerSessionId`/`lockedAt` 컬럼 정본을 *읽기 전용*으로 단언) |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only, production 코드 변경 0) |
| 인코딩 | UTF-8 (BOM 없음) |

---

## 1. 목적 (Goal)

SPEC-NEWS-REVISE-003 의 `/news produce` Run 단계는 evaluator-active 라운드 1/5 에서 PASS(점수 0.95, AC 30/30, must-pass 3조건 + production-untouched 모두 GREEN) 를 받았다. evaluator 는 추가로 *비차단 개선 권고* 2건을 남겼다. 본 SPEC-004 는 이 2건을 EARS 명세 가드 + 테스트 가능한 Given-When-Then AC 로 흡수한다.

`why`:

- **권고 1 (가드 정밀화)**: 003 AC-EMPH-4 의 gray-line 구분선 회귀 가드는 `web/src/view/articleDetail.test.js` 에서 `/--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/` 로 작성되어 있다. 실제 토큰은 `web/src/view/articleDetail.js:88` 의 `--yh-gray-line: #DDE3EC` 이며, 이 값은 `1px solid var(--yh-gray-line)` 형태로 라인 104/115/119/126 에서 구분선으로 사용된다. 그러나 느슨한 정규식은 `#DDE3EC` 를 맞추는 동시에 `#DD0000`(레드 계열) 같은 *의도하지 않은* `#DD**` 6자리 값까지 통과시킨다 — 토큰이 잘못 바뀌어도 가드가 통과하는 false-positive 구멍이다. 정확 토큰 `#DDE3EC` 단언으로 정밀화한다.
- **권고 2 (락 보유자 어휘 정합)**: 003 acceptance.md (AC-LOCK-1, AC-LOCK-4 등) 와 spec.md 는 `lockerPageId` / `pageId:'P1'` 어휘를 혼용했다. 그러나 구현 정본(`src/db/schema.js:65-68`, `src/services/articleService.js`) 의 실제 컬럼은 `lockYN` / `lockerUserId` / `lockerSessionId` / `lockedAt` 이며 `lockerPageId` 컬럼은 *존재하지 않는다*. 1 인 1 페이지 정책(002 D2-5=A) 은 `sessionId`(= 페이지 단위로 발급되는 식별자) 로 표현된다 — 동일 user + 다른 sessionId 진입은 거부, 동일 user + 동일 sessionId 재진입은 idempotent. `test/editLockBehavior.test.js` 는 이 어댑테이션을 *주석으로만*(L6-8, L82, L94) 문서화하고 있다. 본 SPEC 은 `lockerSessionId` 를 정본 어휘로 확정하고 "페이지 단위 식별자" 의미를 명문화하며, 주석 어댑테이션을 형식 단언으로 승격한다.

본 SPEC 은 코드를 작성하지 않는다(Plan 단계 문서만). Run 단계에서도 production 코드 변경은 0 을 기본값으로 하며, 테스트 파일의 *가드 정밀화/형식 단언 승격* 만 수행한다 (003 의 Δ-only precedent 계승).

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- 토픽 1 — `web/src/view/articleDetail.test.js` 의 AC-EMPH-4 gray-line 구분선 가드를 정확 토큰 `#DDE3EC` 로 정밀화 (느슨한 `#DD**` 계열 허용 제거)
- 토픽 2 — 락 보유자 어휘를 `lockerUserId` / `lockerSessionId` / `lockedAt` 정본으로 확정하고, `sessionId` = "페이지 단위 식별자" 의미를 명문화. `test/editLockBehavior.test.js` 의 주석 어댑테이션을 형식 단언으로 승격
- 토픽 2 — schema-vocab 가드: `Contents` 테이블에 `lockerUserId` / `lockerSessionId` / `lockedAt` 이 존재하고 `lockerPageId` 가 *부재* 함을 단언 (부재가 의도적임을 잠금)
- SPEC-NEWS-REVISE-003 의 30 AC 회귀 가드 (전부 GREEN 유지)
- production 코드 무변경 회귀 가드 (`git diff --stat` 으로 비-테스트 파일 변경 0 단언)

### 2.2 제외 (Out of Scope)

- 코드 구현 (본 SPEC 은 Plan 단계 문서만)
- production 코드(`web/src/view/articleDetail.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 변경
- DB 컬럼 추가/이름변경 — 특히 add-only `lockerPageId` 컬럼 도입(option (ii)) 은 *명시적 거부* (Pending Decision PD1)
- 디자인 토큰 값 변경 (`--yh-gray-line: #DDE3EC` 값 자체는 불변; 본 SPEC 은 단언만 정밀화)
- 1 인 1 페이지 정책의 *동작* 변경 (002 D2-5=A strict 정책 그대로; 본 SPEC 은 어휘/단언만 정합)
- SPEC-NEWS-REVISE-001/002/003 의 `spec.md` / `plan.md` / `acceptance.md` 수정
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 기사 작성기만")
- 새 `.claude/agents` 또는 `.claude/skills` 정의
- 락 분산 처리 또는 외부 락 스토어 도입

---

## 3. 사용자 시나리오 (User Scenarios)

> 본 SPEC 은 사용자 가시 동작을 변경하지 않는다. 아래 시나리오는 *회귀 가드/명세 정합* 관점의 개발자 시나리오다.

### 3.1 상세보기 구분선 토큰 회귀 검출 (토픽 1)

- 개발자가 `web/src/view/articleDetail.js` 의 `--yh-gray-line` 값을 실수로 `#DD0000`(레드 계열) 로 바꾼다.
- 003 의 느슨한 가드(`#DD[0-9A-Fa-f]{4}`) 라면 이 변경을 *통과시켜* 회귀를 놓친다 (false-positive).
- 본 SPEC 의 정밀화 가드(정확 토큰 `#DDE3EC`) 는 즉시 FAIL 하여 의도하지 않은 색 토큰 변경을 회귀로 검출한다.
- 정상 값 `#DDE3EC` 일 때는 GREEN 을 유지한다.

### 3.2 락 보유자 어휘 정합 (토픽 2)

- 개발자가 003 의 `lockerPageId` 어휘를 보고 DB 에 `lockerPageId` 컬럼이 있다고 가정한다.
- 실제 정본 스키마(`src/db/schema.js`) 에는 `lockerPageId` 가 없고 `lockerSessionId` 가 페이지 단위 식별자를 운반한다.
- 본 SPEC 의 schema-vocab 가드는 `lockerUserId` / `lockerSessionId` / `lockedAt` 존재 + `lockerPageId` 부재를 동시에 단언하여, 어휘 혼동으로 인한 잘못된 컬럼 추가/참조를 차단한다.
- 동일 user + 다른 sessionId 진입 거부(1 인 1 페이지) 동작은 003 AC-LOCK-4 그대로 GREEN 을 유지한다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-GUARD-GRAYLINE-EXACT — gray-line 구분선 가드 정확 토큰화 (Priority: Medium)

[PARTIALLY SUPERSEDED by SPEC-NEWS-REVISE-013 — 상세보기 별도 제목 요소 폐지] 본 REQ 가 호스트로 삼는 003 AC-EMPH-4 회귀 단언 중 *제목 요소(`.yh-detail__title`/`aria-label="제목"` 섹션) 존재* 전제만 폐지된다. gray-line 토큰 정확 매치(`#DDE3EC`), `1px solid var(--yh-gray-line)` 구분선 단언, 공통정보 12 dt label, 공통정보 ↔ 기사 두 섹션 형제 가드는 **그대로 유효**하며 SPEC-NEWS-REVISE-013 AC-NOTITLE-4 로 계승된다. 제목 요소 폐지 후 이 가드들은 AC-EMPH-4 대신 AC-NOTITLE-4 호스트에서 동일하게 단언된다.

#### EARS 문장

- **[Ubiquitous]** THE 가드(테스트) SHALL `web/src/view/articleDetail.test.js` 의 AC-EMPH-4 회귀 단언에서 gray-line 디자인 토큰을 *정확한 값* `--yh-gray-line: #DDE3EC` (대소문자 무시) 로 단언한다 (정규식 예: `/--yh-gray-line:\s*#DDE3EC/i`).
- **[Ubiquitous]** THE 가드 SHALL `1px solid var(--yh-gray-line)` 구분선 사용 단언(003 의 두 번째 `toMatch`) 을 그대로 유지한다 (이 단언은 회귀 없음).
- **[Unwanted]** THE 가드 SHALL NOT 느슨한 `#DD[0-9A-Fa-f]{4}` 계열 패턴으로 인해 `#DD0000` / `#DDFFFF` 등 *의도하지 않은* `#DD**` 6자리 값을 통과시킨다 (false-positive 제거).
- **[Unwanted]** THE 시스템 SHALL NOT production CSS(`web/src/view/articleDetail.js`) 또는 디자인 토큰 값(`--yh-gray-line: #DDE3EC`) 을 변경한다 (가드만 정밀화; 토큰 값 불변).

#### Acceptance Criteria 포인터

- AC-GRAY-1 (정확 토큰 매치 GREEN), AC-GRAY-2 (의도하지 않은 `#DD**` 값 거부 — false-positive 제거 단언), AC-GRAY-3 (production CSS/토큰 무변경 + 003 AC-EMPH-4 나머지 단언 회귀 없음) — acceptance.md §1. [PARTIALLY SUPERSEDED by SPEC-NEWS-REVISE-013: AC-GRAY-1 의 gray-line 토큰(#DDE3EC) 매치와 AC-GRAY-3 의 12 dt·공통정보↔기사 형제·`1px solid var(--yh-gray-line)` 단언은 유효(AC-NOTITLE-4 로 계승). 단 AC-GRAY-3 이 의존하는 "003 AC-EMPH-4 나머지 단언" 중 *제목 요소 존재* 단언은 제목 요소 폐지로 폐지]

---

### REQ-LOCK-VOCAB-ALIGN — 락 보유자 어휘 정합 (lockerSessionId 정본) (Priority: Medium)

#### EARS 문장

- **[Ubiquitous]** THE 문서/테스트 SHALL 락 보유자 식별 컬럼의 정본 어휘를 `lockerUserId` / `lockerSessionId` / `lockedAt` 으로 사용하고, `lockerSessionId` 가 "페이지 단위 식별자"(server 가 에디터 마운트마다 page-scoped 식별자를 `sessionId` 로 전달; 동일 user 의 두 번째 탭/페이지는 *다른* sessionId 로 표현) 라는 의미를 명문화한다.
- **[Event-Driven]** WHEN 가드가 락 보유자 컬럼을 단언하면, THE 가드 SHALL `Contents` 테이블에 `lockerUserId` / `lockerSessionId` / `lockedAt` 컬럼이 *존재* 함을 단언하고 동시에 `lockerPageId` 컬럼이 *부재* 함을 단언한다 (부재는 의도적 — 어휘 혼동 방지).
- **[State-Driven]** WHILE 동일 user 가 동일 기사에 *다른* sessionId 로 진입을 시도하는 경우, THE 시스템 SHALL 진입을 계속 거부하고 기존 보유자의 `lockerSessionId` 를 덮어쓰지 않는다 (003 AC-LOCK-4 = 002 D2-5=A strict 동작의 회귀 가드).
- **[State-Driven]** WHILE 동일 user 가 동일 sessionId 로 재진입을 시도하는 경우, THE 시스템 SHALL idempotent 재획득(lockedAt refresh) 으로 허용한다 (002 D2-5=A 의 동일 user/동일 session 정책 회귀 가드).
- **[Unwanted]** THE 시스템 SHALL NOT DB 컬럼을 추가하거나 이름변경한다 — 특히 add-only `lockerPageId` 컬럼 도입(option (ii)) 은 over-engineering 으로 거부하며, 기본값으로 (i) 어휘 정합(`lockerSessionId` 정본화) 만 채택한다 (Pending Decision PD1).
- **[Unwanted]** THE 시스템 SHALL NOT `src/services/articleService.js` 또는 `src/db/schema.js` 의 락 동작/스키마를 변경한다 (어휘/단언 정합만; 동작 불변).

#### Acceptance Criteria 포인터

- AC-LOCKV-1 (schema-vocab: lockerUserId/lockerSessionId/lockedAt 존재 + lockerPageId 부재), AC-LOCKV-2 (다른 sessionId 진입 거부 + lockerSessionId 미덮어쓰기 — 003 AC-LOCK-4 회귀), AC-LOCKV-3 (동일 sessionId idempotent 재획득 — 002 D2-5=A 회귀), AC-LOCKV-4 (editLockBehavior.test.js 주석 어댑테이션 → 형식 단언 승격) — acceptance.md §2

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 인코딩

- 모든 문서/테스트 파일은 UTF-8 BOM 없음 (CLAUDE.md HARD 규칙).
- 본 SPEC 의 3 파일(spec.md / plan.md / acceptance.md) 도 UTF-8 BOM 없음 (003 과 동일).

### 5.2 디자인 토큰

- 본 SPEC 은 새 CSS 변수를 도입하지 않으며, 기존 토큰 값을 변경하지 않는다.
- `--yh-gray-line: #DDE3EC` (articleDetail.js:88) 값은 불변. 본 SPEC 은 테스트 단언만 정확 토큰으로 정밀화한다.
- CLAUDE.md "디자인 파란색/흰색" 규칙 정합 — gray-line 은 파란빛이 도는 회색 계열(`#DDE3EC`) 이며 레드 계열(`#C8102E` / `#DD0000`) 은 금지. REQ-GUARD-GRAYLINE-EXACT 의 Unwanted 단언이 레드 계열 오변경을 회귀로 검출한다.

### 5.3 보안

- 본 SPEC 은 보안 표면을 추가/변경하지 않는다. 003 의 AC-MEDIA-4(API 키 비노출), AC-LOCK-6(락 우회 차단), AC-LIFE-4(직접 SQL 우회 차단) 회귀 가드를 침범하지 않는다.

### 5.4 동시성

- REQ-LOCK-VOCAB-ALIGN: 1 인 1 페이지 정책(002 D2-5=A) 의 동시성 동작(동일 user 다른 session 거부 / 동일 session idempotent / stale TTL 자동 해제) 은 003 에서 이미 GREEN 이며 본 SPEC 은 *어휘/단언* 만 정합한다 — 동시성 동작 자체는 불변.

### 5.5 회귀 방지

- SPEC-NEWS-REVISE-003 의 30 AC 전부 GREEN 유지. 특히 AC-EMPH-4(gray-line 가드) 와 AC-LOCK-1~6(락 동작) 가 본 SPEC 정밀화/정합 이후에도 통과.
- production 코드(`web/`, `src/`, `server/` 의 비-테스트 파일) 변경 0 (`git diff --stat` 검증).
- SPEC-NEWS-REVISE-002 D2-5=A 정책 회귀 없음. SPEC-NEWS-REVISE-001 분리 구조 회귀 없음.

---

## 6. 현재 진행 상태 (Current Progress — evaluator 권고 분석)

> 분석 시점: 2026-06-04. 출처: SPEC-NEWS-REVISE-003 `/news produce` Run, evaluator-active 라운드 1/5 PASS(0.95) 비차단 권고 + 003 종료 후 라이브 리포 측정.

| 권고 | 영향 파일 (정본 측정) | 현재 상태 | 한 줄 요약 |
|------|---------------------|---------|-----------|
| 권고 1 — gray-line 가드 정밀화 | `web/src/view/articleDetail.test.js:352` | **느슨한 가드(미정밀)** | `/--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/` 가 `#DDE3EC` 와 `#DD0000` 둘 다 매치. 정확 토큰 `#DDE3EC` 로 정밀화 필요 |
| 권고 1 — 토큰 정본 | `web/src/view/articleDetail.js:88` (`--yh-gray-line: #DDE3EC`), L104/115/119/126 (`1px solid var(--yh-gray-line)`) | **GREEN (불변)** | production 토큰/CSS 는 변경하지 않음. 가드만 정밀화 |
| 권고 2 — 락 어휘 정본 | `src/db/schema.js:65-68` (`lockYN`/`lockerUserId`/`lockerSessionId`/`lockedAt`) | **GREEN (불변)** | `lockerPageId` 컬럼 부재가 정본. `lockerSessionId` 가 페이지 단위 식별자 운반 |
| 권고 2 — 락 서비스 정책 | `src/services/articleService.js` (`acquireEditLock`/`releaseEditLock`/`assertLockHolder`, D2-5=A) | **GREEN (불변)** | 동일 user 다른 session 거부 / 동일 session idempotent. 동작 불변 |
| 권고 2 — 주석 어댑테이션 | `test/editLockBehavior.test.js:6-8, 82, 94` | **주석으로만 문서화** | `lockerPageId(=sessionId)` 매핑이 주석에만 존재. 형식 단언으로 승격 필요 |
| 권고 2 — schema-vocab 가드 | `test/schema.test.js` (보강) 또는 신규 `test/` 파일 | **미존재** | `lockerPageId` 부재 + 정본 3컬럼 존재 단언 신규 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규/수정될 영역 (가드 정밀화 + 형식 단언; 테스트만)

- `web/src/view/articleDetail.test.js` — AC-EMPH-4 의 gray-line 단언 1줄을 정확 토큰 `#DDE3EC` 로 정밀화 (REQ-GUARD-GRAYLINE-EXACT). 그 외 단언/구조는 불변.
- `test/editLockBehavior.test.js` — 주석 어댑테이션(L6-8, L82, L94) 을 형식 단언으로 승격 (AC-LOCKV-2, AC-LOCKV-3, AC-LOCKV-4). 기존 AC-LOCK-1~6 동작 단언은 회귀 없음.
- `test/schema.test.js` 보강 또는 신규 `test/schemaVocab.lockColumns.test.js` (택1) — schema-vocab 가드: `lockerUserId`/`lockerSessionId`/`lockedAt` 존재 + `lockerPageId` 부재 단언 (AC-LOCKV-1).

### 7.2 본 SPEC 이 절대 수정하지 않는 파일 [HARD]

- `.moai/specs/SPEC-NEWS-REVISE-001/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-002/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-003/*.md` (3 파일)
- 모든 production 코드 (`web/src/view/articleDetail.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`, 그 외 비-테스트 파일)

---

## 8. 테스트 전략 (TDD)

### 8.1 프론트엔드 가드 (vitest, `npm run test:web`)

- `web/src/view/articleDetail.test.js` AC-EMPH-4:
  - 정확 토큰 `/--yh-gray-line:\s*#DDE3EC/i` 매치 단언 (AC-GRAY-1).
  - false-positive 회귀 증거: 정밀화 정규식이 `#DD0000` 샘플 문자열에 매치하지 않음을 보조 단언 (AC-GRAY-2; production 변경 없이 정규식 자체를 샘플 문자열에 대해 검증).
  - 기존 `1px solid var(--yh-gray-line)` 단언 + 12 dt label + 두 섹션 형제 단언 회귀 없음 (AC-GRAY-3).

### 8.2 백엔드 가드 (node --experimental-sqlite --test, `npm test`)

- `test/editLockBehavior.test.js`:
  - AC-LOCK-4 형식 단언 승격 — 동일 user 다른 sessionId 거부 + `lockerSessionId` 가 P1 유지 (AC-LOCKV-2).
  - 동일 user 동일 sessionId idempotent 재획득(lockedAt refresh) 형식 단언 (AC-LOCKV-3).
  - 주석 어댑테이션(L6-8) 의 의미를 단언 코드 인접 주석 + 형식 단언으로 승격 (AC-LOCKV-4).
- schema-vocab 가드(`test/schema.test.js` 보강 또는 신규 `test/` 파일):
  - `PRAGMA table_info('Contents')` 결과에서 `lockerUserId`/`lockerSessionId`/`lockedAt` 존재 + `lockerPageId` 부재 단언 (AC-LOCKV-1).

### 8.3 회귀 가드

- `npm test` (백엔드 전체) 통과.
- `npm run test:web` (프론트 전체) 통과.
- `npm run build` (vite build web) 무경고.
- SPEC-NEWS-REVISE-003 의 30 AC 회귀 없음 (acceptance.md §3 회귀 매트릭스).
- production 코드 변경 0 — `git diff --stat` 으로 비-테스트 파일 변경 부재 확인.

---

## 9. 위험과 완화 (Risks & Mitigation — Pending Decisions 포함)

| ID | 위험 | 영향 | 완화 / 결정 필요 |
|----|------|------|----------------|
| **PD1** | 락 페이지 식별자 표현: (i) `lockerSessionId` 어휘 정합(현 구현 정본) vs (ii) add-only `lockerPageId` 컬럼 신규 추가 | (ii) 는 DB 스키마 변경 + 마이그레이션 + 서비스/테스트 동기화를 유발하는 over-engineering. 기존 GREEN 동작과 중복 | **본 SPEC 기본값: (i) 어휘 정합 채택. (ii) `lockerPageId` 컬럼 추가는 명시적 거부** (REQ-LOCK-VOCAB-ALIGN Unwanted 단언). 사용자가 (ii) 를 원하면 *별도 SPEC* 으로 분리 (DB 변경 + 마이그레이션 + add-only 규칙 검토 동반) |
| **PD2** | schema-vocab 가드 배치: 기존 `test/schema.test.js` 보강 vs 신규 `test/schemaVocab.lockColumns.test.js` | 둘 다 `npm test` glob(`test/*.test.js`) 에 포함되어 동작은 동일. 파일 분리 시 SPEC 추적성↑, 보강 시 파일수↓ | **본 SPEC 기본값: 기존 `test/schema.test.js` 보강** (파일수 최소, 003 의 production-zero precedent 와 정합). Run 단계에서 사용자/구현자 판단으로 신규 파일 택1 가능 |
| **PD3** | gray-line 가드 false-positive 검증 방식: 정밀화 정규식만 교체 vs 추가로 `#DD0000` negative 단언 1줄 신설 | negative 단언 추가는 가드 강도↑이나 테스트 라인 증가 | **본 SPEC 기본값: 정밀화 정규식 교체 + negative 보조 단언 1줄** (AC-GRAY-2). 사용자가 라인 최소화를 원하면 negative 단언 생략 가능 (정밀화 교체만으로도 권고 충족) |
| **PD4** | 003 acceptance.md 의 `lockerPageId` / `pageId:'P1'` 어휘를 소급 수정할지 여부 | 003 문서 수정은 본 SPEC 의 HARD 비목표(001/002/003 spec 무수정) 와 충돌 | **본 SPEC 기본값: 003 문서 무수정.** 본 SPEC 의 spec.md 에서 정본 어휘를 *forward-fix* 로 명문화하고, 003 의 `lockerPageId` 표기는 `lockerSessionId(=페이지 단위 식별자)` 의 별칭으로 해석 (003 HISTORY 와 정합) |

> PD1~PD4 는 Run 단계 진입 전 사용자 결정 후 잠금. 미결 항목은 본 SPEC 기본값을 임시 적용한다.

---

## 10. 종속성 및 Cross-References (회귀 가드 명시)

- **SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS / AC-EMPH-4** — 본 SPEC REQ-GUARD-GRAYLINE-EXACT 가 *gray-line 단언만 정밀화*. 두 섹션 형제 / 12 공통정보 dt label / `1px solid var(--yh-gray-line)` 단언은 회귀 없이 유지. (REQ-GUARD-GRAYLINE-EXACT Unwanted 절)
- **SPEC-NEWS-REVISE-003 REQ-ARTICLE-LOCK-YN / AC-LOCK-1~6** — 본 SPEC REQ-LOCK-VOCAB-ALIGN 가 *어휘/단언만 정합*. 락 획득/해제/충돌/TTL/자동검증 동작은 회귀 없이 유지. AC-LOCK-4(다른 sessionId 거부) 가 AC-LOCKV-2 로 직접 회귀 가드됨.
- **SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN / D2-5=A** — 본 SPEC 은 `lockYN`/`lockerUserId`/`lockerSessionId`/`lockedAt` 컬럼 정의와 D2-5=A strict 정책(동일 user 다른 session 거부) 을 *정본* 으로 단언. 컬럼 추가/이름변경 없음.
- **SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK** — 1 인 1 페이지 정책의 정본 어휘가 `sessionId`(페이지 단위) 임을 본 SPEC 이 명문화. 002 의 동작 변경 없음.
- **SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT** — 상세보기 분리 구조(2 섹션 / 구분선 / 12 공통정보) 변경 없음 (전 REQ 회귀 가드).
- **SPEC-DB-FOUNDATION-001** — `Contents` 테이블 기존 컬럼/기본키 변경 없음. 본 SPEC 은 락 컬럼 존재/부재를 *읽기 전용 단언* 으로만 검사.

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 기능 *구현* (본 SPEC 은 Plan 단계 문서만; Run 단계는 테스트 가드 정밀화/형식 단언 승격만).
- production 코드(`web/src/view/articleDetail.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/`) 변경.
- **DB 컬럼 추가/이름변경 — 특히 add-only `lockerPageId` 컬럼 도입(option (ii)) 은 명시적 거부** (PD1 기본값 (i) 어휘 정합).
- 디자인 토큰 값 변경 (`--yh-gray-line: #DDE3EC` 불변; 단언만 정밀화).
- 1 인 1 페이지 정책의 *동작* 변경 (002 D2-5=A 그대로).
- SPEC-NEWS-REVISE-001/002/003 의 `spec.md` / `plan.md` / `acceptance.md` 수정.
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 기사 작성기만").
- 새 `.claude/agents` 또는 `.claude/skills` 정의.
- 락 분산 처리 또는 외부 락 스토어(Redis/etcd) 도입.
- 새 디자인 토큰 정의 또는 CSS 변수 추가.
- AskUserQuestion 호출 (subagent boundary).

---

## 12. Definition of Done

- [ ] 3 파일 생성 + UTF-8 BOM 없음 (`spec.md`, `plan.md`, `acceptance.md`)
- [ ] 2 REQ 각각 EARS 문장 보유 (REQ-GUARD-GRAYLINE-EXACT: Ubiquitous×2 + Unwanted×2; REQ-LOCK-VOCAB-ALIGN: Ubiquitous + Event-Driven + State-Driven×2 + Unwanted×2)
- [ ] [Unwanted] 절을 모든 REQ 가 포함
- [ ] Risks 섹션에 PD1~PD4 Pending Decisions 명시 (특히 PD1: add-only `lockerPageId` 거부 → (i) 어휘 정합 기본값)
- [ ] Cross-References 에 SPEC-NEWS-REVISE-003 / 002 / 001 / DB-FOUNDATION-001 회귀 가드 명시
- [ ] Exclusions 절이 코드 구현 / DB 컬럼 추가 / 003 spec 수정 / 새 agents/skills 정의를 명시적으로 비목표화
- [ ] DoD 체크리스트가 spec.md 말미에 존재 (본 절)
- [ ] acceptance.md 의 AC 총 개수가 REQ당 최소 3개 이상 보장 (총 6+ 개; AC-GRAY-1~3 + AC-LOCKV-1~4)
- [ ] acceptance.md 의 모든 [검증 명령] 이 실제 명령(`npm test` / `npm run test:web` / `npm run build`) 만 사용 (`--prefix web` 금지)
- [ ] acceptance.md 에 003 의 30 AC GREEN 유지 + production 무변경(`git diff --stat`) 회귀 매트릭스 포함
- [ ] plan.md 의 마일스톤이 time estimates 없이 priority-based (CLAUDE.md HARD)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001/002/003 의 `spec.md`/`plan.md`/`acceptance.md` 를 수정하지 않음
- [ ] 본 SPEC 은 production 코드 (비-테스트 파일) 를 수정하지 않음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙) — Run 단계 진입/종료 시점에 수행

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-04
