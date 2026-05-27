// @MX:NOTE: [AUTO] Soft-delete guard — enforces "DB rows are never physically deleted" (REQ-DEL-001..003).
//
// Soft delete for SPEC-DB-FOUNDATION-001.
// Deletion is represented by setting Contents.status to a KILL state (RRK/DDK).
// No physical SQL DELETE is ever issued and no `deleted` flag column exists.

import { KILL_STATUSES } from './schema.js';

/**
 * Soft-delete an article by moving its Contents.status to a KILL state.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 * @param {string} killStatus one of 'RRK' | 'DDK'
 * @returns {string} the applied KILL status
 */
export function softDeleteArticle(db, articleId, killStatus) {
  if (!KILL_STATUSES.has(killStatus)) {
    throw new Error(
      `softDeleteArticle requires a KILL status (RRK or DDK); received "${killStatus}"`,
    );
  }
  db.prepare('UPDATE Contents SET status = ? WHERE articleId = ?').run(killStatus, articleId);
  return killStatus;
}
