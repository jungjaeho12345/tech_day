# SPEC-HARNESS-NEWS-001 — Acceptance Criteria (Flattened Checklist)

**대상 평가자**: evaluator-active (그리고 사람 검토자).
**용도**: 본 체크리스트의 모든 항목이 PASS이면 SPEC-HARNESS-NEWS-001 도입은 PASS. 하나라도 FAIL이면 본 SPEC FAIL.
**총 AC 개수**: 30개 (CMD 4 + DOMAIN 5 + WORKFLOW 5 + PIPELINE 4 + EVAL 5 + SLACK 5 + DRY-RUN 2).

각 항목 형식:

```
- [ ] AC-XXX-N  (REQ-매핑)
      검증 명령: <bash/grep/Read 명령>
      통과 기준: <observable, 단언 가능한 조건>
```

---

## 1. REQ-HARNESS-CMD — 슬래시 명령 표면 (4 AC)

- [ ] **AC-CMD-1** (REQ-HARNESS-CMD)
  - 검증 명령: `ls D:/agents/tech_day/.claude/commands/news/ && wc -l D:/agents/tech_day/.claude/commands/news/*.md`
  - 통과 기준: `produce.md`, `plan.md`, `verify.md` 3 파일 존재. 각 파일 전체 LOC 가 12 미만(`---` frontmatter 5라인 + 빈 라인 + Skill 라인 1 + EOF).

- [ ] **AC-CMD-2** (REQ-HARNESS-CMD)
  - 검증 명령: 각 파일을 `Read` 한 뒤 frontmatter 블록 (`---` 사이)의 키를 검사.
  - 통과 기준: 3 파일 각각의 frontmatter에 `description` (1 문장), `argument-hint` (문자열), `allowed-tools: Skill` (CSV string, 정확히 `Skill` 만) 3 키가 모두 존재.

- [ ] **AC-CMD-3** (REQ-HARNESS-CMD)
  - 검증 명령: `Grep` pattern `^Use Skill\("moai-workflow-news-production"\) with arguments: (produce|plan|verify) \$ARGUMENTS$` in `D:/agents/tech_day/.claude/commands/news/*.md`.
  - 통과 기준: 3 파일 각각에서 정확히 1개의 매치. produce.md → `produce $ARGUMENTS`, plan.md → `plan $ARGUMENTS`, verify.md → `verify $ARGUMENTS`. 본문에 다른 비공백 라인 없음.

- [ ] **AC-CMD-4** (REQ-HARNESS-CMD)
  - 검증 명령: `Grep` pattern `\b(if|when|case|switch|Agent\(|agent\(|manager-|expert-|evaluator-)` in `D:/agents/tech_day/.claude/commands/news/*.md` (frontmatter 제외 본문만, 즉 두 번째 `---` 이후).
  - 통과 기준: 매치 0개. (분기/조건/agent 직접 호출이 .md 본문에 누출되지 않음. SPEC-THIN-CMDS-001 강제.)

---

## 2. REQ-HARNESS-SKILL-DOMAIN — 도메인 지식 스킬 (5 AC)

- [ ] **AC-DOMAIN-1** (REQ-HARNESS-SKILL-DOMAIN)
  - 검증 명령: `Read D:/agents/tech_day/.claude/skills/moai-domain-news-editor/SKILL.md` + YAML 파싱.
  - 통과 기준: 파일 존재 + frontmatter 파싱 성공 + `name: moai-domain-news-editor`, `allowed-tools: Read, Grep, Glob, Bash` (정확히 4 도구 CSV), `metadata.category: "domain"`, `metadata.status: "active"`, `triggers.keywords` 배열에 `news`, `RDS`, `Alt+Y`, `Ctrl+D`, `` 5 키워드 모두 포함.

- [ ] **AC-DOMAIN-2** (REQ-HARNESS-SKILL-DOMAIN)
  - 검증 명령: `Grep` patterns `RDS`, `RRH`, `RRK`, `DPS`, `DDH`, `DDK` in SKILL.md.
  - 통과 기준: 6 상태값 모두 매치. 추가로 본문에 권한 R/D × 액션(송고/보류/KILL) × 결과 상태 매트릭스가 markdown 표 형식 (`| ... | ... |` 헤더 + 구분 라인 + 데이터 라인 6 줄 이상)으로 존재.

