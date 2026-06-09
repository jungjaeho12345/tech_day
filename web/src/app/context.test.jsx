import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModel, useSession, ModelContext, SessionContext } from './context.js';

// DI context hooks (SPEC-FRONTEND-UI-001): the Model MUST be injected via a provider; useModel
// guards against a missing provider so a wiring mistake fails loudly instead of silently.
describe('useModel', () => {
  it('throws a clear error when used outside a ModelContext provider', () => {
    expect(() => renderHook(() => useModel()))
      .toThrow(/useModel must be used within a ModelContext provider/);
  });

  it('returns the injected model when inside a provider', () => {
    const model = { login: () => {} };
    const wrapper = ({ children }) => (
      <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
    );
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current).toBe(model);
  });
});

describe('useSession', () => {
  it('returns null outside a provider (no throw — session is optional)', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();
  });

  it('returns the provided session value when inside a provider', () => {
    const session = { user: { userId: 'r1', role: 'R' } };
    const wrapper = ({ children }) => (
      <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
    );
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current).toBe(session);
  });
});
