---
name: moai-workflow-news-production
description: >
  뉴스 제작 시스템 하네스 워크플로 — /news produce/plan/verify 라우팅,
  news.md/SPEC 기반 manager-spec → expert-frontend → evaluator-active
  GAN 루프 오케스트레이션, Slack tech-day 결과 보고를 캡슐화한다.
  evaluator-active의 PASS 기준(Jest + AC + build 무경고, must-pass)과
  편향 방지 5 메커니즘(rubric/baseline/firewall/re-eval/anti-pattern)을
  명문화한다.
license: Apache-2.0
allowed-tools: Agent, AskUserQuestion, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet, Read, Write, Edit, Glob, Grep, Bash
argument-hint: "<produce|plan|verify> [SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]"
metadata:
  version: "0.1.0"
  category: "workflow"
  status: "active"
  updated: "2026-06-03"
  tags: "news, harness, gan-loop, slack, pipeline"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords:
    - /news
    - news produce
    - news plan
    - news verify
    - news.md
    - harness
    - 뉴스 하네스
  agents:
    - manager-spec
    - expert-frontend
    - evaluator-active
    - manager-git
    - manager-docs
  phases:
    - plan
    - run
    - sync
---

## HISTORY

- 2026-06-03 (v0.1.0): 최초 작성. SPEC-HARNESS-NEWS-001 의 REQ-HARNESS-SKILL-WORKFLOW + REQ-HARNESS-PIPELINE + REQ-HARNESS-EVAL + REQ-HARNESS-SLACK 충족.

---

## 1. Authority References (단일 인용, 중복 본문 금지)

본 스킬은 다음 출처의 규칙을 *직접 인용*만 한다. 규칙 자체의 본문 복제는 금지하며, 모순 발견 시 출처를 먼저 수정한다.

- `D:\agents\tech_day\.moai\specs\SPEC-HARNESS-NEWS-001\spec.md` — 본 스킬의 EARS 6 REQ 출처. 모든 본문 규약은 이 SPEC에서 파생.
- `D:\agents\tech_day\.claude\rules\moai\design\constitution.md` — Section 4 (Pipeline Architecture) / Section 11 (GAN Loop Contract + Sprint Contract Protocol) / Section 12 (Evaluator Leniency Prevention 5 메커니즘) 직접 인용.
- `D:\agents\tech_day\.claude\skills\moai-domain-news-editor\SKILL.md` — **도메인 지식은 본 스킬에 두지 않고 도메인 스킬에 위임**. 권한 매트릭스, 생애주기, 12 공통정보, 단축키, 인라인 임베딩, 디자인 토큰은 모두 도메인 스킬에서 로드.
- `D:\agents\tech_day\news.md` — source-of-truth. `--from-newsmd` 분기에서 변경 감지 단위(섹션 헤더 `^#`/`^##`).
- `D:\agents\tech_day\CLAUDE.md` — Slack tech-day 채널 보고 의무, 디자인 토큰(파란색/흰색), DB 삭제 금지, 한국어 응답.
- `D:\agents\tech_day\.claude\rules\moai\core\agent-common-protocol.md` — subagent MUST NOT prompt user (AskUserQuestion 호출 금지 근거).
- `.moai/config/sections/design.yaml` — GAN Loop 기본값 (`max_iterations: 5`, `pass_threshold: 0.75`, `escalation_after: 3`, `improvement_threshold: 0.05`).

---

## 2. Quick Reference (Level 1)

| 인텐트 | 한 줄 정의 | 위임 시퀀스 |
|--------|----------|-----------|
| `produce` | 닫힌 루프 제작 (SPEC → 구현 → 평가 → Slack) | manager-spec → expert-frontend → evaluator-active → (GAN 루프 또는 manager-docs/manager-git) |
| `plan` | SPEC 생성/갱신 단일 단계 | manager-spec 단독 (구현·평가 진입 금지) |
| `verify` | 평가 단독 실행 | evaluator-active 단독 |

