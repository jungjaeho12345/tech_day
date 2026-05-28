import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.jsx';
import { createFakeModel } from '../test/fakeModel.js';

function renderApp(model = createFakeModel()) {
  return render(<App model={model} />);
}

describe('App routing + auth guard (REQ-FE-APP-002/003/004)', () => {
  it('AC-1.2: with no session, write/view pages are not rendered and login page is shown', () => {
    renderApp();
    // Login form is present.
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    // Authenticated-page markers must NOT be present.
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '조회 메뉴' })).not.toBeInTheDocument();
  });

  it('AC-2.1 + AC-1.1: successful login navigates to write page and shows userId/department/role top-right', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    // Navigated to write page (송고/보류 buttons appear).
    expect(await screen.findByRole('button', { name: '송고' })).toBeInTheDocument();
    // Common top-right user info shows userId · department · (role) per news.md 사용자 정보.
    const info = screen.getByTestId('user-info');
    expect(info).toHaveTextContent('reporter1');  // userId (typed login id)
    expect(info).toHaveTextContent('Politics');   // department
    expect(info).toHaveTextContent('D');          // role
  });

  it('AC-2.2: failed login shows error and stays on login page (no navigation)', async () => {
    const user = userEvent.setup();
    const model = createFakeModel({ login: vi.fn().mockResolvedValue({ ok: false }) });
    renderApp(model);
    await user.type(screen.getByLabelText('아이디'), 'bad');
    await user.type(screen.getByLabelText('암호'), 'bad');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/로그인.*실패|인증.*실패/);
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
  });

  it('AC-2.3: password input is masked (type=password)', () => {
    renderApp();
    expect(screen.getByLabelText('암호')).toHaveAttribute('type', 'password');
  });

  it('EC-1: login response with a password hash is never stored or displayed', async () => {
    const user = userEvent.setup();
    const model = createFakeModel({
      login: vi.fn().mockResolvedValue({
        ok: true,
        user: { userId: 'r1', name: 'Kim', role: 'R', password: 'HASHED$DO_NOT_LEAK' },
      }),
    });
    renderApp(model);
    await user.type(screen.getByLabelText('아이디'), 'r1');
    await user.type(screen.getByLabelText('암호'), 'pw');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    // The hash string must not appear anywhere in the rendered document.
    expect(document.body.textContent).not.toContain('HASHED$DO_NOT_LEAK');
  });

  it('AC-1.1: navigating to the view page keeps the top-right user info visible', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    await user.click(screen.getByRole('link', { name: '기사 조회' }));
    expect(screen.getByRole('navigation', { name: '조회 메뉴' })).toBeInTheDocument();
    // Top-right user info stays visible on the view page: userId · department · (role).
    const info = screen.getByTestId('user-info');
    expect(info).toHaveTextContent('reporter1');  // userId
    expect(info).toHaveTextContent('Politics');   // department
    expect(info).toHaveTextContent('D');          // role
  });
});

describe('Logout (사용자 정보: 로그아웃 -> session 종료 + 로그인 redirect)', () => {
  it('AC-LOGOUT-1: write page shows a 로그아웃 button; clicking it calls model.logout and returns to login', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue({ ok: true });
    renderApp(createFakeModel({ logout }));
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalled();
    // Back on login page; authenticated-page markers gone.
    expect(await screen.findByLabelText('아이디')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
  });

  it('AC-LOGOUT-2: the 로그아웃 button is also available on the view page', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue({ ok: true });
    renderApp(createFakeModel({ logout }));
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    await user.click(screen.getByRole('link', { name: '기사 조회' }));

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByLabelText('아이디')).toBeInTheDocument();
  });
});

// URL routing (news.md: 로그인=login.do, 작성=writer.do, 조회=list.do). jsdom supports
// window.history.pushState/replaceState + window.location.pathname; we reset to /login.do between
// tests so the shared location object does not leak state across cases.
describe('URL routing (.do paths) — Feature 1', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/login.do');
  });

  it('initial route is derived from the pathname: /writer.do mounts the write page after auth', async () => {
    // Deep-link to writer.do, but unauthenticated => auth guard forces the login page first and
    // the URL is normalized back to /login.do.
    window.history.replaceState({}, '', '/writer.do');
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login.do');

    // After login, the route state (already WRITE from the URL) resolves to the write page.
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/writer.do');
  });

  it('successful login pushes the URL to /writer.do', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    expect(window.location.pathname).toBe('/writer.do');
  });

  it('nav link to 기사 조회 pushes the URL to /list.do', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    await user.click(screen.getByRole('link', { name: '기사 조회' }));
    expect(screen.getByRole('navigation', { name: '조회 메뉴' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/list.do');
  });

  it('logout pushes the URL back to /login.do', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    expect(window.location.pathname).toBe('/writer.do');

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await screen.findByLabelText('아이디');
    expect(window.location.pathname).toBe('/login.do');
  });

  it('auth guard: an unauthenticated /list.do visit renders login and normalizes the URL', () => {
    window.history.replaceState({}, '', '/list.do');
    renderApp();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '조회 메뉴' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/login.do');
  });

  it('popstate (browser back) re-syncs the route from the URL', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('button', { name: '송고' });
    await user.click(screen.getByRole('link', { name: '기사 조회' }));
    expect(window.location.pathname).toBe('/list.do');

    // Simulate browser Back: revert the URL and dispatch popstate (jsdom does not auto-fire it).
    act(() => {
      window.history.replaceState({}, '', '/writer.do');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '조회 메뉴' })).not.toBeInTheDocument();
  });
});
