---
id: SPEC-HARNESS-NEWS-001
version: 0.1.0
status: Plan
created: 2026-06-03
updated: 2026-06-03
author: manager-spec
priority: high
issue_number: 0
related_specs:
  - SPEC-NEWS-REVISE-001
  - SPEC-NEWS-REVISE-002
  - SPEC-UI-EDITOR-001
  - SPEC-FRONTEND-UI-001
  - SPEC-AUTH-001
---

# SPEC-HARNESS-NEWS-001 — 기사 작성기 하네스 (slash /news + skills 2종 + evaluator 계약)

## HISTORY

- 2026-06-03 (v0.1.0): 최초 작성. **하네스 SPEC**(기능 SPEC 아님). 기존 MoAI 에이전트(manager-spec / expert-frontend / evaluator-active / manager-git / manager-docs)를 news 도메인 전용 닫힌 루프 제작 파이프라인으로 묶는 슬래시 명령(`/news`)·스킬 2종·평가 기준을 EARS로 고정한다. 6개 REQ로 구성: CMD(슬래시 표면), SKILL-DOMAIN(도메인 지식 스킬), SKILL-WORKFLOW(오케스트레이션 스킬), PIPELINE(단계별 계약), EVAL(evaluator-active PASS 기준), SLACK(tech-day 채널 알림). (manager-spec)

---

## 메타데이터 (Metadata)

| 항목 | 값 |
|------|---|
| SPEC ID | SPEC-HARNESS-NEWS-001 |
| 제목 | 기사 작성기 하네스 (slash `/news` + skills 2종 + evaluator 계약) |
| 상태 | Plan |
| 생성일 | 2026-06-03 |
| 라이프사이클 | spec-anchored (하네스가 진화하는 만큼 함께 갱신) |
| 분류 | **하네스 SPEC** (Engineering of the engineering — 기능 SPEC들을 호출/검증) |
| 관련 SPEC | SPEC-NEWS-REVISE-001/002 (검증 대상 기능 SPEC), SPEC-UI-EDITOR-001, SPEC-FRONTEND-UI-001, SPEC-AUTH-001 |
| 영향 영역 | `.claude/commands/news/`, `.claude/skills/moai-domain-news-editor/`, `.claude/skills/moai-workflow-news-production/`, `.moai/sprints/`, Slack `C0B69CG59UM` |
| 개발 방법론 | TDD (`.moai/config/sections/quality.yaml` 기준) — 단, 본 SPEC의 구현 대상은 스킬/명령 파일이므로 RED는 "파일 존재/패턴 grep/LOC 카운트" 형태 |
| 작업 모드 | Greenfield (신규 하네스 도입) |

---

## 1. 목적 (Goal)

기사 작성기(`news.md` source-of-truth)을 대상으로, **사람 개입 없이 SPEC → 구현 → 평가 → 반복 → Slack 보고**의 닫힌 루프를 구동하는 *하네스 엔지니어링*을 정식 명세화한다.

본 SPEC이 도입하는 것:

1. **슬래시 명령 표면 `/news`** — `/news produce`, `/news plan`, `/news verify` 3종 하위 명령. 각 `.md`는 thin command 패턴(under 20 LOC, frontmatter + 단일 `Use Skill(...)` 라인) 강제.
2. **스킬 `moai-domain-news-editor`** — 도메인 지식(기사 생애주기 RDS/DPS/RRH/RRK/DDH/DDK · R/D/Z 권한 · 12 공통정보 필드 · 에디터 단축키 Alt+Y/Ctrl+D · 인라인 임베딩 의미 · 디자인 토큰)을 모든 도메인 에이전트가 동일하게 참조할 수 있도록 캡슐화.
3. **스킬 `moai-workflow-news-production`** — 오케스트레이션(`/news`의 Intent Router, 단계별 위임 순서, GAN 루프 종료 조건, Slack 보고)을 캡슐화.
4. **evaluator-active PASS 계약** — Jest 통과 + 대상 SPEC의 AC 충족 + lint/build 무경고 (must-pass, design constitution Section 12 Mechanism 3 차용 — 합산 평균 금지).
5. **Slack tech-day 보고** — `/news produce` 파이프라인이 PASS/FAIL/timeout 모두에서 채널 `C0B69CG59UM`로 결과 메시지 전송.

`why`: CLAUDE.md는 "각 작업이 끝날 때마다 Slack의 tech-day 채널로 내용 전달"을 명령한다. 또한 `news.md`가 source-of-truth이지만 그 변경이 코드/테스트에 반영되었는지는 사람이 매번 확인해야 했다. 본 하네스는 그 검증을 *재현 가능한 슬래시 명령*으로 고정해, 향후 모든 `news.md` 개정 → SPEC-NEWS-REVISE-NNN 신설 → `/news produce SPEC-NEWS-REVISE-NNN` 한 줄로 PASS/FAIL 판정 + Slack 보고가 자동 수행되도록 한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- `.claude/commands/news/produce.md`, `plan.md`, `verify.md` 3개의 thin wrapper 슬래시 명령 정의 (인터페이스 명세만; 구현은 후속 단계).
- `.claude/skills/moai-domain-news-editor/SKILL.md` 정의 (인터페이스 + 도메인 지식 표).
- `.claude/skills/moai-workflow-news-production/SKILL.md` 정의 (Intent Router · Pipeline · GAN 루프 종료 · Slack 보고).
- evaluator-active가 본 하네스에서 사용할 PASS 기준 (Jest 통과 + AC 충족 + build 무경고).
- 단계별 입력/출력 계약 (SPEC-ID, 변경 파일 목록, 점수 카드).
- Slack 알림 포맷 (한국어, 채널 `C0B69CG59UM`).
- 기존 SPEC-NEWS-REVISE-001/002의 AC 회귀 비파괴 보장.

### 2.2 제외 (Out of Scope) — Exclusions

