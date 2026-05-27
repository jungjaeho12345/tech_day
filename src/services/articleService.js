// @MX:ANCHOR: [AUTO] Article service — business logic for CRUD, lifecycle, search (REQ-ARCH-002, fan_in >= 3).
// @MX:REASON: orchestrates ID generation, lifecycle reducer, and soft delete over the article model.
//
// Article business logic for SPEC-BACKEND-CORE-001.
// Reuses SPEC-DB-FOUNDATION-001 modules: generateArticleId and softDeleteArticle.

import { generateArticleId } from '../db/articleId.js';
import { softDeleteArticle } from '../db/softDelete.js';
import { createArticleModel } from '../models/articleModel.js';
import { transition } from './lifecycle.js';

const INITIAL_STATUS = 'RDS';
// Soft-delete KILL state by deleting role (REQ-ART-D-001): R -> RRK, D -> DDK.
const KILL_BY_ROLE = Object.freeze({ R: 'RRK', D: 'DDK' });

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createArticleService(db) {
  const model = createArticleModel(db);

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

    /** Route a lifecycle action through the state machine and persist (REQ-WF-001, REQ-ART-LC-*). */
    applyAction(articleId, role, action) {
      const current = model.findById(articleId);
      if (current === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const result = transition(current.status, role, action);
      if (!result.ok) {
        return { ok: false, reason: 'invalid-transition' };
      }
      model.updateStatus(articleId, result.status);
      return { ok: true, status: result.status };
    },
  };
}
