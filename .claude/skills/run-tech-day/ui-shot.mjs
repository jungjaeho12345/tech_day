#!/usr/bin/env node
// run-tech-day UI harness — drives the REAL React UI in headless Chrome and writes screenshots.
//
// It boots the genuine app the same way driver.mjs does (server/index.js `createApp` over an
// in-memory SQLite DB, news.db untouched — CLAUDE.md HARD rule: DB 내용은 삭제하지 않는다), then:
//   1. seeds a known login (desk1 / pw, role D) + two RDS articles so the pages have content,
//   2. serves the prebuilt frontend (web/dist) on :5173 (the only origin CORS allows),
//   3. launches headless Chrome with the DevTools Protocol (no extra deps — Node's global
//      WebSocket + fetch are the CDP client),
//   4. screenshots login.do, logs in via the real form, screenshots writer.do and list.do.
//
// PREREQUISITE: run `npm run build` first (produces web/dist). The harness prints a clear error
// if the bundle is missing.
//
// Usage:   node .claude/skills/run-tech-day/ui-shot.mjs
//          CHROME=/path/to/chrome node .claude/skills/run-tech-day/ui-shot.mjs   # override chrome
// Output:  .claude/skills/run-tech-day/screenshots/{login,write,view}.png
// Exit 0 = all three screenshots written; non-zero = a step failed (which one is printed).
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import express from 'express';

import { createSchema } from '../../../src/db/schema.js';
import { createControllers } from '../../../src/controllers/index.js';
import { createSessionService } from '../../../src/services/sessionService.js';
import { createApp } from '../../../server/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const DIST = path.join(ROOT, 'web', 'dist');
const SHOTS = path.join(HERE, 'screenshots');
const FRONT_PORT = 5173; // CORS in server/index.js only allows :5173
const API_PORT = 3001; // httpModel default base is http://127.0.0.1:3001

const CHROME = process.env.CHROME
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function findChrome() {
  const candidates = [
    CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return candidates.find((c) => existsSync(c));
}

// ---- minimal CDP client over the built-in WebSocket (no npm deps) --------------------
function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const waiters = []; // [{ method, resolve }]
  let nextId = 1;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error)})`)) : resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (waiters[i].method === msg.method) { waiters.splice(i, 1)[0].resolve(msg.params); }
      }
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('CDP WebSocket error')));
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    waitEvent(method, ms = 10000) {
      return new Promise((resolve, reject) => {
        const w = { method, resolve };
        waiters.push(w);
        const t = setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i !== -1) waiters.splice(i, 1);
          reject(new Error(`CDP event timeout: ${method}`));
        }, ms);
        t.unref?.();
      });
    },
    close() { try { ws.close(); } catch { /* noop */ } },
  };
}

const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); t.unref?.(); });

async function main() {
  if (!existsSync(DIST)) {
    throw new Error(`web/dist not found — run "npm run build" first (expected ${DIST})`);
  }
  mkdirSync(SHOTS, { recursive: true });

  // --- boot the real backend on :3001, isolated in-memory DB, seeded content -------------
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const sessions = createSessionService();
  const controllers = createControllers(db, { sessionService: sessions });
  controllers.user.create({ userId: 'desk1', name: '데스크', password: 'pw', role: 'D', department: '정치부' });
  controllers.article.create({ title: '[속보] 데모 기사 하나', author: '데스크', department: '정치부' });
  controllers.article.create({ title: '[종합] 데모 기사 둘', author: '데스크', department: '정치부' });
  const apiApp = createApp({ controllers, sessionService: sessions });
  const apiServer = await new Promise((res) => { const s = apiApp.listen(API_PORT, () => res(s)); });

  // --- serve the prebuilt frontend on :5173 with SPA fallback ----------------------------
  const web = express();
  web.use(express.static(DIST));
  web.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
  const webServer = await new Promise((res) => { const s = web.listen(FRONT_PORT, () => res(s)); });
  console.log(`[ui-shot] api :${API_PORT} (in-memory, news.db untouched) | web :${FRONT_PORT} (web/dist)`);

  // --- launch headless Chrome with remote debugging -------------------------------------
  const chromeBin = findChrome();
  if (!chromeBin) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'rtd-chrome-'));
  const port = 9333;
  const chrome = spawn(chromeBin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1366,900', 'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  try {
    // discover the page target's WebSocket URL
    let target;
    for (let i = 0; i < 50 && !target; i += 1) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch { /* chrome still starting */ }
    }
    if (!target) throw new Error('Chrome DevTools endpoint never came up');

    cdp = cdpConnect(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1366, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(SHOTS, `${name}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`  ✓ ${name}.png`);
    };
    const goto = async (urlPath) => {
      const loaded = cdp.waitEvent('Page.loadEventFired', 15000);
      await cdp.send('Page.navigate', { url: `http://localhost:${FRONT_PORT}${urlPath}` });
      await loaded;
      await sleep(700); // let React mount + first data fetch settle
    };
    // Set a React controlled input's value via the native setter, then fire `input` so React sees it.
    const setReactInput = (selector, value) => cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return 'no-el:' + ${JSON.stringify(selector)};
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      })()`,
      returnByValue: true,
    });
    const evalText = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

    // 1. login page
    await goto('/login.do');
    const hasForm = await evalText("!!document.querySelector('#login-userId')");
    if (!hasForm) throw new Error('login form (#login-userId) not rendered');
    await shot('login');

    // 2. fill the real form + submit
    await setReactInput('#login-userId', 'desk1');
    await setReactInput('#login-password', 'pw');
    await cdp.send('Runtime.evaluate', {
      expression: "document.querySelector('form').requestSubmit()",
    });
    // wait until the write page nav appears (login succeeded + navigate to writer.do)
    let onWrite = false;
    for (let i = 0; i < 40 && !onWrite; i += 1) {
      await sleep(200);
      onWrite = await evalText("location.pathname === '/writer.do' && /기사 작성/.test(document.body.innerText)");
    }
    if (!onWrite) {
      const alert = await evalText("(document.querySelector('[role=alert]')||{}).innerText || ''");
      throw new Error(`login did not reach writer.do${alert ? ` (alert: ${alert})` : ''}`);
    }
    await sleep(500);
    await shot('write');

    // 3. article list page — navigate IN-APP (click the nav link), not a full page load.
    // A full Page.navigate reloads the bundle and resets the React `user` state, bouncing the
    // auth guard back to login. The SPA nav link uses history.pushState and keeps the session.
    const clicked = await evalText(`(() => {
      const a = [...document.querySelectorAll('a.yh-nav__link')].find(el => /기사 조회/.test(el.textContent));
      if (!a) return false;
      a.click();
      return true;
    })()`);
    if (!clicked) throw new Error('기사 조회 nav link not found on write page');
    let onView = false;
    for (let i = 0; i < 40 && !onView; i += 1) {
      await sleep(200);
      onView = await evalText("location.pathname === '/list.do' && /데스크 미송고/.test(document.body.innerText)");
    }
    if (!onView) throw new Error('did not reach list.do (data-grid not rendered)');
    await sleep(500);
    await shot('view');

    console.log('\n[ui-shot] PASS — 3 screenshots in .claude/skills/run-tech-day/screenshots/\n');
  } finally {
    cdp?.close();
    chrome.kill();
    apiServer.closeAllConnections?.();
    apiServer.close();
    webServer.closeAllConnections?.();
    webServer.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

main().catch((err) => {
  console.error(`\n[ui-shot] FAIL: ${err.message}\n`);
  process.exitCode = 1;
});
