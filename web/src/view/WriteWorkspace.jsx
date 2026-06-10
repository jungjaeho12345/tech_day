// 멀티탭 기사 작성 워크스페이스 — writer.do 는 여러 작성 에디터를 탭으로 동시에 연다.
// (news.md 기사 작성페이지: 작성 에디터는 탭으로 여러 개 열 수 있다; 조회 페이지의 편집/고침/포털고침
// 진입은 해당 기사를 새 탭으로 열어 보여준다.)
//
// 설계 규약:
// - 탭 메타데이터(newsroom.editorTabs)는 sessionStorage 영속 — 초안 보존(newsroom.writeDraft.*)과 동일
//   수명(같은 탭/세션에서 페이지 전환·F5 생존, 브라우저 탭 닫힘 시 소멸 = lockYN 규칙 정합).
// - 모든 탭의 에디터를 mounted 상태로 유지하고 비활성 탭만 hidden 처리한다 — 탭 전환이 편집 잠금
//   (REQ-EDIT-LOCK)과 작성 중 내용을 그대로 유지한다. list.do 로 떠나면 전체 unmount (종전과 동일:
//   편집 탭은 복귀 시 서버 재로드, 새 기사 탭은 탭별 초안에서 복원).
// - 같은 기사(?id=)를 다시 열면 새 탭을 만들지 않고 기존 탭을 활성화한다 — 동일 세션의 두 페이지가
//   같은 기사 잠금에 자기충돌(D2-5 strict)하는 것을 차단한다.
// - 주소창은 활성 탭을 비춘다 (편집 탭 = /writer.do?id=..., 새 기사 탭 = /writer.do). 탭 전환은
//   replaceState — 히스토리를 오염시키지 않는다.
import { useState, useEffect, useCallback } from 'react';
import { WritePage } from './WritePage.jsx';
import { ROUTES, pathForRoute } from '../app/routing.js';

const TABS_STORAGE_KEY = 'newsroom.editorTabs';
// 단일 에디터 시절의 초안 키 — 최초 진입 시 첫 탭의 초안으로 1회 이관한다 (기존 작성 내용 보존).
const LEGACY_DRAFT_KEY = 'newsroom.writeDraft';

function draftKeyFor(tabId) {
  return `${LEGACY_DRAFT_KEY}.${tabId}`;
}

/** Guarded sessionStorage helpers — 컨트롤러의 초안 영속과 동일하게 비브라우저/quota 환경에서 무해. */
function readStoredTabs() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(TABS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeStoredTabs(state) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — 탭 구성은 in-memory 로만 유지 (no throw).
  }
}
function removeStoredDraft(tabId) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(draftKeyFor(tabId));
  } catch {
    // best effort — 닫힌 탭의 초안 잔재 제거 실패는 무해.
  }
}

function urlEditId() {
  try {
    return new URLSearchParams(window.location.search).get('id') || null;
  } catch {
    return null;
  }
}

// 편집 탭 보장 (pure): 이미 같은 기사 탭이 있으면 그 탭을 활성화만 하고, 없으면 새 탭을 만들어 활성화.
// 중복 탭을 만들지 않는 이유: 같은 세션의 두 페이지가 같은 기사 잠금에 자기충돌(D2-5 strict)한다.
function withEditTab(state, articleId) {
  const existing = state.tabs.find((t) => t.editArticleId === articleId);
  if (existing) {
    return state.activeId === existing.id ? state : { ...state, activeId: existing.id };
  }
  const seq = state.seq + 1;
  const tab = { id: `t${seq}`, editArticleId: articleId };
  return { tabs: [...state.tabs, tab], activeId: tab.id, seq };
}

