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
  removeEmbedAt,
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
    /**
     * Replace the body text portion, preserving existing embeds.
     *
     * SPEC-NEWS-REVISE: the "(끝)" end marker is modeled as a DISTINGUISHED FINAL text block placed
     * AFTER all embeds (final visual order: 본문 텍스트 → embeds → "(끝)"). To keep that order stable
     * across typing, when the incoming `text` ends with exactly the "(끝)" marker we peel the marker
     * off and lay out `[...base text, ...embeds, "(끝)" block]`. Without this, the next keystroke would
     * rebuild content as `[...text(끝), ...embeds]` and flip the marker back in FRONT of the embeds.
     * When the text has no trailing marker, the original `[...text, ...embeds]` layout is used.
     */
    setBodyText(text) {
      const embeds = content.blocks.filter((b) => b.type === 'embed');
      const value = typeof text === 'string' ? text : '';
      if (value.endsWith(END_MARKER_BLOCK)) {
        const base = value.slice(0, value.length - END_MARKER_BLOCK.length);
        content = {
          blocks: [...contentFromText(base).blocks, ...embeds, { type: 'text', text: END_MARKER_BLOCK }],
        };
        return;
      }
      content = { blocks: [...contentFromText(value).blocks, ...embeds] };
    },
    /**
     * Insert the gold "(끝)" marker as the FINAL block, AFTER all embeds (news.md 기사 에디터 Alt+Y).
     * SPEC-NEWS-REVISE: the marker now renders after the entire content (본문 텍스트 → embeds → "(끝)"),
     * not before trailing embeds. It is the distinguished final text block, so block order becomes
     * `[...base text, ...embeds, "(끝)" block]`. The token is exactly "(끝)" (prefix-free) and stored as
     * literal body text so it round-trips through markupVersion (save -> reload keeps the after-embeds
     * order). IDEMPOTENT: if the body already ends with the "(끝)" marker (new or legacy "\n (끝)" form),
     * this is a no-op (no duplicate). Embeds are preserved. getBodyText() still ENDS with "(끝)" because
     * contentToText concatenates the marker block last (embeds contribute no text), so the 송고 guard and
     * hasEndMarker keep working.
     */
    appendEnd() {
      const bodyText = contentToText(content);
      if (hasEndMarker(bodyText)) return; // already present -> do not append a duplicate
      const embeds = content.blocks.filter((b) => b.type === 'embed');
      content = {
        blocks: [...contentFromText(bodyText).blocks, ...embeds, { type: 'text', text: END_MARKER_BLOCK }],
      };
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
    /**
     * SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — Remove a single inline embed by its ordinal index
     * (0-based among embed blocks; matches the `data-embed-index` attribute the editor paints).
     * Adjacent text/embed blocks are preserved (AC-EMB-DEL-2). Out-of-range/non-finite is a no-op.
     */
    removeEmbed(embedIndex) {
      content = removeEmbedAt(content, embedIndex);
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
