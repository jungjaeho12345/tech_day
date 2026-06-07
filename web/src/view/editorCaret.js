// @MX:NOTE: [AUTO] contentEditable caret helpers (SPEC-UI-EDITOR-001 기사 에디터 coloring).
//
// Role-based body coloring re-writes the contentEditable's child nodes (colored line spans), which
// destroys the live selection. These helpers save/restore the caret by CHARACTER OFFSET within the
// editor root so recoloring on compositionend/blur is caret-stable. Offset = number of text characters
// before the caret in document order (text nodes only). Korean IME safety lives in the caller: it must
// NOT recolor during active composition; these helpers only move the caret, they never change text.

// SPEC-NEWS-REVISE-001 — 인라인 임베드의 텍스트 콘텐츠(제목/URL 라벨 등)는 caret/selection 계산에서
// 제외한다. [data-embed-index] 스팬 내부 텍스트 노드 길이를 합산해 raw range 길이에서 차감.
function embedTextBeforePoint(root, container, offset) {
  const doc = root.ownerDocument;
  let total = 0;
  const embedSpans = root.querySelectorAll('[data-embed-index]');
  const endRange = doc.createRange();
  endRange.setStart(root, 0);
  endRange.setEnd(container, offset);
  for (const span of embedSpans) {
    const spanRange = doc.createRange();
    spanRange.selectNode(span);
    // Span fully before/at the caret -> count its full text length.
    if (endRange.comparePoint(spanRange.endContainer, spanRange.endOffset) >= 0) {
      total += span.textContent.length;
    }
    // Caret inside the span -> count nothing (caret treated at span's start).
  }
  return total;
}

/**
 * Current caret character offset within `root` (text characters before the collapsed caret).
 * Returns null when there is no selection inside `root` (e.g. editor not focused).
 * SPEC-NEWS-REVISE-001: text inside inline embed spans ([data-embed-index]) is excluded so the offset
 * maps onto the BODY TEXT model (embed spans contribute 0 to bodyText).
 * @param {HTMLElement} root
 * @returns {number|null}
 */
export function getCaretCharOffset(root) {
  const sel = root?.ownerDocument?.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const raw = pre.toString().length;
  return raw - embedTextBeforePoint(root, range.startContainer, range.startOffset);
}

/**
 * Current selection's start/end character offsets within `root`. Returns null when no selection
 * intersects `root`. Used by SPEC-NEWS-REVISE-001 Ctrl+D handler to get the full selection range,
 * not just the collapsed caret position. Inline embed text is excluded (mirrors getCaretCharOffset).
 * @param {HTMLElement} root
 * @returns {{ start: number, end: number } | null}
 */
export function getSelectionOffsets(root) {
  const sel = root?.ownerDocument?.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const preStart = range.cloneRange();
  preStart.selectNodeContents(root);
  preStart.setEnd(range.startContainer, range.startOffset);
  const start = preStart.toString().length
    - embedTextBeforePoint(root, range.startContainer, range.startOffset);
  const preEnd = range.cloneRange();
  preEnd.selectNodeContents(root);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const end = preEnd.toString().length
    - embedTextBeforePoint(root, range.endContainer, range.endOffset);
  return { start, end };
}

/**
 * Body-text view of `root`, EXCLUDING text inside inline embed spans ([data-embed-index]).
 * Mirrors the bodyText model so caret/offset math stays in sync.
 * @param {HTMLElement} root
 * @returns {string}
 */
