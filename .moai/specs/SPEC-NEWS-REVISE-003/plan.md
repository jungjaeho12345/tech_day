---
id: SPEC-NEWS-REVISE-003
artifact: plan
version: 0.1.1
created: 2026-06-03
updated: 2026-06-04
---

# Plan — SPEC-NEWS-REVISE-003

## 1. 구현 접근 (Implementation Approach)

본 SPEC 은 **Brownfield Δ-only — 회귀 가드 + 정합 단언 중심** 이다. SPEC-NEWS-REVISE-002 가 동일 토픽 영역(스키마 / 락 서비스 / 컨트롤러 분기 / Alt+Y 단순화 / 임베드 삭제 / 미디어 검색)의 *구현 분담* 을 맡고, 본 SPEC 은 `news.md` / `ContentsVO.md` 의 미커밋 변경분에 대한 **문장 단위 EARS 가드**와 **테스트 가능한 AC** 를 추가한다. 본 SPEC 의 Run 단계는 002 의 마일스톤(M1~M7) 종결 이후 *회귀 가드 테스트* 만 추가하는 것이 원칙이다.

전략 원칙:

- TDD RED-GREEN-REFACTOR. 002 가 GREEN 으로 만들어 둔 구현 위에 본 SPEC 의 AC 를 *추가 RED* 로 도입한다 (회귀 검출).
- 백엔드(`src/`) 와 프론트엔드(`web/src/`) 두 영역 모두 영향. 우선순위는 *현재 상태 가장 명확한 토픽* → *논쟁 가능한 토픽* 순서로 잠그며, 002 의 미커밋 구현 부분(부분 GREEN 자산) 을 먼저 흡수한다.
- 디자인 토큰 추가 없음 (`--yh-blue`, `--yh-gray-line`, `--yh-serif`, `--yh-sans` 재사용).
- DB 삭제 금지(CLAUDE.md HARD): 002 가 `lockYN` 컬럼 추가 책임이며, 본 SPEC 은 *컬럼 정의 정합* 만 단언한다.
- 인코딩 UTF-8 강제.
- 002 와의 머지 충돌을 최소화하기 위해 본 SPEC 의 영향은 *테스트 파일 + 회귀 가드 단언* 으로 한정. 신규 production 코드는 본 SPEC 에서 생성하지 않는다.

---

## 2. 토픽별 영향 파일 매핑 (Topic → REQ → Files)

각 토픽(news.md / ContentsVO.md 미커밋 변경) 이 어떤 REQ 와 영향 파일에 매핑되는지 한눈에 보는 표:

