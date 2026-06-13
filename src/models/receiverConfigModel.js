// @MX:ANCHOR: [AUTO] ReceiverConfig model — the only layer issuing SQL against ReceiverConfig
// (REQ-RCV-MGMT-*, expected fan_in >= 3 across the config service + whitelist + collection pipeline).
// @MX:REASON: centralizes all ReceiverConfig SQL so the service/whitelist layers stay SQL-free,
// matching the MVC contract used by articleModel/userModel.
//
// ReceiverConfig data-access layer for SPEC-RCV-COLLECT-001 (DP-RCV-3). Parameterized SQL only;
// no business logic. Holds API settings, FTP send settings, and receive/whitelist settings.

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createReceiverConfigModel(db) {
  return {
    /** Insert a receiver-configuration entry. `config` is stored as a JSON string. */
    insert(entry) {
      db.prepare(
        'INSERT INTO ReceiverConfig (id, kind, sourceId, config, createdAt) VALUES (?,?,?,?,?)',
      ).run(
        entry.id, entry.kind ?? null, entry.sourceId ?? null,
        entry.config ?? null, entry.createdAt ?? null,
      );
    },

    findById(id) {
      return db.prepare('SELECT * FROM ReceiverConfig WHERE id = ?').get(id);
    },

    /** List all entries, optionally filtered by kind. */
    query(filters = {}) {
      const clauses = [];
      const values = [];
      if (filters.kind !== undefined && filters.kind !== null && filters.kind !== '') {
        clauses.push('kind = ?');
        values.push(filters.kind);
      }
      if (filters.sourceId !== undefined && filters.sourceId !== null && filters.sourceId !== '') {
        clauses.push('sourceId = ?');
        values.push(filters.sourceId);
      }
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(`SELECT * FROM ReceiverConfig${where} ORDER BY id`).all(...values);
    },

    /**
     * Whitelist lookup: does a receive-kind entry exist for this sourceId? (REQ-RCV-WHITELIST-001).
     * Only 'receive' entries form the ingest whitelist — api/ftp-send settings are outbound config.
     */
    isWhitelisted(sourceId) {
      if (sourceId === undefined || sourceId === null || sourceId === '') {
        return false;
      }
      const row = db.prepare(
        "SELECT 1 FROM ReceiverConfig WHERE kind = 'receive' AND sourceId = ?",
      ).get(sourceId);
      return row !== undefined;
    },

    // @MX:NOTE: [AUTO] DELETE here removes ONLY a configuration row. Collected Article/Contents rows
    // are NEVER touched (REQ-RCV-MGMT-004) — the DB no-delete rule applies to article data, not to
    // operational config which rcv.md explicitly allows deleting (조회/생성/삭제).
    /** Delete a configuration entry by id. Returns number of affected rows. */
    remove(id) {
      const info = db.prepare('DELETE FROM ReceiverConfig WHERE id = ?').run(id);
      return Number(info.changes);
    },
  };
}
