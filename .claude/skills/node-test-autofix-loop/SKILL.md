---
name: node-test-autofix-loop
description: Run a Node/JS/TS test suite (Jest or Vitest), diagnose failures, edit source or test code to make them pass, and re-run until green or a stop condition fires. Use this skill whenever the user wants to "make tests pass", "fix failing tests", "run tests and fix what breaks", "stabilize the suite", "get to green", or whenever they mention `npm test`, `yarn test`, `pnpm test`, `jest`, or `vitest` in the context of failures. Also trigger when the user pastes test output and asks to "fix it" or when they ask for an auto-fix loop. Prefer this skill over ad-hoc test runs whenever there is a real chance of iterating more than once.
---

# Node test autofix loop

This skill turns a failing JS/TS test suite into a passing one by running it, reading the failures, editing the smallest reasonable thing to fix them, and re-running. It is built for Jest and Vitest projects; other runners are out of scope.

## When NOT to use this skill

- The user only wants to *run* tests once and look at output — no fixing.
- The failure is environmental (missing node_modules, missing env var, port in use). Fix the environment first, separately.
- The user explicitly asked for "propose-only" / "don't touch my code" — then write a diagnosis, do not edit.
- The project is not Node/JS/TS (Go, Python, Rust): tell the user this skill is the wrong fit.

## Overall shape

```
detect runner & scope  →  run tests  →  green? STOP
                                      ↓ red
                                 diagnose failure
                                      ↓
                              edit smallest fix
                                      ↓
                                 run tests
                                      ↓ (loop, up to N=4)
                              stop conditions hit? → report & hand back
```

## Step 1 — Detect the runner and the scope

Before running anything, figure out two things:

1. **Which runner?** Read `package.json`. Look at `scripts.test` first. If it invokes `jest` use Jest; if it invokes `vitest` use Vitest. If neither, search for `jest.config.*` or `vitest.config.*` / `vite.config.*` with a `test` block. If both runners coexist, prefer the one referenced by `scripts.test`.

2. **Which scope?** Default to **changed-files-first**, then full suite:
   - Run `git diff --name-only HEAD` and `git status --porcelain` to find changed source/test files.
   - If there is at least one changed `*.test.{js,ts,jsx,tsx}` or `*.spec.{js,ts,jsx,tsx}`, run only those first. This is fast and gives a focused signal.
   - If only source files changed (no test files), figure out tests that import them or that live alongside them, run those.
   - If no diff information is available (detached HEAD, fresh clone), run the full suite.
   - **Always finish with a full-suite run** before declaring green — a focused pass that hides a regression elsewhere is a worse outcome than one extra minute of test time.

Why this matters: most fixes are scoped to a small surface, and the inner loop is much faster when each iteration runs ~5 tests instead of 500. But you cannot claim "green" off a partial run, so the final iteration must always be the full suite.

## Step 2 — Run

Use the project's own command, not a global one — versions, configs, and plugins live in the project:

- Jest: `npx jest <files...> --colors=false`
- Vitest: `npx vitest run <files...> --reporter=default`

`--colors=false` and `--reporter=default` keep output parseable. Capture stdout+stderr together.

Notes:
- If `scripts.test` adds flags (coverage, projects, workspaces), use `npm test -- <files...>` instead so those flags carry through. Coverage is fine; it does not change pass/fail.
- Set a generous timeout for the command (5 minutes default). Long suites are not a failure mode you should "fix".
- If the run fails to *start* (config error, missing dependency, syntax error in a config file), that is **Step 3 territory** — diagnose, do not retry blindly.

## Step 3 — Diagnose

Read the test output carefully before touching any code. For each failing test, extract:

- The failing test name and file
- The assertion (expected vs received)
- The stack trace's first frame inside the project (not `node_modules`)
- Any thrown error message

Then form a one-sentence hypothesis: **what changed, and why does that break this test?** Cross-reference with the diff from Step 1. The most common patterns:

