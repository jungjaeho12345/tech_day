---
id: SPEC-EDIT-LOCK-001
version: 0.2.0
phase: run
updated: 2026-06-03
---

# SPEC-EDIT-LOCK-001 — Progress Log

## Run Phase — [NEW] Lazy TTL Expiry (reclaim-on-acquire)

Scope: backend-only implementation of REQ-LOCK-ACQUIRE [NEW] TTL EARS (AC-TTL-1~4) via
strict TDD (RED → GREEN → REFACTOR). Existing [EXISTING] lock behavior left untouched and
verified as a regression guard.

### Baseline (pre-change)

- Backend `node --test test/*.test.js`: **165 pass / 0 fail** (regression baseline).
- LSP/structural: no errors prior to change.

### RED

- Added AC-TTL-1~4 tests to `test/articleService.test.js` alongside the existing lock suite
  (after the `LOCK:` characterization tests). Time injected via `options.now` /
  `options.ttlMs` — fully deterministic, no real waits.
  - LOCK-TTL: stale (now-31min) reclaimed by sess-B → reclaim assertions.
  - LOCK-TTL: fresh (now-29min) not stealable → still blocked, holder/LockedAt unchanged.
  - LOCK-TTL: exact boundary (now-30min) non-stale → blocked (`LockedAt < now-TTL` only).
  - LOCK-TTL: default `EDIT_LOCK_TTL_MS === 30*60*1000`; injected `ttlMs:1000` reclaims a
    2-second-old lock (overridability without real-time waits).
- Confirmed RED: the two reclaim tests failed with `actual: false, expected: true`
  (reclaim not yet implemented). The block-case + default-constant assertions already held
  (existing block path + pre-declared constant), which is the expected partial-RED for a
  pure-additive WHERE disjunct.

### GREEN (minimal implementation)

- `src/services/articleService.js`:
  - Exported `EDIT_LOCK_TTL_MS = 30 * 60 * 1000` (`@MX:NOTE` business rule, 30-min lazy expiry).
  - `acquireEditLock(articleId, sessionId, options={})` now derives `nowMs` from `options.now`
    (Date or ISO string), computes `staleThreshold = staleThresholdFor(nowMs, options.ttlMs)`,
    and passes it to the model. Same clock + same fixed-width UTC(Z) ISO format as `LockedAt`
    ([HARD] timestamp invariant §5.2).
- `src/models/articleModel.js`:
  - `acquireLock(articleId, sessionId, now, staleThreshold='')` WHERE extended with ONE
    disjunct: `... OR LockedAt < ?`. Reclaim reuses the same atomic UPDATE
    (`LockYN='Y'`, `LockedBySessionId=<acquirer>`, `LockedAt=now`). Defaulted `''` keeps the
    3-arg path back-compatible (stale disjunct never grants when omitted).
  - `@MX:ANCHOR` updated (check-and-set + TTL reclaim invariant) + `@MX:WARN` added
    (lost-update concurrency risk), each with `@MX:REASON`.
- Result: `articleService.test.js` 34 pass / 0 fail (5 TTL + 11 existing lock + others GREEN).

### REFACTOR

- `staleThresholdFor(nowMs, ttlMs = EDIT_LOCK_TTL_MS)` extracted as a small named helper in
  the service (single source for the `now - TTL` ISO computation; documents the timestamp
  invariant). Hardened clock conversion to `Number(new Date(options.now))` to avoid a lossy
  `toString()` round-trip for both Date and ISO-string inputs. No behavior change; all tests
  remained GREEN.

### Verification (evidence)

- Full backend suite `node --experimental-sqlite --test --experimental-test-coverage test/*.test.js`:
  **170 pass / 0 fail** (165 baseline + 5 new TTL). Existing lock tests (the `LOCK:` suite,
  spec anchors 198-318) all GREEN.
- Coverage (all files): line 96.43% / branch 91.97% / funcs 90.65% — above 85% target and
  80% per-commit floor. `articleModel.js` line 100% / branch 89.29%; `articleService.js`
  line 97.01% / branch 90.91%.
- Frontend Vitest `vitest run --root web`: **268 pass / 0 fail** (incl.
  `useWriteController.lock.test.jsx`) — backend-only change caused no cross-layer regression.
- `vite build web`: clean, no warnings.
- Backend-only: no `web/**` edits; `src/db/schema.js` lock columns READ only (already exist;
  no schema/column changes).

### Acceptance criteria status

| AC | Status | Evidence |
|----|--------|----------|
| AC-TTL-1 (stale reclaim) | GREEN | `test/articleService.test.js` LOCK-TTL reclaim |
| AC-TTL-2 (fresh not stealable) | GREEN | `test/articleService.test.js` LOCK-TTL fresh-blocked |
| AC-TTL-3 (boundary = TTL non-stale) | GREEN | `test/articleService.test.js` LOCK-TTL boundary |
| AC-TTL-4 (config default + override) | GREEN | `test/articleService.test.js` default + injected ttlMs |
| AC-ACQ/BLK/RLA/RLE/AUTH [EXISTING] | GREEN (no regression) | full backend 170 pass |

### Iteration metrics (Re-planning Gate)

- Acceptance criteria newly met this iteration: 4 (AC-TTL-1~4).
- Error count delta: 0 introduced, 0 remaining. No stagnation.
