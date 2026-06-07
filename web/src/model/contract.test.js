import { describe, it, expect } from 'vitest';
import { assertModel, MODEL_KEYS } from './contract.js';

// SPEC-FRONTEND-UI-001 [HARD]: the injected Model must implement every MODEL_KEY. assertModel is the
// cheap wiring guard run at App boot; these cover its rejection paths and the happy-path passthrough.
describe('assertModel (Model wiring guard)', () => {
  it('throws naming a required method when one is missing', () => {
    // Only `login` is provided; some other required key must trigger the rejection.
    expect(() => assertModel({ login: () => {} })).toThrow(/Model is missing required method "/);
  });

  it('throws naming the first required key for a completely empty object', () => {
    expect(() => assertModel({})).toThrow(`Model is missing required method "${MODEL_KEYS[0]}"`);
  });

  it('throws when a required key is present but is not a function', () => {
    const model = Object.fromEntries(MODEL_KEYS.map((k) => [k, () => {}]));
    model.subscribe = 'not-a-function';
    expect(() => assertModel(model)).toThrow(/Model is missing required method "subscribe"/);
  });

  it('throws on null/undefined input', () => {
    expect(() => assertModel(null)).toThrow(/Model is missing required method "/);
    expect(() => assertModel(undefined)).toThrow(/Model is missing required method "/);
  });

  it('returns the same model object when every required method is present', () => {
    const model = Object.fromEntries(MODEL_KEYS.map((k) => [k, () => {}]));
    expect(assertModel(model)).toBe(model);
  });
});