- **`web/` 코드 변경** — web/ 변경은 SPEC-NEWS-REVISE-001/002 등 기능 SPEC 소관이며 본 하네스 SPEC은 그것들을 *호출/검증*만 한다.
- **실제 기사 콘텐츠 생성** — 제작은 사람+에디터의 책임. 하네스는 도구 품질 보증만 담당.
- **수집/배부 시스템** — 현재 단계 제외 (CLAUDE.md 명시).
- **DB 스키마/데이터 변경** — CLAUDE.md "DB에 있는 내용은 삭제하지 않는다".
- **새 `.claude/agents/` 정의** — 본 SPEC은 기존 에이전트(manager-spec, expert-frontend, evaluator-active, manager-git, manager-docs)만 재사용한다.
- **새 CSS 디자인 토큰 정의** — 기존 `--yh-blue` `#0A4DA6` 계열 그대로 사용.
- **본 SPEC 본문 외의 `.claude/skills/` 또는 `.claude/commands/` 신규/수정** — 본 SPEC은 그 *명세*만 정의하며 실제 스킬/명령 파일 작성은 plan.md의 단계 2~4에서 수행한다.
- **코드 구현** — 본 SPEC은 Plan 단계 문서.

---

## 3. 사용자 시나리오 (User Scenarios)

### 3.1 시나리오 A — news.md 개정 후 빠른 검증

- 작성자가 `news.md`를 개정한다 (예: 에디터 단축키 추가).
- MoAI 오케스트레이터에게 `/news plan "에디터 Ctrl+Shift+Z 실행취소 단축키 추가"` 호출.
- → `moai-workflow-news-production` 스킬이 `manager-spec`을 호출해 신규 SPEC-NEWS-REVISE-NNN을 생성한다.
- 작성자가 `/news produce SPEC-NEWS-REVISE-NNN` 호출.
- → 파이프라인이 `expert-frontend` 구현 → `evaluator-active` 평가 → 점수 < 0.75면 GAN 루프 반복.
- → 최종 PASS 또는 max_iterations 도달 시 Slack `tech-day` 채널에 결과 보고.

### 3.2 시나리오 B — 회귀 검증

- CI 또는 개발자가 `/news verify SPEC-NEWS-REVISE-001` 호출.
- → `evaluator-active`만 단독 실행. `npm test --prefix web` 종료코드 0 + AC-Z-1/AC-DTL-1/AC-EMB-1 등 모든 AC 매핑 검증 + `vite build` 종료코드 0.
- → 결과를 Slack에 보고. PASS면 한 줄 요약, FAIL이면 실패 AC 목록과 다음 액션 제안.

### 3.3 시나리오 C — `news.md`에서 자동 시작

- 작성자가 `/news produce --from-newsmd` 호출.
- → 워크플로우 스킬이 `news.md`와 `.moai/specs/`의 기존 SPEC을 비교해 최신 개정 미반영분을 추출.
- → 미반영분에 해당하는 SPEC을 자동 plan(없으면 신설, 있으면 갱신)하고 produce 본 루프로 진입.

### 3.4 시나리오 D — 정체(stagnation) 에스컬레이션

- `expert-frontend`가 GAN 루프 3회 연속 개선폭 < 0.05.
- → workflow 스킬은 **AskUserQuestion을 직접 호출하지 않는다** ([HARD] subagent boundary). 대신 manager-spec으로 재위임해 SPEC 보강 사이클을 트리거하거나, 사람 개입이 필요한 stagnation report를 MoAI 오케스트레이터에게 반환한다.
- → MoAI 오케스트레이터만이 AskUserQuestion으로 사용자에게 옵션(criteria 조정 / force-pass / restart)을 제시한다.

---

## 4. 요구사항 (Requirements — EARS)

### REQ-HARNESS-CMD — 슬래시 명령 `/news` 표면

#### EARS 문장

- **[Event-Driven]** WHEN 사용자가 `/news produce [SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]` 을 호출하면, THE 시스템 SHALL `moai-workflow-news-production` 스킬의 `produce` 인텐트에 인자를 그대로 위임한다.
- **[Event-Driven]** WHEN 사용자가 `/news plan ["설명"|SPEC-ID]` 을 호출하면, THE 시스템 SHALL `manager-spec`을 단일 위임으로 호출해 신규 SPEC을 생성하거나 기존 SPEC을 갱신하고, 구현·평가 단계로 진입하지 않는다.
- **[Event-Driven]** WHEN 사용자가 `/news verify [SPEC-ID]` 를 호출하면, THE 시스템 SHALL `evaluator-active`만 단독 호출하여 점수 카드를 산출하고 Slack 보고를 수행한다.
- **[Ubiquitous]** THE 시스템 SHALL `.claude/commands/news/produce.md`, `plan.md`, `verify.md` 각각이 thin command 패턴(SPEC-THIN-CMDS-001)을 준수하도록 강제한다: 본문 20 LOC 미만, YAML frontmatter에 `description`/`argument-hint`/`allowed-tools: Skill` 포함, 본문은 단일 `Use Skill("moai-workflow-news-production") with arguments: <subcommand> $ARGUMENTS` 라인으로 한정.
- **[Unwanted]** THE 시스템 SHALL NOT `/news` 하위 명령 .md 파일 본문에 워크플로우 로직(분기, 조건문, 단계 정의, agent 호출 명시)을 직접 포함시키지 아니한다. 모든 로직은 `moai-workflow-news-production` 스킬 본문에 둔다.
- **[Optional]** WHERE 사용자가 `--harness thorough`를 명시하면, THE 시스템 SHALL Sprint Contract Protocol(design constitution Section 11)을 활성화하여 매 GAN 라운드 전 expert-frontend ↔ evaluator-active가 평가 체크리스트를 합의하도록 한다.

#### Acceptance Criteria

- **AC-CMD-1 (파일 존재 + LOC)**
  - Given: `/news` 명령 도입이 완료된 상태
  - When: `ls .claude/commands/news/`를 실행한다
  - Then: `produce.md`, `plan.md`, `verify.md` 3개 파일이 존재하고, 각각의 본문(`---` frontmatter 종료 이후 라인) LOC가 5줄 이하이다.

- **AC-CMD-2 (frontmatter 스키마)**
  - Given: 위 3개 파일이 존재한다
  - When: 각 파일의 YAML frontmatter를 파싱한다
  - Then: 각 파일에 `description` (한 문장), `argument-hint` (인자 패턴 문자열), `allowed-tools: Skill` (CSV string) 세 키가 모두 존재한다.

- **AC-CMD-3 (Skill 위임 라인)**
  - Given: 위 3개 파일이 존재한다
  - When: 각 파일의 frontmatter 종료 이후 본문을 grep한다
  - Then: 정확히 1개 라인이 `Use Skill("moai-workflow-news-production") with arguments:` 로 시작하며, 그 라인이 본문의 유일한 비공백 라인이다.

