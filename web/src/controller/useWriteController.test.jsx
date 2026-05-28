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

  it('USER-REQ: assembleDto().title equals the editor\'s first line (parsed 후보 A title)', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('헤드라인 제목\n부제목\n\n본문 내용'));
    expect(result.current.assembleDto().title).toBe('헤드라인 제목');
    // AC-4 invariant unaffected by adding title to the DTO.
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('USER-REQ: 송고 calls saveArticle with a DTO carrying the parsed title', async () => {
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('DB 제목\n본문'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].title).toBe('DB 제목');
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

  it('DP-F5 invariant: kill submits the kill action only and shows returned state', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDK' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    await act(async () => { await result.current.kill(); });
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'kill');
    expect(result.current.lifecycleStatus).toBe('DDK');
  });

  it('reset: a successful action clears editor + common + articleId but keeps status', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    act(() => result.current.setBodyMarkup('to be cleared'));
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 't', url: 'https://i/1' }));
    act(() => result.current.updateCommon('author', 'Desk'));
    await act(async () => { await result.current.hold(); });
    // Status confirmation kept.
    expect(result.current.lifecycleStatus).toBe('DDH');
    // Input state reset.
    expect(result.current.bodyText).toBe('');
    expect(result.current.content.blocks).toHaveLength(0);
    // 작성자 re-defaults to the logged-in user's name after reset (news.md 공통정보), not blank.
    expect(result.current.common.author).toBe(USER.name);
    // assembleDto invariant still holds after reset (markupVersion === adapter.getMarkup()).
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('공통정보: a fresh write controller pre-fills 작성자 with the logged-in user name', () => {
    const { result } = renderCtrl();
    // news.md 기사 에디터 공통정보: 작성자는 로그인한 사용자 정보의 이름을 입력한다.
    expect(result.current.common.author).toBe(USER.name);
  });

  it('공통정보: after a successful action + reset, 작성자 is the user name again (re-defaulted)', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    // Overwrite the autofilled author, then 보류 (success) triggers reset.
    act(() => result.current.updateCommon('author', '다른작성자'));
    act(() => result.current.setBodyMarkup('제목'));
    await act(async () => { await result.current.hold(); });
    expect(result.current.common.author).toBe(USER.name);
  });

  it('공통정보: the autofilled 작성자 is still editable (updateCommon overrides it)', () => {
    const { result } = renderCtrl();
    act(() => result.current.updateCommon('author', '직접 입력'));
    expect(result.current.common.author).toBe('직접 입력');
  });

  it('reset: a rejected action leaves the page state untouched', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid-transition' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    act(() => result.current.setBodyMarkup('keep me'));
    act(() => result.current.updateCommon('author', 'Desk'));
    await act(async () => { await result.current.hold(); });
    expect(result.current.bodyText).toBe('keep me');
    expect(result.current.common.author).toBe('Desk');
    expect(result.current.lifecycleStatus).toBeNull();
  });
});
