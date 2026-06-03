---
id: SPEC-NEWS-REVISE-004
artifact: acceptance
version: 0.1.0
created: 2026-06-04
updated: 2026-06-04
---

# Acceptance — SPEC-NEWS-REVISE-004

본 파일은 `spec.md` §4 의 EARS 요구사항(2 REQ) 에 대한 **테스트 가능한 Given-When-Then 시나리오**와 **Definition of Done**을 정리한다. 모든 시나리오는 프론트엔드는 Vitest(`npm run test:web`, vitest run --root web), 백엔드는 node test runner(`npm test`, node --experimental-sqlite --test, glob `test/*.test.js`) 로 자동화 가능하다. 본 SPEC 의 AC 는 SPEC-NEWS-REVISE-003 의 30 AC 를 *대체하지 않고 보강* 한다 (가드 정밀화 + 어휘 정합).

각 AC 항목 옆에 `[검증 명령]` + `[통과 기준]` + `[매핑]` 을 표기한다. 모든 [검증 명령] 은 리포 정본 스크립트(`npm test` / `npm run test:web` / `npm run build`) 만 사용하며 `--prefix web` 등 비존재 명령을 사용하지 않는다. evaluator-active 가 별도 해석 없이 PASS/FAIL 산출 가능하도록 작성.

---

## 1. REQ-GUARD-GRAYLINE-EXACT — 시나리오 (권고 1)

### Scenario AC-GRAY-1: gray-line 가드가 정확 토큰 `#DDE3EC` 를 단언

- **Given** `web/src/view/articleDetail.js` 의 production 토큰 `--yh-gray-line: #DDE3EC` (라인 88, 불변) 이 있고, `buildArticleDetailHtml(fullArticle)` 가 이 토큰을 포함한 `<style>` 텍스트를 생성
- **When** AC-EMPH-4 의 정밀화된 gray-line 단언이 실행됨 (정규식 `/--yh-gray-line:\s*#DDE3EC/i`)
- **Then** `styleText` 가 정확 토큰 `--yh-gray-line: #DDE3EC` 에 매치 (GREEN)
- **And** 003 AC-EMPH-4 의 두 번째 단언 `/1px solid var\(--yh-gray-line\)/` 가 회귀 없이 GREEN
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` 정확 토큰 매치 + `1px solid var(--yh-gray-line)` 단언 모두 GREEN
- `[매핑]` REQ-GUARD-GRAYLINE-EXACT / 권고 1

### Scenario AC-GRAY-2: false-positive 제거 — 의도하지 않은 `#DD**` 값 거부

- **Given** 정밀화 정규식 `/--yh-gray-line:\s*#DDE3EC/i` 와, 의도하지 않은 토큰 변경을 시뮬레이션하는 샘플 문자열 `--yh-gray-line: #DD0000` (production 파일을 변경하지 않고 테스트 내부 문자열로만 구성)
- **When** 정밀화 정규식을 샘플 문자열 `--yh-gray-line: #DD0000` 에 대해 평가
- **Then** 매치하지 않음 (`/--yh-gray-line:\s*#DDE3EC/i.test('--yh-gray-line: #DD0000') === false`)
- **And** 비교 대조: 003 의 느슨한 정규식 `/--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/` 였다면 같은 샘플에 매치했을 것임을 보조 단언 (false-positive 가 제거되었음을 증명)
- **And** 정확 토큰 샘플 `--yh-gray-line: #DDE3EC` 에는 매치함 (true-positive 보존)
- `[검증 명령]` `npm run test:web`
- `[통과 기준]` `#DD0000` 거부 + `#DDE3EC` 수용 + 느슨한 패턴 대비 false-positive 제거 증명 GREEN
- `[매핑]` REQ-GUARD-GRAYLINE-EXACT / 권고 1 (false-positive 제거)

### Scenario AC-GRAY-3: production CSS/토큰 무변경 + AC-EMPH-4 나머지 단언 회귀 없음

