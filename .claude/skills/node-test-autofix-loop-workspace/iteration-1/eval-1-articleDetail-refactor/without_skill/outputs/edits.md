# Edits

## File: `web/src/view/articleDetail.js`

### Edit 1 — `insertEmbedAtCaret`: advance caret past inserted token

**Old:**
```js
export function insertEmbedAtCaret(state, embed) {
  const { bodyText, caret } = state;
  const before = bodyText.slice(0, caret);
  const after = bodyText.slice(caret);
  return {
    ...state,
    bodyText: before + `[EMBED:${embed.id}]` + after,
    // NOTE: did not bump caret
  };
}
```

**New:**
```js
export function insertEmbedAtCaret(state, embed) {
  const { bodyText, caret } = state;
  const token = `[EMBED:${embed.id}]`;
  const before = bodyText.slice(0, caret);
  const after = bodyText.slice(caret);
  return {
    ...state,
    bodyText: before + token + after,
    caret: caret + token.length,
  };
}
```

### Edit 2 — `composeBody`: rebuild body from `state.bodyText`

**Old:**
```js
function composeBody(_state) {
  // TODO(refactor): rebuild from bodyText, embeds were yanked out of here
  return { body: '' };
}
```

**New:**
```js
function composeBody(state) {
  return { body: state.bodyText };
}
```

No changes to `web/src/view/articleDetail.test.js`.
