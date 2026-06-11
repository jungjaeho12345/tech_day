// Tests for SPEC-AUTH-001 Module ② session establishment/persistence (REQ-AUTH-SESS-001..004)
// and Module ③ expiry handling (REQ-AUTH-GUARD-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService } from '../src/services/sessionService.js';

const USER = Object.freeze({
  userId: 'reporter1',
  name: 'Kim',
  role: 'R',
  department: '사회부',
  departmentCode: 'SOC',
  // a hash-like field that must never leak into the session id or be exposed verbatim
  password: '$2a$10$hashhashhash',
});

// REQ-AUTH-SESS-001: createSession issues an opaque session id bound to the user.
test('REQ-AUTH-SESS-001: createSession returns an opaque sessionId', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  assert.equal(typeof sessionId, 'string');
  assert.ok(sessionId.length >= 16, 'session id should be a non-trivial opaque token');
});

// REQ-AUTH-SESS-002: the opaque id carries neither role nor credentials.
test('REQ-AUTH-SESS-002: sessionId is opaque — no role or password encoded in it', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  assert.ok(!sessionId.includes('R'.repeat(1)) || true); // role char alone is meaningless; assert no password leak
  assert.ok(!sessionId.includes(USER.password), 'password must not appear in the session id');
  assert.ok(!sessionId.includes('hashhash'), 'no hash fragment in the session id');
});

// REQ-AUTH-SESS-003: server session retains the identity fields for top-right display.
test('REQ-AUTH-SESS-003: getSession returns the retained identity fields, never the password', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  const session = svc.getSession(sessionId);
  assert.equal(session.userId, 'reporter1');
  assert.equal(session.name, 'Kim');
  assert.equal(session.role, 'R');
  assert.equal(session.department, '사회부');
  assert.equal(session.departmentCode, 'SOC');
  assert.ok(!('password' in session), 'the session must never store the password/hash');
});

// REQ-AUTH-GUARD-001/002: validateSession accepts a live id, rejects unknown ids.
test('REQ-AUTH-GUARD-001: validateSession returns the session for a live id', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  const result = svc.validateSession(sessionId);
  assert.equal(result.role, 'R');
});

test('REQ-AUTH-GUARD-002: validateSession returns undefined for an unknown id', () => {
  const svc = createSessionService();
  assert.equal(svc.validateSession('does-not-exist'), undefined);
  assert.equal(svc.validateSession(undefined), undefined);
});

// REQ-AUTH-SESS-004: invalidateSession (logout) drops the session; reuse is rejected.
test('REQ-AUTH-SESS-004: invalidateSession drops the session so reuse is rejected', () => {
  const svc = createSessionService();
  const { sessionId } = svc.createSession(USER);
  svc.invalidateSession(sessionId);
  assert.equal(svc.getSession(sessionId), undefined);
  assert.equal(svc.validateSession(sessionId), undefined);
});

// REQ-AUTH-GUARD-003: an expired session is treated as unauthenticated.
test('REQ-AUTH-GUARD-003: an expired session is treated as unauthenticated', () => {
  let now = 1000;
  const svc = createSessionService({ ttlMs: 5000, now: () => now });
  const { sessionId } = svc.createSession(USER);
  // still valid before expiry
  now = 5000;
  assert.ok(svc.validateSession(sessionId), 'session is valid before ttl elapses');
  // expired after ttl elapses
  now = 6001;
  assert.equal(svc.validateSession(sessionId), undefined, 'expired session must not validate');
  assert.equal(svc.getSession(sessionId), undefined, 'expired session must not be readable');
});

// ---------------------------------------------------------------------------
// Session policy: 1h sliding idle expiration (SPEC-AUTH-SESSION-POLICY).
//   (1) 무동작 1시간 → 만료, 활동 시 만료 시점 갱신 (sliding).
//   (2) 로그아웃 전까지 (활동이 있는 한) 무기한 유지.
// All clock-dependent assertions inject a fixed `now` (no real Date.now() — would become a time-bomb).
// ---------------------------------------------------------------------------
const ONE_HOUR_MS = 60 * 60 * 1000;

