# Steps

1. Read the test run output and parse each snapshot diff against the user's stated intent:
   - Stated intent: (a) Hero copy "Get started" → "시작하기", (b) Card copy "Learn more" → "더 알아보기", (c) Modal title style change.
2. Classify each failure as **in-scope** (matches intent) or **out-of-scope** (something extra).
   - Hero: only `<button>` text changed. In-scope.
   - Card: only `<a>` text changed. In-scope.
   - Modal: class `modal-title-old` → `modal-title-new` is in-scope (title style), BUT `aria-label="Confirm action"` was *removed* from the dialog wrapper. That is an accessibility change not mentioned in the intent. Out-of-scope.
3. Decide action per file:
   - In-scope failures → update snapshot via targeted Jest run with `-u` scoped to that single test file.
   - Out-of-scope failures → DO NOT update. Stop and flag to the user.
4. Planned commands (scoped, not bulk):
   - `npx jest src/components/__tests__/Hero.test.jsx -u`
   - `npx jest src/components/__tests__/Card.test.jsx -u`
   - Skip Modal. Report the aria-label removal and ask the user whether it was intentional.
5. Re-run full suite (`npm test`) after the two scoped updates to confirm only the Modal suite remains red, then hand back to the user with the Modal question.

Rationale for not using a bulk `jest -u`:
- Bulk update would silently bake the aria-label removal into the Modal snapshot, hiding a potential a11y regression.
- Scoped `-u` per file preserves the stop-and-flag boundary the user asked for.
