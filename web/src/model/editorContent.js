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

// The "(끝)" end marker (news.md 기사 에디터: Alt+Y, shown in 골드색). Placed as the FINAL block AFTER all
// embeds (SPEC-NEWS-REVISE: 최종 시각 순서는 본문 텍스트 → embeds → "(끝)"), modeled as a distinguished
// trailing text block. Stored as literal body text so it round-trips through markupVersion; since
// contentToText concatenates the text blocks (embeds contribute no text), the derived body text still
// ENDS with "(끝)" — the view colors that trailing occurrence gold purely presentationally. The
// gold-colored TOKEN is just "(끝)".
export const END_MARKER = '(끝)';

// SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER: Alt+Y inserts EXACTLY the "(끝)" token (prefix-free —
// no CRLF, no leading space). Simplification of the previous "\n (끝)" form which forced an explicit
// new line before the marker; the new form lets the marker flow inline at the body end. Coloring,
// idempotence, and persistence (markupVersion round-trip) are preserved (AC-ENDMARK-1/2/3).
export const END_MARKER_BLOCK = END_MARKER;

/**
 * Whether body text already ends with the "(끝)" end marker (news.md: Alt+Y is idempotent — if the
 * marker is already present at the end, pressing Alt+Y again must NOT append a duplicate). Tolerant of
 * trailing whitespace so a stray space/newline after the marker still counts as "already present".
 * Backwards-compatible: legacy markup ending with "\n (끝)" (saved before SPEC-NEWS-REVISE-002) still
 * counts as present (the legacy form still ends in "(끝)"), so re-pressing Alt+Y after loading an
 * older article is still a no-op.
 * @param {string} text
 * @returns {boolean}
 */
export function hasEndMarker(text) {
  return typeof text === 'string' && text.trimEnd().endsWith(END_MARKER);
}

/**
 * SPEC-NEWS-REVISE — Alt+Y 의 "(끝)" 은 본문 맨 마지막 다음 개행에 들어간다(자기 줄). 즉 마커 텍스트 블록은
 * base 본문이 개행으로 끝나지 않으면 앞에 '\n' 을 붙인 '\n(끝)' 이 되고, 이미 개행으로 끝나거나 본문이 비어
 * 있으면 그냥 '(끝)' 이다. 이렇게 하면 getBodyText() 가 '...본문\n(끝)' 로 끝나 hasEndMarker(=trimEnd 후
 * '(끝)' 로 끝남)와 송고 (끝) 가드가 그대로 통과한다.
 * @param {string} baseText "(끝)" 직전까지의 본문 텍스트
 * @returns {string} 마커 텍스트 블록 내용 ('(끝)' 또는 '\n(끝)')
 */
export function endMarkerBlockFor(baseText) {
  const base = typeof baseText === 'string' ? baseText : '';
  return (base === '' || base.endsWith('\n')) ? END_MARKER : `\n${END_MARKER}`;
}

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

/**
 * SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — single embed removal by ordinal index.
 *
 * Removes the N-th embed block (0-based among embed blocks only — matches the `data-embed-index`
 * attribute the editor view paints). Adjacent text blocks and other embeds are preserved
 * verbatim (AC-EMB-DEL-2). Out-of-range index is a no-op; passing a non-finite value is a no-op
 * to guarantee callers cannot corrupt the content on bad input.
 *
 * @param {{blocks: Array<object>}} content
 * @param {number} embedIndex 0-based ordinal among embed blocks
 * @returns {{blocks: Array<object>}} new content with the target embed removed
 */
export function removeEmbedAt(content, embedIndex) {
  const blocks = content?.blocks ?? [];
  if (!Number.isFinite(embedIndex) || embedIndex < 0) {
    return { blocks: [...blocks] };
  }
  let seen = 0;
  const next = [];
  let removed = false;
  for (const b of blocks) {
    if (b.type === 'embed') {
      if (!removed && seen === embedIndex) {
        removed = true;
        seen += 1;
        continue; // drop this embed block
      }
      seen += 1;
    }
    next.push(b);
  }
  return { blocks: next };
}

/**
 * SPEC-NEWS-REVISE-001 — 본문 커서 위치 임베드 삽입. caretOffset은 contentToText(content) 기준의
 * character offset이다. 텍스트 블록을 해당 offset에서 분할하고, 사이에 embed 블록을 끼워 넣는다.
 * 블록 순서가 [text-앞부분, embed, text-뒷부분, ...기존 embed들] 형태로 재구성된다.
 *
 * caretOffset이 null/undefined 또는 텍스트 길이 이상이면 appendEmbed와 동일(끝에 append).
 * caretOffset이 0이면 모든 텍스트 블록 앞에 embed가 놓인다.
 *
 * @param {{blocks: Array<object>}} content
 * @param {object} embed normalized embed descriptor
 * @param {number|null|undefined} caretOffset character offset within body text
 */
