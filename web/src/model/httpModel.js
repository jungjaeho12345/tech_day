// @MX:ANCHOR: [AUTO] Real HTTP/SSE-backed Model — the production transport injected at app boot (fan_in: every Controller).
// @MX:REASON: this is the single integration seam between the React UI's MODEL_KEYS contract
// (web/src/model/contract.js) and the Express backend (server/index.js). Method shapes MUST mirror
// fakeModel.js so View/Controller layers and their tests stay transport-agnostic; the whole UI depends
// on these exact return shapes and on the session-id replay protocol that gates protected routes.
//
// Session handling: POST /api/login returns a `sessionId`; we capture it in a closure variable and replay
// it as the `x-session-id` header on every subsequent request. It is DROPPED from the returned object
// (transport state, never UI state) and cleared on logout. Network errors never throw — each method
// returns the documented safe default so the UI degrades gracefully.
import { assertModel } from './contract.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';

/** Resolve the API base URL: explicit opt > Vite env > hardcoded default. */
function resolveBaseUrl(baseUrl) {
  if (baseUrl) return baseUrl;
  // `import.meta.env` is undefined outside a Vite build/dev/test pipeline; guard so import never throws.
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : undefined;
  return fromEnv ?? DEFAULT_BASE_URL;
}

/**
 * Create the real HTTP Model implementing every MODEL_KEY against the Express backend.
 * @param {{ baseUrl?: string }} [opts]
 * @returns {import('./contract.js').ArticleModel}
 */
// sessionStorage key holding the server-issued session id so a browser refresh (F5) can restore the
// session. sessionStorage (not localStorage) is intentional: it survives a same-tab reload but is
// cleared when the tab/browser closes, matching the domain rule "브라우저 닫힘 → 세션 종료" (news.md lockYN).
// 'tech_day.' prefix — App.jsx 의 USER_KEY('tech_day.user')와 같은 네임스페이스를 쓴다 (정합성 검사 공유).
const SESSION_STORAGE_KEY = 'tech_day.sessionId';

/** Safe sessionStorage access — guarded so the module never throws in non-browser/test contexts. */
function readStoredSessionId() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}
function writeStoredSessionId(value) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value) sessionStorage.setItem(SESSION_STORAGE_KEY, value);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // storage unavailable (private mode/quota) — degrade to in-memory only; no throw.
  }
}

