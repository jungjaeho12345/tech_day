import { describe, it, expect, afterEach } from 'vitest';
import { setCaretCharOffset, getCaretCharOffset, findEmbedIndexBeforeCaret, setCaretAfterEmbed } from './editorCaret.js';

// SPEC-UI-EDITOR-001 — contentEditable caret save/restore by character offset. These cover
// setCaretCharOffset, including the empty-editor fallback (no text nodes -> collapse at root start).
describe('setCaretCharOffset (contentEditable caret restore)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.getSelection()?.removeAllRanges();
  });

  it('collapses the caret at the root start when the editor has no text nodes (empty editor)', () => {
    const root = document.createElement('div');
    document.body.appendChild(root); // empty: the tree walker finds no text nodes
    // offset is non-null, but there is nothing to walk -> the fallback range.setStart(root, 0) path.
    setCaretCharOffset(root, 0);
    const sel = document.getSelection();
    expect(sel.rangeCount).toBe(1);
    const range = sel.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    expect(range.startContainer).toBe(root);
    expect(range.startOffset).toBe(0);
  });

  it('is a no-op when offset is null (caret/selection left untouched)', () => {
    const root = document.createElement('div');
    root.textContent = 'hello';
    document.body.appendChild(root);
    document.getSelection().removeAllRanges();
    setCaretCharOffset(root, null);
    expect(document.getSelection().rangeCount).toBe(0);
  });

  it('is a no-op when root is null', () => {
    expect(() => setCaretCharOffset(null, 3)).not.toThrow();
  });

  it('places the collapsed caret at the given character offset inside a text node', () => {
    const root = document.createElement('div');
    root.textContent = 'hello world';
    document.body.appendChild(root);
    setCaretCharOffset(root, 5);
    const range = document.getSelection().getRangeAt(0);
    expect(range.startContainer.nodeType).toBe(3); // Node.TEXT_NODE
    expect(range.startOffset).toBe(5);
    // Round-trips through getCaretCharOffset (offset measured back out of the DOM).
    expect(getCaretCharOffset(root)).toBe(5);
  });
});

// SPEC-NEWS-REVISE-003 — caret-adjacent Backspace embed deletion. findEmbedIndexBeforeCaret returns
// the embed ordinal when the collapsed caret sits immediately after an embed span, else null.
describe('findEmbedIndexBeforeCaret (caret-adjacent embed deletion)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.getSelection()?.removeAllRanges();
  });

  // Build: <div root> [text "before"]? <span data-embed-index=N>card</span> [text "after"]? </div>
  function buildEditor({ before = '', embedIndex = 0, after = '', extraEmbedBefore = false } = {}) {
    const root = document.createElement('div');
    if (extraEmbedBefore) {
      const e0 = document.createElement('span');
      e0.setAttribute('data-embed-index', '0');
      e0.setAttribute('contenteditable', 'false');
      e0.textContent = 'first';
      root.appendChild(e0);
    }
    if (before) root.appendChild(document.createTextNode(before));
    const embed = document.createElement('span');
    embed.setAttribute('data-embed-index', String(embedIndex));
    embed.setAttribute('contenteditable', 'false');
    embed.textContent = 'card';
    root.appendChild(embed);
    let afterNode = null;
    if (after) {
      afterNode = document.createTextNode(after);
      root.appendChild(afterNode);
    }
    document.body.appendChild(root);
    return { root, embed, afterNode };
  }

  function collapseAt(node, offset) {
    const sel = document.getSelection();
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it('returns null when no selection exists', () => {
    const { root } = buildEditor({ after: 'after' });
    document.getSelection().removeAllRanges();
    expect(findEmbedIndexBeforeCaret(root)).toBe(null);
  });

  it('returns the embed index when caret is at offset 0 of a text node whose previous sibling is the embed', () => {
    const { root, afterNode } = buildEditor({ embedIndex: 2, after: 'after' });
    collapseAt(afterNode, 0);
    expect(findEmbedIndexBeforeCaret(root)).toBe(2);
  });

  it('returns the embed index when caret is at the element boundary right after the embed (no trailing text)', () => {
    const { root } = buildEditor({ embedIndex: 1, after: '' });
    // Caret at end of root: childNodes = [embed]; offset 1 means "after the embed".
    collapseAt(root, root.childNodes.length);
    expect(findEmbedIndexBeforeCaret(root)).toBe(1);
  });

  it('returns null when caret is right after a real character (normal backspace)', () => {
    const { root, afterNode } = buildEditor({ embedIndex: 0, after: 'after' });
    collapseAt(afterNode, 3); // inside "after", a char precedes the caret
    expect(findEmbedIndexBeforeCaret(root)).toBe(null);
  });

  it('returns null when caret is at the very start of the editor', () => {
    const { root } = buildEditor({ before: 'pre', embedIndex: 0, after: '' });
    const firstText = root.firstChild; // "pre" text node
    collapseAt(firstText, 0);
    expect(findEmbedIndexBeforeCaret(root)).toBe(null);
  });

  it('returns null when the preceding sibling is a text character (caret after text before embed)', () => {
    const { root } = buildEditor({ before: 'pre', embedIndex: 0, after: '' });
    const firstText = root.firstChild;
    collapseAt(firstText, 3); // end of "pre", before the embed → char precedes
    expect(findEmbedIndexBeforeCaret(root)).toBe(null);
  });

  it('returns only the nearest embed index when two embeds are adjacent', () => {
    const { root } = buildEditor({ extraEmbedBefore: true, embedIndex: 1, after: '' });
    // root: [embed#0][embed#1]; caret at the end → nearest preceding is embed#1.
    collapseAt(root, root.childNodes.length);
    expect(findEmbedIndexBeforeCaret(root)).toBe(1);
  });

  it('returns null when the selection is not collapsed (range selection)', () => {
    const { root, afterNode } = buildEditor({ embedIndex: 0, after: 'after' });
    const sel = document.getSelection();
    const range = document.createRange();
    range.setStart(afterNode, 0);
    range.setEnd(afterNode, 2); // non-collapsed
    sel.removeAllRanges();
    sel.addRange(range);
    expect(findEmbedIndexBeforeCaret(root)).toBe(null);
  });

  it('skips an empty text node between the embed and the caret', () => {
    const { root, embed } = buildEditor({ embedIndex: 3, after: '' });
    const empty = document.createTextNode(''); // empty text node after the embed
    root.appendChild(empty);
    const tail = document.createTextNode('x');
    root.appendChild(tail);
    void embed;
    collapseAt(tail, 0); // caret before "x"; previous siblings: empty text, then embed#3
    expect(findEmbedIndexBeforeCaret(root)).toBe(3);
  });

  it('returns null when root is null', () => {
    expect(findEmbedIndexBeforeCaret(null)).toBe(null);
  });
});

