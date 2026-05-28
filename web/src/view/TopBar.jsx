// Common top-right user info element (REQ-FE-APP-003) + optional realtime status bar (REQ-FE-VIEW-002)
// + 로그아웃 button (news.md 사용자 정보). Logout is reached through SessionContext so it works on both
// the write and view pages without prop-drilling.
import { useSession } from '../app/context.js';

export function TopBar({ statusBar }) {
  const session = useSession();
  return (
    <header className="yh-topbar">
      {/* Brand wordmark (left) */}
      <div className="yh-brand">
        <span className="yh-brand__logo">연합</span>
        <span className="yh-brand__title">기사 제작 시스템</span>
      </div>

      {/* Right: optional status bar + user info + logout */}
      <div className="yh-user">
        {statusBar}
        {session?.user ? (
          <>
            {/* news.md 사용자 정보: show userId · department · (role) — userId/부서/권한. */}
            <div data-testid="user-info">
              <span className="yh-user__name">{session.user.userId}</span>
              {' · '}
              <span className="yh-user__dept">{session.user.department}</span>
              {' · '}
              <span className="yh-user__role">({session.user.role})</span>
            </div>
            <button
              type="button"
              className="yh-logout-btn"
              aria-label="로그아웃"
              onClick={session.logout}
            >
              로그아웃
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