- **Given** `web/src/view/articleDetail.js` (production) 가 변경되지 않은 상태
- **When** 003 AC-EMPH-4 전체 테스트 케이스를 실행 (정밀화된 gray-line 단언 포함)
- **Then** `aria-label="제목"` 섹션 1개 + `aria-label="본문"` 섹션 1개 + 두 섹션 동일 부모 형제 단언 GREEN
- **And** 공통정보 12 dt label enumerate 단언 GREEN
- **And** `git diff --stat` 결과에서 `web/src/view/articleDetail.js` 가 *변경 목록에 없음* (production CSS/토큰 무변경)
- `[검증 명령]` `npm run test:web` 그리고 `git diff --stat`
- `[통과 기준]` AC-EMPH-4 나머지 단언 GREEN + `articleDetail.js` 비변경 (git diff 미포함)
- `[매핑]` REQ-GUARD-GRAYLINE-EXACT / 권고 1 (production 무변경 + 003 회귀 가드)

---

## 2. REQ-LOCK-VOCAB-ALIGN — 시나리오 (권고 2)

### Scenario AC-LOCKV-1: schema-vocab 가드 — 정본 3컬럼 존재 + `lockerPageId` 부재

- **Given** 빈 SQLite DB 에 `createSchema(db)` 적용 (`src/db/schema.js` 의 `Contents` 테이블, production 불변)
- **When** `db.prepare("PRAGMA table_info('Contents')").all()` 로 컬럼 목록을 enumerate → 컬럼명 집합 `cols`
- **Then** `cols` 가 `lockYN`, `lockerUserId`, `lockerSessionId`, `lockedAt` 을 모두 포함 (정본 어휘 존재)
- **And** `cols` 가 `lockerPageId` 를 *포함하지 않음* (`cols.includes('lockerPageId') === false`) — 부재가 의도적임을 잠금
- **And** `src/db/schema.js` 가 `git diff --stat` 변경 목록에 없음 (스키마 production 무변경)
- `[검증 명령]` `npm test`
- `[통과 기준]` 정본 3+1 컬럼 존재 + `lockerPageId` 부재 + 스키마 무변경 GREEN
- `[매핑]` REQ-LOCK-VOCAB-ALIGN / 권고 2 (PD1 컬럼 추가 거부 가드)

### Scenario AC-LOCKV-2: 다른 sessionId 진입 거부 + `lockerSessionId` 미덮어쓰기 (003 AC-LOCK-4 회귀)

- **Given** 기사 1건이 RDS 상태, U1 이 sessionId `P1` 로 `acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T0 })` 호출하여 락 보유 중 (`lockerSessionId === 'P1'`)
- **When** 동일 user U1 이 *다른* sessionId `P2` (= 다른 탭/페이지 단위 식별자) 로 `acquireEditLock(articleId, { userId: 'U1', sessionId: 'P2', now: T1 })` 호출
- **Then** 반환값이 거부 (`ok: false`, reason 'locked' 또는 동등)
- **And** DB 의 `lockerSessionId` 가 여전히 `'P1'` (P2 로 덮어쓰지 않음)
- **And** DB 의 `lockerUserId === 'U1'` 유지
- **And** 003 AC-LOCK-4 의 단언이 회귀 없이 GREEN (002 D2-5=A strict 정책 정합)
- `[Caveat]` SPEC-NEWS-REVISE-003 acceptance.md AC-LOCK-4 본문은 3좌표 모델(동일 sessionId S1 + 다른 pageId P2 → 거부)이지만, 실제 구현 `src/services/articleService.js` `acquireEditLock` 은 `{userId, sessionId}` 2좌표만 수용하며 동일 sessionId 재진입은 idempotent `ok:true` 이다. `test/editLockBehavior.test.js` (상단 주석 L6-8) 가 이미 P1/P2 를 sessionId 값으로 어댑테이션했으며, 본 SPEC 의 AC-LOCKV-2 는 그 어댑테이션된(구현 정합) 시나리오를 정본으로 삼는다.
- `[검증 명령]` `npm test`
- `[통과 기준]` 다른 sessionId 진입 거부 + `lockerSessionId` P1 유지 GREEN
- `[매핑]` REQ-LOCK-VOCAB-ALIGN / 권고 2 (003 AC-LOCK-4 회귀 가드, 페이지 단위 식별자 = sessionId)

### Scenario AC-LOCKV-3: 동일 sessionId idempotent 재획득 (002 D2-5=A 회귀)

