import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

function renderView(model, user = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' }, navigate) {
  const m = model ?? createFakeModel();
  const utils = render(
    <ModelContext.Provider value={m}>
      <SessionContext.Provider value={{ user, navigate }}>
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

  it('row-less change signal ({type, articleId} — 실제 SSE 페이로드) → 활성 메뉴 필터로 재조회', async () => {
    const queryArticles = vi.fn()
      .mockResolvedValueOnce([{ articleId: 'A-1', title: '첫 목록', status: 'RDS' }])
      .mockResolvedValueOnce([{ articleId: 'A-2', title: '갱신 목록', status: 'RDS' }]);
    const { model } = renderView(createFakeModel({ queryArticles }));
    expect(await screen.findByText('첫 목록')).toBeInTheDocument();
    // 실제 서버는 rows 없이 { type, articleId, status } 신호만 보낸다 — 컨트롤러가 재조회해야 한다.
    await act(async () => { model.__emit({ type: 'status', articleId: 'A-1', status: 'DPS' }); });
    expect(await screen.findByText('갱신 목록')).toBeInTheDocument();
    // 동일 필터 재실행 (데스크 미송고 기본 메뉴 = RDS,DDH).
    expect(queryArticles).toHaveBeenCalledTimes(2);
    expect(queryArticles.mock.calls[1][0]).toEqual({ status: 'RDS,DDH' });
  });

  it('connected:true 페이로드가 끊김 이후 상태바를 실시간으로 복원한다 (SSE open 재연결)', async () => {
    const { model } = renderView();
    await act(async () => {});
    act(() => model.__emit({ connected: false }));
    expect(screen.getByTestId('realtime-status')).toHaveTextContent(/비-?실시간|재연결/);
    act(() => model.__emit({ connected: true }));
    expect(screen.getByTestId('realtime-status')).toHaveTextContent('실시간 연결됨');
  });

  it('재조회 경쟁: 늦게 도착한 이전 응답이 최신 목록을 덮어쓰지 않는다 (seq 가드)', async () => {
    const resolvers = [];
    const queryArticles = vi.fn(() => new Promise((resolve) => { resolvers.push(resolve); }));
    const { model } = renderView(createFakeModel({ queryArticles }));
    // 초기(데스크 미송고) 조회 resolve.
    await act(async () => { resolvers[0]([{ articleId: 'A-0', title: '초기', status: 'RDS' }]); });
    expect(await screen.findByText('초기')).toBeInTheDocument();
    // 연속 신호 2건(lock→unlock) → 재조회 2건이 동시에 in-flight.
    act(() => { model.__emit({ type: 'lock', articleId: 'A-0' }); });
    act(() => { model.__emit({ type: 'unlock', articleId: 'A-0' }); });
    expect(resolvers).toHaveLength(3);
    // 최신(두 번째 신호) 응답이 먼저 도착.
    await act(async () => { resolvers[2]([{ articleId: 'A-2', title: '최신', status: 'RDS' }]); });
    // 이전(첫 번째 신호) 응답이 늦게 도착 — seq 가드로 폐기되어야 한다.
    await act(async () => { resolvers[1]([{ articleId: 'A-1', title: '구버전', status: 'RDS' }]); });
    expect(screen.getByText('최신')).toBeInTheDocument();
    expect(screen.queryByText('구버전')).not.toBeInTheDocument();
  });

  it('메뉴 전환 직전의 in-flight 재조회가 부서별 송고 자동 조회 결과를 오염시키지 않는다 (seq 가드)', async () => {
    const resolvers = [];
    const queryArticles = vi.fn(() => new Promise((resolve) => { resolvers.push(resolve); }));
    const u = userEvent.setup();
    const { model } = renderView(createFakeModel({ queryArticles }));
    await act(async () => { resolvers[0]([{ articleId: 'A-0', title: '데스크 행', status: 'RDS' }]); });
    await screen.findByText('데스크 행');
    // 데스크 미송고에서 신호 → 재조회 in-flight(pending, resolvers[1]) 상태로 둔다.
    act(() => { model.__emit({ type: 'status', articleId: 'A-0' }); });
    // 부서별 송고로 전환 — 진입 자동 조회({ status: 'DPS' })가 새 in-flight(resolvers[2])로 발사된다.
    await u.click(screen.getByRole('button', { name: '부서별 송고' }));
    // 부서별 송고 자동 조회(최신 seq)가 먼저 도착 — DPS 목록이 표시된다.
    await act(async () => { resolvers[2]([{ articleId: 'A-D', title: '송고 자동', status: 'DPS' }]); });
    expect(await screen.findByText('송고 자동')).toBeInTheDocument();
    // 이제 늦은 데스크 재조회 응답(이전 seq)이 도착 — seq 가드로 폐기되어 DPS 목록을 덮지 않는다.
    await act(async () => { resolvers[1]([{ articleId: 'A-9', title: '늦은 데스크 응답', status: 'RDS' }]); });
    expect(screen.queryByText('늦은 데스크 응답')).not.toBeInTheDocument();
    expect(screen.getByText('송고 자동')).toBeInTheDocument();
  });

  it('부서별 송고 진입 시 전체 DPS 를 자동 조회하고, change 신호가 그 { status: DPS } 필터로 재조회한다', async () => {
    const u = userEvent.setup();
    const queryArticles = vi.fn()
      .mockResolvedValueOnce([{ articleId: 'A-0', title: '데스크 기본', status: 'RDS' }]) // 데스크 미송고 초기
      .mockResolvedValueOnce([{ articleId: 'A-9', title: '송고 전체', status: 'DPS' }]) // 부서별 송고 진입 자동 조회
      .mockResolvedValueOnce([{ articleId: 'A-9', title: '송고 갱신', status: 'DPS' }]); // change 재조회
    const { model } = renderView(createFakeModel({ queryArticles }));
    await screen.findByText('데스크 기본'); // 데스크 미송고 초기 조회 결과
    await u.click(screen.getByRole('button', { name: '부서별 송고' }));
    // 진입 즉시 전체 부서 DPS 자동 조회 (전체 = 부서 필터 없음, DPS 전체).
    expect(await screen.findByText('송고 전체')).toBeInTheDocument();
    expect(queryArticles.mock.calls.at(-1)[0]).toEqual({ status: 'DPS' });
    // lastFilterRef 가 { status: 'DPS' } 로 채워져 SSE change 신호가 재조회를 트리거한다 (LockYN 실시간 갱신).
    await act(async () => { model.__emit({ type: 'lock', articleId: 'A-9' }); });
    expect(await screen.findByText('송고 갱신')).toBeInTheDocument();
    expect(queryArticles.mock.calls.at(-1)[0]).toEqual({ status: 'DPS' });
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

  it('AC-7.1: 부서별 작성 — 본인 부서 자동 조회 + DPS·RRH 제외 (v0.4.0)', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1', title: 'dep art' }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '부서별 작성' }));
    // Auto-query on entry: the logged-in user's department, excluding DPS/RRH (REQ-FE-VIEW-005).
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Politics', statusNot: 'DPS,RRH' });
    expect(await screen.findByText('dep art')).toBeInTheDocument();
    // The department multi-select is seeded with the user's own department.
    expect(screen.getByText('부서')).toBeInTheDocument();
    const multiSelect = screen.getByTestId('dept-multi-select');
    // Trigger button should show user's department as display text.
    expect(within(multiSelect).getByRole('button')).toHaveTextContent('Politics');
  });

  it('AC-7.1b: 부서별 작성 — 다른 부서 선택 + 조회 → statusNot 유지 재조회 (v0.4.0)', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1e', title: 'econ written' }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '부서별 작성' }));
    // Open multi-select dropdown.
    const multiSelect = screen.getByTestId('dept-multi-select');
    await user.click(within(multiSelect).getByRole('button'));
    // Uncheck current department (Politics), check another (Economy).
    await user.click(screen.getByTestId('dept-checkbox-Politics'));
    await user.click(screen.getByTestId('dept-checkbox-Economy'));
    await user.click(screen.getByRole('button', { name: '조회' }));
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Economy', statusNot: 'DPS,RRH' });
  });

  it('AC-7.2 + EC-4: 부서별 송고 — dropdown from data-source, query only after 조회', async () => {
    const user = userEvent.setup();
    const queryUsers = vi.fn().mockResolvedValue([{ department: 'Politics' }, { department: 'Economy' }]);
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-2', title: 'econ art' }]);
    renderView(createFakeModel({ queryUsers, queryArticles }));
    await user.click(screen.getByRole('button', { name: '부서별 송고' }));
    // Multi-select populated (distinct) from the separated data-source, defaulting to 전체.
    expect(screen.getByText('부서')).toBeInTheDocument();
    const multiSelect = screen.getByTestId('dept-multi-select');
    await within(multiSelect).findByText('전체');
    await user.click(within(multiSelect).getByRole('button'));
    expect(screen.getByTestId('dept-checkbox-Economy')).toBeInTheDocument();
    // Before pressing 조회, no department articles are queried (deferred 계약 유지).
    expect(queryArticles).not.toHaveBeenCalledWith(expect.objectContaining({ department: expect.anything() }));
    // 전체 기본값에서 Politics 를 해제해 Economy 단독 조회로 좁힌다.
    await user.click(screen.getByTestId('dept-checkbox-Politics'));
    // Close dropdown by clicking trigger again.
    await user.click(within(multiSelect).getByRole('button'));
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(await screen.findByText('econ art')).toBeInTheDocument();
    // news.md: 부서별 송고 is DPS-only — the query filter must carry status: 'DPS'.
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Economy', status: 'DPS' });
  });

  it('AC-7.2b: 부서별 송고 — 전체가 기본 선택이며 조회 시 다중 부서 쿼리', async () => {
    const user = userEvent.setup();
    const queryUsers = vi.fn().mockResolvedValue([{ department: 'Politics' }, { department: 'Economy' }]);
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-2', title: 'multi art' }]);
    renderView(createFakeModel({ queryUsers, queryArticles }));
    await user.click(screen.getByRole('button', { name: '부서별 송고' }));
    // 2026-06-08 지시: 부서별 송고 진입 시 셀렉트 기본값은 전체 — 체크 없이 바로 조회 가능.
    const multiSelect = screen.getByTestId('dept-multi-select');
    await within(multiSelect).findByText('전체');
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(await screen.findByText('multi art')).toBeInTheDocument();
    // Query should have comma-separated departments (order by descending: Politics > Economy).
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ department: 'Politics,Economy', status: 'DPS' });
  });

  it('AC-7.3: 개인별 수정 — 본인 작성 + 상태 RDS/RRK만 (v0.4.0)', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-3', title: 'mine' }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '개인별 수정' }));
    // 작성자 매칭은 저장 값과 동일한 표시 이름(user.name) 기준 — 기사 author 컬럼에는 이름이 저장된다.
    expect(queryArticles).toHaveBeenCalledWith({ author: 'Desk', status: 'RDS,RRK' });
    expect(await screen.findByText('mine')).toBeInTheDocument();
  });

  it('AC-7.4: 데스크 미송고 queries RDS+DDH and renders the 8 fixed columns', async () => {
    const user = userEvent.setup();
    const queryArticles = vi.fn().mockResolvedValue([{
      articleId: 'A-4', title: 'unsent', author: '작성K', modifier: '수정K',
      status: 'RDS', createdAt: '2026-05-02T08:00:00Z', editedAt: '2026-05-03T09:00:00Z', lockYN: 'Y',
    }]);
    renderView(createFakeModel({ queryArticles }));
    await user.click(screen.getByRole('button', { name: '데스크 미송고' }));
    // v0.3.0: RDS + DDH (comma-separated multi-status filter).
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ status: 'RDS,DDH' });
    expect(await screen.findByText('unsent')).toBeInTheDocument();
    // 8 columns: 기사아이디 / 제목 / 작성자 / 수정자 / 작성시간 / 수정시간 / 기사상태 / LockYN (v0.5.0).
    expect(screen.getByTestId('article-id')).toHaveTextContent('A-4');
    expect(screen.getByTestId('article-author')).toHaveTextContent('작성K');
    expect(screen.getByTestId('article-modifier')).toHaveTextContent('수정K');
    expect(screen.getByTestId('article-time')).toHaveTextContent('2026-05-02');
    expect(screen.getByTestId('article-edited-time')).toHaveTextContent('2026-05-03');
    expect(screen.getByTestId('article-status')).toHaveTextContent('RDS');
    expect(screen.getByTestId('article-lockyn')).toHaveTextContent('Y');
    // Header row labels the 8 columns (기사상태 컬럼 추가, v0.5.0).
    expect(screen.getByTestId('desk-header')).toHaveTextContent('기사상태');
    expect(screen.getByTestId('desk-header')).toHaveTextContent('LockYN');
    // 인라인 편집 버튼은 데스크 미송고 컬럼 스펙에 없다 (편집은 우클릭 메뉴에 유지).
    expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
  });
});

