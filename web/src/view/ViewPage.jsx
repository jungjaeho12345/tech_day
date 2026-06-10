// Article-view page (REQ-FE-VIEW-001..011). Realtime status bar + four menus sharing one 8-column list
// (기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN, REQ-FE-VIEW-011 v0.5.0 — 기사상태
// 컬럼 추가) + a right-click context menu with role-gated DPS 고침/포털고침 items (news.md 기사 조회페이지).
import { useState, useEffect, useRef, useCallback } from 'react';
import { useViewController, MENUS } from '../controller/useViewController.js';
import { useSession, useModel } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { buildArticleDetailHtml } from './articleDetail.js';
import { ContextMenu } from './ContextMenu.jsx';
import { TopBar } from './TopBar.jsx';
import {
  COLUMN_POOL,
  MIN_GAP,
  MAX_GAP,
  loadColumnState,
  saveColumnState,
  visibleColumns,
  buildGridTemplate,
} from './columnConfig.js';

// news.md 기사 조회페이지: "기사는 10개씩 보여주며 페이징 처리 해줘" — 10 articles per page.
const PAGE_SIZE = 10;

// Format an ISO/createdAt timestamp into a compact, readable date-time for the list row.
// Falls back to the raw string (or empty) when it is missing/unparseable.
function formatCreatedAt(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Open the article detail in a NEW window (news.md: "기사를 클릭하면 새로운 창에서 ... 볼 수 있다").
// Writes a self-contained HTML document showing 제목/내용/공통정보. Guards against popup blockers.
function openArticleDetail(article) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (w) {
    w.document.write(buildArticleDetailHtml(article));
    w.document.close();
  }
}

// Copy text to the clipboard, guarding against environments where the API is unavailable
// (older browsers, insecure contexts, jsdom without a clipboard mock). No-op + no throw on absence.
function copyToClipboard(text) {
  navigator.clipboard?.writeText?.(text ?? '');
}

// Items that are NOT yet functional are rendered as DISABLED placeholders (explicit decision: show
// the full 연합 menu but only wire up what works). A disabled item has no onSelect.
const DISABLED = Object.freeze({ disabled: true });

// SPEC-NEWS-REVISE-012 — 행 데이터 lockYN==='Y' 일 때만(메뉴 종류 무관) "Lock해제" 항목을 만든다.
// 권한: D/Z 활성, R show-but-disabled(기존 비허용 항목 패턴 일관, Z=D-mirror). lockYN!='Y' 이면 null
// 을 반환해 호출부가 메뉴에서 항목 자체를 제외한다(데이터-주도 노출).
// SPEC-NEWS-REVISE-014 REQ-UNLOCK-CONFIRM — 활성(D/Z) 클릭은 window.confirm('Lock해제하시겠습니까?')
// 선행 후 수락 시에만 onForceUnlock 한다(취소 시 무호출 → DB/SSE 무변동). 송고/보류/KILL 의 동기 confirm
// 패턴(WritePage.jsx)과 동일 메커니즘 — 새 모달 없음. R 비활성 항목은 onSelect 자체가 없어 무동작(불변).
function buildForceUnlockItem({ article, role, onForceUnlock }) {
  if (article.lockYN !== 'Y') return null;
  if (role === 'D' || role === 'Z') {
    return {
      label: 'Lock해제',
      onSelect: () => { if (window.confirm('Lock해제하시겠습니까?')) onForceUnlock(article.articleId); },
    };
  }
  return { label: 'Lock해제', ...DISABLED };
}

