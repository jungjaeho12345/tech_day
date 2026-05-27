// @MX:ANCHOR: [AUTO] Article model — the only layer issuing SQL against Article/Contents (REQ-ARCH-003, fan_in >= 3).
// @MX:REASON: centralizes all Article/Contents SQL so the service layer stays SQL-free per the MVC contract.
//
// Article/Contents data-access layer for SPEC-BACKEND-CORE-001.
// No business logic lives here — only parameterized SQL. Soft delete and ID
// generation are delegated to the reused SPEC-DB-FOUNDATION-001 modules from the service layer.

const QUERY_FILTERS = Object.freeze({
  distributedAt: 'distributedAt',
  createdAt: 'createdAt',
  articleId: 'articleId',
  author: 'author',
  sender: 'sender',
});

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createArticleModel(db) {
  return {
    /** Insert the shared row into both Article and Contents tables. */
    insert(articleId, data) {
      db.prepare(
        'INSERT INTO Article (articleId, title, content, markupVersion, modifier) VALUES (?,?,?,?,?)',
      ).run(articleId, data.title ?? null, data.content ?? null, data.markupVersion ?? null, data.modifier ?? null);
      db.prepare(
        `INSERT INTO Contents (articleId, title, content, author, modifier, sender,
          department, departmentCode, createdAt, editedAt, sentAt, distributedAt,
          embargoAt, secondEmbargoAt, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        articleId, data.title ?? null, data.content ?? null, data.author ?? null,
        data.modifier ?? null, data.sender ?? null, data.department ?? null,
        data.departmentCode ?? null, data.createdAt ?? null, data.editedAt ?? null,
        data.sentAt ?? null, data.distributedAt ?? null, data.embargoAt ?? null,
        data.secondEmbargoAt ?? null, data.status,
      );
    },

    findById(articleId) {
      return db.prepare('SELECT * FROM Contents WHERE articleId = ?').get(articleId);
    },

    /** Query Contents by an AND-combination of the supported metadata filters. */
    query(filters = {}) {
      const clauses = [];
      const values = [];
      for (const [key, column] of Object.entries(QUERY_FILTERS)) {
        if (filters[key] !== undefined && filters[key] !== null) {
          clauses.push(`${column} = ?`);
          values.push(filters[key]);
        }
      }
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(`SELECT * FROM Contents${where}`).all(...values);
    },

    /** Full-text-ish search over title/content. */
    searchByText(queryText) {
      const like = `%${queryText}%`;
      return db.prepare(
        'SELECT * FROM Contents WHERE title LIKE ? OR content LIKE ?',
      ).all(like, like);
    },

    /** Persist a new status for an existing article. Returns number of affected rows. */
    updateStatus(articleId, status) {
      const info = db.prepare('UPDATE Contents SET status = ? WHERE articleId = ?').run(status, articleId);
      return Number(info.changes);
    },
  };
}
