// @MX:ANCHOR: [AUTO] User service — user CRUD + login auth with bcrypt hashing (REQ-USR-*, fan_in >= 3).
// @MX:REASON: enforces hash-not-plaintext storage and hash-comparison login; strips the hash from all responses.
//
// User business logic for SPEC-BACKEND-CORE-001.
// Passwords are stored as bcryptjs hashes (DP-3); the hash is never returned to callers.

import bcrypt from 'bcryptjs';
import { createUserModel } from '../models/userModel.js';

const VALID_ROLES = Object.freeze(new Set(['R', 'D', 'Z']));
const SALT_ROUNDS = 10;

/** Strip the password hash before exposing a user row to any caller (REQ-USR-LOGIN-004). */
function sanitize(row) {
  if (row === undefined) {
    return undefined;
  }
  const { password, ...safe } = row;
  return safe;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createUserService(db) {
  const model = createUserModel(db);

  return {
    /** Create a user; role must be R/D/Z; password is hashed (REQ-USR-C-001). */
    create(user) {
      if (!VALID_ROLES.has(user.role)) {
        throw new Error(`invalid role "${user.role}"; expected one of R, D, Z`);
      }
      const passwordHash = bcrypt.hashSync(user.password, SALT_ROUNDS);
      model.insert({ ...user, password: passwordHash });
      return { userId: user.userId, role: user.role };
    },

    /** Query users; password hash is stripped from results (REQ-USR-Q-001, LOGIN-004). */
    query(filters) {
      return model.query(filters).map(sanitize);
    },

    /** Update fields by userId; re-hashes password when supplied (REQ-USR-U-001). */
    update(userId, fields) {
      if (model.findById(userId) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const patch = { ...fields };
      if (patch.role !== undefined && !VALID_ROLES.has(patch.role)) {
        throw new Error(`invalid role "${patch.role}"; expected one of R, D, Z`);
      }
      if (patch.password !== undefined) {
        patch.password = bcrypt.hashSync(patch.password, SALT_ROUNDS);
      }
      model.update(userId, patch);
      return { ok: true };
    },

    // @MX:NOTE: [AUTO] User "deletion" = status-based soft delete (deactivation), NOT physical DELETE
    // (SPEC-AUTH-001 REQ-AUTH-USRMGMT-003 [D-AUTH-3]; CLAUDE.md HARD rule "DB rows are never deleted").
    /** Soft-delete (deactivate) a user by userId; the User row is preserved. */
    remove(userId) {
      if (model.findById(userId) === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const changes = model.deactivate(userId);
      return { ok: changes > 0 };
    },

    /**
     * Authenticate iff userId exists, is active, AND password matches the stored hash.
     * A deactivated user is rejected (REQ-AUTH-USRMGMT-004) while the row is preserved.
     */
    login(userId, password) {
      const row = model.findById(userId);
      if (row === undefined || row.active === 'N' || !bcrypt.compareSync(password, row.password)) {
        return { ok: false };
      }
      return { ok: true, user: sanitize(row) };
    },
  };
}
