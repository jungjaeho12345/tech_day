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
export function createHttpModel({ baseUrl } = {}) {
  const base = resolveBaseUrl(baseUrl);

  // Transport state: the server-issued session id, replayed on every request and cleared on logout.
  let sessionId = null;

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

  /** Encode a flat filters object into a query string (empty -> ''). */
  function toQueryString(filters) {
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;
        params.append(key, String(value));
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
        return { ok: true, user: result.user };
      }
      return { ok: false };
    },

    async logout() {
      const result = await sendJson('POST', '/api/logout', {}, { ok: true });
      sessionId = null; // Clear locally regardless of the server response.
      return { ok: result?.ok ?? true };
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
    async searchMedia(query) {
      // On network failure return the documented safe default so the UI shows the error state.
      const data = await getJson(`/api/media/search?q=${encodeURIComponent(query ?? '')}`, {
        items: [],
        error: true,
      });
      return data ?? { items: [], error: true };
    },

    // --- Lifecycle (DP-F5) ---------------------------------------------------
    async applyAction(articleId, _role, action) {
      // The server derives the acting role from the session and ignores any client role; send {action} only.
      return sendJson(
        'POST',
        `/api/articles/${encodeURIComponent(articleId)}/action`,
        { action },
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

    // --- Edit lock (SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK, D2-4 = C) -----------
    // NFR-SEC: userId is NOT sent — the server derives it from the validated x-session-id session.
    // Only the page-scoped sessionId is sent so the server can distinguish same-user-different-page
    // attempts (D2-5 = A strict: rejected). The sessionId here is a CLIENT-generated UUID per editor
    // page (NOT the auth session id) so two tabs of the same user are still mutually exclusive.
    async acquireEditLock(articleId, { sessionId } = {}) {
      return sendJson(
        'POST',
        `/api/articles/${encodeURIComponent(articleId)}/lock`,
        { sessionId },
        { ok: false, reason: 'network-error' },
      );
    },
    async releaseEditLock(articleId, { sessionId } = {}) {
      return sendJson(
        'DELETE',
        `/api/articles/${encodeURIComponent(articleId)}/lock`,
        { sessionId },
        { ok: true }, // idempotent default — release failures must not block beforeunload
      );
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
