// @MX:ANCHOR: [AUTO] Write-page controller — DTO assembly + send/hold/kill action coordination (fan_in across WritePage panels).
// @MX:REASON: centralizes [DP-F5] contract (UI sends action+DTO only, never computes lifecycle state) and [DP-F3]
// proxy search consumption; multiple panels depend on this single coordinator, and tests assert its exact calls.
//
// Controller for the article-write page. Holds editor markup + common-info fields, assembles the DTO,
// and routes send/hold/kill through the Model. The client NEVER computes the next lifecycle state.
// After a SUCCESSFUL action the write page is reset to a fresh draft (news.md: 기사 작성페이지는 초기화 된다),
// while the backend-returned status confirmation remains visible.
import { useState, useCallback, useEffect, useRef } from 'react';
import { useModel, useSession } from '../app/context.js';
import { ROUTES } from '../app/routing.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';
import { hasEndMarker, deserializeContent } from '../model/editorContent.js';

// SPEC-NEWS-REVISE: 작성 중이던 새 초안을 list.do(조회)로 갔다 돌아와도(WritePage unmount/remount) 유지한다.
// httpModel 의 sessionId 영속 패턴과 동일하게 sessionStorage 에 저장한다 — same-tab 페이지 전환과 F5 새로
// 고침에는 살아남고, 탭/브라우저를 닫으면(세션 종료, news.md lockYN) 함께 사라진다. localStorage 가 아니라
// sessionStorage 인 이유가 이 도메인 규칙과 일치한다.
const DRAFT_STORAGE_KEY = 'newsroom.writeDraft';

// 멀티탭 작성 — 워크스페이스(WriteWorkspace)는 탭마다 별도 초안 키('newsroom.writeDraft.<tabId>')를
// options.draftKey 로 주입해 탭 간 초안이 섞이지 않게 한다. 키 미지정 단독 사용은 종전 키 그대로.
/** Safe sessionStorage read — guarded so the controller never throws in non-browser/test contexts. */
function readStoredDraft(key = DRAFT_STORAGE_KEY) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeStoredDraft(value, key = DRAFT_STORAGE_KEY) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode/quota) — degrade to in-memory only; no throw.
  }
}
function clearStoredDraft(key = DRAFT_STORAGE_KEY) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore — clearing is best effort.
  }
}

// SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — 잠금 충돌 시 사용자에게 노출되는 문자열 메시지(lockError 는 문자열|null).
const LOCK_CONFLICT_MESSAGE = '다른 사용자가 편집 중입니다.';

// Page-scoped sessionId generator (D2-5 = A strict): one UUID per editor mount so two tabs of the
// same user collide on the lock. Falls back to a Math.random pair when crypto.randomUUID is
// unavailable (jsdom/older Node).
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
// embargoAt/secondEmbargoAt. The Contents table persists ALL of these fields — the 8 common-info
// columns (coAuthor/region/attribute/keyword/internalComment/externalComment/attachmentFile/
// referenceFile) were added by the edit-load fix, so a loaded row restores the full 공통정보. Rows
// saved BEFORE that migration carry NULL in those columns and still land here as blank (no crash).
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

// True when the deserialized markup envelope carries at least one block (any text or embed). An EMPTY
// editor still serializes to a non-empty JSON string ({"format":...,"blocks":[]}), so a raw-string
// emptiness test is wrong; we deserialize and inspect blocks instead. Text blocks may be whitespace-only
// (e.g. a lone '\n'), which we treat as empty for persistence purposes.
function markupHasBlocks(markup) {
  try {
    const { blocks } = deserializeContent(markup);
    if (!Array.isArray(blocks)) return false;
    return blocks.some((b) => (b.type === 'embed') || (b.type === 'text' && (b.text ?? '').trim() !== ''));
  } catch {
    return false;
  }
}

