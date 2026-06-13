---
id: SPEC-NEWS-REVISE-003
version: 0.1.1
status: Complete
created: 2026-06-03
updated: 2026-06-04
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-UI-EDITOR-001
  - SPEC-FRONTEND-UI-001
  - SPEC-BACKEND-CORE-001
  - SPEC-DB-FOUNDATION-001
---

# SPEC-NEWS-REVISE-003 — news.md / ContentsVO 미커밋 변경 흡수 (미디어 탭 검색 / 상세보기 본문 강조 / lockYN / Insert·Update 분기 / 임베드 삭제·Alt+Y 정확 텍스트 / API 생애주기 단언)

## HISTORY

- 2026-06-04 (v0.1.1): Run 단계 종료 — `/news produce` 하네스 GAN 루프 라운드 1/5 PASS (점수 0.95: Design 0.90 / Originality 0.92 / Completeness 0.97 / Functionality 1.00, AC 30/30, must-pass 3조건 + production-untouched 모두 GREEN). 회귀 가드 테스트 10파일 추가 — 백엔드 신규 5 (`test/editLockBehavior.test.js`, `test/lifecycleRule.test.js`, `test/lifecycleBypass.test.js`, `test/mediaSearch.lifecycleGuard.test.js`, `test/integration.lockLifecycle.test.js`), 프론트 보강 5 (`articleDetail` / `useWriteController` / `WritePage` / `InlineEmbed` / `editorShortcuts` 테스트). production 코드 변경 0 (Δ-only 원칙 준수). 검증: 백엔드 179/179 · 프론트 282/282 · vite build 무경고. 경로 어댑테이션 확정: 백엔드 가드는 리포 컨벤션상 `test/` 에 위치(`npm test` glob), 프론트 검증 명령은 `npm run test:web` (web/package.json 부재). status: Plan → Complete.
- 2026-06-04 (plan-audit): manager-spec 정합 점검(Plan 인텐트, news.md 무변경 확인 — 마지막 커밋 `da26c72` 2026-06-02). 본 SPEC 의 6 REQ (토픽 A~F) 는 news.md 본문에 모두 커밋 반영된 상태이며, 002 의 7 REQ 와 토픽 영역이 겹치되 본 SPEC 은 *Δ-only 회귀 가드* 역할(코드 변경 없음, 002 spec/plan/acceptance 미수정)을 유지함을 재확인. 토픽 F(REQ-API-LIFECYCLE-RULE)·1 인 1 페이지 정책·빈 제목 케이스(AC-EMPH-3)·외부 API 미호출 단언(AC-MEDIA-3) 4건이 002 미포함 cross-cutting 가드로 확정. status: Plan (untracked) 유지, REQ 본문 변경 없음.
- 2026-06-03 (v0.1.0): 최초 작성. `news.md` 및 `ContentsVO.md` 의 3차 미커밋 변경분(6 토픽 + ContentsVO `lockYN` 필드)을 단일 SPEC, 6 REQ 로 정리. Brownfield Δ-only — 기존 SPEC AC 를 침범하지 않고 회귀 가드만 추가한다. SPEC-NEWS-REVISE-002 와 토픽 영역이 상당 부분 겹치므로, 본 SPEC 의 6 REQ 는 `news.md` 의 *문장 단위* 미커밋 변경분에 1:1 정합하는 명세 가드로 한정하며 002 의 구현 분담(스키마/서비스/컨트롤러)을 변경하지 않는다.
  - 토픽 A: 이미지탭/영상탭 검색을 Youtube **API** 로 명문화 + Google 폴백 (`news.md` L57~58)
  - 토픽 B: 상세보기 새창 하단의 본문 폰트 > 제목 폰트 시각 강조 (`news.md` L84 "제목보다 본문이 크게 표현한다")
  - 토픽 C: `lockYN` 기반 1 인 1 페이지 편집 잠금 (`news.md` L86~88 / `ContentsVO.md` lockYN 필드 추가)
  - 토픽 D: 신규 작성 `articleInsert` vs 편집 진입 `articleUpdate` API 분기 (`news.md` L99~103)
  - 토픽 E: 인라인 임베드 삭제 가능 + Alt+Y `(끝)` 정확 문자열 (선행 `\r\n` 없음) (`news.md` L117 / L120)
  - 토픽 F: `articleInsert/articleUpdate/articleSelect` 가 생애주기 규칙을 따른다는 cross-cutting 단언 (`news.md` L131)
  - (보조) `news.md` L58 "RDS 기사일 때" 오타 수정은 prose only — 본 SPEC 의 REQ 대상 아님 (회귀 단언만 포함).

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-003 |
| 제목 | news.md / ContentsVO 3차 미커밋 변경 흡수 (미디어 API / 상세보기 본문 강조 / lockYN / Insert·Update 분기 / 임베드 삭제·Alt+Y / API 생애주기 단언) |
| 상태 | Plan |
| 생성일 | 2026-06-03 |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 관련 SPEC | SPEC-NEWS-REVISE-001, SPEC-NEWS-REVISE-002, SPEC-UI-EDITOR-001, SPEC-FRONTEND-UI-001, SPEC-BACKEND-CORE-001, SPEC-DB-FOUNDATION-001 |
| 영향 페이지 | `writer.do` (작성/편집), 상세보기 새창, 메타데이터 탭(이미지/영상/글기사) |
| 영향 백엔드 | `src/services/mediaSearch.js`, `src/services/articleService.js`, `src/models/articleModel.js`, `src/db/schema.js`, API 라우터(`articleInsert`/`articleUpdate`/`articleSelect`) |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) |
| 작업 모드 | Brownfield 확장 (Δ-only) |
| 인코딩 | UTF-8 |

---

## 1. 목적 (Goal)

`news.md` (L57~58, L84, L86~88, L99~103, L117, L120, L131) 와 `ContentsVO.md` (lockYN 필드 추가) 의 미커밋 변경을, 기존 SPEC(NEWS-REVISE-001/002, UI-EDITOR-001, FRONTEND-UI-001, BACKEND-CORE-001, DB-FOUNDATION-001) 의 AC 를 침범하지 않으면서 **명세 가드(EARS)** 와 **테스트 가능한 Given-When-Then AC** 로 고정한다.

`why`:

- `news.md` / `ContentsVO.md` 는 시스템의 source-of-truth 이며, 미커밋 변경이 코드/테스트의 가정과 정합되지 않으면 회귀가 발생한다.
- SPEC-NEWS-REVISE-002 가 동일한 *데이터/서비스 측면*(스키마, 락 서비스, 컨트롤러 분기, Alt+Y 단순화, 임베드 삭제)을 이미 다루고 있다. 본 SPEC-003 은 그 위에 `news.md` *문장 단위 변경* 그 자체를 일급(first-class) 단언으로 잠그며, 002 의 AC 를 *대체하지 않고 보강*한다. 002 가 다루지 않는 *cross-cutting 단언*(특히 토픽 F — API 3종이 생애주기 규칙을 따른다)을 추가한다.
- 토픽 A(미디어 API + 폴백) 의 *API 키 비노출* 안전 단언과 토픽 B(본문 폰트 > 제목 폰트) 의 *빈 제목 케이스* 단언을 본 SPEC 에서 명시적으로 잠근다.

