---
id: SPEC-EDIT-LOCK-001
version: 0.2.0
status: draft
created: 2026-06-03
updated: 2026-06-03
author: manager-spec
---

# SPEC-EDIT-LOCK-001 — 구현 계획 (Implementation Plan)

> **Brownfield 특성화 + 신규 TTL 만료(v0.2.0).** 기존 잠금 동작은 DB·백엔드·프론트엔드 전 계층에
> **이미 구현**되어 있고 테스트가 모두 GREEN이다([EXISTING]). v0.2.0에서 사용자 승인으로 **지연(lazy)
> 잠금 만료 — reclaim-on-acquire([NEW])** 단 하나의 신규 동작을 추가한다. 이 부분만 TDD(RED→GREEN→
> REFACTOR)로 신규 구현하며, 나머지는 검증·특성화·앵커 확인이다.

---

## 1. 접근 전략 (Technical Approach)

- **방법론**: TDD (`quality.yaml` development_mode=tdd).
  - [EXISTING] 잠금 동작: 사후 명세이므로 RED를 새로 작성하지 않고 **기존 테스트를 특성화/회귀 가드**로
    명문화 — workflow-modes.md "Brownfield Enhancement"에 부합(기존 동작 이해 → 회귀 가드 고정).
  - [NEW] TTL 만료: **테스트가 존재하지 않으므로 RED 먼저** 작성한다(AC-TTL-1~4). 기존 잠금 코드를
    이해한 뒤(Pre-RED) 실패 테스트 → 최소 구현 → 리팩터.
- **원칙**: 현 계약은 그대로 기술하고, 신규 TTL은 기존 단일 원자적 조건부 UPDATE를 **확장**하여
  부착한다(별도 경로/스케줄러 신설 금지). EARS/AC ↔ 코드 ↔ 테스트의 3자 정합을 file:line으로 고정.

### 1.1 신규 TTL 메커니즘 — 지연 만료(reclaim-on-acquire)

- **무엇**: orphaned lock(세션이 무효화될 때까지 정당 사용자의 편집을 영구 차단)을 해소한다.
- **방식**: 기존 `acquireLock`의 단일 원자적 조건부 UPDATE(`src/models/articleModel.js:84-99`)의 WHERE
  절에 분기 **하나**를 추가한다 — 개념적으로:
  ```
  ... WHERE articleId=? AND (LockYN IS NULL OR LockYN<>'Y'
                             OR LockedBySessionId=? OR LockedAt < ?staleThreshold)
  ```
  여기서 `staleThreshold = now - EDIT_LOCK_TTL_MS`. **백그라운드 프로세스/타이머/스케줄러 없음** —
  node:sqlite 단일 프로세스 동기 모델에 부합한다(획득 트랜잭션 안에서 스테일 잠금을 그대로 재선점).
- **재선점 의미**: 스테일 잠금이 재선점되면 동일 UPDATE가 `LockedBySessionId=<신규 세션>`,
  `LockedAt=now`, `LockYN='Y'`로 교체한다. 이전(만료) 홀더는 조용히 대체되며 알림 UX 없음(범위 외).
- **TTL 값**: `EDIT_LOCK_TTL_MS` 기본 `30*60*1000`(30분), 구성 가능. 근거: 기사 편집 소요 시간 여유 vs
  크래시 세션이 타인을 차단하는 창(window) 최소화의 균형.
- **`LockedAt` 용도(PD-2 RESOLVED)**: 더 이상 audit-only가 아니라 **만료 판단의 단일 입력**이다.
- **[HARD] 타임스탬프 형식 불변식**: 시계 기준은 서버 시간(`now`)을 저장된 `LockedAt`과 비교한다. 현재
  `LockedAt`은 ISO-8601 문자열(`new Date().toISOString()`, `src/services/articleService.js:90`)이므로,
  SQL의 `LockedAt < thresholdISO` **lexicographic 비교는 양쪽이 동일한 고정폭 UTC(Z) ISO 포맷일 때에만
  정확**하다. run 단계는 (a) 저장·비교 모두 동일 고정폭 UTC(Z) ISO를 보장하거나, (b) epoch-ms 정수
  컬럼/표현으로 전환하여 수치 비교로 만들어야 한다. 이 불변식을 깨면 만료 판정이 정렬되지 않아 무작위로
  재선점/차단이 어긋난다 — **구현 불변식으로 명시**.
