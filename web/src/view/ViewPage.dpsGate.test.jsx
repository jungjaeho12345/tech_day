// SPEC-NEWS-REVISE-011 REQ-DPS-ENTRY-GATE — 고침/포털고침 진입 게이트 D 한정 회귀 가드 (프론트엔드).
// AC-DPS-GATE-1 (D+DPS 진입 활성/포워딩), AC-DPS-GATE-2 (R/Z 진입 비활성 유지).
// 본 SPEC 은 진입 게이트를 변경하지 않는다 — 기존 SPEC-007 동작(canDpsEdit = status==='DPS' && role==='D')을
// 회귀 없이 유지함을 AC-DPS-GATE ID 로 명시적으로 재단언한다(ViewPage.contextMenu.test.jsx 의 AC-FWD/AC-REV
// 패턴 차용, 기존 케이스는 수정하지 않고 추가만).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

const D_USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
const R_USER = { userId: 'r1', name: 'Rep', role: 'R', department: 'Politics' };
const Z_USER = { userId: 'z1', name: 'Adm', role: 'Z', department: 'Politics' };

const dpsRow = {
  articleId: 'AKR20260610DPS', title: 'gate row', status: 'DPS',
  author: '작', createdAt: '2026-06-10T08:00:00Z',
};

async function gotoSongoMenu(user) {
  const u = userEvent.setup();
  const model = createFakeModel({
    queryUsers: vi.fn().mockResolvedValue([{ department: 'Politics' }]),
    queryArticles: vi.fn().mockResolvedValue([dpsRow]),
  });
  const navigate = vi.fn();
  render(
    <ModelContext.Provider value={model}>
      <SessionContext.Provider value={{ user, navigate }}>
        <ViewPage user={user} />
      </SessionContext.Provider>
    </ModelContext.Provider>,
  );
  await u.click(screen.getByRole('button', { name: '부서별 송고' }));
  const multiSelect = screen.getByTestId('dept-multi-select');
  await within(multiSelect).findByText('전체');
  await u.click(screen.getByRole('button', { name: '조회' }));
  return { u, navigate };
}

async function openMenuOnRow(title) {
  const titleEl = await screen.findByText(title);
  const row = titleEl.closest('.yh-article-row');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.contextMenu(row, { clientX: 120, clientY: 80 });
  return screen.getByRole('menu', { name: '기사 메뉴' });
}

describe('SPEC-NEWS-REVISE-011 — REQ-DPS-ENTRY-GATE 진입 게이트 D 한정 회귀', () => {
  // AC-DPS-GATE-1 (SPEC-NEWS-REVISE-011): D + DPS 진입 활성 + 작성 페이지 포워딩.
  it('AC-DPS-GATE-1 (SPEC-NEWS-REVISE-011): D 권한 + DPS 에서 고침(포털제외)/포털고침 활성 + 포워딩', async () => {
    const { u, navigate } = await gotoSongoMenu(D_USER);
    const menu = await openMenuOnRow('gate row');
    const gochim = within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ });
    const portal = within(menu).getByRole('menuitem', { name: /포털고침/ });
    expect(gochim).toBeEnabled();
    expect(portal).toBeEnabled();
    await u.click(gochim);
    expect(navigate).toHaveBeenCalledWith('write', { id: 'AKR20260610DPS' });
  });

  // AC-DPS-GATE-2 (SPEC-NEWS-REVISE-011): R/Z 진입 비활성 유지 + 포워딩 없음 (게이트 R/Z 확대 금지).
  for (const user of [R_USER, Z_USER]) {
    it(`AC-DPS-GATE-2 (SPEC-NEWS-REVISE-011): ${user.role} 권한은 고침/포털고침 비활성 + 포워딩 없음`, async () => {
      const { u, navigate } = await gotoSongoMenu(user);
      const menu = await openMenuOnRow('gate row');
      expect(within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ })).toBeDisabled();
      expect(within(menu).getByRole('menuitem', { name: /포털고침/ })).toBeDisabled();
      await u.click(within(menu).getByRole('menuitem', { name: /고침\(포털제외\)/ })).catch(() => {});
      expect(navigate).not.toHaveBeenCalled();
    });
  }
});