본 SPEC 은 코드를 작성하지 않는다(Plan 단계 문서만). Run 단계의 구현은 002 의 마일스톤(M1~M7)을 우선 따르며, 본 SPEC 의 AC 는 002 구현 후 *회귀 가드 + 정합성 검사* 역할을 한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- 토픽 A — 이미지탭/영상탭 검색의 Youtube Data API 호출 + 실패 시 Google 폴백 + API 키 클라이언트 비노출 명세
- 토픽 B — 상세보기 새창 하단의 본문 폰트 > 제목 폰트 (빈 제목 케이스 포함) + SPEC-NEWS-REVISE-001 분리 구조 회귀 가드
- 토픽 C — `lockYN` 기반 1 인 1 페이지 편집 잠금 + 비정상 종료 회복 (heartbeat/TTL)
- 토픽 D — 신규 작성 `articleInsert` vs 편집 `articleUpdate` API 분기 + 제목 미입력 가드
- 토픽 E — 인라인 임베드 노드 단일 삭제 + Alt+Y `(끝)` 정확 문자열 (선행 `\r\n` 없음) 단언
- 토픽 F — `articleInsert` / `articleUpdate` / `articleSelect` 가 SPEC-NEWS-REVISE-001 / `news.md` "기사 생애주기" 규칙(RDS / DPS / RRH / RRK / DDH / DDK 전이) 을 우회하지 않는다는 cross-cutting 단언
- 기존 SPEC AC 회귀 가드 (NEWS-REVISE-001 / NEWS-REVISE-002 / UI-EDITOR-001 / FRONTEND-UI-001 / BACKEND-CORE-001 / DB-FOUNDATION-001)

### 2.2 제외 (Out of Scope)

- 코드 구현 (본 SPEC 은 Plan 단계 문서만)
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 기사 작성기만")
- 새 디자인 토큰 정의 (기존 `--yh-blue` `#0A4DA6` / `--yh-gray-line` 재사용)
- 권한 R/D/Z 의미 변경 (SPEC-AUTH-001 유지)
- 생애주기 전이표 자체의 변경 (SPEC-BACKEND-CORE-001 / SPEC-NEWS-REVISE-001 유지)
- 새 `.claude/agents` 또는 `.claude/skills` 정의
- SPEC-NEWS-REVISE-001/002 의 spec.md/plan.md/acceptance.md 수정
- 락 분산 처리(다중 서버) 또는 외부 락 스토어 도입
- Youtube/Google 외 미디어 provider 신규 도입
- 글기사 탭의 정렬/페이징 정책 변경

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 메타데이터 탭 검색 (이미지탭/영상탭/글기사탭)

- 권한 R 사용자가 이미지탭에 "올림픽" 키워드를 입력하고 검색을 트리거한다.
- 시스템이 서버사이드에서 Youtube Data API v3 를 호출하고 결과 카드 목록을 반환한다 (API 키는 응답 페이로드/네트워크 탭 어디에도 노출되지 않는다).
- Youtube API 가 5xx/타임아웃/네트워크 오류로 실패하면 시스템이 Google 검색 결과로 폴백하여 결과를 반환한다.
- 사용자가 글기사탭으로 전환하면 시스템이 내부 기사 DB(`Article`/`Contents`) 의 title/content LIKE 검색만 수행한다 (외부 API 미호출).

### 3.2 상세보기 새창 — 본문 폰트 > 제목 폰트

- 사용자가 조회 페이지에서 우클릭 → 상세보기 → 새창이 열린다.
- 새창 상단의 공통정보 12 필드는 SPEC-NEWS-REVISE-001 그대로 표시된다 (회귀 없음).
- 새창 하단의 제목 블록과 본문 블록은 분리 렌더링되며, 본문 블록의 `font-size` 가 제목 블록의 `font-size` 보다 크다.
- `article.title` 이 비어 있어 제목 자리에 `(제목 없음)` 플레이스홀더가 들어가는 경우라도 본문 폰트 > 제목 폰트 관계가 유지된다.

### 3.3 기사 편집 잠금 (lockYN)

- 사용자 U1 이 RDS 기사 `AKR-001` 편집 진입을 요청한다. 시스템이 락이 비어 있음(`lockYN === 'N'`)을 확인한 뒤 `lockYN := 'Y'`, `lockOwner := U1` 으로 갱신하고 편집 페이지를 연다.
- 다른 사용자 U2 가 같은 기사로 편집 진입을 시도한다. 시스템이 락 보유자가 본인이 아님을 확인하고 진입을 차단하며 read-only 안내 + 락 보유자 정보를 표시한다.
- 동일 사용자 U1 이 동일 기사를 다른 탭/페이지에서 다시 편집하려 한다. 시스템이 *세션 단위*가 아닌 *페이지 단위* 1 인 1 페이지 정책에 따라 두 번째 진입을 차단한다.
- U1 이 브라우저를 비정상 종료한다. 시스템이 heartbeat 누락 또는 TTL 경과 후 락을 자동 해제한다.

### 3.4 작성/편집 송고 API 분기

- 사용자가 신규 작성 페이지(`writer.do` — articleId 미할당)에서 본문 작성 후 송고 버튼을 누른다 → 시스템이 `articleInsert` API 를 호출한다.
- 사용자가 편집 페이지(`writer.do?id=<articleId>`)에서 송고/보류/KILL 을 누른다 → 시스템이 `articleUpdate` API 를 호출한다.
- 사용자가 제목을 비운 상태로 송고/보류를 누른다 → 시스템이 ALERT("제목이 없어 송고/보류에 실패했습니다") 를 띄우고 어떤 API 도 호출하지 않는다.
- 어떤 경우에도 `articleInsert/articleUpdate/articleSelect` 는 `news.md` "기사 생애주기" 의 전이 규칙을 우회하지 않는다.

### 3.5 에디터 인라인 임베드 삭제 + Alt+Y 정확 텍스트

