// App shell (REQ-FE-APP-001..004): injects the Model, holds session state, and does client-side
// routing across exactly three pages (login / write / view) with an auth guard.
// Routing is URL-driven (news.md: 로그인=login.do, 작성=writer.do, 조회=list.do): the initial route is
// derived from window.location.pathname, navigation updates the URL via history.pushState, and a
// popstate listener keeps the route in sync with browser back/forward.
import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelContext, SessionContext } from './context.js';
import { assertModel } from '../model/contract.js';
import { ROUTES, routeFromPath, pathForRoute } from './routing.js';
import { TopBar } from '../view/TopBar.jsx';
import { LoginPage } from '../view/LoginPage.jsx';
import { WritePage } from '../view/WritePage.jsx';
import { ViewPage } from '../view/ViewPage.jsx';

// 세션 영속화 키 — sessionStorage 충돌 방지를 위해 'tech_day.' prefix를 쓴다.
// user(신원)는 App이, sessionId(전송 세션)는 httpModel이 각각 sessionStorage에 보관하며,
// 부트 복원 시 둘의 정합성을 함께 검사한다(둘 중 하나라도 없으면 불완전 세션으로 보고 로그인으로).
const USER_KEY = 'tech_day.user';
const SESSION_ID_KEY = 'tech_day.sessionId';

// SSR/비브라우저/jsdom-없음 안전 가드: sessionStorage가 없으면 복원/저장을 건너뛴다.
function hasSessionStorage() {
  return typeof sessionStorage !== 'undefined' && sessionStorage !== null;
}

/** user/sessionId 영속 항목을 모두 제거(로그아웃·불완전 세션 정리용). */
function clearPersistedSession() {
  if (!hasSessionStorage()) return;
  try {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    /* 접근 실패 무시 */
  }
}

// @MX:ANCHOR: [AUTO] restoreSession() — 부트 시 sessionStorage에서 user를 복원하는 단일 진입점 (fan_in: App 초기 상태 + 정합성 검사).
// @MX:REASON: user(신원)와 sessionId(전송 세션)는 따로 보관되므로 둘의 정합성을 한곳에서 판정해야
// 새로고침 후 "user는 복원됐지만 API는 미인증"인 반쪽 세션이 생기지 않는다. 불완전하면 둘 다 비운다.
function restoreSession() {
  if (!hasSessionStorage()) return null;
  let rawUser = null;
  let sessionId = null;
  try {
    rawUser = sessionStorage.getItem(USER_KEY);
    sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null; // 접근 실패 — 미인증으로 degrade.
  }
  // user와 sessionId 중 하나라도 없으면 불완전 세션 → 양쪽 모두 정리하고 로그인으로.
  if (!rawUser || !sessionId) {
    clearPersistedSession();
    return null;
  }
  try {
    return JSON.parse(rawUser);
  } catch {
    clearPersistedSession(); // 손상된 JSON → 양쪽 정리.
    return null;
  }
}

/** 로그인 성공 시 신원(해시 미포함)을 sessionStorage에 저장. 접근 실패는 무시. */
function persistUser(authUser) {
  if (!hasSessionStorage()) return;
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));
  } catch {
    /* private mode 등 접근 실패 — 메모리 상태만 유지 */
  }
}

export function App({ model }) {
  assertModel(model);
  // 새로고침(F5) 후에도 로그인 유지: sessionStorage에서 user를 복원해 초기화한다.
  // user가 복원되면 라우트는 이미 URL(routeFromPath)에서 복원되므로 writer.do/list.do가 유지된다.
  const [user, setUser] = useState(restoreSession);
  // Initial route is derived from the URL so deep-links / reloads of a .do path land on the right page.
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));

  // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — the write controller registers a best-effort lock-release
  // callback here so handleLogout can free a held edit lock BEFORE the session is cleared
  // (release-before-clear-session, AC-RLE-6). A ref (not state) keeps the latest callback without
  // re-rendering; the controller re-registers whenever its held article changes.
  const editLockReleaseRef = useRef(null);
  const registerEditLockRelease = useCallback((fn) => {
    editLockReleaseRef.current = typeof fn === 'function' ? fn : null;
  }, []);

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

  function handleLoginSuccess(authUser) {
    setUser(authUser);
    // 새로고침 유지를 위해 신원을 sessionStorage에 영속화(sessionId는 model.login이 영속화).
    persistUser(authUser);
    navigate(ROUTES.WRITE); // REQ-FE-LOGIN-003: navigate to write page (writer.do) on success.
  }

  // news.md 사용자 정보: 로그아웃 ends the session and redirects to the login page (login.do).
  // SPEC-EDIT-LOCK-001 AC-RLE-6 — release-before-clear-session: free any held edit lock FIRST (while the
  // session id is still valid so the server can authorize the unlock), THEN end the session and redirect.
  const handleLogout = useCallback(async () => {
    const release = editLockReleaseRef.current;
    if (release) {
      try { release(); } catch { /* best-effort — never block logout */ }
    }
    await model.logout(); // model.logout()이 sessionStorage의 sessionId 제거를 맡는다.
    setUser(null);
    clearPersistedSession(); // user(및 잔여 sessionId) 영속 항목 정리 — 다음 부트의 반쪽 세션 방지.
    navigate(ROUTES.LOGIN);
  }, [model, navigate]);

  // REQ-FE-APP-004: without a session, never render write/view — force login.
  const authed = Boolean(user);
  const activeRoute = authed ? route : ROUTES.LOGIN;

  // Keep the URL consistent with the auth guard: an unauthenticated visit to a protected .do path
  // (or a logout that left a stale URL) must reflect /login.do in the address bar.
  useEffect(() => {
    if (!authed && window.location.pathname !== pathForRoute(ROUTES.LOGIN)) {
      window.history.replaceState({}, '', pathForRoute(ROUTES.LOGIN));
    }
  }, [authed]);

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
      <SessionContext.Provider value={{ user, logout: handleLogout, navigate, registerEditLockRelease }}>
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