export function insertEmbedAtTextOffset(content, embed, caretOffset) {
  const blocks = content?.blocks ?? [];
  const totalText = contentToText(content);
  if (caretOffset == null || caretOffset >= totalText.length) {
    return appendEmbed(content, embed);
  }
  const at = Math.max(0, caretOffset);

  const next = [];
  let consumed = 0; // text characters consumed so far across iterated text blocks
  let inserted = false;
  for (const b of blocks) {
    if (inserted || b.type !== 'text') {
      next.push(b);
      continue;
    }
    const len = b.text.length;
    if (consumed + len < at) {
      next.push(b);
      consumed += len;
      continue;
    }
    // The split point lands inside (or at the end of) this text block.
    const localOffset = at - consumed;
    const before = b.text.slice(0, localOffset);
    const after = b.text.slice(localOffset);
    if (before !== '') next.push({ type: 'text', text: before });
    next.push({ type: 'embed', embed: { ...embed } });
    if (after !== '') next.push({ type: 'text', text: after });
    inserted = true;
  }
  if (!inserted) {
    // No text blocks (or caret at 0 with empty text) — prepend the embed.
    next.unshift({ type: 'embed', embed: { ...embed } });
  }
  return { blocks: next };
}

/**
 * SPEC-NEWS-REVISE-001 — given the content AFTER an embed insertion at `caretOffset`, return the 0-based
 * ordinal (data-embed-index) of the embed that was inserted there. Mirrors insertEmbedAtTextOffset's split
 * rule exactly: the inserted embed lands right after the text consumed up to `caretOffset`, so its ordinal
 * equals the number of embed blocks that precede that split point in document order.
 *
 * Walks blocks in order, accumulating text length; the inserted embed is the first embed block reached at
 * or after the point where accumulated text first meets/exceeds `caretOffset`. When `caretOffset` is null/
 * undefined or >= total text length (appendEmbed semantics), the inserted embed is the LAST embed block, so
 * its ordinal = (embed count - 1). Returns null when the content has no embeds.
 *
 * @param {{blocks: Array<object>}} content content already containing the inserted embed
 * @param {number|null|undefined} caretOffset the body-text offset used for the insertion
 * @returns {number|null} the inserted embed's 0-based ordinal, or null when there are no embeds
 */
export function embedOrdinalAtInsertOffset(content, caretOffset) {
  const blocks = content?.blocks ?? [];
  const embedCount = blocks.filter((b) => b.type === 'embed').length;
  if (embedCount === 0) return null;
  const totalText = contentToText(content);
  // Append semantics: the inserted embed is the trailing one.
  if (caretOffset == null || caretOffset >= totalText.length) return embedCount - 1;
  const at = Math.max(0, caretOffset);

  let consumed = 0;
  let ordinal = 0;
  for (const b of blocks) {
    if (b.type === 'text') {
      // Once accumulated text has reached the split point, the next embed block is the inserted one.
      if (consumed >= at) break;
      consumed += b.text.length;
      continue;
    }
    // embed block
    if (consumed >= at) break; // first embed at/after the split point = the inserted one
    ordinal += 1;
  }
  return ordinal;
}

/**
 * Bug 1 fix — splice a single '\n' into an ORDERED content document at body-text `offset`, preserving
 * the exact interleave of text and embed blocks. Embeds contribute 0 body-text chars, so they are
 * treated as zero-width anchors: the newline lands inside the text block that spans `offset`, and every
 * embed keeps its position relative to the surrounding text. This replaces the old `[...text, ...embeds]`
 * rebuild (which dropped ordering and dropped a trailing embed BELOW text typed after it).
 *
 * Boundary rule: when `offset` falls exactly at the seam between a text block and a following embed, the
 * '\n' is appended to the END of the preceding text run (the caret sat after that text, before the embed),
 * so the embed stays after the newline — never hoisted above it. When `offset` is 0 or precedes all text,
 * the '\n' opens a new leading text block before any embed.
 *
 * @param {{blocks: Array<object>}} content ordered content (e.g. read from the live DOM)
 * @param {number|null|undefined} offset body-text character offset of the caret
 * @returns {{blocks: Array<object>}} new content with a '\n' spliced at the caret
 */
export function insertNewlineIntoContent(content, offset) {
  const blocks = (content?.blocks ?? []).map((b) =>
    b.type === 'embed' ? { type: 'embed', embed: { ...b.embed } } : { type: 'text', text: b.text });
  const totalText = blocks.filter((b) => b.type === 'text').reduce((n, b) => n + b.text.length, 0);
  const at = offset == null ? totalText : Math.max(0, Math.min(offset, totalText));

  let consumed = 0;
  let lastTextBlock = null;
  for (const b of blocks) {
    if (b.type !== 'text') continue;
    const len = b.text.length;
    // The caret lands inside this text block (or at its end when it is the run containing `at`).
    if (at <= consumed + len) {
      const local = at - consumed;
      b.text = `${b.text.slice(0, local)}\n${b.text.slice(local)}`;
      return { blocks };
    }
    consumed += len;
    lastTextBlock = b;
  }
  // `at` is past all text (e.g. caret after a trailing embed with no following text run). Append the
  // newline to the last text block if one exists; otherwise add a trailing text block so the new line
  // sits AFTER the existing blocks (the embed is NOT moved above it).
  if (lastTextBlock) {
    lastTextBlock.text += '\n';
  } else {
    blocks.push({ type: 'text', text: '\n' });
  }
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