- Slack 보고 채널: `C0B69CG59UM` (tech-day) — 모든 인텐트가 종료 시 1회 메시지 전송.
- 도메인 지식: `Skill("moai-domain-news-editor")` 로 항상 함께 로드.
- 본 스킬은 *subagent 컨텍스트*에서 동작 — `AskUserQuestion` 호출 금지. 사람 결정은 MoAI 오케스트레이터로 stagnation report 반환.

---

## 3. Intent Router

### 3.1 입력

`$ARGUMENTS` 의 첫 단어를 인텐트로 사용한다. 나머지 토큰은 해당 인텐트의 위임 prompt 로 그대로 전달된다 (`moai` SKILL.md Priority 1 패턴 차용).

### 3.2 분기 매트릭스

| 첫 단어 | 인텐트 | 본문 라우팅 | Phase 활성 |
|--------|-------|-----------|-----------|
| `produce` | **produce** — 닫힌 루프 제작 | Phase 1 → 2 → 3 → 4 전체 | Spec / Build / Evaluate / Loop or Sync |
| `plan` | **plan** — SPEC 생성/갱신만 | Phase 1 만 | Spec |
| `verify` | **verify** — 평가만 | Phase 3 만 | Evaluate |
| (기타) | 매치 실패 | stagnation report 반환 | — |

### 3.3 인텐트별 인자 패턴

- `produce [SPEC-ID|--from-newsmd] [--resume] [--harness thorough|standard] [--max-iterations N]`
  - `SPEC-ID` 명시: 해당 SPEC을 대상으로 Phase 2~4 진입 (Phase 1 은 `--resume` 일 때 skip).
  - `--from-newsmd`: `news.md` 와 `.moai/specs/SPEC-NEWS-*/` 의 `## HISTORY` 마지막 갱신을 비교해 미반영 헤더 섹션을 추출 → manager-spec 에게 SPEC-NEWS-REVISE-NNN 신규/갱신 위임 → 그 SPEC을 대상으로 본 루프 진입. 비교 단위는 `news.md` 의 `^#`/`^##` 헤더 섹션 (SPEC-HARNESS-NEWS-001 Risk R6 휴리스틱).
  - `--resume SPEC-XXX`: 기존 SPEC의 미완 라운드부터 GAN 루프 재진입.
  - `--harness thorough`: Sprint Contract Protocol 활성 (Section 6.4).
  - `--max-iterations N`: 기본값 5 를 override (단 0.60 floor 와는 무관).
- `plan ["설명"|SPEC-ID]`: manager-spec 단일 위임. 인자가 설명 문자열이면 신규 SPEC 생성, SPEC-ID 면 해당 SPEC `## HISTORY` 항목 추가.
- `verify [SPEC-ID]`: evaluator-active 단독 위임. Phase 1/2/4 진입 금지.

---

## 4. Pipeline 4 Phase 계약

| Phase | 위임 대상 에이전트 | 입력 | 출력 | Skip 가능? |
|-------|------------------|------|------|-----------|
| **1. Spec** | manager-spec | `news.md` + 사용자 설명 (또는 기존 SPEC-ID) | `.moai/specs/SPEC-NEWS-*/{spec,plan,acceptance}.md` 신규 또는 갱신 | **NO (FROZEN)** — design constitution Section 2 차용. `verify` 인텐트에서만 우회 |
| **2. Build** | expert-frontend | spec.md + acceptance.md | 변경 파일 목록 (`git diff` 기준, `web/src/**`) | YES — `verify` 인텐트 시 skip |
| **3. Evaluate** | evaluator-active | SPEC-ID + 변경 파일 목록 + acceptance.md | 점수 카드 (Design Quality / Originality / Completeness / Functionality, 각 0.0~1.0) | **NO (FROZEN)** — design constitution Section 2 차용 |
| **4. Loop or Sync** | (조건부) manager-spec 재위임 또는 manager-git/manager-docs | 점수 카드 + 누적 라운드 수 | 다음 라운드 SPEC 보강, 또는 PR/문서 동기화 | 조건부 — 점수 ≥ pass_threshold 면 sync, 미달이면 loop, stagnation 이면 escalation |

