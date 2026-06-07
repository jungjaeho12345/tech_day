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
  // SPEC-FRONTEND-UI-001 v0.4.0 — 부서별 작성/송고 menus filter by department. Previously this key
  // was silently ignored (not in QUERY_FILTERS), so department menu queries returned ALL rows.
  department: 'department',
});

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createArticleModel(db) {
  return {
    /**
     * Insert the shared row into both Article and Contents tables.
     * SPEC-NEWS-REVISE-002 REQ-DB-LOCKYN: explicit `lockYN` (default 'N' when unspecified) so the
     * NOT NULL constraint is satisfied even when callers don't supply it.
     */
    insert(articleId, data) {
      db.prepare(
        'INSERT INTO Article (articleId, title, content, markupVersion, modifier) VALUES (?,?,?,?,?)',
      ).run(articleId, data.title ?? null, data.content ?? null, data.markupVersion ?? null, data.modifier ?? null);
      db.prepare(
        `INSERT INTO Contents (articleId, title, content, author, modifier, sender,
          department, departmentCode, createdAt, editedAt, sentAt, distributedAt,
          embargoAt, secondEmbargoAt, status, lockYN,
          coAuthor, region, attribute, keyword,
          internalComment, externalComment, attachmentFile, referenceFile)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        articleId, data.title ?? null, data.content ?? null, data.author ?? null,
        data.modifier ?? null, data.sender ?? null, data.department ?? null,
        data.departmentCode ?? null, data.createdAt ?? null, data.editedAt ?? null,
        data.sentAt ?? null, data.distributedAt ?? null, data.embargoAt ?? null,
        data.secondEmbargoAt ?? null, data.status, data.lockYN ?? 'N',
        // 공통정보 8 fields persisted so edit-load can restore them (news.md 기사 편집 기능).
        data.coAuthor ?? null, data.region ?? null, data.attribute ?? null, data.keyword ?? null,
        data.internalComment ?? null, data.externalComment ?? null,
        data.attachmentFile ?? null, data.referenceFile ?? null,
      );
    },

    findById(articleId) {
      return db.prepare('SELECT * FROM Contents WHERE articleId = ?').get(articleId);
    },

    /**
     * Query Contents by an AND-combination of the supported metadata filters.
     * Rows are joined with Article.markupVersion (LEFT JOIN on the shared PK) so an edit-load
     * fetch (`query({ articleId })`) can repaint the editor body — markupVersion lives ONLY in
     * the Article table and was previously absent from these rows (편집 진입 시 빈 화면 원인).
     * Filter columns are c.-qualified because articleId/title/content exist in BOTH tables.
     */
    query(filters = {}) {
      const clauses = [];
      const values = [];
      for (const [key, column] of Object.entries(QUERY_FILTERS)) {
        if (filters[key] !== undefined && filters[key] !== null) {
          // department filter — comma-separated multi-value supported (e.g. 'Politics,Economy').
          if (key === 'department') {
            const depts = String(filters[key]).split(',').filter(Boolean);
            if (depts.length > 0) {
              clauses.push(`c.${column} IN (${depts.map(() => '?').join(',')})`);
              values.push(...depts);
            }
          } else {
            clauses.push(`c.${column} = ?`);
            values.push(filters[key]);
          }
        }
      }
      // status filter — comma-separated multi-value supported (e.g. 'RDS,DDH' from 데스크 미송고).
      // Previously status was silently ignored (not in QUERY_FILTERS), so menu filters returned all rows.
      if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
        const statuses = Array.isArray(filters.status)
          ? filters.status.filter(Boolean)
          : String(filters.status).split(',').filter(Boolean);
        if (statuses.length > 0) {
          clauses.push(`c.status IN (${statuses.map(() => '?').join(',')})`);
          values.push(...statuses);
        } else if (Array.isArray(filters.status)) {
          // 명시적 빈 배열은 "아무 상태도 매칭하지 않음" — 전체 반환이 아니라 0건이어야 안전하다.
          clauses.push('1 = 0');
        }
      }
      // statusNot filter — comma-separated exclusion (e.g. 'DPS,RRH' from 부서별 작성).
      // Mirrors the status IN clause as NOT IN so menu filters can exclude lifecycle states.
      if (filters.statusNot !== undefined && filters.statusNot !== null && filters.statusNot !== '') {
        const excluded = String(filters.statusNot).split(',').filter(Boolean);
        if (excluded.length > 0) {
          clauses.push(`c.status NOT IN (${excluded.map(() => '?').join(',')})`);
          values.push(...excluded);
        }
      }
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(
        `SELECT c.*, a.markupVersion AS markupVersion
           FROM Contents c
           LEFT JOIN Article a ON a.articleId = c.articleId${where}`,
      ).all(...values);
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
