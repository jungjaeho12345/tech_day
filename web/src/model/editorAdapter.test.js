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

  it('Alt+Y: appendEnd inserts a newline + "(끝)" and it survives a setMarkup round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문 내용');
    adapter.appendEnd();
    // news.md: Alt+Y inserts "\r\n (끝)" — the marker on a NEW LINE ('\n'-based model => '\n (끝)').
    expect(adapter.getBodyText()).toBe('본문 내용\n (끝)');
    // Persists in markupVersion (round-trips via setMarkup): save -> reload keeps "(끝)".
    expect(adapter.getMarkup()).toContain('(끝)');
    const m = adapter.getMarkup();
    adapter.setMarkup(m);
    expect(adapter.getBodyText()).toBe('본문 내용\n (끝)');
  });

  it('Alt+Y: appendEnd is IDEMPOTENT — a second call does not append a duplicate "(끝)"', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.appendEnd();
    adapter.appendEnd(); // already present -> no-op (news.md: 이미 있으면 삽입하지 않는다)
    const body = adapter.getBodyText();
    expect(body).toBe('본문\n (끝)');
    // Exactly one occurrence of the marker.
    expect(body.split('(끝)').length - 1).toBe(1);
  });

  it('Alt+Y: appendEnd preserves existing embeds (marker goes onto the body text, not after embeds)', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문');
    adapter.embed(IMG);
    adapter.appendEnd();
    expect(adapter.getBodyText()).toBe('본문\n (끝)');
    expect(adapter.getContent().blocks.filter((b) => b.type === 'embed')).toHaveLength(1);
  });

  it('EC-5: embedding a result without thumbnailUrl does not crash and survives round-trip', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.embed({ type: 'video', source: 'youtube', title: 'YT', url: 'https://youtu.be/x' });
    adapter.setMarkup(adapter.getMarkup());
    const embed = adapter.getContent().blocks.find((b) => b.type === 'embed').embed;
    expect(embed.thumbnailUrl).toBeUndefined();
    expect(embed.url).toBe('https://youtu.be/x');
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
