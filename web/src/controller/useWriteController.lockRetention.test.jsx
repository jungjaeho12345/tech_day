// SPEC-NEWS-REVISE-008 §1 REQ-LOCK-RETENTION / §2 REQ-LOCK-RELEASE-EXPLICIT — 편집 잠금이 편집 탭
// 생존 중에는 단순 조회(list.do) 이동만으로 풀리지 않고, 4시점(탭 닫기 / 송고·보류·KILL 성공 /
// 로그아웃 / 브라우저 닫힘)에서만 해제됨을 단언한다.
//
// [HARD] lock 관련 단언은 sessionStorage 의 newsroom.editorTabs(편집 탭 생존 신호)를 통해 검증한다.
// 서버 lock 의 30분 stale 판정은 이 컨트롤러 경로에 개입하지 않으므로 now 고정이 필요한 직접 호출은
// 없지만, 도메인 계약(SPEC-NEWS-REVISE-002)을 건드리지 않음을 회귀 가드로 함께 확인한다.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

const TABS_KEY = 'newsroom.editorTabs';

// 편집 탭이 newsroom.editorTabs 에 살아있다고 표시한다 (조회 이동 후 탭 생존 상태 모사).
function seedSurvivingEditTab(articleId, tabId = 't2') {
  sessionStorage.setItem(TABS_KEY, JSON.stringify({
    tabs: [{ id: 't1', editArticleId: null }, { id: tabId, editArticleId: articleId }],
    activeId: tabId,
    seq: 2,
  }));
}

// 편집 탭이 닫혀 더 이상 탭 목록에 없는 상태 (× 로 탭을 닫은 직후 모사).
function seedClosedEditTab() {
  sessionStorage.setItem(TABS_KEY, JSON.stringify({
    tabs: [{ id: 't1', editArticleId: null }],
    activeId: 't1',
    seq: 2,
  }));
}

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

afterEach(() => {
  try { sessionStorage.clear(); } catch { /* no storage */ }
  vi.restoreAllMocks();
});

describe('SPEC-NEWS-REVISE-008 §1 REQ-LOCK-RETENTION — 편집 잠금 탭 생존 유지', () => {
  // AC-LOCK-1 / AC-REL-3 — 편집 탭이 살아있는 상태에서 조회 페이지 이동으로 unmount 되면 락이 풀리면 안 된다.
  it('AC-LOCK-1: 편집 탭이 newsroom.editorTabs 에 살아있으면 unmount 가 락을 해제하지 않는다', async () => {
    seedSurvivingEditTab('AKR-1');
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-1', markupVersion: markupFor('본문') }]);
    const { unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'AKR-1', draftKey: 'newsroom.writeDraft.t2' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalledWith('AKR-1'));
    unmount(); // list.do 이동 = WritePage unmount, 그러나 편집 탭은 여전히 탭 목록에 존재.
    expect(unlockArticle).not.toHaveBeenCalled();
  });

  // AC-REL-2 — 편집 탭을 × 로 닫아 탭 목록에서 사라지면 unmount cleanup 이 락을 해제한다.
  it('AC-REL-2: 편집 탭이 탭 목록에서 사라졌으면(× 닫기) unmount 가 락을 해제한다', async () => {
    seedSurvivingEditTab('AKR-2');
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-2', markupVersion: markupFor('본문') }]);
    const { unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'AKR-2', draftKey: 'newsroom.writeDraft.t2' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    // × 닫기 = 탭이 목록에서 제거된 뒤 WritePage unmount.
    seedClosedEditTab();
    unmount();
    expect(unlockArticle).toHaveBeenCalledWith('AKR-2');
  });

  // AC-LOCK-2(d) — 브라우저(탭) 닫힘은 탭 메타데이터가 sessionStorage 에 남아있어도 무조건 해제한다.
  it('AC-LOCK-2(d): beforeunload 는 편집 탭이 살아있어도 락을 해제한다 (브라우저 닫힘)', async () => {
    seedSurvivingEditTab('AKR-3');
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-3', markupVersion: markupFor('본문') }]);
    renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'AKR-3', draftKey: 'newsroom.writeDraft.t2' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    act(() => { window.dispatchEvent(new Event('beforeunload')); });
    expect(unlockArticle).toHaveBeenCalledWith('AKR-3');
  });

  // AC-LOCK-2(c) — 로그아웃은 편집 탭이 살아있어도 무조건 해제한다.
  it('AC-LOCK-2(c): 로그아웃 release 콜백은 편집 탭이 살아있어도 락을 해제한다', async () => {
    seedSurvivingEditTab('AKR-4');
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-4', markupVersion: markupFor('본문') }]);
    const registerEditLockRelease = vi.fn();
    renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'AKR-4', draftKey: 'newsroom.writeDraft.t2' },
      { registerEditLockRelease },
    );

    await waitFor(() => expect(registerEditLockRelease).toHaveBeenCalled());
    const releaseFn = registerEditLockRelease.mock.calls.map((c) => c[0]).find((fn) => typeof fn === 'function');
    act(() => releaseFn());
    expect(unlockArticle).toHaveBeenCalledWith('AKR-4');
  });

  // AC-LOCK-4 / AC-REL-1 — 송고 성공은 서버 auto-release 이므로 클라이언트 unlock 은 발화하지 않고,
  // 이후 unmount(탭 생존 무관)도 이중 해제하지 않는다. (락이 영구히 남지 않음 = 서버가 해제했음.)
  it('AC-LOCK-4: 송고 성공 후에는 unmount 가 (탭 생존 여부와 무관하게) 다시 unlock 하지 않는다', async () => {
    seedSurvivingEditTab('AKR-5');
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-5', markupVersion: markupFor('헤드라인(끝)') }]);
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result, unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles, applyAction }),
      { editArticleId: 'AKR-5', draftKey: 'newsroom.writeDraft.t2' },
    );

    await waitFor(() => expect(result.current.bodyText).toContain('헤드라인'));
    await act(async () => { await result.current.send(); });
    expect(applyAction).toHaveBeenCalled();
    // 송고 성공 후 탭은 빈 새 기사 탭으로 전환되지만, 서버가 이미 해제했으므로 클라 unlock 은 없다.
    seedClosedEditTab();
    unmount();
    expect(unlockArticle).not.toHaveBeenCalled();
  });

  // AC-LOCK-1 보강 — 탭 메타데이터가 아예 없으면(단독 페이지/레거시) 종전대로 unmount 가 해제한다
  // (멀티탭 워크스페이스를 거치지 않는 직접 사용 경로의 보수적 기본값 = 해제).
  it('탭 메타데이터가 없으면(단독 사용) unmount 가 종전대로 락을 해제한다', async () => {
    const lockArticle = vi.fn().mockResolvedValue({ ok: true });
    const unlockArticle = vi.fn().mockResolvedValue({ ok: true, released: true });
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'AKR-6', markupVersion: markupFor('본문') }]);
    const { unmount } = renderCtrl(
      createFakeModel({ lockArticle, unlockArticle, queryArticles }),
      { editArticleId: 'AKR-6' },
    );

    await waitFor(() => expect(lockArticle).toHaveBeenCalled());
    unmount();
    expect(unlockArticle).toHaveBeenCalledWith('AKR-6');
  });
});
