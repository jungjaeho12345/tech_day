// @MX:ANCHOR: [AUTO] Session service — server-side session lifecycle for SPEC-AUTH-001 (fan_in >= 3).
// @MX:REASON: sole authority for opaque session ids; controllers + authorization derive the acting role from here only.
//
// Session establishment/persistence for SPEC-AUTH-001 Module ② and expiry for Module ③.
// [D-AUTH-1] Server-side session + opaque session id (NOT JWT). The id carries no role or
// credentials (REQ-AUTH-SESS-002); identity is held server-side in a Map.
//
// @MX:NOTE: [AUTO] Run-stage store choice — in-memory Map. A persistent store (SQLite/Redis)
// is deferred per spec.md Exclusions; the contract (create/get/validate/invalidate/expire) is store-agnostic.

import { randomBytes } from 'node:crypto';

// Identity fields retained per REQ-AUTH-SESS-003; the password/hash is deliberately excluded.
const IDENTITY_FIELDS = Object.freeze([
  'userId', 'name', 'role', 'department', 'departmentCode',
]);

// Sliding idle timeout (SPEC-AUTH-SESSION-POLICY): a logged-in session expires only after this much
// time with NO activity. Every authenticated request refreshes lastActivityAt (touchSession), so an
// active user is kept alive indefinitely; a user is logged out solely by idling past this window or by
// pressing logout (invalidateSession). 1 hour, named explicitly (no magic number).
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour of inactivity → session expires.

function pickIdentity(user) {
  const identity = {};
  for (const field of IDENTITY_FIELDS) {
    identity[field] = user[field];
  }
  return identity;
}

/**
 * Create a server-side session service.
 * @param {{ ttlMs?: number, idleTimeoutMs?: number, now?: () => number }} [options]
 *   injectable idle window + clock (testability). `ttlMs` is kept as a backward-compatible alias
 *   for the idle window (REQ-AUTH-GUARD-003 test uses `ttlMs`).
 */
export function createSessionService(options = {}) {
  // The idle window: a session survives this long between activities (sliding expiration).
  const idleTtlMs = options.idleTimeoutMs ?? options.ttlMs ?? IDLE_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const store = new Map();

  /** Drop the session if it idled past its expiry; returns the live record or undefined. Pure read. */
  function readLive(sessionId) {
    if (typeof sessionId !== 'string') {
      return undefined;
    }
    const record = store.get(sessionId);
    if (record === undefined) {
      return undefined;
    }
    if (now() > record.expiresAt) {
      store.delete(sessionId); // REQ-AUTH-GUARD-003: expired sessions are evicted, never served.
      return undefined;
    }
    return record;
  }

  return {
    // @MX:NOTE: [AUTO] Session-fixation guarantee — createSession ALWAYS mints a fresh random opaque id
    // (24 random bytes); it never reuses or accepts a caller-supplied id. The controller invalidates any
    // pre-auth session before calling this, so a fixed/forged id can never survive login (REQ-AUTH-SESS-001).
    // @MX:REASON: prevents session fixation when HTTP cookie binding is added (deferred per spec.md Exclusions);
    // until then the id is in-memory only, so the rule is enforced at the code level rather than via Set-Cookie.
    /** REQ-AUTH-SESS-001/002/003: bind an opaque id to the user's identity (no credentials). */
    createSession(user) {
      const sessionId = randomBytes(24).toString('hex'); // opaque; encodes nothing about the user.
      const startedAt = now();
      store.set(sessionId, {
        identity: pickIdentity(user),
        lastActivityAt: startedAt,
        // Sliding expiry: idleTtlMs after the last activity. touchSession pushes this forward.
        expiresAt: startedAt + idleTtlMs,
      });
      return { sessionId };
    },

    /** Return the retained identity for a live session, else undefined. Pure read (no slide). */
    getSession(sessionId) {
      const record = readLive(sessionId);
      return record === undefined ? undefined : { ...record.identity };
    },

    /** Alias used by guards: a live session's identity, else undefined (REQ-AUTH-GUARD-001..003). Pure read. */
    validateSession(sessionId) {
      const record = readLive(sessionId);
      return record === undefined ? undefined : { ...record.identity };
    },

    // @MX:NOTE: [AUTO] Sliding-expiration touch — the SOLE writer of lastActivityAt/expiresAt after create.
    // The HTTP layer calls this once per authenticated request so any activity within the idle window
    // (1h) refreshes the window, keeping an active user logged in indefinitely (세션 정책: 무동작 1h 만료,
    // 로그아웃 전까지 유지). Returns the live identity (like validateSession) or undefined when absent/expired.
    /** Validate AND refresh the idle window for a live session (sliding expiration). */
    touchSession(sessionId) {
      const record = readLive(sessionId);
      if (record === undefined) {
        return undefined;
      }
      const at = now();
      record.lastActivityAt = at;
      record.expiresAt = at + idleTtlMs; // push the idle deadline forward from the moment of activity.
      return { ...record.identity };
    },

    /** REQ-AUTH-SESS-004: logout — drop the session so any reuse is rejected. */
    invalidateSession(sessionId) {
      return store.delete(sessionId);
    },
  };
}
