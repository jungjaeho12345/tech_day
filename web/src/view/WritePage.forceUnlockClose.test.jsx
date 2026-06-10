// SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE — 편집 잠금을 보유한 WritePage(편집 탭)가 자기 기사의 강제
// 해제 SSE 프레임 { type:'unlock', articleId:X, forced:true } 을 수신하면 window.alert('Lock이 해제되어 편집을
// 종료합니다') 를 1회 표시하고 그 편집 탭을 닫는다(WriteWorkspace.closeTab → 남은 탭/새 기사 탭 전환 + 저장
// 안 한 변경분 폐기). 다른 articleId·초안 탭·forced 아닌 자기 해제는 무시하고, 중복 프레임에도 alert 는 1회.
//
// 실제 EventSource 대신 fakeModel 의 __emit 으로 forced 프레임을 결정적으로 주입한다(실시간 대기/타이머 없음).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { WriteWorkspace } from './WriteWorkspace.jsx';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

function renderWorkspace(model) {
  return render(
    <ModelContext.Provider value={model}>
      <WriteWorkspace user={USER} />
    </ModelContext.Provider>
  );
}

function tabStrip() {
  return within(screen.getByTestId('edit-tabs'));
}

const EDIT_ROW = Object.freeze({
  articleId: 'A-LOCK',
  status: 'RDS',
  markupVersion: markupFor('편집 제목\n편집 본문(끝)'),
  author: '원작성자',
  modifier: '데스크',
  department: 'Politics',
});

function modelWithLockedArticle(overrides = {}) {
  return createFakeModel({
    queryArticles: vi.fn().mockResolvedValue([EDIT_ROW]),
    lockArticle: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  });
}

// 편집 탭이 잠금을 획득하고 기사를 로드할 때까지 대기 — 이 시점에 강제 해제 SSE 구독이 활성이다.
async function openEditTabAndWait(model) {
  window.history.replaceState({}, '', '/writer.do?id=A-LOCK');
  renderWorkspace(model);
  await waitFor(() => expect(model.queryArticles).toHaveBeenCalledWith({ articleId: 'A-LOCK' }));
}

describe('WritePage 강제 해제 자동 종료 (SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE)', () => {
  beforeEach(() => {
    try { sessionStorage.clear(); } catch { /* no storage */ }
    window.history.replaceState({}, '', '/writer.do');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  // AC-CLOSE-1 — 보유 탭 + 일치 articleId + forced:true → alert 1회 + 그 편집 탭이 닫힌다.
  it('AC-CLOSE-1: forced unlock for the held article alerts once and closes that edit tab', async () => {
    const model = modelWithLockedArticle();
    await openEditTabAndWait(model);
    expect(tabStrip().getByRole('tab', { name: 'A-LOCK' })).toBeInTheDocument();

    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
    });

    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledWith('Lock이 해제되어 편집을 종료합니다');
    // 편집 탭이 닫혀 워크스페이스가 남은 '새 기사' 탭으로 전환된다.
    await waitFor(() => {
      expect(tabStrip().queryByRole('tab', { name: 'A-LOCK' })).not.toBeInTheDocument();
    });
    expect(tabStrip().getByRole('tab', { name: '새 기사' })).toBeInTheDocument();
  });

  // AC-CLOSE-2 — 다른 articleId 프레임은 무시(alert 없음, 탭 유지).
  it('AC-CLOSE-2: a forced unlock for a different articleId is ignored', async () => {
    const model = modelWithLockedArticle();
    await openEditTabAndWait(model);

    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'OTHER', forced: true });
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(tabStrip().getByRole('tab', { name: 'A-LOCK' })).toBeInTheDocument();
  });

  // AC-CLOSE-3 — 초안 탭(editArticleId=null, 잠금 없음)은 어떤 unlock 프레임도 무시한다.
  it('AC-CLOSE-3: a draft tab (no lock) ignores forced unlock frames', async () => {
    const model = createFakeModel();
    renderWorkspace(model);
    // 기본 '새 기사' 초안 탭만 존재 — 구독 자체가 없어 어떤 프레임도 무시된다.
    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(tabStrip().getByRole('tab', { name: '새 기사' })).toBeInTheDocument();
  });

  // AC-CLOSE-4 — 자기 해제(forced 미포함, 정상 release)는 alert/자동 종료를 발동하지 않는다.
  it('AC-CLOSE-4: a non-forced unlock (self-release) does not alert or close the tab', async () => {
    const model = modelWithLockedArticle();
    await openEditTabAndWait(model);

    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'A-LOCK' }); // forced 미포함
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(tabStrip().getByRole('tab', { name: 'A-LOCK' })).toBeInTheDocument();
  });

  // AC-CLOSE-5 — 중복 forced 프레임이 와도 alert 는 정확히 1회(closed 멱등 가드).
  it('AC-CLOSE-5: duplicate forced frames alert only once', async () => {
    const model = modelWithLockedArticle();
    await openEditTabAndWait(model);

    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
    });

    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  // AC-CLOSE-6 — 저장하지 않은 변경분 폐기: 자동 종료는 별도 저장(updateArticle/saveArticle) 없이 탭을 닫는다.
  it('AC-CLOSE-6: auto-close discards unsaved changes (no save call on forced close)', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-LOCK' });
    const model = modelWithLockedArticle({ saveArticle });
    await openEditTabAndWait(model);
    await waitFor(() => {
      expect(within(screen.getByTestId('writer-panel-t2')).getByTestId('editor-body')).toHaveTextContent('편집 본문');
    });
    // 저장하지 않은 편집 추가.
    await user.type(within(screen.getByTestId('writer-panel-t2')).getByTestId('editor-body'), ' 추가 미저장');

    await act(async () => {
      model.__emit({ type: 'unlock', articleId: 'A-LOCK', forced: true });
    });

    await waitFor(() => {
      expect(tabStrip().queryByRole('tab', { name: 'A-LOCK' })).not.toBeInTheDocument();
    });
    expect(saveArticle).not.toHaveBeenCalled();
  });
});