**FROZEN 단언** (design constitution Section 2 / SPEC-HARNESS-NEWS-001 REQ-HARNESS-PIPELINE Unwanted):
- Phase 1 Spec 과 Phase 3 Evaluate 는 **어떤 인텐트에서도 skip 불가** (단, `verify` 는 Phase 1 의 결과물을 *입력*으로 사용하므로 spec.md 가 이미 존재해야 한다).
- `pass_threshold` 를 **0.60 미만으로 낮추지 않는다**. 기본값 0.75 는 design.yaml 정합. `--max-iterations` override 가능하나 threshold floor 는 변경 불가.

---

## 5. GAN Loop Contract (Phase 4 — loop 분기)

### 5.1 핵심 파라미터 (design.yaml `gan_loop` 정합)

| 키 | 기본값 | 의미 |
|----|--------|------|
| `pass_threshold` | `0.75` | 종합 점수 ≥ 0.75 → PASS, sync 진입 |
| `max_iterations` | `5` | 누적 라운드 상한. 도달 시 FAIL 분류 + Slack 보고 |
| `escalation_after` | `3` | 3 라운드 미통과 후 evaluator-active 가 상세 실패 보고서 산출 |
| `improvement_threshold` | `0.05` | 인접 라운드 점수 개선폭 < 0.05 → 정체(stagnation) 후보 |
| `floor` | `0.60` | **FROZEN** — `pass_threshold` 절대 하한 |

### 5.2 루프 종료 조건 (3 종)

1. **PASS** — 점수 ≥ `pass_threshold` (0.75). Phase 4 sync 분기로 진입 (manager-git PR 생성 또는 manager-docs 동기화).
2. **FAIL** — 누적 라운드가 `max_iterations` (5) 도달 후에도 점수 < `pass_threshold`. Slack 알림에 FAIL 사유와 마지막 점수 카드 포함.
3. **STAGNATION** — 개선폭 < `improvement_threshold` (0.05) 가 **2 라운드 연속**. Section 7 의 stagnation 에스컬레이션 시퀀스 진입.

### 5.3 라운드 진행 시퀀스

라운드 N (N = 1..max_iterations):

1. (조건부) Sprint Contract 협상 — Section 6.4 의 활성 조건.
2. expert-frontend 위임: 직전 라운드 evaluator-active feedback + Sprint Contract 체크리스트 + spec.md/acceptance.md 를 *one-turn fully-loaded prompt* 로 주입 (Opus 4.7 prompt philosophy).
3. expert-frontend 가 `web/src/**` 변경 산출 (본 스킬은 직접 Write 하지 않는다 — Out of Scope Section 9).
4. evaluator-active 위임: Section 6 의 Must-Pass Firewall + 4 차원 점수 + 편향 방지 5 메커니즘 적용.
5. 점수 카드 산출 → 종료 조건 평가 → 다음 라운드 또는 sync 또는 stagnation.

### 5.4 Sprint Contract Protocol 활성 규칙

design constitution Section 11 직접 인용:

- `--harness thorough`: **[HARD]** Sprint Contract 필수. 매 라운드 시작 시 evaluator-active 가 acceptance.md 기반 체크리스트 발행 → expert-frontend 검토 → 합의 후 구현. 산출물은 `.moai/sprints/SPEC-XXX/round-N.md` 에 기록.
- `--harness standard` (기본): Sprint Contract optional. evaluator-active 의 일반 rubric 만 적용.
- `--harness` 미지정: `standard` (SPEC-HARNESS-NEWS-001 Risk R3 가정대로 진행).
- **[HARD]** Sprint Contract 에 포함되지 않은 임의 기준으로 점수 가산/차감 금지 (design constitution Section 11 [HARD]).

---

## 6. Evaluator Active PASS 계약

