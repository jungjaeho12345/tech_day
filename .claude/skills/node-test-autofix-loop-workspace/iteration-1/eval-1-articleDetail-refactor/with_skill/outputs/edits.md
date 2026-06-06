# Edits

All edits in `web/src/view/articleDetail.js`. Test file untouched.

## Edit 1 — `insertEmbedAtCaret` must advance caret (cause: AC-EMB-INLINE-2)

```diff
 export function insertEmbedAtCaret(state, embed) {
   const { bodyText, caret } = state;
   const before = bodyText.slice(0, caret);
   const after = bodyText.slice(caret);
+  const token = `[EMBED:${embed.id}]`;
   return {
     ...state,
-    bodyText: before + `[EMBED:${embed.id}]` + after,
-    // NOTE: did not bump caret
+    bodyText: before + token + after,
+    caret: caret + token.length,
   };
 }
```

Why: the test asserts `after.caret === state.caret + '[EMBED:x]'.length`. The previous code explicitly left caret stale (and the NOTE flagged it). Bumping by the inserted token length matches the test's contract and the natural editor semantic (caret sits immediately after the just-inserted embed).

## Edit 2 — `composeBody` must rebuild body from `bodyText` (cause: AC-EMB-INLINE-1)

```diff
 export function buildArticle(state) {
   // Used to be: return { ...state, body: state.bodyText };
   const composed = composeBody(state);
   return { ...state, body: composed.body };
 }

-function composeBody(_state) {
-  // TODO(refactor): rebuild from bodyText, embeds were yanked out of here
-  return { body: '' };
-}
+function composeBody(state) {
+  // Embeds are inlined into bodyText by insertEmbedAtCaret as [EMBED:<id>]
+  // tokens, so the composed body is bodyText as-is. If a future change
+  // separates embeds from bodyText again, re-interleave here.
+  return { body: state.bodyText };
+}
```

Why: the refactor left `composeBody` as a TODO stub returning `''`, which is why `article.body` was empty. Since `insertEmbedAtCaret` writes the `[EMBED:id]` marker straight into `bodyText`, the minimum correct composition is to pass `bodyText` through. This matches the test's expected string exactly: `'Lead paragraph[EMBED:img-001]rest of body'`.

## What I did NOT do
- Did not edit `articleDetail.test.js` (no assertion drift; tests reflect intended new behavior).
- Did not touch any other file in `web/src/`.
- Did not change `package.json`, vitest config, or install anything.
- Did not skip or delete any test.
