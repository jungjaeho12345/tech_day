# Edits — what I would do

## Action plan (selective, not bulk)

### 1. Update Hero + Card snapshots only

Command I would run (project root):

```
npx jest \
  src/components/__tests__/Hero.test.jsx \
  src/components/__tests__/Card.test.jsx \
  -u --colors=false
```

Reasoning:
- Both diffs are pure text-node copy changes ("Get started"→"시작하기", "Learn more"→"더 알아보기") that match the user's stated intent verbatim.
- No attribute, class, role, or structural drift on either component.
- I can articulate the reason for the snapshot churn, which is the skill's gate for `-u`.

### 2. Do NOT update the Modal snapshot

Reasoning:
- The Modal diff contains two changes, but only one was declared intentional:
  - Declared: `class="modal-title-old"` → `class="modal-title-new"` (title style).
  - Undeclared: `aria-label="Confirm action"` removed from the `<div role="dialog">`.
- A `role="dialog"` without an accessible name is an a11y regression. The snapshot is correctly flagging it.
- Per skill Step 4: snapshots without an articulable reason are canaries; do not silence.
- Per skill Step 5 (stop conditions): "the fix would require... [an unrelated decision]" — the a11y question is the user's call, not the autofix loop's.

### 3. Do NOT run `npx jest -u` (bulk update)

Reasoning:
- Bulk update would silently accept the Modal aria-label removal.
- Even though 2 of 3 snapshot updates are correct, bulk mode bundles the regression in — exactly the "bundle unrelated fixes" anti-pattern the skill calls out.

## What I would NOT touch

- `src/components/Hero.jsx`, `Card.jsx`, `Modal.jsx` source — the production change is the user's, not mine to revert.
- `jest.config.*` — no config touch.
- `package.json` — no dep changes.
- Modal test file or snapshot file — leave failing as the canary.

## Final confirmation step

After the selective update, run the full suite once:

```
npx jest --colors=false
```

Expected: 48 passing, 1 failing (Modal). Then hand back to user with the question:

> "Modal snapshot change is partially intentional — `modal-title-old`→`modal-title-new` matches the stated title style change, but the diff also removes `aria-label=\"Confirm action\"` from the `<div role=\"dialog\">`. That looks like an accessibility regression (dialog with no accessible name). Was the aria-label removal intentional? If yes, I'll update the Modal snapshot; if no, the fix belongs in `Modal.jsx`."