// Build the context-menu item list for an article under the active menu (ctrl.menu).
// 데스크 미송고 has an 편집 entry (and 본문복사/제목만복사); the other three menus share a longer
// send-history/translate/etc. set where 상세보기/본문복사/제목만복사 are functional and, on a DPS
// article, 고침(포털제외)/포털고침 are enabled for role D only (REQ-FE-VIEW-009/010 v0.4.0) —
// selecting either navigates to the write page in edit context (news.md 기사 제어 권한).
function buildContextItems({ article, menu, role, navigate, onForceUnlock }) {
  const detail = { label: '상세보기', onSelect: () => openArticleDetail(article) };
  const copyBody = { label: '본문복사', onSelect: () => copyToClipboard(article.content) };
  const copyTitle = { label: '제목만복사', onSelect: () => copyToClipboard(article.title) };
  const forceUnlock = buildForceUnlockItem({ article, role, onForceUnlock });
  // 노출 조건이 행 데이터(lockYN)이므로 4개 메뉴 공통으로, lockYN='Y' 일 때만 항목을 덧붙인다.
  const withForceUnlock = (items) => (forceUnlock ? [...items, forceUnlock] : items);

  if (menu === '데스크 미송고') {
    return withForceUnlock([
      { label: '편집', onSelect: () => navigate(ROUTES.WRITE, { id: article.articleId }) },
      detail,
      { label: '이력보기', ...DISABLED },
      copyBody,
      copyTitle,
    ]);
  }

  // DPS-edit gating (REQ-FE-VIEW-009/010 v0.4.0): enabled only for role D on a DPS article.
  const canDpsEdit = article.status === 'DPS' && role === 'D';
  const dpsEditItem = (label) => (canDpsEdit
    ? { label, onSelect: () => navigate(ROUTES.WRITE, { id: article.articleId }) }
    : { label, ...DISABLED });

  // 부서별 송고 (SPEC-NEWS-REVISE-007 REQ-FWD-ENTRYPOINTS): 편집 항목은 권한과 무관하게 항상 활성
  // (AC-FWD-1/AC-REV-3). 고침/포털고침은 role D + DPS 기사에만 활성 (AC-FWD-2).
  if (menu === '부서별 송고') {
    return withForceUnlock([
      { label: '편집', onSelect: () => navigate(ROUTES.WRITE, { id: article.articleId }) },
      detail,
      { label: '이력보기', ...DISABLED },
      { label: '송고이력보기', ...DISABLED },
      copyBody,
      copyTitle,
      { label: '번역', ...DISABLED },
      { label: '매핑', ...DISABLED },
      { label: '후속기사작성', ...DISABLED },
      { label: '계속기사작성', ...DISABLED },
      dpsEditItem('고침(포털제외)'),
      dpsEditItem('포털고침'),
      { label: '삭제요청', ...DISABLED },
      { label: '재송', ...DISABLED },
    ]);
  }

  // 부서별 작성 / 개인별 수정
  return withForceUnlock([
    detail,
    { label: '이력보기', ...DISABLED },
    { label: '송고이력보기', ...DISABLED },
    copyBody,
    copyTitle,
    { label: '번역', ...DISABLED },
    { label: '매핑', ...DISABLED },
    { label: '후속기사작성', ...DISABLED },
    { label: '계속기사작성', ...DISABLED },
    dpsEditItem('고침(포털제외)'),
    dpsEditItem('포털고침'),
    { label: '삭제요청', ...DISABLED },
    { label: '재송', ...DISABLED },
  ]);
}

function RealtimeStatus({ connected }) {
  return (
    <div
      data-testid="realtime-status"
      className={`yh-status-bar${connected ? ' yh-status-bar--connected' : ' yh-status-bar--disconnected'}`}
    >
      {connected ? '실시간 연결됨' : '비-실시간 (재연결 중)'}
    </div>
  );
}

// Resolve the displayed text for one column of an article (datetime columns are formatted; an empty
// fallback is applied where the column defines one, e.g. LockYN -> 'N').
function cellText(col, article) {
  const raw = article[col.key];
  if (col.format === 'datetime') return formatCreatedAt(raw);
  if (raw === undefined || raw === null || raw === '') return col.fallback ?? '';
  return raw;
}

// One article rendered as a dense newspaper-index row (news.md 디자인: "기사 목록은 신문 인덱스처럼
// 한 줄에 조밀하게 표시"). REQ-FE-VIEW-011 v0.5.0: ALL four menus share the same eight-column base —
// 기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN. (2026-06-08 지시: 부서별 송고 DPS 행의
// 인라인 고침/포털고침 버튼은 제거 — 고침 진입은 우클릭 컨텍스트 메뉴로만 한다.)
//
// SPEC-NEWS-COLCONFIG: cells are now rendered from the active column configuration (show/hide + order),
// but every default-visible base column keeps its original className + data-testid so the existing list
// tests still resolve them. The row shares the header's grid-template-columns + gap (passed as inline
// style) so header and row tracks are ALWAYS byte-identical.
// Props: article, columns (ordered visible descriptors), gridStyle, onContextMenu.
function ArticleRow({ article, columns, gridStyle, onContextMenu }) {
  // Click anywhere on the row opens the detail window.
  const openDetail = () => openArticleDetail(article);
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail();
    }
  };

  return (
    <li
      className="yh-article-row yh-desk-row"
      style={gridStyle}
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => onContextMenu(e, article)}
    >
      {columns.map((col) => (
        <span
          key={col.key}
          className={col.cellClass}
          {...(col.testId ? { 'data-testid': col.testId } : {})}
        >
          {cellText(col, article)}
        </span>
      ))}
    </li>
  );
}

