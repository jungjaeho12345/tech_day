// URL <-> route mapping for the client-side router (news.md: 로그인=login.do, 작성=writer.do, 조회=list.do).
// The app has three pages keyed by ROUTES; this module is the single source of truth for the
// route<->path translation so App.jsx and the navigate() helper stay in sync. No real router library
// is used — we drive window.history/location directly (see SessionContext.navigate in App.jsx).

// RCVMGMT = 수신처 관리(rcvMgmt.do, SPEC-RCV-COLLECT-001). Z-only — the App auth/role guard gates
// rendering, this module only owns the URL<->route translation (kept symmetric with the other routes).
export const ROUTES = Object.freeze({ LOGIN: 'login', WRITE: 'write', VIEW: 'view', RCVMGMT: 'rcvMgmt' });

// Canonical path for each route (news.md .do naming; rcv.md: 수신처 관리=rcvMgmt.do).
const ROUTE_TO_PATH = Object.freeze({
  [ROUTES.LOGIN]: '/login.do',
  [ROUTES.WRITE]: '/writer.do',
  [ROUTES.VIEW]: '/list.do',
  [ROUTES.RCVMGMT]: '/rcvMgmt.do',
});

// Reverse lookup path -> route.
const PATH_TO_ROUTE = Object.freeze({
  '/login.do': ROUTES.LOGIN,
  '/writer.do': ROUTES.WRITE,
  '/list.do': ROUTES.VIEW,
  '/rcvMgmt.do': ROUTES.RCVMGMT,
});

/**
 * Derive the route for a given pathname. Unknown paths and '/' map to LOGIN.
 * @param {string} [pathname]
 * @returns {string} one of ROUTES.*
 */
export function routeFromPath(pathname) {
  return PATH_TO_ROUTE[pathname] ?? ROUTES.LOGIN;
}

/**
 * Build the URL (path + optional ?id=) for a route. An empty/falsy id is omitted.
 * @param {string} route one of ROUTES.*
 * @param {{id?: string}} [params]
 * @returns {string}
 */
export function pathForRoute(route, params) {
  const base = ROUTE_TO_PATH[route] ?? ROUTE_TO_PATH[ROUTES.LOGIN];
  const id = params?.id;
  return id ? `${base}?id=${encodeURIComponent(id)}` : base;
}
