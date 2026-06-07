---
name: run-tech-day
description: Build, launch, and drive the tech_day article-production system (Node/Express + node:sqlite backend, React 19 + Vite frontend). Use to run, start, build, smoke-test, screenshot, or end-to-end verify the app's REST/SSE API and the React UI.
---

# Run: tech_day (article-production-system)

A news article-production app. **Backend**: Express + `node:sqlite` (`server/index.js`), serving a
REST + SSE API on `:3001` over the production `news.db`. **Frontend**: React 19 + Vite (MVC:
`web/src/{model,view,controller}`), a thin client over that API, served on `:5173`.

There are **three committed harnesses**. `driver.mjs` and `ui-shot.mjs` boot the *genuine* app code
over an in-memory DB without ever touching the production `news.db` (CLAUDE.md HARD rule: DB 내용은
삭제하지 않는다); `ime-enter.mjs` attaches to the already-running dev app and performs a read-only
login only (no save), so it also leaves `news.db` unwritten:

| Harness | What it drives | Run |
|---|---|---|
| **`driver.mjs`** | The HTTP/SSE **API** end-to-end (login→create→lifecycle→edit-lock→SSE), `fetch`-based | `node .claude/skills/run-tech-day/driver.mjs` |
| **`ui-shot.mjs`** | The real **React UI** in headless Chrome — logs in, screenshots login/write/list | `node .claude/skills/run-tech-day/ui-shot.mjs` |
| **`ime-enter.mjs`** | **한글 IME Enter 회귀** — attaches to the running dev app (:5173/:3001), drives a Korean IME composition via CDP `Input.imeSetComposition` then Enter with no `compositionend`, asserts a single `'\n'` ("가\n") | `node .claude/skills/run-tech-day/ime-enter.mjs` (a real dev account is supplied through env vars; see the header comment in the file) |
| **`refresh-session.mjs`** | **새로고침 로그인 유지 회귀** — attaches to the running dev app, logs in to writer.do, then `Page.reload` (true browser refresh), asserts the app stays on writer.do (sessionStorage restore, no bounce to login.do) | `node .claude/skills/run-tech-day/refresh-session.mjs` (real dev account via env vars; see the header comment in the file) |

> All commands below were run from the project root (`tech_day/`) on **Node v24.16.0** (Windows).
> Paths are relative to `tech_day/`.

## Prerequisites

- **Node >= 22.5.0** (needs `node:sqlite`; verified on v24.16.0).
- **`node` may not be on the Git Bash PATH.** On this machine it lives at `C:\Program Files\nodejs`.
  In Git Bash, put it on PATH first: `export PATH="/c/Program Files/nodejs:$PATH"`.