| 토픽 | news.md 라인 | 본 SPEC REQ | 002 대응 REQ | 영향 production 파일 (002 분담) | 영향 테스트 파일 (003 신규/보강) |
|------|-------------|------------|------------|------------------------------|-----------------------------|
| A. 미디어 탭 검색 (Youtube API + Google 폴백) | L57~58 | REQ-MEDIA-TAB-SEARCH | REQ-SEARCH-YOUTUBE-API | `src/services/mediaSearch.js` (002 GREEN) | `src/services/__tests__/mediaSearch.lifecycleGuard.test.js` (신규) — API 키 비노출 단언 |
| B. 상세보기 본문 폰트 > 제목 폰트 | L84 | REQ-DETAIL-BODY-EMPHASIS | REQ-DETAIL-FONT-EMPHASIS | `web/src/view/articleDetail.js` (002 부분 GREEN) | `web/src/view/articleDetail.test.js` 보강 (AC-EMPH-1~4) |
| C. 기사 lockYN (1 인 1 페이지) | L86~88, ContentsVO.md lockYN | REQ-ARTICLE-LOCK-YN | REQ-DB-LOCKYN + REQ-EDIT-LOCK | `src/db/schema.js`, `src/models/articleModel.js`, `src/services/articleService.js`, `web/src/controller/useWriteController.js`, `web/src/view/WritePage.jsx` (모두 002 M1/M2/M3 분담) | `src/services/__tests__/editLockBehavior.test.js` (신규) — 1 인 1 페이지 단언 + 자동 검증 단언; `web/src/controller/useWriteController.lock.test.jsx` (002 와 정합) |
| D. articleInsert vs articleUpdate 분기 | L99~103 | REQ-WRITE-LIFECYCLE-API | REQ-API-INSERT-UPDATE-SPLIT | `web/src/controller/useWriteController.js`, `web/src/view/WritePage.jsx` (002 M3 분담) | `web/src/controller/useWriteController.test.jsx` 보강 (AC-WLC-1~5); `web/src/view/WritePage.test.jsx` 보강 (AC-WLC-4) |
| E. 임베드 삭제 + Alt+Y 정확 텍스트 | L117, L120 | REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT | REQ-EMBED-DELETE + REQ-EDITOR-END-MARKER | `web/src/view/InlineEmbed.jsx`, `web/src/view/editorShortcuts.js` (002 M4/M5 분담) | `web/src/view/InlineEmbed.test.jsx` 보강 (AC-EMB-DEL-1, 2, 3); `web/src/view/editorShortcuts.test.js` 보강 (AC-ALTY-1, 2) |
| F. API 생애주기 단언 (Insert/Update/Select) | L131 | REQ-API-LIFECYCLE-RULE | (없음 — 003 고유) | `src/services/articleService.js`, `src/services/lifecycle.js` (002 분담 부분 + 본 SPEC 신규 단언) | `src/services/__tests__/lifecycleRule.test.js` (신규) — R/D/Z × send/hold/kill 매트릭스; `src/services/__tests__/lifecycleBypass.test.js` (신규) — 우회 경로 부재 단언 |

> 본 SPEC 의 production 코드 변경은 0 (zero). 002 마일스톤 종결 이후 본 SPEC 의 *테스트 파일 신규/보강* 만 수행한다.

---

## 3. 마일스톤 (Priority-based, No Time Estimates)

본 SPEC 의 마일스톤은 *테스트 보강 마일스톤* 이며, 각 마일스톤은 002 의 대응 마일스톤 종결을 *전제 조건* 으로 한다. 마일스톤 순서는 사용자 지시문의 "구현 순서 권고: C → D/F → A → E → B" 를 따른다.

### M0 — 준비 (Priority: High)

- `spec.md` / `plan.md` / `acceptance.md` 사용자 승인 (annotation cycle)
- Pending Decisions R1 ~ R9 잠금 (spec.md §9 위험 표)
- 기존 테스트 베이스라인 캡처 (`npm test --prefix web -- --run`, 백엔드 `npm test`)
- SPEC-NEWS-REVISE-001 / 002 의 미커밋 변경 / 진행 상태 확인 (002 M1~M7 진행 단계 파악)
- 본 SPEC 의 production 코드 변경 0 원칙 확인

### M1 — 토픽 C 정합 가드 (Priority: High)

전제: SPEC-NEWS-REVISE-002 M1 (REQ-DB-LOCKYN 스키마 추가) + M2 (REQ-EDIT-LOCK 락 서비스) 종결.

작업:

- 회귀 가드 테스트 `src/services/__tests__/editLockBehavior.test.js` 신규
  - AC-LOCK-1: 락 획득 성공 (lockYN === 'N' → 'Y'; lockOwner 갱신; 002 AC-EDIT-LOCK-1 정합)
  - AC-LOCK-2: 정상 해제 (송고/보류/KILL/취소/beforeunload 후 lockYN === 'N')
  - AC-LOCK-3: 다른 사용자 차단 (U1 보유 후 U2 시도 → 거부 + read-only 안내 단언)
  - AC-LOCK-4: 같은 사용자 다른 탭 차단 (U1/S1/P1 보유 후 U1/S1/P2 시도 → 거부; **003 고유 1 인 1 페이지 정책**)
  - AC-LOCK-5: TTL/heartbeat 회복 (lockedAt 가 30 분 초과 → 자동 해제 후 새 세션 획득 성공)
  - AC-LOCK-6: `articleUpdate` 자동 락 검증 (락 미보유자가 `articleUpdate` 호출 → 4xx 거부)
