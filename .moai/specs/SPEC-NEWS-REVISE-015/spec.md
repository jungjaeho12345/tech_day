---
id: SPEC-NEWS-REVISE-015
version: 0.1.1
status: Plan
created: 2026-06-12
updated: 2026-06-12
author: manager-spec
priority: medium
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-NEWS-REVISE-003
  - SPEC-NEWS-REVISE-008
  - SPEC-NEWS-REVISE-011
  - SPEC-NEWS-REVISE-012
  - SPEC-NEWS-REVISE-014
  - SPEC-AUTH-001
  - SPEC-EDIT-LOCK-001
---

# SPEC-NEWS-REVISE-015 — news.md a8a6c87 추가분 흡수 + 기구현 characterization 고정

## HISTORY

- 2026-06-12 (v0.1.1): 평가 후 정정(evaluator-active 라운드 1 판정, PASS 0.833). **AC-DSN-2 문구 결함 정정 반영** —
  실제 코드는 조회 목록 행에 배지를 렌더하지 않으므로(`ViewPage.jsx:190-198` plain text, `yonhap.css:1054-1056`
  "목록 배지는 제거됨, `--yh-badge-*` 토큰은 버튼 팔레트가 계속 사용"), REQ-ABSORB-DESIGN 의 배지 색 요구를
  "`--yh-badge-*` 색 토큰/`.yh-badge--*` 클래스 SSOT + 조회 목록 plain text 현행 고정"으로 표기 동기화(빌더가 코드
  불변 원칙대로 작성한 `ViewPage.statusBadge.test.jsx`, PASS 와 일치). 또한 **AC 총수 표기를 35 -> 41**(acceptance.md
  실집계)로 정정. AC 추가/삭제·REQ 의미 변경 없음(문구 정정·수치 동기화만). (manager-spec)
