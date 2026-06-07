// @MX:ANCHOR: [AUTO] View-page controller — menu filters + realtime subscription + department data-source (fan_in via ViewPage).
// @MX:REASON: encodes the four-menu filter semantics (REQ-FE-VIEW-005..008), the [DP-F2] subscription-driven refresh,
// and the [DP-F4] separated department data-source; the page and its tests depend on these exact contracts.
//
// Controller for the article-view page. Resolves the active menu into a query filter, runs the query,
// and keeps the list/status bar in sync with the subscription interface (no manual reload).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useModel } from '../app/context.js';

export const MENUS = Object.freeze(['데스크 미송고', '부서별 작성', '부서별 송고', '개인별 수정']);

/**
 * Sort article rows by createdAt DESCENDING (newest first) — news.md: "기사는 시간 내림차순".
 * Pure + non-mutating (returns a new array). createdAt holds ISO timestamps, which sort
 * correctly lexicographically; rows missing createdAt are pushed to the end.
 * @param {Array<{createdAt?: string}>} rows
 * @returns {Array<object>}
 */
export function sortByCreatedAtDesc(rows) {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort((a, b) => {
    const at = a?.createdAt ?? '';
    const bt = b?.createdAt ?? '';
    if (at === bt) return 0;
    if (!at) return 1; // missing createdAt sorts last
    if (!bt) return -1;
    return at < bt ? 1 : -1; // descending
  });
}

/**
 * Normalize department selection to a comma-separated string for the backend query.
 * Accepts: string (single dept), array of strings (multi-select), or falsy (no selection).
 * @param {string|string[]|null|undefined} depts
 * @returns {string|null} Comma-separated string or null if empty
 */
function normalizeDepartments(depts) {
  if (!depts) return null;
  if (Array.isArray(depts)) {
    return depts.length > 0 ? depts.join(',') : null;
  }
  return depts; // single string
}

/** Map a menu (and optional selected department(s)) to the backend query filter. */
function filterForMenu(menu, user, selectedDepartment) {
  switch (menu) {
    case '부서별 작성': {
      // REQ-FE-VIEW-005 v0.4.0: department Select (initial = the logged-in user's department) and
      // exclusion of sent/held states — "상태값이 DPS와 RRH가 아닌 기사들". statusNot expands to a
      // NOT IN clause in articleModel.query.
      // Multi-select: normalize array to comma-separated string.
      const department = normalizeDepartments(selectedDepartment) || user.department;
      return department ? { department, statusNot: 'DPS,RRH' } : null;
    }
    case '개인별 수정':
      // REQ-FE-VIEW-007 v0.4.0: own articles in reporter-editable states only — RDS + RRK.
      // 작성자 매칭은 저장 값과 동일한 표시 이름(user.name) 기준 — 기사는 author 컬럼에 로그인
      // 사용자의 이름을 저장한다 (useWriteController: common.author = user.name). 종전의
      // user.userId 필터는 저장 값(이름)과 일치할 수 없어 개인별 수정이 항상 0건이었다.
      // || (not ??): 이름이 빈 문자열('')인 계정이 author='' 쿼리를 보내면 레거시 무명(author='')
      // 기사들이 타인의 개인별 수정 목록에 노출되므로, 빈 이름도 userId 폴백으로 떨어뜨린다.
      return { author: user.name || user.userId, status: 'RDS,RRK' };
    case '데스크 미송고':
      // RDS + DDH articles (REQ-FE-VIEW-008 v0.3.0: "데스크 미송고 페이지는 상태값이 RDS, DDH인
      // 기사만 나열한다"). Comma-separated multi-status expands to an IN clause in articleModel.query.
      return { status: 'RDS,DDH' };
    case '부서별 송고': {
      // DPS-only (news.md: "부서별 송고페이지는 DPS기사만 조회"). Query only after a
      // department is selected and 조회 is pressed (handled by caller).
      // Multi-select: normalize array to comma-separated string.
      const department = normalizeDepartments(selectedDepartment);
      return department ? { department, status: 'DPS' } : null;
    }
    default:
      return null;
  }
}

