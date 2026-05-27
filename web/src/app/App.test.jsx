import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('AC-2.1 + AC-1.1: successful login navigates to write page and shows user name/role top-right', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('아이디'), 'reporter1');
    await user.type(screen.getByLabelText('암호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    // Navigated to write page (송고/보류 buttons appear).
    expect(await screen.findByRole('button', { name: '송고' })).toBeInTheDocument();
    // Common top-right user info shows name + role.
    const info = screen.getByTestId('user-info');
    expect(info).toHaveTextContent('Hong Gildong');
    expect(info).toHaveTextContent('D');
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
    expect(screen.getByTestId('user-info')).toHaveTextContent('Hong Gildong');
  });
});
