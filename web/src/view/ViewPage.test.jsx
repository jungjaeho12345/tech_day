import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

function renderView(model, user = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' }) {
  const m = model ?? createFakeModel();
  const utils = render(
    <ModelContext.Provider value={m}>
      <SessionContext.Provider value={{ user }}>
        <ViewPage user={user} />
      </SessionContext.Provider>
    </ModelContext.Provider>,
  );
  return { ...utils, model: m };
}

describe('ViewPage realtime + status bar (REQ-FE-VIEW-001..003) [DP-F2]', () => {
  it('AC-6.1: status bar shown; subscription change refreshes list without manual reload', async () => {
    const { model } = renderView();
    expect(screen.getByTestId('realtime-status')).toBeInTheDocument();
    // Let the initial menu query settle so the emitted change is not clobbered.
    await act(async () => {});
    // Push a change through the subscription interface.
    act(() => model.__emit({ articles: [{ articleId: 'A-7', title: '속보' }] }));
    expect(await screen.findByText('속보')).toBeInTheDocument();
  });

  it('EC-3: disconnected subscription shows non-realtime/reconnect state', async () => {
    const model = createFakeModel();
    model.__setConnected(false);
    renderView(model);
    act(() => model.__emit({ connected: false }));
    expect(screen.getByTestId('realtime-status')).toHaveTextContent(/비-?실시간|재연결|끊김/);
  });
});

describe('ViewPage four menus (REQ-FE-VIEW-004..008)', () => {
  it('renders exactly four menus', async () => {
    renderView();
    const nav = screen.getByRole('navigation', { name: '조회 메뉴' });
    for (const m of ['부서별 작성', '부서별 송고', '개인별 수정', '데스크 미송고']) {
      expect(within(nav).getByRole('button', { name: m })).toBeInTheDocument();
    }
    await act(async () => {}); // flush the initial menu query
  });

  it('AC-7.1: 부서별 작성 queries by the department', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1', title: 'dep art' }]);
    renderView(createFakeModel({ queryArticles }));
    // Default menu is now 데스크 미송고; switch to 부서별 작성 to test its plain department filter.
    await user.click(screen.getByRole('button', { name: '부서별 작성' }));
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Politics' });
    expect(await screen.findByText('dep art')).toBeInTheDocument();
  });

  it('AC-7.2 + EC-4: 부서별 송고 — dropdown from data-source, query only after 조회', async () => {
    const user = userEvent.setup();
    const queryUsers = vi.fn().mockResolvedValue([{ department: 'Politics' }, { department: 'Economy' }]);
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-2', title: 'econ art' }]);
    renderView(createFakeModel({ queryUsers, queryArticles }));
    await user.click(screen.getByRole('button', { name: '부서별 송고' }));
    // Dropdown populated (distinct) from the separated data-source.
    const select = await screen.findByLabelText('부서');
    expect(within(select).getByRole('option', { name: 'Economy' })).toBeInTheDocument();
    // Before pressing 조회, no department articles are queried.
    expect(queryArticles).not.toHaveBeenCalledWith(expect.objectContaining({ sender: expect.anything() }));
    await user.selectOptions(select, 'Economy');
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(await screen.findByText('econ art')).toBeInTheDocument();
    // news.md: 부서별 송고 is DPS-only — the query filter must carry status: 'DPS'.
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Economy', status: 'DPS' });
  });

  it('AC-7.3: 개인별 수정 filters by current user as author', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-3', title: 'mine' }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '개인별 수정' }));
    expect(queryArticles).toHaveBeenCalledWith(expect.objectContaining({ author: 'd1' }));
    expect(await screen.findByText('mine')).toBeInTheDocument();
  });

  it('AC-7.4: 데스크 미송고 includes department + RDS-state articles', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-4', title: 'unsent', status: 'RDS' }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '데스크 미송고' }));
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual(expect.objectContaining({ department: 'Politics', status: 'RDS' }));
    expect(await screen.findByText('unsent')).toBeInTheDocument();
  });
});

describe('ViewPage default menu = 데스크 미송고 (news.md 기사 조회페이지)', () => {
  it('on load the active menu is 데스크 미송고 and it queries with { department, status: RDS }', async () => {
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-0', title: 'desk unsent', status: 'RDS' }]);
    renderView(createFakeModel({ queryArticles }));
    // The 데스크 미송고 menu button is active on load.
    const active = await screen.findByRole('button', { name: '데스크 미송고' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    // And it auto-queries the department + RDS-state filter without any interaction.
    await act(async () => {});
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Politics', status: 'RDS' });
    expect(await screen.findByText('desk unsent')).toBeInTheDocument();
  });
});

describe('ViewPage pagination — 10 per page + dense list (news.md 기사 조회페이지)', () => {
  // 12 distinct rows with descending createdAt (newest first) so the order is deterministic.
  const twelveRows = Array.from({ length: 12 }, (_, i) => {
    const n = 12 - i; // n = 12 (newest) .. 1 (oldest)
    return {
      articleId: `A-${String(n).padStart(2, '0')}`,
      title: `art-${String(n).padStart(2, '0')}`,
      author: '작성',
      modifier: '수정',
      status: 'RDS',
      createdAt: `2026-05-${String(n).padStart(2, '0')}T08:00:00Z`,
    };
  });

  it('shows at most 10 rows on page 1 and 다음 reveals the remaining 2', async () => {
    const queryArticles = vi.fn().mockResolvedValue(twelveRows);
    const user = userEvent.setup();
    renderView(createFakeModel({ queryArticles }));

    // Page 1: exactly 10 dense rows visible.
    await screen.findByText('art-12'); // newest first
    expect(screen.getAllByTestId('article-status')).toHaveLength(10);
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('page-prev')).toBeDisabled();
    expect(screen.getByTestId('page-next')).toBeEnabled();
    // The two oldest rows are NOT on page 1 (they belong on page 2).
    expect(screen.queryByText('art-02')).not.toBeInTheDocument();
    expect(screen.queryByText('art-01')).not.toBeInTheDocument();

    // Advance to page 2: the remaining 2 rows show.
    await user.click(screen.getByTestId('page-next'));
    expect(screen.getAllByTestId('article-status')).toHaveLength(2);
    expect(screen.getByText('art-02')).toBeInTheDocument();
    expect(screen.getByText('art-01')).toBeInTheDocument();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('page-next')).toBeDisabled();
    expect(screen.getByTestId('page-prev')).toBeEnabled();
    // Page-1-only row is gone.
    expect(screen.queryByText('art-12')).not.toBeInTheDocument();
  });

  it('resets to page 1 when the active menu changes', async () => {
    const queryArticles = vi.fn().mockResolvedValue(twelveRows);
    const user = userEvent.setup();
    renderView(createFakeModel({ queryArticles }));

    await screen.findByText('art-12');
    await user.click(screen.getByTestId('page-next'));
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('2 / 2');

    // Switch menus — page must snap back to 1.
    await user.click(screen.getByRole('button', { name: '부서별 작성' }));
    expect(await screen.findByText('art-12')).toBeInTheDocument();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('1 / 2');
  });
});