- 2026-06-12 (v0.1.0): 최초 작성. **근거 커밋 a8a6c87**(2026-06-11, "docs(spec): maintenance.md 코드-명세 갭을
  news.md 문체로 반영 + 스킬 SSOT v0.2.1 동기화") 의 news.md 추가분(73줄)을 SPEC 으로 흡수한다. a8a6c87 은 "이미
  코드로 구현되어 있으나 news.md 에 명세가 없던 항목"을 역반영(reverse-sync)한 **문서 커밋**이므로, 추가분은
  **거의 전부 기구현(characterization)** 이다. maintenance.md(리포 루트) 전수 대장의 file:line 근거와 도메인
  SSOT(`.claude/skills/moai-domain-news-editor/SKILL.md`)로 교차 검증했다. 따라서 본 SPEC 의 REQ 대부분은
  **"코드 변경 없음, 회귀 가드 테스트만"** 이고, 잔여 갭(독립 회귀 가드 테스트가 없는 3종)만 신규 테스트 작성
  대상이다. 또한 종전 메모리에 블로커로 남아 있던 **DPS-출발 보류 결과상태 미결**은 `src/services/lifecycle.js:24-29`
  + SPEC-NEWS-REVISE-011 로 **DDH 확정**됨을 흡수 기록한다. SPEC-001~014 본문은 수정하지 않는다(참조만).
  (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-NEWS-REVISE-015 |
| 제목 | news.md a8a6c87 추가분 흡수 + 기구현 characterization 고정 + 잔여 테스트 갭 신규화 |
| 상태 | Plan |
| 생성일 | 2026-06-12 |
| 우선순위 | Medium (대부분 회귀 가드 — 신규 동작 없음) |
| 라이프사이클 | spec-anchored (구현과 함께 유지) |
| 근거 커밋 | a8a6c87 (2026-06-11) — news.md 73줄 추가/정정 |
| Source of truth | `news.md`(현행) + `maintenance.md`(file:line 전수 대장) + 도메인 SSOT(`moai-domain-news-editor/SKILL.md`) |
| 영향 페이지 | `login.do`, `writer.do`, `list.do` (전 페이지에 걸친 흡수) |
| 영향 레이어 | 흡수 명세(문서) + 회귀 가드 테스트(신설 3종) — **운영 코드 변경 없음** |
| 작업 모드 | Documentation absorption + Characterization guard (Δ-doc/Δ-test only) |
| 인코딩 | UTF-8 (CLAUDE.md HARD) |

---

## 1. 목적 (Goal)

a8a6c87(2026-06-11)은 maintenance.md 전수 대장을 만들고, 그 코드-명세 갭을 news.md 본문에 역반영했다. news.md 는
프로젝트의 source-of-truth 이지만, 이 73줄 추가분은 **어떤 SPEC(NEWS-REVISE-001~014)에도 명세로 흡수되지 않은
상태**다. 명세 흡수 없이 코드만 존재하면 다음 회귀 위험이 있다:

1. **추적성 단절** — news.md 가 요구하는 동작(예: DPS 보류→DDH, 세션 재발급, helmet/CORS)이 어느 SPEC/테스트로
   보증되는지 명세 경로가 없다.
2. **재명세 충돌** — 후속 라운드가 이미 구현된 항목을 "신규 기능"으로 오인해 중복 구현하거나, 코드와 다르게
   재명세할 수 있다.

`why`: CLAUDE.md 최상위 규칙은 "기사 작성기는 news.md 를 따른다" + "DB 내용 삭제 금지 + 안전성 우선"이다. 따라서
news.md 추가분은 **SPEC 으로 흡수해 추적 가능하게** 만들되, **이미 구현된 동작은 발명하지 말고 characterization
회귀 가드로 고정**해야 한다. 본 SPEC 은 추가분을 (a) 기구현 / (b) 부분 구현 / (c) 미구현 갭 으로 분류하여,
**(a)/(b)는 회귀 가드, (c)에 해당하는 잔여 테스트 갭만 신규 테스트**로 좁혀 정의한다.

본 SPEC 은 **운영 코드(`web/`·`src/`·`server/`)를 변경하지 않으며**, news.md 도 다시 수정하지 않는다(a8a6c87 에서
이미 반영 완료). 신규 산출물은 [테스트 공백]으로 분류된 3종의 회귀 가드 테스트뿐이다.

---

## 2. 도메인 용어 및 분류 기준 (Glossary / 분류 규약)

> 직접 검증한 근거(2026-06-12 Read): `git show a8a6c87 -- news.md`, `maintenance.md`(전수 대장),
> `src/services/lifecycle.js:9-37`(TRANSITIONS), 도메인 SSOT.

### 2.1 분류 규약

- **(a) 기구현(characterization)** — news.md 추가 주장에 대응하는 **코드 구현 + 기존 테스트**가 모두 존재.
  maintenance.md 의 file:line 근거가 있고, `test/` 또는 `web/src/**/*.test.*` 에 회귀 가드가 이미 깔림.
  → 본 SPEC 동작: **GREEN 유지 확인만**(코드·테스트 신규 작성 없음).
- **(b) 부분 구현** — 코드 구현은 있으나 **명세 표현이 코드보다 약하거나 검증이 위임**(예: 브라우저 위임).
  → 본 SPEC 동작: 한계를 명세에 명시 + 가능한 범위의 회귀 가드.
- **(c) 미구현 갭 / 테스트 공백** — 본 리포 분석상 a8a6c87 추가분에 **코드 자체가 없는 순수 미구현**은
  발견되지 않았다. 다만 **코드 구현은 있으나 독립 회귀 가드 테스트가 없는** 항목이 3종 있다(상태 배지 색, 사용자
  정보 표시 형식, SSE 재연결 배선). 이것이 본 SPEC 의 **유일한 신규 작성 대상(테스트만)** 이며, 다음 produce
  라운드가 가져갈 잔여 갭이다.

### 2.2 핵심 검증 사실

- **DPS-출발 전이 확정**: `lifecycle.js:24-29` 에 `DPS|R/D/Z|send→DPS`(재송고 유지), `DPS|R/D/Z|hold→DDH` 가
  구현되어 있고 `DPS|*|kill` 은 전이표에 없어 거부된다. 즉 종전 메모리의 "DPS 보류 결과상태 미결"은 **DDH 로
  확정**(news.md a8a6c87 + SPEC-011 정합)이며 더는 블로커가 아니다.
- **DDH-출발 전이**: `lifecycle.js:33-36` `DDH|D/Z|send→DPS`, `DDH|D/Z|kill→DDK`. DDH 에서 R 권한 거부.
- **화이트리스트 거부**: `lifecycle.js:49-55` 전이표에 없는 모든 (상태|권한|액션) 조합 거부.
- **테스트 인프라 사실**: 백엔드 22개 `test/*.test.js`, 프론트 30+개 `web/src/**/*.test.*` 가 이미 존재하여
  기구현 항목의 회귀 가드 대부분이 깔려 있다(예: `lifecycleDps`, `deptMultiSelect`, `forceUnlock`, `columnConfig`,
  `articleDetail`, `sessionService`, `userSoftDelete`, `mediaSearch`).

---

## 3. 범위 (Scope)

### 3.1 포함 (In Scope)

- a8a6c87 의 news.md 추가분 12 카테고리(+ API 라우트 9종, 생애주기 확장, DB 컬럼/마이그레이션, 보안 절)를 SPEC
  으로 **흡수**하고, 각 항목을 (a)/(b)/(c)로 분류해 REQ 화한다.
- (a)/(b) 항목: 기존 테스트 **GREEN 유지(회귀 가드)** 확인 — 코드 변경 없음.
- (c)에 해당하는 [테스트 공백] 3종: **회귀 가드 테스트 신규 작성**(운영 코드 무변경).
- 메모리상 미결이던 DPS-출발 보류 결과상태(DDH 확정) 흡수 기록.

### 3.2 핵심 설계 결정 — 흡수는 구현이 아니다

- **운영 코드 0줄**: a8a6c87 은 문서 커밋이다. 본 SPEC/Run 은 `web/`·`src/`·`server/` 운영 코드를 수정하지 않는다.
- **소유 SPEC 존중**: 흡수 항목 중 다수는 이미 다른 SPEC 이 소유한다(잠금=002/003/EDIT-LOCK-001, Lock해제=012/014,
  생애주기=001/008/011, 인증=AUTH-001). 본 SPEC 은 그들의 동작을 **재정의하지 않고** news.md 정합 회귀 가드만
  추가한다. 타 SPEC 의 3파일은 수정하지 않는다.
- **테스트 공백만 신설**: 코드 구현은 있으나 독립 회귀 가드가 없는 3종만 테스트를 만든다. 신설 테스트가 현
  동작과 어긋나면(RED) 테스트를 동작에 맞게 고친다(코드 불변 — characterization-first).

### 3.3 제외 (Out of Scope) — §9 Exclusions 참조

---

## 4. 사용자/시스템 시나리오 (Scenarios)

### 4.1 흡수 — 기구현 회귀 가드 (대표)
- 개발자가 `npm test` + `npm run test:web` 를 실행하면, news.md 추가분(생애주기/잠금/세션/보안/조회/에디터/상세)
  에 대응하는 기존 테스트가 전부 GREEN 이다 → 추가분이 코드와 정합하며 회귀하지 않았음이 보증된다.

### 4.2 테스트 공백 신설 — 상태 배지 색
- 조회 목록에 RDS/DPS/DDH/RRH/RRK/DDK 행이 있을 때, 신설 테스트가 각 배지 색(회색/레드/앰버/앰버/슬레이트/슬레이트)
  매핑을 단언한다 → 디자인 색 규칙이 회귀하면 즉시 FAIL.

### 4.3 테스트 공백 신설 — 사용자 정보 형식
- 로그인 사용자 정보가 우측 상단에 '유저아이디 · 부서 · (권한)' 형식으로 렌더되는지 신설 테스트가 단언한다.

### 4.4 테스트 공백 신설 — SSE 재연결 배선(위임 한계)
- 조회 모델이 EventSource 를 채택하고 open/error 핸들러로 연결 상태를 추적함을 단언한다. 재연결 동작 자체는
  브라우저 위임이므로 직접 단언하지 않고 한계를 주석화한다.

### 4.5 DPS 보류 결과상태 — 흡수 기록
- DPS 기사를 고침/포털고침으로 연 작성 페이지에서 보류하면 DDH 가 됨이 `lifecycle.js`/`lifecycleDps.test.js` 로
  이미 보증된다 → 본 SPEC 은 이 확정 사실을 명세로 흡수(신규 결정 아님).

---

## 5. 요구사항 (Requirements — EARS)

> 각 REQ 의 AC 는 acceptance.md 에 Given-When-Then 으로 상술된다. 백엔드 `test/*.test.js`(`npm test`), 프론트
> `web/src/**/*.test.*`(`npm run test:web`). **분류 머리표**: [기구현] = 코드·기존 테스트 존재, GREEN 유지 /
> [테스트 공백] = 코드 있음·테스트 신설.
>
> **AC 총수: 41** (acceptance.md §1~§16 실집계, §17 SSOT 일치). [기구현/회귀가드] 38 + [테스트 공백/신설] 3
> (AC-DSN-2 / AC-UI-1 / AC-VW-2).

### REQ-ABSORB-DESIGN — 디자인 블루 기조 정정 흡수 (Priority: Low) — 분류 (a) 기구현 + (c) 테스트 공백

- **[Ubiquitous]** THE 시스템 SHALL 헤더 강조선·활성 탭·주요 버튼에 브랜드 블루(`--yh-blue #0A4DA6`)를 사용하고
  레드(#C8102E)는 포인트(로고 룰·송고 배지)로만 사용한다(코드 이미 블루 — news.md 정정 정합, 코드 변경 없음).
- **[Ubiquitous]** THE 시스템 SHALL 상태 배지 색 규칙을 디자인 토큰 `--yh-badge-*`(RDS=회색, 송고 *PS=레드,
  보류 RRH/DDH=앰버, KILL RRK/DDK=슬레이트)와 `.yh-badge--*` 클래스 바인딩(색 규칙의 단일 출처)으로 유지한다.
  단, **조회 목록 행에는 상태 배지가 없다** — 목록 상태 셀은 plain text 로 렌더한다(목록 배지는 REQ-FE-VIEW-011
  v0.4.0 에서 제거됨; `--yh-badge-*` 토큰은 버튼 팔레트가 계속 사용). 코드 존재 — **독립 회귀 가드 테스트 신설**.
- AC 포인터: AC-DSN-1 (블루 회귀가드), AC-DSN-2 (색 토큰/클래스 SSOT 단언 + 목록 plain text 고정) — acceptance.md §1

### REQ-ABSORB-ROUTING — SPA 라우팅(.do)·writer.do 오타 흡수 (Priority: Low) — 분류 (a) 기구현

- **[Ubiquitous]** THE 시스템 SHALL 작성 페이지 경로를 `writer.do`(오타 `wirter.do` 아님)로 매핑한다.
- **[Event-Driven]** WHEN 정의된 .do 경로/popstate/미정의 경로 진입이 발생하면, THE 시스템 SHALL 각각 해당 뷰
  렌더 / URL 재동기화 / 로그인 폴백으로 처리한다(history API SPA — 코드·테스트 존재).
- AC 포인터: AC-RT-1, AC-RT-2 — acceptance.md §2

### REQ-ABSORB-COMMON — 공통 조건(미디어 프록시·멀티탭) 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Event-Driven]** WHEN 이미지/영상 검색을 호출하면, THE 시스템 SHALL 서버 프록시 API 로 호출하고(API 키는
  서버 환경변수), 상류 실패 시 오류 대신 빈 결과를 반환한다.
- **[Ubiquitous]** THE 시스템 SHALL 탭 목록·탭별 작성 내용을 sessionStorage 로 유지하고, 탭 전환 시 주소창과
  브라우저 탭 제목을 활성 탭에 맞게 갱신한다.
- **[Event-Driven]** WHEN 다른 창에서 편집 중인 기사의 잠금이 강제 해제되면, THE 시스템 SHALL 그 편집 탭을
  자동으로 닫는다(소유: SPEC-NEWS-REVISE-014 — 본 REQ 는 흡수·회귀 가드만).
- AC 포인터: AC-CMN-1~4 — acceptance.md §3

### REQ-ABSORB-VIEW — 조회페이지 세부 흡수 (Priority: Medium) — 분류 (a) 기구현 + (b) SSE 재연결

- **[Event-Driven]** WHEN 기사 생성/수정/상태변경/잠금변경 SSE 이벤트를 수신하면, THE 시스템 SHALL 목록을
  갱신한다(EventSource).
- **[State-Driven]** WHILE SSE 연결이 끊긴 동안, THE 시스템 SHALL 브라우저 EventSource 의 자동 재연결에 의존한다
  (우리 코드는 폴링/타이머를 쓰지 않음 — **재연결 자체는 위임, 배선만 회귀 가드 신설**).
- **[Optional]** WHERE 부서 멀티셀렉트가 제공되는 곳에서, THE 시스템 SHALL '전체' 토글 + 체크박스 다중 선택으로
  여러 부서를 한 번에 조회한다.
- **[Ubiquitous]** THE 시스템 SHALL 우클릭 메뉴의 미구현 항목(이력보기/송고이력보기/번역/매핑/후속기사작성/
  계속기사작성/삭제요청/재송)을 비활성 스텁으로 표시한다.
- **[State-Driven]** IF 행이 LockYN='Y' 이면, THEN THE 시스템 SHALL 우클릭 메뉴에 Lock해제를 노출하고 D/Z 만
  활성·R 비활성으로 둔다(소유: SPEC-012/014 — 흡수·회귀 가드만).
- **[Event-Driven]** WHEN 목록 헤더를 우클릭하면, THE 시스템 SHALL 컬럼 표시/숨김·간격 설정 모달을 열고 설정을
  메뉴별로 저장한다.
- **[Ubiquitous]** THE 시스템 SHALL 작성/수정시간 컬럼을 YYYY-MM-DD HH:mm 형식으로 가운데 정렬해 표시한다.
- AC 포인터: AC-VW-1~7 — acceptance.md §4

### REQ-ABSORB-DETAIL — 상세보기 새창 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Event-Driven]** WHEN 상세보기를 열면, THE 시스템 SHALL 720×800 새창을 열고 창 제목을 기사 제목(빈 제목이면
  '(제목 없음)')으로 설정한다.
- **[Ubiquitous]** THE 시스템 SHALL 공통정보의 빈 필드를 '—'로 표시한다.
- **[Ubiquitous]** THE 시스템 SHALL 본문을 저장된 블록(텍스트/임베드) 순서대로 렌더하며, 모든 출력을 HTML
  이스케이프하여 스크립트가 실행되지 않게 한다.
- AC 포인터: AC-DT-1~3 — acceptance.md §5

### REQ-ABSORB-USERINFO — 사용자 정보 표시 형식 흡수 (Priority: Low) — 분류 (c) 테스트 공백

- **[Ubiquitous]** THE 시스템 SHALL 우측 상단 사용자 정보를 '유저아이디 · 부서 · (권한)' 형식으로 표시한다
  (코드 존재 — **독립 회귀 가드 테스트 신설**).
- AC 포인터: AC-UI-1 — acceptance.md §6

### REQ-ABSORB-SESSION — 세션 정책 보안 세부 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Ubiquitous]** THE 시스템 SHALL 세션 아이디를 권한 정보를 담지 않는 무작위 토큰으로 발급한다.
- **[Event-Driven]** WHEN 로그인에 성공하면, THE 시스템 SHALL 기존 세션을 무효화하고 새 세션 아이디를 발급한다.
- **[Ubiquitous]** THE 시스템 SHALL 인증된 모든 요청마다 세션 만료 시점을 갱신한다(sliding).
- **[State-Driven]** WHILE 세션 복원이 끝나지 않은 동안, THE 시스템 SHALL 로그인 페이지로 리다이렉트하지
  아니한다(sessionStorage 복원 + restoreSettled 게이트).
- AC 포인터: AC-SES-1~3 — acceptance.md §7

### REQ-ABSORB-LOCK — 편집 잠금(lockYN) 절 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Event-Driven]** WHEN 기사 편집을 시작하면, THE 시스템 SHALL lockYN='Y' 로 잠그고 잠근 사용자·세션·시각으로
  식별한다.
- **[Ubiquitous]** THE 시스템 SHALL 한 기사 편집을 한 페이지 한 세션으로 한정한다(동일 사용자라도 다른 세션 차단).
- **[State-Driven]** IF 잠금 후 30분 동안 갱신이 없으면, THEN THE 시스템 SHALL 그 잠금을 만료로 보고 다음 시도자가
  승계할 수 있게 한다.
- **[Unwanted]** THE 시스템 SHALL NOT 잠금 획득 실패 시 보유자 정보를 노출하지 아니한다.
- **[Event-Driven]** WHEN 브라우저(탭)가 닫히면, THE 시스템 SHALL 해제 요청으로 잠금을 해제한다.
- **[State-Driven]** IF 강제 해제(Lock해제) 요청이면, THEN THE 시스템 SHALL 권한 D/Z 만 허용한다(R 403).
- AC 포인터: AC-LK-1, AC-LK-2 — acceptance.md §8 (소유: SPEC-002/003/EDIT-LOCK-001/012/014)

### REQ-ABSORB-LOGIN — 로그인 워크플로우 보안 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[State-Driven]** IF 같은 IP 에서 15분 동안 로그인 시도가 10회를 초과하면, THEN THE 시스템 SHALL 추가 시도를
  제한한다.
- **[Ubiquitous]** THE 시스템 SHALL 비밀번호를 해시로 저장하고 어떤 응답에도 비밀번호를 포함하지 아니한다.
- **[Unwanted]** IF 사용자가 active='N'(비활성)이면, THEN THE 시스템 SHALL 로그인을 거부한다.
- **[Ubiquitous]** THE 시스템 SHALL 로그인 실패 시 원인과 무관하게 같은 시간이 걸리도록 처리한다(timing 방어).
- **[Ubiquitous]** THE 시스템 SHALL 아이디/암호 입력칸에 '아이디를 입력하세요'/'암호를 입력하세요' 안내 문구를
  표시한다.
- AC 포인터: AC-LG-1~3 — acceptance.md §9

### REQ-ABSORB-WRITE — 기사작성 워크플로우 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[State-Driven]** IF 편집 중 기사 저장(수정) 요청이면, THEN THE 시스템 SHALL 편집 잠금을 보유한 세션만
  허용한다(PUT /api/articles/:id — 소유: SPEC-002).
- AC 포인터: AC-WR-1 — acceptance.md §10

### REQ-ABSORB-SP — 기사 아이디 SP 흡수 (Priority: Low) — 분류 (a) 기구현

- **[Unwanted]** IF 생성된 기사 아이디('AKR'+YYYYMMDD+난수9)가 이미 존재하면, THEN THE 시스템 SHALL 난수 부분을
  다시 생성하여 중복되지 않게 한다.
- AC 포인터: AC-SP-1 — acceptance.md §11

### REQ-ABSORB-EDITOR — 기사 에디터 규칙 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Event-Driven]** WHEN Backspace/Delete/Ctrl+D 로 라인을 삭제하면, THE 시스템 SHALL 그 라인의 임베드를 한 번에
  한 개씩 동반 삭제하고, 각 임베드에 × 삭제 버튼을 제공한다.
- **[Ubiquitous]** THE 시스템 SHALL 본문을 블록 구조(markupVersion)로 저장하여 편집-저장-불러오기 round-trip 에서
  블록 순서를 보존하고, 레거시 plain-text 본문도 호환 처리한다.
- **[Unwanted]** WHILE 한글 IME 조합 중에는, THE 시스템 SHALL 색상 repaint 를 수행하지 아니하고(조합 완료/포커스
  이탈/기사 불러오기 시점에만 적용), 조합을 깨뜨리지 아니한다.
- AC 포인터: AC-ED-1~3 — acceptance.md §12

### REQ-ABSORB-API — API 라우트 9종 명세 흡수 (Priority: Low) — 분류 (a) 기구현

- **[Ubiquitous]** THE 시스템 SHALL news.md API 명세서에 추가된 라우트(/api/health, /login, /logout, /session,
  /articles/search, /articles/:id/action, PUT /articles/:id, /articles/:id/lock·unlock·force-unlock,
  /media/search, /stream)를 제공한다(라우트 존재·명세 정합 회귀 가드 — 동작은 각 도메인 SPEC 소유).
- AC 포인터: AC-API-1 — acceptance.md §13

### REQ-ABSORB-LIFECYCLE — 생애주기 확장 전이 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[State-Driven]** IF (상태=RDS, 권한=Z, 액션∈{송고/보류/KILL}) 이면, THEN THE 시스템 SHALL D 와 동일하게
  전이한다(송고→DPS, 보류→DDH, KILL→DDK).
- **[State-Driven]** IF (상태=DPS, 액션=송고) 이면, THEN THE 시스템 SHALL DPS 를 유지한다(재송고); IF
  (상태=DPS, 액션=보류) 이면, THEN THE 시스템 SHALL **DDH** 로 전이한다.
- **[Unwanted]** IF (상태=DPS, 액션=KILL) 이면, THEN THE 시스템 SHALL 거부한다(전이표 부재 — 보류 후 KILL 경로만).
- **[State-Driven]** IF (상태=DDH, 권한∈{D,Z}, 액션=송고/KILL) 이면, THEN THE 시스템 SHALL DPS/DDK 로 전이한다;
  IF (상태=DDH, 권한=R) 이면, THEN THE 시스템 SHALL 모든 액션을 거부한다.
- **[Unwanted]** THE 시스템 SHALL 전이표에 정의되지 않은 모든 (상태|권한|액션) 조합을 거부한다(화이트리스트).
- AC 포인터: AC-LC-1~3 — acceptance.md §14 (소유: SPEC-001/008/011 — DPS 보류=DDH 확정 흡수 기록)

### REQ-ABSORB-DB — DB 컬럼·마이그레이션 명세 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Ubiquitous]** THE 시스템 SHALL Contents 에 편집 잠금 컬럼(lockYN + 잠근 사용자/세션/시각)과 공통정보 8컬럼을,
  User 에 active 컬럼을 둔다.
- **[Ubiquitous]** THE 시스템 SHALL 스키마 변경을 기존 데이터 삭제 없이 컬럼 추가(멱등 마이그레이션)로만 적용하고,
  레거시 대소문자 컬럼/빈 부서 값을 자동 보정한다.
- **[Event-Driven]** WHEN 기사 저장 시 부서가 비어 있으면, THE 시스템 SHALL 로그인 사용자의 부서를 자동 입력한다.
- **[Optional]** WHERE 조회 필터가 사용되는 곳에서, THE 시스템 SHALL 부서 다중 선택과 특정 상태 제외(statusNot)를
  지원한다.
- **[Ubiquitous]** THE 시스템 SHALL Article 테이블과 Contents 테이블을 함께 수정할 때 트랜잭션으로 처리한다.
- AC 포인터: AC-DB-1~3 — acceptance.md §15

### REQ-ABSORB-SECURITY — 보안 절 신설 흡수 (Priority: Medium) — 분류 (a) 기구현

- **[Ubiquitous]** THE 시스템 SHALL 보안 헤더(CSP 등)를 적용하고 오류 응답에 내부 스택 정보를 노출하지 아니한다.
- **[Ubiquitous]** THE 시스템 SHALL CORS 를 개발 클라이언트(localhost/127.0.0.1:5173)만 허용한다.
- **[State-Driven]** IF 사용자 생성/수정/삭제 요청이면, THEN THE 시스템 SHALL 권한 Z 만 허용한다.
- **[Unwanted]** IF 정의되지 않은 권한(R/D/Z 외)의 요청이면, THEN THE 시스템 SHALL 거부한다.
- AC 포인터: AC-SEC-1, AC-SEC-2 — acceptance.md §16

---

## 6. 비기능 요건 (Non-Functional Requirements)

### 6.1 추적성 / 정합성
- 모든 흡수 REQ 는 maintenance.md file:line 근거 또는 도메인 SSOT 에 정합한다. 라인 번호(L##)는 drift 가능하므로
  파일 근거를 우선 인용한다. 라인을 확정 인용한 항목은 본 SPEC 작성 시 직접 Read 로 검증한 `lifecycle.js` 뿐이다.

### 6.2 안전성 / 데이터 무결성
- 본 SPEC/Run 은 DB 스키마/내용을 변경·삭제하지 않는다(CLAUDE.md HARD). 흡수 항목 중 DB 관련 동작은 모두 기존
  멱등 마이그레이션(컬럼 추가)으로 한정된다.

### 6.3 테스트 결정성
- 시간 의존 회귀 가드(articleId 충돌 재생성, lock 30분 stale)는 now/시각을 명시 주입한다(시한폭탄 회피).
- SSE 재연결 테스트는 EventSource 위임 한계를 주석화하고 배선만 단언한다(실시간 대기/타이머 금지).

### 6.4 인코딩
- 모든 문서/테스트는 UTF-8 (CLAUDE.md HARD).

### 6.5 회귀 방지
- SPEC-NEWS-REVISE-001/002/003/008/011/012/014, SPEC-AUTH-001, SPEC-EDIT-LOCK-001 의 기존 계약을 회귀 없이
  유지한다(본 SPEC 은 그들의 동작을 재정의하지 않음).

---

## 7. 영향 영역 (Affected Files)

> **운영 코드는 변경하지 않는다.** 아래 운영 파일은 **참조/회귀 대상**일 뿐 수정 대상이 아니다.

### 7.1 신규 작성 (테스트만)
- `web/src/view/ViewPage.statusBadge.test.jsx` — `--yh-badge-*` 색 토큰/`.yh-badge--*` 클래스 매핑 단언 + 조회
  목록 상태 셀 plain text(목록 배지 제거) 현행 고정(AC-DSN-2).
- `web/src/view/TopBar.test.jsx` — 사용자 정보 '유저아이디 · 부서 · (권한)' 형식(AC-UI-1).
- `web/src/model/httpModel.reconnect.test.js`(또는 기존 `httpModel.test.js` 확장) — EventSource 배선·연결 상태
  추적(AC-VW-2, 재연결 위임 한계 주석).

### 7.2 회귀 대상 (변경 없음 — GREEN 유지 확인)
- 백엔드: `src/services/lifecycle.js`, `src/services/articleService.js`, `src/services/sessionService.js`,
  `src/services/userService.js`, `src/services/articleId.js`, `src/services/mediaSearch.js`,
  `src/services/authorization.js`, `src/db/schema.js`, `src/models/articleModel.js`, `server/index.js`.
- 프론트: `web/src/view/ViewPage.jsx`, `web/src/view/WriteWorkspace.jsx`, `web/src/view/WritePage.jsx`,
  `web/src/view/articleDetail.js`, `web/src/view/editorShortcuts.js`, `web/src/view/editorColoring.js`,
  `web/src/view/columnConfig.js`, `web/src/view/LoginPage.jsx`, `web/src/view/TopBar.jsx`,
  `web/src/model/httpModel.js`, `web/src/model/editorContent.js`, `web/src/app/App.jsx`,
  `web/src/app/routing.js`, `web/src/styles/yonhap.css`.
- 기존 테스트: `test/*.test.js`(22개), `web/src/**/*.test.*`(30+개) — 전부 GREEN 유지.

---

## 8. 종속성 및 Cross-References

> 아래 SPEC 들은 **참조 전용** — 본 SPEC 은 이들의 3파일을 수정하지 않는다.

- **SPEC-NEWS-REVISE-001**: Z 버튼, IME 색상, 인라인 임베딩 — REQ-ABSORB-EDITOR/LIFECYCLE 가 정합 회귀 가드.
- **SPEC-NEWS-REVISE-002/003 / SPEC-EDIT-LOCK-001**: 편집 잠금 의미론 — REQ-ABSORB-LOCK/WRITE 흡수.
- **SPEC-NEWS-REVISE-008**: SSE 재조회 + DDH 생애주기 — REQ-ABSORB-VIEW/LIFECYCLE 흡수.
- **SPEC-NEWS-REVISE-011**: DPS-출발 전이(송고→DPS/보류→DDH) — REQ-ABSORB-LIFECYCLE 가 DDH 확정 흡수 기록.
- **SPEC-NEWS-REVISE-012/014**: Lock해제 메뉴/확인창/자동 종료 — REQ-ABSORB-COMMON/VIEW 흡수(소유는 012/014).
- **SPEC-AUTH-001**: R/D/Z 권한 + User.active — REQ-ABSORB-LOGIN/SECURITY/DB 흡수.

---

## 9. Exclusions (What NOT to Build) — 명시적 비목표

- **[HARD] 운영 코드 변경** — `web/`·`src/`·`server/` 운영 코드를 변경하지 않는다(a8a6c87 은 문서 커밋, 동작은
  이미 구현됨). 신규 산출물은 [테스트 공백] 3종의 회귀 가드 테스트뿐이다.
- **흡수 항목의 신규 동작 발명** — 생애주기/잠금/세션/보안/조회/에디터 등은 이미 구현됨. 새 동작·새 상태·새
  라우트를 만들지 않는다(회귀 가드만).
- **DPS 보류 결과상태 임의 변경** — DDH 로 이미 확정(lifecycle.js + SPEC-011). 다른 상태로 재정의 금지.
- **news.md 수정** — a8a6c87 에서 반영 완료. 본 SPEC/Run 은 news.md 를 다시 수정하지 않는다.
- **기존 SPEC-NEWS-REVISE-001~014 본문 수정** — 참조만 한다(supersede 필요 시 마커 언급만, 본문 미수정).
- **타 SPEC 의 3파일(spec/plan/acceptance) 수정** — 참조만 한다.
- **DB 스키마 변경 / DB 내용 삭제** — 컬럼 추가·변경·행 삭제 없음(CLAUDE.md HARD). news.db 미변경.
- **SSE 재연결 로직 신규 구현** — 브라우저 EventSource 위임 유지. 폴링/타이머/커스텀 재연결 루프 도입 금지.
- **신규 디자인 토큰/모달/CSS 변수** — 기존 yonhap.css 토큰만. 배지 색은 회귀 가드 테스트만 추가.
- **수집/배부 시스템** — 기사 작성기 범위만(CLAUDE.md).
- **코드 구현(운영)** — 본 SPEC 은 Plan 단계 문서. Run 단계는 회귀 가드 테스트만 작성/실행.

---

## 10. Definition of Done

- [ ] §5 의 [기구현] REQ 가 모두 기존 테스트 GREEN 유지로 확인됨(운영 코드 변경 0줄)
- [ ] [테스트 공백] 3종(AC-DSN-2 배지 색, AC-UI-1 사용자 정보, AC-VW-2 SSE 배선) 회귀 가드 테스트 GREEN
- [ ] DPS-출발 보류 결과상태 DDH 확정 흡수 기록(AC-LC-2) — 메모리 미결 항목 해소 반영
- [ ] `npm test`(backend node --test) 전체 GREEN, coverage ≥85%(per-commit ≥80%)
- [ ] `npm run test:web`(vitest) 전체 GREEN
- [ ] `npm run build`(vite) 무경고, `npm run lint`(eslint) 무경고
- [ ] 시간 의존 테스트는 now/시각 명시 주입(시한폭탄 회피)
- [ ] TRUST 5 게이트(Tested / Readable / Unified / Secured / Trackable) 통과
- [ ] spec.md / plan.md / acceptance.md frontmatter version·status 일치(0.1.0 / Plan)
- [ ] news.md 미변경 확인(a8a6c87 에서 이미 반영 완료)
- [ ] 기존 SPEC-NEWS-REVISE-001~014 본문 미수정, 타 SPEC 3파일 미수정
- [ ] DB 파일(news.db) 미변경
- [ ] Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD; 토큰 미설정 시 로컬 로그 폴백 — "전송됨" 단정 금지)

---

Version: 0.1.1
Status: Plan
Last Updated: 2026-06-12