- **시그니처 영향**: `acquireEditLock(articleId, sessionId, options={})`는 이미 `options.now`를 받는다
  (`src/services/articleService.js:89-90`). 따라서 `now` 주입은 시그니처 변경 없이 가능. 단, 모델
  `acquireLock(articleId, sessionId, now)`는 `now`(ISO 문자열)만 받으므로(`:84`), staleThreshold를
  모델에 전달하려면 모델 인자 1개 추가가 필요하다(서비스가 `now`와 `staleThreshold = now - TTL`를 산출해
  전달). 이는 service 시그니처 변경 없이 model 한 곳만 확장한다.

---

## 2. 기술 스택 (Tech Stack)

| 레이어 | 스택 | 비고 |
|--------|------|------|
| DB | `node:sqlite` (DatabaseSync, 동기 실행) | 단일 원자적 조건부 UPDATE로 race 제거. TTL은 WHERE 분기로 추가 |
| 백엔드 | Node.js (ESM), 경량 라우터(`server/index.js`) | `x-session-id` 헤더 기반 세션 인증 |
| 프론트엔드 | React + Vite, MVC(Model 주입 + Controller 훅) | `useWriteController` lock effect (TTL 변경 없음) |
| 백엔드 테스트 | `node --test` (node:test) | 잠금 테스트 + **신규 TTL RED** |
| 프론트 테스트 | Vitest + jsdom + @testing-library/react | `useWriteController.lock.test.jsx` (변경 없음) |
| 빌드 | `vite build` (무경고 요구) | — |

---

## 3. 작업 분해 (Task Decomposition) — 우선순위 라벨

> 시간 추정 금지(CLAUDE.md). Priority High → Medium → Low 순.

### Priority High — 기존 동작 검증 / 앵커 정합 (신규 코드 없음)

- **T1**: 백엔드 잠금 테스트 GREEN 재확인 — `node --test`로 `test/articleService.test.js:198-311`
  (acquire/block/idempotent/not-found/release/non-holder/action-auto-release/invalid-preserve) 전부 통과 확인.
- **T2**: HTTP 잠금 테스트 GREEN 재확인 — `test/serverAuthWiring.test.js:187-280`
  (200/409+홀더비노출/멱등200/unlock+재획득/액션자동해제/401/404) 전부 통과 확인.
- **T3**: 프론트 잠금 테스트 GREEN 재확인 — Vitest로 `useWriteController.lock.test.jsx:32-144` 8케이스 통과 확인.
- **T4**: file:line 앵커 drift 점검 — spec.md/acceptance.md/spec-compact.md의 모든 [EXISTING] file:line이
  실제와 일치하는지 재검증(코드 변경 시 라인 보정).
- **T5**: 5개 REQ ↔ AC ↔ 증거(file:line) 매핑표(acceptance.md §매핑)가 누락·중복 없이 정합함을 확인.

### Priority High — 신규 TTL 만료 구현 (TDD RED→GREEN→REFACTOR)

- **T6 (RED)**: AC-TTL-1~4의 실패 테스트를 `test/articleService.test.js`에 추가 작성한다.
  - 주입된 `now`(또는 작은 `EDIT_LOCK_TTL_MS`)로 결정적 테스트 — 실시간 대기/타이머 없음.
  - AC-TTL-1(스테일 `now-31min` 재선점), AC-TTL-2(신선 `now-29min` 차단), AC-TTL-3(정확히 TTL 경계 →
    차단, `LockedAt < now-TTL`만 스테일), AC-TTL-4(기본 30분 + 오버라이드).
  - 작성 후 **실패(RED) 확인**.
