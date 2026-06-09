// @MX:ANCHOR: [AUTO] Article service — business logic for CRUD, lifecycle, search, edit lock (REQ-ARCH-002, fan_in >= 3).
// @MX:REASON: orchestrates ID generation, lifecycle reducer, soft delete, and edit-lock acquisition over the article model.
//
// Article business logic for SPEC-BACKEND-CORE-001 + SPEC-NEWS-REVISE-002 (REQ-EDIT-LOCK, REQ-API-INSERT-UPDATE-SPLIT).
// Reuses SPEC-DB-FOUNDATION-001 modules: generateArticleId and softDeleteArticle.

import { generateArticleId } from '../db/articleId.js';
import { softDeleteArticle } from '../db/softDelete.js';
import { createArticleModel } from '../models/articleModel.js';
import { transition } from './lifecycle.js';

const INITIAL_STATUS = 'RDS';
// Soft-delete KILL state by deleting role (REQ-ART-D-001): R -> RRK, D -> DDK.
// Z is admin/desk-equivalent: mirrors D (SPEC-NEWS-REVISE-001 D-6).
const KILL_BY_ROLE = Object.freeze({ R: 'RRK', D: 'DDK', Z: 'DDK' });

// SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK / Pending Decision D2-3 = (A): zombie-lock timeout 30 분.
// Locks older than this are auto-released by the next acquire attempt (race-safe single-SQL WHERE).
export const EDIT_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createArticleService(db) {
  const model = createArticleModel(db);

  /**
   * SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK helper: atomic single-SQL lock acquire.
   * Returns the SQLite info.changes (1 = acquired, 0 = locked by someone else / not found).
   * The WHERE clause includes `lockYN='N'` OR a stale lockedAt < cutoff (D2-3 zombie timeout)
   * so a stuck lock auto-releases without a separate cleanup pass.
   */
  function tryAcquireLockSql(articleId, userId, sessionId, nowIso, staleCutoffIso) {
    const info = db.prepare(`
      UPDATE Contents
         SET lockYN = 'Y',
             lockerUserId = ?,
             lockerSessionId = ?,
             lockedAt = ?
       WHERE articleId = ?
         AND (lockYN = 'N' OR lockedAt < ?)
    `).run(userId, sessionId, nowIso, articleId, staleCutoffIso);
    return Number(info.changes);
  }

  /** Internal: read current locker info (returns undefined if no row). */
  function readLock(articleId) {
    return db.prepare(
      'SELECT lockYN, lockerUserId, lockerSessionId, lockedAt FROM Contents WHERE articleId = ?',
    ).get(articleId);
  }

  return {
    /** Create an article with a unique ID and initial RDS state (REQ-ART-C-001..002). */
    create(data, options = {}) {
      const articleId = generateArticleId(db, options);
      const createdAt = data.createdAt ?? (options.now ?? new Date()).toISOString();
      model.insert(articleId, { ...data, createdAt, status: INITIAL_STATUS });
      return { articleId, status: INITIAL_STATUS };
    },

    /** Query articles by AND-combined metadata filters (REQ-ART-Q-001..003). */
    query(filters) {
      return model.query(filters);
    },

    /** Internal full-text search by title/content (REQ-SRCH-A-001). */
    searchArticles(queryText) {
      return model.searchByText(queryText);
    },

    /** Update Contents.status directly by articleId (REQ-ART-U-001..002). */
    updateStatus(articleId, status) {
      if (model.findById(articleId) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      model.updateStatus(articleId, status);
      return { ok: true, status };
    },

    /** Soft delete via lifecycle KILL state (REQ-ART-D-001..002). */
    remove(articleId, role) {
      if (model.findById(articleId) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const killStatus = KILL_BY_ROLE[role];
      if (killStatus === undefined) {
        return { ok: false, reason: 'role-not-permitted' };
      }
      softDeleteArticle(db, articleId, killStatus);
      return { ok: true, status: killStatus };
    },

    /**
     * SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — atomic edit-lock acquisition.
     *
     * Behaviour:
     *  - missing row → {ok:false, reason:'not-found'}
     *  - free lock (lockYN='N') → acquire (single-SQL race-safe), {ok:true}
     *  - stale lock (lockedAt < now - timeoutMs, D2-3 = 30분) → auto-release + acquire, {ok:true}
     *  - same user + same sessionId already holding → idempotent re-acquire (refresh lockedAt), {ok:true}
     *  - same user, DIFFERENT sessionId (D2-5 = A, 엄격) → reject {ok:false, reason:'locked'}
     *  - different user → reject {ok:false, reason:'locked'}
     */
    acquireEditLock(articleId, options) {
      const { userId, sessionId } = options ?? {};
      if (!userId || !sessionId) {
        return { ok: false, reason: 'invalid-args' };
      }
      const now = options.now ?? new Date();
      const timeoutMs = options.timeoutMs ?? EDIT_LOCK_TIMEOUT_MS;
      const nowIso = now.toISOString();
      const staleCutoffIso = new Date(now.getTime() - timeoutMs).toISOString();

      const before = readLock(articleId);
      if (before === undefined) {
        return { ok: false, reason: 'not-found' };
      }

      // Fast path — race-safe atomic acquire (free or stale lock).
      if (tryAcquireLockSql(articleId, userId, sessionId, nowIso, staleCutoffIso) === 1) {
        return { ok: true };
      }

      // Slow path — lock held by someone. Check whether it's an idempotent same-user-same-session
      // re-acquire (refresh lockedAt) vs another holder (D2-5 = A: 동일 user 다른 session도 거부).
      const current = readLock(articleId);
      if (current?.lockerUserId === userId && current?.lockerSessionId === sessionId) {
        db.prepare('UPDATE Contents SET lockedAt = ? WHERE articleId = ?').run(nowIso, articleId);
        return { ok: true };
      }
      return { ok: false, reason: 'locked' };
    },

    /**
     * SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — release the lock if the caller is the holder.
     * Idempotent: releasing an already-free lock returns {ok:true} (no-op) so beforeunload /
     * visibilitychange double-fire does not error. A non-holder release returns
     * {ok:false, reason:'not-holder'} without mutating state.
     */
    releaseEditLock(articleId, options) {
      const { userId, sessionId } = options ?? {};
      if (!userId || !sessionId) {
        return { ok: false, reason: 'invalid-args' };
      }
      const row = readLock(articleId);
      if (row === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      if (row.lockYN === 'N') {
        return { ok: true }; // already free — idempotent
      }
      if (row.lockerUserId !== userId || row.lockerSessionId !== sessionId) {
        return { ok: false, reason: 'not-holder' };
      }
      db.prepare(`
        UPDATE Contents
           SET lockYN = 'N', lockerUserId = NULL, lockerSessionId = NULL, lockedAt = NULL
         WHERE articleId = ?
      `).run(articleId);
      return { ok: true };
    },

    /**
     * SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — strict holder check used by applyAction / update gates.
     * Stale (timed-out) locks are treated as released (consistent with acquireEditLock's WHERE clause).
     */
    assertLockHolder(articleId, options) {
      const { userId, sessionId } = options ?? {};
      if (!userId || !sessionId) {
        return { ok: false, reason: 'invalid-args' };
      }
      const row = readLock(articleId);
      if (row === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      if (row.lockYN === 'N') {
        return { ok: false, reason: 'lock-required' };
      }
      const now = options.now ?? new Date();
      const timeoutMs = options.timeoutMs ?? EDIT_LOCK_TIMEOUT_MS;
      if (row.lockedAt && new Date(row.lockedAt).getTime() < now.getTime() - timeoutMs) {
        return { ok: false, reason: 'lock-required' };
      }
      if (row.lockerUserId !== userId || row.lockerSessionId !== sessionId) {
        return { ok: false, reason: 'lock-required' };
      }
      return { ok: true };
    },

    /**
     * Route a lifecycle action through the state machine and persist (REQ-WF-001, REQ-ART-LC-*).
     *
     * SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK / AC-EDIT-LOCK-6 — a LIVE edit lock held by someone other
     * than the caller blocks the transition ({ok:false, reason:'lock-required'}, state untouched).
     * A free or stale lock never blocks, so 신규 작성 송고 (just-created article, no lock) proceeds
     * unchanged. Caller identity arrives via options {userId, sessionId}; an option-less call on a
     * foreign-locked article is rejected (the caller cannot be the holder). now/timeoutMs are
     * injectable for tests (fixed-clock rule — avoids the 30-min stale time bomb).
     */
    applyAction(articleId, role, action, options) {
      const current = model.findById(articleId);
      if (current === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      if (current.lockYN === 'Y') {
        const now = options?.now ?? new Date();
        const timeoutMs = options?.timeoutMs ?? EDIT_LOCK_TIMEOUT_MS;
        const stale = current.lockedAt != null
          && new Date(current.lockedAt).getTime() < now.getTime() - timeoutMs;
        const isHolder = options?.userId != null
          && current.lockerUserId === options.userId
          && current.lockerSessionId === options.sessionId;
        if (!stale && !isHolder) {
          return { ok: false, reason: 'lock-required' };
        }
      }
      const result = transition(current.status, role, action);
      if (!result.ok) {
        return { ok: false, reason: 'invalid-transition' };
      }
      model.updateStatus(articleId, result.status);
      return { ok: true, status: result.status };
    },

    /**
     * SPEC-NEWS-REVISE-002 REQ-API-INSERT-UPDATE-SPLIT (D2-7 = A) — partial update of an existing
     * article. Only the fields EXPLICITLY present in `fields` are written; everything else is left
     * as-is. Returns {ok:false, reason:'not-found'} when the row is absent. Lifecycle transitions
     * remain the caller's responsibility (call applyAction afterwards — same path as before).
     * Locker / lockYN columns are NOT touched here — those have dedicated acquire/release endpoints.
     */
    update(articleId, fields) {
      if (model.findById(articleId) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const safe = fields ?? {};
      const articleSets = [];
      const articleValues = [];
      for (const key of ['title', 'content', 'markupVersion', 'modifier']) {
        if (Object.prototype.hasOwnProperty.call(safe, key)) {
          articleSets.push(`${key} = ?`);
          articleValues.push(safe[key] ?? null);
        }
      }
      const contentsAllowed = new Set([
        'title', 'content', 'author', 'modifier', 'sender', 'department', 'departmentCode',
        'editedAt', 'sentAt', 'distributedAt', 'embargoAt', 'secondEmbargoAt',
        // 공통정보 8 fields persisted for edit-load restore (news.md 기사 편집 기능).
        'coAuthor', 'region', 'attribute', 'keyword',
        'internalComment', 'externalComment', 'attachmentFile', 'referenceFile',
      ]);
      const contentsSets = [];
      const contentsValues = [];
      for (const key of Object.keys(safe)) {
        if (contentsAllowed.has(key)) {
          contentsSets.push(`${key} = ?`);
          contentsValues.push(safe[key] ?? null);
        }
      }
      // Wrap both table writes in one transaction so Article and Contents stay in sync.
      db.exec('BEGIN');
      try {
        if (articleSets.length > 0) {
          db.prepare(`UPDATE Article SET ${articleSets.join(', ')} WHERE articleId = ?`)
            .run(...articleValues, articleId);
        }
        if (contentsSets.length > 0) {
          db.prepare(`UPDATE Contents SET ${contentsSets.join(', ')} WHERE articleId = ?`)
            .run(...contentsValues, articleId);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { ok: true };
    },
  };
}
