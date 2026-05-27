// Article-view page (REQ-FE-VIEW-001..010). Realtime status bar + four menus + role-gated DPS edit actions.
import { useState } from 'react';
import { useViewController, MENUS } from '../controller/useViewController.js';
import { TopBar } from './TopBar.jsx';

function RealtimeStatus({ connected }) {
  return (
    <div data-testid="realtime-status">
      {connected ? '실시간 연결됨' : '비-실시간 (재연결 중)'}
    </div>
  );
}

function ArticleRow({ article, role }) {
  // Role gating (REQ-FE-VIEW-009/010): 고침/포털고침 only for role D on DPS articles.
  const showEdit = article.status === 'DPS';
  const canEdit = role === 'D';
  return (
    <li>
      <span>{article.title}</span>
      {showEdit ? (
        <>
          <button type="button" disabled={!canEdit}>고침</button>
          <button type="button" disabled={!canEdit}>포털고침</button>
        </>
      ) : null}
    </li>
  );
}

export function ViewPage({ user, nav }) {
  const ctrl = useViewController(user);
  const [selectedDept, setSelectedDept] = useState('');

  return (
    <>
      <TopBar statusBar={<RealtimeStatus connected={ctrl.connected} />} />
      {nav}
      <nav aria-label="조회 메뉴" style={{ display: 'flex', gap: '0.5rem' }}>
        {MENUS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={ctrl.menu === m}
            onClick={() => ctrl.setMenu(m)}
          >
            {m}
          </button>
        ))}
      </nav>

      {ctrl.menu === '부서별 송고' ? (
        <div>
          <label htmlFor="dept-select">부서</label>
          <select
            id="dept-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="">선택</option>
            {ctrl.departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button type="button" onClick={() => ctrl.queryDepartment(selectedDept)}>조회</button>
        </div>
      ) : null}

      <ul>
        {ctrl.articles.map((a) => (
          <ArticleRow key={a.articleId} article={a} role={user.role} />
        ))}
      </ul>
    </>
  );
}
