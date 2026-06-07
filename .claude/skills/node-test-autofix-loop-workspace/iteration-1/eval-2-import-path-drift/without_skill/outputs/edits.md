# Edits

## File: `src/index.js`

Update the import specifier to match the new location of `format.js` after the `src/helpers/` -> `src/lib/helpers/` rename.

### Before

```js
import { format } from '../helpers/format';
export function render(input) {
  return format(input);
}
```

### After

```js
import { format } from './lib/helpers/format';
export function render(input) {
  return format(input);
}
```

### Diff

```diff
-import { format } from '../helpers/format';
+import { format } from './lib/helpers/format';
 export function render(input) {
   return format(input);
 }
```

### Rationale

- Importer lives at `src/index.js`, so its base directory is `src/`.
- Target file is now `src/lib/helpers/format.js`.
- Relative path from `src/` to `src/lib/helpers/format` is `./lib/helpers/format`.
- The original `../helpers/format` resolved to `helpers/format` (one level above `src/`), which never existed under the new layout and also did not exist before — the old correct path would have been `./helpers/format`. Either way, the current code is broken post-rename and the fix is the same.

## No other files modified

- `src/lib/helpers/format.js` already exports `format` correctly; no change needed.
- No test files require edits — the test suite that failed only failed because the module could not be resolved at import time.