- **AC-CMD-4 (분기 부재)**
  - Given: 위 3개 파일이 존재한다
  - When: 각 파일 본문에서 `if`, `when`, `case`, `switch`, `agent(`, `Agent(`, `manager-`, `expert-` 패턴을 grep한다
  - Then: 매치되는 라인이 없다 (분기/agent 호출이 .md에 누출되지 않음).

### REQ-HARNESS-SKILL-DOMAIN — 도메인 지식 스킬 `moai-domain-news-editor`

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL `.claude/skills/moai-domain-news-editor/SKILL.md`에 다음 도메인 지식 표를 모두 포함한다: 기사 생애주기 매트릭스(권한 R/D × 액션 송고/보류/KILL × 초기 상태 RDS → 결과 상태 RDS/RRH/RRK/DPS/DDH/DDK), 권한 R/D/Z 의미와 작성 페이지 상단 버튼 가시성 규칙, 상세보기 새창 12 공통정보 필드 목록, 에디터 단축키(Alt+Y `(끝)` 골드색, Ctrl+D 라인 삭제, IME 합성 처리 원칙), 인라인 임베딩 의미(본문 커서 위치 삽입 + `markupVersion` round-trip 보존), 디자인 토큰(`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC`, `--yh-serif` Nanum Myeongjo / Noto Serif KR, `--yh-sans` Noto Sans KR).
- **[Ubiquitous]** THE 시스템 SHALL 스킬 YAML frontmatter에 다음을 포함한다: `name: moai-domain-news-editor`, `description:` (folded scalar `>` 형식, 한 줄 요약), `allowed-tools: Read, Grep, Glob, Bash` (CSV string), `metadata: { version, category: "domain", status: "active", updated, tags }`, `triggers: { keywords: [news, 기사, writer.do, list.do, 에디터, 임베드, RDS, DPS, Alt+Y, Ctrl+D], agents: [manager-spec, expert-frontend, evaluator-active], phases: [plan, run] }`.
- **[Ubiquitous]** THE 시스템 SHALL 본 스킬을 `manager-spec`, `expert-frontend`, `evaluator-active`가 동일하게 `Skill("moai-domain-news-editor")`로 로드 가능하도록 단일 진입점(SKILL.md)으로 노출한다.
- **[Unwanted]** THE 시스템 SHALL NOT 본 스킬 본문에 오케스트레이션 로직(Intent Router, agent 호출 순서, GAN 루프 종료 조건)을 포함시키지 아니한다 — 그것은 `moai-workflow-news-production` 스킬의 책임이다.
- **[State-Driven]** WHILE `news.md`가 갱신되면, THE 시스템 SHALL 본 도메인 스킬도 동기 갱신되어야 함을 명시적 의존성으로 선언한다 (SKILL.md `## HISTORY` 또는 `## Source of Truth` 섹션에 "Source: D:\agents\tech_day\news.md, version pinned at last sync"형식 표기).

#### Acceptance Criteria

- **AC-DOMAIN-1 (파일 존재 + frontmatter)**
  - Given: 도메인 스킬 도입이 완료된 상태
  - When: `D:\agents\tech_day\.claude\skills\moai-domain-news-editor\SKILL.md` 파일을 읽는다
  - Then: 파일이 존재하고 YAML frontmatter가 파싱 가능하며, `name: moai-domain-news-editor`, `allowed-tools: Read, Grep, Glob, Bash`, `metadata.category: "domain"`, `triggers.keywords`에 최소 `news`, `RDS`, `Alt+Y`, `Ctrl+D`, `` 포함.

- **AC-DOMAIN-2 (생애주기 매트릭스)**
  - Given: SKILL.md 본문
  - When: 본문에서 `RDS`, `RRH`, `RRK`, `DPS`, `DDH`, `DDK` 6개 상태값을 grep한다
  - Then: 6개 상태값이 모두 등장하며, 권한 R/D × 액션(송고/보류/KILL) × 결과 상태의 매핑이 표 형식(`| ... | ... |`)으로 명시되어 있다.

- **AC-DOMAIN-3 (12 공통정보 필드)**
  - Given: SKILL.md 본문
  - When: 본문에서 다음 12 단어를 grep한다 — 작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고
  - Then: 12 단어가 모두 한 섹션 내에 등장한다.

- **AC-DOMAIN-4 (디자인 토큰)**
  - Given: SKILL.md 본문
  - When: `#0A4DA6`, `#08306B`, `#DDE3EC`, `Noto Sans KR`, `Noto Serif KR`, `Nanum Myeongjo` 패턴을 grep한다
  - Then: 6개 패턴이 모두 등장하며 변수명 `--yh-blue`, `--yh-blue-deep`, `--yh-gray-line`이 명시되어 있다.

- **AC-DOMAIN-5 (오케스트레이션 부재)**
  - Given: SKILL.md 본문
  - When: 본문에서 `GAN`, `evaluator-active`, `Sprint Contract`, `max_iterations`, `Intent Router` 패턴을 grep한다
  - Then: 매치가 없거나 `## Works Well With` 섹션 내의 단순 참조 형태로만 등장한다 (오케스트레이션 로직 본문 부재).

### REQ-HARNESS-SKILL-WORKFLOW — 오케스트레이션 스킬 `moai-workflow-news-production`

#### EARS 문장

