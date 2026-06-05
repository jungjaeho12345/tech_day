// Feature 3 — 데스크 미송고 edit: useWriteController(user, { editArticleId }) loads the article on mount
// (markupVersion + common fields) and saves with the loaded id (PUT/update path), while blank-new is
// unchanged when no editArticleId is supplied.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderCtrl(model, options) {
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
  );
  return renderHook(() => useWriteController(USER, options), { wrapper });
}

// Build a realistic markupVersion string for the loaded row (versioned JSON from the editor model).
function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

describe('useWriteController edit-load (Feature 3)', () => {
  it('loads markupVersion + common fields from the row identified by editArticleId', async () => {
    const loadedMarkup = markupFor('로드된 본문');
    const row = {
      articleId: 'A-100',
      markupVersion: loadedMarkup,
      author: '김기자',
      region: '서울',
      attribute: '일반',
      keyword: '폭우',
    };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-100' });

    // Queried by the edit id.
    await waitFor(() => expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-100' }));
    // Editor markup loaded — assembleDto().markupVersion reflects the loaded markup (AC invariant).
    await waitFor(() => {
      expect(result.current.assembleDto().markupVersion).toBe(loadedMarkup);
    });
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
    expect(result.current.bodyText).toContain('로드된 본문');
    // Common fields populated from the present row fields.
    expect(result.current.common.author).toBe('김기자');
    expect(result.current.common.region).toBe('서울');
    expect(result.current.common.attribute).toBe('일반');
    expect(result.current.common.keyword).toBe('폭우');
    // Fields absent on the row stay blank.
    expect(result.current.common.coAuthor).toBe('');
  });

  it('saving an edited article uses the loaded id (update/PUT path), not A-DRAFT', async () => {
    const row = { articleId: 'A-200', markupVersion: markupFor('기존 본문(끝)'), author: '원작성자' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-200' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(
      createFakeModel({ queryArticles, saveArticle, applyAction }),
      { editArticleId: 'A-200' },
    );

    await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
    await act(async () => { await result.current.send(); });

    // saveArticle called with the LOADED id -> the model PUTs (updates) instead of POSTing a new row.
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][0]).toBe('A-200');
    // applyAction uses the same id.
    expect(applyAction).toHaveBeenCalledWith('A-200', 'D', 'send');
  });

  it('no editArticleId => blank-new behavior is unchanged (no query, A-DRAFT)', async () => {
    const queryArticles = vi.fn().mockResolvedValue([]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-0001' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ queryArticles, saveArticle, applyAction }));

    // No edit-load query is fired.
    expect(queryArticles).not.toHaveBeenCalled();
    // Blank editor + a save uses the A-DRAFT id (POST/create path in the model).
    act(() => result.current.setBodyMarkup('새 본문(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
  });

  // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — frontend lock integration (AC-EDIT-LOCK-1/2/4/5).
  describe('edit lock integration (AC-EDIT-LOCK-1/2/4/5)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('AC-EDIT-LOCK-1: editArticleId 마운트 시 acquireEditLock(articleId, { sessionId })가 호출된다', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: true });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-1', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-1' },
      );
      await waitFor(() => expect(acquireEditLock).toHaveBeenCalled());
      const [callArticleId, opts] = acquireEditLock.mock.calls[0];
      expect(callArticleId).toBe('A-LOCK-1');
      expect(opts).toEqual(expect.objectContaining({ sessionId: expect.any(String) }));
      // page-scoped sessionId은 비어 있지 않다.
      expect(opts.sessionId.length).toBeGreaterThan(0);
    });

    it('AC-EDIT-LOCK-2: acquireEditLock이 { ok:false, reason:"locked" } 반환 → lockError state 설정', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-2', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      const { result } = renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-2' },
      );
      await waitFor(() => expect(result.current.lockError).toBeTruthy());
      // locked는 명시적 distinguishable reason이 노출되어야 한다.
      expect(result.current.lockError).toEqual(expect.objectContaining({ reason: 'locked' }));
    });

    it('AC-EDIT-LOCK-4: beforeunload + visibilitychange:hidden 둘 다 navigator.sendBeacon으로 락 해제', async () => {
      const sendBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { ...globalThis.navigator, sendBeacon });
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: true });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-4', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-4' },
      );
      await waitFor(() => expect(acquireEditLock).toHaveBeenCalled());
      // 채널 1 — beforeunload
      act(() => { window.dispatchEvent(new Event('beforeunload')); });
      // 채널 2 — visibilitychange (hidden)
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      // sendBeacon은 두 채널 모두에서 호출되어야 한다.
      expect(sendBeacon).toHaveBeenCalledTimes(2);
      // 호출 URL이 락 해제 endpoint를 가리킨다.
      for (const call of sendBeacon.mock.calls) {
        expect(call[0]).toContain('/api/articles/A-LOCK-4/lock');
      }
    });

    it('AC-EDIT-LOCK-2: lockError 보유 시 submitAction은 ALERT만 띄우고 모델 호출 없음', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const saveArticle = vi.fn();
      const applyAction = vi.fn();
      const row = { articleId: 'A-LOCK-2b', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      const { result } = renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, saveArticle, applyAction }),
        { editArticleId: 'A-LOCK-2b' },
      );
      await waitFor(() => expect(result.current.lockError).toBeTruthy());
      await act(async () => { await result.current.send(); });
      // 락 거부 상태에선 어떤 transport 호출도 발생하지 않는다.
      expect(saveArticle).not.toHaveBeenCalled();
      expect(applyAction).not.toHaveBeenCalled();
    });
  });

  it('after a successful action the edit id is cleared (articleId back to A-DRAFT) so a new save creates', async () => {
    const row = { articleId: 'A-300', markupVersion: markupFor('reset me(끝)'), author: 'A' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-300' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(
      createFakeModel({ queryArticles, saveArticle, applyAction }),
      { editArticleId: 'A-300' },
    );
    await waitFor(() => expect(result.current.common.author).toBe('A'));

    await act(async () => { await result.current.send(); });
    // Page reset to blank-new: editor cleared; 작성자 re-defaults to the logged-in user name (news.md 공통정보).
    expect(result.current.bodyText).toBe('');
    expect(result.current.common.author).toBe(USER.name);

    // A subsequent send now targets A-DRAFT (create), not the old A-300.
    saveArticle.mockClear();
    act(() => result.current.setBodyMarkup('a brand new article(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
  });
});