본 섹션은 evaluator-active 위임 prompt 에 *one-turn fully-loaded* 로 주입되는 규약이다 (SPEC-HARNESS-NEWS-001 Risk R4 대응).

### 6.1 Must-Pass Firewall (3 조건, 합산 평균 금지)

design constitution Section 12 Mechanism 3 직접 인용. 셋 중 **하나라도 실패** 시 4 차원 점수가 아무리 높아도 무조건 FAIL — *nice-to-have 고득점으로 보상 불가*.

| 조건 | 검증 명령 | 통과 기준 |
|------|---------|---------|
| (a) Jest 통과 | `npm test --prefix web` | 종료코드 0 (모든 테스트 통과) |
| (b) AC 매핑 | acceptance.md 의 각 AC ↔ `web/src/view/*.test.{js,jsx}` 의 `it`/`test` 케이스 매핑 확인 | 매핑 누락 0 건. 누락 발견 시 누락 AC ID + 권장 테스트 파일 경로를 Slack 메시지에 포함 |
| (c) Vite build 무경고 | `npm run build --prefix web` | 종료코드 0, stderr 에 `warning` 또는 `error` 키워드 0 회 |

위 3 조건이 모두 성립할 때만 PASS 후보. averaging not allowed (합산 평균 금지).

### 6.2 4 차원 점수 (각 0.0~1.0, design.yaml 차원 명 정합)

| 차원 | 의미 (뉴스 도메인 적용) |
|------|---------------------|
| **Design Quality** | 연합뉴스 디자인 토큰(`--yh-blue` `#0A4DA6` 등) 정합, 신문형 레이아웃 밀도, 색 규칙(제목 파란색 / 부제목 빨간색 / 본문 검정) 준수 |
| **Originality** | 뉴스 도메인의 의도(예: Z 권한 가시성, Alt+Y 골드 색)를 코드가 자연스럽게 표현하는가 — 단순 SPEC 복제 이상의 명료함 |
| **Completeness** | spec.md 의 모든 REQ 와 acceptance.md 의 모든 AC 가 코드/테스트에 매핑되는가 |
| **Functionality** | Jest + 사람 dry-run 으로 본 작동이 확인되는가 (Must-Pass Firewall 통과가 전제) |

### 6.3 차원별 Rubric Anchoring 예시 (design constitution Section 12 Mechanism 1)

| 점수 | Design Quality 예 | Originality 예 | Completeness 예 | Functionality 예 |
|------|-----------------|--------------|----------------|---------------|
| 0.25 | 디자인 토큰 미사용, 임의 색상 | SPEC 문장을 그대로 주석에 복제 | REQ 의 절반 이하만 코드 | Jest 다수 실패 |
| 0.50 | 일부 토큰 적용, 본문 색 규칙 부분 위반 | 일부 의도 표현, 일부 누락 | 핵심 REQ 만 매핑 | Jest 통과, build 경고 |
| 0.75 | 토큰 일관 적용, 색 규칙 준수, 1px 회색선 적용 | 도메인 의도 코드로 명료 | 모든 AC 매핑, 일부 edge case 누락 | Jest+build 통과, 1~2개 edge fail |
| 1.0 | 디자인 토큰 + 신문형 밀도 + 헤더 레드 바 완벽 정합 | 도메인 사실이 코드 구조에 그대로 반영 (예: 권한 매트릭스가 단일 매핑 객체로) | 모든 AC + edge case + 회귀 가드 | Jest+build+dry-run 모두 PASS |

### 6.4 편향 방지 5 메커니즘 (design constitution Section 12 직접 인용)