describe('ViewPage default menu = 데스크 미송고 (news.md 기사 조회페이지)', () => {
  it('on load the active menu is 데스크 미송고 and it queries with { status: RDS,DDH }', async () => {
    const queryArticles = vi.fn().mockResolvedValue([{ articleId: 'A-0', title: 'desk unsent', status: 'RDS' }]);
    renderView(createFakeModel({ queryArticles }));
    // The 데스크 미송고 menu button is active on load.
    const active = await screen.findByRole('button', { name: '데스크 미송고' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    // And it auto-queries the RDS+DDH filter (v0.3.0) without any interaction.
    await act(async () => {});
    const call = queryArticles.mock.calls.at(-1)[0];
    expect(call).toEqual({ status: 'RDS,DDH' });
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

    // Page 1: exactly 10 dense rows visible. (데스크 미송고 rows carry article-id, not a status badge.)
    await screen.findByText('art-12'); // newest first
    expect(screen.getAllByTestId('article-id')).toHaveLength(10);
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('page-prev')).toBeDisabled();
    expect(screen.getByTestId('page-next')).toBeEnabled();
    // The two oldest rows are NOT on page 1 (they belong on page 2).
    expect(screen.queryByText('art-02')).not.toBeInTheDocument();
    expect(screen.queryByText('art-01')).not.toBeInTheDocument();

    // Advance to page 2: the remaining 2 rows show.
    await user.click(screen.getByTestId('page-next'));
    expect(screen.getAllByTestId('article-id')).toHaveLength(2);
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

describe('ViewPage role gating on DPS — 우클릭 고침(포털제외)/포털고침 (REQ-FE-VIEW-009/010 v0.4.0)', () => {
  const dpsArticle = [{ articleId: 'A-D', title: 'dps art', status: 'DPS', createdAt: '2026-05-02T08:00:00Z' }];

  // v0.4.0: 전 메뉴 7컬럼 통일로 인라인 버튼이 없다 — 부서별 작성에서 우클릭 메뉴로 게이팅을 검증.
  async function openCtxMenuOnDpsRow() {
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: '부서별 작성' }));
    const titleEl = await screen.findByText('dps art');
    fireEvent.contextMenu(titleEl.closest('.yh-article-row'), { clientX: 100, clientY: 60 });
    return screen.getByRole('menu', { name: '기사 메뉴' });
  }

  it('AC-8.1: D role — 고침(포털제외)/포털고침 활성, 선택 시 작성(편집) 페이지로 이동', async () => {
    const u = userEvent.setup();
    const navigate = vi.fn();
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' }, navigate);
    const menu = await openCtxMenuOnDpsRow();
    expect(within(menu).getByRole('menuitem', { name: /포털제외/ })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: /포털고침/ })).toBeEnabled();
    await u.click(within(menu).getByRole('menuitem', { name: /포털제외/ }));
    expect(navigate).toHaveBeenCalledWith('write', { id: 'A-D' });
  });

  it('AC-8.2: R role — 고침(포털제외)/포털고침 비활성 (DPS 기사)', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'r1', name: 'Rep', role: 'R', department: 'Politics' });
    const menu = await openCtxMenuOnDpsRow();
    expect(within(menu).getByRole('menuitem', { name: /포털제외/ })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /포털고침/ })).toBeDisabled();
  });

  it('AC-8.2: Z role — 고침(포털제외)/포털고침 비활성 (DPS 기사)', async () => {
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(dpsArticle) });
    renderView(model, { userId: 'z1', name: 'Adm', role: 'Z', department: 'Politics' });
    const menu = await openCtxMenuOnDpsRow();
    expect(within(menu).getByRole('menuitem', { name: /포털고침/ })).toBeDisabled();
  });
});

