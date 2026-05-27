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
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1', title: 'dep art' }]);
    const { model } = renderView(createFakeModel({ queryArticles }));
    await act(async () => {});
    expect(queryArticles).toHaveBeenCalledWith(expect.objectContaining({ department: 'Politics' }));
    expect(await screen.findByText('dep art')).toBeInTheDocument();
    void model;
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
