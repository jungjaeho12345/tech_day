// Security-hardening tests for server/index.js from the 2026-06-09 code/security review:
//   - M-2: `trust proxy` is configured so the login rate-limiter keys on the real client IP
//          (X-Forwarded-For) behind a reverse proxy, configurable via TRUST_PROXY.
//   - L-1: CSP drops 'unsafe-inline' from style-src (blocks injected <style> / CSS-injection) while
//          keeping it on style-src-attr (so the SPA's React inline style attributes still work).
//
// Drives the real Express app via createApp. No production news.db is touched (in-memory only).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';
import { createSessionService } from '../src/services/sessionService.js';
import { createApp } from '../server/index.js';

// Minimal real wiring just to stand the app up; only /api/health (no controller access) is exercised.
function buildApp() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const sessionService = createSessionService();
  const media = { search: async () => ({ items: [], error: false }) };
  const controllers = createControllers(db, { mediaSearch: media, sessionService });
  return createApp({ controllers, sessionService });
}

// Parse a Content-Security-Policy header value into { directive: [tokens...] }.
function parseCsp(header) {
  const map = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const [name, ...tokens] = trimmed.split(/\s+/);
    map[name] = tokens;
  }
  return map;
}

let server;
let base;

before(async () => {
  const app = buildApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

// --- L-1 -------------------------------------------------------------------
test('L-1: CSP style-src no longer allows unsafe-inline (blocks injected <style>)', async () => {
  const res = await fetch(`${base}/api/health`);
  const header = res.headers.get('content-security-policy');
  assert.ok(header, 'CSP header should be present (helmet)');
  const csp = parseCsp(header);
  assert.deepEqual(csp['style-src'], ["'self'"], "style-src should be exactly 'self'");
  assert.ok(!csp['style-src'].includes("'unsafe-inline'"), "style-src must not contain 'unsafe-inline'");
});

test('L-1: CSP keeps unsafe-inline on style-src-attr (React inline style attributes still work)', async () => {
  const res = await fetch(`${base}/api/health`);
  const csp = parseCsp(res.headers.get('content-security-policy'));
  assert.ok(csp['style-src-attr'], 'style-src-attr directive should be present');
  assert.ok(
    csp['style-src-attr'].includes("'unsafe-inline'"),
    "style-src-attr must keep 'unsafe-inline' so inline style attributes (e.g. ContextMenu top/left) work",
  );
});

// --- M-2 -------------------------------------------------------------------
test('M-2: trust proxy defaults to 1 (single reverse proxy)', () => {
  const saved = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  try {
    const app = buildApp();
    assert.equal(app.get('trust proxy'), 1);
  } finally {
    if (saved !== undefined) process.env.TRUST_PROXY = saved;
  }
});

test('M-2: TRUST_PROXY env overrides the hop count (incl. 0 for direct exposure)', () => {
  const saved = process.env.TRUST_PROXY;
  try {
    process.env.TRUST_PROXY = '2';
    assert.equal(buildApp().get('trust proxy'), 2);
    process.env.TRUST_PROXY = '0';
    assert.equal(buildApp().get('trust proxy'), 0);
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
});

test('M-2: non-numeric TRUST_PROXY falls back to the safe default of 1', () => {
  const saved = process.env.TRUST_PROXY;
  try {
    process.env.TRUST_PROXY = 'not-a-number';
    assert.equal(buildApp().get('trust proxy'), 1);
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
});
