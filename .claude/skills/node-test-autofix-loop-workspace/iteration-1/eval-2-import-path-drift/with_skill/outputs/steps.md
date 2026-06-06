# Steps

## Step 1 — Detect runner & scope
- `package.json` `scripts.test` is `jest` → Jest runner.
- Diff shows a rename: `src/helpers/format.js` → `src/lib/helpers/format.js`, plus `src/index.js` flagged as importer (content unchanged).
- Failing test: `src/__tests__/index.test.js`. Scope iteration to that test file first; finish with full suite.

## Step 2 — Run (simulated)
Provided output: `Test Suites: 1 failed, 12 passed, 13 total`. Single failure:
```
Cannot find module '../helpers/format' from 'src/index.js'
```

## Step 3 — Diagnose
- Pattern: **Import / module path** (table row 3 of SKILL.md).
- One-sentence hypothesis: the rename moved `format.js` under `src/lib/helpers/`, but `src/index.js`'s import `'../helpers/format'` still resolves relative to the old layout and now points to a nonexistent path.
- Evidence aligns: diff shows the rename, failure points at the same module — the importer simply was not updated. Production code is the right place to fix (not the test).
- From `src/index.js` (at `src/index.js`), the moved file at `src/lib/helpers/format.js` resolves as `./lib/helpers/format`.

## Step 4 — Edit smallest reasonable thing
- One file, one line: update the import path in `src/index.js` from `'../helpers/format'` to `'./lib/helpers/format'`.
- Do not edit the test (test is correct; it just imports the module under test).
- Do not touch the moved file.

## Step 5 — Re-run (simulated)
- Focused re-run on `src/__tests__/index.test.js`: expected PASS — module now resolves, `render()` delegates to `format()` unchanged.
- Full-suite confirmation run: expected `13 passed, 13 total` (the other 12 were already green and were not touched).

## Step 6 — Stop
- Green on full suite (simulated). Single iteration. Report written.