- **[Event-Driven]** WHEN `Use Skill("moai-workflow-news-production") with arguments: <subcommand> ...`가 호출되면, THE 시스템 SHALL Intent Router로 `produce` / `plan` / `verify` 3종을 분기하여 해당 단계의 위임 시퀀스를 수행한다.
- **[Ubiquitous]** THE 시스템 SHALL 본 스킬 SKILL.md에 다음 4 phase 시퀀스를 명시한다: (1) Spec — manager-spec, (2) Build — expert-frontend, (3) Evaluate — evaluator-active, (4) Loop or Sync (GAN 루프 또는 manager-docs/manager-git).
- **[Ubiquitous]** THE 시스템 SHALL YAML frontmatter에 다음을 포함한다: `name: moai-workflow-news-production`, `description:` (folded scalar `>`), `allowed-tools: Agent, AskUserQuestion, Skill, TaskCreate, TaskUpdate, TaskList, Read, Write, Edit, Glob, Grep, Bash` (CSV string), `triggers: { keywords: [/news, news produce, news plan, news verify], phases: [plan, run, sync], agents: [manager-spec, expert-frontend, evaluator-active, manager-git, manager-docs] }`, `argument-hint: "<subcommand> [SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]"`.
- **[Unwanted]** THE 시스템 SHALL NOT 본 스킬 본문에서 `AskUserQuestion`을 호출하지 아니한다 — 사람 에스컬레이션은 MoAI 오케스트레이터로 stagnation report를 반환하여 위임한다 (agent-common-protocol.md HARD: subagent MUST NOT prompt the user).
- **[State-Driven]** WHILE GAN 루프가 정체 상태(개선폭 < 0.05이 2회 연속) 이면, THE 시스템 SHALL `manager-spec` 재위임을 통한 SPEC 보강 사이클을 1회 시도하고, 그래도 회복되지 않으면 stagnation report를 MoAI 오케스트레이터로 반환한다.
- **[Optional]** WHERE `--from-newsmd` 인자가 주어지면, THE 시스템 SHALL `news.md`와 `.moai/specs/SPEC-NEWS-*` 디렉터리를 비교해 미반영 개정분을 추출하고 manager-spec에게 신규/갱신 SPEC 생성을 위임한다.

#### Acceptance Criteria

- **AC-WORKFLOW-1 (파일 존재 + frontmatter)**
  - Given: 워크플로우 스킬 도입이 완료된 상태
  - When: `D:\agents\tech_day\.claude\skills\moai-workflow-news-production\SKILL.md` 파일을 읽는다
  - Then: 파일이 존재하고 frontmatter에 `name: moai-workflow-news-production`, `allowed-tools` CSV에 `Agent`/`Skill`/`Bash`/`Read`/`Write`/`Edit` 모두 포함, `argument-hint` 키 존재.

- **AC-WORKFLOW-2 (Intent Router)**
  - Given: SKILL.md 본문
  - When: `produce`, `plan`, `verify` 3개 인텐트 분기 패턴을 grep한다
  - Then: 3개 인텐트가 모두 본문 한 섹션 내에서 라우팅 규칙으로 명시되며, 각각의 대상 위임(`manager-spec` / `expert-frontend` / `evaluator-active`)이 표 또는 리스트 형태로 매핑되어 있다.

- **AC-WORKFLOW-3 (4 phase 시퀀스)**
  - Given: SKILL.md 본문
  - When: `Spec`, `Build`, `Evaluate`, `Loop or Sync` 4 phase 명을 grep한다
  - Then: 4 phase가 본문 한 섹션에서 순서대로 등장하고, 각 phase의 입력/출력 계약(SPEC-ID, 변경 파일 목록, 점수 카드)이 표 형식으로 명시되어 있다.

- **AC-WORKFLOW-4 (AskUserQuestion 부재)**
  - Given: SKILL.md 본문
  - When: `AskUserQuestion(` 호출 패턴을 grep한다
  - Then: 매치가 없거나, `allowed-tools` CSV에 키워드로만 등장하고 본문 호출 예시는 없다. 본문에 stagnation 시 "MoAI 오케스트레이터로 반환" 표현이 명시되어 있다.

- **AC-WORKFLOW-5 (도메인 스킬 참조)**
  - Given: SKILL.md 본문
  - When: `moai-domain-news-editor` 문자열을 grep한다
  - Then: 본문 `## Works Well With` 또는 `## Authority References` 섹션에서 본 도메인 스킬을 명시적으로 참조하며, 본 워크플로우 스킬이 도메인 지식을 도메인 스킬에 위임한다는 사실이 명시되어 있다.

### REQ-HARNESS-PIPELINE — 파이프라인 계약 (단계별 입력/출력 + GAN 종료)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL 다음 4 phase의 입력/출력 계약을 본 SPEC 및 워크플로우 스킬 본문에 동일하게 명시한다: Phase 1 (Spec) — 입력: `news.md` + 사용자 설명 또는 SPEC-ID / 출력: `.moai/specs/SPEC-NEWS-*/{spec,plan,acceptance}.md`; Phase 2 (Build) — 입력: SPEC-ID / 출력: 변경 파일 목록(git diff); Phase 3 (Evaluate) — 입력: SPEC-ID + 변경 파일 목록 / 출력: 점수 카드 (4 dimension × 0.0~1.0); Phase 4 (Loop or Sync) — 입력: 점수 카드 / 출력: 다음 액션 (재진입 또는 manager-docs/manager-git 호출).
- **[Event-Driven]** WHEN evaluator-active 점수 ≥ `pass_threshold` (기본 0.75, design.yaml 동일) 이면, THE 시스템 SHALL GAN 루프를 종료하고 Phase 4 Sync 분기로 진입한다.
- **[State-Driven]** WHILE 점수 < `pass_threshold` 이고 누적 iteration이 `max_iterations` (기본 5) 미만이면, THE 시스템 SHALL evaluator의 actionable feedback을 expert-frontend에 전달하여 재구현을 트리거한다.
- **[State-Driven]** WHILE 인접 iteration의 개선폭이 `improvement_threshold` (기본 0.05) 미만으로 2회 연속이면, THE 시스템 SHALL stagnation 상태로 분류하고 manager-spec 재위임을 1회 시도한다.
- **[Unwanted]** THE 시스템 SHALL NOT manager-spec과 evaluator-active 두 phase 중 어느 하나도 skip하지 아니한다. (FROZEN — design constitution Section 2 차용)
- **[Unwanted]** THE 시스템 SHALL NOT `pass_threshold`를 0.60 미만으로 낮추지 아니한다 (FROZEN floor — design constitution Section 2 차용).

#### Acceptance Criteria

- **AC-PIPELINE-1 (4 phase 계약 명시)**
  - Given: spec.md 및 워크플로우 스킬 SKILL.md
  - When: 두 문서에서 "Phase 1", "Phase 2", "Phase 3", "Phase 4" 또는 "Spec", "Build", "Evaluate", "Loop or Sync" 표를 grep한다
  - Then: 두 문서에 동일한 표가 등장하며, 각 phase에 입력/출력/담당 에이전트 컬럼이 모두 채워져 있다.

- **AC-PIPELINE-2 (종료 조건 명시)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `pass_threshold`, `max_iterations`, `improvement_threshold` 3개 키와 그 기본값(`0.75`, `5`, `0.05`)을 grep한다
  - Then: 3개 키가 모두 등장하고 기본값이 design.yaml과 일치한다.