// Column-settings panel: a "컬럼 설정" toggle button opening a checkbox dropdown for show/hide and a
// gap slider. Styled with the existing .yh-multi-select / .yh-btn families for visual consistency with
// the department filter. Closes on outside mousedown (matching DeptMultiSelect's AC-MULTI behavior).
function ColumnSettings({ state, onToggle, onGapChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const visibleCount = COLUMN_POOL.filter((c) => state.visible[c.key]).length;

  return (
    <div className="yh-multi-select yh-col-settings" data-testid="column-settings" ref={ref}>
      <button
        type="button"
        className="yh-multi-select__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        컬럼 설정 ({visibleCount})
      </button>
      {open ? (
        <div className="yh-multi-select__menu yh-col-settings__panel" role="dialog" aria-label="컬럼 설정">
          <ul className="yh-col-settings__list">
            {COLUMN_POOL.map((col) => (
              <li key={col.key} className="yh-multi-select__item">
                <label>
                  <input
                    type="checkbox"
                    checked={!!state.visible[col.key]}
                    onChange={() => onToggle(col.key)}
                    data-testid={`column-toggle-${col.key}`}
                  />
                  {col.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="yh-col-settings__gap">
            <label htmlFor="yh-col-gap">컬럼 간격</label>
            <input
              id="yh-col-gap"
              type="range"
              min={MIN_GAP}
              max={MAX_GAP}
              value={state.gap}
              onChange={(e) => onGapChange(Number(e.target.value))}
              data-testid="column-gap-slider"
            />
            <span className="yh-col-settings__gap-val">{state.gap}px</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Shared header: renders the ordered visible columns with a drag resizer handle between fixed-width
// columns. Pointer-based resize (works for mouse/touch/pen) with a per-column minimum width guard.
// The header carries the SAME grid-template-columns + gap as every row (gridStyle), keeping them synced.
function ColumnHeader({ columns, gridStyle, onResize }) {
  // Begin a pointer-drag resize on a column boundary. Captures the pointer so the drag continues even
  // if the cursor leaves the handle; reports px deltas to onResize until pointerup/cancel.
  const startResize = useCallback((col, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const handle = e.currentTarget;
    // The column cell is the resizer handle's parent; measure its current rendered width as the base.
    const startWidth = handle.parentElement?.getBoundingClientRect().width ?? col.minWidth;
    try { handle.setPointerCapture?.(e.pointerId); } catch { /* capture optional */ }

    const onMove = (ev) => {
      const next = Math.max(col.minWidth, startWidth + (ev.clientX - startX));
      onResize(col.key, `${Math.round(next)}px`);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      try { handle.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, [onResize]);

  return (
    <div className="yh-desk-header" style={gridStyle} data-testid="desk-header">
      {columns.map((col) => (
        <span key={col.key} className="yh-desk-header__cell">
          <span className="yh-desk-header__label">{col.label}</span>
          {/* The flex (title) column has no fixed width to drag, so it carries no resizer. */}
          {col.flex ? null : (
            <span
              className="yh-col-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label={`${col.label} 너비 조절`}
              data-testid={`column-resizer-${col.key}`}
              onPointerDown={(e) => startResize(col, e)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </span>
      ))}
    </div>
  );
}

// Multi-select checkbox dropdown for department filter.
// Supports "전체" (All) option that toggles all departments.
function DeptMultiSelect({ departments, selectedDepts, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const allSelected = selectedDepts.length === departments.length && departments.length > 0;

  // Feature C (lineage Y) AC-MULTI-1 — 드롭다운이 열린 동안 컴포넌트 외부를 mousedown 하면 닫는다.
  // 내부 클릭(트리거/리스트박스)은 ref.contains 로 걸러져 닫지 않는다 (AC-MULTI-2 보존).
  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...departments]);
    }
  };

  const toggleDept = (dept) => {
    if (selectedDepts.includes(dept)) {
      onChange(selectedDepts.filter((d) => d !== dept));
    } else {
      onChange([...selectedDepts, dept]);
    }
  };

  // Display text for the dropdown trigger button.
  const displayText = selectedDepts.length === 0
    ? '선택'
    : selectedDepts.length === departments.length
      ? '전체'
      : selectedDepts.length === 1
        ? selectedDepts[0]
        : `${selectedDepts[0]} 외 ${selectedDepts.length - 1}`;

  return (
    <div className="yh-multi-select" data-testid="dept-multi-select" ref={ref}>
      <button
        type="button"
        className="yh-multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {displayText}
      </button>
      {open ? (
        <ul className="yh-multi-select__menu" role="listbox" aria-label="부서 선택">
          <li className="yh-multi-select__item">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                data-testid="dept-checkbox-all"
              />
              전체
            </label>
          </li>
          {departments.map((dept) => (
            <li key={dept} className="yh-multi-select__item">
              <label>
                <input
                  type="checkbox"
                  checked={selectedDepts.includes(dept)}
                  onChange={() => toggleDept(dept)}
                  data-testid={`dept-checkbox-${dept}`}
                />
                {dept}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ViewPage({ user, nav }) {
  const ctrl = useViewController(user);
  const session = useSession();
  const model = useModel();
  const navigate = session?.navigate;
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [page, setPage] = useState(1);
  // Right-click context menu state: { x, y, article } while open, null while closed.
  const [contextMenu, setContextMenu] = useState(null);
  // Per-menu column configuration (show/hide + order + widths + gap). Loaded lazily for the initial
  // menu and re-loaded whenever the active menu changes (each menu persists independently).
  const [columnState, setColumnState] = useState(() => loadColumnState(ctrl.menu));

  const openContextMenu = (e, article) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, article });
  };
  const closeContextMenu = () => setContextMenu(null);

  // Client-side pagination over the already time-desc-sorted list.
  const pageCount = Math.max(1, Math.ceil(ctrl.articles.length / PAGE_SIZE));
  const pageItems = ctrl.articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1, close any open context menu, and re-seed the department selection whenever the
  // active menu changes (부서별 작성 starts on the logged-in user's department and is auto-queried by
  // the controller, REQ-FE-VIEW-005 v0.4.0; 부서별 송고 starts unselected).
  useEffect(() => {
    setPage(1);
    setContextMenu(null);
    setSelectedDepts(ctrl.menu === '부서별 작성' && user.department ? [user.department] : []);
  }, [ctrl.menu, user.department]);

  // 부서별 송고 기본값 "전체": 부서 목록(비동기 로드)이 도착했고 선택이 아직 초기 상태([])일 때만
  // 전체 선택을 시드한다. 사용자가 이미 손댄 선택은 덮어쓰지 않는다(함수형 업데이트 + 빈 배열 가드).
  // 진입 즉시 조회는 컨트롤러가 { status: 'DPS' }(전체 = 부서 필터 없음, DPS 전체)로 자동 수행하며, 이
  // 멀티셀렉트 시드는 표시용 기본값(전체 체크)만 맞춘다. 사용자가 부서를 좁혀 조회를 누르면 그 부서로 재조회한다.
  // ctrl.departments 는 메뉴 진입 시 1회 setDepartments 로 고정되므로 이 effect 는 로드 후 1회만 돈다.
  useEffect(() => {
    if (ctrl.menu !== '부서별 송고' || ctrl.departments.length === 0) return;
    setSelectedDepts((prev) => (prev.length === 0 ? [...ctrl.departments] : prev));
  }, [ctrl.menu, ctrl.departments]);

  // Clamp the page if the list shrinks below the current offset (e.g. a realtime update
  // removes rows) so we never land on an empty page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Load the active menu's column configuration when the menu changes (menus persist independently).
  useEffect(() => {
    setColumnState(loadColumnState(ctrl.menu));
  }, [ctrl.menu]);

  // Persist + apply a column-state change for the active menu. saveColumnState sanitizes the payload,
  // so we adopt its returned (normalized) value as the next state.
  const commitColumnState = useCallback((next) => {
    setColumnState(saveColumnState(ctrl.menu, next));
  }, [ctrl.menu]);

  const toggleColumn = useCallback((key) => {
    commitColumnState({
      ...columnState,
      visible: { ...columnState.visible, [key]: !columnState.visible[key] },
    });
  }, [columnState, commitColumnState]);

  const resizeColumn = useCallback((key, width) => {
    commitColumnState({
      ...columnState,
      widths: { ...columnState.widths, [key]: width },
    });
  }, [columnState, commitColumnState]);

  const changeGap = useCallback((gap) => {
    commitColumnState({ ...columnState, gap });
  }, [columnState, commitColumnState]);

  // Ordered visible column descriptors + the grid style shared by the header and every row. Keeping a
  // single source for grid-template-columns + gap guarantees the header and rows never drift.
  const cols = visibleColumns(columnState);
  const gridStyle = { gridTemplateColumns: buildGridTemplate(columnState), gap: `${columnState.gap}px` };

  return (
    <>
      <TopBar statusBar={<RealtimeStatus connected={ctrl.connected} />} />
      {nav}
      <div className="yh-view-wrap">
        <nav aria-label="조회 메뉴" className="yh-view-menu">
          {MENUS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={ctrl.menu === m}
              className={`yh-view-menu__btn${ctrl.menu === m ? ' yh-view-menu__btn--active' : ''}`}
              onClick={() => ctrl.setMenu(m)}
            >
              {m}
            </button>
          ))}
        </nav>

        <div className="yh-list-toolbar">
          {ctrl.menu === '부서별 송고' || ctrl.menu === '부서별 작성' ? (
            <div className="yh-dept-filter">
              <span id="dept-label">부서</span>
              <DeptMultiSelect
                departments={ctrl.departments}
                selectedDepts={selectedDepts}
                onChange={setSelectedDepts}
              />
              <button
                type="button"
                className="yh-btn yh-btn--secondary yh-btn--sm"
                onClick={() => { setPage(1); ctrl.queryDepartment(selectedDepts); }}
              >조회</button>
            </div>
          ) : null}

          {/* Column show/hide + gap controls (SPEC-NEWS-COLCONFIG). Right-aligned so it does not
              collide with the department filter on the left. */}
          <ColumnSettings
            state={columnState}
            onToggle={toggleColumn}
            onGapChange={changeGap}
          />
        </div>

        {/* Shared header for ALL four menus — columns + order + widths + gap from the active config
            (REQ-FE-VIEW-011 v0.5.0 base; SPEC-NEWS-COLCONFIG show/hide + DnD resize). */}
        {pageItems.length > 0 && cols.length > 0 ? (
          <ColumnHeader columns={cols} gridStyle={gridStyle} onResize={resizeColumn} />
        ) : null}

        {/* Dense newspaper-index list (news.md: 한 줄에 조밀하게 표시), 10 articles per page. */}
        <ul className="yh-article-list">
          {pageItems.map((a) => (
            <ArticleRow
              key={a.articleId}
              article={a}
              columns={cols}
              gridStyle={gridStyle}
              onContextMenu={openContextMenu}
            />
          ))}
        </ul>

        {ctrl.articles.length > PAGE_SIZE ? (
          <nav className="yh-pagination" aria-label="페이지 이동">
            <button
              type="button"
              className="yh-btn yh-btn--secondary yh-btn--sm"
              data-testid="page-prev"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >이전</button>
            <span className="yh-pagination__indicator" data-testid="page-indicator">{page} / {pageCount}</span>
            <button
              type="button"
              className="yh-btn yh-btn--secondary yh-btn--sm"
              data-testid="page-next"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >다음</button>
          </nav>
        ) : null}
      </div>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextItems({
            article: contextMenu.article,
            menu: ctrl.menu,
            role: user.role,
            navigate,
            onForceUnlock: (articleId) => model.forceUnlockArticle(articleId),
          })}
          onClose={closeContextMenu}
        />
      ) : null}
    </>
  );
}
