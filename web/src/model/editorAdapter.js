// @MX:NOTE: [AUTO] Editor adapter contract (DP-F1) — markup in/out only; concrete structured editor sits behind it.
//
// The editor region is wrapped behind this replaceable adapter. Its public contract is limited to markup
// input/output: getMarkup() returns the value persisted to Article.markupVersion, setMarkup() overwrites the
// editor view (overwrite-on-save, no history UI). Swapping the concrete editor must not affect upstream
// screens/DTO assembly. SPEC-UI-EDITOR-001 makes the editor CONCRETE: createStructuredEditorAdapter holds an
// ordered content model (text + inline embeds) and serializes it to versioned-JSON markupVersion. The legacy
// createPlainTextEditorAdapter is kept for backward compatibility.
//
// @typedef {object} EditorAdapter
// @property {()=>string} getMarkup            // current markup output (the value persisted to Article.markupVersion)
// @property {(markup:string)=>void} setMarkup // load markup into the editor (overwrite)

import {
  createEmptyContent,
  contentFromText,
  appendEmbed,
  insertEmbedAtTextOffset,
  contentToText,
  contentToMarkup,
  deserializeContent,
  END_MARKER_BLOCK,
  hasEndMarker,
} from './editorContent.js';
import { parseArticleStructure } from './articleStructure.js';

/**
 * A minimal legacy adapter backed by a plain string buffer. Retained for compatibility with any
 * caller that only needs an opaque markup pass-through.
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

/**
 * Concrete structured editor adapter (REQ-EDIT-ADP-001..003). Holds an ordered content model of text
 * blocks + inline embeds, exposes the EditorAdapter contract (getMarkup/setMarkup), plus the extra
 * methods the React view drives it with (setBodyText/embed/getContent/getStructure). The library-free
 * content model lives entirely behind this adapter, satisfying the DP-F1 isolation requirement.
 * @param {string} [initialMarkup]
 */
export function createStructuredEditorAdapter(initialMarkup = '') {
  let content = initialMarkup ? deserializeContent(initialMarkup) : createEmptyContent();

  return {
    // --- EditorAdapter contract surface (unchanged) ---
    getMarkup() {
      return contentToMarkup(content);
    },
    setMarkup(next) {
      content = deserializeContent(next);
    },

    // --- View-facing methods (concrete editor driver) ---
    /** Replace the body text portion, preserving existing embeds appended after it. */
    setBodyText(text) {
      const embeds = content.blocks.filter((b) => b.type === 'embed');
      content = { blocks: [...contentFromText(text).blocks, ...embeds] };
    },
    /**
     * Insert "\r\n (끝)" (a NEW LINE + the gold "(끝)" marker) at the END of the body text
     * (news.md 기사 에디터 Alt+Y). Stored as literal body text so it round-trips through markupVersion
     * (save -> reload keeps it). IDEMPOTENT: if the body already ends with the "(끝)" marker, this is a
     * no-op (news.md: Alt+Y를 누를시 이미 "\r\n (끝)"이 있다면 삽입하지 않는다). Embeds are preserved.
     */
    appendEnd() {
      const bodyText = contentToText(content);
      if (hasEndMarker(bodyText)) return; // already present -> do not append a duplicate
      const embeds = content.blocks.filter((b) => b.type === 'embed');
      const nextText = bodyText + END_MARKER_BLOCK;
      content = { blocks: [...contentFromText(nextText).blocks, ...embeds] };
    },
    /**
     * Insert a media/article embed as a distinct inline block (REQ-EDIT-EMBED-001/007).
     * SPEC-NEWS-REVISE-001: options.caretOffset이 주어지면 본문 텍스트의 해당 위치(텍스트 character
     * 기준)에서 텍스트 블록을 분할하고 사이에 embed 블록을 삽입한다 (인라인 임베드). caretOffset이
     * 없으면 종전과 동일하게 끝에 append한다 (backwards-compatible).
     */
    embed(descriptor, options) {
      const caretOffset = options?.caretOffset;
      if (caretOffset == null) {
        content = appendEmbed(content, descriptor);
      } else {
        content = insertEmbedAtTextOffset(content, descriptor, caretOffset);
      }
    },
    /** Current content document (ordered blocks) for rendering. */
    getContent() {
      return content;
    },
    /** Plain body text (concatenated text blocks). */
    getBodyText() {
      return contentToText(content);
    },
    /** Derived {title, subtitle, body} from the current body text (REQ-EDIT-PARSE-006). */
    getStructure() {
      return parseArticleStructure(contentToText(content));
    },
  };
}