- `ContentsVO.md` 의 `lockYN` 필드 정의(varchar, default `'N'`, NOT NULL) 가 002 M1 의 `schema.js` 와 정합하는지 확인 (단위 테스트 또는 grep)

검증 명령:

- `npm test --prefix . -- src/services/__tests__/editLockBehavior.test.js`
- `grep -n lockYN ContentsVO.md` (필드 존재 단언)
- `grep -n 'lockYN' src/db/schema.js` (002 구현 정합 단언)

통과 기준: AC-LOCK-1~6 모두 GREEN. 002 AC-EDIT-LOCK-* 회귀 없음.

### M2 — 토픽 D 정합 가드 (Priority: High)

전제: SPEC-NEWS-REVISE-002 M3 (REQ-API-INSERT-UPDATE-SPLIT 컨트롤러 분기) 종결.

작업:

- `web/src/controller/useWriteController.test.jsx` 보강
  - AC-WLC-1: 신규 작성 컨텍스트(`editArticleId === null` + URL 에 `id` 없음) → 송고 시 `articleInsert` 호출, `articleUpdate` 미호출 (002 AC-API-1 정합)
  - AC-WLC-2: 편집 컨텍스트(`editArticleId === 'AKR-001'`) → 송고 시 `articleUpdate` 호출, `articleInsert` 미호출 (002 AC-API-2 정합)
  - AC-WLC-3: 편집 + KILL 클릭 → `articleUpdate` 호출 (002 AC-API-3 정합)
  - AC-WLC-5: 분기 오용 회귀 가드 — 권한이 R/D/Z 어느 값이든 분기 기준은 *컨텍스트* (권한이 분기에 영향 주지 않음 단언)
- `web/src/view/WritePage.test.jsx` 보강
  - AC-WLC-4: 제목 빈 입력 + 송고 클릭 → ALERT 호출 / 어떤 API 도 호출 안 됨 (002 AC-API-4 정합)

검증 명령:

- `npm test --prefix web -- web/src/controller/useWriteController.test.jsx`
- `npm test --prefix web -- web/src/view/WritePage.test.jsx`

통과 기준: AC-WLC-1~5 모두 GREEN. 002 AC-API-* 회귀 없음.

### M3 — 토픽 F 정합 가드 (Priority: High; 003 고유)

전제: SPEC-NEWS-REVISE-002 M2 (락 서비스 + applyAction) + M3 (Insert/Update 분기) 종결.

작업:

- 신규 `src/services/__tests__/lifecycleRule.test.js`
  - AC-LIFE-1: 권한 R + RDS + 송고 → DPS *가 아님*(news.md 생애주기: R 의 송고는 RDS 유지 → 사실은 R 의 송고는 RDS, D 의 송고는 DPS. 본 SPEC 은 news.md 표를 따른다)
    - 정확히는: R 의 RDS 송고 → RDS, R 의 RDS 보류 → RRH, R 의 RDS KILL → RRK
    - D 의 RDS 송고 → DPS, D 의 RDS 보류 → DDH, D 의 RDS KILL → DDK
    - Z 의 RDS 송고/보류/KILL → SPEC-NEWS-REVISE-001 D-6 의 Z 권한 lifecycle 전이표 (Z-mirror) 따름
  - AC-LIFE-2: 비허용 전이 거부 (예: R 권한이 DPS 기사 KILL 시도 → 4xx 거부, DB 무변경)
  - AC-LIFE-3: `articleSelect` 호출 후 DB 상태 무변경 단언 (read-only)
