// Edit-lock lifecycle (news.md 편집/고침/포털고침 진입 시 잠금, 최초 세션만 편집, 액션/이탈 시 해제).
// Covers the four release points: action (auto-released server-side -> no client unlock), unmount,
// beforeunload (tab-close), and logout (release-before-clear-session). Also covers blocked entry on 409.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext, SessionContext } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

// Render the controller inside Model + Session contexts so it can navigate on a blocked entry and
// register its lock release for the logout path. `session` lets a test capture navigate/register calls.
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

describe('useWriteController edit lock (news.md 편집 잠금)', () => {
  it('acquires the lock BEFORE loading the article when editArticleId is set', async () => {
    const row = { articleId: 'A-100', markupVersion: markupFor('본문'), author: 'A' };
    const lockArticle = vi.fn().mockResolvedValue({ ok: true, article: { articleId: 'A-100', LockYN: 'Y' } });
    const queryArticles = vi.fn().mockResolvedValue([row]);
    renderCtrl(createFakeModel({ lockArticle, queryArticles }), { editArticleId: 'A-100' });

    await waitFor(() => expect(lockArticle).toHaveBeenCalledWith('A-100'));
    // Article load proceeds only after a successful lock.
    await waitFor(() => expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-100' }));
  });

  it('does NOT lock for a fresh draft (no editArticleId)', async () => {
    const lockArticle = vi.fn();
    renderCtrl(createFakeModel({ lockArticle }));
    // Give any effect a chance to run; lock must never fire for a blank-new page.
    await act(async () => { await Promise.resolve(); });
    expect(lockArticle).not.toHaveBeenCalled();
  });

  it('on 409 (locked): surfaces the inline alert, blocks load, and navigates back to the list', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1', markupVersion: markupFor('x') }]);
    const { result, sessionValue } = renderCtrl(
      createFakeModel({ lockArticle, queryArticles }),
      { editArticleId: 'A-1' },
    );

    await waitFor(() => expect(result.current.lockError).toBe('다른 사용자가 편집 중입니다.'));
    // Blocked: the article is NOT loaded into the editor.
    expect(queryArticles).not.toHaveBeenCalled();
    // Bounced back to the list.
    expect(sessionValue.navigate).toHaveBeenCalledWith(ROUTES.VIEW);
  });

  it('releases the lock on unmount when a lock was acquired', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-2', markupVersion: markupFor('y') }]);
    const { unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'A-2' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    unmount();
    expect(unlockArticle).toHaveBeenCalledWith('A-2');
  });

  it('does NOT unlock on unmount when entry was blocked (lock never acquired)', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true });
    const { result, unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle }),
      { editArticleId: 'A-3' },
    );

    await waitFor(() => expect(result.current.lockError).toBeTruthy());
    unmount();
    expect(unlockArticle).not.toHaveBeenCalled();
  });

  it('does NOT unlock on unmount AFTER a successful action (backend auto-released)', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-4', markupVersion: markupFor('헤드라인(끝)') }]);
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result, unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles, applyAction }),
      { editArticleId: 'A-4' },
    );

    await waitFor(() => expect(result.current.bodyText).toContain('헤드라인'));
    await act(async () => { await result.current.send(); });
    expect(applyAction).toHaveBeenCalled();

    unmount();
    // The lock flag was cleared on the successful action, so no client unlock fires (avoids double work).
    expect(unlockArticle).not.toHaveBeenCalled();
  });

  it('beforeunload (tab-close) best-effort releases the held lock', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-5', markupVersion: markupFor('z') }]);
    renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'A-5' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    act(() => { window.dispatchEvent(new Event('beforeunload')); });
    expect(unlockArticle).toHaveBeenCalledWith('A-5');
  });

  it('registers a lock-release callback that unlocks the held article (logout path)', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-6', markupVersion: markupFor('q') }]);
    const registerEditLockRelease = vi.fn();
    renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'A-6' },
      { registerEditLockRelease },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    // App registers the controller's release fn; invoking it (as handleLogout does) unlocks the article.
    await waitFor(() => expect(registerEditLockRelease).toHaveBeenCalled());
    const releaseFn = registerEditLockRelease.mock.calls.map((c) => c[0]).find((fn) => typeof fn === 'function');
    expect(releaseFn).toBeTypeOf('function');
    act(() => releaseFn());
    expect(unlockArticle).toHaveBeenCalledWith('A-6');
  });
});
