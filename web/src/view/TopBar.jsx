// Common top-right user info element (REQ-FE-APP-003) + optional realtime status bar (REQ-FE-VIEW-002).
import { useSession } from '../app/context.js';

export function TopBar({ statusBar }) {
  const session = useSession();
  return (
    <header style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '0.5rem' }}>
      {statusBar}
      {session?.user ? (
        <div data-testid="user-info">
          {session.user.name} ({session.user.role})
        </div>
      ) : null}
    </header>
  );
}
