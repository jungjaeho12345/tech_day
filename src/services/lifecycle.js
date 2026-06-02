// @MX:NOTE: [AUTO] Lifecycle reducer — pure (state, role, action) -> next state mapping (REQ-ART-LC-001..008).
//
// Lifecycle state machine for SPEC-BACKEND-CORE-001.
// Only the RDS-based transitions defined in news.md (DP-4) are permitted; every
// other (state, role, action) combination is rejected with the status left unchanged.

// Transition table keyed by `${state}|${role}|${action}` => next state.
// Source state is always RDS per the confirmed transition table (REQ-ART-LC-001..006).
const TRANSITIONS = Object.freeze({
  'RDS|R|send': 'RDS',
  'RDS|R|hold': 'RRH',
  'RDS|R|kill': 'RRK',
  'RDS|D|send': 'DPS',
  'RDS|D|hold': 'DDH',
  'RDS|D|kill': 'DDK',
  // @MX:NOTE: [AUTO] Z권한 전이는 D권한과 동일 매핑 (SPEC-NEWS-REVISE-001 D-6).
  // news.md "Z=관리자 + 데스크 편집 권한"이 D와 의미적으로 정렬되므로 D-mirror 적용.
  'RDS|Z|send': 'DPS',
  'RDS|Z|hold': 'DDH',
  'RDS|Z|kill': 'DDK',
});

const ROLES = Object.freeze(new Set(['R', 'D', 'Z']));
const EDIT_ACTIONS = Object.freeze(new Set(['edit', 'portal-edit']));

/**
 * Compute the next lifecycle state for a (state, role, action) triple.
 * @param {string} state current Contents.status
 * @param {string} role one of R | D | Z
 * @param {string} action send | hold | kill
 * @returns {{ ok: true, status: string } | { ok: false }} result; on rejection no status is returned
 */
export function transition(state, role, action) {
  const next = TRANSITIONS[`${state}|${role}|${action}`];
  if (next === undefined) {
    return { ok: false };
  }
  return { ok: true, status: next };
}

/**
 * Decide whether a role may edit (고침/포털고침) an article in a given state.
 * In DPS only role D may use edit/portal-edit (REQ-ART-AUTH-002); otherwise R/D/Z may edit.
 * @param {string} state current Contents.status
 * @param {string} role one of R | D | Z
 * @param {string} action edit | portal-edit (or any other edit action)
 * @returns {boolean}
 */
export function canEdit(state, role, action) {
  if (!ROLES.has(role)) {
    return false;
  }
  if (state === 'DPS' && EDIT_ACTIONS.has(action)) {
    return role === 'D';
  }
  return true;
}
