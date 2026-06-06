# Report

## Failures diagnosed

1. **AC-EMB-INLINE-1** — `article.body` was `''`. `composeBody` was a stub left behind by the refactor (`return { body: '' }`). Replaced with `{ body: state.bodyText }` so `buildArticle` returns the already-spliced bodyText.

2. **AC-EMB-INLINE-2** — `after.caret` was `undefined`. `insertEmbedAtCaret` explicitly skipped bumping the caret (NOTE comment). Now computes `token = '[EMBED:${embed.id}]'` once and returns `caret: caret + token.length`.

## Edits

- `web/src/view/articleDetail.js` only (2 functions).
- Tests left untouched — they encode the spec (AC-EMB-INLINE-1/2 from SPEC-NEWS-REVISE-001).

## Expected result

`npx vitest run web/src/view/articleDetail.test.js` -> 10/10 pass.

## Risk / scope notes

- `composeBody` previously hinted at richer embed-composition logic ("embeds were yanked out of here"). Current tests only require `body === bodyText`, so the minimal fix is correct under TRUST 5 (scope discipline, simplicity). If embed objects later need to be merged separately from inline `[EMBED:id]` markers, a follow-up SPEC should reintroduce that logic with new tests.
- No changes outside the two refactor-touched files; matches the diff context.