- 사용자가 본문에 임베드된 이미지 카드를 선택하고 삭제 액션을 트리거한다 → 해당 임베드 노드만 제거되며 인접 텍스트는 보존된다.
- 사용자가 본문 끝에서 Alt+Y 를 누른다 → 시스템이 본문 끝에 정확히 문자열 `(끝)` (선행 `\r\n` 없음, 선행 공백 없음) 을 1 회 골드색으로 삽입한다. 이미 `(끝)` 이 존재하면 noop.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-MEDIA-TAB-SEARCH — 이미지탭/영상탭 Youtube API 검색 + Google 폴백 (Priority: Medium)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 이미지탭 또는 영상탭의 검색창에 키워드를 입력한 후 검색을 트리거하면, THE 시스템 SHALL 서버사이드(`src/services/mediaSearch.js` 또는 동등) 에서 Youtube Data API v3 (`googleapis.com/youtube/v3/search`) 를 호출하여 결과 목록을 클라이언트로 반환한다.
- **[State-Driven]** WHILE Youtube API 호출이 실패(HTTP 비-2xx 응답, 네트워크 오류, 타임아웃) 하는 경우, THE 시스템 SHALL Google 검색(예: Google Custom Search API) 결과로 폴백 검색을 수행한다.
- **[Ubiquitous]** THE 시스템 SHALL 글기사탭의 검색을 내부 기사 DB(`Article` / `Contents` 테이블) 의 title/content LIKE 검색으로만 수행한다 (외부 API 미호출).
- **[Unwanted]** THE 시스템 SHALL NOT Youtube API 키 또는 Google API 키를 클라이언트 번들/응답 페이로드/네트워크 응답 헤더에 노출한다 (서버 환경변수 `YOUTUBE_API_KEY` / `GOOGLE_API_KEY` 만 사용, 키는 응답 직렬화에서 제거).
- **[Ubiquitous]** THE 시스템 SHALL 모든 검색 결과를 임베딩 가능한 카드 페이로드(`{source, title, url, thumbnailUrl}` 형태) 로 정규화한다.

#### Acceptance Criteria 포인터

- AC-MEDIA-1 (Youtube 호출), AC-MEDIA-2 (Google 폴백), AC-MEDIA-3 (글기사 내부 검색), AC-MEDIA-4 (API 키 비노출 회귀) — acceptance.md §1

---

### REQ-DETAIL-BODY-EMPHASIS — 상세보기 본문 폰트 > 제목 폰트 (Priority: Medium)

