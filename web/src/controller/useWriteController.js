// @MX:ANCHOR: [AUTO] Write-page controller — DTO assembly + send/hold/kill action coordination (fan_in across WritePage panels).
// @MX:REASON: centralizes [DP-F5] contract (UI sends action+DTO only, never computes lifecycle state) and [DP-F3]
// proxy search consumption; multiple panels depend on this single coordinator, and tests assert its exact calls.
//
// Controller for the article-write page. Holds editor markup + common-info fields, assembles the DTO,
// and routes send/hold/kill through the Model. The client NEVER computes the next lifecycle state.
// After a SUCCESSFUL action the write page is reset to a fresh draft (news.md: 기사 작성페이지는 초기화 된다),
// while the backend-returned status confirmation remains visible.
import { useState, useCallback, useEffect, useRef } from 'react';
import { useModel } from '../app/context.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';
import { hasEndMarker } from '../model/editorContent.js';

// SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — page-scoped sessionId generator (D2-5 = A strict).
// One UUID per editor mount so two tabs of the same user collide on the lock (different sessionIds).
// Falls back to a Math.random pair when crypto.randomUUID is unavailable (jsdom/older Node).
function generatePageSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const EMPTY_COMMON = Object.freeze({
  author: '', coAuthor: '', content: '', region: '', attribute: '', keyword: '',
  internalComment: '', externalComment: '', attachmentFile: '', referenceFile: '',
  embargoAt: '', secondaryEmbargoAt: '',
});

// Build a common-info object from a loaded article row (news.md 기사 편집 기능: 편집 시 제목/본문 +
// 공통정보 모두 로드). Copies EVERY EMPTY_COMMON key that is actually present on the row (so missing
// fields stay blank, not undefined). The row uses backend field names; the 2nd embargo may arrive as
// embargoAt/secondEmbargoAt. NOTE: the Contents table only stores a subset of these columns (author,
// modifier, department, departmentCode, createdAt, embargoAt/secondEmbargoAt, status); coAuthor/region/
// attribute/keyword/internalComment/externalComment/attachmentFile/referenceFile/content are NOT columns,
// so they cannot be loaded from the DB and remain blank on edit-load (schema limitation, not a UI bug).
function commonFromRow(row) {
  const next = { ...EMPTY_COMMON };
  for (const key of Object.keys(EMPTY_COMMON)) {
    if (row[key] !== undefined && row[key] !== null) next[key] = row[key];
  }
  // The view/detail rows expose the 2nd embargo as `secondEmbargoAt`; the editor uses `secondaryEmbargoAt`.
  if (next.secondaryEmbargoAt === '' && row.secondEmbargoAt != null) {
    next.secondaryEmbargoAt = row.secondEmbargoAt;
  }
  return next;
}

// SPEC-NEWS-REVISE-007 REQ-VO-MAPPING — read-only ContentsVO fields shown (non-editable) in the write
// page's edit context. These 8 fields (기사아이디·수정자·송고자·부서·부서코드·작성시간·편집시간·송고시간)
// map to the loaded Contents row's backend column names. They are display-only, so a missing/null value
// becomes an empty string (AC-MAP-4: never surface 'undefined'/'null'). The list also fixes the display
// order of the read-only panel. createdAt/editedAt/sentAt are passed through verbatim (the panel decides
// presentation); the article id is the row PK.
const READONLY_META_KEYS = Object.freeze([
  'articleId', 'modifier', 'sender', 'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
]);

// Build the read-only metadata object from a loaded row, coercing absent/null values to '' so the
// display area never renders the strings 'undefined'/'null' and one missing field cannot affect another.
function readonlyMetaFromRow(row) {
  const meta = {};
  for (const key of READONLY_META_KEYS) {
    meta[key] = row[key] != null ? row[key] : '';
  }
  return meta;
}

/**
 * @param {AuthUser} user
 * @param {{ editArticleId?: string }} [options] when editArticleId is set, the controller loads that
 *   article on mount (markupVersion + common fields) and saves PUT (update) instead of POST (create).
 */
