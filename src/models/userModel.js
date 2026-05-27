// @MX:ANCHOR: [AUTO] User model — the only layer issuing SQL against User (REQ-ARCH-003, fan_in >= 3).
// @MX:REASON: centralizes all User SQL; password hashing/verification belongs to the service layer.
//
// User data-access layer for SPEC-BACKEND-CORE-001. Parameterized SQL only; no business logic.

const UPDATABLE_COLUMNS = Object.freeze([
  'name', 'password', 'role', 'department', 'departmentCode',
]);

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createUserModel(db) {
  return {
    insert(user) {
      db.prepare(
        'INSERT INTO User (userId, name, password, role, department, departmentCode) VALUES (?,?,?,?,?,?)',
      ).run(
        user.userId, user.name ?? null, user.password, user.role,
        user.department ?? null, user.departmentCode ?? null,
      );
    },

    findById(userId) {
      return db.prepare('SELECT * FROM User WHERE userId = ?').get(userId);
    },

    query(filters = {}) {
      const clauses = [];
      const values = [];
      if (filters.userId !== undefined && filters.userId !== null) {
        clauses.push('userId = ?');
        values.push(filters.userId);
      }
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(`SELECT * FROM User${where}`).all(...values);
    },

    update(userId, fields) {
      const sets = [];
      const values = [];
      for (const col of UPDATABLE_COLUMNS) {
        if (fields[col] !== undefined) {
          sets.push(`${col} = ?`);
          values.push(fields[col]);
        }
      }
      if (sets.length === 0) {
        return 0;
      }
      values.push(userId);
      const info = db.prepare(`UPDATE User SET ${sets.join(', ')} WHERE userId = ?`).run(...values);
      return Number(info.changes);
    },

    remove(userId) {
      const info = db.prepare('DELETE FROM User WHERE userId = ?').run(userId);
      return Number(info.changes);
    },
  };
}
