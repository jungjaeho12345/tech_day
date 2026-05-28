// Feature 2 — right-click context menu on article rows (news.md 기사 조회페이지).
// Verifies the item sets per active menu, the functional actions (상세보기 / 본문복사 / 제목만복사 / 편집),
// disabled placeholders for non-functional actions, and close-on-Escape / outside-click.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
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

describe('ViewPage 데스크 미송고 visible 편집 button — Feature 3 entry', () => {
  it('renders a visible 편집 button that navigates to the write page with the id', async () => {
    const u = userEvent.setup();
    const navigate = vi.fn();
    const row = { articleId: 'A-VIS', title: 'visible edit', status: 'RDS', createdAt: '2026-05-02T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), navigate });
    const editBtn = await screen.findByRole('button', { name: '편집' });
    await u.click(editBtn);
    expect(navigate).toHaveBeenCalledWith('write', { id: 'A-VIS' });
  });
});
