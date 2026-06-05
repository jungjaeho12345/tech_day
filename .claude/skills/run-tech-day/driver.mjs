#!/usr/bin/env node
// run-tech-day driver — boots the REAL Express app (server/index.js `createApp`) on an
// ephemeral port backed by an in-memory SQLite DB, then drives a full end-to-end HTTP flow
// with the built-in fetch client. It exercises the exact same app code that `node server/index.js`
// serves on :3001, but never touches the production `news.db`
// (CLAUDE.md HARD rule: DB 내용은 삭제하지 않는다).
//
// Why in-memory: the production bootstrap hardcodes news.db and has no DB-path override, so
// driving the live :3001 server would create test rows in the real DB. Booting createApp here
// against ':memory:' gives the genuine request/response/SSE stack with zero pollution.
//
// Usage:   node .claude/skills/run-tech-day/driver.mjs
// Exit 0 = every step passed; non-zero = a step failed (which one is printed).
//
// Imports resolve relative to THIS file, so it runs from any cwd.
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../../../src/db/schema.js';
import { createControllers } from '../../../src/controllers/index.js';
import { createSessionService } from '../../../src/services/sessionService.js';
import { createApp } from '../../../server/index.js';

let passed = 0;
const ok = (label) => { passed += 1; console.log(`  ✓ ${label}`); };
const check = (cond, label, detail) => {
  if (cond) { ok(label); return; }
  process.exitCode = 1;
  throw new Error(`${label}${detail ? ` -> ${detail}` : ''}`);
};

const J = { 'content-type': 'application/json' };

// --- boot the real app on an ephemeral port, isolated in-memory DB ---
const db = new DatabaseSync(':memory:');
createSchema(db);
const sessions = createSessionService();
const controllers = createControllers(db, { sessionService: sessions });
const app = createApp({ controllers, sessionService: sessions });
const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`\n[run-tech-day] real app booted on ${base} (in-memory DB, news.db untouched)\n`);

let sid; // server-issued session id, replayed as x-session-id (mirrors web/src/model/httpModel.js)
let sseAbort; // AbortController for the SSE connection, torn down in finally
const authHeaders = () => ({ ...J, 'x-session-id': sid });

try {
  // 1. health
  {
    const r = await fetch(`${base}/api/health`);
    const b = await r.json();
    check(r.status === 200 && b.ok === true, 'GET /api/health -> 200 {ok:true}');
  }

  // 2. seed a desk (D) user. User creation over HTTP is Z-gated, so seed via the controller layer.
  controllers.user.create({ userId: 'desk1', name: '데스크', password: 'pw', role: 'D', department: '정치부' });
  ok('seeded user desk1 (role D) via controller');

  // 3. login -> sessionId (POST /api/login)
  {
    const r = await fetch(`${base}/api/login`, {
      method: 'POST', headers: J, body: JSON.stringify({ userId: 'desk1', password: 'pw' }),
    });
    const b = await r.json();
    sid = b.sessionId;
    check(b.ok === true && Boolean(sid), 'POST /api/login -> ok + sessionId', JSON.stringify(b));
  }

  // 4. create an article (session-gated R/D/Z)
  let articleId;
  {
    const r = await fetch(`${base}/api/articles`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title: '속보: run-tech-day 드라이버 점검', author: '데스크', department: '정치부' }),
    });
    const b = await r.json();
    articleId = b.articleId;
    check(b.ok === true && Boolean(articleId), 'POST /api/articles -> ok + articleId', JSON.stringify(b));
  }

  // 5. query it back (metadata filter)
  {
    const r = await fetch(`${base}/api/articles?articleId=${articleId}`);
    const b = await r.json();
    check(Array.isArray(b) && b.length === 1 && b[0].status === 'RDS',
      'GET /api/articles?articleId= -> 1 row, status RDS', JSON.stringify(b));
  }

  // 6. lifecycle action: D + send on an RDS article -> DPS (news.md 기사 생애주기)
  {
    const r = await fetch(`${base}/api/articles/${articleId}/action`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'send' }),
    });
    const b = await r.json();
    check(b.ok === true && b.status === 'DPS', 'POST /api/articles/:id/action {send} -> DPS', JSON.stringify(b));
  }

  // 7. edit lock: acquire -> a second session is blocked (409) -> holder releases (ContentsVO LockYN)
  {
    const r1 = await fetch(`${base}/api/articles/${articleId}/lock`, { method: 'POST', headers: authHeaders() });
    const b1 = await r1.json();
    check(r1.status === 200 && b1.ok === true && b1.article.LockYN === 'Y',
      'POST /api/articles/:id/lock -> LockYN Y', JSON.stringify(b1));

    const otherSid = sessions.createSession({ userId: 'reporter1', role: 'R' }).sessionId;
    const r2 = await fetch(`${base}/api/articles/${articleId}/lock`, {
      method: 'POST', headers: { ...J, 'x-session-id': otherSid },
    });
    check(r2.status === 409, 'second session lock -> 409 conflict (no duplicate edit)');

    const r3 = await fetch(`${base}/api/articles/${articleId}/unlock`, { method: 'POST', headers: authHeaders() });
    const b3 = await r3.json();
    check(b3.ok === true && b3.released === true, 'POST /api/articles/:id/unlock -> released');
  }

  // 8. realtime SSE: open the stream, see the ready frame, then a fresh create must broadcast a change
  {
    const ac = new AbortController();
    sseAbort = ac;
    const res = await fetch(`${base}/api/stream`, { signal: ac.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const nextFrame = async () => {
      for (;;) {
        const i = buf.indexOf('\n\n');
        if (i !== -1) {
          const raw = buf.slice(0, i); buf = buf.slice(i + 2);
          let ev = 'message'; let data = '';
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) ev = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          return { ev, data };
        }
        const { value, done } = await reader.read();
        if (done) return null;
        buf += dec.decode(value, { stream: true });
      }
    };
    const withTimeout = (p, ms, l) => {
      let t;
      return Promise.race([
        p,
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`SSE timeout: ${l}`)), ms); t.unref?.(); }),
      ]).finally(() => clearTimeout(t));
    };

    const ready = await withTimeout(nextFrame(), 3000, 'ready');
    check(ready.ev === 'ready', 'GET /api/stream -> ready frame');

    await fetch(`${base}/api/articles`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: 'SSE 트리거 기사' }),
    });
    const change = await withTimeout(nextFrame(), 3000, 'change');
    const payload = JSON.parse(change.data);
    check(change.ev === 'change' && payload.type === 'create' && payload.status === 'RDS',
      'SSE broadcasts a change frame on article create', change.data);

    ac.abort();
    await reader.cancel().catch(() => {});
  }

  console.log(`\n[run-tech-day] PASS — ${passed} checks green\n`);
} catch (err) {
  console.error(`\n[run-tech-day] FAIL: ${err.message}\n`);
} finally {
  // Tear down explicitly and let the event loop drain — do NOT call process.exit() here:
  // forcing exit while the SSE socket/server handle is still closing crashes libuv on Windows
  // (Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), async.c). Aborting the SSE stream
  // and force-closing all sockets lets Node exit cleanly with process.exitCode.
  sseAbort?.abort();
  server.closeAllConnections?.();
  server.close();
}
