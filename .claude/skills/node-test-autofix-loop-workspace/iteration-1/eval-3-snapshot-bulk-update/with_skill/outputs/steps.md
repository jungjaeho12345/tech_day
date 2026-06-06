# Steps — snapshot bulk-update triage

## Context

- Runner: Jest (per `scripts.test = "jest"`).
- Reported state: 3 snapshot failures (Hero, Card, Modal), 47 passing, 50 total.
- User's stated intent: Hero copy change, Card copy change, Modal title *style* change.
- Diff scope: `src/components/Hero.jsx`, `src/components/Card.jsx`, `src/components/Modal.jsx`.
- Task is reason-from-diffs only; do NOT run jest, do NOT mutate the repo.

Per skill Step 4: "Snapshot updates are allowed when the snapshot change is intentional and you can articulate why. If you cannot articulate it, the snapshot is the canary — do not silence it."

I walk each failure and ask: does every line of the diff map cleanly to the stated intent?

## Per-snapshot analysis

### 1. Hero — `src/components/__tests__/Hero.test.jsx`

```
- <button>Get started</button>
+ <button>시작하기</button>
```

- Single-line change, text node only.
- Matches user intent verbatim ("Get started" → "시작하기").
- No structural, attribute, or class changes.
- Verdict: SAFE to update. Articulable reason: intentional copy localization.

### 2. Card — `src/components/__tests__/Card.test.jsx`

```
- <a>Learn more</a>
+ <a>더 알아보기</a>
```

- Single-line change, text node only.
- Matches user intent verbatim ("Learn more" → "더 알아보기").
- No href, class, or other attribute drift.
- Verdict: SAFE to update. Articulable reason: intentional copy localization.

### 3. Modal — `src/components/__tests__/Modal.test.jsx`

```
- <div role="dialog" aria-label="Confirm action">
-   <h2 class="modal-title-old">Confirm</h2>
+ <div role="dialog">
+   <h2 class="modal-title-new">Confirm</h2>
```

Diff header reports `- Snapshot - 2 / + Received + 1` — two lines removed, one added. Breakdown:

- (a) `class="modal-title-old"` → `class="modal-title-new"` on the `<h2>`. This maps to the user's stated "Modal title style change". Articulable.
- (b) `aria-label="Confirm action"` was removed from the dialog `<div>`. This is NOT in the user's stated intent.

Change (b) is an accessibility regression signal:
- A `role="dialog"` with no accessible name (no `aria-label`, no `aria-labelledby`) fails WCAG / ARIA authoring practices.
- The user said "title style change", not "remove the dialog's accessible name".
- I cannot articulate why this snapshot line should be silenced — therefore, per skill rule, the snapshot is acting as a canary and updating it would hide an unintended regression.

Verdict: DO NOT auto-update. Flag to user.

## Decision

Two clean fixes (Hero, Card) + one canary (Modal). Per skill Step 4 ("Touch one cause per iteration", "do not silence the canary"), the right move is:

- Update Hero and Card snapshots selectively.
- STOP on Modal. Surface the `aria-label` removal as a question: was it intentional, or did the title-style refactor accidentally drop the accessible name on the dialog root?

A blanket `jest -u` would have silenced the Modal accessibility regression — exactly the failure mode the skill is designed to prevent.

## What I would do (no execution per task constraints)

Selective targeted updates, not bulk:

```
npx jest src/components/__tests__/Hero.test.jsx src/components/__tests__/Card.test.jsx -u --colors=false
```

Then re-run full suite to confirm 48 passing / 1 failing (Modal still red), and hand Modal back to the user with the specific question about `aria-label`.

I would NOT run `npx jest -u` (would silence Modal canary).
I would NOT update the Modal snapshot myself.