- [ ] **AC-DOMAIN-3** (REQ-HARNESS-SKILL-DOMAIN)
  - 검증 명령: `Grep` 12 단어 in SKILL.md (한 줄에 모두 등장 가능): `작성자`, `공동작성`, `내용`, `지역`, `속성`, `키워드`, `내부코멘트`, `외부코멘트`, `첨부파일`, `자료파일`, `엠바고`, `2차 엠바고`.
  - 통과 기준: 12 단어 모두 본문에 등장 (한 섹션 내 권장).

- [ ] **AC-DOMAIN-4** (REQ-HARNESS-SKILL-DOMAIN)
  - 검증 명령: `Grep` patterns `#0A4DA6`, `#08306B`, `#DDE3EC`, `Noto Sans KR`, `Noto Serif KR`, `Nanum Myeongjo`, `--yh-blue`, `--yh-blue-deep`, `--yh-gray-line` in SKILL.md.
  - 통과 기준: 9 패턴 모두 매치.

- [ ] **AC-DOMAIN-5** (REQ-HARNESS-SKILL-DOMAIN)
  - 검증 명령: `Grep` patterns `Intent Router`, `GAN Loop`, `pass_threshold`, `max_iterations`, `Sprint Contract` in SKILL.md.
  - 통과 기준: 이 5 패턴이 본문 *오케스트레이션 로직*으로 등장하지 않음 (단, `## Works Well With` 또는 `## Authority References` 섹션에서 `moai-workflow-news-production` 스킬 또는 design constitution을 참조하는 1~3 라인 정도는 허용 — 해당 라인은 단순 인용일 뿐 로직 정의가 아님을 사람 검토자가 확인).

---

## 3. REQ-HARNESS-SKILL-WORKFLOW — 오케스트레이션 스킬 (5 AC)

- [ ] **AC-WORKFLOW-1** (REQ-HARNESS-SKILL-WORKFLOW)
  - 검증 명령: `Read D:/agents/tech_day/.claude/skills/moai-workflow-news-production/SKILL.md` + YAML 파싱.
  - 통과 기준: 파일 존재 + frontmatter `name: moai-workflow-news-production`, `argument-hint` 키 존재, `allowed-tools` CSV에 `Agent`, `Skill`, `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep` 8 도구 모두 포함, `triggers.phases` 배열에 `plan`, `run`, `sync` 모두 포함.

- [ ] **AC-WORKFLOW-2** (REQ-HARNESS-SKILL-WORKFLOW)
  - 검증 명령: `Grep` patterns `produce`, `plan`, `verify` (인텐트 라우팅 컨텍스트 안에서) in SKILL.md.
  - 통과 기준: 3 인텐트가 "Intent Router" 또는 동등한 섹션 내에서 표/리스트 형식으로 등장. 각 인텐트 옆에 위임 대상이 명시: `produce` → manager-spec → expert-frontend → evaluator-active (GAN), `plan` → manager-spec only, `verify` → evaluator-active only.

- [ ] **AC-WORKFLOW-3** (REQ-HARNESS-SKILL-WORKFLOW)
  - 검증 명령: `Grep` patterns `Spec`, `Build`, `Evaluate`, `Loop` (phase 명 컨텍스트 안에서) in SKILL.md.
  - 통과 기준: 4 phase가 한 섹션에서 순서대로 등장. 표 또는 리스트로 각 phase의 (입력, 출력, 담당 에이전트) 3 컬럼 명시. Phase 1 입력에 `news.md` 또는 SPEC-ID 또는 사용자 설명, Phase 3 출력에 점수 카드 (4 차원 또는 종합 점수) 명시.

- [ ] **AC-WORKFLOW-4** (REQ-HARNESS-SKILL-WORKFLOW)
  - 검증 명령: `Grep` pattern `AskUserQuestion\(` (호출 형식, 괄호 포함) in SKILL.md.
  - 통과 기준: 매치 0개. 대신 본문에 "stagnation 시 MoAI 오케스트레이터로 stagnation report 반환" 또는 "subagent boundary: AskUserQuestion 호출 금지" 명시. `allowed-tools` CSV의 `AskUserQuestion` 키워드는 등록만 허용 (해당 라인은 호출이 아님).

