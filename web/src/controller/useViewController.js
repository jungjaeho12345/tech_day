// @MX:ANCHOR: [AUTO] View-page controller — menu filters + realtime subscription + department data-source (fan_in via ViewPage).
// @MX:REASON: encodes the four-menu filter semantics (REQ-FE-VIEW-005..008), the [DP-F2] subscription-driven refresh,
// and the [DP-F4] separated department data-source; the page and its tests depend on these exact contracts.
//
// Controller for the article-view page. Resolves the active menu into a query filter, runs the query,
// and keeps the list/status bar in sync with the subscription interface (no manual reload).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useModel } from '../app/context.js';

export const MENUS = Object.freeze(['부서별 작성', '부서별 송고', '개인별 수정', '데스크 미송고']);

/** Map a menu (and optional selected department) to the backend query filter. */
function filterForMenu(menu, user, selectedDepartment) {
  switch (menu) {
    case '부서별 작성':
      return { department: user.department };
    case '개인별 수정':
      return { author: user.userId };
    case '데스크 미송고':
      // Department articles together with RDS-state articles (REQ-FE-VIEW-008).
      return { department: user.department, status: 'RDS' };
    case '부서별 송고':
      // Query only after a department is selected and 조회 is pressed (handled by caller).
      return selectedDepartment ? { department: selectedDepartment } : null;
    default:
      return null;
  }
}

export function useViewController(user) {
  const model = useModel();
  const [menu, setMenu] = useState('부서별 작성');
  const [articles, setArticles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [connected, setConnected] = useState(true);
  const subRef = useRef(null);

  const runQuery = useCallback(async (filter) => {
    if (!filter) {
      setArticles([]);
      return;
    }
    const rows = await model.queryArticles(filter);
    setArticles(Array.isArray(rows) ? rows : []);
  }, [model]);

  // Auto-query whenever a non-deferred menu becomes active (부서별 송고 defers to the 조회 button).
  useEffect(() => {
    if (menu === '부서별 송고') {
      setArticles([]);
      // Populate the department dropdown from the separated data-source (DP-F4), distinct.
      (async () => {
        const users = await model.queryUsers({});
        const distinct = [...new Set(users.map((u) => u.department).filter(Boolean))];
        setDepartments(distinct);
      })();
      return;
    }
    runQuery(filterForMenu(menu, user));
  }, [menu, model, runQuery, user]);

  // Realtime subscription (DP-F2): refresh list + status bar on reported change.
  useEffect(() => {
    const sub = model.subscribe({ menu }, (payload) => {
      if (payload?.articles) {
        setArticles(payload.articles);
      }
      if (payload?.connected === false) {
        setConnected(false);
      }
    });
    subRef.current = sub;
    setConnected(sub.connected);
    return () => sub.unsubscribe();
  }, [model, menu]);

  const queryDepartment = useCallback((department) => {
    runQuery(filterForMenu('부서별 송고', user, department));
  }, [runQuery, user]);

  return { menu, setMenu, articles, departments, connected, queryDepartment };
}
