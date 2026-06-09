# SPEC-HARNESS-NEWS-001 — Implementation Plan

기사 작성기 하네스의 단계별 구현 계획. 본 plan.md는 SPEC 본문(spec.md)이 정의한 REQ-HARNESS-CMD / SKILL-DOMAIN / SKILL-WORKFLOW / PIPELINE / EVAL / SLACK 6종을 실제 파일로 옮기기 위한 순서와 위임 경로를 명시한다.

> 우선순위 표기: Priority High / Medium / Low (시간 예측 금지 — agent-common-protocol.md HARD).

---

## 0. 사전 조건 (Pre-conditions)

- [ ] `D:\agents\tech_day\.moai\specs\SPEC-HARNESS-NEWS-001\spec.md` 가 사람의 검토를 받았고 Risks R1/R3/R7에 대한 답변 또는 명시적 "가정대로 진행" 승인이 있어야 한다.
- [ ] `news.md` source-of-truth는 본 작업 도중 *변경 금지* (변경되면 본 SPEC 자체 재검토 필요).
- [ ] `web/` 하위 변경 금지 (기능 SPEC SPEC-NEWS-REVISE-NNN 소관).
- [ ] 기존 SPEC 디렉터리 6종 파일 hash 무변경 유지.

---

## 1. 단계 (Stages)

### Stage 1 — 본 SPEC 승인 [Priority High]

- 산출물: `.moai/specs/SPEC-HARNESS-NEWS-001/{spec,plan,acceptance}.md` 3 파일 (현재 작업 단계).
- 담당: manager-spec (현재 호출).
- 검증: `ls .moai/specs/SPEC-HARNESS-NEWS-001/` 가 3 파일 모두 반환. 각 파일 UTF-8.
- 게이트: 사람이 spec.md Risks 섹션의 R1(Slack MCP), R3(harness 기본값), R7(SPEC-NEWS-REVISE-001 상속) 에 답변하거나 "가정대로 진행" 을 승인. 미승인 시 Stage 2~6 진입 금지.

### Stage 2 — 도메인 지식 스킬 작성 [Priority High]

- 산출물: `D:\agents\tech_day\.claude\skills\moai-domain-news-editor\SKILL.md`
- 담당: **builder-skill** (`.claude/agents/builder-skill.md`). 본 manager-spec 단계에서는 작성하지 않음.
- 위임 입력 (builder-skill에게 주입할 핵심 컨텍스트):
  - 본 SPEC `spec.md` REQ-HARNESS-SKILL-DOMAIN 전체.
  - `news.md` source-of-truth.
  - SPEC-NEWS-REVISE-001 의 도메인 표(권한 R/D/Z 의미, RDS/DPS/RRH/RRK/DDH/DDK 매트릭스, 12 공통정보 필드, Alt+Y/Ctrl+D, 인라인 임베딩).
  - 디자인 토큰 (`--yh-blue` `#0A4DA6`, `--yh-blue-deep` `#08306B`, `--yh-gray-line` `#DDE3EC`, `--yh-serif`, `--yh-sans`).
  - skill-authoring.md frontmatter 스키마.
- 산출물 frontmatter 요건:
  ```yaml
  ---
  name: moai-domain-news-editor
  description: >
    기사 작성기(news.md source-of-truth) 도메인 지식 캡슐.
    기사 생애주기(RDS/DPS/RRH/RRK/DDH/DDK), 권한 R/D/Z, 12 공통정보 필드,
    에디터 단축키(Alt+Y/Ctrl+D), 인라인 임베딩, 디자인 토큰.
  allowed-tools: Read, Grep, Glob, Bash
  metadata:
    version: "0.1.0"
    category: "domain"
    status: "active"
    updated: "2026-06-03"
    tags: "news, editor, lifecycle, design-tokens"
  triggers:
    keywords: [news, 기사, writer.do, list.do, 에디터, 임베드, RDS, DPS, RRH, RRK, DDH, DDK, Alt+Y, Ctrl+D, 공통정보]
    agents: [manager-spec, expert-frontend, evaluator-active]
    phases: [plan, run]
  ---
  ```
- 본문 필수 섹션 (Progressive Disclosure 3 단계):
  - Quick Reference: 도메인 한 줄 요약 + 디자인 토큰 6 변수 + URL 3종(login.do / writer.do / list.do).
  - Implementation Guide: 권한 매트릭스(표) + 12 공통정보 필드 목록 + 단축키 표 + 인라인 임베딩 contract.
  - Advanced / Authority References: `news.md`, SPEC-NEWS-REVISE-001/002, SPEC-UI-EDITOR-001 직접 인용.
  - Source of Truth: `D:\agents\tech_day\news.md` 마지막 hash/version (변경 동기화 의무).