- [ ] **AC-WORKFLOW-5** (REQ-HARNESS-SKILL-WORKFLOW)
  - 검증 명령: `Grep` pattern `moai-domain-news-editor` in SKILL.md.
  - 통과 기준: 최소 1회 매치. 본문 `## Works Well With` 또는 `## Authority References` 또는 동등 섹션에 도메인 스킬 명시적 참조 + "도메인 지식은 moai-domain-news-editor에 위임" 문장.

---

## 4. REQ-HARNESS-PIPELINE — 파이프라인 계약 (4 AC)

- [ ] **AC-PIPELINE-1** (REQ-HARNESS-PIPELINE)
  - 검증 명령: `Grep` 4 phase 표 in 양쪽 파일: `D:/agents/tech_day/.moai/specs/SPEC-HARNESS-NEWS-001/spec.md` 그리고 워크플로우 스킬 SKILL.md.
  - 통과 기준: 두 문서 모두에 동일한 4 phase 표 (Phase 1 Spec / Phase 2 Build / Phase 3 Evaluate / Phase 4 Loop or Sync) 존재. 각 phase 행에 입력 / 출력 / 담당 에이전트 3 컬럼 채워짐.

- [ ] **AC-PIPELINE-2** (REQ-HARNESS-PIPELINE)
  - 검증 명령: `Grep` patterns `pass_threshold.*0\.75`, `max_iterations.*5`, `improvement_threshold.*0\.05` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 3 패턴 모두 매치. 값이 design.yaml `gan_loop` 섹션과 일치 (pass_threshold=0.75, max_iterations=5, improvement_threshold=0.05).

- [ ] **AC-PIPELINE-3** (REQ-HARNESS-PIPELINE)
  - 검증 명령: `Grep` patterns `FROZEN`, `skip`, `0\.60` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: "manager-spec과 evaluator-active는 FROZEN — skip 불가" 표현이 본문에 명시. "pass_threshold floor 0.60" 또는 "pass_threshold를 0.60 미만으로 낮추지 않는다" 표현 명시.

- [ ] **AC-PIPELINE-4** (REQ-HARNESS-PIPELINE)
  - 검증 명령: `Grep` patterns `stagnation`, `manager-spec` (재위임 컨텍스트 안에서), `MoAI 오케스트레이터` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: "개선폭 < 0.05 가 2회 연속 → stagnation 분류 → manager-spec 재위임 1회 시도 → 실패 시 MoAI 오케스트레이터로 stagnation report 반환" 시퀀스가 본문에 명시 (한 단락 또는 표 또는 순차 리스트 형식).

---

## 5. REQ-HARNESS-EVAL — evaluator-active PASS 기준 (5 AC)

- [ ] **AC-EVAL-1** (REQ-HARNESS-EVAL)
  - 검증 명령: `Grep` patterns `npm test --prefix web`, `npm run build --prefix web`, `AC 매핑` (또는 `AC mapping`) in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 3 must-pass 조건이 모두 명시. "Must-Pass Firewall" 또는 "합산 평균 금지" 또는 "averaging not allowed" 표현이 동반.

- [ ] **AC-EVAL-2** (REQ-HARNESS-EVAL)
  - 검증 명령: `Grep` patterns `Design Quality`, `Originality`, `Completeness`, `Functionality`, `0\.75`, `0\.25`, `0\.50`, `1\.0` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 4 차원 명 모두 한 섹션에 등장. 각 차원에 0.25/0.50/0.75/1.0 rubric 예시(짧은 한 줄 설명이라도) 명시. pass_threshold 0.75 등장.

- [ ] **AC-EVAL-3** (REQ-HARNESS-EVAL)
  - 검증 명령: `Grep` patterns `Rubric Anchoring`, `Regression Baseline`, `Must-Pass Firewall`, `Independent Re-evaluation`, `Anti-Pattern Cross-check` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 5 메커니즘 명 모두 매치. 각 메커니즘에 한 줄 이상의 적용 규칙 설명 동반.

- [ ] **AC-EVAL-4** (REQ-HARNESS-EVAL)
  - 검증 명령: `Grep` patterns `--harness thorough`, `Sprint Contract`, `\.moai/sprints/` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 3 패턴 모두 매치. "`--harness thorough` 활성 시 Sprint Contract 필수, `standard`에서는 optional" 매핑 명시.