- 신규 `src/services/__tests__/lifecycleBypass.test.js`
  - AC-LIFE-4: 라우터 등록 목록 + grep 으로 `Contents UPDATE status` 직접 SQL 부재 단언

검증 명령:

- `npm test -- src/services/__tests__/lifecycleRule.test.js`
- `npm test -- src/services/__tests__/lifecycleBypass.test.js`
- `grep -rn "UPDATE Contents" src/ | grep -i status` (예상 출력: `articleService` 내부 1 곳만)

통과 기준: AC-LIFE-1~4 모두 GREEN. 002 lifecycle 전이표 회귀 없음.

### M4 — 토픽 A 정합 가드 (Priority: Medium)

전제: SPEC-NEWS-REVISE-002 분석에 따른 `src/services/mediaSearch.js` GREEN 상태.

작업:

- 신규 `src/services/__tests__/mediaSearch.lifecycleGuard.test.js`
  - AC-MEDIA-1: Youtube provider mock → 정상 응답 반환 (이미지탭/영상탭 경로)
  - AC-MEDIA-2: Youtube provider mock 실패 (HTTP 5xx 또는 throw) → Google provider mock 호출 + 결과 반환
  - AC-MEDIA-3: 글기사 탭 → 내부 articleService.searchArticles 호출, Youtube/Google provider 미호출
  - AC-MEDIA-4: 응답 페이로드에 API 키 부재 단언 (`process.env.YOUTUBE_API_KEY` 가 응답 JSON 어디에도 포함되지 않음; `JSON.stringify(response).includes(process.env.YOUTUBE_API_KEY)` 가 false)

검증 명령:

- `npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js`

통과 기준: AC-MEDIA-1~4 모두 GREEN. 002 AC-SEARCH-* 회귀 없음.

### M5 — 토픽 E 정합 가드 (Priority: Medium)

전제: SPEC-NEWS-REVISE-002 M4 (REQ-EMBED-DELETE) + M5 (REQ-EDITOR-END-MARKER) 종결.

작업:

- `web/src/view/InlineEmbed.test.jsx` 보강
  - AC-EMB-DEL-1: 임베드 1 개 → 삭제 액션 → 노드 1 개 제거, 본문 텍스트 보존
  - AC-EMB-DEL-2: 임베드 3 개 → 가운데 1 개 삭제 → 다른 2 개 + 인접 텍스트 보존
  - AC-EMB-DEL-3: markupVersion round-trip (`getMarkup()` → `setMarkup(...)`) 후 삭제된 임베드 복원되지 않음 단언
- `web/src/view/editorShortcuts.test.js` (또는 동등 위치) 보강
  - AC-ALTY-1: 본문 끝에서 Alt+Y → 정확히 `(끝)` 삽입 (선행 `\r\n` 없음, 선행 공백 없음); 골드색 데이터 속성 단언
  - AC-ALTY-2: 본문 끝에 이미 `(끝)` 존재 시 Alt+Y → noop

검증 명령:

- `npm test --prefix web -- web/src/view/InlineEmbed.test.jsx`
- `npm test --prefix web -- web/src/view/editorShortcuts.test.js`

통과 기준: AC-EMB-DEL-1~3, AC-ALTY-1~2 모두 GREEN. SPEC-NEWS-REVISE-001 AC-EMB-1~3 / AC-CTRL-D-* 회귀 없음. SPEC-NEWS-REVISE-002 AC-EMB-DEL-* / AC-ENDMARK-* 회귀 없음.

### M6 — 토픽 B 정합 가드 (Priority: Medium)

전제: 002 분석에 따른 `web/src/view/articleDetail.js` 부분 GREEN (`.yh-detail__title 1.3rem` < `.yh-detail__content 1.75rem`) 상태.

작업:

