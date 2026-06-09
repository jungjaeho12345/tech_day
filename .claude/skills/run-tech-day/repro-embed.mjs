#!/usr/bin/env node
// Temporary repro harness for the two contentEditable editor regression bugs (SPEC-NEWS-REVISE).
// Boots the real backend (in-memory DB) + serves web/dist, drives headless Chrome via CDP, logs in,
// then in writer.do exercises:
//   BUG 1 (caret-first-line): type text, insert an embed via the "삽입" button, assert the live
//          selection sits right AFTER the inserted embed span (not at editor offset 0 / first line).
//   BUG 2 (3x paste blanks): dispatch a real `paste` event carrying a YouTube URL three times and
//          assert the editor innerHTML never becomes empty + no React console error/exception.
//
// Exit 0 only when BOTH checks pass. Prints PASS/FAIL per bug. Uses a non-default port so the running
// dev server on :3001/:5173 is untouched.
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
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
const FRONT_PORT = 5275; // non-default — avoid the running dev server on 5173
const API_PORT = 3275;   // non-default — avoid the running api on 3001

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
function findChrome() {
  const candidates = [
    CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return candidates.find((c) => existsSync(c));
}

function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const waiters = [];
  const consoleErrors = [];
  const exceptions = [];
  let nextId = 1;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails?.exception?.description
          || msg.params.exceptionDetails?.text || 'exception');
      }
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (waiters[i].method === msg.method) waiters.splice(i, 1)[0].resolve(msg.params);
      }
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('CDP WebSocket error')));
  });
  return {
    ready, consoleErrors, exceptions,
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
  if (!existsSync(DIST)) throw new Error(`web/dist not found — run "npm run build" first (${DIST})`);

  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const sessions = createSessionService();
  // Stub media provider so the 영상/이미지 tab "삽입" buttons appear (real button path for BUG 1).
  const stubMedia = {
    async search() {
      return {
        items: [
          { source: 'youtube', title: '데모 영상 A', url: 'https://www.youtube.com/watch?v=demoA',
            thumbnailUrl: 'https://i.ytimg.com/vi/demoA/default.jpg' },
        ],
        error: false,
      };
    },
  };
  const controllers = createControllers(db, { sessionService: sessions, mediaSearch: stubMedia });
  controllers.user.create({ userId: 'desk1', name: '데스크', password: 'pw', role: 'D', department: '정치부' });
  const apiApp = createApp({ controllers, sessionService: sessions });
  const apiServer = await new Promise((res) => { const s = apiApp.listen(API_PORT, () => res(s)); });

  const { readFileSync } = await import('node:fs');
  const http = await import('node:http');
  const web = express();
  // Same-origin strategy (avoids CORS, which the API restricts to :5173): rewrite the bundle's API base
  // (http://127.0.0.1:3001) to an EMPTY string so all calls become same-origin relative ('/api/...'),
  // then proxy every /api request (incl. the SSE /api/stream) to our isolated in-memory API server.
  web.get('/assets/*', (req, res, next) => {
    const fsPath = path.join(DIST, req.path);
    if (!fsPath.endsWith('.js')) return next();
    try {
      let js = readFileSync(fsPath, 'utf8');
      js = js.split('http://127.0.0.1:3001').join('')
             .split('http://localhost:3001').join('');
      res.type('application/javascript').send(js);
    } catch (e) { next(e); }
  });
  web.use('/api', (req, res) => {
    const proxyReq = http.request(
      { host: '127.0.0.1', port: API_PORT, path: req.originalUrl, method: req.method, headers: req.headers },
      (proxyRes) => { res.writeHead(proxyRes.statusCode, proxyRes.headers); proxyRes.pipe(res); },
    );
    proxyReq.on('error', () => { try { res.sendStatus(502); } catch { /* noop */ } });
    req.pipe(proxyReq);
  });
  web.use(express.static(DIST));
  web.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
  const webServer = await new Promise((res) => { const s = web.listen(FRONT_PORT, () => res(s)); });
  console.log(`[repro] api :${API_PORT} | web :${FRONT_PORT}`);

  const chromeBin = findChrome();
  if (!chromeBin) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'repro-chrome-'));
  const port = 9444;
  const chrome = spawn(chromeBin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1366,900', 'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  let bug1Pass = false;
  let bug2Pass = false;
  try {
    let target;
    for (let i = 0; i < 50 && !target; i += 1) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch { /* starting */ }
    }
    if (!target) throw new Error('Chrome DevTools endpoint never came up');
    cdp = cdpConnect(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const evalJson = async (expr) => (await cdp.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    })).result.value;
    const setReactInput = (selector, value) => cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return 'no-el';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      })()`, returnByValue: true,
    });
    const goto = async (urlPath) => {
      const loaded = cdp.waitEvent('Page.loadEventFired', 15000);
      await cdp.send('Page.navigate', { url: `http://localhost:${FRONT_PORT}${urlPath}` });
      await loaded; await sleep(700);
    };

    // login
    await goto('/login.do');
    await setReactInput('#login-userId', 'desk1');
    await setReactInput('#login-password', 'pw');
    await cdp.send('Runtime.evaluate', { expression: "document.querySelector('form').requestSubmit()" });
    let onWrite = false;
    for (let i = 0; i < 40 && !onWrite; i += 1) {
      await sleep(200);
      onWrite = await evalJson("location.pathname === '/writer.do' && /기사 작성/.test(document.body.innerText)");
    }
    if (!onWrite) throw new Error('login did not reach writer.do');
    await sleep(400);

    // ---------------- BUG 1: caret jumps to first line after embed insert (REAL 삽입 button path) ----------------
    // Type a multi-line body so "first line" (offset 0) is clearly distinct from the caret target.
    await evalJson(`(() => {
      const el = document.querySelector('[data-testid=editor-body]');
      el.focus();
      document.execCommand('insertText', false, 'title line\\nbody one body two');
      return el.textContent;
    })()`);
    await sleep(150);
    // Put caret at the very end and fire keyup so the controller records lastCaretRef (button path reads it).
    await evalJson(`(() => {
      const el = document.querySelector('[data-testid=editor-body]');
      el.focus();
      const sel = getSelection(); const r = document.createRange();
      r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowRight' }));
      return 'caret-end';
    })()`);
    await sleep(120);
    // Open the 영상 tab, run the search (stub returns 1 result), then click its "삽입" button — the REAL
    // reported trigger for bug 1 (the button click blurs the editor, then the repaint refocuses + places caret).
    await evalJson(`(() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find(b => /영상/.test(b.textContent));
      tab && tab.click(); return 'tab';
    })()`);
    await sleep(150);
    await evalJson(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '검색');
      btn && btn.click(); return 'search';
    })()`);
    await sleep(400);
    const inserted = await evalJson(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /^삽입/.test(b.textContent.trim()));
      if (!btn) return 'no-insert-button';
      btn.click(); return 'inserted';
    })()`);
    if (inserted !== 'inserted') throw new Error('삽입 button not found: ' + inserted);
    await sleep(500);
    // GROUND TRUTH: type a sentinel char via a REAL key press through CDP (Input.insertText respects the
    // browser's actual caret + editability rules, exactly like user typing). If the caret really sits in an
    // editable spot after the embed, the char lands after the last embed span. If Chrome dropped the input
    // (caret stuck after a non-editable trailing span) or relocated to start, the char is missing / at start.
    await evalJson(`(() => { document.querySelector('[data-testid=editor-body]').focus(); return 'f'; })()`);
    await cdp.send('Input.insertText', { text: '❖' });
    await sleep(120);
    const caretReport = await evalJson(`(() => {
      const el = document.querySelector('[data-testid=editor-body]');
      const spans = [...el.querySelectorAll('[data-embed-index]')];
      const last = spans[spans.length - 1];
      const txt = el.textContent || '';
      const sentinelIdx = txt.indexOf('❖');
      // index of the body text (excluding embed-internal text) just to report a preview
      // Determine if sentinel sits AFTER the last embed span in document order.
      let afterEmbed = false;
      if (last) {
        let n = last.nextSibling;
        while (n && !afterEmbed) {
          if (n.nodeType === 3 && n.textContent.includes('❖')) afterEmbed = true;
          else if (n.nodeType === 1 && n.textContent.includes('❖')) afterEmbed = true;
          n = n.nextSibling;
        }
      }
      // Did it land at the very start (before everything)? bug-1 symptom.
      const atStart = txt.indexOf('❖') === 0
        || /^[❖]/.test(txt);
      return { ok:true, embedCount: spans.length, afterEmbed, atStart, sentinelIdx,
               preview: txt.slice(0, 30) };
    })()`);
    bug1Pass = caretReport.ok && caretReport.embedCount >= 1 && caretReport.afterEmbed && !caretReport.atStart;
    console.log(`[repro] BUG1 caret-after-embed: ${bug1Pass ? 'PASS' : 'FAIL'} ->`, JSON.stringify(caretReport));

    // ---------------- BUG 2: three consecutive pastes blank the editor ----------------
    // Reset to a fresh editor by reloading writer.do (fresh draft).
    await goto('/writer.do');
    let ready2 = false;
    for (let i = 0; i < 40 && !ready2; i += 1) {
      await sleep(150);
      ready2 = await evalJson("!!document.querySelector('[data-testid=editor-body]')");
    }
    await sleep(300);
    await evalJson(`(() => {
      const el = document.querySelector('[data-testid=editor-body]');
      el.focus();
      document.execCommand('insertText', false, 'seed body');
      return el.textContent;
    })()`);
    await sleep(150);
    const states = [];
    for (let k = 0; k < 3; k += 1) {
      // Faithful paste: focus the editor, type a real character (so onInput pushes new bodyText + a real
      // caret), THEN paste a YouTube URL via a genuine paste event. This mirrors a user who types, pastes,
      // types, pastes… The interleaving of onInput (model update + re-render) with the paste-triggered
      // repaint(caret-after-embed → el.focus) is the race the report describes.
      await evalJson(`(() => { document.querySelector('[data-testid=editor-body]').focus(); return 'f'; })()`);
      await cdp.send('Input.insertText', { text: ' word' + k + ' ' });
      await sleep(120);
      await evalJson(`(() => {
        const el = document.querySelector('[data-testid=editor-body]');
        el.focus();
        const dt = new DataTransfer();
        dt.setData('text', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
        return 'paste' + ${k};
      })()`);
      await sleep(450);
      const st = await evalJson(`(() => {
        const el = document.querySelector('[data-testid=editor-body]');
        return { html: (el.innerHTML||'').length, text: (el.textContent||''),
                 bodyLen: (el.innerText||'').length,
                 embeds: el.querySelectorAll('[data-embed-index]').length,
                 empty: (el.innerHTML||'').trim() === '' || el.querySelectorAll('[data-embed-index]').length === 0 };
      })()`);
      states.push(st);
    }
    const anyBlank = states.some((s) => s.empty);
    const crashed = cdp.exceptions.length > 0
      || cdp.consoleErrors.some((m) => /Minified React error|Cannot read|is not a function|removeChild|insertBefore|NotFoundError/i.test(m));
    bug2Pass = !anyBlank && !crashed && states[2].embeds === 3;
    console.log(`[repro] BUG2 three-paste-not-blank: ${bug2Pass ? 'PASS' : 'FAIL'} ->`, JSON.stringify(states));
    if (crashed) console.log('[repro]   console/exceptions:', JSON.stringify({ ex: cdp.exceptions, err: cdp.consoleErrors }));

    console.log(`\n[repro] RESULT  BUG1=${bug1Pass ? 'PASS' : 'FAIL'}  BUG2=${bug2Pass ? 'PASS' : 'FAIL'}\n`);
  } finally {
    cdp?.close();
    chrome.kill();
    apiServer.closeAllConnections?.(); apiServer.close();
    webServer.closeAllConnections?.(); webServer.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  process.exitCode = (bug1Pass && bug2Pass) ? 0 : 1;
}

main().catch((err) => { console.error(`\n[repro] FATAL: ${err.stack || err.message}\n`); process.exitCode = 2; });