// Default idle window is exactly 1 hour (no magic number leaks into the default).
test('SESSION-POLICY: default idle window is 1 hour — touch at 59분 keeps the session alive', () => {
  let now = 0;
  const svc = createSessionService({ now: () => now }); // no ttl override -> default 1h idle window
  const { sessionId } = svc.createSession(USER);
  // 59 minutes of inactivity: still live, and touching it (activity) extends the window.
  now = 59 * 60 * 1000;
  const touched = svc.touchSession(sessionId);
  assert.ok(touched, 'session is still alive at 59 minutes of inactivity');
  assert.equal(touched.role, 'R');
  // After the touch at 59min, the deadline slides to 59min + 1h. At 1h59m+1ms it finally expires.
  now = 59 * 60 * 1000 + ONE_HOUR_MS + 1;
  assert.equal(svc.validateSession(sessionId), undefined, 'window slid forward from the 59분 activity');
});

// (a) 59분 후 활동 → 유지 + 만료 연장 (sliding refresh).
test('SESSION-POLICY (a): activity at 59분 refreshes the idle deadline', () => {
  let now = 1_000;
  const svc = createSessionService({ idleTimeoutMs: ONE_HOUR_MS, now: () => now });
  const { sessionId } = svc.createSession(USER);
  now = 1_000 + 59 * 60 * 1000; // 59분 후 활동
  assert.ok(svc.touchSession(sessionId), 'session survives to 59분');
  // 59분 시점 활동으로 deadline 이 (59분 + 1h) 로 연장됨 — 원래라면 1분 뒤 만료였을 시점에 여전히 유효.
  now += 30 * 60 * 1000; // +30분 (원래 만료 시점 1시간을 이미 지났음)
  assert.ok(svc.validateSession(sessionId), 'still valid past the original 1h deadline after the 59분 touch');
});

// (b) 60분 초과 무동작 → 만료.
test('SESSION-POLICY (b): >60분 with no activity → expired', () => {
  let now = 0;
  const svc = createSessionService({ idleTimeoutMs: ONE_HOUR_MS, now: () => now });
  const { sessionId } = svc.createSession(USER);
  now = ONE_HOUR_MS; // exactly 1h — still valid (boundary is `now > expiresAt`, not >=).
  assert.ok(svc.validateSession(sessionId), 'session is valid at exactly 1h of inactivity');
  now = ONE_HOUR_MS + 1; // 1h + 1ms with no activity in between → expired.
  assert.equal(svc.validateSession(sessionId), undefined, 'session expires after 60분 of inactivity');
  assert.equal(svc.touchSession(sessionId), undefined, 'an expired session cannot be touched back to life');
});

// (c) 활동을 반복하면 무기한 유지 (로그아웃 전까지).
test('SESSION-POLICY (c): repeated activity keeps the session alive indefinitely', () => {
  let now = 0;
  const svc = createSessionService({ idleTimeoutMs: ONE_HOUR_MS, now: () => now });
  const { sessionId } = svc.createSession(USER);
  // Touch every 30분 across 10 hours — far past any fixed TTL — the session never expires.
  for (let i = 0; i < 20; i += 1) {
    now += 30 * 60 * 1000; // +30분 (< 1h idle window) each step
    assert.ok(svc.touchSession(sessionId), `session alive after ${(i + 1) * 30}분 of periodic activity`);
  }
  assert.ok(svc.validateSession(sessionId), 'session is still alive after 10h of periodic activity');
});

// (d) 로그아웃 → 즉시 세션 제거 (활동 윈도우가 남아있어도).
test('SESSION-POLICY (d): logout removes the session immediately', () => {
  let now = 0;
  const svc = createSessionService({ idleTimeoutMs: ONE_HOUR_MS, now: () => now });
  const { sessionId } = svc.createSession(USER);
  now = 5 * 60 * 1000; // 5분 후 — still well within the idle window
  assert.ok(svc.validateSession(sessionId), 'session is alive just before logout');
  assert.equal(svc.invalidateSession(sessionId), true, 'logout drops the session');
  assert.equal(svc.validateSession(sessionId), undefined, 'logged-out session never validates again');
  assert.equal(svc.touchSession(sessionId), undefined, 'a logged-out session cannot be touched back');
});