// SPEC-NEWS-REVISE-001 — setCaretAfterEmbed anchors the collapsed caret right after the embed span so a
// freshly inserted (0-char) embed lands the caret BEHIND it, not before it.
describe('setCaretAfterEmbed (caret after a just-inserted inline embed)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.getSelection()?.removeAllRanges();
  });

  // Build: <div root> [text before]? <span data-embed-index=N>card</span> [text after]? </div>
  function buildEditor({ before = '', embedIndex = 0, after = '' } = {}) {
    const root = document.createElement('div');
    if (before) root.appendChild(document.createTextNode(before));
    const embed = document.createElement('span');
    embed.setAttribute('data-embed-index', String(embedIndex));
    embed.setAttribute('contenteditable', 'false');
    embed.textContent = 'card';
    root.appendChild(embed);
    let afterNode = null;
    if (after) {
      afterNode = document.createTextNode(after);
      root.appendChild(afterNode);
    }
    document.body.appendChild(root);
    return { root, embed, afterNode };
  }

  it('places the collapsed caret immediately after the embed span (no trailing text)', () => {
    const { root, embed } = buildEditor({ embedIndex: 0, after: '' });
    setCaretAfterEmbed(root, 0);
    const sel = document.getSelection();
    expect(sel.rangeCount).toBe(1);
    const range = sel.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    // setStartAfter(span) => container is the span's parent, offset is the index right after the span.
    expect(range.startContainer).toBe(root);
    expect(range.startOffset).toBe(Array.prototype.indexOf.call(root.childNodes, embed) + 1);
    // The caret sits AFTER the embed, so findEmbedIndexBeforeCaret reports it as the preceding embed.
    expect(findEmbedIndexBeforeCaret(root)).toBe(0);
  });

  it('places the caret after the embed and before existing trailing text', () => {
    const { root } = buildEditor({ before: 'pre', embedIndex: 1, after: 'post' });
    setCaretAfterEmbed(root, 1);
    // The caret is at the boundary right after the embed → still reported as adjacent to embed#1.
    expect(findEmbedIndexBeforeCaret(root)).toBe(1);
  });

  it('selects the embed by its data-embed-index ordinal (not DOM position) among multiple embeds', () => {
    const root = document.createElement('div');
    const e0 = document.createElement('span');
    e0.setAttribute('data-embed-index', '0');
    e0.textContent = 'a';
    const e1 = document.createElement('span');
    e1.setAttribute('data-embed-index', '1');
    e1.textContent = 'b';
    root.append(e0, e1);
    document.body.appendChild(root);
    setCaretAfterEmbed(root, 0);
    // Caret after embed#0 (and before embed#1) → nearest preceding embed is #0.
    expect(findEmbedIndexBeforeCaret(root)).toBe(0);
  });

  it('is a no-op when no span matches the index (caret/selection left untouched)', () => {
    const { root } = buildEditor({ embedIndex: 0 });
    document.getSelection().removeAllRanges();
    setCaretAfterEmbed(root, 5); // no embed#5
    expect(document.getSelection().rangeCount).toBe(0);
  });

  it('is a no-op when embedIndex is null', () => {
    const { root } = buildEditor({ embedIndex: 0 });
    document.getSelection().removeAllRanges();
    setCaretAfterEmbed(root, null);
    expect(document.getSelection().rangeCount).toBe(0);
  });

  it('is a no-op when root is null', () => {
    expect(() => setCaretAfterEmbed(null, 0)).not.toThrow();
  });
});
