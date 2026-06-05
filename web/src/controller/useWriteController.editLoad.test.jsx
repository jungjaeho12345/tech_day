// Feature 3 — 데스크 미송고 edit: useWriteController(user, { editArticleId }) loads the article on mount
// (markupVersion + common fields) and saves with the loaded id (PUT/update path), while blank-new is
// unchanged when no editArticleId is supplied.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext, SessionContext } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderCtrl(model, options, session = {}) {
  const sessionValue = { navigate: vi.fn(), registerEditLockRelease: vi.fn(), ...session };
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>
      <SessionContext.Provider value={sessionValue}>{children}</SessionContext.Provider>
    </ModelContext.Provider>
  );
  const hook = renderHook(() => useWriteController(USER, options), { wrapper });
  return { ...hook, sessionValue };
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

  // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — lock-before-load + 409 차단(목록 복귀). holder는 로그인 세션이며
  // 상세 잠금 생애주기(해제 4지점)는 useWriteController.lock.test.jsx 가 담당한다.
  describe('edit lock integration (SPEC-EDIT-LOCK-001)', () => {
    it('lock-before-load: editArticleId 마운트 시 lockArticle(id)가 queryArticles 보다 먼저 호출된다', async () => {
      const order = [];
      const lockArticle = vi.fn(async () => { order.push('lock'); return { ok: true }; });
      const queryArticles = vi.fn(async () => { order.push('query'); return [{ articleId: 'A-LOCK-1', markupVersion: markupFor('본문'), author: 'a' }]; });
      renderCtrl(createFakeModel({ lockArticle, queryArticles }), { editArticleId: 'A-LOCK-1' });
      await waitFor(() => expect(lockArticle).toHaveBeenCalledWith('A-LOCK-1'));
      await waitFor(() => expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-LOCK-1' }));
      expect(order).toEqual(['lock', 'query']);
    });

    it('409(locked): lockError 문자열 설정 + queryArticles 미호출 + 목록(VIEW) 복귀', async () => {
      const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const queryArticles = vi.fn();
      const { result, sessionValue } = renderCtrl(
        createFakeModel({ lockArticle, queryArticles }),
        { editArticleId: 'A-LOCK-2' },
      );
      await waitFor(() => expect(result.current.lockError).toBe('다른 사용자가 편집 중입니다.'));
      expect(queryArticles).not.toHaveBeenCalled();
      expect(sessionValue.navigate).toHaveBeenCalledWith(ROUTES.VIEW);
    });

    it('lockError 보유 시 submitAction은 어떤 transport 호출도 하지 않는다', async () => {
      const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const saveArticle = vi.fn();
      const applyAction = vi.fn();
      const { result } = renderCtrl(
        createFakeModel({ lockArticle, saveArticle, applyAction }),
        { editArticleId: 'A-LOCK-2b' },
      );
      await waitFor(() => expect(result.current.lockError).toBeTruthy());
      await act(async () => { await result.current.send(); });
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
