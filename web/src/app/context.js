// React contexts for dependency injection: the Model (server interface) and the session.
// The Model is injected at the App root so tests can substitute a fake (SPEC [HARD] requirement).
import { createContext, useContext } from 'react';

export const ModelContext = createContext(null);
export const SessionContext = createContext(null);

export function useModel() {
  const model = useContext(ModelContext);
  if (!model) {
    throw new Error('useModel must be used within a ModelContext provider');
  }
  return model;
}

export function useSession() {
  return useContext(SessionContext);
}
