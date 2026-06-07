// 멀티탭 기사 작성 워크스페이스 (WriteWorkspace) — 탭 생성/전환/닫기, 조회(list.do) 편집·고침·포털고침
// 진입(?id=)의 새 탭 오픈, 같은 기사 재진입 dedupe(잠금 자기충돌 방지), 탭별 초안 독립 보존,
// unmount/remount 복원, 주소창 동기화, 송고 성공 시 편집 탭 → 새 기사 탭 전환을 단언한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { WriteWorkspace } from './WriteWorkspace.jsx';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

function renderWorkspace(model = createFakeModel()) {
  return render(
    <ModelContext.Provider value={model}>
      <WriteWorkspace user={USER} />
    </ModelContext.Provider>
  );
}

// 활성(=hidden 아님) 워크스페이스 탭패널. 비활성 패널은 hidden 속성으로 감춰진 채 mounted 상태를
// 유지한다. WritePage 내부 메타데이터 패널도 role="tabpanel" 이므로 워크스페이스 클래스로 한정한다.
function activePanel() {
  const panels = [...document.querySelectorAll('.yh-edit-tabpanel')];
  const visible = panels.filter((p) => !p.hidden);
  expect(visible).toHaveLength(1);
  return visible[0];
}

// 워크스페이스 탭 스트립 스코프 — WritePage 내부 메타데이터 탭(role="tab")과 분리해 조회한다.
function tabStrip() {
  return within(screen.getByTestId('edit-tabs'));
}

// 편집 탭 로드용 Model — queryArticles 가 지정한 row 를 돌려준다.
function modelWithArticle(row, overrides = {}) {
  return createFakeModel({
    queryArticles: vi.fn().mockResolvedValue([row]),
    ...overrides,
  });
}

const EDIT_ROW = Object.freeze({
  articleId: 'AKR-1',
  status: 'RDS',
  markupVersion: markupFor('편집 제목\n편집 본문(끝)'),
  author: '원작성자',
  modifier: '데스크',
  department: 'Politics',
});