export function useWriteController(user, options = {}) {
  const { editArticleId } = options;
  const model = useModel();
  // Editor adapter (DP-F1): the page programs against the adapter, not a concrete library.
  // SPEC-UI-EDITOR-001 uses the concrete structured adapter (text + ordered inline embeds).
  const [adapter] = useState(() => createStructuredEditorAdapter());
  // React mirror of the adapter content so the editor view re-renders on edits/embeds.
  const [content, setContent] = useState(() => adapter.getContent());
  // news.md 기사 에디터 공통정보: 작성자는 로그인한 사용자 정보의 이름을 입력한다. The 작성자 field DEFAULTS
  // to the logged-in user's name for a fresh draft; the user may still edit it (updateCommon), and an
  // edit-loaded row overrides it via commonFromRow (the DB row's author wins when present).
  const [common, setCommon] = useState(() => ({ ...EMPTY_COMMON, author: user.name ?? '' }));
  const [articleId, setArticleId] = useState('A-DRAFT');
  // Status of the article currently in the editor (news.md 기사 작성 페이지 내 버튼): the 송고/보류/KILL
  // buttons are shown only while this is 'RDS'. A fresh draft starts at INITIAL_STATUS = 'RDS'; an
  // edit-loaded row adopts its own row.status. This is the EDITING status and is intentionally separate
  // from `lifecycleStatus`, which is the backend-returned confirmation shown AFTER an action.
  const [status, setStatus] = useState('RDS');
  const [lifecycleStatus, setLifecycleStatus] = useState(null);
  const [actionError, setActionError] = useState(null);
  // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — frontend lock integration. lockError holds the conflict
  // reason ('locked' / 'unauthenticated' / 'network-error') so WritePage can show ALERT + banner +
  // disable the editor body (AC-EDIT-LOCK-2 / NFR-A11Y).
  const [lockError, setLockError] = useState(null);
  // SPEC-NEWS-REVISE-007 REQ-VO-MAPPING — read-only ContentsVO 8 fields, populated only in an edit
  // context (editArticleId present). Null in a blank-new context so WritePage renders no read-only area
  // (AC-MAP-3). Set from the loaded row on edit-load; reset to null when the page returns to a draft.
  const [readonlyMeta, setReadonlyMeta] = useState(null);
  // Page-scoped UUID — generated ONCE per editor mount (D2-5 strict so two tabs collide).
  const pageSessionIdRef = useRef(null);
  if (pageSessionIdRef.current == null) {
    pageSessionIdRef.current = generatePageSessionId();
  }

  // Edit-load (news.md 데스크 미송고 편집): when an editArticleId is supplied, fetch the row and load it
  // into the editor + common fields, and adopt its articleId so the next save PUTs (updates) the row.
  // Blank-new behavior is unchanged when editArticleId is absent.
  useEffect(() => {
    if (!editArticleId) return;
    let cancelled = false;
    (async () => {
      const [row] = await model.queryArticles({ articleId: editArticleId });
      if (cancelled || !row) return;
      adapter.setMarkup(row.markupVersion ?? '');
      setContent(adapter.getContent());
      setCommon(commonFromRow(row));
      setArticleId(row.articleId);
      // SPEC-NEWS-REVISE-007 — surface the read-only ContentsVO 8 fields for the write page's display
      // area. Edit/고침/포털고침 entry is a plain edit load (no lifecycle transition), so this just
      // exposes the row metadata; the status below is adopted verbatim (no state change on entry).
      setReadonlyMeta(readonlyMetaFromRow(row));
      // Adopt the loaded row's status so the action buttons gate on the real article state.
      if (row.status != null) setStatus(row.status);
    })();
    return () => { cancelled = true; };
  }, [editArticleId, model, adapter]);

  // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — acquire the lock on mount (when editing an existing article)
  // and release on unmount. The page-scoped sessionId (pageSessionIdRef.current) is stable per mount
  // so D2-5 strict (same user, different tab → 'locked') holds. Network failures degrade to
  // { ok:false, reason:'network-error' } which is surfaced as lockError so the UI degrades safely.
  //
  // unload safety (D2-4 = C): beforeunload + visibilitychange:hidden BOTH trigger navigator.sendBeacon
  // so the release reaches the server even when the page is being torn down (sendBeacon is preferred
  // over fetch because it survives the unload event without blocking it).
  useEffect(() => {
    if (!editArticleId) return undefined;
    let cancelled = false;
    const sessionId = pageSessionIdRef.current;

    (async () => {
      try {
        const result = await model.acquireEditLock(editArticleId, { sessionId });
        if (cancelled) return;
        if (!result?.ok) {
          setLockError({ reason: result?.reason ?? 'locked' });
        } else {
          setLockError(null);
        }
      } catch {
        if (!cancelled) setLockError({ reason: 'network-error' });
      }
    })();

    // sendBeacon release — used by both unload channels and the cleanup path so the server frees the
    // lock even if the user closes the tab without an explicit logout.
    const beaconRelease = () => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          // Backend endpoint accepts the page sessionId in the body for sendBeacon compatibility
          // (sendBeacon cannot specify HTTP method = DELETE; the server reads sessionId from the
          // JSON payload and treats POST-to-lock-release as equivalent to DELETE for unload paths).
          const payload = JSON.stringify({ sessionId, articleId: editArticleId, release: true });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`/api/articles/${encodeURIComponent(editArticleId)}/lock`, blob);
        }
      } catch {
        // Ignore — unload paths must never throw.
      }
    };

    const onBeforeUnload = () => { beaconRelease(); };
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        beaconRelease();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Best-effort async release on React unmount (page navigation, hot reload).
      try {
        model.releaseEditLock?.(editArticleId, { sessionId }).catch(() => {});
      } catch {
        // Ignore — release is best effort.
      }
    };
  }, [editArticleId, model]);

  // Set the plain body text (typed input). Embeds already inserted are preserved (REQ-EDIT-ADP-003).
  const setBodyMarkup = useCallback((next) => {
    adapter.setBodyText(next);
    setContent(adapter.getContent());
  }, [adapter]);

  // @MX:NOTE: [AUTO] Inline embed insertion (REQ-EDIT-EMBED-001) — inserts a structured inline block
  // (image/video/article descriptor) instead of appending a "[source] url" / "기사:id" marker string.
  // SPEC-NEWS-REVISE-001: caretOffset이 주어지면 본문 커서 위치에 인라인 임베드 (split text block).
  // 미지정 시 기존 append 동작 — backwards-compatible.
  const embed = useCallback((descriptor, caretOffset) => {
    adapter.embed(descriptor, caretOffset != null ? { caretOffset } : undefined);
    setContent(adapter.getContent());
  }, [adapter]);

  // SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — remove a single inline embed by its ordinal index
  // (0-based among embed blocks; matches the `data-embed-index` the editor paints). View hooks this
  // up to the × button (D2-6 option C) and to the Backspace handler when an embed has focus.
  const removeEmbed = useCallback((embedIndex) => {
    adapter.removeEmbed(embedIndex);
    setContent(adapter.getContent());
  }, [adapter]);

  // news.md 기사 에디터: Alt+Y appends "(끝)" to the END of the body text (shown in 골드색 by the view).
  // SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER simplifies the inserted token to exactly "(끝)" (prefix-free
  // — previously "\n (끝)"). It persists in markupVersion (round-trips via setMarkup) because it is stored
  // as literal body text.
  const appendEnd = useCallback(() => {
    adapter.appendEnd();
    setContent(adapter.getContent());
  }, [adapter]);

  const updateCommon = useCallback((field, value) => {
    setCommon((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Assemble the article DTO from editor markup (overwrite-on-save markupVersion) + common-info fields.
   * The parsed title (editor's first line, 후보 A) is mapped to `title` so the backend writes it into
   * Article.title AND Contents.title (previously saved articles had title=null). markupVersion is
   * unchanged — the AC-4 invariant `assembleDto().markupVersion === adapter.getMarkup()` still holds.
   */
  const assembleDto = useCallback(() => ({
    ...common,
    title: adapter.getStructure().title,
    markupVersion: adapter.getMarkup(),
  }), [common, adapter]);

  // Reset the INPUT state to a fresh draft after a successful action (news.md: 기사 작성페이지는 초기화 된다).
  // Clears the structured editor content (body text + inline embeds) via the adapter contract, the common-info
  // fields, and the articleId. Deliberately does NOT touch lifecycleStatus/actionError so the result confirmation
  // (AC-5.1/AC-5.2) stays visible after the action. setMarkup('') deserializes empty -> empty content.
  const resetDraft = useCallback(() => {
    adapter.setMarkup('');
    setContent(adapter.getContent());
    // Reset common to a fresh draft, re-defaulting 작성자 to the logged-in user's name (news.md 공통정보).
    setCommon({ ...EMPTY_COMMON, author: user.name ?? '' });
    setArticleId('A-DRAFT');
    // A new blank draft starts at INITIAL_STATUS = 'RDS' so the action buttons re-appear.
    setStatus('RDS');
    // SPEC-NEWS-REVISE-007 — back to a blank-new context, so the read-only ContentsVO area disappears
    // (AC-MAP-3): a fresh draft has no articleId/sender/sentAt yet.
    setReadonlyMeta(null);
  }, [adapter, user.name]);

  // [DP-F5] send/hold/kill: persist DTO, then submit action+DTO only; display backend-returned state.
  const submitAction = useCallback(async (action) => {
    setActionError(null);
    // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — when the lock acquire was rejected, every transport call
    // is suppressed (the page is read-only until the user dismisses and navigates away). This is the
    // server-side AC-EDIT-LOCK-2/6 invariant mirrored at the client so the conflict is not papered
    // over by a network error from the server-side lock guard.
    if (lockError) {
      return;
    }
    // news.md 기사작성 워크플로우: 송고/보류 require a title (the editor's first line). When it is
    // empty, abort BEFORE saving or applying the action and surface the inline alert. KILL is exempt.
    if (action === 'send' || action === 'hold') {
      if (adapter.getStructure().title.trim() === '') {
        setActionError('제목이 없어 송고/보류할 수 없습니다.');
        return;
      }
    }
    // news.md 기사 에디터: 송고는 본문이 "(끝)" 마커로 끝나야 한다 (Alt+Y로 추가). 마커가 없으면
    // 저장/액션 진입 전에 ALERT 로 막는다. 송고에만 적용 — 보류/KILL 은 마커 요구 없이 진행한다.
    // (제목 가드 직후·transport 진입 전에 위치해 saveArticle/applyAction 이 모두 차단된다.)
    if (action === 'send' && !hasEndMarker(adapter.getBodyText())) {
      window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.');
      return;
    }
    try {
      let id = articleId;
      // REQ-FE-WRITE-013 v0.3.0 — 송고뿐 아니라 보류/KILL도 액션 전에 현재 DTO를 저장한다. 종전에는
      // send만 저장해서, 미저장 새 초안(A-DRAFT)에 보류/KILL을 누르면 applyAction이 존재하지 않는
      // 기사 ID로 호출되어 서버가 not-found로 거부했다 (보류/KILL 미동작의 원인).
      //
      // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK / REQ-API-INSERT-UPDATE-SPLIT — when this is an edit
      // context (articleId !== 'A-DRAFT'), include the page-scoped sessionId so the server PUT
      // route's lock guard (assertLockHolder) accepts the request. The DTO field is stripped by
      // server/index.js before the partial update is applied (it is transport-only metadata).
      {
        const dto = assembleDto();
        const isEditContext = articleId !== 'A-DRAFT';
        const payload = isEditContext ? { ...dto, sessionId: pageSessionIdRef.current } : dto;
        const saved = await model.saveArticle(articleId, payload);
        if (saved?.ok && saved.articleId) {
          id = saved.articleId;
          setArticleId(id);
        }
      }
      const result = await model.applyAction(id, user.role, action);
      if (!result?.ok) {
        // EC-5: rejected transition -> notify, do NOT show a state change, do NOT reset the page.
        setActionError(`전송이 거부되었습니다 (${result?.reason ?? 'rejected'}).`);
        return;
      }
      setLifecycleStatus(result.status);
      // Success -> reset the page for a new article (status confirmation is preserved).
      resetDraft();
    } catch {
      setActionError('전송 중 오류가 발생했습니다.');
    }
  }, [adapter, articleId, assembleDto, model, user.role, resetDraft, lockError]);

  return {
    // Editor surface: structured content (text + ordered inline embeds) + plain body text.
    content,
    bodyText: adapter.getBodyText(),
    setBodyMarkup,
    embed,
    removeEmbed,
    appendEnd,
    getMarkup: adapter.getMarkup,
    assembleDto,
    common, updateCommon,
    status,
    // SPEC-NEWS-REVISE-007 REQ-VO-MAPPING — read-only ContentsVO 8 fields; null in a blank-new context
    // (WritePage renders the read-only area only when this is non-null — AC-MAP-2/3).
    readonlyMeta,
    lifecycleStatus, actionError,
    // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — null when the lock is free / acquired; non-null
    // ({ reason }) when the editor must stay read-only because another holder is editing.
    lockError,
    send: () => submitAction('send'),
    hold: () => submitAction('hold'),
    kill: () => submitAction('kill'),
  };
}