- `web/src/view/articleDetail.test.js` 보강
  - AC-EMPH-1: CSS 룰 텍스트 파싱 또는 인라인 style 단언 → content `font-size` > title `font-size`
  - AC-EMPH-2: jsdom `getComputedStyle` 가 가능한 경우 보조 비교 (regex fallback 권장)
  - AC-EMPH-3: `article.title === ''` 또는 `null` → `(제목 없음)` 플레이스홀더가 들어간 상태에서도 본문 > 제목 관계 유지 (**003 고유 보강**)
  - AC-EMPH-4: SPEC-NEWS-REVISE-001 AC-DTL-1~6 회귀 단언 — `aria-label="제목"` / `aria-label="본문"` 2 섹션 / 12 공통정보 필드 / 1px 회색 구분선 모두 그대로

검증 명령:

- `npm test --prefix web -- web/src/view/articleDetail.test.js`

통과 기준: AC-EMPH-1~4 모두 GREEN. SPEC-NEWS-REVISE-001 AC-DTL-* / SPEC-NEWS-REVISE-002 AC-FONT-* 회귀 없음.

### M7 — 통합 회귀 + Sync 준비 (Priority: High)

작업:

- 전체 테스트 회귀 검증
  - `npm test --prefix web -- --run` (프론트엔드 전체)
  - `npm test -- --run` (백엔드 전체)
  - `npm run build --prefix web` (vite build 무경고)
- 기존 SPEC AC 회귀 가드 매트릭스 작성 (acceptance.md §9 와 정합)
- Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)
- 본 SPEC 의 status: Plan → Run (Run 단계 진입 시점에 002 종결 확인)

검증 명령:

- `npm test --prefix web -- --run`
- `npm test -- --run`
- `npm run build --prefix web`
- `grep -rn "SPEC-NEWS-REVISE-001\|SPEC-NEWS-REVISE-002" .moai/specs/SPEC-NEWS-REVISE-003/` (회귀 가드 매핑 단언)

통과 기준: 모든 테스트 GREEN, 빌드 무경고, 기존 SPEC AC 회귀 0 건.

---

## 4. 구현 순서 권고 (Implementation Order)

사용자 지시문에서 명시된 권고 순서:

1. **C (DB 스키마 + 락 정책)** — M1 (lockYN 컬럼 + 락 서비스 + 1 인 1 페이지 단언)
2. **D / F (API 분기 + 생애주기 단언)** — M2 + M3 (Insert/Update 분기 + lifecycle 매트릭스)
3. **A (외부 API)** — M4 (Youtube + Google 폴백 + API 키 비노출)
4. **E (에디터)** — M5 (임베드 삭제 + Alt+Y 정확 텍스트)
5. **B (상세보기 시각 강조)** — M6 (본문 > 제목 폰트)

이유:

- C 는 DB 스키마 변경(002 M1 분담) 을 전제로 하므로 가장 먼저 잠근다.
- D 와 F 는 같은 컨트롤러/서비스 코드를 다루므로 함께 잠근다 (002 M3 분담 종결 후).
- A 는 외부 의존성(Youtube/Google API) 이 있으므로 mock 격리가 잘된 상태에서 잠근다.
- E 는 에디터 UX 회귀가 가장 빈번한 영역이므로 SPEC-NEWS-REVISE-001 AC-EMB-*/AC-CTRL-D-* 회귀 가드와 함께 잠근다.
- B 는 시각 단언이 jsdom 제약을 받으므로 가장 마지막에 R8 결정을 반영하여 잠근다.

---

## 5. 기존 SPEC AC 회귀 검증 단계

본 SPEC Run 단계의 핵심은 *기존 SPEC AC 가 회귀하지 않음을 단언* 하는 것이다.

### 5.1 SPEC-NEWS-REVISE-001 회귀 매트릭스

