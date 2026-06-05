// @MX:ANCHOR: [AUTO] HTTP transport layer — single app factory wiring every controller to the
// frontend Model contract (fan_in: all React Model methods route through these routes).
// @MX:REASON: this is the one integration point between the existing service/controller layer
// (SPEC-BACKEND-CORE-001) and the React client's MODEL_KEYS contract; the whole UI depends on the
// shapes returned here matching web/src/model/contract.js, so the route table is a load-bearing seam.
//
// Thin REST/SSE transport for the article-production system. No business logic lives here:
// every route delegates to createControllers(db). DB access is non-destructive (CLAUDE.md HARD rule:
// DB 내용은 삭제하지 않는다) — createSchema only runs CREATE TABLE IF NOT EXISTS / additive ALTER.

import { EventEmitter } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';

import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';
import { createSessionService } from '../src/services/sessionService.js';

// @MX:TODO: [AUTO] Deferred hardening (별도 후속, this hotfix 범위 밖): HTTPS 강제, 세션ID를
// HttpOnly/Secure/SameSite 쿠키로 전환, 로그인 레이트리밋/계정 잠금, SSE 인증, 세션 슬라이딩 만료.
// 본 변경은 서버측 인가 미배선(Critical)만 핫픽스한다.

// Build the Express app. Dependencies are injectable so tests can drive an in-memory
// db/session store without binding the production news.db (REQ-AUTH-GUARD-003 testability).
export function createApp({ controllers, sessionService }) {
  // Tiny in-process event bus for SSE realtime (contract.subscribe). Article mutations emit here.
  const bus = new EventEmitter();
  bus.setMaxListeners(0);

  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }));

  // Read the session id the client stores after login and replays on each request.
  function sessionIdOf(req) {
    return req.get('x-session-id') ?? undefined;
  }

  // @MX:ANCHOR: [AUTO] Session-to-role resolver — the SOLE source of the acting role at the HTTP layer.
  // @MX:REASON: every protected route derives role from here, never from req.body.role; this closes the
  // server측 인가 미배선 Critical by making client-supplied role values irrelevant (REQ-AUTH-ROLE-004).
  // Returns the validated identity ({ role, ... }) or undefined when the session is absent/expired.
  function sessionOf(req) {
    return sessionService.validateSession(sessionIdOf(req));
  }

  // --- Health ---------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- Auth -----------------------------------------------------------------
  // POST /api/login -> { ok, user?, sessionId? }. Client stores sessionId and sends it back.
  app.post('/api/login', (req, res) => {
    const { userId, password } = req.body ?? {};
    const result = controllers.auth.login(userId, password, sessionIdOf(req));
    res.json(result);
  });

  // POST /api/logout -> invalidate the server-side session for x-session-id.
  app.post('/api/logout', (req, res) => {
    res.json(controllers.auth.logout(sessionIdOf(req)));
  });

  // --- Users ----------------------------------------------------------------
  // GET /api/users -> session-gated. The previous无인증 full-roster exposure is removed (C-2).
  //   - no/invalid session -> { ok:false, reason } (no roster leak).
  //   - Z session          -> full roster array (관리자 명단 관리), via auth.manageUsers gate.
  //   - R/D session         -> minimal department-only array; preserves the frontend queryUsers
  //                            contract (useViewController reads only u.department for the dropdown).
  app.get('/api/users', (req, res) => {
    const session = sessionOf(req);
    if (session === undefined) {
      return res.json({ ok: false, reason: 'unauthenticated' });
    }
    if (session.role === 'Z') {
      // Z-only full roster, routed through the manage-users authorization gate (REQ-AUTH-USRMGMT-001).
      const result = controllers.auth.manageUsers(sessionIdOf(req), 'query', req.query);
      return res.json(result.ok ? result.users : { ok: false, reason: result.reason });
    }
    // Non-Z authenticated session: expose only department + identifying labels, never the full roster.
    const minimal = controllers.user.query(req.query).map((u) => ({
      userId: u.userId,
      name: u.name,
      department: u.department,
      departmentCode: u.departmentCode,
    }));
    return res.json(minimal);
  });

  // POST /api/users { ...user } -> create a user (Z-only). Body is the full user object
  // ({userId, name, password, role, department, ...}). Routed through the manage-users gate,
  // which derives the acting role from x-session-id and returns { ok:false, reason } for any
  // unauthenticated/non-Z caller — no business logic here (news.md API 명세서: User 입력).
  app.post('/api/users', (req, res) => {
    const result = controllers.auth.manageUsers(sessionIdOf(req), 'create', req.body ?? {});
    res.json(result);
  });

  // PUT /api/users/:userId { ...fields } -> update a user (Z-only). Body is the changed fields.
  // Same Z gate as create; unauthenticated/non-Z -> { ok:false, reason }, missing user -> not-found
  // (news.md API 명세서: User 수정). Non-destructive — userService.update never deletes rows.
  app.put('/api/users/:userId', (req, res) => {
    const result = controllers.auth.manageUsers(sessionIdOf(req), 'update', {
      userId: req.params.userId,
      fields: req.body ?? {},
    });
    res.json(result);
  });

  // --- Articles -------------------------------------------------------------
  // GET /api/articles -> array. Query params are AND-combined metadata filters.
  app.get('/api/articles', (req, res) => {
    res.json(controllers.article.query(req.query));
  });

  // GET /api/articles/search?q= -> array of text-matched articles.
  app.get('/api/articles/search', (req, res) => {
    res.json(controllers.article.search(req.query.q ?? ''));
  });

  // POST /api/articles/:id/action { action } -> { ok, status?, reason? }.
  // C-1: req.body.role is NOT trusted. The session is validated and the acting role is derived
  // from it; the editDps gate (session validation + assertAuthorized R/D/Z + DPS=D-only) runs
  // BEFORE any transition. On denial we return { ok:false, reason } and leave the state untouched.
  app.post('/api/articles/:id/action', (req, res) => {
    const { action } = req.body ?? {};
    const sessionId = sessionIdOf(req);
    const session = sessionService.validateSession(sessionId);
    if (session === undefined) {
      return res.json({ ok: false, reason: 'unauthenticated' });
    }
    // Authorization gate: rejects an unauthorized edit (e.g. R on a DPS article) before mutating state.
    const gate = controllers.auth.editDps(sessionId, req.params.id, action);
    if (!gate.ok) {
      return res.json(gate);
    }
    // Transition is driven by the SESSION role, never by any client-supplied body.role.
    const result = controllers.article.applyAction(req.params.id, session.role, action);
    if (result.ok) {
      bus.emit('change', { type: 'status', articleId: req.params.id, status: result.status });
    }
    return res.json(result);
  });

  // POST /api/articles { ...dto } -> { ok, articleId? }. Assemble + persist via article.create.
  // M-2: create/update is gated behind an authenticated edit-capable (R/D/Z) session.
  function saveArticle(req, res) {
    const sessionId = sessionIdOf(req);
    const session = sessionService.validateSession(sessionId);
    if (session === undefined) {
      return res.json({ ok: false, reason: 'unauthenticated' });
    }
    // Generic edit rule (R/D/Z) authorizes article creation/update (REQ-AUTH-ROLE-001).
    if (!['R', 'D', 'Z'].includes(session.role)) {
      return res.json({ ok: false, reason: 'forbidden' });
    }
    try {
      const { articleId } = controllers.article.create(req.body ?? {});
      bus.emit('change', { type: 'create', articleId, status: 'RDS' });
      return res.json({ ok: true, articleId });
    } catch {
      return res.json({ ok: false });
    }
  }
  app.post('/api/articles', saveArticle);

  // SPEC-EDIT-LOCK-001 PUT /api/articles/:id — partial update (D2-7 = A). 신설계: holder = 로그인 세션 id.
  // NEWS-REVISE-002 R-CRIT-2 회귀 가드: articleService.update (부분 update) 경로 유지 — .create 호출 금지.
  // Lock guard: caller의 x-session-id 가 잠금 보유자인지 assertLockHolder 로 확인한다(AC-EDIT-LOCK-6).
  // @MX:NOTE: [AUTO] page-scoped UUID 의존 제거 — holder 식별은 sessionIdOf(req) 단일 출처(SPEC-EDIT-LOCK-001).
  app.put('/api/articles/:id', (req, res) => {
    const sid = sessionIdOf(req);
    const session = sessionService.validateSession(sid);
    if (session === undefined) {
      return res.json({ ok: false, reason: 'unauthenticated' });
    }
    if (!['R', 'D', 'Z'].includes(session.role)) {
      return res.json({ ok: false, reason: 'forbidden' });
    }
    const articleId = req.params.id;
    // Lock guard — 로그인 세션 id 가 잠금 보유자여야 한다 (AC-EDIT-LOCK-6 신설계).
    const holder = controllers.article.assertLockHolder(articleId, {
      userId: session.userId,
      sessionId: sid,
    });
    if (!holder.ok) {
      return res.json({ ok: false, reason: holder.reason ?? 'lock-required' });
    }
    // D2-7 = A partial update.
    const result = controllers.article.update(articleId, req.body ?? {});
    if (result.ok) {
      bus.emit('change', { type: 'update', articleId });
    }
    return res.json(result);
  });

  // SPEC-EDIT-LOCK-001 — POST /api/articles/:id/lock (신설계: holder = 로그인 세션 id 단위).
  // 처리 순서: 401 (미인증) → 403 (R/D/Z 아닌 역할) → 404 (기사 없음) → 획득 시도.
  // 성공: 200 {ok:true, article:{...LockYN:'Y', LockedBySessionId:sid}}
  // 비보유·비스테일: 409 {ok:false, reason:'locked'} — lockedBy 미노출(보안 NFR-SEC)
  // @MX:NOTE: [AUTO] holder = sessionIdOf(req); userId는 서비스 계층 식별용, HTTP 응답에 노출 안 함.
  app.post('/api/articles/:id/lock', (req, res) => {
    const sid = sessionIdOf(req);
    const session = sessionService.validateSession(sid);
    if (session === undefined) {
      return res.status(401).json({ ok: false, reason: 'unauthenticated' });
    }
    if (!['R', 'D', 'Z'].includes(session.role)) {
      return res.status(403).json({ ok: false, reason: 'forbidden' });
    }
    const articleId = req.params.id;
    // 404 체크: 기사 존재 여부를 획득 시도 전에 확인.
    const [existing] = controllers.article.query({ articleId });
    if (existing === undefined) {
      return res.status(404).json({ ok: false, reason: 'not-found' });
    }
    // holder = 로그인 세션 id (page-scoped UUID 폐기; D2-5 기준은 이제 세션 단위).
    const result = controllers.article.acquireEditLock(articleId, {
      userId: session.userId,
      sessionId: sid,
    });
    if (!result.ok) {
      // 비보유·비스테일 → 409; lockedBy(홀더 신원) 응답 body 비노출(보안 AC-BLK-2).
      return res.status(409).json({ ok: false, reason: result.reason });
    }
    // 성공 응답: article 최신 상태 포함 (AC-AUTH-1 계약).
    const [article] = controllers.article.query({ articleId });
    return res.json({ ok: true, article: { ...article, LockYN: 'Y', LockedBySessionId: sid } });
  });

  // SPEC-EDIT-LOCK-001 — POST /api/articles/:id/unlock (신규 라우트; DELETE /lock 대체).
  // 처리 순서: 401 → 403 → 404 → 해제 시도.
  // 보유자 해제: {ok:true, released:true}; 비보유자: {ok:true, released:false} (no-op, 409 아님).
  // @MX:NOTE: [AUTO] 비보유자 해제는 no-op + released:false (AC-RLE-2); 보유자만 실제 해제 (AC-RLE-1).
  app.post('/api/articles/:id/unlock', (req, res) => {
    const sid = sessionIdOf(req);
    const session = sessionService.validateSession(sid);
    if (session === undefined) {
      return res.status(401).json({ ok: false, reason: 'unauthenticated' });
    }
    if (!['R', 'D', 'Z'].includes(session.role)) {
      return res.status(403).json({ ok: false, reason: 'forbidden' });
    }
    const articleId = req.params.id;
    const [existing] = controllers.article.query({ articleId });
    if (existing === undefined) {
      return res.status(404).json({ ok: false, reason: 'not-found' });
    }
    const result = controllers.article.releaseEditLock(articleId, {
      userId: session.userId,
      sessionId: sid,
    });
    // releaseEditLock: ok:true(보유자 해제 또는 이미 해제됨) / ok:false(not-holder).
    // 신설계 AC-RLE-2: 비보유자 해제는 no-op, released:false 반환 (409 아님).
    if (!result.ok && result.reason === 'not-holder') {
      return res.json({ ok: true, released: false });
    }
    if (!result.ok) {
      // not-found 등 예상치 못한 오류.
      return res.status(404).json({ ok: false, reason: result.reason });
    }
    // lockYN='N' 이미 해제(idempotent) 혹은 정상 해제 → released:true.
    return res.json({ ok: true, released: true });
  });

  // --- Media ----------------------------------------------------------------
  // GET /api/media/search?q= -> { items, error }.
  app.get('/api/media/search', async (req, res) => {
    res.json(await controllers.media.search(req.query.q ?? ''));
  });

  // --- Realtime (SSE) -------------------------------------------------------
  // GET /api/stream -> Server-Sent Events. Emits `event: change` on article create/status change.
  // Filtering is intentionally naive (send all) per the build spec; the client may filter.
  app.get('/api/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    res.write('event: ready\ndata: {}\n\n');

    const onChange = (payload) => {
      res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    bus.on('change', onChange);

    req.on('close', () => {
      bus.off('change', onChange);
    });
  });

  return app;
}

// Production bootstrap: only when run directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Resolve news.db at the repo root (one level up from server/).
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DB_PATH = path.join(__dirname, '..', 'news.db');

  // Open the existing SQLite file and ensure schema idempotently (never drops/deletes).
  const db = new DatabaseSync(DB_PATH);
  createSchema(db);

  // Single session service shared by the controllers and the HTTP role-resolution layer.
  const sessionService = createSessionService();
  const controllers = createControllers(db, { sessionService });
  const app = createApp({ controllers, sessionService });

  const port = process.env.PORT ?? 3001;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`article-production server listening on http://127.0.0.1:${port}`);
  });
}