- **AC-PIPELINE-3 (FROZEN floor 명시)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `FROZEN`, `0.60`, `skip` 패턴을 grep한다
  - Then: "manager-spec과 evaluator-active는 skip 불가" 와 "pass_threshold 0.60 미만 금지" 두 명시가 모두 본문에 존재한다.

- **AC-PIPELINE-4 (stagnation 재위임 경로)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `stagnation`, `improvement_threshold`, `manager-spec` 재위임 경로 표현을 grep한다
  - Then: "개선폭 < 0.05이 2회 연속 → manager-spec 재위임 1회 시도 → 실패 시 MoAI 오케스트레이터로 stagnation report 반환" 시퀀스가 본문에 명시되어 있다.

### REQ-HARNESS-EVAL — evaluator-active PASS 기준 (must-pass + 편향 방지)

#### EARS 문장

- **[Ubiquitous]** THE 시스템 SHALL evaluator-active의 PASS 판정에 다음 3개 must-pass 조건을 강제한다 (합산 평균 금지 — design constitution Section 12 Mechanism 3 차용): (a) `npm test --prefix web` 종료코드 0, (b) 대상 SPEC의 모든 AC가 테스트로 매핑되어 통과, (c) `npm run build --prefix web` (vite build) 종료코드 0.
- **[Ubiquitous]** THE 시스템 SHALL 4 차원 점수(Design Quality, Originality, Completeness, Functionality, 각 0.0~1.0)를 산출하며 design.yaml `pass_threshold` 0.75 기준으로 종합 PASS/FAIL을 판정한다.
- **[Ubiquitous]** THE 시스템 SHALL design constitution Section 12의 평가자 편향 방지 5종 메커니즘을 적용한다: (1) Rubric Anchoring — 각 차원에 0.25/0.50/0.75/1.0 기준 예시 명시, (2) Regression Baseline — 직전 N개 SPEC 점수 대비 0.15 초과 상승 시 review flag, (3) Must-Pass Firewall — 위 3 조건은 nice-to-have 고득점으로 보상 불가, (4) Independent Re-evaluation — 매 5번째 SPEC은 독립 재평가 후 0.10 이내 분기 확인, (5) Anti-Pattern Cross-check — 알려진 anti-pattern 발견 시 해당 차원 점수 0.50 상한.
- **[Event-Driven]** WHEN `--harness thorough` 가 활성화되면, THE 시스템 SHALL 매 GAN 라운드 시작 시 expert-frontend ↔ evaluator-active 간 Sprint Contract 협상(design constitution Section 11 Sprint Contract Protocol)을 수행하고 `.moai/sprints/` 디렉터리에 산출물을 기록한다.
- **[Unwanted]** THE 시스템 SHALL NOT 위 3 must-pass 조건 중 하나라도 실패한 상태에서 PASS를 선언하지 아니한다. (즉 Jest 통과 + 빌드 통과 + AC 매핑 통과 모두 성립할 때만 PASS)
- **[Unwanted]** THE 시스템 SHALL NOT Sprint Contract에 없는 임의 기준으로 점수를 가산하거나 차감하지 아니한다 (design constitution Section 11 [HARD] 동일 적용).

#### Acceptance Criteria

- **AC-EVAL-1 (must-pass 3 조건 명시)**
  - Given: 워크플로우 스킬 SKILL.md 및 acceptance.md
  - When: `npm test`, `npm run build`, `AC 매핑` 3개 단언을 grep한다
  - Then: 3 조건이 모두 must-pass로 명시되며, "합산 평균 금지" 또는 "Must-Pass Firewall" 표현이 동반된다.

- **AC-EVAL-2 (4 차원 + pass_threshold 0.75)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `Design Quality`, `Originality`, `Completeness`, `Functionality`, `0.75` 5개 키워드를 grep한다
  - Then: 5개 모두 한 섹션 내에 등장하며, 각 차원에 0.25/0.50/0.75/1.0 rubric 예시가 명시되어 있다.

- **AC-EVAL-3 (편향 방지 5종)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `Rubric Anchoring`, `Regression Baseline`, `Must-Pass Firewall`, `Independent Re-evaluation`, `Anti-Pattern Cross-check` 5개 메커니즘 명을 grep한다
  - Then: 5개 모두 본문에 등장하며 각각의 적용 규칙이 한 줄 이상 명시되어 있다.

- **AC-EVAL-4 (Sprint Contract 활성 조건)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `--harness thorough`, `Sprint Contract`, `.moai/sprints/` 3개 표현을 grep한다
  - Then: 3개 모두 동일 섹션에 등장하고, thorough 활성 시 Sprint Contract 필수, standard에서는 optional이라는 매핑이 명시되어 있다.

- **AC-EVAL-5 (실 검증 dry-run 가능성)**
  - Given: SPEC-NEWS-REVISE-001 디렉터리(`.moai/specs/SPEC-NEWS-REVISE-001/`)와 `web/` 트리
  - When: 본 SPEC의 `acceptance.md`에 정의된 평가 절차를 사람이 수동 실행한다 (`npm test --prefix web` + `npm run build --prefix web` + acceptance.md의 AC 매핑 확인)
  - Then: 모든 단언이 현 트리에서 실행 가능하고, 각 단언의 검증 명령이 `.moai/specs/SPEC-HARNESS-NEWS-001/acceptance.md`에 명시되어 있다.

### REQ-HARNESS-SLACK — Slack tech-day 채널 알림

#### EARS 문장