describe('ViewPage role gating on DPS (REQ-FE-VIEW-009/010)', () => {
  const dpsArticle = [{ articleId: 'A-D', title: 'dps art', status: 'DPS' }];

  it('AC-8.1: D role sees 고침/포털고침 on a DPS article', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' });
    expect(await screen.findByRole('button', { name: '고침' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '포털고침' })).toBeEnabled();
  });

  it('AC-8.2: R role does NOT get an enabled 고침/포털고침 action on a DPS article', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'r1', name: 'Rep', role: 'R', department: 'Politics' });
    await screen.findByText('dps art');
    const edit = screen.queryByRole('button', { name: '고침' });
    expect(edit === null || edit.disabled).toBe(true);
  });

  it('AC-8.2: Z role does NOT get an enabled 고침/포털고침 action on a DPS article', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'z1', name: 'Adm', role: 'Z', department: 'Politics' });
    await screen.findByText('dps art');
    const edit = screen.queryByRole('button', { name: '포털고침' });
    expect(edit === null || edit.disabled).toBe(true);
  });
});

describe('ViewPage list columns + time-desc order (news.md 기사 조회페이지)', () => {
  const twoRows = [
    {
      articleId: 'OLD',
      title: 'older art',
      author: '작성A',
      modifier: '수정A',
      status: 'RDS',
      createdAt: '2026-05-01T08:00:00Z',
    },
    {
      articleId: 'NEW',
      title: 'newer art',
      author: '작성B',
      modifier: '수정B',
      status: 'RDS',
      createdAt: '2026-05-05T08:00:00Z',
    },
  ];

  it('renders 작성자/수정자/제목/상태 and sorts time DESC (newest first)', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(twoRows) });
    renderView(model);
    await screen.findByText('newer art');

    // Fields render.
    expect(screen.getByText('작성A')).toBeInTheDocument();
    expect(screen.getByText('수정A')).toBeInTheDocument();
    expect(screen.getByText('작성B')).toBeInTheDocument();
    expect(screen.getByText('수정B')).toBeInTheDocument();
    expect(screen.getAllByTestId('article-author')).toHaveLength(2);
    expect(screen.getAllByTestId('article-modifier')).toHaveLength(2);
    expect(screen.getAllByTestId('article-status')).toHaveLength(2);

    // Order is descending: the newer article's title appears before the older one in the DOM.
    const titles = screen.getAllByText(/art$/).map((el) => el.textContent);
    expect(titles).toEqual(['newer art', 'older art']);
  });
});

describe('ViewPage click → new window detail (news.md 기사 조회페이지)', () => {
  it('clicking a row opens a new window and writes detail HTML with title/content', async () => {
    const u = userEvent.setup();
    const row = {
      articleId: 'A-9',
      title: '클릭 제목',
      content: '클릭 본문',
      author: '작성자X',
      modifier: '수정자X',
      status: 'RDS',
      createdAt: '2026-05-02T08:00:00Z',
    };
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) });

    // Fake window so jsdom (which has no real popup) records what was written.
    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const fakeWindow = { document: { write: writeSpy, close: closeSpy } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWindow);

    try {
      renderView(model);
      const title = await screen.findByText('클릭 제목');
      await u.click(title);

      expect(openSpy).toHaveBeenCalledWith('', '_blank', expect.stringContaining('width=720'));
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      const html = writeSpy.mock.calls[0][0];
      expect(html).toContain('클릭 제목'); // 제목
      expect(html).toContain('클릭 본문'); // 내용
      expect(html).toContain('공통정보'); // 공통정보 section
      expect(html).toContain('작성자X'); // a 공통정보 field
    } finally {
      openSpy.mockRestore();
    }
  });

  it('clicking 고침 does NOT open the detail window (stopPropagation)', async () => {
    const u = userEvent.setup();
    const row = { articleId: 'A-D', title: 'dps art', status: 'DPS', createdAt: '2026-05-02T08:00:00Z' };
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    try {
      renderView(model, { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' });
      const editBtn = await screen.findByRole('button', { name: '고침' });
      await u.click(editBtn);
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
    }
  });
});