| # | 메커니즘 | 본 하네스 적용 규칙 |
|---|---------|---------------------|
| 1 | **Rubric Anchoring** | 위 6.3 표를 evaluator-active prompt 에 그대로 주입. 점수 산출 시 해당 차원의 0.25/0.50/0.75/1.0 예시 중 하나를 *반드시 인용* |
| 2 | **Regression Baseline** | 직전 SPEC-NEWS-REVISE-NNN 의 점수 평균과 비교, 본 SPEC 점수가 +0.15 이상 상회 시 review flag 부여 (Slack 메시지에 "baseline review needed" 추가) |
| 3 | **Must-Pass Firewall** | 위 6.1 의 3 조건. FROZEN — 본 스킬에서 변경 불가 |
| 4 | **Independent Re-evaluation** | 매 5 번째 SPEC 실행 시 동일 입력으로 evaluator-active 를 2 회 호출, ±0.10 이내 정합 검증. 분기 발생 시 calibration review 를 Slack 알림에 포함 |
| 5 | **Anti-Pattern Cross-check** | `.moai/research/observations/` 의 anti-pattern 과 일치 시 해당 차원 점수 ≤ 0.50 으로 캡. 본 하네스는 news 도메인 anti-pattern 으로 (예) "Z 권한이 고침/포털고침 메뉴를 보유" 같은 권한 매트릭스 위반을 등록 |

---

## 7. Stagnation Escalation (subagent boundary 준수)

`agent-common-protocol.md` HARD: **subagent 는 AskUserQuestion 을 호출하지 않는다**. 본 스킬도 동일.

### 7.1 정체 감지

- 조건: 인접 라운드 점수 개선폭 < `improvement_threshold` (0.05) 가 **2 라운드 연속**.
- 또는: `escalation_after` (3) 라운드 미통과.

### 7.2 정체 시퀀스

1. **1차 시도** — manager-spec 에게 SPEC 보강을 재위임 (한 번에 한 번). 입력: 직전 라운드 evaluator feedback + 현 spec.md/acceptance.md. 결과 SPEC 으로 GAN 루프 1 라운드 재시도.
2. **회복 실패** — 1차 시도 후에도 개선폭 < 0.05 → stagnation report 를 MoAI 오케스트레이터로 **return** (subagent 가 직접 호출 금지). report 에는 `최종 점수 카드 · 라운드 history · evaluator feedback 요약 · 권장 옵션 3종 (criteria 조정 / force-pass / restart)` 포함.
3. **사람 결정** — MoAI 오케스트레이터만이 AskUserQuestion 으로 사용자에게 옵션 제시. `allowed-tools` CSV 에 `AskUserQuestion` 키워드가 등록되어 있으나 **본 스킬 본문에서 호출하지 않는다** (등록은 메타데이터 명시 목적).

---

## 8. Slack tech-day 보고

CLAUDE.md HARD 규칙 "각 작업이 끝날 때마다 Slack 의 tech-day 채널로 내용 전달" 준수.

### 8.1 채널 + 전송 도구

- 채널 ID: **`C0B69CG59UM`** (이름: **tech-day**).
- 호출 도구: `mcp__slack__slack_post_message` (Slack MCP).
- 트리거: `produce` 종료 (PASS/FAIL/timeout/stagnation 전부) 및 `verify` 종료. silent skip 금지.

### 8.2 produce 메시지 6 필드 포맷 (한국어)

```text
📰 뉴스 제작 하네스 결과 — <SPEC-ID>
• SPEC ID: <SPEC-NEWS-REVISE-NNN>
• 최종 점수: <0.00~1.00> (Design <x>, Originality <y>, Completeness <z>, Functionality <w>)
• 통과 AC: <n>/<total>
• GAN 라운드: <round>/<max_iterations>
• 종료 사유: PASS / FAIL / timeout / stagnation
• 다음 액션: <한 줄 제안 — 예: `/news produce SPEC-XXX --resume` 또는 manager-spec 재위임 권장>
```

### 8.3 verify 메시지 (짧은 한 줄 요약)

- PASS 시: `✅ <SPEC-ID> verify PASS — 점수 <0.00~1.00>, AC <n>/<total>, build OK`.
- FAIL 시: `❌ <SPEC-ID> verify FAIL — 실패 AC: <AC-X-1, AC-X-2, ...> (최대 5건), 다음 액션: /news produce <SPEC-ID>`.

