// @MX:NOTE: [AUTO] Thin controllers — callable handlers delegating to services (REQ-ARCH-001, DP-2 defers REST).
//
// Controller layer for SPEC-BACKEND-CORE-001. Controllers carry no business logic and no SQL;
// they only wire requests to the service layer. Concrete REST routes are deferred to the Run stage (DP-2),
// so these are plain callable functions.

import { createArticleService } from '../services/articleService.js';
import { createUserService } from '../services/userService.js';
import { createMediaSearchService } from '../services/mediaSearch.js';
import { createSessionService } from '../services/sessionService.js';
import { assertAuthorized } from '../services/authorization.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ mediaSearch?: { search: (q: string) => Promise<object> }, sessionService?: object }} [deps]
 */
export function createControllers(db, deps = {}) {
  const articleService = createArticleService(db);
  const userService = createUserService(db);
  const mediaService = deps.mediaSearch ?? createMediaSearchService();
  // Session service is injectable so tests can drive ttl/clock (REQ-AUTH-GUARD-003).
  const sessions = deps.sessionService ?? createSessionService();

  // @MX:NOTE: [AUTO] Guard helper — derive the acting role ONLY from the validated session
  // (REQ-AUTH-ROLE-004); a forbidden/unauthenticated action is rejected before any state change.
  function guard(sessionId, action) {
    const session = sessions.validateSession(sessionId);
    return { session, decision: assertAuthorized(session, action) };
  }

  return {
    auth: {
      // REQ-AUTH-LOGIN-002 / SESS-001: on success, establish a session and return its id + sanitized user.
      // REQ-AUTH-LOGIN-003: on failure, return {ok:false, reason} (for the client ALERT), no session.
      // @MX:NOTE: [AUTO] Session re-issue is explicit (anti session-fixation): any pre-auth session id
      // supplied on the login call is invalidated FIRST, then createSession mints a brand-new random id.
      // @MX:REASON: makes the "new id per authenticated login" guarantee a code-level rule so it survives
      // the future HTTP cookie-binding work (deferred per spec.md Exclusions), not an incidental property.
      login: (userId, password, priorSessionId) => {
        const result = userService.login(userId, password);
        if (!result.ok) {
          return { ok: false, reason: 'invalid-credentials' };
        }
        // Invalidate any session the caller already held before re-authenticating (session fixation guard).
        if (priorSessionId !== undefined) {
          sessions.invalidateSession(priorSessionId);
        }
        const { sessionId } = sessions.createSession(result.user);
        return { ok: true, sessionId, user: result.user };
      },

      // REQ-AUTH-SESS-004: logout invalidates the server-side session.
      logout: (sessionId) => ({ ok: sessions.invalidateSession(sessionId) === true }),

      // REQ-AUTH-USRMGMT-001/002: Z-only user management, gated by the session role.
      manageUsers: (sessionId, op, payload) => {
        const { decision } = guard(sessionId, 'manage-users');
        if (!decision.ok) {
          return decision;
        }
        if (op === 'create') return { ok: true, ...userService.create(payload) };
        if (op === 'update') return userService.update(payload.userId, payload.fields);
        if (op === 'remove') return userService.remove(payload.userId);
        if (op === 'query') return { ok: true, users: userService.query(payload) };
        return { ok: false, reason: 'unknown-op' };
      },

      // REQ-AUTH-ROLE-002/003: an edit on a DPS article is permitted only for a D session;
      // the check runs BEFORE any lifecycle transition, leaving article state unchanged on denial.
      editDps: (sessionId, articleId, action) => {
        const session = sessions.validateSession(sessionId);
        if (session === undefined) {
          return { ok: false, reason: 'unauthenticated' };
        }
        const [article] = articleService.query({ articleId });
        if (article === undefined) {
          return { ok: false, reason: 'not-found' };
        }
        // DPS state -> dps-edit rule (D only); any other state -> generic edit rule (R/D/Z).
        const ruleAction = article.status === 'DPS' ? 'dps-edit' : 'edit';
        const decision = assertAuthorized(session, ruleAction);
        if (!decision.ok) {
          return decision;
        }
        return { ok: true, status: article.status };
      },
    },
    article: {
      create: (data, options) => articleService.create(data, options),
      query: (filters) => articleService.query(filters),
      search: (queryText) => articleService.searchArticles(queryText),
      updateStatus: (articleId, status) => articleService.updateStatus(articleId, status),
      remove: (articleId, role) => articleService.remove(articleId, role),
      // options carries the caller's lock identity ({userId, sessionId}) so applyAction can reject
      // a transition on an article live-locked by another holder (AC-EDIT-LOCK-6, 'lock-required').
      applyAction: (articleId, role, action, options) => articleService.applyAction(articleId, role, action, options),
      // SPEC-NEWS-REVISE-002 REQ-API-INSERT-UPDATE-SPLIT (D2-7 = A) — partial update of an existing
      // article. The PUT /api/articles/:id route wires through here after asserting lock ownership.
      update: (articleId, fields) => articleService.update(articleId, fields),
      // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — acquire/release endpoints (NFR-SEC: userId/sessionId
      // are pulled from the validated session, never the request body).
      acquireEditLock: (articleId, options) => articleService.acquireEditLock(articleId, options),
      releaseEditLock: (articleId, options) => articleService.releaseEditLock(articleId, options),
      assertLockHolder: (articleId, options) => articleService.assertLockHolder(articleId, options),
      // SPEC-NEWS-REVISE-012 REQ-FORCE-UNLOCK — D/Z 전용 강제 해제(보유자 무관). 라우트가 세션 역할을
      // 재검증한 뒤에만 호출한다.
      forceReleaseEditLock: (articleId) => articleService.forceReleaseEditLock(articleId),
    },
    user: {
      create: (user) => userService.create(user),
      query: (filters) => userService.query(filters),
      update: (userId, fields) => userService.update(userId, fields),
      remove: (userId) => userService.remove(userId),
      login: (userId, password) => userService.login(userId, password),
    },
    media: {
      // 2026-06-06 directive (supersedes D2-8 fallback): route by media type —
      // type 'image' -> Google Image Search, anything else -> YouTube.
      search: (queryText, type) => mediaService.search(queryText, type),
    },
  };
}
