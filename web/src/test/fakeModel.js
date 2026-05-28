// Injectable FAKE Model for tests (no real HTTP/WebSocket). Mirrors the backend service contracts.
// Overrides let each test shape login success/failure, search results, lifecycle results, etc.
import { assertModel } from '../model/contract.js';

export function createFakeModel(overrides = {}) {
  // Realtime subscription registry: tests grab `emit` to push changes through the subscription interface.
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
    async searchMedia() {
      return { items: [], error: false };
    },
    async applyAction(_articleId, role, action) {
      // Default lifecycle results, role-aware (matches src/services/lifecycle.js RDS transitions).
      // kill -> RRK (R) / DDK (D); hold -> RRH (R) / DDH (D); send -> DPS (D default).
      if (action === 'kill') {
        return { ok: true, status: role === 'R' ? 'RRK' : 'DDK' };
      }
      if (action === 'hold') {
        return { ok: true, status: role === 'R' ? 'RRH' : 'DDH' };
      }
      return { ok: true, status: 'DPS' };
    },
    async saveArticle(articleId) {
      return { ok: true, articleId: articleId ?? 'A-0001' };
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

  const model = assertModel({ ...base, ...overrides });

  // Test helpers (not part of the Model contract).
  model.__emit = (payload) => {
    for (const s of subscribers) s.onChange(payload);
  };
  model.__setConnected = (value) => {
    connected = value;
  };
  return model;
}