- **[Event-Driven]** WHEN `/news produce` 파이프라인이 종료(PASS / FAIL / timeout / stagnation 모두 포함) 되면, THE 시스템 SHALL Slack 채널 `C0B69CG59UM`("tech-day")에 한국어 결과 메시지를 1회 전송한다.
- **[Ubiquitous]** THE 시스템 SHALL 메시지 본문에 다음 6개 필드를 포함한다: (1) SPEC ID, (2) 최종 점수(4 차원 합산 또는 차원별), (3) 통과 AC 수 / 전체 AC 수, (4) GAN 루프 반복 횟수, (5) 종료 사유 (PASS / FAIL / max_iterations / stagnation / timeout), (6) 다음 액션 제안 (예: `/news produce SPEC-XXX --resume`, manager-spec 재위임 권장 등).
- **[Event-Driven]** WHEN `/news verify` 단독 실행이 종료되면, THE 시스템 SHALL 동일 채널에 짧은 한 줄 요약 메시지(PASS면 점수와 SPEC ID, FAIL이면 실패 AC 목록 최대 5개)를 전송한다.
- **[Unwanted]** THE 시스템 SHALL NOT 종료 사유가 FAIL/timeout/stagnation인 경우에도 Slack 알림을 생략하지 아니한다 (silent failure 금지).
- **[Unwanted]** THE 시스템 SHALL NOT Slack 메시지를 영어로 작성하지 아니한다 (CLAUDE.md 한국어 응답 규칙 + agent-common-protocol.md Language Handling 분석/보고는 사용자 conversation_language).
- **[Optional]** WHERE Slack MCP 또는 토큰이 부재한 환경이면, THE 시스템 SHALL 메시지를 stdout 및 `.moai/state/slack-pending.md`에 기록하고 사람 발송을 안내한다 (silent skip 금지).

#### Acceptance Criteria

- **AC-SLACK-1 (채널 ID 고정)**
  - Given: 워크플로우 스킬 SKILL.md 및 본 spec.md
  - When: `C0B69CG59UM` 채널 ID를 grep한다
  - Then: 두 문서 모두에 채널 ID가 명시되며, "tech-day" 채널명도 함께 등장한다.

- **AC-SLACK-2 (메시지 6 필드)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `SPEC ID`, `최종 점수`, `통과 AC`, `GAN`, `종료 사유`, `다음 액션` 6개 키워드를 grep한다
  - Then: 6개 모두 동일한 "Slack 메시지 포맷" 섹션 내에 등장한다.

- **AC-SLACK-3 (FAIL 분기)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `FAIL`, `timeout`, `stagnation` 3개 종료 사유 분기를 grep한다
  - Then: 3개 분기 모두 본문에 명시되며, 각각이 silent skip 없이 Slack 알림을 전송함이 단언된다.

- **AC-SLACK-4 (MCP fallback)**
  - Given: 워크플로우 스킬 SKILL.md
  - When: `slack-pending.md`, `stdout`, `토큰` 또는 `MCP` 패턴을 grep한다
  - Then: Slack MCP 부재 시 stdout 출력 + `.moai/state/slack-pending.md` 기록의 fallback이 본문에 명시되어 있다.

- **AC-SLACK-5 (한국어 본문)**
  - Given: 워크플로우 스킬 SKILL.md의 Slack 메시지 템플릿 예시
  - When: 예시 메시지 텍스트를 검사한다
  - Then: 예시 메시지의 모든 prose가 한국어이고, SPEC ID·점수·파일 경로 등 기술적 식별자만 영문/숫자이다.

---

## 5. 비기능 요건 (Non-Functional Requirements)

### 5.1 thin command 패턴 (SPEC-THIN-CMDS-001 직접 인용)

- `.claude/commands/news/*.md` 본문은 20 LOC 미만이어야 한다.
- frontmatter는 `description` (한 문장), `argument-hint` (인자 패턴), `allowed-tools: Skill` (CSV string) 3 키를 가진다.
- 본문은 `Use Skill("moai-workflow-news-production") with arguments: <subcommand> $ARGUMENTS` 단일 라인.
- 분기, 조건문, agent 직접 호출, 단계 정의가 .md에 누출 금지.

### 5.2 스킬 frontmatter 규약 (skill-authoring.md 준수)

- `allowed-tools`는 CSV string (배열이 아닌 `"Read, Grep, Glob"` 같은 문자열).
- `metadata` 값은 quoted string ("active", "domain" 등).
- `description`은 folded scalar `>` 형식, 한 줄 요약 + 빈 줄 후 사용 사례.
- Progressive Disclosure 3 단계 구조(Quick Reference / Implementation Guide / Advanced) 준수, SKILL.md 500 LOC 미만 권장.

### 5.3 인코딩 / 언어

- 본 SPEC 3 파일(spec.md / plan.md / acceptance.md), 후속 스킬 SKILL.md, 명령 .md 파일 모두 UTF-8 (CLAUDE.md HARD).
- prose는 한국어. 코드/심볼/SPEC ID/슬래시 명령은 영문.

### 5.4 디자인 토큰 (스타일)

- 본 SPEC은 신규 CSS 변수를 도입하지 않는다. 기존 `--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC` 그대로 사용 (CLAUDE.md "파란색과 흰색" + `articleDetail.js` 현 구현 정합).
- 도메인 스킬은 이 토큰을 참조 가능하도록 명시한다.

### 5.5 회귀 방지

- 본 하네스 도입이 기존 `web/` 코드 또는 기존 SPEC AC를 침범해서는 안 된다.
- 본 SPEC의 도입 검증 시 SPEC-NEWS-REVISE-001/002의 회귀가 발생하지 않아야 한다 (acceptance.md의 dry-run 항목).

### 5.6 보안

- Slack 토큰/MCP 자격은 환경 변수 또는 settings.json에 둔다 (settings.json `permissions.allow` 또는 `.env`). 본 SPEC 본문 및 스킬 본문에 평문 토큰 금지.
- DB에 있는 내용은 삭제하지 않는다 (CLAUDE.md).

---

## 6. 현재 진행 상태 (Current Progress)

> 분석 시점: 2026-06-03. 출처: `git status` 미커밋 상태 + `.claude/` Glob.

| 영역 | REQ | 진행 상태 | 한 줄 요약 |
|------|-----|---------|-----------|
| `.claude/commands/news/` | REQ-HARNESS-CMD | **미존재** | 디렉터리 자체가 없음. plan.md 단계 4에서 신규 작성 예정 |
| `.claude/skills/moai-domain-news-editor/` | REQ-HARNESS-SKILL-DOMAIN | **미존재** | 신규. plan.md 단계 2 |
| `.claude/skills/moai-workflow-news-production/` | REQ-HARNESS-SKILL-WORKFLOW | **미존재** | 신규. plan.md 단계 3 |
| 검증 대상 기능 SPEC | REQ-HARNESS-EVAL | 존재 | SPEC-NEWS-REVISE-001 (Plan), SPEC-NEWS-REVISE-002 (`?? .moai/specs/SPEC-NEWS-REVISE-002/` 미커밋). 두 SPEC 모두 본 하네스의 검증 대상 |
| 기존 에이전트 | REQ-HARNESS-PIPELINE / REQ-HARNESS-EVAL | 존재 | manager-spec, expert-frontend, evaluator-active, manager-git, manager-docs 모두 `.claude/agents/moai/` 하위 존재. 본 SPEC은 재사용만 |
| design.yaml | REQ-HARNESS-EVAL / PIPELINE | 존재 | `gan_loop.{max_iterations:5, pass_threshold:0.75, escalation_after:3, improvement_threshold:0.05}` 그대로 차용 |
| Slack MCP | REQ-HARNESS-SLACK | 미확인 | Slack MCP 설치 여부 확인 필요. fallback (`.moai/state/slack-pending.md`)이 RED 안전망 |

