// Feature 2 — right-click context menu on article rows (news.md 기사 조회페이지).
// Verifies the item sets per active menu, the functional actions (상세보기 / 본문복사 / 제목만복사 / 편집),
// disabled placeholders for non-functional actions, and close-on-Escape / outside-click.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

const DESK_USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderView({ model, user = DESK_USER, navigate = vi.fn() } = {}) {
  const m = model ?? createFakeModel();
  const utils = render(
    <ModelContext.Provider value={m}>
      <SessionContext.Provider value={{ user, navigate }}>
        <ViewPage user={user} />
      </SessionContext.Provider>
    </ModelContext.Provider>,
  );
  return { ...utils, model: m, navigate };
}

// Open the context menu on the row whose title matches, returning the menu element.
async function openMenuOnRow(title) {
  const titleEl = await screen.findByText(title);
  // The row body (role=button) carries the onContextMenu handler.
  const row = titleEl.closest('.yh-article-row');
  fireEvent.contextMenu(row, { clientX: 120, clientY: 80 });
  return screen.getByRole('menu', { name: '기사 메뉴' });
}

describe('ViewPage context menu — item sets per active menu', () => {
  it('데스크 미송고: shows 편집/상세보기/이력보기/본문복사/제목만복사', async () => {
    const row = { articleId: 'A-1', title: 'desk row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {}); // settle initial 데스크 미송고 query
    const menu = await openMenuOnRow('desk row');

    for (const label of ['편집', '상세보기', '이력보기', '본문복사', '제목만복사']) {
      expect(within(menu).getByRole('menuitem', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // 이력보기 is a disabled placeholder; the functional ones are enabled.
    expect(within(menu).getByRole('menuitem', { name: /이력보기/ })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /편집/ })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: /상세보기/ })).toBeEnabled();
  });

  it('부서별 작성: shows the long action set with only 상세보기/본문복사/제목만복사 enabled', async () => {
    const u = userEvent.setup();
    const row = { articleId: 'A-2', title: 'dept row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await u.click(screen.getByRole('button', { name: '부서별 작성' }));
    const menu = await openMenuOnRow('dept row');

    // No 편집 entry outside 데스크 미송고.
    expect(within(menu).queryByRole('menuitem', { name: /편집/ })).not.toBeInTheDocument();
    // Disabled placeholders present.
    for (const label of ['송고이력보기', '번역', '매핑', '후속기사작성', '계속기사작성', '고침(포털제외)', '포털고침', '삭제요청', '재송']) {
      expect(within(menu).getByRole('menuitem', { name: new RegExp(label.replace(/[()]/g, '\\$&')) })).toBeDisabled();
    }
    // Functional ones enabled.
    expect(within(menu).getByRole('menuitem', { name: /상세보기/ })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: /본문복사/ })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: /제목만복사/ })).toBeEnabled();
  });
});

// Spy on clipboard.writeText. jsdom provides a real navigator.clipboard (whose `clipboard` property
// is non-configurable), so we cannot replace the whole object — spy on the method instead, ensuring
// the method exists first for environments that omit it.
function spyClipboard() {
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', { value: {}, configurable: true });
  }
  if (typeof navigator.clipboard.writeText !== 'function') {
    navigator.clipboard.writeText = () => Promise.resolve();
  }
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
}