// A draft is worth persisting only when it carries real user input: non-empty editor body/embeds OR any
// common-info field beyond the auto-defaulted 작성자. This keeps sessionStorage empty for a pristine page
// (so a brand-new mount never resurrects a blank), and avoids cross-context bleed.
function draftHasContent(markup, common, authorDefault) {
  if (markupHasBlocks(markup)) return true;
  for (const key of Object.keys(EMPTY_COMMON)) {
    const value = common[key];
    if (key === 'author') {
      // 작성자 is auto-filled with the user's name; only a CHANGED author counts as content.
      if (value !== '' && value !== authorDefault) return true;
    } else if (value !== '') {
      return true;
    }
  }
  return false;
}

/**
 * @param {AuthUser} user
 * @param {{ editArticleId?: string, draftKey?: string }} [options] when editArticleId is set, the
 *   controller loads that article on mount (markupVersion + common fields) and saves PUT (update)
 *   instead of POST (create). draftKey overrides the sessionStorage key for the NEW-draft persistence
 *   (멀티탭: 탭별 'newsroom.writeDraft.<tabId>'); defaults to the single-page legacy key.
 */
export function useWriteController(user, options = {}) {
  const { editArticleId, draftKey = DRAFT_STORAGE_KEY } = options;
  const model = useModel();
  // SPEC-EDIT-LOCK-001 — 차단 진입 시 목록 복귀(navigate)와 logout 해제 콜백 등록에 쓰인다.
  const session = useSession();
  const authorDefault = user.name ?? '';
  // SPEC-NEWS-REVISE: rehydrate a previously-typed NEW draft (작성 → 조회 전환 → 복귀) from sessionStorage.
  // Only in the blank-new context (no editArticleId) — an edit context loads fresh from the server and
  // MUST win (편집 로드 우선), so a saved draft never seeds it. A pristine/blank draft is treated as none.
  const initialDraft = (() => {
    if (editArticleId) return null;
    const stored = readStoredDraft(draftKey);
    if (!stored) return null;
    const markup = typeof stored.markup === 'string' ? stored.markup : '';
    const common = { ...EMPTY_COMMON, author: authorDefault, ...(stored.common ?? {}) };
    if (!draftHasContent(markup, common, authorDefault)) return null;
    return { markup, common, articleId: stored.articleId ?? 'A-DRAFT', status: stored.status ?? 'RDS' };
  })();
  // Editor adapter (DP-F1): the page programs against the adapter, not a concrete library.
  // SPEC-UI-EDITOR-001 uses the concrete structured adapter (text + ordered inline embeds).
  const [adapter] = useState(() => createStructuredEditorAdapter(initialDraft?.markup ?? ''));
  // React mirror of the adapter content so the editor view re-renders on edits/embeds.
  const [content, setContent] = useState(() => adapter.getContent());
  // news.md 기사 에디터 공통정보: 작성자는 로그인한 사용자 정보의 이름을 입력한다. The 작성자 field DEFAULTS
  // to the logged-in user's name for a fresh draft; the user may still edit it (updateCommon), and an
  // edit-loaded row overrides it via commonFromRow (the DB row's author wins when present). A restored
  // draft (above) re-seeds the saved common-info instead of the bare default.
  const [common, setCommon] = useState(() => initialDraft?.common ?? { ...EMPTY_COMMON, author: authorDefault });
  const [articleId, setArticleId] = useState(() => initialDraft?.articleId ?? 'A-DRAFT');
  // Status of the article currently in the editor (news.md 기사 작성 페이지 내 버튼): the 송고/보류/KILL
  // buttons are shown only while this is 'RDS'. A fresh draft starts at INITIAL_STATUS = 'RDS'; an
  // edit-loaded row adopts its own row.status. This is the EDITING status and is intentionally separate
  // from `lifecycleStatus`, which is the backend-returned confirmation shown AFTER an action.
  const [status, setStatus] = useState(() => initialDraft?.status ?? 'RDS');
  const [lifecycleStatus, setLifecycleStatus] = useState(null);
  const [actionError, setActionError] = useState(null);
  // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — lockError 는 문자열(또는 null). 충돌(409) 시 LOCK_CONFLICT_MESSAGE
  // 를 담아 WritePage 가 ALERT + 배너 + 에디터 비활성을 그릴 수 있게 한다 (NFR-A11Y).
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
  // SPEC-EDIT-LOCK-001 — true while THIS mount holds the server lock. Cleared on release and on a
  // successful action (server auto-releases) so unmount/beforeunload never double-unlocks.
  const acquiredLockRef = useRef(false);
  // 보유 잠금 해제 (단일 경로): unmount, beforeunload, logout 콜백이 모두 이 함수를 거친다.
  // 미보유 상태(차단 진입, 액션 후 auto-release)에서는 no-op — unlockArticle 을 호출하지 않는다.
  const releaseHeldLock = useCallback(() => {
    if (!acquiredLockRef.current || !editArticleId) return;
    acquiredLockRef.current = false;
    try {
      // Best-effort: unload/unmount 경로는 절대 throw 하면 안 된다 (httpModel 은 keepalive 로 전송).
      model.unlockArticle?.(editArticleId)?.catch?.(() => {});
    } catch {
      // Ignore — release is best effort.
    }
  }, [model, editArticleId]);

  // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — lock-before-load: editArticleId 가 있으면 마운트 시 먼저
  // lockArticle(id) 로 잠금을 획득하고, 성공한 경우에만 queryArticles 로 기사를 로드한다. 409(locked) 등
  // 실패 시 lockError 를 세팅하고 로드를 차단한 뒤 session.navigate(ROUTES.VIEW) 로 목록에 복귀한다.
  // 신규 초안(editArticleId 없음)은 잠금/로드를 모두 건너뛴다 (blank-new 동작 보존).
  useEffect(() => {
    if (!editArticleId) return undefined;
    let cancelled = false;

    (async () => {
      // 1) 잠금 획득 (lock-before-load).
      let lockResult;
      try {
        lockResult = await model.lockArticle(editArticleId);
      } catch {
        lockResult = { ok: false, reason: 'network-error' };
      }
      if (cancelled) return;
      if (!lockResult?.ok) {
        // 차단: 잠금 미획득 → 에디터 read-only + 목록 복귀. queryArticles 는 호출하지 않는다.
        setLockError(LOCK_CONFLICT_MESSAGE);
        session?.navigate?.(ROUTES.VIEW);
        return;
      }
      acquiredLockRef.current = true;
      setLockError(null);

      // 2) 잠금 성공 후에만 기사 로드.
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
  }, [editArticleId, model, adapter, session]);

  // SPEC-NEWS-REVISE — persist the in-progress NEW draft so leaving for 조회(list.do) and returning
  // (WritePage remount) keeps the editor body, title, and 공통정보. Runs only in the blank-new context
  // (no editArticleId): an edit context owns its server-loaded row + lock and must not be shadowed by a
  // saved draft. A pristine/blank draft is removed rather than stored so a fresh page never resurrects an
  // empty draft. `content` is the React mirror of the adapter, so the latest markup is read via getMarkup().
  // 멀티탭: draftKey 가 탭별 키를 지정하므로 각 탭의 초안이 독립적으로 보존된다.
  useEffect(() => {
    if (editArticleId) return;
    const markup = adapter.getMarkup();
    if (draftHasContent(markup, common, authorDefault)) {
      writeStoredDraft({ markup, common, articleId, status }, draftKey);
    } else {
      clearStoredDraft(draftKey);
    }
  }, [editArticleId, adapter, content, common, articleId, status, authorDefault, draftKey]);

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
    const onBeforeUnload = () => { releaseHeldLock(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      // React unmount(페이지 이동/핫리로드)에서도 보유 잠금을 해제한다.
      releaseHeldLock();
    };
  }, [editArticleId, releaseHeldLock]);

  // logout 경로 — App.handleLogout 이 세션 클리어 전에 호출할 해제 콜백을 등록한다(release-before-clear-session).
  useEffect(() => {
    if (!editArticleId) return undefined;
    session?.registerEditLockRelease?.(() => { releaseHeldLock(); });
    return undefined;
  }, [editArticleId, session, releaseHeldLock]);

  // Set the body from typed input. Embeds already inserted are preserved (REQ-EDIT-ADP-003).
  //
  // Bug 1 fix — OPTIONAL 2nd arg `orderedContent`: a pre-ordered {blocks} snapshot read from the live
  // editor DOM. When present it is applied verbatim (adapter.setOrderedContent) so the true interleave
  // of text and inline embeds is preserved in the model AND in markupVersion. Without it, the flat-text
  // path (adapter.setBodyText) runs exactly as before — this keeps every existing single-arg caller
  // (Alt+Y/reset/edit-load/IME paths that pass only text) behaving identically (backward-compatible).
  // The flat path rebuilt `[...text, ...embeds]`, which reordered a trailing embed BELOW text typed
  // after it; the ordered path keeps the embed where the user placed it (visible AND persisted order).
  const setBodyMarkup = useCallback((next, orderedContent) => {
    if (orderedContent) {
      adapter.setOrderedContent(orderedContent);
    } else {
      adapter.setBodyText(next);
    }
    setContent(adapter.getContent());
  }, [adapter]);

  // Bug 1 fix — set the editor content from a pre-ORDERED block list (read from the live DOM) so the
  // true interleave of text and inline embeds is preserved in the model (and thus in markupVersion).
  // setBodyText placed all text before all embeds, so a trailing embed was reordered BELOW text typed
  // after it; this keeps the embed where the user actually placed it (visible AND persisted order).
  const setBodyContent = useCallback((ordered) => {
    adapter.setOrderedContent(ordered);
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

  // news.md 기사 에디터: Alt+Y places "(끝)" as the FINAL block AFTER all embeds (shown in 골드색 by the
  // view). SPEC-NEWS-REVISE: 최종 시각 순서는 본문 텍스트 → embeds → "(끝)". The token is exactly "(끝)"
  // (prefix-free). It persists in markupVersion (round-trips via setMarkup) because it is stored as a
  // literal trailing text block, and getBodyText() still ends with "(끝)" (embeds contribute no text) so
  // the 송고 (끝) 가드가 그대로 통과한다.
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
   * The editor's `secondaryEmbargoAt` is duplicated onto the backend column name `secondEmbargoAt` —
   * without this mapping the 2nd embargo was silently dropped on INSERT/UPDATE (name mismatch), and
   * commonFromRow's reverse mapping (secondEmbargoAt → secondaryEmbargoAt) had nothing to restore.
   */
  const assembleDto = useCallback(() => ({
    ...common,
    secondEmbargoAt: common.secondaryEmbargoAt,
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
    // SPEC-NEWS-REVISE — 송고/보류/KILL 성공 후 초기화는 보존 대상이 아니다 (news.md): 보존된 draft 도
    // 함께 비운다. 이렇게 하지 않으면 액션 성공 → 빈 페이지로 복귀 후 다시 옛 초안이 되살아난다. 동기 clear
    // 로 persist effect 의 다음 write 보다 먼저 키를 제거한다 (effect 도 빈 draft 면 어차피 clear 한다).
    clearStoredDraft(draftKey);
  }, [adapter, user.name, draftKey]);

  // [DP-F5] send/hold/kill: persist DTO, then submit action+DTO only; display backend-returned state.
  const submitAction = useCallback(async (action) => {
    setActionError(null);
    // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — 잠금이 거부된(차단) 상태에서는 모든 transport 호출을 막는다
    // (페이지는 read-only). 서버측 잠금 가드를 클라이언트에서 미러링해 충돌이 네트워크 에러로 가려지지 않게 한다.
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
      const isEditContext = articleId !== 'A-DRAFT';
      // REQ-FE-WRITE-013 v0.3.0 — 송고뿐 아니라 보류/KILL도 액션 전에 현재 DTO를 저장한다. 종전에는
      // send만 저장해서, 미저장 새 초안(A-DRAFT)에 보류/KILL을 누르면 applyAction이 존재하지 않는
      // 기사 ID로 호출되어 서버가 not-found로 거부했다 (보류/KILL 미동작의 원인).
      //
      // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK / REQ-API-INSERT-UPDATE-SPLIT — when this is an edit
      // context (articleId !== 'A-DRAFT'), include the page-scoped sessionId so the server PUT
      // route's lock guard (assertLockHolder) accepts the request. The DTO field is stripped by
      // server/index.js before the partial update is applied (it is transport-only metadata).
      // v0.6.0 — 신규 초안(A-DRAFT) KILL 은 저장(기사 생성)을 건너뛴다: 존재하지 않는 기사는 KILL
      // 대상이 아니며, 저장하면 "기사를 만들었다 바로 죽이는" 동작이 된다. WritePage 도 같은 이유로
      // 초안에서 KILL 버튼을 숨기지만(!isDraft 게이트), 컨트롤러 정책으로도 이중 방어한다.
      if (action !== 'kill' || isEditContext) {
        const dto = assembleDto();
        const payload = isEditContext ? { ...dto, sessionId: pageSessionIdRef.current } : dto;
        const saved = await model.saveArticle(articleId, payload);
        if (saved?.ok && saved.articleId) {
          id = saved.articleId;
          setArticleId(id);
        }
      }
      // 최초 송고 = RDS (2026-06-07 결정): 신규 기사(A-DRAFT)의 송고는 권한과 무관하게 상태 전이
      // 없이 RDS 그대로 저장만 한다 — 데스크 미송고 목록에 올라 데스크 검수를 기다린다. 생애주기
      // 전이 표(D 송고 → DPS 등)는 기존 기사(편집 컨텍스트)의 송고에만 적용된다. 보류/KILL 은
      // 신규에서도 종전대로 전이를 일으킨다 (R→RRH/RRK, D→DDH/DDK).
      if (action === 'send' && !isEditContext) {
        setLifecycleStatus('RDS');
        resetDraft();
        return;
      }
      // AC-EDIT-LOCK-6 — 편집 컨텍스트에선 페이지 락 sessionId를 4번째 인자로 함께 보내 서버 action
      // 라우트의 락 게이트가 호출자를 락 보유자 본인으로 식별하게 한다. 신규 초안은 락이 없으므로
      // 기존 3-인자 호출을 유지한다 (게이트는 락이 빈 기사를 그대로 통과시킨다).
      const result = isEditContext
        ? await model.applyAction(id, user.role, action, { sessionId: pageSessionIdRef.current })
        : await model.applyAction(id, user.role, action);
      if (!result?.ok) {
        // EC-5: rejected transition -> notify, do NOT show a state change, do NOT reset the page.
        setActionError(`전송이 거부되었습니다 (${result?.reason ?? 'rejected'}).`);
        return;
      }
      // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — 액션 성공 시 서버가 잠금을 auto-release 한다. 클라이언트 획득
      // 플래그를 꺼서 이후 unmount/beforeunload 가 다시 unlockArticle 을 호출하지 않게 한다(이중 해제 방지).
      acquiredLockRef.current = false;
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
    // v0.6.0 — 기사아이디가 아직 생성되지 않은 신규 초안인지 (A-DRAFT 센티널). WritePage가 이 값으로
    // KILL 버튼 노출을 게이트한다 (news.md: 기사아이디 미생성 기사의 작성 화면에는 KILL 버튼이 없다 —
    // 존재하지 않는 기사는 KILL 대상이 될 수 없고, 종전엔 초안 KILL이 기사를 만들었다 바로 죽였다).
    isDraft: articleId === 'A-DRAFT',
    // SPEC-NEWS-REVISE-007 REQ-VO-MAPPING — read-only ContentsVO 8 fields; null in a blank-new context
    // (WritePage renders the read-only area only when this is non-null — AC-MAP-2/3).
    readonlyMeta,
    lifecycleStatus, actionError,
    // SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — null when the lock is free / acquired; a string message
    // (LOCK_CONFLICT_MESSAGE) when the editor must stay read-only because another holder is editing.
    lockError,
    send: () => submitAction('send'),
    hold: () => submitAction('hold'),
    kill: () => submitAction('kill'),
  };
}