---

## 7. 영향 영역 (Affected Files)

### 7.1 본 SPEC 도입으로 신규될 영역 (Plan 승인 후, plan.md 단계 2~4에서 생성)

- `D:\agents\tech_day\.claude\skills\moai-domain-news-editor\SKILL.md` — 도메인 지식 스킬.
- `D:\agents\tech_day\.claude\skills\moai-workflow-news-production\SKILL.md` — 오케스트레이션 스킬.
- `D:\agents\tech_day\.claude\commands\news\produce.md` — thin wrapper.
- `D:\agents\tech_day\.claude\commands\news\plan.md` — thin wrapper.
- `D:\agents\tech_day\.claude\commands\news\verify.md` — thin wrapper.
- `D:\agents\tech_day\.moai\sprints\` (디렉터리 자체는 thorough harness 실행 시 자동 생성, 본 SPEC은 경로만 예약).

### 7.2 본 SPEC 자체가 생성하는 파일 (현재 작업 산출물)

- `D:\agents\tech_day\.moai\specs\SPEC-HARNESS-NEWS-001\spec.md` (본 파일).
- `D:\agents\tech_day\.moai\specs\SPEC-HARNESS-NEWS-001\plan.md`.
- `D:\agents\tech_day\.moai\specs\SPEC-HARNESS-NEWS-001\acceptance.md`.

### 7.3 변경 금지 (회귀 가드)

- 기존 SPEC 디렉터리 6종(`SPEC-AUTH-001`, `SPEC-BACKEND-CORE-001`, `SPEC-DB-FOUNDATION-001`, `SPEC-FRONTEND-UI-001`, `SPEC-NEWS-REVISE-001`, `SPEC-UI-EDITOR-001`)의 어떤 파일도 본 SPEC 작업으로 수정되지 않는다.
- 기존 `.claude/agents/moai/*.md` 에이전트 정의 수정 금지 (재사용만).
- `web/` 하위 일체 수정 금지.

---

## 8. 테스트 전략

본 SPEC의 산출물은 *스킬/명령 파일*이므로 RED는 "파일 존재 / grep 패턴 / LOC 카운트 / frontmatter 파싱" 형태이다. 실제 런타임 검증은 `/news verify SPEC-NEWS-REVISE-001` dry-run으로 수행한다.

### 8.1 정적 검증 (acceptance.md의 검증 명령)

- Glob: 6개 파일 존재 확인 (SPEC 3 + skills 2 + commands 3).
- Grep: 각 AC의 키워드 단언.
- LOC 카운트: thin command 본문이 20 LOC 미만.
- YAML 파싱: 각 SKILL.md frontmatter가 파싱 가능하며 필수 키 모두 존재.

### 8.2 런타임 dry-run (Pilot)

- plan.md 단계 5: SPEC-NEWS-REVISE-001 대상으로 `/news verify` 1회 실행.
- 기대: `npm test --prefix web` 종료코드 0, `npm run build --prefix web` 종료코드 0, AC-Z-1~5 / AC-DTL-1~6 / AC-EMB-1~3 / AC-CTRL-D-1~5의 매핑 테스트 모두 통과, Slack 또는 fallback 알림 1회 전송.

### 8.3 회귀 가드

- SPEC-NEWS-REVISE-001/002의 모든 AC 회귀 없음.
- 기존 SPEC 디렉터리 파일 hash 무변경.
- `.claude/agents/moai/*.md` 무변경.

---

## 9. 위험과 완화 (Risks & Pending Decisions)

| 위험 / 미결 결정 | 영향 | 완화 |
|---------------|------|------|
| **R1 — Slack MCP 부재**: 현재 `.mcp.json` / settings.json 에 Slack MCP 미확인. | Slack 전송 실패 시 silent failure 발생 가능 | REQ-HARNESS-SLACK Optional 절에 fallback(stdout + `.moai/state/slack-pending.md`) 명시. plan.md 단계 6에서 사람 발송 절차로 우회. **사람 결정 필요**: Slack MCP 설치 여부 |
| **R2 — `--from-newsmd` 비교 알고리즘 미정**: `news.md`와 기존 SPEC을 어떻게 diff 할지 본 SPEC은 의도만 명시. | 잘못 구현 시 매번 같은 SPEC을 중복 생성 | 가정: 본 SPEC은 의도만 EARS로 고정하고, 알고리즘(예: `news.md` 섹션 헤더 → SPEC ID 매핑, 그리고 SPEC `## HISTORY` last-updated 비교)은 워크플로우 스킬 SKILL.md 작성 단계(plan.md 단계 3)에서 builder-skill이 보강. 본 SPEC Risk로 명시 |
| **R3 — Sprint Contract 활성 기본값**: `--harness thorough`가 기본인가 `standard`가 기본인가. | 기본값에 따라 평가자/구현자 협상 부담 차이 | 가정: 기본값 `standard` (design.yaml `sprint_contract.required_harness_levels: [thorough]`와 정합), 사람이 명시적으로 `--harness thorough`를 줄 때만 Sprint Contract 강제. **사람 결정 필요**: 동의 여부 |
| **R4 — evaluator-active가 본 하네스용 PASS 기준을 어떻게 로드하는가**: design constitution Section 12는 일반 design 도메인 기준. news 도메인 must-pass(`npm test` + AC + `vite build`)는 본 SPEC이 신설. | evaluator-active 기존 정의가 본 기준을 모를 수 있음 | 가정: `moai-workflow-news-production` 스킬이 evaluator-active 위임 prompt에 must-pass 3 조건을 명시적으로 주입한다 (one-turn fully-loaded — Opus 4.7 prompt philosophy). 본 SPEC은 그 책임을 워크플로우 스킬에 둔다 |
| **R5 — `web/` 의 `npm test` 가 실제로 모든 SPEC AC를 매핑하는가**: 본 SPEC은 매핑이 존재한다고 가정. | 일부 AC가 테스트로 매핑되지 않으면 must-pass 조건 (b) 충족 불가 | 가정: 매핑 부재 시 evaluator-active가 "AC-X 매핑 누락" 으로 FAIL 보고. plan.md 단계 5의 dry-run에서 즉시 노출됨 |
| **R6 — `--from-newsmd` 이슈와 R2의 차이**: R2는 알고리즘, 본 항목은 `news.md`의 어떤 단위(섹션/줄/문장)를 변경 감지의 단위로 삼는가 | 너무 fine-grained 하면 노이즈, 너무 coarse 하면 누락 | 가정: 단위 = `news.md`의 `^#`/`^##` 헤더 섹션. 헤더 텍스트가 SPEC ID 또는 SPEC의 keyword와 매칭되면 동일 토픽. 본 SPEC은 이 휴리스틱을 명시하며 알고리즘 정교화는 워크플로우 스킬에 위임 |
| **R7 — Z권한 버튼 가시성 결정 (SPEC-NEWS-REVISE-001 R1~R2 미해결)**: 본 SPEC은 *그것을 검증하는 하네스*이므로, 그 SPEC의 미해결 결정이 본 하네스의 PASS 기준에 영향을 준다 | 사람 결정 전에는 `/news verify SPEC-NEWS-REVISE-001` 의 PASS/FAIL 의미가 모호 | 본 SPEC은 SPEC-NEWS-REVISE-001의 미해결을 그대로 상속한다고 명시. 본 SPEC 자체의 PASS 기준은 "그 SPEC의 AC가 정의된 대로 통과" 이며 AC 자체의 옳고 그름은 본 SPEC의 책임이 아니다 |

---

## 10. 종속성 및 cross-reference (Cross-References)

- **SPEC-NEWS-REVISE-001 / SPEC-NEWS-REVISE-002**: 본 하네스의 *검증 대상* 기능 SPEC. 본 하네스는 그 SPEC들의 AC 매핑이 정확히 통과되는지를 evaluator-active로 자동 검증한다.
- **SPEC-UI-EDITOR-001 / SPEC-FRONTEND-UI-001 / SPEC-AUTH-001**: 도메인 지식 스킬(`moai-domain-news-editor`)이 이 SPEC들의 *현재 명세*를 도메인 표로 캡슐화한다 (변경하지 않음).
- **design constitution Section 4 (Pipeline Architecture)**: 본 SPEC의 4 phase 구조(Spec → Build → Evaluate → Loop)를 직접 차용.
- **design constitution Section 11 (GAN Loop Contract + Sprint Contract Protocol)**: 본 SPEC의 GAN 종료 조건과 thorough harness 활성 규칙을 직접 차용.
- **design constitution Section 12 (Evaluator Leniency Prevention)**: 본 SPEC의 PASS 기준 must-pass + 편향 방지 5종 메커니즘을 직접 차용.
- **design.yaml `gan_loop`**: `max_iterations:5`, `pass_threshold:0.75`, `escalation_after:3`, `improvement_threshold:0.05` 그대로 사용.
- **SPEC-THIN-CMDS-001 (.claude/rules/moai/development/coding-standards.md)**: `.claude/commands/news/*.md` 본문 20 LOC 미만 강제 규칙.
- **CLAUDE.md**: 한국어 응답, DB 삭제 금지, 각 작업 완료 시 Slack tech-day 채널 보고, 파란색/흰색 디자인.
- **agent-common-protocol.md**: subagent MUST NOT prompt user (REQ-HARNESS-SKILL-WORKFLOW Unwanted 절의 근거).

---

## 11. Exclusions (What NOT to Build) — 명시적 비목표

- `web/` 코드 직접 수정 — SPEC-NEWS-REVISE-NNN 소관.
- 새로운 `.claude/agents/*.md` 에이전트 정의 — 기존 에이전트만 재사용.
- 새 CSS 디자인 토큰 정의 — 기존 토큰만 사용.
- 수집/배부 시스템 — 현재 단계 제외.
- DB 스키마/데이터 변경 — CLAUDE.md HARD.
- 실제 기사 콘텐츠 생성 — 사람+에디터의 책임.
- AskUserQuestion을 subagent(워크플로우 스킬)에서 호출 — agent-common-protocol.md HARD.
- 시간 추정 ("며칠/N시간 안에") — agent-common-protocol.md HARD.
- 본 SPEC 본문에 의한 .claude/skills/ 또는 .claude/commands/ 직접 작성 — 본 SPEC은 *명세*만; 실제 파일 작성은 plan.md 단계 2~4에서 builder-skill 위임.

---

## 12. Definition of Done

- [ ] `.moai/specs/SPEC-HARNESS-NEWS-001/spec.md` (본 파일) 작성 완료
- [ ] `.moai/specs/SPEC-HARNESS-NEWS-001/plan.md` 작성 완료, 단계 1~6 명시
- [ ] `.moai/specs/SPEC-HARNESS-NEWS-001/acceptance.md` 작성 완료, 전 AC 평탄화 체크리스트 + 검증 명령 + 매핑 REQ-ID
- [ ] 본 SPEC의 EARS 6 REQ × 각 4문장 이상 + AC 각 3개 이상 만족
- [ ] Exclusions 섹션에 web/ 코드 변경, 신규 에이전트, DB 변경, 수집/배부 모두 명시 (CLAUDE.md + 본 SPEC 규칙)
- [ ] thin command 패턴(SPEC-THIN-CMDS-001) 강제 규칙이 NFR 5.1 및 REQ-HARNESS-CMD에 명시
- [ ] design constitution Section 4/11/12 직접 인용 명시
- [ ] Slack 채널 ID `C0B69CG59UM` 명시 (REQ-HARNESS-SLACK + acceptance.md 검증)
- [ ] 사람 결정 필요 항목(Risks R1, R3, R7)이 명시적 가정과 함께 기록되어 있음
- [ ] 모든 파일 UTF-8, 본문 한국어 prose
- [ ] 본 SPEC 작업으로 web/ 또는 기존 SPEC 디렉터리 어떤 파일도 변경되지 않음 (Affected Files 7.3 가드)

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-03
