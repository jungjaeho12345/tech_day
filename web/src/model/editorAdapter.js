// @MX:NOTE: [AUTO] Editor adapter contract (DP-F1) — markup in/out only; concrete rich-text lib is Run-stage.
//
// The editor region is wrapped behind this replaceable adapter. Its contract is limited to markup
// input/output: get the current markup, set markup, and notify on change. markupVersion is overwrite-on-save
// (no history UI). Swapping the concrete editor library must not affect upstream screens/DTO assembly.
//
// @typedef {object} EditorAdapter
// @property {()=>string} getMarkup            // current markup output (the value persisted to Article.markupVersion)
// @property {(markup:string)=>void} setMarkup // load markup into the editor (overwrite)

/**
 * A minimal default adapter backed by a plain textarea-style string buffer.
 * Tests and the real UI both program against EditorAdapter, not a concrete library.
 * @param {string} [initial]
 * @returns {EditorAdapter}
 */
export function createPlainTextEditorAdapter(initial = '') {
  let markup = initial;
  return {
    getMarkup() {
      return markup;
    },
    setMarkup(next) {
      markup = next ?? '';
    },
  };
}
