import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';

// SPEC-UI-EDITOR-001 — AC-4 (adapter-swap does not affect DTO assembly), REQ-EDIT-EMBED-001/007.

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderCtrl(model = createFakeModel()) {
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
  );
  return renderHook(() => useWriteController(USER), { wrapper });
}

describe('useWriteController editor integration (AC-4, REQ-EDIT-EMBED)', () => {
  it('AC-4: assembleDto().markupVersion exactly equals adapter.getMarkup()', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문 텍스트'));
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('AC-4: markupVersion stays in sync after embedding an inline block', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문'));
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 't', url: 'https://img/x' }));
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('REQ-EDIT-EMBED-001: embed inserts a structured inline block, NOT an appended marker string', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문'));
    act(() => result.current.embed({ type: 'video', source: 'youtube', title: 'YT', url: 'https://youtu.be/x' }));
    const embeds = result.current.content.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('video');
    // Body text must NOT contain the old marker form.
    expect(result.current.bodyText).not.toContain('[youtube]');
    expect(result.current.bodyText).not.toContain('https://youtu.be/x');
  });

  it('REQ-EDIT-EMBED-007: multiple embeds preserve insertion order', () => {
    const { result } = renderCtrl();
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 'i', url: 'https://i/1' }));
    act(() => result.current.embed({ type: 'video', source: 'youtube', title: 'v', url: 'https://v/1' }));
    act(() => result.current.embed({ type: 'article', articleId: 'A-1', title: 'a' }));
    const types = result.current.content.blocks.filter((b) => b.type === 'embed').map((b) => b.embed.type);
    expect(types).toEqual(['image', 'video', 'article']);
  });

  it('DP-F5 invariant: send persists DTO then submits action only (no client state computation)', async () => {
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('hello body'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].markupVersion).toContain('hello body');
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
    expect(result.current.lifecycleStatus).toBe('DPS');
  });
});
