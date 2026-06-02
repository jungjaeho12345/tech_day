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
