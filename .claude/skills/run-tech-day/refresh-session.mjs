#!/usr/bin/env node
// run-tech-day refresh-session harness (ATTACH mode) — verifies "새로고침 후 로그인 유지"
// (SPEC-EDIT-LOCK-001 session persistence) against the ALREADY-RUNNING dev app (Vite :5173 +
// server :3001). It launches its own headless Chrome, logs in with a REAL account, lands on
// writer.do, then RELOADS the page (Page.reload — a true browser refresh that re-boots the bundle
// and resets React in-memory state). With the sessionStorage fix, the app restores user + sessionId
// and stays on writer.do instead of bouncing to login.do.
//
// Read-only login only (no save) — news.db is never written.
// Usage:  node .claude/skills/run-tech-day/refresh-session.mjs   (LOGIN_ID / LOGIN_PW env override)
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
const FRONT = process.env.FRONT || 'http://localhost:5173';
const LOGIN_ID = process.env.LOGIN_ID || 'jung461';
const LOGIN_PW = process.env.LOGIN_PW || '1234';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
function findChrome() {
  return [CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find((c) => existsSync(c));
}

function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const waiters = [];
  let nextId = 1;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
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
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    waitEvent(method, ms = 15000) {
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
  mkdirSync(SHOTS, { recursive: true });
  try {
    const r = await fetch(`${FRONT}/`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    throw new Error(`running app not reachable at ${FRONT} — start it with "npm run dev" (${e.message})`);
  }

  const chromeBin = findChrome();
  if (!chromeBin) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'rtd-refresh-'));
  const port = 9336;
  const chrome = spawn(chromeBin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1366,900', 'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  let failures = 0;
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

    const evalV = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
    const setReactInput = async (selector, value) => (await cdp.send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        if(!el) return 'no-el'; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`,
      returnByValue: true,
    })).result.value;
    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`  ✓ ${name}.png`);
    };

    // 1) login on the running app
    let loaded = cdp.waitEvent('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${FRONT}/login.do` });
    await loaded;
    let hasForm = false;
    for (let i = 0; i < 50 && !hasForm; i += 1) { await sleep(200); hasForm = await evalV("!!document.querySelector('#login-userId')"); }
    if (!hasForm) throw new Error('login form (#login-userId) not rendered');
    await setReactInput('#login-userId', LOGIN_ID);
    await setReactInput('#login-password', LOGIN_PW);
    await cdp.send('Runtime.evaluate', { expression: "document.querySelector('form').requestSubmit()" });

    let onWrite = false;
    for (let i = 0; i < 40 && !onWrite; i += 1) {
      await sleep(200);
      onWrite = await evalV("location.pathname === '/writer.do' && /기사 작성/.test(document.body.innerText)");
    }
    if (!onWrite) {
      const alert = await evalV("(document.querySelector('[role=alert]')||{}).innerText || ''");
      throw new Error(`login did not reach writer.do${alert ? ` (alert: ${alert})` : ''}`);
    }
    const beforePath = await evalV('location.pathname');
    const storedUser = await evalV("sessionStorage.getItem('tech_day.user')");
    const storedSid = await evalV("sessionStorage.getItem('tech_day.sessionId')");
    console.log(`\n  로그인 성공: path=${beforePath}`);
    console.log(`  sessionStorage user 저장: ${storedUser ? 'YES' : 'NO'} | sessionId 저장: ${storedSid ? 'YES' : 'NO'}`);
    await shot('refresh-before');

    // 2) REAL refresh — Page.reload re-boots the bundle and wipes React in-memory state.
    loaded = cdp.waitEvent('Page.loadEventFired');
    await cdp.send('Page.reload', { ignoreCache: false });
    await loaded;

    // 3) after refresh: must remain authenticated on writer.do (NOT bounced to login.do)
    let stillAuthed = false;
    let afterPath = '';
    for (let i = 0; i < 40; i += 1) {
      await sleep(200);
      afterPath = await evalV('location.pathname');
      stillAuthed = await evalV("location.pathname === '/writer.do' && /기사 작성/.test(document.body.innerText)");
      if (stillAuthed) break;
      if (afterPath === '/login.do') break;
    }
    const userChipAfter = await evalV(`document.body.innerText.includes(${JSON.stringify(LOGIN_ID)})`);
    console.log(`\n  새로고침(Page.reload) 후: path=${afterPath}`);
    console.log(`  writer.do 유지(미인증 바운스 없음): ${stillAuthed} | 화면에 '${LOGIN_ID}' 표시: ${userChipAfter}`);
    await shot('refresh-after');

    if (stillAuthed) {
      console.log('\n  ✓ PASS: 새로고침 후에도 로그인 유지 (writer.do, login.do 미바운스)');
    } else {
      failures += 1;
      console.log(`\n  ✗ FAIL: 새로고침 후 로그인 풀림 — path=${afterPath} (기대 /writer.do)`);
    }
    console.log(`\n[refresh-session] ${failures === 0 ? 'PASS' : 'FAIL'} — real-browser refresh-keeps-login check\n`);
  } finally {
    cdp?.close();
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(`\n[refresh-session] FAIL: ${err.message}\n`); process.exitCode = 1; });