describe('WriteWorkspace 멀티탭 작성', () => {
  beforeEach(() => {
    try { sessionStorage.clear(); } catch { /* no storage */ }
    window.history.replaceState({}, '', '/writer.do');
  });

  it('기본: 새 기사 탭 1개가 활성 상태로 열리고 에디터가 보인다', () => {
    renderWorkspace();
    const tab = tabStrip().getByRole('tab', { name: '새 기사' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(within(activePanel()).getByTestId('editor-body')).toBeInTheDocument();
  });

  it('＋ 버튼으로 탭을 여러 개 만들 수 있고, 각 탭의 작성 내용이 독립적으로 유지된다', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    // 둘째 탭 생성 → 즉시 활성화.
    await user.click(screen.getByRole('button', { name: '새 작성 탭' }));
    expect(tabStrip().getAllByRole('tab')).toHaveLength(2);
    await user.type(within(activePanel()).getByTestId('editor-body'), '둘째 탭 본문');

    // 첫째 탭으로 전환 — 빈 에디터(독립) → 입력.
    await user.click(tabStrip().getAllByRole('tab')[0]);
    const firstEditor = within(activePanel()).getByTestId('editor-body');
    expect(firstEditor).toHaveTextContent('');
    await user.type(firstEditor, '첫째 탭 본문');

    // 둘째 탭으로 복귀 — 작성 중이던 내용이 그대로 (탭은 mounted 유지).
    await user.click(tabStrip().getAllByRole('tab')[1]);
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('둘째 탭 본문');
    // 첫째 탭 내용도 살아있다.
    await user.click(tabStrip().getAllByRole('tab')[0]);
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('첫째 탭 본문');
  });

  it('조회 진입(?id=)은 편집 탭을 새로 만들어 활성화하고 그 탭에 기사를 로드한다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=AKR-1');
    renderWorkspace(modelWithArticle(EDIT_ROW));

    // 기본 새 기사 탭 + 편집 탭(AKR-1, 활성).
    const editTab = tabStrip().getByRole('tab', { name: 'AKR-1' });
    expect(editTab).toHaveAttribute('aria-selected', 'true');
    expect(tabStrip().getByRole('tab', { name: '새 기사' })).toHaveAttribute('aria-selected', 'false');

    // 활성 패널에 편집 row 가 로드된다 (read-only ContentsVO + 본문).
    await waitFor(() => {
      expect(within(activePanel()).getByTestId('readonly-articleId')).toHaveTextContent('AKR-1');
    });
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('편집 본문');
  });

  it('같은 기사를 다시 열면 새 탭을 만들지 않고 기존 탭을 활성화한다 (잠금 자기충돌 방지)', () => {
    sessionStorage.setItem('newsroom.editorTabs', JSON.stringify({
      tabs: [{ id: 't1', editArticleId: null }, { id: 't2', editArticleId: 'AKR-1' }],
      activeId: 't1',
      seq: 2,
    }));
    window.history.replaceState({}, '', '/writer.do?id=AKR-1');
    renderWorkspace(modelWithArticle(EDIT_ROW));

    // 탭은 여전히 2개 — AKR-1 탭이 활성화될 뿐 중복 탭이 생기지 않는다.
    expect(tabStrip().getAllByRole('tab')).toHaveLength(2);
    expect(tabStrip().getByRole('tab', { name: 'AKR-1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('탭 닫기: 닫힌 탭의 보존 초안이 폐기되고, 마지막 탭을 닫으면 빈 새 기사 탭 1개가 유지된다', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(within(activePanel()).getByTestId('editor-body'), '지워질 본문');
    expect(sessionStorage.getItem('newsroom.writeDraft.t1')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '새 기사 탭 닫기' }));
    // 마지막 탭을 닫아도 빈 새 기사 탭이 하나 남는다.
    expect(tabStrip().getAllByRole('tab')).toHaveLength(1);
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('');
    // 닫힌 탭의 초안은 폐기된다.
    expect(sessionStorage.getItem('newsroom.writeDraft.t1')).toBeNull();
  });

  it('떠났다 돌아와도(unmount/remount) 탭 구성과 각 탭의 초안이 복원된다', async () => {
    const user = userEvent.setup();
    const first = renderWorkspace();
    await user.click(screen.getByRole('button', { name: '새 작성 탭' }));
    await user.type(within(activePanel()).getByTestId('editor-body'), '복원될 본문');
    first.unmount();

    renderWorkspace();
    expect(tabStrip().getAllByRole('tab')).toHaveLength(2);
    // 떠나기 전 활성이던 둘째 탭이 그대로 활성이고, 작성하던 본문이 복원된다.
    expect(tabStrip().getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('복원될 본문');
  });

  it('단일 에디터 시절의 보존 초안(newsroom.writeDraft)은 첫 탭으로 이관된다', () => {
    sessionStorage.setItem('newsroom.writeDraft', JSON.stringify({
      markup: markupFor('이관된 본문'),
      common: {},
    }));
    renderWorkspace();
    expect(within(activePanel()).getByTestId('editor-body')).toHaveTextContent('이관된 본문');
    // 키가 탭별 키로 이동했다.
    expect(sessionStorage.getItem('newsroom.writeDraft')).toBeNull();
    expect(sessionStorage.getItem('newsroom.writeDraft.t1')).not.toBeNull();
  });

  it('주소창 동기화: 활성 탭에 따라 ?id= 가 반영된다 (탭 전환은 replaceState)', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/writer.do?id=AKR-1');
    renderWorkspace(modelWithArticle(EDIT_ROW));
    expect(window.location.search).toBe('?id=AKR-1');

    await user.click(tabStrip().getByRole('tab', { name: '새 기사' }));
    expect(window.location.pathname + window.location.search).toBe('/writer.do');

    await user.click(tabStrip().getByRole('tab', { name: 'AKR-1' }));
    expect(window.location.search).toBe('?id=AKR-1');
  });

  it('편집 탭에서 송고 성공 → 그 탭은 빈 새 기사 탭으로 전환된다 (라벨/주소창 정리)', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.history.replaceState({}, '', '/writer.do?id=AKR-1');
    const model = modelWithArticle(EDIT_ROW, {
      saveArticle: vi.fn().mockResolvedValue({ ok: true, articleId: 'AKR-1' }),
      applyAction: vi.fn().mockResolvedValue({ ok: true, status: 'DPS' }),
    });
    renderWorkspace(model);
    await waitFor(() => {
      expect(within(activePanel()).getByTestId('readonly-articleId')).toHaveTextContent('AKR-1');
    });

    await user.click(within(activePanel()).getByRole('button', { name: '송고' }));

    // 편집 컨텍스트 종료 — AKR-1 탭이 사라지고 두 탭 모두 '새 기사', 주소창의 ?id= 도 걷힌다.
    await waitFor(() => {
      expect(tabStrip().queryByRole('tab', { name: 'AKR-1' })).not.toBeInTheDocument();
    });
    expect(tabStrip().getAllByRole('tab', { name: '새 기사' })).toHaveLength(2);
    expect(window.location.pathname + window.location.search).toBe('/writer.do');
  });
});
