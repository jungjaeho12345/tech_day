// @MX:ANCHOR: [AUTO] Authorization layer — role-based permission checks for SPEC-AUTH-001 (fan_in >= 3).
// @MX:REASON: single gate run before any lifecycle transition; controllers + tests depend on it to enforce R/D/Z rules.
//
// Role-based authorization check layer for SPEC-AUTH-001 Modules ④ and ⑤ [D-AUTH-4].
// This layer owns ONLY the permission check; the lifecycle transition computation stays in
// SPEC-BACKEND-CORE-001 (src/services/lifecycle.js). The acting role is derived exclusively
// from a validated server-side session (REQ-AUTH-ROLE-004) — never from a client-supplied value.

const EDIT_ROLES = Object.freeze(new Set(['R', 'D', 'Z']));

// @MX:NOTE: [AUTO] Business rule — generic article edit is open to R/D/Z (REQ-AUTH-ROLE-001).
export function canEditArticle(role) {
  return EDIT_ROLES.has(role);
}

// @MX:NOTE: [AUTO] Business rule — in DPS state, only D may 고침/포털고침; R and Z denied (REQ-AUTH-ROLE-002).
export function canPerformDpsEdit(role) {
  return role === 'D';
}

// @MX:NOTE: [AUTO] Business rule — only Z (관리자) may create/update/deactivate users (REQ-AUTH-USRMGMT-001).
export function canManageUsers(role) {
  return role === 'Z';
}

// Action -> permission predicate. 'dps-edit' covers 고침/포털고침 on a DPS article.
const ACTION_RULES = Object.freeze({
  'edit': canEditArticle,
  'dps-edit': canPerformDpsEdit,
  'manage-users': canManageUsers,
});

/**
 * Authorize an action for a validated session, BEFORE any lifecycle transition is computed
 * (REQ-AUTH-ROLE-003). The role is read only from `session.role` (REQ-AUTH-ROLE-004); any
 * client-supplied role passed via context is ignored by design.
 *
 * @param {{ role: string } | undefined} session the validated server-side session
 * @param {string} action one of 'edit' | 'dps-edit' | 'manage-users'
 * @returns {{ ok: true } | { ok: false, reason: 'unauthenticated' | 'forbidden' }}
 */
export function assertAuthorized(session, action) {
  if (session === undefined || session === null || session.role === undefined) {
    return { ok: false, reason: 'unauthenticated' };
  }
  const rule = ACTION_RULES[action];
  if (rule === undefined || !rule(session.role)) {
    return { ok: false, reason: 'forbidden' };
  }
  return { ok: true };
}