- 검증 (Stage 7에서 일괄 수행):
  - `ls D:/agents/tech_day/.claude/skills/moai-domain-news-editor/SKILL.md` 존재.
  - frontmatter 파싱 OK + 필수 키 존재.
  - acceptance.md AC-DOMAIN-1~5 모두 통과 (각각 `grep` 또는 파싱 명령으로 검증).

### Stage 3 — 오케스트레이션 스킬 작성 [Priority High]

- 산출물: `D:\agents\tech_day\.claude\skills\moai-workflow-news-production\SKILL.md`
- 담당: builder-skill.
- 위임 입력:
  - 본 SPEC `spec.md` REQ-HARNESS-SKILL-WORKFLOW + REQ-HARNESS-PIPELINE + REQ-HARNESS-EVAL + REQ-HARNESS-SLACK.
  - design constitution Section 4 (Pipeline Architecture), Section 11 (GAN Loop Contract + Sprint Contract Protocol), Section 12 (Evaluator Leniency Prevention) 직접 인용 의무.
  - design.yaml `gan_loop` 기본값 (max_iterations=5, pass_threshold=0.75, escalation_after=3, improvement_threshold=0.05).
  - 기존 `.claude/skills/moai/SKILL.md`의 Intent Router 패턴 (Priority 1).
  - 채널 ID `C0B69CG59UM`.
- 산출물 frontmatter 요건:
  ```yaml
  ---
  name: moai-workflow-news-production
  description: >
    기사 작성기(news.md) 닫힌 루프 제작 파이프라인. /news produce/plan/verify
    인텐트 라우팅, manager-spec → expert-frontend → evaluator-active GAN 루프,
    Slack tech-day 채널 보고. SPEC-HARNESS-NEWS-001 구현.
  allowed-tools: Agent, AskUserQuestion, Skill, TaskCreate, TaskUpdate, TaskList, Read, Write, Edit, Glob, Grep, Bash
  argument-hint: "<produce|plan|verify> [SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]"
  metadata:
    version: "0.1.0"
    category: "workflow"
    status: "active"
    updated: "2026-06-03"
    tags: "news, harness, gan-loop, slack"
  triggers:
    keywords: [/news, news produce, news plan, news verify, news.md, harness]
    agents: [manager-spec, expert-frontend, evaluator-active, manager-git, manager-docs]
    phases: [plan, run, sync]
  ---
  ```
  - 주의: `allowed-tools`에 `AskUserQuestion`이 포함되지만 *본 스킬 본문에서 호출하지 않는다* (subagent boundary). 키워드 등록만 허용.
- 본문 필수 섹션:
  - Quick Reference: 3 인텐트 표 + 채널 ID + 4 phase 한 줄 요약.
  - Intent Router: `produce` / `plan` / `verify` 분기 (moai 스킬 Priority 1 패턴 차용).
  - Pipeline (4 phase): Phase 1 Spec / Phase 2 Build / Phase 3 Evaluate / Phase 4 Loop or Sync — 각 phase 입력/출력 표.
  - GAN Loop Contract: 종료 조건 3종 (점수 ≥ 0.75, max_iterations=5, stagnation 2회 연속 후 manager-spec 재위임 1회 시도), Sprint Contract 활성 규칙 (thorough 필수 / standard optional).
  - Evaluator Leniency Prevention: 편향 방지 5 메커니즘 직접 인용 (design constitution Section 12).
  - Must-Pass Firewall: `npm test --prefix web` 종료코드 0 + AC 매핑 통과 + `npm run build --prefix web` 종료코드 0 (합산 평균 금지).
  - Slack 보고 포맷: 6 필드 + 한국어 예시 메시지 + MCP fallback (`.moai/state/slack-pending.md`).
  - Stagnation 에스컬레이션: manager-spec 재위임 1회 → 실패 시 stagnation report를 MoAI 오케스트레이터로 반환 (AskUserQuestion 직접 호출 금지 명시).
  - Authority References / Works Well With: `moai-domain-news-editor`, design constitution, design.yaml, SPEC-NEWS-REVISE-001/002.
- 검증: acceptance.md AC-WORKFLOW-1~5 + AC-PIPELINE-1~4 + AC-EVAL-1~4 + AC-SLACK-1~5 모두 통과.

### Stage 4 — 슬래시 명령 thin wrapper 3종 작성 [Priority High]

- 산출물:
  - `D:\agents\tech_day\.claude\commands\news\produce.md`
  - `D:\agents\tech_day\.claude\commands\news\plan.md`
  - `D:\agents\tech_day\.claude\commands\news\verify.md`
