import { describe, it, expect } from 'vitest';
import { createStructuredEditorAdapter, createPlainTextEditorAdapter } from './editorAdapter.js';

// SPEC-UI-EDITOR-001 — REQ-EDIT-ADP-001..003, REQ-EDIT-EMBED-005.
// The concrete adapter sits behind the unchanged EditorAdapter contract (getMarkup/setMarkup).

const IMG = { type: 'image', source: 'youtube', title: '현장 사진', url: 'https://img/x', thumbnailUrl: 'https://thumb/x' };
const ARTICLE = { type: 'article', articleId: 'A-1', title: '폭우 피해' };

describe('createStructuredEditorAdapter (REQ-EDIT-ADP)', () => {
  it('REQ-EDIT-ADP-001: exposes the getMarkup/setMarkup contract surface', () => {
    const adapter = createStructuredEditorAdapter();
    expect(typeof adapter.getMarkup).toBe('function');
    expect(typeof adapter.setMarkup).toBe('function');
  });

  it('REQ-EDIT-ADP-002/003: setMarkup loads markup that getMarkup returns verbatim', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('hello body');
    const markup = adapter.getMarkup();
    adapter.setMarkup(markup);
    expect(adapter.getMarkup()).toBe(markup);
  });

  it('AC-5.1 contract: typed body text appears within the markupVersion string', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('hello body');
    expect(adapter.getMarkup()).toContain('hello body');
  });

  it('AC-3 / EC-3: embeds round-trip in order through getMarkup -> setMarkup', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.embed(ARTICLE);
    const before = adapter.getContent().blocks.filter((b) => b.type === 'embed');
    const m = adapter.getMarkup();
    adapter.setMarkup(m);
    const after = adapter.getContent().blocks.filter((b) => b.type === 'embed');
    expect(after).toEqual(before);
    expect(after.map((b) => b.embed.type)).toEqual(['image', 'article']);
  });

  it('REQ-EDIT-PARSE-006: getStructure derives title/subtitle/body from current markup', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('제목\n부제목\n\n본문줄');
    expect(adapter.getStructure()).toEqual({ title: '제목', subtitle: '부제목', body: '본문줄' });
  });

  // SPEC-NEWS-REVISE — AC-ENDMARK-1: "(끝)" 은 본문 맨 마지막 다음 개행에 자기 줄로 들어간다('\n(끝)').
  it('AC-ENDMARK-1: appendEnd places "(끝)" on its own new line at the end and survives a setMarkup round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문 내용');
    adapter.appendEnd();
    expect(adapter.getBodyText()).toBe('본문 내용\n(끝)');
    expect(adapter.getMarkup()).toContain('(끝)');
    const m = adapter.getMarkup();
    adapter.setMarkup(m);
    expect(adapter.getBodyText()).toBe('본문 내용\n(끝)');
  });

  // SPEC-NEWS-REVISE — AC-ENDMARK-2: idempotent (개행 줄 형태에서도 중복 없음).
  it('AC-ENDMARK-2: appendEnd is IDEMPOTENT — a second call does not append a duplicate "(끝)"', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.appendEnd();
    adapter.appendEnd();
    const body = adapter.getBodyText();
    expect(body).toBe('본문\n(끝)');
    expect(body.split('(끝)').length - 1).toBe(1);
  });

  // SPEC-NEWS-REVISE-002 — AC-ENDMARK-2 backwards compatibility: legacy "\n (끝)" 형태 무변경.
  it('AC-ENDMARK-2 backwards-compatible: appendEnd is a no-op when legacy "\\n (끝)" form is already present', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문\n (끝)');
    adapter.appendEnd();
    expect(adapter.getBodyText()).toBe('본문\n (끝)');
  });

  it('AC-ENDMARK-1: appendEnd preserves existing embeds', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.appendEnd();
    expect(adapter.getBodyText()).toBe('본문\n(끝)');
    expect(adapter.getContent().blocks.filter((b) => b.type === 'embed')).toHaveLength(1);
  });

  // SPEC-NEWS-REVISE — Alt+Y "(끝)" must be placed AFTER all embeds (final block), on its own new line.
  it('END-AFTER-EMBED: appendEnd places "(끝)" as the LAST block, after a trailing embed', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.appendEnd();
    const blocks = adapter.getContent().blocks;
    // block order: [text "본문", embed, text "\n(끝)"] — 마커는 개행 줄 형태로 임베드 뒤 최종 블록.
    expect(blocks).toEqual([
      { type: 'text', text: '본문' },
      { type: 'embed', embed: { ...IMG } },
      { type: 'text', text: '\n(끝)' },
    ]);
    // the marker is the FINAL block (after the embed)
    expect(blocks[blocks.length - 1]).toEqual({ type: 'text', text: '\n(끝)' });
    // body text invariant: getBodyText() still ends with "(끝)" so the 송고 guard keeps working
    expect(adapter.getBodyText().endsWith('(끝)')).toBe(true);
  });

  // SPEC-NEWS-REVISE — typing after Alt+Y keeps the marker last (setBodyText with a trailing marker +
  // existing embed re-lays out so "(끝)" stays the final block, never flipping in front of the embed).
  it('END-AFTER-EMBED: setBodyText with a trailing marker keeps "(끝)" after the embed', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.appendEnd(); // [text 본문, embed, text (끝)]
    // Simulate the next keystroke: the DOM body text (embed contributes no text) is "본문X(끝)".
    adapter.setBodyText('본문X(끝)');
    const blocks = adapter.getContent().blocks;
    expect(blocks).toEqual([
      { type: 'text', text: '본문X' },
      { type: 'embed', embed: { ...IMG } },
      { type: 'text', text: '(끝)' },
    ]);
    expect(blocks[blocks.length - 1]).toEqual({ type: 'text', text: '(끝)' });
    expect(adapter.getBodyText()).toBe('본문X(끝)');
  });

  // SPEC-NEWS-REVISE — the after-embeds marker order round-trips through markupVersion.
  it('END-AFTER-EMBED: marker-after-embeds order survives a markup round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.appendEnd();
    const before = adapter.getContent().blocks;
    const m = adapter.getMarkup();
    const adapter2 = createStructuredEditorAdapter();
    adapter2.setMarkup(m);
    expect(adapter2.getContent().blocks).toEqual(before);
    expect(adapter2.getBodyText().endsWith('(끝)')).toBe(true);
  });

  it('EC-5: embedding a result without thumbnailUrl does not crash and survives round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.embed({ type: 'video', source: 'youtube', title: 'YT', url: 'https://youtu.be/x' });
    adapter.setMarkup(adapter.getMarkup());
    const embed = adapter.getContent().blocks.find((b) => b.type === 'embed').embed;
    expect(embed.thumbnailUrl).toBeUndefined();
    expect(embed.url).toBe('https://youtu.be/x');
  });

  // SPEC-NEWS-REVISE-002 — AC-EMB-DEL-3: adapter.removeEmbed(index) survives markup round-trip.
  it('AC-EMB-DEL-3: removeEmbed(index) drops the N-th embed and survives a markup round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.embed(ARTICLE);
    expect(adapter.getContent().blocks.filter((b) => b.type === 'embed')).toHaveLength(2);

    adapter.removeEmbed(0);
    let embeds = adapter.getContent().blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('article');

    const markup = adapter.getMarkup();
    const adapter2 = createStructuredEditorAdapter();
    adapter2.setMarkup(markup);
    embeds = adapter2.getContent().blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('article');
  });
});

describe('createPlainTextEditorAdapter (legacy compatibility preserved)', () => {
  it('still round-trips a plain string', () => {
    const adapter = createPlainTextEditorAdapter('x');
    expect(adapter.getMarkup()).toBe('x');
    adapter.setMarkup('y');
    expect(adapter.getMarkup()).toBe('y');
  });
});
