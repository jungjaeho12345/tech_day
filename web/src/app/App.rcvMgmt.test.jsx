// rcvMgmt.do 진입 동선 통합 테스트 — SPEC-RCV-COLLECT-001 AC-11 (Z 전용 메뉴 노출/비노출) + 라우팅.
// in-app nav(a.yh-nav__link) + history pushState 로 전체 페이지 reload 없이 전환됨을 검증한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.jsx';
import { createFakeModel } from '../test/fakeModel.js';

/** Fake model whose login resolves to the given role (department 고정). */
function modelWithRole(role) {
  return createFakeModel({
    login: vi.fn().mockResolvedValue({
      ok: true,
      user: { userId: `${role}1`, name: 'User', role, department: 'IT' },
    }),
    // rcvMgmt 진입 시 빈 목록을 반환(테스트 안정).
    queryReceiverConfig: vi.fn().mockResolvedValue({ ok: true, entries: [] }),
  });
}

async function loginAs(role) {
  const user = userEvent.setup();
  render(<App model={modelWithRole(role)} />);
  await user.type(screen.getByLabelText('아이디'), `${role}1`);
  await user.type(screen.getByLabelText('암호'), 'secret');
  await user.click(screen.getByRole('button', { name: '로그인' }));
  await screen.findByRole('button', { name: '송고' });
  return user;
}

describe('AC-11: 수신처 관리 진입 동선 — Z 전용 nav 링크', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/login.do');
    try { sessionStorage.clear(); } catch { /* no storage */ }
  });

  it('Z 사용자: "수신처 관리" nav 링크가 노출되고 클릭 시 /rcvMgmt.do 로 in-app 전환된다', async () => {
    const user = await loginAs('Z');
    const link = screen.getByRole('link', { name: '수신처 관리' });
    expect(link).toBeInTheDocument();

    await user.click(link);
    // history pushState 로 URL 만 바뀌고(전체 reload 없음) 페이지가 전환된다.
    expect(window.location.pathname).toBe('/rcvMgmt.do');
    expect(await screen.findByRole('button', { name: '생성' })).toBeInTheDocument();
  });

  it('R 사용자: "수신처 관리" nav 링크가 노출되지 않는다(메뉴 비노출)', async () => {
    await loginAs('R');
    expect(screen.queryByRole('link', { name: '수신처 관리' })).not.toBeInTheDocument();
  });

  it('D 사용자: "수신처 관리" nav 링크가 노출되지 않는다(메뉴 비노출)', async () => {
    await loginAs('D');
    expect(screen.queryByRole('link', { name: '수신처 관리' })).not.toBeInTheDocument();
  });

  it('비-Z 가 /rcvMgmt.do 로 딥링크해도 거부 화면을 보인다(프런트 이중 가드)', async () => {
    // D 로 로그인 후 직접 URL 을 rcvMgmt.do 로 바꾸고 popstate 로 라우트를 동기화한다.
    const user = await loginAs('D');
    await user.click(screen.getByRole('link', { name: '기사 조회' }));
    // 비-Z 는 링크가 없으므로 주소창 직접 진입을 시뮬레이션(popstate). 라우트 전환으로 인한
    // 마운트·상태 업데이트를 act() 로 감싸 React 의 "not wrapped in act(...)" 경고를 없앤다.
    await act(async () => {
      window.history.pushState({}, '', '/rcvMgmt.do');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByTestId('rcv-denied')).toBeInTheDocument();
  });
});
