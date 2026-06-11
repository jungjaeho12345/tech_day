// Injectable FAKE Model for tests (no real HTTP/WebSocket). Mirrors the backend service contracts.
// Overrides let each test shape login success/failure, search results, lifecycle results, etc.
import { assertModel } from '../model/contract.js';

export function createFakeModel(overrides = {}) {
  // Realtime subscription registry: tests grab emit to push changes through the subscription interface.
  const subscribers = new Set();
  let connected = true;

  const base = {
    async login(userId, password) {
      // Default: succeed for any non-empty credentials, returning identity WITHOUT a password hash.
      if (!userId || !password) {
        return { ok: false };
      }
      return { ok: true, user: { userId, name: 'Hong Gildong', role: 'D', department: 'Politics' } };
    },
    async queryUsers() {
      // Default department data-source rows (DP-F4).
      return [
        { department: 'Politics' },
        { department: 'Economy' },
        { department: 'Politics' },
      ];
    },
    async queryArticles() {
      return [];
    },
    async searchArticles() {
      return [];
    },
    async searchMedia(_query, _type) {
      return { items: [], error: false };
    },
    async applyAction(_articleId, role, action) {
      // Default lifecycle results, role-aware (matches src/services/lifecycle.js RDS transitions).
      // kill -> RRK (R) / DDK (D/Z); hold -> RRH (R) / DDH (D/Z);
      // send -> RDS (R) / DPS (D/Z) — mirrors news.md lifecycle table (141~148행).
      if (action === 'kill') {
        return { ok: true, status: role === 'R' ? 'RRK' : 'DDK' };
      }
      if (action === 'hold') {
        return { ok: true, status: role === 'R' ? 'RRH' : 'DDH' };
      }
      // send: R 권한은 RDS, D/Z 권한은 DPS (lifecycle.js TRANSITIONS 정합).
      return { ok: true, status: role === 'R' ? 'RDS' : 'DPS' };
    },
    async saveArticle(articleId) {
      return { ok: true, articleId: articleId ?? 'A-0001' };
    },
    // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — default succeed so tests that don't care about the lock
    // path still pass; tests that DO care override via createFakeModel({ lockArticle, ... }).
    // holder is the login session (single-arg calls); the page-scoped UUID is gone.
    async lockArticle(_articleId) {
      return { ok: true };
    },
    async unlockArticle(_articleId) {
      return { ok: true, released: true };
    },
    // SPEC-NEWS-REVISE-012 REQ-FORCE-UNLOCK — default succeed so unrelated tests still pass; tests that
    // assert the force-unlock path override via createFakeModel({ forceUnlockArticle }).
    async forceUnlockArticle(_articleId) {
      return { ok: true };
    },
    async logout() {
      // Default: end the session successfully (no real HTTP transport wired).
      return { ok: true };
    },
    subscribe(_filter, onChange) {
      const entry = { onChange };
      subscribers.add(entry);
      return {
        get connected() {
          return connected;
        },
        unsubscribe() {
          subscribers.delete(entry);
        },
      };
    },
  };

  // Lineage bridge: an older test family overrides the lock entry point as `acquireEditLock`
  // (the pre-merge method name). The canonical controller contract uses `lockArticle`, so when a
  // test supplies `acquireEditLock` we route the contract's `lockArticle` through it. Tests that
  // override `lockArticle` directly are unaffected (acquireEditLock absent => no aliasing).
  const merged = { ...base, ...overrides };
  if (typeof overrides.acquireEditLock === 'function' && overrides.lockArticle === undefined) {
    merged.lockArticle = (...args) => overrides.acquireEditLock(...args);
  }

  const model = assertModel(merged);

  // Test helpers (not part of the Model contract).
  model.__emit = (payload) => {
    for (const s of subscribers) s.onChange(payload);
  };
  model.__setConnected = (value) => {
    connected = value;
  };
  return model;
}