- **Given** AC-LOCKV-2 의 초기 상태 (U1/P1 락 보유, `lockedAt === T0`)
- **When** 동일 user U1 이 *동일* sessionId `P1` 로 `acquireEditLock(articleId, { userId: 'U1', sessionId: 'P1', now: T2 })` 재호출 (T2 > T0)
- **Then** 반환값이 성공 (`ok: true`) AND DB 의 `lockedAt === T2` (재진입 시각으로 갱신; 구현 근거: `articleService.js` 의 idempotent re-acquire 경로가 `UPDATE Contents SET lockedAt = ?` 를 수행) — idempotent 재획득
- **And** DB 의 `lockerUserId === 'U1'`, `lockerSessionId === 'P1'` 유지
- **And** 002 D2-5=A 의 "동일 user + 동일 sessionId → idempotent re-acquire" 정책 회귀 없음
- `[검증 명령]` `npm test`
- `[통과 기준]` 동일 sessionId 재획득 성공 + `lockedAt === T2` refresh GREEN
- `[매핑]` REQ-LOCK-VOCAB-ALIGN / 권고 2 (002 D2-5=A 회귀 가드)

### Scenario AC-LOCKV-4: 주석 어댑테이션 → 형식 단언 승격 + 정본 어휘 명문화

- **Given** `test/editLockBehavior.test.js` 가 1 인 1 페이지 매핑(`sessionId` = page-scoped 식별자) 을 *주석으로만* 문서화하던 상태 (003 종료 시점)
- **When** 본 SPEC 이 해당 매핑을 *형식 단언* 으로 승격 — `lockerSessionId` 컬럼명을 직접 단언하고, AC-LOCKV-2/3 시나리오가 `lockerPageId` 가 아닌 `lockerSessionId` 를 정본 어휘로 사용
- **Then** 테스트 코드에서 락 보유자 식별 단언이 `lockerUserId` / `lockerSessionId` / `lockedAt` 정본 컬럼명만 사용 (`lockerPageId` 어휘 미사용)
- **And** 정본 어휘 의미(`lockerSessionId` = "페이지 단위 식별자") 가 단언 인접 주석 또는 테스트 설명에 명문화됨
- **And** 003 AC-LOCK-1~6 의 동작 단언이 회귀 없이 GREEN (어휘만 정합, 동작 불변)
- `[검증 명령]` `npm test`
- `[통과 기준]` 정본 어휘 단언 + 003 AC-LOCK-1~6 회귀 없음 GREEN
- `[매핑]` REQ-LOCK-VOCAB-ALIGN / 권고 2 (주석 → 형식 단언 승격)

---

## 3. SPEC-NEWS-REVISE-003 회귀 가드 매트릭스 (30 AC + production 무변경)

본 SPEC 의 Run 단계 종료 시 다음 매트릭스가 모두 GREEN 이어야 한다. 003 의 30 AC 전부 GREEN 유지 + production 코드 무변경.

### 3.1 003 의 30 AC GREEN 유지

