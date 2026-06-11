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
  // (SPEC-NEWS-REVISE-014 이후엔 window.confirm 수락이 선행되므로 여기서 true 로 스텁한다 — AC-MENU-5 의
  //  "클릭 → 1회 호출 + 메뉴 닫힘" 회귀는 수락 경로에서 그대로 유지된다.)
  it('AC-MENU-5: clicking the enabled "Lock해제" calls forceUnlockArticle once and closes the menu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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

// SPEC-NEWS-REVISE-014 REQ-UNLOCK-CONFIRM — 활성 "Lock해제" 클릭 시 window.confirm('Lock해제하시겠습니까?')
// 를 선행하고, 수락(true) 시에만 forceUnlockArticle 를 1회 호출한다. 취소(false) 시 무호출. R 비활성 항목은
// confirm 도 forceUnlockArticle 도 호출하지 않는다(SPEC-012 show-but-disabled 불변).
describe('ViewPage Lock해제 확인창 (SPEC-NEWS-REVISE-014 REQ-UNLOCK-CONFIRM)', () => {
  const LOCKED_ROW = { articleId: 'A-LOCK', title: 'confirm row', status: 'RDS', lockYN: 'Y', createdAt: '2026-06-10T08:00:00Z' };

  // AC-CONFIRM-1 — 활성 "Lock해제" 클릭 → window.confirm('Lock해제하시겠습니까?') 표시.
  it('AC-CONFIRM-1: clicking enabled "Lock해제" shows window.confirm with the exact message', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([LOCKED_ROW]) }) });
    await act(async () => {});
    const menu = await openMenuOnRow('confirm row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    await act(async () => { fireEvent.click(item); });
    expect(confirmSpy).toHaveBeenCalledWith('Lock해제하시겠습니까?');
  });

  // AC-CONFIRM-2 — 수락(예) → forceUnlockArticle('A-LOCK') 정확히 1회.
  it('AC-CONFIRM-2: accepting the confirm calls forceUnlockArticle once with the articleId', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const spy = vi.fn().mockResolvedValue({ ok: true });
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([LOCKED_ROW]), forceUnlockArticle: spy }) });
    await act(async () => {});
    const menu = await openMenuOnRow('confirm row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    await act(async () => { fireEvent.click(item); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('A-LOCK');
  });

  // AC-CONFIRM-3 — 취소(아니오) → forceUnlockArticle 미호출(DB/SSE 무변동).
  it('AC-CONFIRM-3: cancelling the confirm never calls forceUnlockArticle', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const spy = vi.fn().mockResolvedValue({ ok: true });
    renderView({ model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([LOCKED_ROW]), forceUnlockArticle: spy }) });
    await act(async () => {});
    const menu = await openMenuOnRow('confirm row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    await act(async () => { fireEvent.click(item); });
    expect(spy).not.toHaveBeenCalled();
  });

  // AC-CONFIRM-4 — R 비활성 항목 → confirm 도 forceUnlockArticle 도 호출되지 않는다.
  it('AC-CONFIRM-4: R-role disabled "Lock해제" triggers neither confirm nor forceUnlockArticle', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const spy = vi.fn().mockResolvedValue({ ok: true });
    renderView({
      user: { userId: 'r1', name: 'Reporter', role: 'R' },
      model: createFakeModel({ queryArticles: vi.fn().mockResolvedValue([LOCKED_ROW]), forceUnlockArticle: spy }),
    });
    await act(async () => {});
    const menu = await openMenuOnRow('confirm row');
    const item = within(menu).getByRole('menuitem', { name: /Lock해제/ });
    expect(item).toBeDisabled();
    await act(async () => { fireEvent.click(item); });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});