| 001 의 AC | 본 SPEC 의 보호 메커니즘 |
|----------|----------------------|
| AC-Z-1, 2, 3, 4, 5 (Z권한 송고/보류/KILL 가시성) | 본 SPEC 은 권한 규칙 변경 없음. WritePage.test.jsx 의 기존 Z 케이스가 GREEN 유지하는지 단언 |
| AC-DTL-1, 2, 3, 4, 5, 6 (상세보기 분리 구조 + 12 공통정보) | M6 의 AC-EMPH-4 가 명시적으로 단언 |
| AC-EMB-1, 2, 3 (커서 위치 임베드 + 영속성) | M5 의 AC-EMB-DEL-3 가 markupVersion round-trip 으로 단언 |
| AC-CTRL-D-1, 2, 3, 4 (Ctrl+D 라인 삭제) | 본 SPEC 은 Ctrl+D 변경 없음. 기존 테스트가 GREEN 유지하는지 단언 |
| AC-CTRL-D-5 (Alt+Y 보존) | 002 가 단언 문자열을 `(끝)` 로 갱신; 본 SPEC AC-ALTY-1 과 정합 |

### 5.2 SPEC-NEWS-REVISE-002 회귀 매트릭스

| 002 의 AC | 본 SPEC 의 보호 메커니즘 |
|----------|----------------------|
| AC-LOCKYN-1, 2, 3 (스키마 + 기본값 + round-trip) | M1 의 AC-LOCK-* 가 lockYN 컬럼 동작을 전제로 함; ContentsVO.md 정합 단언 |
| AC-EDIT-LOCK-1, 2, 3, 4, 5, 6 (락 획득/해제/충돌/cleanup) | M1 의 AC-LOCK-1~6 이 정합 가드 |
| AC-API-1, 2, 3, 4, 5 (Insert/Update 분기 + 제목 ALERT + lifecycle 일관) | M2 의 AC-WLC-1~5 이 정합 가드, M3 의 AC-LIFE-1~4 가 lifecycle 일관 가드 |
| AC-FONT-1, 2, 3, 4 (본문 > 제목 폰트) | M6 의 AC-EMPH-1~4 가 정합 가드 (특히 AC-EMPH-3 빈 제목 케이스는 003 고유 보강) |
| AC-ENDMARK-1, 2, 3, 4 (Alt+Y `(끝)` 단순화) | M5 의 AC-ALTY-1, 2 가 정합 가드 |
| AC-EMB-DEL-1, 2, 3, 4 (임베드 삭제) | M5 의 AC-EMB-DEL-1, 2, 3 이 정합 가드 |
| AC-SEARCH-1, 2, 3, 4 (Youtube + Google + 내부 검색 + 키 비노출) | M4 의 AC-MEDIA-1~4 가 정합 가드 |

### 5.3 SPEC-DB-FOUNDATION-001 / SPEC-BACKEND-CORE-001 / SPEC-FRONTEND-UI-001 / SPEC-UI-EDITOR-001 / SPEC-AUTH-001

- 기존 컬럼/기본키/lifecycle 전이표/UI 레이아웃/어댑터 계약/권한 의미 변경 없음.
- 본 SPEC 은 새 production 코드를 추가하지 않으므로 회귀 표면이 *002 의 회귀 가드를 통과한 후* 본 SPEC 의 테스트가 추가 단언만 한다.

---

## 6. 검증 명령 종합 (Run 단계용)

### 6.1 단위 + 통합 테스트

```
# 백엔드
npm test -- src/services/__tests__/editLockBehavior.test.js
npm test -- src/services/__tests__/lifecycleRule.test.js
npm test -- src/services/__tests__/lifecycleBypass.test.js
npm test -- src/services/__tests__/mediaSearch.lifecycleGuard.test.js

# 프론트엔드
npm test --prefix web -- web/src/controller/useWriteController.test.jsx
npm test --prefix web -- web/src/view/WritePage.test.jsx
npm test --prefix web -- web/src/view/InlineEmbed.test.jsx
npm test --prefix web -- web/src/view/editorShortcuts.test.js
npm test --prefix web -- web/src/view/articleDetail.test.js
```

### 6.2 회귀 전체 실행

```
npm test --prefix web -- --run
npm test -- --run
npm run build --prefix web
```

