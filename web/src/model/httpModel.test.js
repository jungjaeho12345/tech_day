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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('queryUsers degrades to [] when the backend returns { ok:false } (unauthenticated)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'unauthenticated' }));
    const model = createHttpModel();

    const rows = await model.queryUsers({});
    expect(rows).toEqual([]);
  });

  it('searchMedia returns { items:[], error:true } on a network rejection', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const model = createHttpModel();

    const result = await model.searchMedia('cats');
    expect(result).toEqual({ items: [], error: true });
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

    it('returns a no-op subscription when EventSource is unavailable', () => {
      global.EventSource = undefined;
      const model = createHttpModel();
      const sub = model.subscribe({}, vi.fn());

      expect(sub.connected).toBe(false);
      expect(() => sub.unsubscribe()).not.toThrow();
    });
  });
});