- [ ] **AC-EVAL-5** (REQ-HARNESS-EVAL — 실 dry-run)
  - 검증 명령:
    1. `cd D:/agents/tech_day/web && npm test` (또는 `npm test --prefix web` from repo root).
    2. `cd D:/agents/tech_day/web && npm run build` (또는 `npm run build --prefix web`).
    3. acceptance.md 본 항목의 매핑 표(아래)에서 SPEC-NEWS-REVISE-001의 각 AC가 어느 테스트 파일의 어느 `it`/`test` 케이스에 매핑되는지 사람 검토자가 확인.
  - 통과 기준:
    - 두 명령 모두 종료코드 0.
    - SPEC-NEWS-REVISE-001의 AC-Z-1~5, AC-DTL-1~6, AC-EMB-1~3, AC-CTRL-D-1~5 각각이 `web/src/view/*.test.{js,jsx}` 중 적어도 1개 케이스에 매핑됨이 확인 가능.
    - 매핑 누락 발생 시 본 AC FAIL — 누락된 AC ID와 권장 테스트 파일 경로를 Slack 메시지에 포함.

  매핑 가이드 (사람 검토자용 참고):
  | SPEC-NEWS-REVISE-001 AC | 예상 매핑 테스트 파일 |
  |------------------------|--------------------|
  | AC-Z-1, AC-Z-2, AC-Z-3, AC-Z-4, AC-Z-5 | `web/src/view/WritePage.test.jsx` |
  | AC-DTL-1, AC-DTL-2, AC-DTL-3, AC-DTL-4, AC-DTL-5, AC-DTL-6 | `web/src/view/articleDetail.test.js` |
  | AC-EMB-1, AC-EMB-2, AC-EMB-3 | `web/src/view/InlineEmbed.test.jsx`, `web/src/view/clipboardEmbed.test.js`, `web/src/view/editorCaret.test.js` |
  | AC-CTRL-D-1, AC-CTRL-D-2, AC-CTRL-D-3, AC-CTRL-D-4, AC-CTRL-D-5 | (신규) `web/src/view/editorShortcuts.test.js` 또는 `editorNewline.test.js` 확장 |

---

## 6. REQ-HARNESS-SLACK — Slack tech-day 채널 알림 (5 AC)

- [ ] **AC-SLACK-1** (REQ-HARNESS-SLACK)
  - 검증 명령: `Grep` pattern `C0B69CG59UM` in 양쪽 파일: `D:/agents/tech_day/.moai/specs/SPEC-HARNESS-NEWS-001/spec.md` 그리고 워크플로우 스킬 SKILL.md.
  - 통과 기준: 두 문서 모두에서 매치. `tech-day` 채널명도 함께 등장.

- [ ] **AC-SLACK-2** (REQ-HARNESS-SLACK)
  - 검증 명령: `Grep` patterns `SPEC ID`, `최종 점수`, `통과 AC`, `GAN`, `종료 사유`, `다음 액션` in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 6 키워드 모두 매치. 한 섹션 ("Slack 메시지 포맷" 또는 동등) 내 등장.

- [ ] **AC-SLACK-3** (REQ-HARNESS-SLACK)
  - 검증 명령: `Grep` patterns `FAIL`, `timeout`, `stagnation` (Slack 알림 컨텍스트 안에서) in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 3 분기 모두 본문에 명시. "silent failure 금지" 또는 "FAIL/timeout/stagnation 시에도 Slack 알림 전송" 단언 등장.

- [ ] **AC-SLACK-4** (REQ-HARNESS-SLACK)
  - 검증 명령: `Grep` patterns `slack-pending.md`, `stdout`, `MCP` (또는 `토큰`) in 워크플로우 스킬 SKILL.md.
  - 통과 기준: 3 패턴 모두 매치. Slack MCP 부재 시 fallback (`.moai/state/slack-pending.md` 작성 + stdout 출력) 절차 명시.

