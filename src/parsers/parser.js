// @MX:ANCHOR: [AUTO] Parser-adapter interface + body normalization — consumed by the collection
// pipeline and every concrete parser (REQ-RCV-PARSE-003/005, expected fan_in >= 3).
// @MX:REASON: defines the in→out contract ({title, bodyBlocks}) and the single canonical
// body→yh-editor-block-JSON normalization that all collected articles must share with the editor.
//
// Abstract parser-adapter layer for SPEC-RCV-COLLECT-001 (DP-RCV-5).
// A parser adapter receives a raw payload and returns { title, bodyBlocks } — the body is already
// normalized into yh-editor block objects. The collection pipeline serializes bodyBlocks into the
// Article.markupVersion block-JSON envelope via buildMarkupVersion (schema.md L38 정합).

// The block-JSON envelope identifiers (schema.md: {"format":"yh-editor","version":1,"blocks":[...]}).
export const MARKUP_FORMAT = 'yh-editor';
export const MARKUP_VERSION = 1;

/**
 * Wrap plain body text into at least one yh-editor text block (REQ-RCV-PARSE-003). Each non-empty
 * line becomes its own text block; an all-blank body yields zero blocks (the caller treats that as a
 * parse failure — REQ-RCV-PARSE-004 forbids a body-less article).
 * @param {string} text
 * @returns {Array<{type: 'text', text: string}>}
 */
export function textToBlocks(text) {
  if (typeof text !== 'string') {
    return [];
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ type: 'text', text: line }));
}

/**
 * Serialize normalized body blocks into the Article.markupVersion block-JSON envelope so a
 * collected article's body is stored in the SAME structure as an editor-authored one (REQ-RCV-PARSE-003).
 * @param {Array<object>} blocks
 * @returns {string} JSON string
 */
export function buildMarkupVersion(blocks) {
  return JSON.stringify({ format: MARKUP_FORMAT, version: MARKUP_VERSION, blocks });
}

/**
 * Validate a parser adapter's output. A usable result MUST carry a non-empty title AND at least one
 * body block (REQ-RCV-PARSE-004: a partially-formed article — title-only or body-only — is rejected).
 * @param {{ title?: unknown, bodyBlocks?: unknown }} [result]
 * @returns {boolean}
 */
export function isParseResultComplete(result) {
  if (result === undefined || result === null) {
    return false;
  }
  const { title, bodyBlocks } = result;
  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const hasBody = Array.isArray(bodyBlocks) && bodyBlocks.length > 0;
  return hasTitle && hasBody;
}