export function useViewController(user) {
  const model = useModel();
  const [menu, setMenu] = useState('데스크 미송고');
  const [articles, setArticles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [connected, setConnected] = useState(true);
  const subRef = useRef(null);

  // Last applied filter — replayed when the realtime transport reports a change signal so the
  // visible menu refreshes without manual reload (REQ-FE-VIEW-003 / AC-6.1 on the real SSE path).
  // null means "no active query" (e.g. 부서별 송고 before 조회) and suppresses signal-driven refresh.
  const lastFilterRef = useRef(null);

  // Monotonic query sequence — every runQuery (and direct payload replacement) bumps it, and a
  // resolved response is applied ONLY if it is still the newest. This drops out-of-order responses
  // (two rapid change signals racing) and in-flight queries superseded by a menu switch.
  const querySeqRef = useRef(0);

  const runQuery = useCallback(async (filter) => {
    const seq = ++querySeqRef.current;
    lastFilterRef.current = filter;
    if (!filter) {
      setArticles([]);
      return;
    }
    const rows = await model.queryArticles(filter);
    if (seq !== querySeqRef.current) return; // superseded while in flight — drop the stale rows
    setArticles(sortByCreatedAtDesc(rows));
  }, [model]);

  // Auto-query whenever a non-deferred menu becomes active (부서별 송고 defers to the 조회 button;
  // 부서별 작성 auto-queries the logged-in user's department, REQ-FE-VIEW-005 v0.4.0).
  useEffect(() => {
    // Populate the department dropdown from the separated data-source (DP-F4), distinct.
    // Both department menus (부서별 작성 v0.4.0 + 부서별 송고) share the same Select source.
    if (menu === '부서별 송고' || menu === '부서별 작성') {
      (async () => {
        const users = await model.queryUsers({});
        const distinct = [...new Set(users.map((u) => u.department).filter(Boolean))];
        // 부서명코드 내림차순 정렬
        distinct.sort((a, b) => b.localeCompare(a, 'ko'));
        setDepartments(distinct);
      })();
    }
    if (menu === '부서별 송고') {
      // Deferred menu: clear the list AND the last filter so a realtime change signal arriving
      // before 조회 cannot replay the previous menu's filter into this view.
      runQuery(null);
      return;
    }
    runQuery(filterForMenu(menu, user));
  }, [menu, model, runQuery, user]);

  // Realtime subscription (DP-F2): refresh list + status bar on reported change.
  // Two payload shapes are supported: { articles } replaces the list directly (fake transport /
  // a server that pushes rows), while a row-less change signal ({ type, articleId, ... }) from the
  // real SSE transport triggers a re-query of the last applied filter (REQ-FE-VIEW-003).
  useEffect(() => {
    const sub = model.subscribe({ menu }, (payload) => {
      if (payload?.articles) {
        querySeqRef.current += 1; // direct replacement supersedes any in-flight re-query
        setArticles(sortByCreatedAtDesc(payload.articles));
      } else if (payload?.type && lastFilterRef.current) {
        runQuery(lastFilterRef.current);
      }
      if (payload?.connected === false) {
        setConnected(false);
      } else if (payload?.connected === true) {
        setConnected(true);
      }
    });
    subRef.current = sub;
    setConnected(sub.connected);
    return () => sub.unsubscribe();
  }, [model, menu, runQuery]);

  // 조회-button re-query for the department menus. The filter shape follows the ACTIVE menu:
  // 부서별 작성 -> { department, statusNot: 'DPS,RRH' } / 부서별 송고 -> { department, status: 'DPS' }.
  const queryDepartment = useCallback((department) => {
    runQuery(filterForMenu(menu, user, department));
  }, [menu, runQuery, user]);

  return { menu, setMenu, articles, departments, connected, queryDepartment };
}
