// @MX:NOTE: [AUTO] Default concrete parser (SPEC-RCV-COLLECT-001 DP-RCV-5) — the minimum one
// parser required this Run. Handles structured {title, body} payloads and plain text (first line =
// title, remainder = body). Additional format-specific parsers (XML/NewsML/...) are deferred.
//
// Concrete parser adapter for SPEC-RCV-COLLECT-001. Implements the parser-adapter contract
// (in: raw payload → out: { title, bodyBlocks }). The body is normalized into yh-editor text blocks
// via textToBlocks; the collection pipeline serializes it into the markupVersion envelope.

import { textToBlocks } from './parser.js';

/**
 * Extract a feed-supplied author/department envelope if present, so the registration stage can apply
 * feed-first stamping (REQ-RCV-REGISTER-005). Only known keys are surfaced; everything else is ignored.
 * @param {object} payload
 * @returns {{ author?: string, department?: string, departmentCode?: string }}
 */
function extractFeedMeta(payload) {
  const meta = {};
  if (typeof payload.author === 'string' && payload.author.trim().length > 0) {
    meta.author = payload.author.trim();
  }
  if (typeof payload.department === 'string' && payload.department.trim().length > 0) {
    meta.department = payload.department.trim();
  }
  if (typeof payload.departmentCode === 'string' && payload.departmentCode.trim().length > 0) {
    meta.departmentCode = payload.departmentCode.trim();
  }
  return meta;
}

/**
 * Parse a raw payload into { title, bodyBlocks, feedMeta }.
 *
 * Two accepted shapes:
 *  - Structured object: { title, body } (body may be a string or an array of text strings) — also
 *    carries optional author/department feed metadata.
 *  - Plain text string: first non-empty line is the title, the remaining lines are the body.
 *
 * The result is intentionally NOT validated here for completeness — the pipeline applies
 * isParseResultComplete so an empty title or body becomes a clean skip (REQ-RCV-PARSE-004).
 * @param {object|string} payload
 * @returns {{ title: string, bodyBlocks: Array<object>, feedMeta: object }}
 */
export function parse(payload) {
  // Plain-text path: first line = title, rest = body (REQ-RCV-PARSE-005 example).
  if (typeof payload === 'string') {
    const lines = payload.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const [title = '', ...rest] = lines;
    return { title, bodyBlocks: textToBlocks(rest.join('\n')), feedMeta: {} };
  }

  // Structured path: explicit title/body keys.
  if (payload !== null && typeof payload === 'object') {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    let bodyText = '';
    if (typeof payload.body === 'string') {
      bodyText = payload.body;
    } else if (Array.isArray(payload.body)) {
      bodyText = payload.body.filter((p) => typeof p === 'string').join('\n');
    }
    return { title, bodyBlocks: textToBlocks(bodyText), feedMeta: extractFeedMeta(payload) };
  }

  // Unsupported shape → empty result; the pipeline treats it as a parse failure (no partial article).
  return { title: '', bodyBlocks: [], feedMeta: {} };
}

/** The default parser adapter object (matches the parser-adapter interface). */
export const defaultParser = Object.freeze({ name: 'default', parse });