| 003 AC 그룹 | AC 수 | 본 SPEC 의 보호 | 검증 명령 |
|------------|------|---------------|---------|
| AC-MEDIA-1~4 (미디어 검색) | 4 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm test` |
| AC-EMPH-1~3 (본문>제목 폰트) | 3 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm run test:web` |
| AC-EMPH-4 (gray-line + 분리 구조) | 1 | M1 의 AC-GRAY-1~3 가 정밀화하되 형제/구분선/12 dt label 단언 회귀 없음 | `npm run test:web` |
| AC-LOCK-1~6 (락 동작) | 6 | M2 의 AC-LOCKV-1~4 가 어휘 정합, 동작 단언 회귀 없음 (AC-LOCK-4 → AC-LOCKV-2) | `npm test` |
| AC-WLC-1~5 (Insert/Update 분기) | 5 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm run test:web` |
| AC-EMB-DEL-1~3, AC-ALTY-1~2, AC-REG-1 (에디터) | 6 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm run test:web` |
| AC-LIFE-1~4 (생애주기) | 4 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm test` |
| AC-INT-1 (통합 시나리오) | 1 | 건드리지 않음 — 전체 회귀로 GREEN 확인 | `npm test` |
| **합계** | **30** | 30/30 GREEN 유지 | `npm test` + `npm run test:web` |

### 3.2 production 코드 무변경 단언

- **Given** 본 SPEC 의 모든 변경이 적용된 working tree
- **When** `git diff --stat` 실행
- **Then** 변경 목록에 비-테스트 production 파일(`web/src/view/articleDetail.js`, `src/db/schema.js`, `src/services/articleService.js`, `server/index.js` 등) 이 *없음*
- **And** 변경 목록은 테스트 파일(`web/src/view/articleDetail.test.js`, `test/editLockBehavior.test.js`, `test/schema.test.js` 또는 신규 `test/` 파일) + 본 SPEC 문서(`.moai/specs/SPEC-NEWS-REVISE-004/*`) 로만 구성
- `[검증 명령]` `git diff --stat`
- `[통과 기준]` 비-테스트 production 파일 변경 0 건 (003 의 production-zero precedent 계승)
- `[매핑]` 전 REQ / production 무변경 회귀 가드

### 3.3 빌드 무경고

- **Given** 본 SPEC 의 모든 변경이 적용된 상태
- **When** `npm run build` (vite build web) 실행
- **Then** 빌드가 무경고로 성공
- `[검증 명령]` `npm run build`
- `[통과 기준]` vite build 무경고 성공

---

## 4. Quality Gate Criteria (TRUST 5)

본 SPEC 의 PASS/FAIL 판정 기준:

- **T (Tested)** — 본 문서의 6+ AC 시나리오(AC-GRAY-1~3 + AC-LOCKV-1~4) 모두 GREEN. 003 의 30 AC 회귀 0. coverage 회귀 0 (production 코드 무변경이므로 커버리지 분모 불변).
- **R (Readable)** — AC 시나리오 문장이 한국어로 명확. 테스트 변경이 정밀화/형식 단언 승격에 한정되어 가독성↑.
- **U (Unified)** — 003 의 AC 명명 규칙(`AC-EMPH-N`, `AC-LOCK-N`) 과 정합. 본 SPEC 신규 AC 는 `AC-GRAY-N` / `AC-LOCKV-N` 으로 일관. EARS 키워드(WHEN / WHILE / SHALL / SHALL NOT) 사용 일관.
- **S (Secured)** — 본 SPEC 은 보안 표면을 추가하지 않음. 003 의 AC-MEDIA-4 / AC-LOCK-6 / AC-LIFE-4 보안 회귀 가드 침범 없음.
- **T (Trackable)** — 본 SPEC 의 모든 AC 가 spec.md §4 의 EARS 단언과 1:1 또는 1:N 매핑. plan.md §2 의 권고 매핑 표와 정합.

---

## 5. Definition of Done

본 SPEC Run 단계의 *완료 조건*:

- [ ] M0 ~ M3 전 마일스톤 종료
- [ ] AC-GRAY-1, 2, 3 (REQ-GUARD-GRAYLINE-EXACT) 모두 GREEN
- [ ] AC-LOCKV-1, 2, 3, 4 (REQ-LOCK-VOCAB-ALIGN) 모두 GREEN
- [ ] SPEC-NEWS-REVISE-003 의 30 AC 회귀 가드 매트릭스 §3.1 모두 GREEN (30/30)
- [ ] production 코드(비-테스트 파일) 변경 0 — `git diff --stat` §3.2 단언 통과
- [ ] `npm test` (백엔드, node --experimental-sqlite --test) 전체 통과
- [ ] `npm run test:web` (프론트, vitest run --root web) 전체 통과
- [ ] `npm run build` (vite build web) 무경고
- [ ] TRUST 5 게이트 (T / R / U / S / T) 통과 (§4)
- [ ] `lockerPageId` 컬럼 미추가 (PD1 기본값 (i) 어휘 정합 준수; AC-LOCKV-1 이 부재 단언)
- [ ] 디자인 토큰 `--yh-gray-line: #DDE3EC` 값 불변 (AC-GRAY-3 이 production 무변경 단언)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001 / 002 / 003 의 `spec.md` / `plan.md` / `acceptance.md` 를 수정하지 않음 (정적 grep 단언)
- [ ] 모든 [검증 명령] 이 실제 명령(`npm test` / `npm run test:web` / `npm run build` / `git diff --stat`) 만 사용 (`--prefix web` 금지)
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-04