export function getBodyTextFromDom(root) {
  if (!root) return '';
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      let p = n.parentNode;
      while (p && p !== root) {
        if (p.nodeType === 1 && p.hasAttribute && p.hasAttribute('data-embed-index')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let out = '';
  let n = walker.nextNode();
  while (n) {
    out += n.textContent;
    n = walker.nextNode();
  }
  return out;
}

// Recover a minimal embed descriptor from a painted embed span (fallback when no model lookup is given).
function embedDescriptorFromSpan(span) {
  const testid = span.getAttribute('data-testid') || '';
  const type = testid === 'embed-video' ? 'video' : testid === 'embed-article' ? 'article' : 'image';
  return { type };
}

/**
 * Read the editor `root` into an ORDERED content document ({blocks}) that mirrors the true DOM
 * interleave of text runs and inline embed spans ([data-embed-index]). Walks the body's direct
 * descendants in document order: every embed span becomes an {type:'embed', embed} block carrying the
 * embed descriptor recovered via `embedFor` (or reconstructed from data-testid), and contiguous body
 * text (text nodes / colored line spans OUTSIDE any embed) accumulates into {type:'text', text} blocks.
 *
 * Bug 1 fix: the previous repaint path (contentWithText / setBodyText) always laid out
 * `[...textBlocks, ...embeds]`, dropping the real ordering — so text typed AFTER a trailing embed was
 * rebuilt BEFORE it, and pressing Enter re-rendered the embed BELOW the text (the image "jumped" under
 * the typed line). Reading the live DOM order preserves where each embed actually sits.
 *
 * @param {HTMLElement} root editor body
 * @param {(index:number, span:HTMLElement)=>object} [embedFor] embed descriptor lookup by ordinal
 * @returns {{ blocks: Array<object> }}
 */
export function readOrderedContentFromDom(root, embedFor) {
  if (!root) return { blocks: [] };
  const blocks = [];
  let textRun = '';
  const flushText = () => {
    if (textRun !== '') {
      blocks.push({ type: 'text', text: textRun });
      textRun = '';
    }
  };
  for (const child of root.childNodes) {
    if (child.nodeType === 1 && child.hasAttribute?.('data-embed-index')) {
      flushText();
      const index = Number(child.getAttribute('data-embed-index'));
      const embed = (typeof embedFor === 'function' ? embedFor(index, child) : null)
        ?? embedDescriptorFromSpan(child);
      blocks.push({ type: 'embed', embed });
    } else if (child.nodeType === 3) {
      textRun += child.textContent;
    } else if (child.nodeType === 1 && child.tagName !== 'BR') {
      // A colored line span contributes its text; <br> padding contributes nothing.
      textRun += child.textContent;
    }
  }
  flushText();
  return { blocks };
}

/**
 * SPEC-NEWS-REVISE-003 — caret-adjacent embed deletion (Backspace).
 * Given the editor `root`, inspect the current collapsed selection and decide whether the position
 * immediately BEFORE the caret is an inline embed span ([data-embed-index]) with no intervening text
 * character. Returns that embed's 0-based ordinal index (its `data-embed-index`), or null when the
 * preceding content is a text character / the caret is at the very start / selection is not collapsed.
 *
 * Algorithm (document order, walking backwards from the caret):
 *  - selection must be collapsed and start inside `root`.
 *  - if caret sits inside a text node at offset > 0 → a character precedes it → null (normal backspace).
 *  - otherwise we are at a node boundary (text-node offset 0, or element-child boundary): step to the
 *    nearest preceding sibling/ancestor-sibling and skip empty/whitespace-only text nodes. The first
 *    "real" preceding node decides: an embed span → return its index; anything else → null.
 *
 * Embed spans are contenteditable=false and contribute 0 chars to bodyText, so deleting one never
 * shifts the caret char-offset — the existing paint/caret-restore flow lands the caret unchanged.
 * @param {HTMLElement} root
 * @returns {number|null}
 */
export function findEmbedIndexBeforeCaret(root) {
  if (!root) return null;
  const sel = root.ownerDocument?.getSelection?.();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  let node = range.startContainer;
  let offset = range.startOffset;

  // If the caret is inside a text node past its start, a real character precedes it → normal backspace.
  if (node.nodeType === 3) {
    if (offset > 0) return null;
    // At offset 0 of a text node: the candidate is whatever precedes this text node.
  } else {
    // Element container: the candidate is the child immediately before `offset`.
    if (offset > 0) {
      node = node.childNodes[offset - 1];
      // We will inspect `node` itself as the immediately-preceding content below.
      return embedIndexFromPrecedingNode(root, node, /* inspectSelf */ true);
    }
    // offset 0 of an element: descend to its preceding boundary via ancestors.
  }

  // Walk to the nearest preceding content node (skipping empty/whitespace text), starting from the
  // previous sibling of `node`, climbing to ancestors' previous siblings as needed (but not past root).
  return embedIndexFromPrecedingNode(root, node, /* inspectSelf */ false);
}

// Returns the embed index if the nearest meaningful node preceding `node` (in document order) is an
// embed span; else null. When `inspectSelf` is true, `node` itself is the first candidate.
function isEmbedSpan(n) {
  return n && n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-embed-index');
}
function isSkippableText(n) {
  // Empty text node only. A whitespace-only text node still represents real characters in a pre-wrap
  // body (e.g. a space the user typed), so it must NOT be skipped — treat it as a real character.
  return n && n.nodeType === 3 && n.textContent.length === 0;
}
function embedIndexFromPrecedingNode(root, startNode, inspectSelf) {
  let candidate = inspectSelf ? startNode : prevInDocument(root, startNode);
  while (candidate) {
    if (isSkippableText(candidate)) {
      candidate = prevInDocument(root, candidate);
      continue;
    }
    if (isEmbedSpan(candidate)) {
      const idx = Number(candidate.getAttribute('data-embed-index'));
      return Number.isFinite(idx) ? idx : null;
    }
    // A real text character or a non-embed element precedes the caret → normal backspace.
    return null;
  }
  return null;
}
// Previous node in document order within `root`: previous sibling, or climb to an ancestor's previous
// sibling. Never returns `root` itself or steps outside it.
function prevInDocument(root, node) {
  if (!node || node === root) return null;
  if (node.previousSibling) return node.previousSibling;
  let p = node.parentNode;
  while (p && p !== root) {
    if (p.previousSibling) return p.previousSibling;
    p = p.parentNode;
  }
  return null;
}

/**
 * Place the collapsed caret at character offset `offset` within `root`. Clamps to the text length.
 * No-op when offset is null or root is empty.
 * @param {HTMLElement} root
 * @param {number|null} offset
 */
export function setCaretCharOffset(root, offset) {
  if (root == null || offset == null) return;
  const doc = root.ownerDocument;
  const sel = doc.getSelection?.();
  if (!sel) return;
  let remaining = offset;
  // SPEC-NEWS-REVISE-001: filter out text nodes that live inside inline embed spans, since those
  // contribute 0 to the body-text model. Walker filter skips embed-internal nodes entirely.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      let p = n.parentNode;
      while (p && p !== root) {
        if (p.nodeType === 1 && p.hasAttribute && p.hasAttribute('data-embed-index')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  let target = null;
  let targetOffset = 0;
  while (node) {
    const len = node.textContent.length;
    if (remaining <= len) {
      target = node;
      targetOffset = remaining;
      break;
    }
    remaining -= len;
    target = node;
    targetOffset = len;
    node = walker.nextNode();
  }
  const range = doc.createRange();
  if (target) {
    range.setStart(target, Math.min(targetOffset, target.textContent.length));
  } else {
    // No text nodes (empty editor) — collapse at the root start.
    range.setStart(root, 0);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * SPEC-NEWS-REVISE-001 — place the collapsed caret immediately AFTER the inline embed span whose
 * ordinal is `embedIndex` (span[data-embed-index="N"]). Inserting an embed adds 0 body-text chars, so
 * restoring by character offset alone can leave the caret BEFORE the embed (both positions share the
 * same offset). This helper resolves that ambiguity by anchoring the caret to the span boundary itself:
 * range.setStartAfter(span) puts the caret right after the embed, where the next typed character lands.
 * No-op when root is null or the matching span is absent (e.g. paint not yet applied / index out of range).
 * @param {HTMLElement} root
 * @param {number|null} embedIndex 0-based ordinal matching the span's data-embed-index
 */
export function setCaretAfterEmbed(root, embedIndex) {
  if (root == null || embedIndex == null) return;
  const doc = root.ownerDocument;
  const sel = doc.getSelection?.();
  if (!sel) return;
  const span = root.querySelector(`[data-embed-index="${embedIndex}"]`);
  if (!span || !root.contains(span)) return;
  const range = doc.createRange();
  // Prefer anchoring the caret at the START of the editable text node that immediately follows the embed.
  // A range positioned merely *after* a contenteditable=false span that has no editable node following it
  // is NOT a valid caret home in Chrome: execCommand/typing at that point is dropped and the visible caret
  // relocates to document start (the 첫 줄 점프 / first-line-jump regression). paintEditor now guarantees a
  // trailing editable text node after a trailing embed, so this branch lands the caret in a typeable spot.
  // The injected text node is EMPTY (0 chars), so char-offset math stays byte-stable.
  const next = span.nextSibling;
  if (next && next.nodeType === 3) {
    range.setStart(next, 0);
  } else {
    // No following text node (e.g. embed before another element): keep the boundary-after-span position.
    range.setStartAfter(span);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