- 담당: **manager-spec 직접** (builder 위임 불필요 — thin wrapper는 frontmatter + 1 라인이므로 manager-spec이 직접 작성). 본 plan.md 작성자가 Stage 1 승인 후 직접 Edit/Write로 작성한다.
- 각 파일 템플릿 (본문 정확히 1 라인, 5 LOC 미만):

  `produce.md`:
  ```
  ---
  description: 기사 작성기 닫힌 루프 파이프라인 실행 (SPEC → 구현 → 평가 → Slack)
  argument-hint: "[SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]"
  allowed-tools: Skill
  ---

  Use Skill("moai-workflow-news-production") with arguments: produce $ARGUMENTS
  ```

  `plan.md`:
  ```
  ---
  description: 뉴스 SPEC 생성/갱신만 수행 (manager-spec 단일 위임, 구현·평가 없음)
  argument-hint: "[\"설명\"|SPEC-ID]"
  allowed-tools: Skill
  ---

  Use Skill("moai-workflow-news-production") with arguments: plan $ARGUMENTS
  ```

  `verify.md`:
  ```
  ---
  description: 뉴스 SPEC 평가만 단독 실행 (evaluator-active 호출, npm test + AC 매핑 + build)
  argument-hint: "[SPEC-ID]"
  allowed-tools: Skill
  ---

  Use Skill("moai-workflow-news-production") with arguments: verify $ARGUMENTS
  ```
- 검증: acceptance.md AC-CMD-1~4 모두 통과 (파일 존재 + LOC + frontmatter 키 + Skill 위임 라인 + 분기 부재).

### Stage 5 — Pilot Dry-Run on SPEC-NEWS-REVISE-001 [Priority Medium]

- 목적: 본 하네스 도입 직후 *한 번* SPEC-NEWS-REVISE-001을 대상으로 `/news verify` 단독 실행하여 다음을 확인.
  - 워크플로우 스킬의 Intent Router가 `verify` 인텐트로 evaluator-active를 호출.
  - evaluator-active가 must-pass 3 조건(Jest / AC 매핑 / build)을 정확히 평가.
  - Slack 알림(또는 fallback) 1회 전송.
- 담당: MoAI 오케스트레이터 (사람이 `/news verify SPEC-NEWS-REVISE-001`을 호출).
- 검증:
  - 점수 카드가 4 dimension × 0.0~1.0 형태로 산출.
  - `npm test --prefix web` 종료코드 기록.
  - `npm run build --prefix web` 종료코드 기록.
  - acceptance.md AC-EVAL-5 통과 (실 검증 절차가 trees에서 실행 가능).
- 게이트: dry-run에서 FAIL 발견 시, 그 FAIL이 (a) 본 하네스의 결함인지, (b) SPEC-NEWS-REVISE-001 자체의 미완성인지 분류. (a) 면 Stage 2~4 재작업. (b) 는 본 SPEC 책임 아님 (Risk R7).

### Stage 6 — Slack tech-day 채널 보고 [Priority High]

- 목적: CLAUDE.md HARD 규칙 "각 작업이 끝날 때마다 Slack의 tech-day 채널로 내용 전달" 준수.
- 산출물: Slack 채널 `C0B69CG59UM`에 한국어 메시지 1회 전송:
  ```
  [SPEC-HARNESS-NEWS-001 도입 완료]
  - 산출물: skills 2종 (moai-domain-news-editor, moai-workflow-news-production), commands 3종 (/news produce|plan|verify), SPEC 3 파일
  - 검증: /news verify SPEC-NEWS-REVISE-001 dry-run 결과 (PASS/FAIL/점수)
  - 다음 액션: SPEC-NEWS-REVISE-002 도입 후 /news produce SPEC-NEWS-REVISE-002 호출 가능
  - 잔여 결정: Risk R1/R3/R7 답변 필요 (해당 시)
  ```
- 담당: MoAI 오케스트레이터 (Slack MCP 또는 사람 발송).
- 검증: Slack 채널에 메시지 노출 확인. MCP 부재 시 `.moai/state/slack-pending.md` 파일 존재.

### Stage 7 — 최종 회귀 검증 [Priority High]

- 검증 명령 (각각 종료코드 0 또는 단언 통과 필요):
  1. `ls D:/agents/tech_day/.moai/specs/SPEC-HARNESS-NEWS-001/` → 3 파일 (spec.md / plan.md / acceptance.md).
  2. `ls D:/agents/tech_day/.claude/skills/moai-domain-news-editor/SKILL.md` → 존재.
  3. `ls D:/agents/tech_day/.claude/skills/moai-workflow-news-production/SKILL.md` → 존재.
  4. `ls D:/agents/tech_day/.claude/commands/news/` → produce.md / plan.md / verify.md 3 파일.
  5. acceptance.md 전 AC 체크리스트가 검증 명령과 함께 매핑.
  6. `git status --short` → `web/` 변경 없음, 기존 SPEC 디렉터리 변경 없음, 기존 `.claude/agents/` 변경 없음.
  7. SPEC-NEWS-REVISE-001/002 회귀 없음 (`npm test --prefix web` 결과 Stage 5와 동일).
