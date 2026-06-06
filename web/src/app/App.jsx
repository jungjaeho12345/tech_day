// App shell (REQ-FE-APP-001..004): injects the Model, holds session state, and does client-side
// routing across exactly three pages (login / write / view) with an auth guard.
// Routing is URL-driven (news.md: 로그인=login.do, 작성=writer.do, 조회=list.do): the initial route is
// derived from window.location.pathname, navigation updates the URL via history.pushState, and a
// popstate listener keeps the route in sync with browser back/forward.
import { useState, useEffect, useCallback } from 'react';
import { ModelContext, SessionContext } from './context.js';
import { assertModel } from '../model/contract.js';
import { ROUTES, routeFromPath, pathForRoute } from './routing.js';
import { TopBar } from '../view/TopBar.jsx';
import { LoginPage } from '../view/LoginPage.jsx';
import { WriteWorkspace } from '../view/WriteWorkspace.jsx';
import { ViewPage } from '../view/ViewPage.jsx';

export function App({ model }) {
  assertModel(model);
  const [user, setUser] = useState(null);
  // Gate the auth-guard URL reset until the one-shot session restore (F5) settles, so a refresh of a
  // protected .do path is not bounced to /login.do before the restored session rehydrates the user.
  // When the Model has no restoreSession (fakes/tests), there is nothing to wait for — settle immediately
  // so the synchronous auth-guard normalization behaves exactly as before.
  const [restoreSettled, setRestoreSettled] = useState(() => typeof model.restoreSession !== 'function');
  // Initial route is derived from the URL so deep-links / reloads of a .do path land on the right page.
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));

  // @MX:ANCHOR: [AUTO] navigate() — single client-router entry point (fan_in: login/logout/nav links/edit/popstate + SessionContext consumers).
  // @MX:REASON: every route change MUST update the URL (history.pushState) AND the route state together;
  // centralizing this keeps the address bar, back/forward, and rendered page from drifting apart.
  const navigate = useCallback((nextRoute, params) => {
    setRoute(nextRoute);
    const url = pathForRoute(nextRoute, params);
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState({}, '', url);
    }
  }, []);

  // Browser back/forward: re-derive the route from the (now-current) URL.
  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Session restore on first mount (REQ: F5 새로고침에도 유지). A refresh drops in-memory React state,
  // so replay the persisted session id via the Model: if the server-side session is still live, rehydrate
  // the user and keep the current route. `restoreSession` is optional on the Model (fakes may omit it), so
  // it is called defensively. Runs once; navigation/auth guard logic is unchanged.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(model.restoreSession?.()).then((result) => {
      if (cancelled) return;
      if (result?.ok && result.user) {
        setUser(result.user);
      }
      setRestoreSettled(true);
    });
    return () => { cancelled = true; };
  }, [model]);

  function handleLoginSuccess(authUser) {
    setUser(authUser);
    navigate(ROUTES.WRITE); // REQ-FE-LOGIN-003: navigate to write page (writer.do) on success.
  }

  // news.md 사용자 정보: 로그아웃 ends the session and redirects to the login page (login.do).
  const handleLogout = useCallback(async () => {
    await model.logout();
    setUser(null);
    navigate(ROUTES.LOGIN);
  }, [model, navigate]);

  // REQ-FE-APP-004: without a session, never render write/view — force login.
  const authed = Boolean(user);
  const activeRoute = authed ? route : ROUTES.LOGIN;

  // Keep the URL consistent with the auth guard: an unauthenticated visit to a protected .do path
  // (or a logout that left a stale URL) must reflect /login.do in the address bar.
  useEffect(() => {
    if (!restoreSettled) return; // wait for F5 session restore before bouncing a protected path to login.
    if (!authed && window.location.pathname !== pathForRoute(ROUTES.LOGIN)) {
      window.history.replaceState({}, '', pathForRoute(ROUTES.LOGIN));
    }
  }, [authed, restoreSettled]);

  const nav = authed ? (
    <nav aria-label="페이지 이동" className="yh-nav">
      <a
        href={pathForRoute(ROUTES.WRITE)}
        className={`yh-nav__link${route === ROUTES.WRITE ? ' yh-nav__link--active' : ''}`}
        onClick={(e) => { e.preventDefault(); navigate(ROUTES.WRITE); }}
      >
        기사 작성
      </a>
      <a
        href={pathForRoute(ROUTES.VIEW)}
        className={`yh-nav__link${route === ROUTES.VIEW ? ' yh-nav__link--active' : ''}`}
        onClick={(e) => { e.preventDefault(); navigate(ROUTES.VIEW); }}
      >
        기사 조회
      </a>
    </nav>
  ) : null;

  return (
    <ModelContext.Provider value={model}>
      <SessionContext.Provider value={{ user, logout: handleLogout, navigate }}>
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
            {/* 멀티탭 작성 — WriteWorkspace 가 탭 스트립 + 탭별 WritePage 인스턴스를 관리한다.
                조회(list.do)의 편집/고침/포털고침 진입(?id=)은 워크스페이스가 새 탭으로 연다. */}
            <WriteWorkspace user={user} />
          </>
        ) : null}
        {activeRoute === ROUTES.VIEW ? (
          <ViewPage user={user} nav={nav} />
        ) : null}
      </SessionContext.Provider>
    </ModelContext.Provider>
  );
}