describe('ViewPage list columns + time-desc order (REQ-FE-VIEW-011 v0.5.0 — 전 메뉴 8컬럼)', () => {
  const twoRows = [
    {
      articleId: 'OLD',
      title: 'older art',
      author: '작성A',
      modifier: '수정A',
      status: 'RDS',
      createdAt: '2026-05-01T08:00:00Z',
      editedAt: '2026-05-02T09:00:00Z',
      lockYN: 'N',
    },
    {
      articleId: 'NEW',
      title: 'newer art',
      author: '작성B',
      modifier: '수정B',
      // 두 행의 status를 다르게 두어 행별 바인딩을 증명한다 (동일 값이면 상수/복제 렌더링 회귀를 못 잡음).
      status: 'DPS',
      createdAt: '2026-05-05T08:00:00Z',
      editedAt: '2026-05-06T09:00:00Z',
      lockYN: 'Y',
    },
  ];

  it('renders the unified 8 columns (incl. 기사상태) and sorts time DESC in 부서별 작성', async () => {
    const u = userEvent.setup();
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue(twoRows) });
    renderView(model);
    await u.click(screen.getByRole('button', { name: '부서별 작성' }));
    await screen.findByText('newer art');

    // 8개 컬럼: 기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN — 시간 내림차순.
    expect(screen.getAllByTestId('article-id').map((el) => el.textContent)).toEqual(['NEW', 'OLD']);
    expect(screen.getByText('작성A')).toBeInTheDocument();
    expect(screen.getByText('수정A')).toBeInTheDocument();
    expect(screen.getByText('작성B')).toBeInTheDocument();
    expect(screen.getByText('수정B')).toBeInTheDocument();
    expect(screen.getAllByTestId('article-author')).toHaveLength(2);
    expect(screen.getAllByTestId('article-modifier')).toHaveLength(2);
    expect(screen.getAllByTestId('article-edited-time')).toHaveLength(2);
    expect(screen.getAllByTestId('article-lockyn').map((el) => el.textContent)).toEqual(['Y', 'N']);
    // v0.5.0: 기사상태 컬럼이 모든 메뉴에 표시되고, 행별로 각 기사의 status가 바인딩된다
    // (NEW=DPS, OLD=RDS — 시간 내림차순 순서와 동일).
    expect(screen.getAllByTestId('article-status').map((el) => el.textContent)).toEqual(['DPS', 'RDS']);
    // 공유 8컬럼 헤더가 데스크 미송고 외 메뉴에서도 표시된다.
    expect(screen.getByTestId('desk-header')).toHaveTextContent('기사상태');
    expect(screen.getByTestId('desk-header')).toHaveTextContent('LockYN');

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

  it('v0.4.0: DPS 행에도 인라인 고침/포털고침 버튼이 없다 (게이팅은 우클릭 메뉴 전용)', async () => {
    const u = userEvent.setup();
    const row = { articleId: 'A-D', title: 'dps art', status: 'DPS', createdAt: '2026-05-02T08:00:00Z' };
    const model = createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) });
    renderView(model, { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' });
    await u.click(screen.getByRole('button', { name: '부서별 작성' }));
    await screen.findByText('dps art');
    expect(screen.queryByRole('button', { name: '고침' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '포털고침' })).not.toBeInTheDocument();
  });
});
