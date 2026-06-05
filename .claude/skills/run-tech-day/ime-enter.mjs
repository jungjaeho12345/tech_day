#!/usr/bin/env node
// run-tech-day IME-Enter harness (ATTACH mode) — verifies the reported bug fix against the
// ALREADY-RUNNING dev app (Vite :5173 + server :3001), so it does NOT touch the user's live
// servers or news.db beyond a read-only login. It launches its own headless Chrome, navigates to
// the running app, logs in with a REAL account, focuses the contentEditable body editor, then drives
// a Korean IME composition over the DevTools Protocol (Input.imeSetComposition) and presses Enter
// WITHOUT a following compositionend — the exact buggy IME state. With the fix, WritePage.jsx's rAF
// fallback splices a single '\n', so the editor text becomes "가\n".
//
// It performs NO save/송고/보류 — only focuses the editor and types — so news.db is never written.
//
// Usage:   LOGIN_ID=jung461 LOGIN_PW=1234 node .claude/skills/run-tech-day/ime-enter.mjs
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
  mkdirSync(SHOTS, { recursive: true });
  // sanity: the running app must answer
  try {
    const r = await fetch(`${FRONT}/`, { method: 'GET' });
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    throw new Error(`running app not reachable at ${FRONT} — start it with "npm run dev" (${e.message})`);
  }

  const chromeBin = findChrome();
  if (!chromeBin) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'rtd-ime-'));
  const port = 9335;
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

    const evalText = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
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

    // login against the running app (real account; read-only — no save performed)
    const loaded = cdp.waitEvent('Page.loadEventFired', 15000);
    await cdp.send('Page.navigate', { url: `${FRONT}/login.do` });
    await loaded;
    let hasForm = false;
    for (let i = 0; i < 50 && !hasForm; i += 1) {
      await sleep(200);
      hasForm = await evalText("!!document.querySelector('#login-userId')");
    }
    if (!hasForm) throw new Error('login form (#login-userId) not rendered after wait');
    if ((await setReactInput('#login-userId', LOGIN_ID)) !== 'ok') throw new Error('login form not rendered');
    await setReactInput('#login-password', LOGIN_PW);
    await cdp.send('Runtime.evaluate', { expression: "document.querySelector('form').requestSubmit()" });
    let onWrite = false;
    for (let i = 0; i < 40 && !onWrite; i += 1) {
      await sleep(200);
      onWrite = await evalText("location.pathname === '/writer.do' && /기사 작성/.test(document.body.innerText)");
    }
    if (!onWrite) {
      const alert = await evalText("(document.querySelector('[role=alert]')||{}).innerText || ''");
      throw new Error(`login did not reach writer.do${alert ? ` (alert: ${alert})` : ''}`);
    }
    await sleep(400);

    // focus the contentEditable body editor and place caret at the end
    const focused = await evalText(`(() => {
      const el = document.querySelector('[data-testid="editor-body"]');
      if (!el) return 'no-editor';
      el.focus();
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      return document.activeElement === el ? 'focused' : 'focus-failed';
    })()`);
    if (focused !== 'focused') throw new Error(`editor focus failed: ${focused}`);

    // Reproduce the buggy IME state: live Korean composition, then Enter with NO compositionend.
    await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
    await sleep(120);
    const beforeText = await evalText(`document.querySelector('[data-testid="editor-body"]').textContent`);

    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });

    await sleep(300); // let the requestAnimationFrame fallback run
    const afterText = await evalText(`document.querySelector('[data-testid="editor-body"]').textContent`);
    const newlineCount = (afterText.match(/\n/g) || []).length;
    const hasSyllable = afterText.includes('가');

    console.log(`\n  로그인: ${LOGIN_ID} (실 server :3001, dev :5173)`);
    console.log(`  본문 before Enter: ${JSON.stringify(beforeText)}`);
    console.log(`  본문 after  Enter: ${JSON.stringify(afterText)}`);
    console.log(`  줄바꿈(\\n) 개수: ${newlineCount} | 음절 '가' 보존: ${hasSyllable}`);
    await shot('ime-enter');

    if (newlineCount === 1 && hasSyllable) {
      console.log('\n  ✓ PASS: 한글 입력 직후 Enter 1회 → 줄바꿈 1개 ("가\\n"), 음절 보존, 중복 없음');
    } else {
      failures += 1;
      console.log(`\n  ✗ FAIL: 기대 "가\\n"(줄바꿈 1) — 실제 줄바꿈 ${newlineCount}, 음절보존 ${hasSyllable}`);
    }
    console.log(`\n[ime-enter] ${failures === 0 ? 'PASS' : 'FAIL'} — real-browser IME Enter check (attach mode)\n`);
  } finally {
    cdp?.close();
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(`\n[ime-enter] FAIL: ${err.message}\n`); process.exitCode = 1; });
