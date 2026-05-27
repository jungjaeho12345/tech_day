// Tests for SPEC-BACKEND-CORE-001 lifecycle state machine (AC-10, AC-11, AC-12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition, canEdit } from '../src/services/lifecycle.js';

// AC-10: RDS-based 6 transitions
test('AC-10: RDS + R + send -> RDS', () => {
  assert.deepEqual(transition('RDS', 'R', 'send'), { ok: true, status: 'RDS' });
});

test('AC-10: RDS + R + hold -> RRH', () => {
  assert.deepEqual(transition('RDS', 'R', 'hold'), { ok: true, status: 'RRH' });
});

test('AC-10: RDS + R + kill -> RRK', () => {
  assert.deepEqual(transition('RDS', 'R', 'kill'), { ok: true, status: 'RRK' });
});

test('AC-10: RDS + D + send -> DPS', () => {
  assert.deepEqual(transition('RDS', 'D', 'send'), { ok: true, status: 'DPS' });
});

test('AC-10: RDS + D + hold -> DDH', () => {
  assert.deepEqual(transition('RDS', 'D', 'hold'), { ok: true, status: 'DDH' });
});

test('AC-10: RDS + D + kill -> DDK', () => {
  assert.deepEqual(transition('RDS', 'D', 'kill'), { ok: true, status: 'DDK' });
});

// AC-11: undefined transitions rejected, status unchanged
test('AC-11: non-RDS source state is rejected (RRH source)', () => {
  const result = transition('RRH', 'R', 'send');
  assert.equal(result.ok, false);
});

test('AC-11: unknown action is rejected', () => {
  const result = transition('RDS', 'R', 'frobnicate');
  assert.equal(result.ok, false);
});

test('AC-11: role Z performing a send action on RDS is rejected (not defined)', () => {
  const result = transition('RDS', 'Z', 'send');
  assert.equal(result.ok, false);
});

test('AC-11: rejected transition carries no status (caller leaves status unchanged)', () => {
  const result = transition('DPS', 'R', 'kill');
  assert.equal(result.ok, false);
  assert.equal(result.status, undefined);
});

// AC-12: DPS edit/portal-edit authorization
test('AC-12: DPS state allows role D edit', () => {
  assert.equal(canEdit('DPS', 'D', 'edit'), true);
});

test('AC-12: DPS state allows role D portal-edit', () => {
  assert.equal(canEdit('DPS', 'D', 'portal-edit'), true);
});

test('AC-12: DPS state denies role R edit', () => {
  assert.equal(canEdit('DPS', 'R', 'edit'), false);
});

test('AC-12: DPS state denies role Z edit', () => {
  assert.equal(canEdit('DPS', 'Z', 'edit'), false);
});

test('AC-12: non-DPS state allows R/D/Z to edit', () => {
  assert.equal(canEdit('RDS', 'R', 'edit'), true);
  assert.equal(canEdit('RDS', 'D', 'edit'), true);
  assert.equal(canEdit('RDS', 'Z', 'edit'), true);
});

test('AC-12: edit by an unknown role is denied', () => {
  assert.equal(canEdit('RDS', 'X', 'edit'), false);
});