| Pattern | Signal | Typical fix |
|---|---|---|
| Snapshot drift | "snapshot does not match" | If intentional, update snapshot; if not, fix the rendering code |
| Assertion drift | Expected/received differ by a small, plausible value | Read the assertion intent; usually the source is wrong, sometimes the test was stale |
| Import / module path | "Cannot find module" | File was renamed/moved; fix import paths |
| Type error at runtime | `TypeError: x.y is not a function` | Trace the type; often a missing null guard or a renamed method |
| Async leak | "Jest did not exit" / hanging | Missing `await`, unclosed timer, or open handle |
| Mock mismatch | `expect(...).toHaveBeenCalledWith` differs | Mock signature out of sync with caller |

When the diff and the failure both point at the same file, that is your strongest evidence — start there.

When the diff points one way and the failure another, the failure is authoritative; the bug is elsewhere.

## Step 4 — Edit the smallest reasonable thing

This is the step where overreach causes the most damage. Rules:

- **Touch one cause per iteration.** If you see two unrelated failures, fix one, re-run, and let the loop sort the other. Bundling unrelated fixes makes a regression impossible to attribute.
- **Prefer fixing production code over fixing tests.** A test that was passing yesterday and fails today is usually right; the production change broke an invariant. Only edit the test when you have a clear reason: the assertion was wrong, the spec changed, or the test was testing an implementation detail that intentionally changed.
- **Do not delete tests to make them pass.** Skipping (`.skip`) is allowed only if the user explicitly asked for it. If a test is genuinely obsolete, say so in the report and let the user decide.
- **Do not add error swallowing.** Wrapping a failing line in try/catch to silence it is never the fix.
- **Snapshot updates** (`--updateSnapshot` / `-u`) are allowed when the snapshot change is intentional and you can articulate why. If you cannot articulate it, the snapshot is the canary — do not silence it.

For each edit, write a one-line "why" in your working notes. You will need this for the final report and for deciding whether to stop.

## Step 5 — Stop conditions

Run, fix, re-run is bounded. Stop and hand back to the user when any of these hold:

- **Green on full suite.** Done. Report what you changed.
- **N=4 iterations elapsed.** Hard cap. The skill is not the right tool past this point — the failure is structural.
- **Same root cause appears twice.** If your last fix did not move the failure, your hypothesis is wrong. Stop and reason from scratch, or hand back.
- **Failures multiplied.** If iteration k+1 has strictly more failures than iteration k, the last edit was a regression. Revert it and reconsider.
- **The fix would require an architectural change** (new module, dependency bump, schema migration). Out of scope for an autofix loop; report and ask.

When you stop short of green, the report must include: which tests still fail, what you tried, what you ruled out, and what you think the next move is. A precise blocker report is the success criterion at that point, not a green bar.

## Step 6 — Report

When you finish (green or stopped), write a short summary:

```
Result: green | partial | blocked
Iterations: <k>
Files edited:
  - path/to/file.ts — <one-line why>
  - path/to/file.test.ts — <one-line why>
Tests still failing (if any):
  - <test name> — <one-line hypothesis>
Next move (if blocked): <one sentence>
```

Keep it terse. The user is going to read the diff next; the report is just a map.

## Operational guardrails

- Run commands from the project root (or the package root for a workspace target). Never run tests from inside `node_modules`.
- Do not modify `package.json` dependencies as part of an autofix iteration. Version bumps are not an autofix.
- Do not run `npm install` / `pnpm install` inside the loop. If a missing dependency is the root cause, that is Step 3, report it, stop.
- Do not silently change test config (`jest.config`, `vitest.config`). If config is the issue, surface it.
- Never commit, push, or open PRs from inside this loop. The user does that after reviewing the diff.

## Why this skill exists

A naive "run tests until green" loop tends to do three bad things: bundle unrelated fixes, edit tests instead of code to silence failures, and hide regressions by running only a subset. The structure above — bounded iterations, narrowest-edit-first, full-suite confirmation, explicit stop conditions, and an honest blocker report — exists to make the loop trustworthy enough that a human can read just the diff and the report and know what happened.