- **T7 (GREEN)**: 최소 구현으로 RED를 통과시킨다.
  - `src/models/articleModel.js:84-99`의 `acquireLock` WHERE 절에 `OR LockedAt < ?staleThreshold` 분기
    추가(+ 모델 인자에 staleThreshold 추가).
  - `EDIT_LOCK_TTL_MS` 상수(기본 `30*60*1000`) 도입, `src/services/articleService.js:89-92`에서
    `staleThreshold = now - TTL`를 산출하여 모델에 전달(`options`로 `now`/TTL 주입 경로 활용).
  - `LockedAt`을 **고정폭 UTC(Z) ISO** 동일 포맷으로 기록(또는 epoch-ms 전환) — 타임스탬프 불변식 보장.
  - AC-TTL-1~4 + 기존 잠금 테스트 전부 GREEN 확인(비스테일 차단 경로 무회귀).
- **T8 (REFACTOR)**: staleThreshold 산출 로직을 작은 헬퍼로 추출(예: `staleThresholdFor(now, ttlMs)`),
  중복 제거 및 가독성 개선. 테스트 GREEN 유지.

### Priority Medium — 잔여 결정 기록 / 보고

- **T9**: PD-1/PD-2를 RESOLVED로, PD-3/PD-4를 "확정: 현행 유지"로 spec.md §8에 반영(완료) 후 Plan Review에서
  사용자에게 최종 확인.
- **T10**: (CLAUDE.md HARD) 각 작업 종료 시 Slack `tech-day` 채널 보고. 토큰 미설정 시 로컬 로그
  폴백이며 "전송됨"으로 단정하지 않는다([[slack-techday-credentials]]).

---

## 4. 마일스톤 (Milestones — 우선순위 기반, 시간 추정 없음)

1. **M1 (기존 검증 고정)**: T1~T5 완료 — 5개 REQ의 [EXISTING] AC가 기존 테스트로 GREEN 특성화되고 앵커 정합 확인.
2. **M2 (신규 TTL TDD)**: T6→T7→T8 완료 — AC-TTL-1~4가 RED→GREEN→REFACTOR로 구현되고 타임스탬프
   형식 불변식이 검증됨. 기존 비스테일 차단 경로 무회귀.
3. **M3 (결정/보고)**: T9~T10 — PD 상태 확정 기록 및 보고. 전체 스위트 GREEN + 빌드 무경고로 SPEC 완료.

---

## 5. 위험과 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: orphaned lock (강제 종료/세션 미만료 시 잠금 잔존) | 정당 사용자가 자기 기사 편집 불가 | **v0.2.0에서 해소** — 지연 TTL(30분)로 다음 획득 시 자동 재선점. 보조: 액션 시 무조건 해제, best-effort keepalive unlock(`httpModel.js:172`) |
| R2: lexicographic ISO 비교 오류 (타임스탬프 포맷 불일치) | 만료 판정이 정렬 안 됨 → 무작위 재선점/차단 | **[HARD] 타임스탬프 불변식**(§1.1) — 저장·비교 모두 고정폭 UTC(Z) ISO 동일 포맷, 또는 epoch-ms 수치 비교로 전환. T7에서 검증 |
| R3: 정당한 >30분 편집 중 도둑맞음 | 장시간 편집자가 잠금을 빼앗길 수 있음 | **수용** — 30분 기본값으로 완화. 향후 heartbeat(주기적 LockedAt 갱신)로 보강 가능(현 범위 외, 명시적 accepted-risk) |
| R4: 기존 비스테일 차단 경로 회귀 | 동시 편집 충돌 재발 | T6의 AC-TTL-2/3(비스테일 차단) + 기존 AC-BLK-1/2/3을 회귀 가드로 고정. WHERE 분기는 **추가**일 뿐 기존 조건 변경 없음 |
| R5: 시계 skew | 잘못된 만료 판정 | 단일 프로세스(node:sqlite 동기) → `now`는 서버 단일 시계 → **무시 가능**. 분산 환경 아님 |
| R6: 앵커 drift (코드 변경 시 file:line 어긋남) | 추적성 저하 | spec-anchored 라이프사이클 + T4 정합 점검. GREEN 후 [EXISTING] 앵커 라인 재보정 |
| R7: 세션 vs 사용자 혼동 | 동일 사용자의 두 번째 탭이 차단되어 혼란 | Glossary에 세션≠사용자 명문화. AC-AUTH-4로 고정(현 동작 의도) |

