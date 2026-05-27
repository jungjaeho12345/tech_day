// Tests for SPEC-AUTH-001 Module ④ role-based authorization (REQ-AUTH-ROLE-001..004)
// and Module ⑤ user-management authorization gate (REQ-AUTH-USRMGMT-001/002).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditArticle,
  canPerformDpsEdit,
  canManageUsers,
  assertAuthorized,
} from '../src/services/authorization.js';

// REQ-AUTH-ROLE-001: R, D, Z may all edit an article (generic edit).
test('REQ-AUTH-ROLE-001: canEditArticle permits R, D, and Z', () => {
  assert.equal(canEditArticle('R'), true);
  assert.equal(canEditArticle('D'), true);
  assert.equal(canEditArticle('Z'), true);
});

test('REQ-AUTH-ROLE-001: canEditArticle denies an unknown role', () => {
  assert.equal(canEditArticle('Q'), false);
  assert.equal(canEditArticle(undefined), false);
});

// REQ-AUTH-ROLE-002: in DPS, only D may 고침/포털고침; R and Z are denied.
test('REQ-AUTH-ROLE-002: canPerformDpsEdit permits only D', () => {
  assert.equal(canPerformDpsEdit('D'), true);
  assert.equal(canPerformDpsEdit('R'), false);
  assert.equal(canPerformDpsEdit('Z'), false);
});

// REQ-AUTH-USRMGMT-001/002: only Z may manage users.
test('REQ-AUTH-USRMGMT-001: canManageUsers permits only Z', () => {
  assert.equal(canManageUsers('Z'), true);
  assert.equal(canManageUsers('R'), false);
  assert.equal(canManageUsers('D'), false);
});

// REQ-AUTH-ROLE-004: the acting role is taken from the validated session, never a client value.
test('REQ-AUTH-ROLE-004: assertAuthorized derives role from the session, ignoring client-supplied role', () => {
  const session = { role: 'R' }; // real session role
  // A forged client role of D must be irrelevant — assertAuthorized reads session.role only.
  const result = assertAuthorized(session, 'dps-edit', { clientRole: 'D' });
  assert.equal(result.ok, false, 'forged client role must not grant DPS edit to an R session');
  assert.equal(result.reason, 'forbidden');
});

// REQ-AUTH-ROLE-003: a forbidden action is rejected before any transition is computed.
test('REQ-AUTH-ROLE-003: assertAuthorized rejects a forbidden DPS edit (R session) up front', () => {
  const result = assertAuthorized({ role: 'R' }, 'dps-edit');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
});

test('REQ-AUTH-ROLE-002: assertAuthorized allows a DPS edit for a D session', () => {
  const result = assertAuthorized({ role: 'D' }, 'dps-edit');
  assert.equal(result.ok, true);
});

test('REQ-AUTH-USRMGMT-002: assertAuthorized rejects user management for non-Z sessions', () => {
  assert.equal(assertAuthorized({ role: 'D' }, 'manage-users').ok, false);
  assert.equal(assertAuthorized({ role: 'Z' }, 'manage-users').ok, true);
});

test('REQ-AUTH-ROLE-001: assertAuthorized allows generic edit for R/D/Z', () => {
  assert.equal(assertAuthorized({ role: 'R' }, 'edit').ok, true);
  assert.equal(assertAuthorized({ role: 'D' }, 'edit').ok, true);
  assert.equal(assertAuthorized({ role: 'Z' }, 'edit').ok, true);
});

// GUARD: a missing/invalid session is unauthenticated, not merely forbidden.
test('REQ-AUTH-GUARD-002: assertAuthorized rejects a missing session as unauthenticated', () => {
  const result = assertAuthorized(undefined, 'edit');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unauthenticated');
});