- [ ] **AC-SLACK-5** (REQ-HARNESS-SLACK)
  - 검증 명령: 워크플로우 스킬 SKILL.md 내 Slack 메시지 예시 블록 (```text``` 또는 ```markdown``` 코드 블록)을 추출하여 사람 검토자가 prose 언어 확인.
  - 통과 기준: 예시 메시지의 모든 prose 라인이 한국어. SPEC ID·점수·파일 경로·반복 횟수 등 기술적 식별자만 영문/숫자.

---

## 7. Pilot Dry-Run (2 AC, Stage 5에서 실행)

- [ ] **AC-DRY-RUN-1** (REQ-HARNESS-PIPELINE + REQ-HARNESS-EVAL + REQ-HARNESS-SLACK 통합)
  - 검증 명령: `/news verify SPEC-NEWS-REVISE-001` 슬래시 호출 → 워크플로우 스킬이 evaluator-active를 단독 위임 → 점수 카드 출력.
  - 통과 기준:
    - Intent Router가 `verify` 인텐트로 분기.
    - evaluator-active가 `npm test --prefix web` + `npm run build --prefix web` + AC 매핑 3 조건 평가 수행.
    - 점수 카드가 4 차원 × 0.0~1.0 형식으로 출력.
    - Slack 알림 또는 fallback (`.moai/state/slack-pending.md`) 1회 트리거.
    - (PASS/FAIL 자체는 본 SPEC 책임 아님 — SPEC-NEWS-REVISE-001 Risk R7 상속.)

- [ ] **AC-DRY-RUN-2** (회귀 가드)
  - 검증 명령: `git status --short` (본 SPEC 작업 완료 직후).
  - 통과 기준:
    - `web/` 하위 변경 0개 (본 작업 시작 전 미커밋 상태와 동일).
    - `.moai/specs/SPEC-AUTH-001/`, `SPEC-BACKEND-CORE-001/`, `SPEC-DB-FOUNDATION-001/`, `SPEC-FRONTEND-UI-001/`, `SPEC-NEWS-REVISE-001/`, `SPEC-UI-EDITOR-001/` 6 디렉터리 어떤 파일도 본 작업으로 신규 수정되지 않음.
    - `.claude/agents/moai/*.md` 어떤 파일도 본 작업으로 수정되지 않음.
    - 신규 untracked: `.moai/specs/SPEC-HARNESS-NEWS-001/`, `.claude/skills/moai-domain-news-editor/`, `.claude/skills/moai-workflow-news-production/`, `.claude/commands/news/` 만 허용.

---

## 8. AC ↔ REQ 매핑 요약 (집계)

| REQ | AC 개수 | AC ID |
|-----|--------|-------|
| REQ-HARNESS-CMD | 4 | AC-CMD-1, 2, 3, 4 |
| REQ-HARNESS-SKILL-DOMAIN | 5 | AC-DOMAIN-1, 2, 3, 4, 5 |
| REQ-HARNESS-SKILL-WORKFLOW | 5 | AC-WORKFLOW-1, 2, 3, 4, 5 |
| REQ-HARNESS-PIPELINE | 4 | AC-PIPELINE-1, 2, 3, 4 |
| REQ-HARNESS-EVAL | 5 | AC-EVAL-1, 2, 3, 4, 5 |
| REQ-HARNESS-SLACK | 5 | AC-SLACK-1, 2, 3, 4, 5 |
| (통합 dry-run + 회귀) | 2 | AC-DRY-RUN-1, 2 |
| **합계** | **30** | — |

---

## 9. PASS/FAIL 종합 규칙

- **PASS 조건**: 위 30개 AC 모두 체크 ([x]). 단 AC-DRY-RUN-1은 *실행 가능성*과 *알림 트리거*만 요구 — SPEC-NEWS-REVISE-001 자체의 점수 PASS/FAIL은 본 SPEC PASS 여부를 결정하지 않는다 (Risk R7).
- **FAIL 조건**: AC-CMD-* / AC-DOMAIN-* / AC-WORKFLOW-* / AC-PIPELINE-* / AC-EVAL-1~4 / AC-SLACK-* 중 하나라도 실패. AC-EVAL-5 의 매핑 누락도 FAIL. AC-DRY-RUN-2 의 회귀 발생도 FAIL.
- **Slack 보고**: PASS/FAIL 모두 채널 `C0B69CG59UM`에 한국어 결과 메시지 1회 전송. silent skip 금지.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-03
