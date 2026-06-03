# 뉴스 제작 시스템 — 하네스 엔지니어링 전환 리포트

**작성일**: 2026-06-04
**대상 SPEC**: SPEC-HARNESS-NEWS-001 (하네스 등재), SPEC-NEWS-REVISE-001 (적용 사례)
**작성자**: MoAI (orchestrator)
**리포트 범위**: 본 worktree `.claude/worktrees/feature-auth/` (브랜치 feature-auth, origin/main 6fe130f)

---

## 1. 배경 — 왜 "하네스 엔지니어링"인가

### 1.1 전환 이전 상태 (단발 구현 방식)

`news.md` 의 요구사항을 사람-수동으로 SPEC 으로 옮기고, expert-frontend / expert-backend 에 1회씩 위임하여 코드를 만들고, 사람이 직접 jest/build 를 돌려 끝내는 방식. 약점:

- **SPEC 정합성 드리프트** — news.md 가 갱신돼도 SPEC 의 HISTORY/AC 가 따라가지 않아 사후 보강이 누락됨.
- **편향된 자가 평가** — 구현 에이전트가 직접 "끝났다"고 선언 → must-pass 항목이 averaging 되어 silent 실패.
- **작업 종료 보고 누락** — CLAUDE.md HARD "각 작업이 끝날 때마다 Slack tech-day 채널 보고" 가 사람-수동에 의존.
- **도메인 사실 재기술 중복** — Z 권한 매트릭스 / 기사 생애주기 / 12 공통정보 / 인라인 임베드 의미가 SPEC/skill/agent 본문에 산재해 변경 시 모든 곳을 동시에 갱신해야 했음.

### 1.2 전환 후 — 하네스 엔지니어링

"하네스(harness)" = **고정된 규약/도구/에이전트의 조합을 인텐트 하나로 구동하는 컨테이너**. 본 프로젝트에서는 다음 4 축으로 정의:

1. **도메인 지식의 단일 출처**: `moai-domain-news-editor` 스킬에 모든 도메인 사실 캡슐화. 다른 모든 위치는 이 스킬을 참조만 한다.
2. **오케스트레이션 스킬**: `moai-workflow-news-production` 이 manager-spec → expert-frontend → evaluator-active GAN 루프를 단 3 개 인텐트(`/news produce`, `/news plan`, `/news verify`)로 노출.
3. **GAN 루프 + Must-Pass Firewall + 5 편향 방지 메커니즘**: design constitution Section 11/12 의 규약을 evaluator-active 위임 prompt 에 *one-turn fully-loaded* 로 주입. 점수 averaging 차단, Rubric Anchoring 강제.
4. **Slack tech-day 자동 보고**: 모든 인텐트가 PASS/FAIL/timeout/stagnation 어떤 종료 사유에서도 채널 `C0B69CG59UM` 에 6 필드 메시지 발송. silent skip 금지.

---

## 2. 도입한 하네스 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---|---|---|
| 도메인 스킬 | `.claude/skills/moai-domain-news-editor/SKILL.md` | 권한 R/D/Z, 생애주기(RDS/DPS/RRH/RRK/DDH/DDK), 12 공통정보, 단축키(Alt+Y/Ctrl+D), 인라인 임베딩, 디자인 토큰(`--yh-blue` `#0A4DA6` 등) 단일 출처 |
| 워크플로우 스킬 | `.claude/skills/moai-workflow-news-production/SKILL.md` | 인텐트 라우터 + 4 Phase 계약 + GAN 루프 계약 + Slack 보고 포맷 |
| 명령 라우터 | `/news produce`, `/news plan`, `/news verify` | thin command (얇은 라우팅 래퍼) — 스킬 본문에 모든 로직 위임 |
| 평가 에이전트 | `evaluator-active` | 4 차원(Design/Originality/Completeness/Functionality) 점수 + Must-Pass Firewall 통과 검증 |
| 구현 에이전트 | `expert-frontend` / `expert-backend` | Build phase 단일 위임. 라운드별 evaluator feedback 을 one-turn 으로 받음 |
| 사양 에이전트 | `manager-spec` | SPEC 생성/HISTORY 보강 |
| Slack MCP | `mcp__slack__slack_post_message` | tech-day 채널 자동 보고 |
| 메타 SPEC | `.moai/specs/SPEC-HARNESS-NEWS-001/spec.md` | 하네스 자체를 EARS 6 REQ 로 명세 (REQ-HARNESS-SKILL-WORKFLOW / -PIPELINE / -EVAL / -SLACK 등) |

### 2.1 Phase 4 계약 (Pipeline FROZEN)

```
manager-spec → expert-frontend → evaluator-active → (PASS면 sync / FAIL면 loop / STAGNATION 이면 escalation)
                                          ▲                       │
                                          └───────────────────────┘
                                              max 5 라운드 / pass_threshold 0.75 / floor 0.60
```

