// Regression guard for AC-UI-1 (SPEC-NEWS-REVISE-015 §6) — 사용자 정보 표시 형식.
//
// news.md 흡수: 우측 상단 사용자 정보는 '유저아이디 · 부서 · (권한)' 형식으로 표시한다.
// 코드 근거: web/src/view/TopBar.jsx:22-28 ( userId · department · (role) ).
// 본 SPEC 은 운영 코드를 변경하지 않으므로(흡수 + characterization) 이 테스트는 현재 렌더 동작을
// 기술하는 회귀 가드다. 형식이 회귀하면(구분자 변경, 부서/권한 누락 등) FAIL 한다.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TopBar } from './TopBar.jsx';
import { SessionContext } from '../app/context.js';

/** Render TopBar with a session user (and an optional logout spy). */
function renderTopBar(user, logout = vi.fn()) {
  return render(
    <SessionContext.Provider value={user ? { user, logout } : null}>
      <TopBar />
    </SessionContext.Provider>,
  );
}

describe('AC-UI-1: 우측 상단 사용자 정보 형식 (SPEC-NEWS-REVISE-015 §6)', () => {
  it("'유저아이디 · 부서 · (권한)' 순서로 세 토막을 모두 표시한다", () => {
    renderTopBar({ userId: 'd1', department: '정치부', role: 'D' });

    const info = screen.getByTestId('user-info');
    // userId, department, (role) each rendered; the parenthesised role is the permission marker.
    expect(within(info).getByText('d1')).toBeInTheDocument();
    expect(within(info).getByText('정치부')).toBeInTheDocument();
    expect(within(info).getByText('(D)')).toBeInTheDocument();
    // The three fields are joined by the ' · ' middot separator (collapsed whitespace in textContent).
    expect(info.textContent.replace(/\s+/g, ' ').trim()).toBe('d1 · 정치부 · (D)');
  });

  it('권한은 괄호로 감싸 표시한다 (역할별 회귀 가드)', () => {
    for (const role of ['R', 'D', 'Z']) {
      const { unmount } = renderTopBar({ userId: 'u', department: '편집부', role });
      expect(screen.getByText(`(${role})`)).toBeInTheDocument();
      unmount();
    }
  });

  it('세션이 없으면 사용자 정보·로그아웃 버튼을 렌더하지 않는다', () => {
    renderTopBar(null);
    expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });
});
