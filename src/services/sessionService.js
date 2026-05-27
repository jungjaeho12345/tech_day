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

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes; concrete value is a Run-stage choice (spec.md Exclusions).

function pickIdentity(user) {
  const identity = {};
  for (const field of IDENTITY_FIELDS) {
    identity[field] = user[field];
  }
  return identity;
}

/**
 * Create a server-side session service.
 * @param {{ ttlMs?: number, now?: () => number }} [options] injectable ttl + clock (testability).
 */
export function createSessionService(options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const store = new Map();

  /** Drop the session if it has passed its expiry; returns the live session or undefined. */
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
    /** REQ-AUTH-SESS-001/002/003: bind an opaque id to the user's identity (no credentials). */
    createSession(user) {
      const sessionId = randomBytes(24).toString('hex'); // opaque; encodes nothing about the user.
      store.set(sessionId, {
        identity: pickIdentity(user),
        expiresAt: now() + ttlMs,
      });
      return { sessionId };
    },

    /** Return the retained identity for a live session, else undefined. */
    getSession(sessionId) {
      const record = readLive(sessionId);
      return record === undefined ? undefined : { ...record.identity };
    },

    /** Alias used by guards: a live session's identity, else undefined (REQ-AUTH-GUARD-001..003). */
    validateSession(sessionId) {
      const record = readLive(sessionId);
      return record === undefined ? undefined : { ...record.identity };
    },

    /** REQ-AUTH-SESS-004: logout — drop the session so any reuse is rejected. */
    invalidateSession(sessionId) {
      return store.delete(sessionId);
    },
  };
}
