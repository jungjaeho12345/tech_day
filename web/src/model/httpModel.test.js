// Unit tests for the real HTTP Model (httpModel.js). fetch is mocked so no real network calls
// are made; EventSource is stubbed for the subscribe test. These tests verify the session-id
// replay protocol, REST verb/path routing, and the documented safe defaults on failure.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpModel } from './httpModel.js';

const BASE = 'http://127.0.0.1:3001';

/** Build a Response-like object whose .json() resolves to `payload`. */
function jsonResponse(payload) {
  return { json: async () => payload };
}

/** Extract { method, headers, body } from the most recent fetch call. */
function lastCall() {
  return global.fetch.mock.calls.at(-1);
}

describe('createHttpModel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    // The model seeds its sessionId from sessionStorage (F5 restore); clear it so each test starts
    // from a clean transport state and persisted ids never leak across cases.
    try { sessionStorage.clear(); } catch { /* no storage in this env */ }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { sessionStorage.clear(); } catch { /* no storage in this env */ }
  });

  it('login success captures sessionId, drops it from the result, and returns { ok, user }', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, user: { userId: 'r1', role: 'R' }, sessionId: 'sess-123' }),
    );
    const model = createHttpModel();

    const result = await model.login('r1', 'pw');

    expect(result).toEqual({ ok: true, user: { userId: 'r1', role: 'R' } });
    expect(result).not.toHaveProperty('sessionId'); // transport state, never leaked to the UI

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/login`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ userId: 'r1', password: 'pw' });
  });

  it('replays the captured sessionId as x-session-id on a following request', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { userId: 'r1' }, sessionId: 'sess-123' }))
      .mockResolvedValueOnce(jsonResponse([]));
    const model = createHttpModel();

    await model.login('r1', 'pw');
    await model.queryArticles({ department: 'Politics' });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles?department=Politics`);
    expect(init.method).toBe('GET');
    expect(init.headers['x-session-id']).toBe('sess-123');
  });

  it('does not send x-session-id before login', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse([]));
    const model = createHttpModel();

    await model.queryArticles({});

    const [, init] = lastCall();
    expect(init.headers).not.toHaveProperty('x-session-id');
  });

  it('login failure returns { ok:false } and stores no session', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: false }))
      .mockResolvedValueOnce(jsonResponse([]));
    const model = createHttpModel();

    const result = await model.login('bad', 'creds');
    expect(result).toEqual({ ok: false });

    // A following call must NOT carry a session header since login failed.
    await model.queryUsers({});
    const [, init] = lastCall();
    expect(init.headers).not.toHaveProperty('x-session-id');
  });

  it('logout clears the stored session', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: {}, sessionId: 'sess-xyz' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) // logout
      .mockResolvedValueOnce(jsonResponse([])); // following call
    const model = createHttpModel();

    await model.login('r1', 'pw');
    const result = await model.logout();
    expect(result).toEqual({ ok: true });

    // logout itself should POST to /api/logout
    const logoutCall = global.fetch.mock.calls[1];
    expect(logoutCall[0]).toBe(`${BASE}/api/logout`);
    expect(logoutCall[1].method).toBe('POST');

    // session must be cleared: the next request carries no x-session-id
    await model.queryArticles({});
    const [, init] = lastCall();
    expect(init.headers).not.toHaveProperty('x-session-id');
  });

  // --- Session restore on browser refresh (F5) -----------------------------
  it('login persists the sessionId so a fresh model (after F5) replays it', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { userId: 'r1' }, sessionId: 'sess-persist' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { userId: 'r1', role: 'R' } }));

    // First model logs in -> sessionId is written to sessionStorage.
    await createHttpModel().login('r1', 'pw');

    // Simulate a refresh: a brand-new model instance must pick the id up from storage.
    const restored = createHttpModel();
    const result = await restored.restoreSession();
    expect(result).toEqual({ ok: true, user: { userId: 'r1', role: 'R' } });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/session`);
    expect(init.method).toBe('GET');
    expect(init.headers['x-session-id']).toBe('sess-persist'); // replayed from storage after F5
  });

  it('restoreSession returns { ok:false } and makes no request when there is no stored session', async () => {
    const model = createHttpModel(); // sessionStorage cleared in beforeEach
    const result = await model.restoreSession();
    expect(result).toEqual({ ok: false });
    expect(global.fetch).not.toHaveBeenCalled(); // nothing to restore -> no /api/session call
  });

  it('restoreSession clears the stored id when the server reports the session expired', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: {}, sessionId: 'sess-stale' }))
      .mockResolvedValueOnce(jsonResponse({ ok: false })) // /api/session — server says expired/unknown
      .mockResolvedValueOnce(jsonResponse([])); // following call after the failed restore
    await createHttpModel().login('r1', 'pw');

    const restored = createHttpModel();
    const result = await restored.restoreSession();
    expect(result).toEqual({ ok: false });

    // The stale id must be purged: a following request carries no x-session-id.
    await restored.queryArticles({});
    const [, init] = lastCall();
    expect(init.headers).not.toHaveProperty('x-session-id');
  });

  it('logout clears the persisted session so a later refresh cannot restore it', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: {}, sessionId: 'sess-logout' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // logout
    const model = createHttpModel();
    await model.login('r1', 'pw');
    await model.logout();

    // A fresh model after the refresh has no persisted id -> restoreSession is a no-op { ok:false }.
    const after = createHttpModel();
    const result = await after.restoreSession();
    expect(result).toEqual({ ok: false });
  });

  it('saveArticle POSTs to /api/articles for a draft (falsy id and the A-DRAFT sentinel)', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ ok: true, articleId: 'A-0001' }));
    const model = createHttpModel();
    const dto = { content: 'hi', author: 'r1' };

    const r1 = await model.saveArticle('A-DRAFT', dto);
    expect(r1).toEqual({ ok: true, articleId: 'A-0001' });
    let [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(dto);

    await model.saveArticle('', dto); // falsy id also routes to POST
    [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles`);
    expect(init.method).toBe('POST');
  });

  // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK transport — holder는 로그인 세션(x-session-id 헤더)이므로 body 없음.
  it('lockArticle POSTs to /api/articles/:id/lock with NO sessionId body (session holder)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true, article: { articleId: 'A-100' } }));
    const model = createHttpModel();

    const result = await model.lockArticle('A-100');
    expect(result).toEqual({ ok: true, article: { articleId: 'A-100' } });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles/A-100/lock`);
    expect(init.method).toBe('POST');
    // body carries no page-scoped sessionId — the server derives the holder from x-session-id.
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('lockArticle surfaces { ok:false, reason } from the backend on conflict', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'locked' }));
    const model = createHttpModel();
    const result = await model.lockArticle('A-100');
    expect(result).toEqual({ ok: false, reason: 'locked' });
  });

  it('unlockArticle POSTs to /api/articles/:id/unlock with keepalive (beforeunload safe)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true, released: true }));
    const model = createHttpModel();

    const result = await model.unlockArticle('A-100');
    expect(result).toEqual({ ok: true, released: true });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles/A-100/unlock`);
    expect(init.method).toBe('POST');
    // keepalive guarantees the release flushes even while the document is unloading.
    expect(init.keepalive).toBe(true);
  });

  it('unlockArticle degrades to { ok:true, released:false } on network failure (idempotent)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const model = createHttpModel();
    const result = await model.unlockArticle('A-100');
    expect(result).toEqual({ ok: true, released: false });
  });

  it('saveArticle PUTs to /api/articles/:id for an existing id', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ ok: true, articleId: 'A-0007' }));
    const model = createHttpModel();
    const dto = { content: 'edit' };

    const result = await model.saveArticle('A-0007', dto);
    expect(result).toEqual({ ok: true, articleId: 'A-0007' });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles/A-0007`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(dto);
  });

  it('applyAction POSTs to /api/articles/:id/action with only { action } (role dropped)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true, status: 'DPS' }));
    const model = createHttpModel();

    const result = await model.applyAction('A-0007', 'D', 'send');
    expect(result).toEqual({ ok: true, status: 'DPS' });

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/articles/A-0007/action`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ action: 'send' });
    expect(JSON.parse(init.body)).not.toHaveProperty('role');
  });

  it('applyAction includes the page lock sessionId in the body when provided (edit context)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true, status: 'DPS' }));
    const model = createHttpModel();

    await model.applyAction('A-0007', 'D', 'send', { sessionId: 'P-EDIT' });

    const [, init] = lastCall();
    // AC-EDIT-LOCK-6: 서버 action 라우트의 락 게이트가 보유자를 식별하도록 페이지 sessionId가 실린다.
    expect(JSON.parse(init.body)).toEqual({ action: 'send', sessionId: 'P-EDIT' });
  });

  it('queryUsers degrades to [] when the backend returns { ok:false } (unauthenticated)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'unauthenticated' }));
    const model = createHttpModel();

    const rows = await model.queryUsers({});
    expect(rows).toEqual([]);
  });

  it('searchMedia returns { items:[], error:true } on a network rejection', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const model = createHttpModel();

    const result = await model.searchMedia('cats', 'video');
    expect(result).toEqual({ items: [], error: true });
  });

  it('searchMedia(query, "image") requests the proxy with type=image (Google Images route)', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ items: [{ source: 'google', title: 'G', url: 'https://g/x' }], error: false }),
    );
    const model = createHttpModel();

    const result = await model.searchMedia('flood', 'image');
    expect(result).toEqual({ items: [{ source: 'google', title: 'G', url: 'https://g/x' }], error: false });

    const [url] = lastCall();
    expect(url).toContain('/api/media/search?q=flood');
    expect(url).toContain('type=image');
  });

  it('searchMedia(query, "video") requests the proxy with type=video (YouTube route)', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ items: [{ source: 'youtube', title: 'YT', url: 'https://youtu.be/x' }], error: false }),
    );
    const model = createHttpModel();

    const result = await model.searchMedia('flood', 'video');
    expect(result).toEqual({ items: [{ source: 'youtube', title: 'YT', url: 'https://youtu.be/x' }], error: false });

    const [url] = lastCall();
    expect(url).toContain('/api/media/search?q=flood');
    expect(url).toContain('type=video');
  });

  it('searchMedia with no type defaults to type=video on the request URL', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ items: [], error: true }));
    const model = createHttpModel();

    await model.searchMedia('cats');

    const [url] = lastCall();
    expect(url).toContain('type=video');
  });

  it('queryArticles returns [] on a network rejection (safe default)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const model = createHttpModel();

    const rows = await model.queryArticles({ department: 'Economy' });
    expect(rows).toEqual([]);
  });

  it('applyAction returns the documented safe default on a network rejection', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const model = createHttpModel();

    const result = await model.applyAction('A-1', 'R', 'kill');
    expect(result).toEqual({ ok: false, reason: 'network-error' });
  });

  it('searchArticles encodes the query and returns the array', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse([{ id: 'A-1' }]));
    const model = createHttpModel();

    const rows = await model.searchArticles('hello world');
    expect(rows).toEqual([{ id: 'A-1' }]);
    const [url] = lastCall();
    expect(url).toBe(`${BASE}/api/articles/search?q=hello%20world`);
  });

  it('honors a baseUrl override', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse([]));
    const model = createHttpModel({ baseUrl: 'http://example.test:9000' });

    await model.queryArticles({});
    const [url] = lastCall();
    expect(url).toBe('http://example.test:9000/api/articles');
  });

  // 새로고침(F5) 유지: sessionId를 sessionStorage('tech_day.sessionId')에 영속화/복원/삭제한다.
  // httpModel.js는 loadPersistedSessionId(부트 복원)/persistSessionId(login 저장·logout 삭제)를
  // 이미 구현한다. jsdom은 sessionStorage를 제공하므로 직접 단언한다(격리는 setup.js afterEach가 clear).
  describe('sessionId 영속화 (sessionStorage)', () => {
    const SESSION_ID_KEY = 'tech_day.sessionId';

    it('login 성공 시 sessionId를 sessionStorage에 저장한다', async () => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, user: { userId: 'r1' }, sessionId: 'sess-persist' }),
      );
      const model = createHttpModel();
      await model.login('r1', 'pw');
      expect(sessionStorage.getItem(SESSION_ID_KEY)).toBe('sess-persist');
    });

    it('부팅 시 sessionStorage의 sessionId를 복원해 x-session-id로 재생한다 (새로고침 복원)', async () => {
      // 새로고침 직후처럼 sessionStorage에 세션이 남아있는 상태에서 새 모델 인스턴스를 만든다.
      sessionStorage.setItem(SESSION_ID_KEY, 'sess-restored');
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ department: 'Politics' });
      const [, init] = lastCall();
      expect(init.headers['x-session-id']).toBe('sess-restored');
    });

    it('logout 시 sessionStorage의 sessionId를 제거한다', async () => {
      sessionStorage.setItem(SESSION_ID_KEY, 'sess-bye');
      global.fetch.mockResolvedValueOnce(jsonResponse({ ok: true })); // logout
      const model = createHttpModel();

      await model.logout();
      expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();
    });

    it('login 실패 시 sessionStorage에 sessionId를 저장하지 않는다', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse({ ok: false }));
      const model = createHttpModel();
      await model.login('bad', 'creds');
      expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();
    });
  });

  describe('toQueryString array serialization', () => {
    it('serializes a status array as repeated params: status=RDS&status=DDH', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ status: ['RDS', 'DDH'] });
      const [url] = lastCall();
      expect(url).toBe(`${BASE}/api/articles?status=RDS&status=DDH`);
    });

    it('serializes author+status array as AND repeated params', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ author: 'u1', status: ['RRK', 'RDS'] });
      const [url] = lastCall();
      // URLSearchParams preserves insertion order: author first, then repeated status
      expect(url).toBe(`${BASE}/api/articles?author=u1&status=RRK&status=RDS`);
    });

    it('serializes a scalar status as a single param (regression)', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ status: 'DPS' });
      const [url] = lastCall();
      expect(url).toBe(`${BASE}/api/articles?status=DPS`);
    });

    it('skips null/undefined array elements', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ status: ['RDS', null, undefined, 'DDH'] });
      const [url] = lastCall();
      expect(url).toBe(`${BASE}/api/articles?status=RDS&status=DDH`);
    });

    it('empty array produces no query param for that key', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse([]));
      const model = createHttpModel();

      await model.queryArticles({ status: [], department: 'Politics' });
      const [url] = lastCall();
      expect(url).toBe(`${BASE}/api/articles?department=Politics`);
    });
  });

  describe('subscribe (SSE)', () => {
    let originalEventSource;

    beforeEach(() => {
      originalEventSource = global.EventSource;
    });

    afterEach(() => {
      global.EventSource = originalEventSource;
    });

    it('opens an EventSource, parses change events, and reports connected/unsubscribe', () => {
      const listeners = {};
      const closeSpy = vi.fn();
      class FakeEventSource {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 1; // OPEN
          this.addEventListener = (type, cb) => {
            listeners[type] = cb;
          };
          this.close = closeSpy;
        }
      }
      global.EventSource = FakeEventSource;

      const model = createHttpModel();
      const onChange = vi.fn();
      const sub = model.subscribe({ menu: 'x' }, onChange);

      expect(sub.connected).toBe(true);

      // Simulate a server-pushed change event.
      listeners.change({ data: JSON.stringify({ articles: [{ id: 'A-1' }] }) });
      expect(onChange).toHaveBeenCalledWith({ articles: [{ id: 'A-1' }] });

      sub.unsubscribe();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('wires open/error to connected payloads so the status bar tracks the transport', () => {
      const listeners = {};
      class FakeEventSource {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.addEventListener = (type, cb) => {
            listeners[type] = cb;
          };
          this.close = vi.fn();
        }
      }
      global.EventSource = FakeEventSource;

      const model = createHttpModel();
      const onChange = vi.fn();
      model.subscribe({}, onChange);

      listeners.open();
      expect(onChange).toHaveBeenCalledWith({ connected: true });
      listeners.error();
      expect(onChange).toHaveBeenCalledWith({ connected: false });
    });

    it('returns a no-op subscription when EventSource is unavailable', () => {
      global.EventSource = undefined;
      const model = createHttpModel();
      const sub = model.subscribe({}, vi.fn());

      expect(sub.connected).toBe(false);
      expect(() => sub.unsubscribe()).not.toThrow();
    });
  });
});