---

## 6. MX 태그 계획 (mx_plan)

> 기존 코드에 일부 ANCHOR가 부착되어 있다. v0.2.0의 TTL은 신규 코드를 도입하므로 신규/갱신 태그가 필요하다.

| 대상 (file:line) | 태그 | 사유 (@MX:REASON) | 상태 |
|------------------|------|-------------------|------|
| `src/models/articleModel.js:84` `acquireLock` (TTL 확장) | `@MX:ANCHOR` + `@MX:WARN` | fan_in≥3(service/controller/tests) + 동시 편집 lost-update를 막는 임계 영역; WHERE 분기 변경은 race·만료 정합에 직결 | **갱신/신규** — TTL 분기 추가 시 ANCHOR 유지 + WARN 부착 |
| `EDIT_LOCK_TTL_MS` 상수 | `@MX:NOTE` | 비즈니스 규칙 상수(편집 만료 30분) — 매직 상수 의미 설명 | **신규** |
| `src/models/articleModel.js:106` `releaseLock` | `@MX:ANCHOR` 후보 | 조건부/무조건 해제 분기, fan_in≥3 | 부착 검토(기존 acquireLock에만 ANCHOR) |
| `src/services/articleService.js` (staleThreshold 산출) | `@MX:NOTE` | TTL→staleThreshold 변환 + 타임스탬프 포맷 불변식 위치 | **신규** |
| `src/services/articleService.js:1` 서비스 | `@MX:ANCHOR` | 비즈니스 로직 허브, fan_in≥3 | 기존 부착됨 — 유지 |
| `web/src/controller/useWriteController.js:1` | `@MX:ANCHOR` | 작성 페이지 조정자 (TTL 변경 없음) | 기존 부착됨 — 유지 |

규칙: `@MX:WARN`/`@MX:ANCHOR` 신규/갱신 시 `@MX:REASON` 필수, 코드 주석 언어는
`.moai/config/sections/language.yaml`의 `code_comments` 설정을 따른다.

---

## 7. 테스트 전략 (Test Strategy)

- **백엔드(node:test)**: 기존 잠금 케이스 GREEN 재확인 **+ 신규 AC-TTL-1~4 RED→GREEN**. coverage ≥85%/per-commit ≥80%.
- **HTTP(node:test)**: 상태코드·페이로드·홀더 비노출·인증 우선순위 케이스 GREEN(변경 없음). 스테일 잠금
  재선점이 HTTP 경로(`POST /lock`)에서도 200을 내는지는 모델/서비스 단위 테스트로 충분(라우트 변경 없음).
- **프론트(Vitest+jsdom)**: 8케이스 GREEN(변경 없음 — TTL은 서버측).
- **회귀 가드**: 전체 스위트(web + backend)가 GREEN 유지. 비스테일 차단(AC-TTL-2/3, AC-BLK-*) 무회귀.
- **결정성**: TTL 테스트는 주입된 `now`/작은 TTL로 실시간 대기 없이 결정적으로 수행.
- **빌드**: `vite build` 무경고.

---

## 8. 문서 정합 (Plan-Run-Sync)

- Plan: 본 문서 + spec.md + acceptance.md + spec-compact.md (모두 v0.2.0).
- Run: [EXISTING]은 검증 위주, **[NEW] TTL은 TDD 사이클(T6→T7→T8)** 로 구현.
- Sync: 구현 완료 후 spec-anchored 라이프사이클로 유지(코드 변경 시 file:line 동기, [NEW]→[EXISTING] 전환).

---

Version: 0.2.0
Status: draft
Last Updated: 2026-06-03
