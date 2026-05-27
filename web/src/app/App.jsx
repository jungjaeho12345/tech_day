// App shell (REQ-FE-APP-001..004): injects the Model, holds session state, and does client-side
// routing across exactly three pages (login / write / view) with an auth guard.
import { useState } from 'react';
import { ModelContext, SessionContext } from './context.js';
import { assertModel } from '../model/contract.js';
import { TopBar } from '../view/TopBar.jsx';
import { LoginPage } from '../view/LoginPage.jsx';
import { WritePage } from '../view/WritePage.jsx';
import { ViewPage } from '../view/ViewPage.jsx';

const ROUTES = Object.freeze({ LOGIN: 'login', WRITE: 'write', VIEW: 'view' });

export function App({ model }) {
  assertModel(model);
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(ROUTES.LOGIN);

  function handleLoginSuccess(authUser) {
    setUser(authUser);
    setRoute(ROUTES.WRITE); // REQ-FE-LOGIN-003: navigate to write page on success.
  }

  // REQ-FE-APP-004: without a session, never render write/view — force login.
  const authed = Boolean(user);
  const activeRoute = authed ? route : ROUTES.LOGIN;

  const nav = authed ? (
    <nav aria-label="페이지 이동" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
      <a href="#write" onClick={(e) => { e.preventDefault(); setRoute(ROUTES.WRITE); }}>기사 작성</a>
      <a href="#view" onClick={(e) => { e.preventDefault(); setRoute(ROUTES.VIEW); }}>기사 조회</a>
    </nav>
  ) : null;

  return (
    <ModelContext.Provider value={model}>
      <SessionContext.Provider value={{ user }}>
        {activeRoute === ROUTES.LOGIN ? (
          <>
            <TopBar />
            <LoginPage onSuccess={handleLoginSuccess} />
          </>
        ) : null}
        {activeRoute === ROUTES.WRITE ? (
          <>
            <TopBar />
            {nav}
            <WritePage user={user} />
          </>
        ) : null}
        {activeRoute === ROUTES.VIEW ? (
          <ViewPage user={user} nav={nav} />
        ) : null}
      </SessionContext.Provider>
    </ModelContext.Provider>
  );
}
