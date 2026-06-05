// Vitest + Testing Library setup: registers jest-dom matchers and auto-cleanup.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // 세션 영속화(SPEC-EDIT-LOCK 외 — 새로고침 유지) 테스트 격리: sessionStorage에 남은
  // tech_day.user/tech_day.sessionId가 다음 테스트의 App/httpModel 부트 복원에 누설되지 않도록 정리.
  if (typeof sessionStorage !== 'undefined' && sessionStorage !== null) {
    sessionStorage.clear();
  }
});
