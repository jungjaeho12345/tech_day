// SPEC-NEWS-REVISE-012 — list.do 컨텍스트 메뉴 "Lock해제"(편집 잠금 강제 해제) 프론트 게이트.
// 노출 조건은 행 데이터 lockYN==='Y' (메뉴 종류 무관), 권한은 D/Z 활성·R show-but-disabled.
// 활성 클릭 → forceUnlockArticle(articleId) 1회 + 메뉴 닫힘.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent, cleanup } from '@testing-library/react';
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

async function openMenuOnRow(title) {
  const titleEl = await screen.findByText(title);
  const row = titleEl.closest('.yh-article-row');
  fireEvent.contextMenu(row, { clientX: 120, clientY: 80 });
  return screen.getByRole('menu', { name: '기사 메뉴' });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ViewPage context menu — Lock해제 (force-unlock, SPEC-NEWS-REVISE-012)', () => {
  // AC-MENU-1 (SPEC-NEWS-REVISE-012) — lockYN='Y' 행 → "Lock해제" 항목 노출.
  it('AC-MENU-1: lockYN=Y row shows a "Lock해제" menuitem', async () => {
    const row = { articleId: 'A-LOCK', title: 'locked row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    const menu = await openMenuOnRow('locked row');
    expect(within(menu).getByRole('menuitem', { name: /Lock해제/ })).toBeInTheDocument();
  });

  // AC-MENU-2 (SPEC-NEWS-REVISE-012) — lockYN!='Y' 행 → "Lock해제" 항목 미노출.
  it('AC-MENU-2: lockYN=N row does NOT show a "Lock해제" menuitem', async () => {
    const row = { articleId: 'A-FREE', title: 'free row', status: 'RDS', lockYN: 'N', createdAt: '2026-06-10T08:00:00Z' };
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }) });
    await act(async () => {});
    const menu = await openMenuOnRow('free row');
    expect(within(menu).queryByRole('menuitem', { name: /Lock해제/ })).toBeNull();
  });

  // AC-MENU-3a (SPEC-NEWS-REVISE-012) — D 권한 → "Lock해제" 활성.
  it('AC-MENU-3a: D role → "Lock해제" is enabled', async () => {
    const row = { articleId: 'A-LOCK', title: 'd row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };
    renderView({
      user: { userId: 'd1', name: 'Desk', role: 'D' },
      model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }),
    });
    await act(async () => {});
    const menu = await openMenuOnRow('d row');
    expect(within(menu).getByRole('menuitem', { name: /Lock해제/ })).toBeEnabled();
  });

  // AC-MENU-3b (SPEC-NEWS-REVISE-012) — Z 권한(D-mirror) → "Lock해제" 활성.
  it('AC-MENU-3b: Z role (D-mirror) → "Lock해제" is enabled', async () => {
    const row = { articleId: 'A-LOCK', title: 'z row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };
    renderView({
      user: { userId: 'z1', name: 'Admin', role: 'Z' },
      model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }),
    });
    await act(async () => {});
    const menu = await openMenuOnRow('z row');
    expect(within(menu).getByRole('menuitem', { name: /Lock해제/ })).toBeEnabled();
  });

  // AC-MENU-4 (SPEC-NEWS-REVISE-012) — R 권한 → "Lock해제" 비활성 + 클릭 시 forceUnlockArticle 미호출.
  it('AC-MENU-4: R role → "Lock해제" is disabled and clicking it never calls forceUnlockArticle', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    const row = { articleId: 'A-LOCK', title: 'r row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };
    renderView({
      user: { userId: 'r1', name: 'Reporter', role: 'R' },
      model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]), forceUnlockArticle: spy }),
    });
    await act(async () => {});
    const menu = await openMenuOnRow('r row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(spy).not.toHaveBeenCalled();
    // 비활성 항목 클릭은 메뉴를 닫지 않는다.
    expect(screen.getByRole('menu', { name: '기사 메뉴' })).toBeInTheDocument();
  });

  // AC-MENU-5 (SPEC-NEWS-REVISE-012) — D 활성 클릭 → forceUnlockArticle('A-LOCK') 1회 + 메뉴 닫힘.
  it('AC-MENU-5: clicking the enabled "Lock해제" calls forceUnlockArticle once and closes the menu', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    const row = { articleId: 'A-LOCK', title: 'click row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };
    renderView({
      model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]), forceUnlockArticle: spy }),
    });
    await act(async () => {});
    const menu = await openMenuOnRow('click row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    await act(async () => { fireEvent.click(item); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('A-LOCK');
    expect(screen.queryByRole('menu', { name: '기사 메뉴' })).toBeNull();
  });
});
