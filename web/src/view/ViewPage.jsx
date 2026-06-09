// Article-view page (REQ-FE-VIEW-001..011). Realtime status bar + four menus sharing one 8-column list
// (기사아이디/제목/작성자/수정자/작성시간/수정시간/기사상태/LockYN, REQ-FE-VIEW-011 v0.5.0 — 기사상태
// 컨럼 추가) + a right-click context menu with role-gated DPS 고침/포털고침 items (news.md 기사 조회페이지).
import { useState, useEffect, useRef } from 'react';
import { useViewController, MENUS } from '../controller/useViewController.js';
import { useSession } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { buildArticleDetailHtml } from './articleDetail.js';
import { ContextMenu } from './ContextMenu.jsx';
import { TopBar } from './TopBar.jsx';

// news.md 기사 조회페이지: "기사는 10개씩 보여주며 페이지 처리 해줘" — 10 articles per page.
const PAGE_SIZE = 10;

function formatCreatedAt(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openArticleDetail(article) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (w) {
    w.document.write(buildArticleDetailHtml(article));
    w.document.close();
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText?.(text ?? '');
}

const DISABLED = Object.freeze({ disabled: true });

function buildContextItems({ article, menu, role, navigate }) {
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

  const canDpsEdit = article.status === 'DPS' && role === 'D';
  const dpsEditItem = (label) => (canDpsEdit
    ? { label, onSelect: () => navigate(ROUTES.WRITE, { id: article.articleId }) }
    : { label, ...DISABLED });

  if (menu === '부서별 송고') {
    return [
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
      dpsEditItem('고치(포털제외)'),
      dpsEditItem('포털고치'),
      { label: '삭제요청', ...DISABLED },
      { label: '재송', ...DISABLED },
    ];
  }

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
    dpsEditItem('고치(포털제외)'),
    dpsEditItem('포털고치'),
    { label: '삭제요청', ...DISABLED },
    { label: '재송', ...DISABLED },
  ];
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

function ArticleRow({ article, onContextMenu }) {
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
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => onContextMenu(e, article)}
    >
      <span className="yh-desk-row__id" data-testid="article-id">{article.articleId}</span>
      <span className="yh-article-row__title">{article.title}</span>
      <span className="yh-article-row__author" data-testid="article-author">{article.author}</span>
      <span className="yh-article-row__modifier" data-testid="article-modifier">{article.modifier}</span>
      <span className="yh-article-row__time" data-testid="article-time">{formatCreatedAt(article.createdAt)}</span>
      <span className="yh-article-row__time" data-testid="article-edited-time">{formatCreatedAt(article.editedAt)}</span>
      <span className="yh-desk-row__status" data-testid="article-status">{article.status ?? ''}</span>
      <span className="yh-desk-row__lock" data-testid="article-lockyn">{article.lockYN ?? 'N'}</span>
    </li>
  );
}

function DeptMultiSelect({ departments, selectedDepts, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const allSelected = selectedDepts.length === departments.length && departments.length > 0;

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

  const displayText = selectedDepts.length === 0
    ? '선택'
    : selectedDepts.length === departments.length
      ? '전체'
      : selectedDepts.length === 1
        ? selectedDepts[0]
        : `${selectedDepts[0]} 외 ${selectedDepts.length - 1}`;

  return (
    <div className="yh-multi-select" data-testid="dept-multi-select" ref={containerRef}>
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
  const navigate = session?.navigate;
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [page, setPage] = useState(1);
  const [contextMenu, setContextMenu] = useState(null);

  const openContextMenu = (e, article) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, article });
  };
  const closeContextMenu = () => setContextMenu(null);

  const pageCount = Math.max(1, Math.ceil(ctrl.articles.length / PAGE_SIZE));
  const pageItems = ctrl.articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

        {pageItems.length > 0 ? (
          <div className="yh-desk-header" data-testid="desk-header">
            <span>기사아이디</span>
            <span>제목</span>
            <span>작성자</span>
            <span>수정자</span>
            <span>작성시간</span>
            <span>수정시간</span>
            <span>기사상태</span>
            <span>LockYN</span>
          </div>
        ) : null}

        <ul className="yh-article-list">
          {pageItems.map((a) => (
            <ArticleRow
              key={a.articleId}
              article={a}
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
          items={buildContextItems({ article: contextMenu.article, menu: ctrl.menu, role: user.role, navigate })}
          onClose={closeContextMenu}
        />
      ) : null}
    </>
  );
}
