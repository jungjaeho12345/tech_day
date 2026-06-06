# Steps

1. Read the failing test output and identify two failures:
   - AC-EMB-INLINE-1: `article.body` is `''` instead of the composed body. Root cause: `composeBody` is a stub returning `{ body: '' }`. It must rebuild from `state.bodyText`.
   - AC-EMB-INLINE-2: `after.caret` is `undefined`. Root cause: `insertEmbedAtCaret` has a NOTE admitting it doesn't bump the caret. It must advance caret by `'[EMBED:${embed.id}]'.length`.

2. Fix `web/src/view/articleDetail.js`:
   - In `insertEmbedAtCaret`, compute the embed token, splice it in, and set `caret: caret + token.length`.
   - In `composeBody`, return `{ body: state.bodyText }` so `buildArticle` produces the composed text. (The test only checks `article.body` equals the spliced bodyText; embed markers are already inline in `bodyText` post-insert.)

3. Do NOT touch the test file — tests express the spec; production code must conform.

4. Re-run `npx vitest run web/src/view/articleDetail.test.js` and confirm 10/10 pass.

5. If green, stop. No other files in scope.