[SUPERSEDED by SPEC-NEWS-REVISE-013 — 상세보기 별도 제목 요소 폐지] 본 REQ 전체(본문 폰트 > 제목 폰트 회귀 가드 + AC-EMPH-1~4)는 더 이상 요구되지 않는다. 별도 제목 요소(`.yh-detail__title`/`aria-label="제목"` 섹션) 폐지로 폰트 비교 대상이 소멸한다. AC-EMPH-4 의 SPEC-NEWS-REVISE-001 분리 구조 회귀 단언 중 *제목 요소 존재* 부분은 폐지되고, 12 공통정보 dt / gray-line(#DDE3EC) / 공통정보-기사 두 섹션 형제 부분은 SPEC-NEWS-REVISE-013 AC-NOTITLE-4 로 계승된다.

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 상세보기 새창의 본문 블록(`.yh-detail__content` 또는 `aria-label="본문"` 섹션) `font-size` 가 제목 블록(`.yh-detail__title` 또는 `aria-label="제목"` 섹션) `font-size` 보다 크게 렌더링한다 (시각적 우선순위: 본문 > 제목).
- **[State-Driven]** WHILE `article.title` 이 빈 문자열 또는 `null` 이어서 제목 자리에 `(제목 없음)` 플레이스홀더가 들어가는 경우라도, THE 시스템 SHALL 본문 폰트 사이즈가 제목 폰트 사이즈보다 큰 관계를 유지한다.
- **[Unwanted]** THE 시스템 SHALL NOT SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT 의 분리 구조(2 개 `<section>`, `aria-label="제목"` / `aria-label="본문"`, 1px 회색 구분선 `--yh-gray-line` / `#DDD` 계열, 상단 공통정보 12 필드) 를 변경하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 본문 폰트 사이즈가 제목 폰트 사이즈와 같거나 작은 상태(시각적 동등 또는 본문이 더 작은 상태) 를 허용한다.

#### Acceptance Criteria 포인터

- AC-EMPH-1 (CSS 룰 — body > title), AC-EMPH-2 (jsdom getComputedStyle/regex 비교), AC-EMPH-3 (빈 제목 케이스), AC-EMPH-4 (SPEC-NEWS-REVISE-001 분리 구조 회귀) — acceptance.md §2

---

### REQ-ARTICLE-LOCK-YN — 기사 편집 잠금 (lockYN) (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 `writer.do?id=<articleId>` 로 편집 진입을 시도하면, THE 시스템 SHALL 해당 기사의 `Contents.lockYN` 을 검사하여, `lockYN === 'N'` (또는 락 보유자가 본인 + 동일 페이지) 일 때만 `lockYN := 'Y'` 및 락 보유자 정보(`lockOwner = <userId>`, `lockerSessionId`, `lockerPageId`) 를 서버에 기록하고 편집 페이지를 연다. 락 진입 시점 정책은 *페이지 진입 즉시*(eager) 를 기본값으로 한다 (Pending Decision R2 참조).
- **[Event-Driven]** WHEN 사용자가 편집을 정상 종료(송고/보류/KILL/취소) 하거나, 세션이 종료되거나, 브라우저 unload (`beforeunload` 또는 `visibilitychange:hidden` + `navigator.sendBeacon`) 가 발생하면, THE 시스템 SHALL 해당 기사의 `lockYN := 'N'` 으로 해제하고 락 보유자 정보를 비운다.
- **[State-Driven]** WHILE `lockYN === 'Y'` 이고 락 보유자가 현재 요청자가 아닌 경우, THE 시스템 SHALL 다른 사용자 또는 다른 페이지의 편집 진입을 차단하고 read-only 표시 + 락 보유자 정보(예: 사용자 ID, 보유 시작 시간) ALERT 를 표시한다.
- **[State-Driven]** WHILE 동일 사용자가 동일 기사를 다른 탭/페이지에서 열려고 시도하는 경우, THE 시스템 SHALL 락 보유 페이지 ID(`lockerPageId`, localStorage UUID 권장) 가 일치하지 않으면 두 번째 페이지 진입을 차단한다 (낙관적 1 인 1 세션이 아닌 1 인 1 페이지).
- **[Unwanted]** THE 시스템 SHALL NOT 비정상 종료(크래시/네트워크 단절) 로 인해 무한 잠금 상태가 남도록 두지 않는다 (heartbeat 또는 TTL 정책 — Pending Decision R3; 본 SPEC 기본값은 30 분 TTL + 1 분 heartbeat 옵션).
- **[Unwanted]** THE 시스템 SHALL NOT 락 검증 없이 `articleUpdate` 의 상태 전이를 적용한다 (서버 측 `articleUpdate` 진입점에서 락 보유자 검증을 *자동* 수행).
- **[Ubiquitous]** THE 시스템 SHALL `Contents.lockYN` 컬럼의 정의(varchar, 기본값 `'N'`, NOT NULL) 를 `ContentsVO.md` 의 `lockYN` 필드 추가와 정합시킨다.

#### Acceptance Criteria 포인터

- AC-LOCK-1 (정상 진입), AC-LOCK-2 (정상 해제), AC-LOCK-3 (다른 사용자 차단), AC-LOCK-4 (같은 사용자 다른 탭 차단), AC-LOCK-5 (TTL/heartbeat 회복), AC-LOCK-6 (articleUpdate 자동 검증) — acceptance.md §3

---

### REQ-WRITE-LIFECYCLE-API — 신규/편집 송고의 articleInsert vs articleUpdate 분기 + 제목 미입력 가드 (Priority: High)

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 신규 작성 페이지(예: `writer.do` 진입 시 URL 에 `id` 가 없거나, 컨트롤러 상태가 `editArticleId === null`) 에서 송고 또는 보류 버튼을 클릭하면, THE 시스템 SHALL `articleInsert` API 를 호출하여 새 기사를 `Article` / `Contents` 테이블에 RDS 상태로 적재한 뒤 lifecycle 전이를 적용한다.
- **[Event-Driven]** WHEN 사용자가 편집 진입(`writer.do?id=<articleId>` 또는 `editArticleId` 보유) 후 송고/보류/KILL 버튼을 클릭하면, THE 시스템 SHALL `articleUpdate` API 를 호출하여 기존 기사의 markupVersion / Contents 필드를 갱신한 뒤 lifecycle 전이를 적용한다.
- **[State-Driven]** WHILE 송고 또는 보류 버튼 클릭 시 제목 필드가 빈 문자열 또는 공백만으로 구성되어 있으면, THE 시스템 SHALL `articleInsert` / `articleUpdate` 호출 *이전에* ALERT("제목이 없어 송고/보류에 실패했습니다") 를 띄우고 어떤 API 도 호출하지 않는다 (기존 동작 유지).
- **[Ubiquitous]** THE 시스템 SHALL 송고/보류/KILL 클릭 이후 작성 페이지의 입력 폼과 에디터를 초기화(빈 상태) 한다.
- **[Unwanted]** THE 시스템 SHALL NOT 신규 작성 컨텍스트에서 `articleUpdate` 를 호출한다.
- **[Unwanted]** THE 시스템 SHALL NOT 편집 컨텍스트에서 `articleInsert` 를 호출한다.
- **[Ubiquitous]** THE 시스템 SHALL 분기 판정 기준이 권한(R/D/Z) 이 아닌 *컨텍스트*(URL 의 `id` 또는 컨트롤러 `editArticleId` 상태) 임을 유지한다.

#### Acceptance Criteria 포인터

- AC-WLC-1 (신규 → Insert 경로), AC-WLC-2 (편집 → Update 경로), AC-WLC-3 (편집 + KILL → Update), AC-WLC-4 (제목 없음 ALERT + API 미호출), AC-WLC-5 (분기 오용 회귀 가드) — acceptance.md §4

---

### REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT — 임베드 노드 삭제 + Alt+Y 정확 텍스트 (Priority: Medium)

#### EARS 문장

- **[Event-Driven]** WHEN 본문에 임베드 노드(이미지/영상/글기사 카드) 가 존재하는 상태에서 사용자가 해당 노드의 삭제 액션(노드 컨텍스트의 × 어포던스 클릭, 또는 노드 선택 후 `Delete` / `Backspace`) 을 트리거하면, THE 시스템 SHALL 해당 임베드 노드 1 개만 본문에서 제거하고 인접한 다른 임베드 노드 또는 본문 텍스트는 보존한다.
- **[Event-Driven]** WHEN 에디터가 포커스를 가진 상태에서 `Alt+Y` 키 이벤트가 발생하면, THE 시스템 SHALL 본문 끝에 정확히 문자열 `(끝)` (선행 `\r\n` 없음, 선행 공백 없음) 을 1 회 삽입하고 골드색 스타일을 적용한다.
- **[State-Driven]** WHILE 본문의 끝에 이미 `(끝)` 토큰이 존재하면, THE 시스템 SHALL 추가 삽입을 수행하지 않는다 (noop).
- **[Unwanted]** THE 시스템 SHALL NOT `(끝)` 삽입 시 `"\r\n (끝)"` 또는 `"\n(끝)"` 등 prefix 가 포함된 구 형식을 사용한다.
- **[Unwanted]** THE 시스템 SHALL NOT 임베드 삭제 시 markupVersion 직렬화/복원(`getMarkup()` → `setMarkup(...)`) round-trip 에서 삭제된 임베드 노드가 silently 복원되도록 두지 않는다.
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-001 REQ-EDITOR-EMBED-AND-CTRL-D 의 본문 커서 위치 임베드 삽입 / 임베드 영속성 / Ctrl+D 라인 삭제 동작을 변경하지 않는다 (Δ-only).
- **[Ubiquitous]** THE 시스템 SHALL SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER (Alt+Y `(끝)` 단순화) 와 REQ-EMBED-DELETE 의 EARS 와 정합한다 (단언 문자열 동기화).

#### Acceptance Criteria 포인터

- AC-EMB-DEL-1 (단일 임베드 삭제), AC-EMB-DEL-2 (다중 임베드 중 하나만 삭제), AC-ALTY-1 (Alt+Y 텍스트 정확성) — [SUPERSEDED by SPEC-NEWS-REVISE-015 REQ-EDITOR-END-NEWLINE] "(끝)" 이 선행 `\r\n`/`\n` 없이 인라인으로 삽입되며 '\n(끝)' 등 prefix 형식을 금지한다는 단언은 폐지된다. 마커는 본문 맨 마지막 다음 **개행에 자기 줄**(`\n(끝)`)로 들어가는 것이 정식 동작이며 SPEC-NEWS-REVISE-015 AC-END-NL-1 로 대체된다. (noop·임베드 보존은 SPEC-NEWS-REVISE-015 AC-END-NL-2/3 로 계승), AC-ALTY-2 (이미 존재 시 noop), AC-EMB-DEL-3 (markupVersion round-trip 반영), AC-REG-1 (SPEC-NEWS-REVISE-001 회귀) — acceptance.md §5

---

### REQ-API-LIFECYCLE-RULE — articleInsert/articleUpdate/articleSelect 가 생애주기 규칙을 따른다 (Priority: High)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL `articleInsert` / `articleUpdate` / `articleSelect` 가 모두 SPEC-NEWS-REVISE-001 D-6 및 `news.md` "기사 생애주기" 의 RDS / DPS / RRH / RRK / DDH / DDK 전이 규칙(`src/services/lifecycle.js` 의 `transition()` / `TRANSITIONS` 테이블) 을 준수한다.
- **[State-Driven]** WHILE 요청된 상태 전이가 현재 기사 상태 + 사용자 권한(R/D/Z) 조합에서 허용되지 않으면, THE 시스템 SHALL 4xx 응답(예: 403 Forbidden 또는 422 Unprocessable Entity) 으로 거부하고 DB 의 기사 상태를 변경하지 않는다.
- **[Unwanted]** THE 시스템 SHALL NOT 생애주기 규칙을 우회하는 직접 DB 업데이트 경로(예: `articleService` 외 직접 SQL UPDATE 라우트) 를 외부 API 로 노출한다.
- **[Unwanted]** THE 시스템 SHALL NOT `articleUpdate` 가 락 보유자 검증(REQ-ARTICLE-LOCK-YN) 을 우회하도록 허용한다.
- **[Ubiquitous]** THE 시스템 SHALL `articleSelect` 가 읽기 전용 API 로 어떤 상태 전이도 발생시키지 않는다 (조회는 전이 없음).

#### Acceptance Criteria 포인터

- AC-LIFE-1 (정상 전이 — R/RDS 송고 → RDS), AC-LIFE-2 (비허용 전이 거부 — R 권한이 DPS KILL 시도), AC-LIFE-3 (articleSelect 무전이), AC-LIFE-4 (우회 경로 부재) — acceptance.md §6

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 인코딩

- 모든 문서/소스/테스트 파일은 UTF-8 (CLAUDE.md HARD 규칙).
- 본 SPEC 의 3 파일(spec.md / plan.md / acceptance.md) 도 UTF-8 BOM 없음 (기존 002 와 동일).

### 5.2 디자인 토큰

- 본 SPEC 은 새 CSS 변수를 도입하지 않는다.
- 기존 토큰(`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC`, `--yh-serif` Nanum Myeongjo / Noto Serif KR, `--yh-sans` Noto Sans KR) 을 그대로 사용한다.
- 상세보기 본문 폰트 강조는 `font-size` 의 절대값(rem 단위) 으로만 표현한다 (예: `.yh-detail__title 1.3rem` < `.yh-detail__content 1.75rem`). SPEC-NEWS-REVISE-002 NFR 5.1 의 미커밋 값을 흡수한다.
- CLAUDE.md "디자인 파란색/흰색" 규칙에 따라 `news.md` 의 레드 `#C8102E` 는 적용하지 않는다(SPEC-NEWS-REVISE-001 NFR 5.1 정합).

### 5.3 보안

- REQ-MEDIA-TAB-SEARCH: Youtube/Google API 키는 서버 환경변수(`YOUTUBE_API_KEY`, `GOOGLE_API_KEY`) 에서 읽으며 응답 페이로드 / 네트워크 응답 헤더 / 클라이언트 번들 어디에도 포함되지 않는다 (OWASP A02:2021 Cryptographic Failures / A04:2021 Insecure Design 회피).
- REQ-ARTICLE-LOCK-YN: 락 보유자 식별(`lockOwner`, `lockerSessionId`, `lockerPageId`) 은 SPEC-AUTH-001 의 세션 컨텍스트에서 가져온다. 클라이언트가 보유자를 임의로 주장할 수 없다.
- REQ-API-LIFECYCLE-RULE: 생애주기 우회 경로(직접 SQL UPDATE 라우트) 부재를 회귀 가드로 단언한다 (정적 grep 또는 라우터 등록 목록 검사).

### 5.4 동시성

- REQ-ARTICLE-LOCK-YN: race condition 가드를 위해 SQLite 단일 트랜잭션 + `UPDATE Contents SET lockYN='Y', ... WHERE articleId=? AND lockYN='N'` 단일 atomic UPDATE 사용(affected rows === 1 만 성공). 본 SPEC 은 이 구현 의도를 EARS 로 잠그지 않고 *결과적 동작*(두 동시 진입 중 하나만 성공) 만 AC 로 단언한다.
- REQ-ARTICLE-LOCK-YN: heartbeat / TTL 정책은 본 SPEC 의 기본값(30 분 TTL + 옵션 1 분 heartbeat) 을 두되, 실제 값은 Pending Decision R3 사용자 결정 후 잠금.

### 5.5 접근성

- REQ-DETAIL-BODY-EMPHASIS: 폰트 사이즈 차이는 시각적 강조 수단으로만 작용하며 정보 의미를 색이나 크기에만 의존하게 두지 않는다(`aria-label="제목"` / `aria-label="본문"` 구조는 SPEC-NEWS-REVISE-001 그대로 유지).
- REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT: 임베드 × 어포던스는 `aria-label="임베드 삭제"` 를 가지며 키보드(`Delete` / `Backspace`) 로도 동등하게 삭제 가능하다.
- REQ-ARTICLE-LOCK-YN: 락 거부 안내는 `aria-live="assertive"` 를 권장한다.

### 5.6 회귀 방지

- SPEC-NEWS-REVISE-001 의 모든 AC(AC-Z-*, AC-DTL-*, AC-EMB-*, AC-CTRL-D-*) 회귀 없음. AC-CTRL-D-5 의 단언 문자열은 SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER 에 의해 이미 `(끝)` 로 갱신되어 있으며 본 SPEC 의 REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT 와 정합한다.
- SPEC-NEWS-REVISE-002 의 모든 AC(AC-LOCKYN-*, AC-EDIT-LOCK-*, AC-API-*, AC-FONT-*, AC-ENDMARK-*, AC-EMB-DEL-*, AC-SEARCH-*) 회귀 없음. 본 SPEC 의 AC 는 002 의 AC 와 *상호 보완*하며 충돌하지 않는다.
- SPEC-DB-FOUNDATION-001 의 `Contents` 테이블 기존 컬럼/기본키 변경 없음 (add-only).
- SPEC-BACKEND-CORE-001 의 lifecycle 전이표 변경 없음. 락 검증 책임만 추가.
- SPEC-FRONTEND-UI-001 의 60:40 레이아웃 / 4 탭 / 우측 상단 사용자 정보 변경 없음.
- SPEC-UI-EDITOR-001 의 어댑터 계약(`getMarkup`/`setMarkup`/`markupVersion`) 변경 없음.

---

## 6. 현재 진행 상태 (Current Progress — 미커밋 변경분 분석)

> 분석 시점: 2026-06-03. 출처: `news.md` / `ContentsVO.md` 미커밋 변경 + SPEC-NEWS-REVISE-001/002 spec.md.

| 파일 | REQ | 진행 상태 | 한 줄 요약 |
|------|-----|---------|-----------|
| `news.md` L57~58 | REQ-MEDIA-TAB-SEARCH | **명세 변경(미커밋)** | "이미지탭/영상탭/글기사탭" 명칭 고정 + "Youtube" → "Youtube **API**" 명문화. 본 SPEC 의 트리거 |
| `news.md` L84 | REQ-DETAIL-BODY-EMPHASIS | **명세 변경(미커밋)** | "제목보다 본문이 크게 표현한다" 추가. SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS 와 동일 의도; 본 SPEC 은 정합 가드 |
| `news.md` L86~88 | REQ-ARTICLE-LOCK-YN | **명세 변경(미커밋)** | "# 기사 lockYN" 절 신규. SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK 와 동일 의도; 본 SPEC 은 정합 가드 + 1 인 1 페이지 정책 명시 |
| `news.md` L99~103 | REQ-WRITE-LIFECYCLE-API | **명세 변경(미커밋)** | "##기사 워크플로우" 절에서 신규 작성 → `articleInsert`, 편집 → `articleUpdate` 분기 명문화. SPEC-NEWS-REVISE-002 REQ-API-INSERT-UPDATE-SPLIT 와 동일 의도 |
| `news.md` L117 | REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT | **명세 변경(미커밋)** | "임베딩된 데이터는 삭제할 수 있다" 신규. SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE 와 동일 의도 |
| `news.md` L120 | REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT | **명세 변경(미커밋)** | Alt+Y 삽입 문자열 `"\r\n (끝)"` → `"(끝)"` 단순화. SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER 와 동일 의도 |
| `news.md` L131 | REQ-API-LIFECYCLE-RULE | **명세 변경(미커밋)** | "articleInsert, articleUpdate, articleSelect 는 기사생애주기 규칙을 따른다" 신규. SPEC-NEWS-REVISE-002 는 명시적 EARS 가 없음 — **본 SPEC 의 고유 cross-cutting 가드** |
| `ContentsVO.md` | REQ-ARTICLE-LOCK-YN | **명세 변경(미커밋)** | `lockYN` 필드 추가. SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN 트리거 — 본 SPEC 정합 가드 |
| `web/src/view/articleDetail.js` | REQ-DETAIL-BODY-EMPHASIS | **부분 GREEN(미커밋)** | 본문 > 제목 폰트 사이즈 부분 적용 (SPEC-NEWS-REVISE-002 NFR 5.1 분석에 따름). 본 SPEC 의 AC 가드만 추가 |
| `web/src/view/articleDetail.test.js` | REQ-DETAIL-BODY-EMPHASIS | **부분 GREEN(미커밋)** | "본문 > 제목" 단언 1 건 부분 추가. 본 SPEC 의 AC-EMPH-3 (빈 제목 케이스) 보강 |
| `src/db/schema.js` | REQ-ARTICLE-LOCK-YN | **미구현(002 분담)** | SPEC-NEWS-REVISE-002 M1 에서 처리 예정. 본 SPEC 은 회귀 가드만 |
| `src/services/articleService.js` | REQ-ARTICLE-LOCK-YN, REQ-API-LIFECYCLE-RULE | **미구현(002 분담)** | SPEC-NEWS-REVISE-002 M2 에서 처리 예정 |
| `src/services/mediaSearch.js` | REQ-MEDIA-TAB-SEARCH | **GREEN — 회귀 가드만 필요** | 002 분석에서 이미 Youtube → Google 폴백 구조로 작성됨. 본 SPEC 은 EARS 잠금 + API 키 비노출 가드 |
| `web/src/controller/useWriteController.js` | REQ-WRITE-LIFECYCLE-API | **부분 — 002 M3 분담** | 신규/편집 분기 명시화 책임은 002 M3. 본 SPEC 은 *분기 오용 회귀 가드*(AC-WLC-5) 추가 |
| API 라우터 (`articleInsert/Update/Select`) | REQ-API-LIFECYCLE-RULE | **미구현 — 본 SPEC 고유 항목** | 생애주기 우회 경로 부재 단언은 002 가 다루지 않음. Run 단계에서 통합 테스트 신규 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규/수정될 영역 (회귀 가드 + 정합 단언 중심)

- `src/services/mediaSearch.js` — Youtube → Google 폴백 회귀 가드 테스트만 (구현은 GREEN 유지).
- `src/services/__tests__/mediaSearch.lifecycleGuard.test.js` (신규) — API 키 비노출 단언.
- `src/services/articleService.js` — REQ-API-LIFECYCLE-RULE 가드: `articleSelect` 가 어떤 상태 전이도 발생시키지 않음을 단언 (002 M2/M3 구현 후 본 SPEC 테스트로 검증).
- `src/services/__tests__/lifecycleRule.test.js` (신규) — articleInsert/Update/Select 의 생애주기 규칙 준수 단언 (R/D/Z × send/hold/kill 매트릭스).
- `web/src/view/articleDetail.js` — 회귀 보장 (미커밋 변경분 흡수, 본문 > 제목 폰트 관계 유지).
- `web/src/view/articleDetail.test.js` — AC-EMPH-1~4 가드 추가 (AC-EMPH-3 빈 제목 케이스가 본 SPEC 의 고유 보강).
- `web/src/view/InlineEmbed.test.jsx` — AC-EMB-DEL-1, AC-EMB-DEL-2 회귀 가드 (002 의 AC-EMB-DEL 과 정합).
- `web/src/view/editorShortcuts.test.js` (또는 동등) — AC-ALTY-1 정확 문자열 `(끝)`, AC-ALTY-2 noop 회귀 가드.
- `web/src/controller/useWriteController.test.jsx` — AC-WLC-1~5 회귀 가드 (002 의 AC-API-* 와 정합).
- `web/src/view/WritePage.test.jsx` — AC-WLC-4 제목 미입력 ALERT 회귀 가드.
- 락 통합 테스트 (`src/services/__tests__/editLockBehavior.test.js`) — AC-LOCK-1~6 회귀 가드 (002 의 AC-EDIT-LOCK-* 와 정합).

### 7.2 작업트리 미커밋 파일 (분석 대상; 본 SPEC 이 흡수)

- `news.md` (소스 of truth — 본 SPEC 트리거)
- `ContentsVO.md` (lockYN 필드 추가)
- `web/src/view/articleDetail.js` (본문 > 제목 폰트 부분 구현)
- `web/src/view/articleDetail.test.js` (본문 > 제목 단언 부분 추가)

### 7.3 본 SPEC 이 절대 수정하지 않는 파일 [HARD]

- `.moai/specs/SPEC-NEWS-REVISE-001/*.md` (3 파일)
- `.moai/specs/SPEC-NEWS-REVISE-002/*.md` (3 파일)
- 모든 코드(`web/`, `src/`, `server/`)

---

## 8. 테스트 전략 (TDD)

### 8.1 단위 테스트 (Vitest)

- 백엔드:
  - `mediaSearch`: Youtube 호출 mock + Google 폴백 mock + API 키 응답 페이로드 미포함 단언.
  - `articleService.applyAction` + `lifecycle.transition()`: R/D/Z × {send, hold, kill} × {RDS, DPS, RRH, RRK, DDH, DDK} 매트릭스 — 허용 전이 / 비허용 전이 단언.
  - `articleService` 의 `articleSelect` (또는 `findById`/`query`): 호출 후 DB 상태 무변경 단언.
  - `articleService.acquireEditLock` / `releaseEditLock` / `assertLockHolder`: 002 M2 의 단위 테스트 회귀 가드.
- 프론트엔드:
  - `useWriteController`: 신규 vs 편집 컨텍스트 분기 → 호출 모델 메서드 다름 단언 (002 AC-API-1, AC-API-2 와 정합).
  - `WritePage`: 제목 빈 입력 + 송고 클릭 → ALERT 호출 / API 미호출 단언.
  - `InlineEmbed`: 삭제 어포던스 클릭 / Backspace → 단일 노드 제거 단언 (002 AC-EMB-DEL-1 정합).
  - `editorShortcuts` (Alt+Y): 본문 끝 `(끝)` 정확 삽입 단언 + 이미 존재 시 noop 단언.
  - `articleDetail.test`: CSS 룰 파싱 → content `font-size` > title `font-size` 단언 (AC-EMPH-1), 빈 제목 케이스 (AC-EMPH-3), SPEC-NEWS-REVISE-001 회귀 단언 (AC-EMPH-4 / AC-REG-1).

### 8.2 통합 테스트

- 락 충돌 시뮬레이션: 두 세션(U1/S1/P1, U2/S2/P2) 동시 `acquireEditLock` → 한 쪽만 성공 (AC-LOCK-3).
- 동일 사용자 다른 페이지: (U1/S1/P1) 보유 후 (U1/S1/P2) 시도 → 차단 (AC-LOCK-4).
- 좀비 락 회복: `lockedAt` 가 TTL 초과 → 자동 해제 후 새 세션 획득 성공 (AC-LOCK-5).
- `articleUpdate` 자동 락 검증: 락 미보유자가 `articleUpdate` 호출 → 4xx 거부 (AC-LOCK-6 + AC-LIFE-2 교차).
- 생애주기 우회 경로 부재: 라우터 등록 목록 + grep 로 `Contents UPDATE status` 직접 SQL 부재 확인 (AC-LIFE-4).

### 8.3 회귀 가드

- `npm test --prefix web` 전체 통과 (`WritePage.test.jsx`, `useWriteController.*.test.jsx`, `editorColoring.test.js`, `editorAdapter.test.js`, `editorNewline.test.js`, `InlineEmbed.test.jsx`, `clipboardEmbed.test.js`, `articleDetail.test.js`, `articleStructure.test.js`, `App.test.jsx`, `ViewPage.test.jsx`, `ViewPage.contextMenu.test.jsx`).
- 백엔드 테스트 전체 통과 (`npm test` 또는 동등; `articleService.test.js`, `lifecycle.test.js`, `mediaSearch.test.js`, 신규 `lifecycleRule.test.js`).
- `vite build` 무경고.
- SPEC-NEWS-REVISE-001 AC 회귀 없음 (AC-CTRL-D-5 단언 문자열은 002 의 갱신에 따라 `(끝)`).
- SPEC-NEWS-REVISE-002 AC 회귀 없음 (002 AC 와 본 SPEC AC 가 정합).

---

## 9. 위험과 완화 (Risks & Mitigation — Pending Decisions 포함)

| ID | 위험 | 영향 | 완화 / 결정 필요 |
|----|------|------|----------------|
| **R1** | Youtube/Google API 키 관리 정책 미결정 (env vs 외부 vault vs secret manager) | 키 유출 시 비용 / 보안 사고 | 본 SPEC 기본값: 서버 환경변수(`YOUTUBE_API_KEY`, `GOOGLE_API_KEY`). 사용자 결정 후 잠금 (env / Doppler / AWS Secrets Manager / GCP Secret Manager 중 선택) |
| **R2** | lockYN 진입 시점 정책: 페이지 진입 즉시 vs 첫 변경 시 | 즉시 정책은 read-only 의도 사용자를 차단 / 첫 변경 정책은 race window 존재 | 본 SPEC 기본값: **페이지 진입 즉시(eager)** + 진입 거부 시 read-only 모드 안내. 사용자 결정 후 잠금 |
| **R3** | lockYN 비정상 종료 회복: heartbeat interval vs TTL based reaper | heartbeat 는 서버 부하 증가 / TTL only 는 회복 지연 | 본 SPEC 기본값: **30 분 TTL + 옵션 1 분 heartbeat** (002 Pending D2-3 와 정합). 사용자 결정 후 잠금 |
| **R4** | `articleInsert` vs `articleUpdate` 판정 메커니즘: URL 의 `id` 유무 vs explicit flag vs editArticleId 상태 | 메커니즘 불일치 시 분기 오용 | 본 SPEC 기본값: **컨트롤러 `editArticleId` 상태 + URL 의 `id` 이중 일치**. 사용자 결정 후 잠금 |
| **R5** | `(끝)` 정확 문자열과 기존 코드 `"\r\n (끝)"` 와의 마이그레이션: 기존 DB 본문 정규화 여부 | 기존 기사 본문에 구 형식이 남아 있을 경우 회귀 검사가 어려움 | 본 SPEC 기본값: **migration 없음 — 신규 Alt+Y 만 `(끝)`, 기존 본문 본문 노멀라이즈 미적용**. 사용자 결정 후 잠금 (Pending Decision R5 — DB 본문 일괄 정규화 ↔ 신규만 적용) |
| **R6** | 토픽 A 의 "Google 검색" 의미: Google Programmable Search Engine API vs 단순 스크레이핑 | 스크레이핑 시 TOS 위반 / 차단 위험 | 본 SPEC 기본값: **Google Programmable Search Engine API (Custom Search JSON API)**. 단순 스크레이핑 금지 (REQ-MEDIA-TAB-SEARCH Unwanted 단언). 사용자 결정 후 잠금 |
| **R7** | SPEC-NEWS-REVISE-001/002 의 작업 미커밋 상태에서 본 SPEC 동시 진행 시 머지 충돌 위험 | 003 Run 단계가 002 와 동일 파일(`articleDetail.js`, `useWriteController.js`, `mediaSearch.js`)을 건드릴 가능성 | 본 SPEC 은 *코드 변경 없음 — 회귀 가드 테스트만 추가*. 충돌 표면을 최소화. Run 단계에서 002 를 먼저 종결한 뒤 003 의 AC 가드를 추가하는 순서 권장 |
| **R8** | 토픽 B 의 본문 > 제목 폰트 단언이 jsdom 의 `getComputedStyle` 제한(인라인 스타일만 반영) 으로 검증 어려울 가능성 | AC-EMPH-1/2 가 false negative 가능 | 본 SPEC 기본값: **CSS 룰 텍스트 정규식 또는 인라인 style 우선 적용 + jsdom getComputedStyle 보조**. 002 AC-FONT-2 와 동일 전략 |
| **R9** | 토픽 F 의 생애주기 우회 경로 부재 단언을 어떻게 자동 검증할 것인가 (정적 grep vs 라우터 등록 목록 vs 부정 테스트) | 자동 검증 누락 시 우회 경로가 추가되어도 탐지 불가 | 본 SPEC 기본값: **부정 테스트(`Contents UPDATE status` 패턴 grep) + 라우터 등록 목록 단언**. 사용자 결정 후 잠금 |

> Risks 의 R1~R9 는 Run 단계 진입 전 사용자 결정 후 잠금. 미결 항목은 본 SPEC 기본값을 임시 적용하되, 변경 시 본 SPEC 의 EARS 단언 일부가 갱신될 수 있다.

---

## 10. 종속성 및 Cross-References (회귀 가드 명시)

- **SPEC-NEWS-REVISE-001 REQ-DETAIL-LAYOUT-SPLIT** — 본 SPEC REQ-DETAIL-BODY-EMPHASIS 가 *분리 구조를 변경하지 않고 시각 강조만 확장*. 12 공통정보 필드 / 분리 두 `<section>` / 1px 회색 구분선 / `aria-label="제목"`/`aria-label="본문"` 회귀 금지. (REQ-DETAIL-BODY-EMPHASIS Unwanted 절)
- **SPEC-NEWS-REVISE-001 REQ-EDITOR-EMBED-AND-CTRL-D** — 본 SPEC REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT 가 *임베드 삭제* 와 *Alt+Y 정확 텍스트* 만 추가. 본문 커서 위치 삽입 / 임베드 영속성 / Ctrl+D 라인 삭제 회귀 금지. (Ubiquitous 절)
- **SPEC-NEWS-REVISE-001 REQ-AUTH-Z-BUTTONS** — 본 SPEC 은 권한 규칙을 변경하지 않음 (전 REQ 회귀 가드).
- **SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN** — 본 SPEC REQ-ARTICLE-LOCK-YN 의 `lockYN` 컬럼 정의(varchar, default `'N'`, NOT NULL) 와 동일 정합. 본 SPEC 은 컬럼 추가를 *명세*하고 002 가 *구현 분담*.
- **SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK** — 본 SPEC REQ-ARTICLE-LOCK-YN 와 동일 의도. 본 SPEC 은 *1 인 1 페이지* (002 의 *1 인 1 세션* 보다 더 좁은 정책) 단언을 추가하여 002 의 EARS State-Driven 절을 강화. 002 와 충돌 없음 (002 는 페이지 ID 비교를 Pending D2-4 로 둠).
- **SPEC-NEWS-REVISE-002 REQ-API-INSERT-UPDATE-SPLIT** — 본 SPEC REQ-WRITE-LIFECYCLE-API 와 동일 의도. 본 SPEC 은 *분기 판정 기준이 권한이 아닌 컨텍스트* 임을 명시적으로 잠금 (002 의 Ubiquitous 절 보강).
- **SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS** — 본 SPEC REQ-DETAIL-BODY-EMPHASIS 와 동일 의도. 본 SPEC 은 *빈 제목 케이스* 단언(AC-EMPH-3) 을 추가하여 002 의 State-Driven 절을 강화.
- **SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER** — 본 SPEC REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT 의 Alt+Y `(끝)` 단언과 정합. 단언 문자열 동기화.
- **SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE** — 본 SPEC REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT 의 임베드 삭제 단언과 정합. markupVersion round-trip 단언 동일.
- **SPEC-NEWS-REVISE-002 REQ-SEARCH-YOUTUBE-API** — 본 SPEC REQ-MEDIA-TAB-SEARCH 와 동일 의도. 본 SPEC 은 *글기사 탭이 외부 API 미호출* 단언을 추가 (002 의 Ubiquitous 절 보강).
- **SPEC-FRONTEND-UI-001** — 60:40 레이아웃 / 4 탭 / 우측 상단 사용자 정보 변경 없음 (전 REQ 회귀 가드).
- **SPEC-UI-EDITOR-001** — 어댑터 계약 변경 없음. 임베드 삭제는 어댑터 API 호출 형태로 명세 (`adapter.removeEmbed(nodeId)` 또는 동등; 002 와 정합).
- **SPEC-BACKEND-CORE-001** — 본 SPEC REQ-WRITE-LIFECYCLE-API / REQ-API-LIFECYCLE-RULE 는 기존 API 정의를 *분기 의미* 와 *생애주기 단언* 으로만 강화. 전이표(`TRANSITIONS`) 변경 없음.
- **SPEC-DB-FOUNDATION-001** — 본 SPEC REQ-ARTICLE-LOCK-YN 는 `Contents` 테이블에 `lockYN VARCHAR` 컬럼 추가를 명세. 기존 컬럼/기본키 변경 없음, 마이그레이션은 add-only (002 분담).
- **SPEC-AUTH-001** — R/D/Z 권한 의미와 세션 메커니즘 변경 없음 (락 보유자 ID 는 세션에서 가져옴).

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- 기능 *구현* (본 SPEC 은 Plan 단계 문서만; Run 단계에서 002 마일스톤 + 본 SPEC 회귀 가드 테스트 추가).
- 수집/배부 시스템 (CLAUDE.md "현재 구현 범위는 기사 작성기만").
- 새 디자인 토큰 정의 (CSS 변수 추가 금지).
- 권한 R/D/Z 의미 변경 또는 신규 권한 도입.
- lifecycle 전이표(R/D/Z × send/hold/kill) 변경.
- 기존 SPEC AC 변경 (NEWS-REVISE-001/002, UI-EDITOR-001, FRONTEND-UI-001, BACKEND-CORE-001, DB-FOUNDATION-001, AUTH-001).
- 새 `.claude/agents` 또는 `.claude/skills` 정의.
- SPEC-NEWS-REVISE-001/002 의 `spec.md` / `plan.md` / `acceptance.md` 수정.
- 락 분산 처리 또는 외부 락 스토어(Redis/etcd) 도입.
- Youtube/Google 외 미디어 provider 신규 도입.
- 글기사 탭의 정렬/페이징 정책 변경.
- 클립보드 붙여넣기 이미지 사이즈 정책(10% × 10%) 변경.
- 상세보기 새창 상단 공통정보 12 필드 목록의 추가/삭제/순서 변경.
- Alt+Y 외 신규 키 단축키 도입 (Ctrl+D 는 SPEC-NEWS-REVISE-001 의 기존 정의 유지).
- DB 본문 일괄 정규화(기존 기사의 `"\r\n (끝)"` → `"(끝)"` 마이그레이션) — R5 의 기본값에 따라 본 SPEC 범위 제외.
- AskUserQuestion 호출 (subagent boundary).

---

## 12. Definition of Done

- [ ] 3 파일 생성 + UTF-8 (`spec.md`, `plan.md`, `acceptance.md`)
- [ ] 6 REQ 각각 EARS 4 문장 이상 보유 (Ubiquitous / Event-Driven / State-Driven / Unwanted 조합)
- [ ] [Unwanted] 절을 모든 REQ 가 포함
- [ ] Risks 섹션에 R1~R9 사람 결정 항목(Pending Decisions) 명시
- [ ] Cross-References 에 SPEC-NEWS-REVISE-001 / 002 / UI-EDITOR-001 / FRONTEND-UI-001 / BACKEND-CORE-001 / DB-FOUNDATION-001 / AUTH-001 회귀 가드 명시
- [ ] Exclusions 절이 코드 구현 / 002 spec 수정 / 새 agents/skills 정의를 명시적으로 비목표화
- [ ] DoD 체크리스트가 spec.md 말미에 존재 (본 절)
- [ ] acceptance.md 의 AC 총 개수가 EARS 4-AC-per-REQ 기준 24 개 이상 (최소 3-AC-per-REQ 보장 = 18 개 floor)
- [ ] plan.md 의 마일스톤이 time estimates 없이 priority-based (CLAUDE.md HARD)
- [ ] 본 SPEC 은 SPEC-NEWS-REVISE-001/002 의 `spec.md`/`plan.md`/`acceptance.md` 를 수정하지 않음
- [ ] 본 SPEC 은 코드(`web/`, `src/`, `server/`) 를 수정하지 않음
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙) — Run 단계 진입 시점에 수행

---

Version: 0.1.1
Status: Complete
Last Updated: 2026-06-04
