# Edits

## src/index.js

Update the import path to reflect the `src/helpers/` → `src/lib/helpers/` rename.

```diff
--- a/src/index.js
+++ b/src/index.js
@@
-import { format } from '../helpers/format';
+import { format } from './lib/helpers/format';
 export function render(input) {
   return format(input);
 }
```

Why: `src/index.js` lives at `src/`. The moved file is at `src/lib/helpers/format.js`. Relative to `src/index.js`, that resolves as `./lib/helpers/format`. The old path `'../helpers/format'` resolved to `helpers/format` at the repo root, which never existed and is doubly stale after the rename.

No other files edited. The test file (`src/__tests__/index.test.js`) and the moved module (`src/lib/helpers/format.js`) are correct as-is.