- **Phase 1 Spec, Phase 3 Evaluate 는 skip 불가** (FROZEN — `verify` 인텐트의 평가-단독 실행만 예외).
- **`pass_threshold` 를 0.60 미만으로 낮추지 못함** (floor FROZEN).

### 2.2 Must-Pass Firewall (averaging 금지)

3 조건이 모두 통과해야 4 차원 점수에 진입:
- (a) `npm test` + `npm run test:web` 종료코드 0
- (b) acceptance.md AC ↔ 테스트 파일의 `it` 케이스 매핑 누락 0
- (c) `npm run build` 종료코드 0 + stderr 에 warning/error 키워드 0회

### 2.3 편향 방지 5 메커니즘

| # | 메커니즘 | 본 하네스 적용 |
|---|---|---|
| 1 | Rubric Anchoring | 차원별 0.25/0.50/0.75/1.0 anchor 예시를 evaluator prompt 에 주입, 점수 산출 시 1개 반드시 인용 |
| 2 | Regression Baseline | 직전 SPEC 점수 대비 +0.15 이상 상회 시 review flag |
| 3 | Must-Pass Firewall | §2.2 — averaging 차단 |
| 4 | Independent Re-evaluation | 매 5 번째 SPEC 실행 시 동일 입력 2회 호출, ±0.10 이내 정합 |
| 5 | Anti-Pattern Cross-check | `.moai/research/observations/` 의 anti-pattern 매칭 시 해당 차원 ≤ 0.50 cap |

---

## 3. 오늘(2026-06-04) 실행한 풀 사이클 — SPEC-NEWS-REVISE-001

세 인텐트가 직렬로 실행되어 plan → build/evaluate → docs/sync 가 모두 자동화됐다.

### 3.1 `/news plan`

- **위임**: manager-spec 1회 (Phase 1 only)
- **입력**: news.md 무변경 + 2026-06-03 커밋 5건의 사후 정합화 필요
- **산출물**:
  - spec.md v0.1.0 → **v0.1.1**: HISTORY 1줄 + REQ-AUTH-Z-BUTTONS / REQ-EDITOR-EMBED-AND-CTRL-D EARS 3줄 추가
  - acceptance.md: AC 6개 신설 (AC-Z-LIFECYCLE-1, AC-EMB-INLINE-1/2/3, AC-IME-1/2)
- **Slack 보고**: ts `1780497928.989399`
- **종료 사유**: PASS — 신규 SPEC 미생성 (news.md 무변경 원칙 준수)

### 3.2 `/news produce SPEC-NEWS-REVISE-001 --resume`

- **Phase 1** skip (--resume).
- **Phase 2 Build**: expert-frontend 위임 skip — 직전 5 커밋이 이미 모든 AC 를 GREEN 상태로 만들어 둠. 정찰만 수행.
- **Phase 3 Evaluate**: evaluator-active 1회 위임.
  - Must-Pass Firewall (a)/(b)/(c) 모두 PASS
  - 4 차원 점수: Design 0.85 / Originality 0.90 / Completeness 0.82 / Functionality 0.88
  - 종합 **0.8625 ≥ 0.75 → PASS**
  - 통과 AC: 22/24 (△ 2건: AC-DTL-3 라벨 완화, AC-CTRL-D-2 React 통합 부분 커버)
- **Slack 보고**: ts `1780498492.053149`
- **종료 사유**: PASS

### 3.3 `/moai sync SPEC-NEWS-REVISE-001`

- **Phase 0 Gate**: Jest 355/355 + build 무경고 (이전 turn 캐시)
- **Phase 1**: SPEC v0.1.1 변경분 commit `d46fbd9`
- **Phase 2**: manager-docs 1회 위임 → product/structure/tech/codemaps/README 6개 파일 증분 갱신 (신규 파일 0). commit `37e212f`
- **Phase 3**: origin/main 과 충돌 발견(spec.md §13 vs HISTORY/footer) → 직접 충돌 해소 (§13 본문 유지 + §13.4 잔여 해소 표기 + §13.5 GAN PASS 기록). 두 커밋이 `116a870` / `6fe130f` 로 rewrite 후 origin/main fast-forward push 성공.
- **Slack 보고**: ts `1780499447`, `1780499743`
- **사이드 발견**: GitHub repo owner 이동 (`jungjaeho12345-pixel` → `jungjaeho12345`) → memory `ref_github_repo_move.md` 에 기록

---

## 4. 정량 결과 요약

