// @MX:NOTE: [AUTO] Pure newline-insertion for the contentEditable body editor (SPEC-UI-EDITOR-001 기사 에디터).
//
// The editor model is '\n'-based plain text (white-space:pre-wrap). The browser's default contentEditable
// Enter behavior inserts block markup (<div>/<br>) that does NOT match the '\n' model, which desynchronizes
// the colored-span repaint and miscomputes the caret offset (caret jumps to the first line). The fix makes
// the model authoritative for newlines: BodyEditor intercepts Enter/Shift+Enter and splices a literal '\n'
// into the body text at the caret using this pure helper, then repaints + restores the caret itself.

/**
 * Splice a single '\n' into `text` at character offset `offset`. A null/undefined offset (no live
 * selection) is treated as the end of the text. The offset is clamped to [0, text.length].
 * Pure & deterministic — no DOM access.
 * @param {string} text current body text (the colored model's source of truth)
 * @param {number|null|undefined} offset caret character offset within the text
 * @returns {string} the body text with a '\n' inserted at the (clamped) offset
 */
export function insertNewlineAt(text, offset) {
  const source = typeof text === 'string' ? text : '';
  const at = offset == null ? source.length : Math.max(0, Math.min(offset, source.length));
  return source.slice(0, at) + '\n' + source.slice(at);
}
