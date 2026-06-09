import { describe, it, expect, afterEach } from 'vitest';
import { setCaretCharOffset, getCaretCharOffset, findEmbedIndexBeforeCaret, setCaretAfterEmbed, readOrderedContentFromDom } from './editorCaret.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';

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

  // SPEC-NEWS-REVISE-001 (첫 줄 점프 회귀) — when an editable text node immediately follows the embed,
  // anchor the caret at the START of that text node (a valid typeable position) rather than at the bare
  // boundary after the contenteditable=false span (which Chrome relocates to document start).
  it('anchors the caret at the start of the following text node when one exists (typeable position)', () => {
    const { root, afterNode } = buildEditor({ embedIndex: 0, after: 'post' });
    setCaretAfterEmbed(root, 0);
    const range = document.getSelection().getRangeAt(0);
    expect(range.startContainer).toBe(afterNode);
    expect(range.startOffset).toBe(0);
    // Still reported as adjacent to embed#0 (the caret sits right behind it).
    expect(findEmbedIndexBeforeCaret(root)).toBe(0);
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

// SPEC-NEWS-REVISE-009 REQ-EMBED-TEXT-ORDER (Bug 1 회귀 가드) — 트레일링 임베드 뒤에 입력된 텍스트가
// repaint/직렬화 후에도 임베드 아래로 점프하지 않도록, readOrderedContentFromDom 이 라이브 DOM 의
// 텍스트-임베드 interleave 순서(본문 텍스트 → 임베드 → 추가)를 그대로 읽는지(= [...textBlocks,...embeds]
// 강제 재배치가 아닌지) 단위로 잠근다. [HARD] SPEC-001 커서 임베드/Ctrl+D, SPEC-UI-EDITOR-001 임베드
// 상호 순서·어댑터 계약은 변경하지 않는다 — 본 가드는 순서 보존만 단언한다.
describe('readOrderedContentFromDom — 텍스트-임베드 시각 순서 보존 (Bug 1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.getSelection()?.removeAllRanges();
  });

  // Build: <div root> [text before]? <span data-embed-index=N>card</span> [text after]? </div>
  function buildBody({ before = '', embedIndex = 0, after = '' } = {}) {
    const root = document.createElement('div');
    if (before) root.appendChild(document.createTextNode(before));
    const embed = document.createElement('span');
    embed.setAttribute('data-embed-index', String(embedIndex));
    embed.setAttribute('contenteditable', 'false');
    embed.setAttribute('data-testid', 'embed-image');
    embed.textContent = 'card';
    root.appendChild(embed);
    if (after) root.appendChild(document.createTextNode(after));
    document.body.appendChild(root);
    return root;
  }

  // AC-ORDER-1 — 트레일링 임베드 뒤 텍스트 입력 후, blocks 가 text→embed→text interleave 순서다
  // ([...textBlocks, ...embeds] 형태가 아니다).
  it('AC-ORDER-1: [본문][embed][추가] 를 interleave 순서로 읽는다 (텍스트를 앞으로 몰지 않음)', () => {
    const root = buildBody({ before: '본문', embedIndex: 0, after: '추가' });
    const embedFor = () => ({ type: 'image' });
    const { blocks } = readOrderedContentFromDom(root, embedFor);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'text', text: '본문' });
    expect(blocks[1].type).toBe('embed');
    expect(blocks[2]).toEqual({ type: 'text', text: '추가' });
    // 명시적 negative: 임베드가 마지막(텍스트 전부 앞, 임베드 전부 뒤)으로 밀리지 않는다.
    expect(blocks[blocks.length - 1].type).not.toBe('embed');
  });

  // AC-ORDER-2 — 임베드 블록이 입력 텍스트 "추가" 블록보다 앞에 유지된다(임베드가 텍스트 아래로 점프 = Bug 1
  // 회귀가 일어나지 않는다). readOrderedContentFromDom 은 repaint 직렬화의 입력원이므로 여기서의 순서가
  // 그대로 repaint 순서가 된다.
  it('AC-ORDER-2: 임베드 블록이 입력 텍스트 블록보다 앞 인덱스에 유지된다', () => {
    const root = buildBody({ before: '본문', embedIndex: 0, after: '추가' });
    const { blocks } = readOrderedContentFromDom(root, () => ({ type: 'image' }));
    const embedIdx = blocks.findIndex((b) => b.type === 'embed');
    const addedIdx = blocks.findIndex((b) => b.type === 'text' && b.text === '추가');
    expect(embedIdx).toBeGreaterThanOrEqual(0);
    expect(addedIdx).toBeGreaterThanOrEqual(0);
    expect(embedIdx).toBeLessThan(addedIdx);
  });

  // AC-ORDER-4 — interleave round-trip(read → setOrderedContent → 직렬화 blocks)에서 텍스트/임베드 상대
  // 순서가 보존된다(임베드 유실/중복/순서뒤바뀜 없음). 어댑터(createStructuredEditorAdapter)가 실제 owner.
  it('AC-ORDER-4: interleave round-trip(read → setOrderedContent)에서 상대 순서가 보존된다', () => {
    // DOM: 텍스트 → embed#0 → 텍스트 → embed#1
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('가'));
    const e0 = document.createElement('span');
    e0.setAttribute('data-embed-index', '0');
    e0.setAttribute('data-testid', 'embed-image');
    e0.textContent = 'i0';
    root.appendChild(e0);
    root.appendChild(document.createTextNode('나'));
    const e1 = document.createElement('span');
    e1.setAttribute('data-embed-index', '1');
    e1.setAttribute('data-testid', 'embed-video');
    e1.textContent = 'i1';
    root.appendChild(e1);
    document.body.appendChild(root);

    const ordered = readOrderedContentFromDom(root, (i) => ({ type: i === 1 ? 'video' : 'image' }));
    expect(ordered.blocks.map((b) => b.type)).toEqual(['text', 'embed', 'text', 'embed']);

    const adapter = createStructuredEditorAdapter();
    adapter.setOrderedContent(ordered);
    const persisted = JSON.parse(adapter.getMarkup()).blocks;
    // 상대 순서 유지 + 임베드 2개 그대로(유실/중복 없음).
    expect(persisted.map((b) => b.type)).toEqual(['text', 'embed', 'text', 'embed']);
    expect(persisted.filter((b) => b.type === 'embed')).toHaveLength(2);
    expect(persisted[1].embed.type).toBe('image');
    expect(persisted[3].embed.type).toBe('video');
  });

  // AC-ORDER-3 — Alt+Y "(끝)" 이 임베드 뒤 최종 블록으로 배치된다 (최종 순서: 텍스트 → 임베드 → "(끝)").
  // appendEnd 가 실제 owner. getBodyText 는 여전히 "(끝)" 로 끝나 골드 coloring/송고 가드와 정합한다.
  it('AC-ORDER-3: Alt+Y "(끝)" 이 임베드 뒤 최종 블록으로 배치된다 (텍스트 → 임베드 → "(끝)")', () => {
    // DOM 에서 읽은 [본문, embed] 를 어댑터에 적용한 뒤 appendEnd.
    const root = buildBody({ before: '본문', embedIndex: 0 });
    const ordered = readOrderedContentFromDom(root, () => ({ type: 'image' }));
    const adapter = createStructuredEditorAdapter();
    adapter.setOrderedContent(ordered);
    adapter.appendEnd();

    const blocks = JSON.parse(adapter.getMarkup()).blocks;
    const types = blocks.map((b) => b.type);
    // 최종 시각 순서: 본문 텍스트 → 임베드 → "(끝)".
    expect(types).toEqual(['text', 'embed', 'text']);
    expect(blocks[0]).toEqual({ type: 'text', text: '본문' });
    expect(blocks[1].type).toBe('embed');
    expect(blocks[2]).toEqual({ type: 'text', text: '(끝)' });
    // 본문 텍스트 모델은 "(끝)" 로 끝난다(송고 가드/골드 coloring 정합).
    expect(adapter.getBodyText().endsWith('(끝)')).toBe(true);
    // 임베드는 "(끝)" 보다 앞이다 (마지막 블록이 임베드가 아니다).
    const endIdx = types.lastIndexOf('text');
    const embedIdx = types.indexOf('embed');
    expect(embedIdx).toBeLessThan(endIdx);
  });
});