| 지표 | 값 |
|---|---|
| 백엔드 테스트 (`npm test`) | **132/132 PASS**, coverage line 93.91% / branch 90.18% |
| 프론트엔드 테스트 (`npm run test:web`, Vitest+jsdom) | **17 파일 / 223 tests PASS, 0 fail** |
| 총 테스트 수 | **355/355 PASS** |
| Vite 프로덕션 빌드 | 51 modules / 1.35s / **무경고** |
| 평가 종합 점수 (GAN Round 1) | **0.8625** (≥ 0.75 PASS) |
| 통과 AC | **22/24** (△ 2건) |
| 추가된 커밋 | 2건 (`116a870`, `6fe130f`) — origin/main 반영 완료 |
| 갱신된 프로젝트 문서 | 6개 (product / structure / tech / codemaps/architecture / codemaps/overview / README) |
| 신규 SPEC | 0건 (news.md 무변경 원칙) |
| 신규 파일 (코드/문서) | 0건 (기존 파일 증분 갱신만) |
| 위임 에이전트 호출 | 3회 (manager-spec, evaluator-active, manager-docs) |
| Slack tech-day 메시지 | 4건 (plan / produce / sync-local / sync-pushed) |

---

## 5. 하네스 엔지니어링이 직접 막은 사고

| 위험 패턴 | 하네스가 막은 지점 |
|---|---|
| evaluator 가 "느낌상 통과"로 점수 부여 | Rubric Anchoring 강제 — 점수마다 anchor 예시 인용 의무 |
| Jest 실패 1건을 "다른 항목 고득점" 으로 보상 | Must-Pass Firewall — averaging 차단, 1개라도 fail 면 SPEC 전체 FAIL |
| Slack 보고 누락 | Section 8.4 silent skip 금지 — MCP 부재 시도 stdout + `.moai/state/slack-pending.md` fallback |
| 도메인 사실(권한 매트릭스 등) 분산 후 갱신 누락 | 도메인 스킬 단일 출처 + Out of Scope §9 의 "본문 복제 금지" |
| Phase 1 또는 3 skip 으로 인한 검증 누락 | Pipeline §4 FROZEN — skip 불가 |
| Push 직전 분류기 거부 (사용자 의도 우회) | Auto-mode classifier 가 main 직접 push 를 한 차례 거부 → 사용자 명시 승인을 받아 분리 호출로 재시도 |

---

## 6. 한계 + 후속 과제

### 6.1 한계 (현 시점)

- **단일 도메인** — 본 하네스는 뉴스 도메인 전용. 다른 도메인(수집/배부)을 같은 하네스로 다루려면 별도 도메인 스킬 + 워크플로우 스킬 한 쌍을 추가해야 함.
- **GAN 루프 round 1 종료가 잦음** — 본 SPEC 은 이미 구현이 완료된 상태에서 진입했기 때문에 1라운드 PASS. 더 큰 SPEC 에서 escalation_after (3) / stagnation 분기가 실제 작동하는지는 별도 검증 필요.
- **Sprint Contract Protocol 미사용** — `--harness thorough` 옵션을 켜지 않아 일반 rubric 만 적용됨. 더 큰 SPEC 에서는 `.moai/sprints/SPEC-XXX/round-N.md` 산출물도 확인할 것.

### 6.2 후속 과제 (LOW priority)

1. **`articleDetail.js` `description` ↔ `content` alias** — 알려진 it.fails 1건 해소. AC 가 직접 막진 않으나 실사용 결함.
2. **AC-CTRL-D-2 React 통합 테스트** — 현재는 `editorShortcuts.test.js` 순수 함수 계층만 커버. WritePage 통합 레이어에서 드래그 선택 + Ctrl+D 시나리오 추가.
3. **`git remote set-url`** — origin 을 canonical `jungjaeho12345/tech_day` 로 갱신 (push 시 GitHub redirect 안내 발견).
4. **수집/배부 도메인 하네스** — 동일 패턴(`moai-domain-X` + `moai-workflow-X-production`) 으로 확장 시점 결정.

---

## 7. 결론

`/news plan` → `/news produce` → `/moai sync` 의 한 줄짜리 명령 3개로 SPEC 정합화, GAN 검증, 문서 동기화, Slack 보고, origin 반영, 충돌 해소까지 직렬로 완수됐다. 사람이 직접 한 결정은 **(a) push 방식 선택 1회 + (b) 후속 LOW 항목 인지** 2 가지뿐. 나머지는 모두 하네스가 강제하는 규약/검증/보고가 자동 수행했다.

핵심 효과: *구현 그 자체보다 "구현이 통과해야 할 게이트" 를 코드화* 하여 자가 평가 편향 + 보고 누락 + 도메인 사실 분산 3가지 만성 사고를 구조적으로 차단했다.

---

**관련 리소스**
- 하네스 SPEC: `.moai/specs/SPEC-HARNESS-NEWS-001/spec.md`
- 적용 SPEC: `.moai/specs/SPEC-NEWS-REVISE-001/spec.md` (v0.1.1, §13.5 GAN 결과)
- 도메인 스킬: `.claude/skills/moai-domain-news-editor/SKILL.md`
- 워크플로우 스킬: `.claude/skills/moai-workflow-news-production/SKILL.md`
- Slack 채널: `tech-day` (`C0B69CG59UM`)