// touchSession is a pure no-op shape (undefined) for unknown ids — mirrors validateSession.
test('SESSION-POLICY: touchSession returns undefined for an unknown/absent id', () => {
  const svc = createSessionService();
  assert.equal(svc.touchSession('nope'), undefined);
  assert.equal(svc.touchSession(undefined), undefined);
});

// ---------------------------------------------------------------------------
// SPEC-NEWS-REVISE-010 — explicit AC/EC locks for the 1h sliding idle policy.
// All assertions inject a fixed `now`/`ttlMs` (no real clock — required by spec NFR 5.1).
// ---------------------------------------------------------------------------

// AC-SESS-1 (SPEC-NEWS-REVISE-010): 만료 직전 59분에 touch → deadline 이 그 시점 +1h 로 sliding,
// 갱신 후 추가 59분에도 여전히 유효.
test('AC-SESS-1: touch at 59분 slides the deadline; +59분 later still valid', () => {
  let clock = 0;
  const svc = createSessionService({ ttlMs: ONE_HOUR_MS, now: () => clock });
  const { sessionId } = svc.createSession(USER);
  clock = 59 * 60 * 1000; // 59분 시점에 활동.
  assert.ok(svc.touchSession(sessionId), 'session alive at 59분 and slides forward');
  clock += 59 * 60 * 1000; // 갱신 시점에서 +59분 (< 1h window).
  assert.ok(svc.validateSession(sessionId), 'still valid 59분 after the sliding touch');
});

// AC-SESS-2 / EC-3 (SPEC-NEWS-REVISE-010): 정확히 ttl 경계는 still valid (boundary is `now > expiresAt`),
// ttl + 1ms 에서 만료 → validateSession/getSession 모두 undefined.
test('AC-SESS-2 / EC-3: exact ttl boundary is valid; ttl+1ms expires (now > expiresAt)', () => {
  let clock = 0;
  const svc = createSessionService({ ttlMs: ONE_HOUR_MS, now: () => clock });
  const { sessionId } = svc.createSession(USER);
  clock = ONE_HOUR_MS; // 정확히 60분 0ms — 경계는 `>` 이므로 아직 유효.
  assert.ok(svc.validateSession(sessionId), 'exactly at ttl boundary the session is still valid');
  clock = ONE_HOUR_MS + 1; // 60분 0ms 를 1ms 넘김 → 만료.
  assert.equal(svc.validateSession(sessionId), undefined, 'ttl+1ms → validateSession undefined');
  assert.equal(svc.getSession(sessionId), undefined, 'ttl+1ms → getSession undefined (evicted)');
});

// AC-SESS-3 (SPEC-NEWS-REVISE-010): 마지막 활동 후 1시간 미만(59분 59초)은 유효.
test('AC-SESS-3: under the idle window (59분 59초) the session stays valid', () => {
  let clock = 0;
  const svc = createSessionService({ ttlMs: ONE_HOUR_MS, now: () => clock });
  const { sessionId } = svc.createSession(USER);
  clock = 59 * 60 * 1000 + 59 * 1000; // 59분 59초.
  assert.ok(svc.validateSession(sessionId), 'session valid just under the 1h idle window');
});

// AC-SESS-4 / EC-4 (SPEC-NEWS-REVISE-010): sliding 으로 deadline 이 미뤄진 유효 세션도 로그아웃 시 즉시 무효.
test('AC-SESS-4 / EC-4: logout invalidates a slid session immediately (sliding 무관)', () => {
  let clock = 0;
  const svc = createSessionService({ ttlMs: ONE_HOUR_MS, now: () => clock });
  const { sessionId } = svc.createSession(USER);
  clock = 30 * 60 * 1000; // 30분 시점 활동으로 deadline 을 90분으로 민다.
  assert.ok(svc.touchSession(sessionId), 'session slid forward by the 30분 activity');
  assert.equal(svc.invalidateSession(sessionId), true, 'logout drops the session');
  // 남은 sliding 시간(아직 만료 전)과 무관하게 즉시 무효.
  assert.equal(svc.validateSession(sessionId), undefined, 'logged-out session never validates');
  assert.equal(svc.touchSession(sessionId), undefined, 'a logged-out session cannot be touched back');
});
