// @MX:NOTE: [AUTO] Editor content model + markupVersion serialization (REQ-EDIT-PARSE-006, REQ-EDIT-EMBED-005).
//
// The editor content is an ORDERED list of blocks. Two block kinds:
//   { type: 'text',  text: string }
//   { type: 'embed', embed: { type:'image'|'video'|'article', ... } }
// markupVersion is VERSIONED JSON so the format can evolve (markupVersion is overwrite-on-save, no history UI,
// so a {format,version} tag lets a future loader detect/upgrade older saved markup — plan.md risk table).
// It encodes BOTH the blocks (text + ordered embeds, round-trip stable) AND the derived title/subtitle/body
// structure so DTO assembly consumes structured markup through the unchanged adapter contract.

import { parseArticleStructure } from './articleStructure.js';

export const MARKUP_FORMAT = 'yh-editor';
export const MARKUP_VERSION = 1;

/** @returns {{blocks: Array<object>}} an empty content document. */
export function createEmptyContent() {
  return { blocks: [] };
}

/** Build content from a single plain-text string (one text block). */
export function contentFromText(text) {
  const value = typeof text === 'string' ? text : '';
  return { blocks: value === '' ? [] : [{ type: 'text', text: value }] };
}

/**
 * Append an embed as a distinct block, preserving relative order (REQ-EDIT-EMBED-007).
 * Defensive copy so callers cannot mutate stored block state.
 * @param {{blocks: Array<object>}} content
 * @param {object} embed normalized embed descriptor ({type, ...})
 */
export function appendEmbed(content, embed) {
  const blocks = [...(content?.blocks ?? []), { type: 'embed', embed: { ...embed } }];
  return { blocks };
}

/** Concatenate the text blocks back into the editor body text (embeds contribute no text). */
export function contentToText(content) {
  return (content?.blocks ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Serialize content to the versioned-JSON markup string. */
export function serializeContent(content) {
  const blocks = (content?.blocks ?? []).map((b) =>
    b.type === 'embed' ? { type: 'embed', embed: { ...b.embed } } : { type: 'text', text: b.text },
  );
  return JSON.stringify({ format: MARKUP_FORMAT, version: MARKUP_VERSION, blocks });
}

/**
 * Deserialize a markup string back into content. Tolerant of:
 *   - well-formed versioned JSON (the normal case)
 *   - a plain legacy string (wrapped into a single text block)
 *   - empty / undefined (empty content)
 * Never throws.
 * @param {string|undefined} markup
 * @returns {{blocks: Array<object>}}
 */
export function deserializeContent(markup) {
  if (markup === undefined || markup === null || markup === '') {
    return createEmptyContent();
  }
  try {
    const parsed = JSON.parse(markup);
    if (parsed && parsed.format === MARKUP_FORMAT && Array.isArray(parsed.blocks)) {
      const blocks = parsed.blocks
        .map((b) => {
          if (b?.type === 'embed' && b.embed) {
            return { type: 'embed', embed: { ...b.embed } };
          }
          if (b?.type === 'text') {
            return { type: 'text', text: typeof b.text === 'string' ? b.text : '' };
          }
          return null;
        })
        .filter(Boolean);
      return { blocks };
    }
    // Parsed JSON but not our format -> treat the original string as plain text.
    return contentFromText(markup);
  } catch {
    // Not JSON -> legacy plain-text markup.
    return contentFromText(markup);
  }
}

/** The markupVersion value persisted to Article.markupVersion (alias of serializeContent for clarity). */
export function contentToMarkup(content) {
  return serializeContent(content);
}

/**
 * Derive the structured DTO ({title, subtitle, body}) from a markup string for downstream consumers.
 * The body text is the concatenation of text blocks; parsing applies 후보 A (REQ-EDIT-PARSE).
 * @param {string} markup
 */
export function markupToStructuredDto(markup) {
  const content = deserializeContent(markup);
  return parseArticleStructure(contentToText(content));
}