export function createHttpModel({ baseUrl } = {}) {
  const base = resolveBaseUrl(baseUrl);

  // Transport state: the server-issued session id, replayed on every request and cleared on logout.
  // Seeded from sessionStorage so a page refresh keeps replaying the same id until restoreSession()
  // confirms it (or the server reports it expired).
  let sessionId = readStoredSessionId();

  /** Build request headers, attaching x-session-id only when a session is active. */
  function headers() {
    return {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'x-session-id': sessionId } : {}),
    };
  }

  /** GET <path> and parse JSON. Returns `fallback` on any network/parse failure. */
  async function getJson(path, fallback) {
    try {
      const res = await fetch(`${base}${path}`, { method: 'GET', headers: headers() });
      return await res.json();
    } catch {
      return fallback;
    }
  }

  /** POST/PUT <path> with a JSON body and parse JSON. Returns `fallback` on any failure. */
  async function sendJson(method, path, body, fallback) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: headers(),
        body: JSON.stringify(body ?? {}),
      });
      return await res.json();
    } catch {
      return fallback;
    }
  }

  /** Encode a flat filters object into a query string (empty -> '').
   * Array values are serialized as repeated key params: status=['RDS','DDH'] → status=RDS&status=DDH.
   * undefined/null array elements are skipped. Scalar values use a single append.
   */
  function toQueryString(filters) {
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item === undefined || item === null) continue;
            params.append(key, String(item));
          }
        } else {
          params.append(key, String(value));
        }
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  const model = {
    // --- Auth ---------------------------------------------------------------
    async login(userId, password) {
      // Replay any current session id so the server can rotate/invalidate it on re-login.
      const result = await sendJson('POST', '/api/login', { userId, password }, { ok: false });
      if (result?.ok) {
        // Capture transport state; DROP sessionId from the returned object to match the contract.
        sessionId = result.sessionId ?? null;
        writeStoredSessionId(sessionId); // persist so a refresh (F5) can restore the session.
        return { ok: true, user: result.user };
      }
      return { ok: false };
    },

    async logout() {
      const result = await sendJson('POST', '/api/logout', {}, { ok: true });
      sessionId = null; // Clear locally regardless of the server response.
      writeStoredSessionId(null); // drop the persisted id so a later refresh cannot restore it.
      return { ok: result?.ok ?? true };
    },

    // Session restore for browser refresh (F5): replay the persisted x-session-id against
    // GET /api/session. If the server-side session is still live (within the 1h sliding window),
    // returns the sanitized identity so the App can rehydrate the user WITHOUT a re-login. On a
    // missing/expired session the stored id is purged so the UI falls back to the login page.
    async restoreSession() {
      if (!sessionId) {
        return { ok: false };
      }
      const result = await getJson('/api/session', { ok: false });
      if (result?.ok) {
        return { ok: true, user: result.user };
      }
      // Server rejected the stored id (expired/unknown) — clear local + persisted transport state.
      sessionId = null;
      writeStoredSessionId(null);
      return { ok: false };
    },

    // --- Users (department data-source, DP-F4) --------------------------------
    async queryUsers(filters) {
      const data = await getJson(`/api/users${toQueryString(filters)}`, []);
      // Backend returns an array for R/D/Z; unauthenticated yields { ok:false } -> degrade to [].
      return Array.isArray(data) ? data : [];
    },

    // --- Articles -----------------------------------------------------------
    async queryArticles(filters) {
      const data = await getJson(`/api/articles${toQueryString(filters)}`, []);
      return Array.isArray(data) ? data : [];
    },

    async searchArticles(queryText) {
      const data = await getJson(`/api/articles/search?q=${encodeURIComponent(queryText ?? '')}`, []);
      return Array.isArray(data) ? data : [];
    },

    // --- Media proxy (DP-F3) -------------------------------------------------
    // type-routed: 'video' -> YouTube Data API v3; 'image' -> Google Custom Search (searchType=image).
    // The server normalizes a missing/unknown type to 'video'; we default to 'video' on the client too.
    // API keys stay server-side env only and never appear in the client-bound payload.
    async searchMedia(query, type) {
      // On network failure return the documented safe default so the UI shows the error state.
      const data = await getJson(
        `/api/media/search?q=${encodeURIComponent(query ?? '')}&type=${encodeURIComponent(type ?? 'video')}`,
        { items: [], error: true },
      );
      return data ?? { items: [], error: true };
    },

    // --- Lifecycle (DP-F5) ---------------------------------------------------
    async applyAction(articleId, _role, action, options) {
      // The server derives the acting role from the session and ignores any client role. In an edit
      // context the page-scoped lock sessionId rides along (AC-EDIT-LOCK-6) so the server's action
      // route lock gate can identify the caller as the holder; otherwise the body stays { action }.
      const body = options?.sessionId ? { action, sessionId: options.sessionId } : { action };
      return sendJson(
        'POST',
        `/api/articles/${encodeURIComponent(articleId)}/action`,
        body,
        { ok: false, reason: 'network-error' },
      );
    },

    async saveArticle(articleId, dto) {
      // Falsy id or the sentinel draft id 'A-DRAFT' means a new article -> POST; otherwise update -> PUT.
      if (!articleId || articleId === 'A-DRAFT') {
        return sendJson('POST', '/api/articles', dto, { ok: false });
      }
      return sendJson('PUT', `/api/articles/${encodeURIComponent(articleId)}`, dto, { ok: false });
    },

    // --- Edit lock (SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK) ----------------------
    // holder IS the login session: the server derives it from the validated x-session-id header
    // (injected by headers()), so both calls carry NO body and take ONLY articleId.
    //   lockArticle   -> POST /api/articles/:id/lock    { ok:true, article? } | { ok:false, reason }
    //   unlockArticle -> POST /api/articles/:id/unlock  { ok:true, released }  (keepalive for beforeunload)
    async lockArticle(articleId) {
      return sendJson(
        'POST',
        `/api/articles/${encodeURIComponent(articleId)}/lock`,
        undefined,
        { ok: false, reason: 'network-error' },
      );
    },
    async unlockArticle(articleId) {
      // keepalive:true so the release still flushes when fired from a beforeunload handler during page
      // teardown (the request must outlive the unloading document). Network failures degrade to
      // { ok:true, released:false } — release must never block unload.
      try {
        const res = await fetch(`${base}/api/articles/${encodeURIComponent(articleId)}/unlock`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({}),
          keepalive: true,
        });
        return await res.json();
      } catch {
        return { ok: true, released: false };
      }
    },

    // --- Realtime (SSE, DP-F2) ----------------------------------------------
    subscribe(_filter, onChange) {
      // EventSource is a browser global; guard so importing this module never crashes in non-browser contexts.
      if (typeof EventSource === 'undefined') {
        return { unsubscribe() {}, get connected() { return false; } };
      }
      const es = new EventSource(`${base}/api/stream`);
      es.addEventListener('change', (event) => {
        try {
          onChange(JSON.parse(event.data));
        } catch {
          // Ignore malformed SSE payloads; the next valid event will refresh the view.
        }
      });
      // Connection-state wiring (REQ-FE-VIEW-002): surface open/error transitions so the status
      // bar tracks the real transport. EventSource auto-reconnects after error, firing open again.
      es.addEventListener('open', () => onChange({ connected: true }));
      es.addEventListener('error', () => onChange({ connected: false }));
      return {
        unsubscribe() {
          es.close();
        },
        get connected() {
          return es.readyState === EventSource.OPEN;
        },
      };
    },
  };

  // Fail fast on any missing method (wiring guard, mirrors fakeModel).
  return assertModel(model);
}
