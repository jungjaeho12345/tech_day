// 새로고침(F5) 시 로그아웃 문제 수정 검증: 세션을 sessionStorage에 영속화(새로고침 유지, 탭 닫으면 만료).
// App은 user(신원)를, httpModel은 sessionId(전송 세션)를 sessionStorage에 보관한다. 여기서는
// App 관점에서 (1) 로그인 성공 시 저장, (2) user+sessionId 동시 존재 시 새로고침 복원,
// (3) 로그아웃 시 정리, (4) 불완전 세션(user만 있고 sessionId 없음) 폴백을 검증한다.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.jsx';
import { createFakeModel } from '../test/fakeModel.js';

const USER_KEY = 'tech_day.user';
const SESSION_ID_KEY = 'tech_day.sessionId';

function renderApp(model = createFakeModel()) {
  return render(<App model={model} />);
}

describe('세션 영속화 (새로고침 유지, sessionStorage)', () => {
  beforeEach(() => {
    // 각 케이스는 URL과 sessionStorage를 깨끗한 상태에서 시작한다(afterEach에서도 clear됨).
    window.history.replaceState({}, '', '/login.do');
    sessionStorage.clear();
  });

  it('로그인 성공 시 user가 sessionStorage(tech_day.user)에 신원으로 저장된다 (해시 미저장)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });

    const raw = sessionStorage.getItem(USER_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw);
    expect(stored.userId).toBe('reporter1');
    expect(stored.department).toBe('Politics');
    expect(stored.role).toBe('D');
    // 비밀번호/해시 류는 절대 저장되지 않는다.
    expect(raw).not.toMatch(/password|hash/i);
  });

  it('user+sessionId가 모두 있는 상태로 App을 mount하면(새로고침 시뮬) 로그인 없이 writer.do가 복원된다', () => {
    // 새로고침 직전 상태를 sessionStorage + URL로 재현한다.
    sessionStorage.setItem(USER_KEY, JSON.stringify({ userId: 'reporter1', name: 'Hong', role: 'D', department: 'Politics' }));
    sessionStorage.setItem(SESSION_ID_KEY, 'sess-abc');
    window.history.replaceState({}, '', '/writer.do');

    renderApp();

    // 로그인 페이지가 아니라 작성 페이지(송고 버튼)가 렌더되고, user 정보가 복원된다.
    expect(screen.queryByLabelText('아이디')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByTestId('user-info')).toHaveTextContent('reporter1');
    expect(window.location.pathname).toBe('/writer.do');
  });

  it('user+sessionId가 모두 있는 상태로 /list.do를 mount하면 조회 페이지가 복원된다', () => {
    sessionStorage.setItem(USER_KEY, JSON.stringify({ userId: 'reporter1', name: 'Hong', role: 'D', department: 'Politics' }));
    sessionStorage.setItem(SESSION_ID_KEY, 'sess-abc');
    window.history.replaceState({}, '', '/list.do');

    renderApp();

    expect(screen.queryByLabelText('아이디')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '조회 메뉴' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/list.do');
  });

  it('로그아웃하면 sessionStorage의 user/sessionId가 정리되고 로그인 페이지로 돌아간다', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    expect(sessionStorage.getItem(USER_KEY)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await screen.findByLabelText('아이디');

    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();
    expect(window.location.pathname).toBe('/login.do');
  });

  it('불완전 세션(user만 있고 sessionId 없음)으로 mount하면 로그인으로 폴백하고 잔여 user를 정리한다', () => {
    sessionStorage.setItem(USER_KEY, JSON.stringify({ userId: 'reporter1', role: 'D', department: 'Politics' }));
    // sessionId 의도적으로 누락.
    window.history.replaceState({}, '', '/writer.do');

    renderApp();

    // 로그인 페이지로 강제되고 URL은 /login.do로 정규화된다.
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/login.do');
    // 반쪽 user 항목은 부트 정합성 검사에서 정리된다.
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
  });

  it('역방향 불완전(sessionId만 있고 user 없음)으로 mount해도 로그인으로 폴백한다', () => {
    sessionStorage.setItem(SESSION_ID_KEY, 'sess-orphan');
    window.history.replaceState({}, '', '/list.do');

    renderApp();

    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login.do');
    expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();
  });
});