// 마운트 시 탭 구성 복원: 저장된 메타데이터 → 없으면 빈 '새 기사' 탭 1개(+단일 키 초안 이관).
// URL 에 ?id= 가 있으면(조회 페이지의 편집/고침/포털고침 포워딩) 해당 편집 탭을 보장/활성화한다.
function initTabsState() {
  const stored = readStoredTabs();
  let state;
  if (stored && Array.isArray(stored.tabs) && stored.tabs.length > 0) {
    const tabs = stored.tabs
      .filter((t) => t && typeof t.id === 'string')
      .map((t) => ({ id: t.id, editArticleId: t.editArticleId ?? null }));
    // seq 는 항상 기존 탭 id 의 최대 숫자 접미사 이상이어야 한다 — 저장된 seq 가 없거나(구버전/손상)
    // 더 작으면(예: [t1, t3] 에 seq 미존재) 다음 새 탭이 기존 id 와 충돌해 React key 가 겹치고
    // 에디터 상태가 교차 배선된다. max(저장 seq, 최대 접미사) 로 복원해 충돌을 차단한다.
    const maxSuffix = tabs.reduce((max, t) => {
      const n = Number(/^t(\d+)$/.exec(t.id)?.[1]);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    state = {
      tabs,
      activeId: stored.activeId,
      seq: Math.max(Number.isFinite(stored.seq) ? stored.seq : 0, maxSuffix),
    };
  } else {
    state = { tabs: [{ id: 't1', editArticleId: null }], activeId: 't1', seq: 1 };
    // 단일 에디터 시절 초안 이관 — 멀티탭 도입 전 보존된 newsroom.writeDraft 를 첫 탭의 키로 옮긴다.
    try {
      if (typeof sessionStorage !== 'undefined') {
        const legacy = sessionStorage.getItem(LEGACY_DRAFT_KEY);
        if (legacy != null) {
          sessionStorage.setItem(draftKeyFor('t1'), legacy);
          sessionStorage.removeItem(LEGACY_DRAFT_KEY);
        }
      }
    } catch {
      // 이관 실패 시 초안만 잃을 뿐 동작은 정상 — no throw.
    }
  }
  const id = urlEditId();
  if (id) state = withEditTab(state, id);
  if (!state.tabs.some((t) => t.id === state.activeId)) {
    state = { ...state, activeId: state.tabs[0].id };
  }
  return state;
}

export function WriteWorkspace({ user }) {
  const [state, setState] = useState(initTabsState);

  // 탭 구성 영속 — 페이지 전환(list.do)으로 unmount 되어도 복귀 시 같은 탭들이 복원된다.
  useEffect(() => {
    writeStoredTabs(state);
  }, [state]);

  // 주소창 동기화 — 활성 탭이 편집 탭이면 ?id= 를, 새 기사 탭이면 베이스 경로를 비춘다.
  // replaceState: 탭 전환은 브라우저 히스토리 항목을 만들지 않는다 (뒤로가기 오염 방지).
  useEffect(() => {
    const active = state.tabs.find((t) => t.id === state.activeId);
    const url = pathForRoute(ROUTES.WRITE, active?.editArticleId ? { id: active.editArticleId } : undefined);
    try {
      if (window.location.pathname === pathForRoute(ROUTES.WRITE)
        && window.location.pathname + window.location.search !== url) {
        window.history.replaceState({}, '', url);
      }
    } catch {
      // history unavailable — 주소창 동기화는 best effort.
    }
  }, [state]);

  // 뒤로/앞으로 가기로 writer.do?id=… 에 도달한 경우(라우트는 그대로 WRITE 라 App 이 remount 하지
  // 않는다) — 해당 편집 탭을 보장/활성화한다.
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== pathForRoute(ROUTES.WRITE)) return;
      const id = urlEditId();
      if (id) setState((s) => withEditTab(s, id));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ＋ 버튼: 빈 '새 기사' 탭을 추가하고 활성화.
  const addTab = useCallback(() => {
    setState((s) => {
      const seq = s.seq + 1;
      const tab = { id: `t${seq}`, editArticleId: null };
      return { tabs: [...s.tabs, tab], activeId: tab.id, seq };
    });
  }, []);

  const activateTab = useCallback((tabId) => {
    setState((s) => (s.activeId === tabId ? s : { ...s, activeId: tabId }));
  }, []);

  // 탭 닫기: 에디터 unmount(편집 잠금은 컨트롤러 cleanup 이 해제) + 그 탭의 보존 초안 폐기.
  // 마지막 탭을 닫으면 빈 '새 기사' 탭 1개를 유지한다 (writer.do 는 항상 에디터를 보여준다).
  //
  // SPEC-NEWS-REVISE-008 AC-REL-2 — 닫는 탭이 편집 탭이면, 그 컨트롤러의 unmount cleanup 이
  // editTabSurvives 로 "탭이 아직 살아있는지"를 newsroom.editorTabs 에서 읽는다. 그 판정은 React 의
  // passive 효과(writeStoredTabs)보다 먼저, 즉 unmount 커밋 시점에 일어나므로, 닫힌 탭을 sessionStorage
  // 에서 **동기적으로** 먼저 제거해 둬야 컨트롤러가 해제를 수행한다(그러지 않으면 락이 남는다). 일반 조회
  // 이동(이 함수를 거치지 않는 전체 unmount)에서는 탭 목록이 그대로라 락이 유지된다(AC-LOCK-1 과 대비).
  const closeTab = useCallback((tabId) => {
    removeStoredDraft(tabId);
    setState((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return s;
      let tabs = s.tabs.filter((t) => t.id !== tabId);
      let seq = s.seq;
      if (tabs.length === 0) {
        seq += 1;
        tabs = [{ id: `t${seq}`, editArticleId: null }];
      }
      const activeId = s.activeId === tabId ? tabs[Math.min(idx, tabs.length - 1)].id : s.activeId;
      const next = { tabs, activeId, seq };
      // 동기 영속 — unmount cleanup 의 editTabSurvives 가 닫힌 탭을 더는 못 보게 한다(AC-REL-2).
      writeStoredTabs(next);
      return next;
    });
  }, []);

  // 편집 탭에서 송고/보류/KILL 성공 → 그 탭은 빈 '새 기사' 탭으로 전환된다 (WritePage 의
  // onEditContextEnded). editArticleId 해제로 컨트롤러의 잠금 effect 가 cleanup 되어 잠금이 풀리고,
  // 초안 보존이 활성화되며, 주소창 동기화 effect 가 ?id= 를 걷어낸다 (F5 가 송고된 기사를 다시
  // 편집으로 열지 않도록).
  const endEditContext = useCallback((tabId) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, editArticleId: null } : t)),
    }));
  }, []);

  return (
    <div className="yh-workspace">
      <div role="tablist" aria-label="작성 탭" className="yh-edit-tabs" data-testid="edit-tabs">
        {state.tabs.map((t) => {
          const label = t.editArticleId ?? '새 기사';
          const active = t.id === state.activeId;
          return (
            <span key={t.id} className={`yh-edit-tab${active ? ' yh-edit-tab--active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`writer-panel-${t.id}`}
                className="yh-edit-tab__label"
                title={label}
                onClick={() => activateTab(t.id)}
              >
                {label}
              </button>
              <button
                type="button"
                aria-label={`${label} 탭 닫기`}
                className="yh-edit-tab__close"
                onClick={() => closeTab(t.id)}
              >
                ×
              </button>
            </span>
          );
        })}
        <button type="button" aria-label="새 작성 탭" className="yh-edit-tabs__add" onClick={addTab}>
          ＋
        </button>
      </div>
      {state.tabs.map((t) => (
        <div
          key={t.id}
          id={`writer-panel-${t.id}`}
          role="tabpanel"
          aria-label={t.editArticleId ?? '새 기사'}
          hidden={t.id !== state.activeId}
          className="yh-edit-tabpanel"
          data-testid={`writer-panel-${t.id}`}
        >
          <WritePage
            user={user}
            editArticleId={t.editArticleId ?? null}
            draftKey={draftKeyFor(t.id)}
            onEditContextEnded={() => endEditContext(t.id)}
            // SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE — 강제 해제(forced) SSE 수신 시 그 편집 탭을 닫는다
            // (closeTab: 남은 탭/새 기사 탭 전환 + 초안 폐기 → 저장 안 한 변경분 폐기). 자기 해제(송고/보류/
            // KILL/정상 닫기)는 forced 가 아니므로 WritePage 구독이 무시한다.
            onForceClosed={() => closeTab(t.id)}
          />
        </div>
      ))}
    </div>
  );
}
