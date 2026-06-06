// Vitest + Testing Library setup: registers jest-dom matchers and auto-cleanup.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // SPEC-NEWS-REVISE — the write controller persists an in-progress draft to sessionStorage (and
  // httpModel persists the session id). jsdom shares sessionStorage across a file, so clear it between
  // tests to stop a persisted draft/session from leaking into the next case's fresh mount.
  try { sessionStorage.clear(); } catch { /* no storage in this env */ }
});