describe('ViewPage context menu — functional actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('상세보기 opens the detail window (window.open) and closes the menu', async () => {
    const u = userEvent.setup();
    const row = { articleId: 'A-3', title: 'detail row', content: '본문!', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    const fakeWindow = { document: { write: vi.fn(), close: vi.fn() } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWindow);
    try {
      const menu = await openMenuOnRow('detail row');
      await u.click(within(menu).getByRole('menuitem', { name: /상세보기/ }));
      expect(openSpy).toHaveBeenCalledWith('', '_blank', expect.stringContaining('width=720'));
      expect(fakeWindow.document.write).toHaveBeenCalled();
      // Menu closed after the action.
      expect(screen.queryByRole('menu', { name: '기사 메뉴' })).not.toBeInTheDocument();
    } finally {
      openSpy.mockRestore();
    }
  });

  it('본문복사 calls clipboard.writeText with the article content', async () => {
    const writeText = spyClipboard();
    const u = userEvent.setup();
    const row = { articleId: 'A-4', title: 'copy row', content: '복사할 본문', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    const menu = await openMenuOnRow('copy row');
    await u.click(within(menu).getByRole('menuitem', { name: /본문복사/ }));
    expect(writeText).toHaveBeenCalledWith('복사할 본문');
  });

  it('제목만복사 calls clipboard.writeText with the article title', async () => {
    const writeText = spyClipboard();
    const u = userEvent.setup();
    const row = { articleId: 'A-5', title: '복사할 제목', content: 'body', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    const menu = await openMenuOnRow('복사할 제목');
    await u.click(within(menu).getByRole('menuitem', { name: /제목만복사/ }));
    expect(writeText).toHaveBeenCalledWith('복사할 제목');
  });

  it('편집 (데스크 미송고) navigates to the write page with the article id', async () => {
    const u = userEvent.setup();
    const navigate = vi.fn();
    const row = { articleId: 'A-EDIT', title: 'edit row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), navigate });
    await act(async () => {});
    const menu = await openMenuOnRow('edit row');
    await u.click(within(menu).getByRole('menuitem', { name: /편집/ }));
    expect(navigate).toHaveBeenCalledWith('write', { id: 'A-EDIT' });
  });
});

describe('ViewPage context menu — close behavior', () => {
  it('closes on Escape', async () => {
    const row = { articleId: 'A-6', title: 'esc row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    await openMenuOnRow('esc row');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('menu', { name: '기사 메뉴' })).not.toBeInTheDocument();
  });

  it('closes on outside click', async () => {
    const row = { articleId: 'A-7', title: 'outside row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    await openMenuOnRow('outside row');
    act(() => { fireEvent.pointerDown(document.body); });
    expect(screen.queryByRole('menu', { name: '기사 메뉴' })).not.toBeInTheDocument();
  });

  it('disabled placeholder items do nothing (no clipboard / no navigate)', async () => {
    const writeText = spyClipboard();
    const u = userEvent.setup();
    const navigate = vi.fn();
    const row = { articleId: 'A-8', title: 'disabled row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), navigate });
    await act(async () => {});
    const menu = await openMenuOnRow('disabled row');
    const disabledItem = within(menu).getByRole('menuitem', { name: /이력보기/ });
    expect(disabledItem).toBeDisabled();
    await u.click(disabledItem).catch(() => {}); // clicking a disabled button is a no-op
    expect(writeText).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    // Menu remains open (a disabled item neither acts nor closes).
    expect(screen.getByRole('menu', { name: '기사 메뉴' })).toBeInTheDocument();
  });
});

describe('ViewPage 데스크 미송고 — 7컬럼 전용 행 (REQ-FE-VIEW-008 v0.3.0)', () => {
  it('does NOT render an inline 편집 button (편집 is context-menu only); columns render instead', async () => {
    const navigate = vi.fn();
    const row = {
      articleId: 'A-VIS', title: 'visible edit', author: '작', modifier: '수',
      status: 'RDS', createdAt: '2026-05-02T08:00:00Z', editedAt: '2026-05-03T08:00:00Z', lockYN: 'N',
    };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), navigate });
    await screen.findByText('visible edit');
    // 인라인 편집 버튼 제거 — 컬럼 8개 (기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN).
    expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
    expect(screen.getByTestId('article-id')).toHaveTextContent('A-VIS');
    expect(screen.getByTestId('article-status')).toHaveTextContent('RDS');
    expect(screen.getByTestId('article-lockyn')).toHaveTextContent('N');
  });
});

// SPEC-NEWS-REVISE-007 — 부서별 송고 진입점 와이어링 (REQ-FWD-ENTRYPOINTS / REQ-REVISE-SEMANTICS).
// 부서별 송고 메뉴는 DPS 기사만 조회한다 (news.md). 이 describe는 부서별 송고로 메뉴를 전환한 뒤
// 우클릭 컨텍스트 메뉴(편집/고침/포털고침)와 DPS 행 버튼(고침/포털고침)의 포워딩을 검증한다.
describe('SPEC-NEWS-REVISE-007 부서별 송고 진입점 (REQ-FWD-ENTRYPOINTS)', () => {
  const D_USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
  const R_USER = { userId: 'r1', name: 'Rep', role: 'R', department: 'Politics' };
  const Z_USER = { userId: 'z1', name: 'Adm', role: 'Z', department: 'Politics' };

  // Switch to 부서별 송고, pick a department, press 조회 so the DPS rows load. The fake model returns
  // the same rows regardless of the filter, so any department selection surfaces the seeded row.
  async function gotoSongoMenu({ user = D_USER, rows } = {}) {
    const u = userEvent.setup();
    const model = createFakeModel({
      queryUsers: vi.fn().mockResolvedValue([{ department: 'Politics' }]),
      queryArticles: vi.fn().mockResolvedValue(rows),
    });
    const navigate = vi.fn();
    renderView({ model, user, navigate });
    await u.click(screen.getByRole('button', { name: '부서별 송고' }));
    // Open multi-select dropdown and select Politics.
    const multiSelect = screen.getByTestId('dept-multi-select');
    await u.click(within(multiSelect).getByRole('button'));
    await u.click(screen.getByTestId('dept-checkbox-Politics'));
    await u.click(screen.getByRole('button', { name: '조회' }));
    return { u, navigate };
  }

  const dpsRow = {
    articleId: 'AKR20260606XYZ', title: 'songo row', status: 'DPS',
    author: '작', createdAt: '2026-06-06T08:00:00Z',
  };

  it('AC-FWD-1: 부서별 송고 우클릭 메뉴에 활성 편집 항목이 있고 클릭 시 작성 페이지로 포워딩', async () => {
    const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    const edit = within(menu).getByRole('menuitem', { name: /편집/ });
    expect(edit).toBeEnabled();
    await u.click(edit);
    expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
  });

  it('AC-FWD-2: D 권한 + DPS 에서 고침(포털제외)/포털고침이 활성이고 각각 포워딩', async () => {
    const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    const gochim = within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ });
    const portal = within(menu).getByRole('menuitem', { name: /포털고침/ });
    expect(gochim).toBeEnabled();
    expect(portal).toBeEnabled();
    await u.click(gochim);
    expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
  });

  it('AC-FWD-2 (포털고침 포워딩): 우클릭 포털고침 클릭 시 작성 페이지로 포워딩', async () => {
    const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    await u.click(within(menu).getByRole('menuitem', { name: /포털고침/ }));
    expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
  });

  it('AC-FWD-2/AC-REV-3: R 권한은 고침/포털고침이 비활성으로 남고 포워딩하지 않는다', async () => {
    const { u, navigate } = await gotoSongoMenu({ user: R_USER, rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    const gochim = within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ });
    const portal = within(menu).getByRole('menuitem', { name: /포털고침/ });
    expect(gochim).toBeDisabled();
    expect(portal).toBeDisabled();
    await u.click(gochim).catch(() => {});
    expect(navigate).not.toHaveBeenCalled();
  });

  it('AC-REV-3: Z 권한도 고침/포털고침이 비활성으로 남는다', async () => {
    const { navigate } = await gotoSongoMenu({ user: Z_USER, rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    expect(within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /포털고침/ })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('AC-FWD-1/AC-REV-3: 편집 항목은 권한과 무관하게 R 권한에서도 활성이며 포워딩한다', async () => {
    const { u, navigate } = await gotoSongoMenu({ user: R_USER, rows: [dpsRow] });
    const menu = await openMenuOnRow('songo row');
    const edit = within(menu).getByRole('menuitem', { name: /편집/ });
    expect(edit).toBeEnabled();
    await u.click(edit);
    expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
  });

  it('AC-FWD-3: DPS 행의 고침 버튼 클릭 시 포워딩하며 행 클릭(상세보기)을 동시 발생시키지 않는다', async () => {
    const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      const gochimBtn = await screen.findByRole('button', { name: '고침' });
      await u.click(gochimBtn);
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      // 행 클릭(상세보기 새창)은 발생하지 않는다 (stopPropagation 유지).
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
    }
  });

  it('AC-FWD-3 (포털고침 버튼): DPS 행의 포털고침 버튼 클릭 시 포워딩 + 전파 차단', async () => {
    const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      const portalBtn = await screen.findByRole('button', { name: '포털고침' });
      await u.click(portalBtn);
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
    }
  });

  it('AC-FWD-3 (게이팅): D 권한이 아니면 행 버튼은 비활성으로 남고 포워딩하지 않는다', async () => {
    const { u, navigate } = await gotoSongoMenu({ user: R_USER, rows: [dpsRow] });
    const gochimBtn = await screen.findByRole('button', { name: '고침' });
    const portalBtn = screen.getByRole('button', { name: '포털고침' });
    expect(gochimBtn).toBeDisabled();
    expect(portalBtn).toBeDisabled();
    await u.click(gochimBtn).catch(() => {});
    expect(navigate).not.toHaveBeenCalled();
  });

  it('AC-FWD-4: 5 진입점(우클릭 편집/고침/포털고침 + 행 고침/포털고침)이 동일 id 로 동일 경로 포워딩', async () => {
    // Each leg renders a fresh ViewPage; cleanup() between legs prevents duplicate DOM (multiple menus).
    // (a) 우클릭 편집
    {
      const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
      const menu = await openMenuOnRow('songo row');
      await u.click(within(menu).getByRole('menuitem', { name: /편집/ }));
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      cleanup();
    }
    // (b) 우클릭 고침(포털제외)
    {
      const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
      const menu = await openMenuOnRow('songo row');
      await u.click(within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ }));
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      cleanup();
    }
    // (c) 우클릭 포털고침
    {
      const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
      const menu = await openMenuOnRow('songo row');
      await u.click(within(menu).getByRole('menuitem', { name: /포털고침/ }));
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      cleanup();
    }
    // (d) 행 고침 버튼
    {
      const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
      await u.click(await screen.findByRole('button', { name: '고침' }));
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
      cleanup();
    }
    // (e) 행 포털고침 버튼
    {
      const { u, navigate } = await gotoSongoMenu({ rows: [dpsRow] });
      await u.click(await screen.findByRole('button', { name: '포털고침' }));
      expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260606XYZ' });
    }
  });

  it('AC-FWD-1 (중복 금지): 부서별 작성 메뉴에는 부서별 송고 전용 편집 항목이 추가되지 않는다', async () => {
    const u = userEvent.setup();
    const row = { articleId: 'A-W', title: 'write-menu row', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await u.click(screen.getByRole('button', { name: '부서별 작성' }));
    const menu = await openMenuOnRow('write-menu row');
    expect(within(menu).queryByRole('menuitem', { name: /편집/ })).not.toBeInTheDocument();
  });
});
