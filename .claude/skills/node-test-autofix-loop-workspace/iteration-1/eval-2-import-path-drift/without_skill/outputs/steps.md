# Steps

1. Read the failing Jest output. The resolver error pinpoints `src/index.js` line 1: `Cannot find module '../helpers/format'`.
2. Cross-reference the diff context: `src/helpers/format.js` was renamed to `src/lib/helpers/format.js`. So the import target moved, but the importer was not updated.
3. Compute the new relative path from the importer `src/index.js` to the new location `src/lib/helpers/format.js`:
   - Importer directory: `src/`
   - Target (without extension): `src/lib/helpers/format`
   - Relative specifier: `./lib/helpers/format`
4. Confirm no other importers reference the stale `../helpers/format` or `./helpers/format` path (only `src/index.js` is shown in scope; the other 12 suites pass, so no further edits are implied by the failure surface).
5. Apply a single one-line edit to `src/index.js` updating the import specifier.
6. Re-run `npm test`. Expect 13/13 suites passing.
7. If a different suite then fails, recurse on that failure (out of scope here — current evidence shows only one failing suite caused by the rename).