### 8.4 종료 사유 분기 (silent failure 금지)

| 종료 사유 | Slack 알림 의무 | 메시지 강조점 |
|----------|----------------|-------------|
| PASS | 필수 | 최종 점수, 통과 AC, 다음 액션(sync) |
| FAIL | 필수 — silent 금지 | 마지막 점수 카드, 실패 AC, 다음 액션(SPEC 보강 권장) |
| timeout | 필수 — silent 금지 | max_iterations 도달, 마지막 점수, 다음 액션(`--resume` 권장) |
| stagnation | 필수 — silent 금지 | 정체 라운드, 개선폭 history, 다음 액션(criteria 재협상) |

### 8.5 MCP 부재 시 fallback

`mcp__slack__*` 도구 호출 실패 또는 토큰 부재 환경:

1. 동일 6 필드 메시지를 stdout 으로 출력 (사람 인지).
2. `.moai/state/slack-pending.md` 파일에 동일 메시지를 append (`---` 구분선 + 타임스탬프 prefix). 디렉터리가 없으면 생성.
3. 사람 발송을 안내하는 한 줄을 stdout 에 함께 출력.

silent skip 절대 금지 — 위 3 단계는 모든 종료 사유에서 동일하게 적용된다.

### 8.6 언어

- prose 는 모두 한국어 (CLAUDE.md + agent-common-protocol.md Language Handling).
- SPEC ID · 점수 · 파일 경로 · 라운드 수 등 기술적 식별자만 영문/숫자.

---

## 9. Out of Scope (재명시)

본 스킬은 *오케스트레이션*만 책임진다. 다음은 명시적 비목표이며, 본 스킬 본문에서 직접 수행하지 않는다.

- **`web/` 코드 직접 변경** — expert-frontend 에게 위임. 본 스킬은 `Write`/`Edit` 도구를 `web/` 경로에 사용하지 않는다.
- **새 `.claude/agents/` 정의 또는 수정** — 기존 manager-spec / expert-frontend / evaluator-active / manager-git / manager-docs 만 재사용.
- **DB 스키마/데이터 변경** — CLAUDE.md HARD ("DB에 있는 내용은 삭제하지 않는다").
- **수집/배부 시스템** — CLAUDE.md "현재 구현 범위는 제작 시스템만 진행".
- **AskUserQuestion 직접 호출** — agent-common-protocol.md HARD. `allowed-tools` 등록은 메타데이터 차원이며 본문 호출은 MoAI 오케스트레이터에 위임한다 (Section 7).
- **새 CSS 디자인 토큰 정의** — 기존 토큰만 사용 (도메인 스킬 참조).
- **시간 추정** — agent-common-protocol.md HARD. 우선순위만 표기 (High/Medium/Low).
- **도메인 사실의 본문 기록** — 권한 매트릭스 / 생애주기 / 12 공통정보 / 단축키 / 임베딩 / 디자인 토큰은 본 스킬 본문에 *복제 금지*. 항상 `moai-domain-news-editor` 에서 로드.

---

## 10. Works Well With

- **`moai-domain-news-editor`** — 본 스킬이 사용하는 모든 도메인 사실의 단일 출처. 본 워크플로우 스킬은 도메인 지식을 도메인 스킬에 위임한다. 위임 prompt 작성 시 반드시 함께 로드한다.
- `moai-workflow-spec` — manager-spec 위임의 기반.
- `moai-workflow-gan-loop` — 일반 design 도메인의 GAN 루프 패턴. 본 스킬은 그 패턴을 news 도메인에 특화.
- `moai-foundation-core` — TRUST 5 / SPEC-First / Delegation Patterns.
- `moai-foundation-cc` — Claude Code 표준 (frontmatter / progressive disclosure / hooks).
- `moai-ref-testing-pyramid` — Jest + AC 매핑 평가 시 참조.
- `moai-ref-react-patterns` — expert-frontend 위임 prompt 에 함께 주입.
