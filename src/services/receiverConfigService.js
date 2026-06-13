// @MX:ANCHOR: [AUTO] ReceiverConfig service — receiver/API/FTP setting CRUD + whitelist source
// for rcvMgmt.do (REQ-RCV-MGMT-001..006, expected fan_in >= 3: controllers + collection pipeline + tests).
// @MX:REASON: the single business-logic gate for receiver settings; the whitelist that gates ingest
// (REQ-RCV-WHITELIST-001) and the rcvMgmt.do CRUD both route through here.
//
// Receiver-configuration business logic for SPEC-RCV-COLLECT-001 (DP-RCV-3, DP-RCV-6).
// Authorization (Z-only) is NOT enforced here — it is enforced at the controller/route boundary
// from the validated session role, matching the authorization.js + userService split used elsewhere.

import { createReceiverConfigModel } from '../models/receiverConfigModel.js';
import { RECEIVER_CONFIG_KINDS } from '../db/schema.js';

const RANDOM_MAX = 1_000_000_000;

/** Generate a unique receiver-config id ('RCV' + random 9 digits), regenerating on collision. */
function generateConfigId(model, options = {}) {
  const randomFn = options.randomFn ?? (() => Math.floor(Math.random() * RANDOM_MAX));
  for (;;) {
    const id = `RCV${randomFn().toString().padStart(9, '0')}`;
    if (model.findById(id) === undefined) {
      return id;
    }
  }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createReceiverConfigService(db) {
  const model = createReceiverConfigModel(db);

  return {
    /** REQ-RCV-MGMT-001 — list configuration entries (optionally filtered by kind/sourceId). */
    query(filters = {}) {
      return model.query(filters).map((row) => ({
        ...row,
        // Surface the parsed config object alongside the raw string for convenience.
        config: row.config == null ? null : safeParse(row.config),
      }));
    },

    /**
     * REQ-RCV-MGMT-002 — create a configuration entry. `kind` must be one of api/ftp-send/receive.
     * A 'receive' entry MUST carry a sourceId (it is a whitelist member). `config` is persisted as JSON.
     */
    create(entry, options = {}) {
      const kind = entry?.kind;
      if (!RECEIVER_CONFIG_KINDS.has(kind)) {
        return { ok: false, reason: 'invalid-kind' };
      }
      if (kind === 'receive' && (entry.sourceId === undefined || entry.sourceId === null || entry.sourceId === '')) {
        return { ok: false, reason: 'missing-sourceId' };
      }
      const id = generateConfigId(model, options);
      const createdAt = entry.createdAt ?? (options.now ?? new Date()).toISOString();
      model.insert({
        id,
        kind,
        sourceId: entry.sourceId ?? null,
        config: entry.config === undefined ? null : JSON.stringify(entry.config),
        createdAt,
      });
      return { ok: true, id };
    },

    /**
     * REQ-RCV-MGMT-003 — delete a configuration entry by id. REQ-RCV-MGMT-004: this removes ONLY the
     * config row; already-collected Article/Contents rows are untouched (enforced by scope — this
     * service never issues DELETE against Article/Contents).
     */
    remove(id) {
      if (model.findById(id) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const changes = model.remove(id);
      return { ok: changes > 0 };
    },

    /** REQ-RCV-WHITELIST-001 — is this source/sender ID a registered receive whitelist member? */
    isWhitelisted(sourceId) {
      return model.isWhitelisted(sourceId);
    },
  };
}

/** Parse a JSON config string, returning the raw string if it is not valid JSON. */
function safeParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString;
  }
}