### 6.3 정적 검사 (정합 단언)

```
# ContentsVO.md 의 lockYN 필드 존재 단언
grep -n "lockYN" ContentsVO.md

# 002 의 schema.js 정합 단언
grep -n "lockYN" src/db/schema.js

# lifecycle 우회 경로 부재 단언
grep -rn "UPDATE Contents" src/ | grep -i status

# news.md 의 트리거 문장 정합 단언
grep -n "Youtube API" news.md
grep -n "제목보다 본문이 크게 표현한다" news.md
grep -n "lockYN" news.md
grep -n "articleInsert" news.md
grep -n "articleUpdate" news.md
grep -n "기사생애주기 규칙을 따른다" news.md
grep -n "임베딩된 데이터는 삭제할 수 있다" news.md
```

### 6.4 SQLite 마이그레이션 dry-run (002 M1 의 lockYN 컬럼 추가 검증)

```
# 002 M1 의 ensureContentsLockYNColumn 헬퍼가 멱등(idempotent) 인지 확인
# (Run 단계에서 신규 DB / 기존 DB 두 시나리오 모두 검증)
node -e "const { createSchema, ensureContentsLockYNColumn } = require('./src/db/schema'); const db = new (require('node:sqlite').DatabaseSync)(':memory:'); createSchema(db); ensureContentsLockYNColumn(db); ensureContentsLockYNColumn(db); console.log(db.prepare(\"PRAGMA table_info('Contents')\").all().filter(c => c.name === 'lockYN'));"
```

(위 명령은 예시이며, 002 M1 의 실제 헬퍼 이름/시그니처에 맞춰 조정.)

---

## 7. 위험과 완화 (Run 단계 관점)

| 위험 | 완화 |
|------|------|
| 002 가 종결되지 않은 상태에서 본 SPEC Run 시도 → 대부분의 AC 가 RED | 본 SPEC M0 의 전제 조건 검증 게이트로 차단. 002 종결 확인 후에만 M1 이후 진행 |
| 003 의 회귀 가드 테스트가 002 의 implementation detail (예: lockerPageId 필드명, ALERT 메시지 문자열) 에 종속 | 본 SPEC AC 는 *결과적 동작* 만 단언하고 implementation detail 은 피한다 (예: "ALERT 호출" 만 단언, ALERT 메시지 문자열은 정규식으로 느슨하게) |
| 003 의 신규 lifecycle 매트릭스 테스트가 SPEC-NEWS-REVISE-001 D-6 의 Z-mirror 전이표와 불일치 | M3 작성 전에 SPEC-NEWS-REVISE-001 spec.md 의 Z lifecycle 전이표를 참조 grep |
| Pending Decision R5 (구 `"\r\n (끝)"` 데이터 마이그레이션 여부) 미결 → 기존 본문 데이터에 구 형식 잔존 | 본 SPEC 기본값: migration 없음. 사용자가 마이그레이션 결정하면 *별도 SPEC* 으로 분리 (본 SPEC 의 Exclusions 와 정합) |
| jsdom 의 CSS 한계로 AC-EMPH-1/2 가 false negative 가능 | regex fallback + 002 의 AC-FONT-2 전략 그대로 차용 |

---

## 8. Sync 단계 준비 (참고)

본 SPEC 의 Run 종결 후 Sync 단계:

- `news.md` / `ContentsVO.md` 의 미커밋 변경분이 commit 됨
- 본 SPEC 의 status: Plan → Run → Complete
- 본 SPEC 의 회귀 가드 테스트가 CI 에 추가됨
- SPEC-NEWS-REVISE-001 / 002 / 003 의 정합성이 보장된 상태로 다음 사이클 진행 가능
- Slack `tech-day` 채널 작업 완료 보고

---

Version: 0.1.1
Status: Complete (Run 단계 종료 — spec.md HISTORY v0.1.1 참조)
Last Updated: 2026-06-04