- For `ui-shot.mjs`: **Google Chrome**. Auto-detected at
  `C:\Program Files\Google\Chrome\Application\chrome.exe`; override with `CHROME=/path/to/chrome`.
  (There is no `chromium-cli`/Playwright here — `ui-shot.mjs` speaks the DevTools Protocol directly
  using Node's built-in `WebSocket`/`fetch`, so no extra package is needed.)

## Setup

```bash
npm install        # root only — web/ has no package.json; all deps live at the root
```

`npm install` reports transitive audit warnings and prints "run `npm audit fix --force`" — **ignore
it** (the force fix pulls breaking majors). Install still succeeds.

## Run (agent path 1) — API driver

One command boots the real app and drives health → login → create → query → lifecycle (send→DPS)
→ edit-lock (acquire/409/release) → SSE realtime, asserting each step. Exit 0 = all green.

```bash
node .claude/skills/run-tech-day/driver.mjs
```

Verified output (11 checks, exit 0):

```
[run-tech-day] real app booted on http://127.0.0.1:<port> (in-memory DB, news.db untouched)
  ✓ GET /api/health -> 200 {ok:true}
  ✓ seeded user desk1 (role D) via controller
  ✓ POST /api/login -> ok + sessionId
  ✓ POST /api/articles -> ok + articleId
  ✓ GET /api/articles?articleId= -> 1 row, status RDS
  ✓ POST /api/articles/:id/action {send} -> DPS
  ✓ POST /api/articles/:id/lock -> LockYN Y
  ✓ second session lock -> 409 conflict (no duplicate edit)
  ✓ POST /api/articles/:id/unlock -> released
  ✓ GET /api/stream -> ready frame
  ✓ SSE broadcasts a change frame on article create

[run-tech-day] PASS — 11 checks green
```

Use this after any change to `server/`, `src/`, or the API contract — it covers exactly the
request/response/SSE stack the React client depends on.

## Run (agent path 2) — UI screenshots in headless Chrome

`ui-shot.mjs` is the way to *see* the UI without a human. It boots the backend on `:3001` against an
in-memory DB seeded with a known login (`desk1`/`pw`, role D) + two RDS articles, serves the prebuilt
frontend on `:5173`, then drives headless Chrome over the DevTools Protocol: screenshots `login.do`,
logs in via the **real** login form, then screenshots `writer.do` and `list.do`.

**Build first** (it serves `web/dist`, not the dev server):

```bash
npm run build
node .claude/skills/run-tech-day/ui-shot.mjs
```

Verified output (exit 0):

```
[ui-shot] api :3001 (in-memory, news.db untouched) | web :5173 (web/dist)
  ✓ login.png
  ✓ write.png
  ✓ view.png

[ui-shot] PASS — 3 screenshots in .claude/skills/run-tech-day/screenshots/
```

Screenshots land in **`.claude/skills/run-tech-day/screenshots/`** (gitignored):
- `login.png` — 연합뉴스 red bar, blue title, 아이디/암호 form.
- `write.png` — authenticated write page: `desk1 · 정치부 · (D)` top-right, 송고/보류 buttons,
  공통정보/이미지/영상/글기사 tabs, editor + metadata at 60:40.
- `view.png` — 기사 조회 list: 데스크 미송고 tab active, the two RDS articles with status badges,
  author/time/편집, realtime status bar top-right.

This is the harness to extend when changing `web/src/view/**`: add a `goto`/`shot` pair, or click a
nav link and screenshot. **Use the in-app nav links (`a.yh-nav__link`) to move between pages — a full
`Page.navigate` reloads the bundle and resets React session state, bouncing you back to login** (see
Gotchas).

## Build

```bash
npm run build      # vite build web -> web/dist (index.html + assets/*.css,*.js)
```

Verified: `vite v7.3.3 … 51 modules transformed … built in ~1.6s`, output in `web/dist/`.

## Run (human path) — live servers against the real news.db

To exercise the real UI against the real `news.db`, start both servers (each runs in the foreground;
use two terminals):

```bash
npm run server     # -> article-production server listening on http://127.0.0.1:3001
npm run dev        # -> VITE v7.3.3 ready … Local: http://localhost:5173/
```

Verify they are up (read-only — does not mutate `news.db`):

```bash
curl -s http://127.0.0.1:3001/api/health                           # {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/    # 200
curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'    # <title>기사 제작 시스템 – 연합뉴스</title>
```

Then open **http://localhost:5173** in a browser. The server honors a `PORT` env var
(`process.env.PORT ?? 3001`) if `:3001` is taken — verified: `PORT=3009 node server/index.js`.
Note the live UI can only log in with a real `news.db` account (passwords are bcrypt-hashed); for a
turnkey logged-in view use `ui-shot.mjs` (seeds its own `desk1`/`pw`).

## Test

```bash
npm test           # backend: node --experimental-sqlite --test  (170 tests pass)
npm run test:web   # frontend: vitest run --root web             (268 tests, 22 files pass)
```

Both use isolated in-memory SQLite / jsdom; neither touches `news.db`.

## Gotchas

- **`node` is not on the Git Bash PATH** on this machine — it's at `C:\Program Files\nodejs`. Every
  command above assumes `export PATH="/c/Program Files/nodejs:$PATH"` was run first in the shell.
- **UI navigation must stay in-app.** A full page load (`Page.navigate` / typing a `.do` URL) reloads
  the bundle and resets the React `user` state, so the auth guard bounces you to `login.do`. In
  `ui-shot.mjs` the list page is reached by **clicking the `기사 조회` nav link** (history.pushState),
  not by navigating to `/list.do`.
- **React controlled inputs ignore `el.value = …`.** To fill the login form from CDP you must set the
  value through the native `HTMLInputElement.prototype.value` setter and dispatch a bubbling `input`
  event (see `setReactInput` in `ui-shot.mjs`), otherwise React's state never updates and login fails.
- **`ui-shot.mjs` needs `web/dist`.** It serves the built bundle, not the dev server. Run
  `npm run build` first or it exits with "web/dist not found".
- **CORS is locked to `:5173`.** The server only allows `http://localhost:5173` / `http://127.0.0.1:5173`.
  If Vite falls back to `:5174` (because `:5173` is busy) the browser's API calls are CORS-blocked —
  free up `:5173` instead.
- **The list page's realtime badge can read `비-실시간 (재연결 중)` for a moment** in headless Chrome
  while the SSE `EventSource` (re)connects — cosmetic; the API-level SSE is asserted green by `driver.mjs`.
- **`news.db` is never reset.** The production server runs only additive schema (`CREATE TABLE IF NOT
  EXISTS` / additive `ALTER`) and has no DB-path override. Both harnesses use `:memory:` so smoke runs
  never write test rows into `news.db`.
- **`node:sqlite` is experimental.** `npm test` passes `--experimental-sqlite` (already in the script).
  The server and both `.mjs` harnesses run fine without the flag on Node 24; on older Node, add it.

## Troubleshooting

- **`node: command not found` (Git Bash)** — node isn't on PATH; run
  `export PATH="/c/Program Files/nodejs:$PATH"` first.
- **`Error: listen EADDRINUSE :::3001`** — a server (likely a prior `npm run server` or a left-over
  `ui-shot.mjs`) is already up. Reuse it, or start with another port: `PORT=3002 npm run server`.
- **`ui-shot.mjs`: `Chrome not found`** — set `CHROME=/path/to/chrome` (or install Chrome).
- **`ui-shot.mjs`: `login did not reach writer.do`** — the seeded login failed; check the printed
  `(alert: …)` text. Usually means the API server on `:3001` didn't come up (port in use).
- **Driver crashes on exit with `UV_HANDLE_CLOSING` (Windows)** — only happens if you re-add a forced
  `process.exit()` while a socket is closing. Both harnesses tear down (`abort()` +
  `closeAllConnections()` + `close()`) and let the loop drain instead; keep it that way.
