// @MX:NOTE: [AUTO] contentEditable caret helpers (SPEC-UI-EDITOR-001 기사 에디터 coloring).
//
// Role-based body coloring re-writes the contentEditable's child nodes (colored line spans), which
// destroys the live selection. These helpers save/restore the caret by CHARACTER OFFSET within the
// editor root so recoloring on compositionend/blur is caret-stable. Offset = number of text characters
// before the caret in document order (text nodes only). Korean IME safety lives in the caller: it must
// NOT recolor during active composition; these helpers only move the caret, they never change text.

/**
 * Current caret character offset within `root` (text characters before the collapsed caret).
 * Returns null when there is no selection inside `root` (e.g. editor not focused).
 * @param {HTMLElement} root
 * @returns {number|null}
 */
export function getCaretCharOffset(root) {
  const sel = root?.ownerDocument?.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  // Walk from the start of root up to the caret, summing text length.
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
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
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
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