- 게이트: 위 7 검증이 모두 PASS면 본 SPEC `Status: Plan → Run` 으로 전이 가능. FAIL 시 해당 Stage로 회귀.

---

## 2. 위임 매트릭스 (Delegation Matrix)

| Stage | 담당 에이전트/스킬 | 주요 위임 도구 | 산출물 경로 |
|-------|------------------|------------|-----------|
| 1 | manager-spec (현재) | Write, Read, Grep | `.moai/specs/SPEC-HARNESS-NEWS-001/{spec,plan,acceptance}.md` |
| 2 | builder-skill | Write, Read, Grep, Glob | `.claude/skills/moai-domain-news-editor/SKILL.md` |
| 3 | builder-skill | Write, Read, Grep, Glob | `.claude/skills/moai-workflow-news-production/SKILL.md` |
| 4 | manager-spec (직접) | Write | `.claude/commands/news/{produce,plan,verify}.md` |
| 5 | MoAI 오케스트레이터 | `/news verify` 슬래시 호출 → 본 하네스의 워크플로우 스킬이 evaluator-active로 위임 | 점수 카드 + Slack 알림 |
| 6 | MoAI 오케스트레이터 (Slack MCP 또는 사람) | Slack 전송 | 채널 `C0B69CG59UM` 메시지 |
| 7 | MoAI 오케스트레이터 + manager-quality (선택) | Bash (ls/grep), Read | 검증 보고 |

---

## 3. 위험과 완화 (Plan-Level Risks)

| 위험 | 완화 |
|------|------|
| Stage 2/3 builder-skill 호출 시 컨텍스트 누락 | Stage 별 위임 입력 목록을 본 plan.md에 명시 (위 Stage 2/3 "위임 입력" 섹션). builder-skill 호출 prompt에 본 plan.md + spec.md + news.md + design constitution 절을 모두 인용 |
| Stage 5 dry-run에서 SPEC-NEWS-REVISE-001 자체가 FAIL (Risk R7 그림자) | acceptance.md AC-EVAL-5는 "검증 절차가 실행 가능"만 요구. 점수 자체의 PASS 여부는 본 SPEC의 책임이 아님 — Stage 5 결과는 Slack 보고에 기록만 |
| Stage 6 Slack MCP 부재 | REQ-HARNESS-SLACK Optional 절 fallback 활용. `.moai/state/slack-pending.md` 작성 → 사람이 수동 전송 |
| Stage 4 thin wrapper 작성 시 본문에 분기/agent 호출 누출 | 본 plan.md의 Stage 4 템플릿을 *복사 = 정답*. 본문 추가 라인 일체 금지. AC-CMD-4 grep으로 강제 |
| 본 SPEC 도입 도중 `news.md` 변경 발생 | 본 plan.md Pre-conditions에 "변경 금지" 명시. 변경 발생 시 본 SPEC 자체를 재검토 (HISTORY 항목 추가) |

---

## 4. 다음 단계 (Hand-off)

본 plan.md 승인 후, MoAI 오케스트레이터는 Stage 2를 다음 형식으로 위임한다 (예시):

> Use the **builder-skill** subagent to create the file `D:\agents\tech_day\.claude\skills\moai-domain-news-editor\SKILL.md` per SPEC-HARNESS-NEWS-001 REQ-HARNESS-SKILL-DOMAIN. Required inputs: spec.md REQ-HARNESS-SKILL-DOMAIN section verbatim, plan.md Stage 2 (this section), `D:\agents\tech_day\news.md` as source-of-truth, SPEC-NEWS-REVISE-001/spec.md for lifecycle/12-fields/shortcut tables, design tokens (`--yh-blue` `#0A4DA6` etc.). Frontmatter must use folded scalar `description: >`, CSV `allowed-tools: Read, Grep, Glob, Bash`, quoted `metadata.*` values, `triggers.{keywords, agents, phases}` arrays. Body follows Progressive Disclosure 3-tier under 500 LOC. Must satisfy AC-DOMAIN-1~5 in `.moai/specs/SPEC-HARNESS-NEWS-001/acceptance.md`.

Stage 3 동일 패턴, REQ-HARNESS-SKILL-WORKFLOW + REQ-HARNESS-PIPELINE + REQ-HARNESS-EVAL + REQ-HARNESS-SLACK 입력.

Stage 4는 manager-spec이 직접 Write로 3 파일 작성.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-03
