// Article-view page (REQ-FE-VIEW-001..010). Realtime status bar + four menus + role-gated DPS edit actions
// + a right-click context menu and a 데스크 미송고 편집 button (news.md 기사 조회페이지).
import { useState, useEffect } from 'react';
import { useViewController, MENUS } from '../controller/useViewController.js';
import { useSession } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { buildArticleDetailHtml } from './articleDetail.js';
import { ContextMenu } from './ContextMenu.jsx';
import { TopBar } from './TopBar.jsx';

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

// Build the context-menu item list for an article under the active menu (ctrl.menu).
// 데스크 미송고 has an 편집 entry (and 본문복사/제목만복사); the other three menus share a longer
// send-history/translate/etc. set where only 상세보기/본문복사/제목만복사 are functional.
function buildContextItems({ article, menu, navigate }) {
  const detail = { label: '상세보기', onSelect: () => openArticleDetail(article) };
  const copyBody = { label: '본문복사', onSelect: () => copyToClipboard(article.content) };
  const copyTitle = { label: '제목만복사', onSelect: () => copyToClipboard(article.title) };

  if (menu === '데스크 미송고') {
    return [
      { label: '편집', onSelect: () => navigate(ROUTES.WRITE, { id: article.articleId }) },
      detail,
      { label: '이력보기', ...DISABLED },
      copyBody,
      copyTitle,
    ];
  }

  // 부서별 작성 / 부서별 송고 / 개인별 수정
  return [
    detail,
    { label: '이력보기', ...DISABLED },
    { label: '송고이력보기', ...DISABLED },
    copyBody,
    copyTitle,
    { label: '번역', ...DISABLED },
    { label: '매핑', ...DISABLED },
    { label: '후속기사작성', ...DISABLED },
    { label: '계속기사작성', ...DISABLED },
    { label: '고침(포털제외)', ...DISABLED },
    { label: '포털고침', ...DISABLED },
    { label: '삭제요청', ...DISABLED },
    { label: '재송', ...DISABLED },
  ];
}

// Derive a badge modifier class from a status string.
// Grouping: *PS = send, *H = hold, *K = kill, RDS = rds (default draft), else rds.
function statusBadgeClass(status) {
  if (!status) return 'yh-badge yh-badge--rds';
  const s = String(status).toUpperCase();
  if (s.endsWith('PS'))  return 'yh-badge yh-badge--send';
  if (s.endsWith('H'))   return 'yh-badge yh-badge--hold';
  if (s.endsWith('K'))   return 'yh-badge yh-badge--kill';
  if (s === 'RDS')       return 'yh-badge yh-badge--rds';
  return 'yh-badge yh-badge--rds';
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

// One article rendered as a dense newspaper-index row (news.md 디자인: "기사 목록은 신문 인덱스처럼
// 제목·작성자·시간·상태를 한 줄에 조밀하게 표시"). The <li> is the clickable row itself: status badge +
// title + author + modifier + time on one line. Click-to-detail, the right-click menu, the 데스크
// 미송고 편집 button, and the DPS 고침/포털고침 gating are all unchanged.
function ArticleRow({ article, role, menu, navigate, onContextMenu }) {
  // Role gating (REQ-FE-VIEW-009/010): 고침/포털고침 only for role D on DPS articles.
  const showDpsEdit = article.status === 'DPS';
  const canDpsEdit = role === 'D';
  // 데스크 미송고: each row gets a visible 편집 button that loads the article into the write page.
  const showEditBtn = menu === '데스크 미송고';

  // Click anywhere on the row (but not the action buttons) opens the detail window.
  const openDetail = () => openArticleDetail(article);
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail();
    }
  };

  return (
    <li
      className="yh-article-row"
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => onContextMenu(e, article)}
    >
      <span className={statusBadgeClass(article.status)} data-testid="article-status">{article.status}</span>
      <span className="yh-article-row__title">{article.title}</span>
      <span className="yh-article-row__author" data-testid="article-author">{article.author}</span>
      <span className="yh-article-row__modifier" data-testid="article-modifier">{article.modifier}</span>
      <span className="yh-article-row__time" data-testid="article-time">{formatCreatedAt(article.createdAt)}</span>
      {showEditBtn ? (
        <span className="yh-article-row__actions">
          {/* stopPropagation so the edit click doesn't also open the detail window */}
          <button
            type="button"
            className="yh-btn yh-btn--secondary yh-btn--sm"
            onClick={(e) => { e.stopPropagation(); navigate(ROUTES.WRITE, { id: article.articleId }); }}
          >편집</button>
        </span>
      ) : null}
      {showDpsEdit ? (
        <span className="yh-article-row__actions">
          {/* stopPropagation so edit clicks don't also open the detail window */}
          <button type="button" className="yh-btn yh-btn--secondary yh-btn--sm" disabled={!canDpsEdit} onClick={(e) => e.stopPropagation()}>고침</button>
          <button type="button" className="yh-btn yh-btn--secondary yh-btn--sm" disabled={!canDpsEdit} onClick={(e) => e.stopPropagation()}>포털고침</button>
        </span>
      ) : null}
    </li>
  );
}

export function ViewPage({ user, nav }) {
  const ctrl = useViewController(user);
  const session = useSession();
  const navigate = session?.navigate;
  const [selectedDept, setSelectedDept] = useState('');
  const [page, setPage] = useState(1);
  // Right-click context menu state: { x, y, article } while open, null while closed.
  const [contextMenu, setContextMenu] = useState(null);

  const openContextMenu = (e, article) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, article });
  };
  const closeContextMenu = () => setContextMenu(null);

  // Client-side pagination over the already time-desc-sorted list.
  const pageCount = Math.max(1, Math.ceil(ctrl.articles.length / PAGE_SIZE));
  const pageItems = ctrl.articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 and close any open context menu whenever the active menu changes
  // (new query => start from the top; a stale menu would point at a now-hidden row).
  useEffect(() => {
    setPage(1);
    setContextMenu(null);
  }, [ctrl.menu]);

  // Clamp the page if the list shrinks below the current offset (e.g. a realtime update
  // removes rows) so we never land on an empty page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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

        {ctrl.menu === '부서별 송고' ? (
          <div className="yh-dept-filter">
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
            <button
              type="button"
              className="yh-btn yh-btn--secondary yh-btn--sm"
              onClick={() => { setPage(1); ctrl.queryDepartment(selectedDept); }}
            >조회</button>
          </div>
        ) : null}

        {/* Dense newspaper-index list (news.md: 한 줄에 조밀하게 표시), 10 articles per page. */}
        <ul className="yh-article-list">
          {pageItems.map((a) => (
            <ArticleRow
              key={a.articleId}
              article={a}
              role={user.role}
              menu={ctrl.menu}
              navigate={navigate}
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
          items={buildContextItems({ article: contextMenu.article, menu: ctrl.menu, navigate })}
          onClose={closeContextMenu}
        />
      ) : null}
    </>
  );
}
