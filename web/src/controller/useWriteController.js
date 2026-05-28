// @MX:ANCHOR: [AUTO] Write-page controller — DTO assembly + send/hold/kill action coordination (fan_in across WritePage panels).
// @MX:REASON: centralizes [DP-F5] contract (UI sends action+DTO only, never computes lifecycle state) and [DP-F3]
// proxy search consumption; multiple panels depend on this single coordinator, and tests assert its exact calls.
//
// Controller for the article-write page. Holds editor markup + common-info fields, assembles the DTO,
// and routes send/hold/kill through the Model. The client NEVER computes the next lifecycle state.
// After a SUCCESSFUL action the write page is reset to a fresh draft (news.md: 기사 작성페이지는 초기화 된다),
// while the backend-returned status confirmation remains visible.
import { useState, useCallback, useEffect } from 'react';
import { useModel } from '../app/context.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';

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
      // Adopt the loaded row's status so the action buttons gate on the real article state.
      if (row.status != null) setStatus(row.status);
    })();
    return () => { cancelled = true; };
  }, [editArticleId, model, adapter]);

  // Set the plain body text (typed input). Embeds already inserted are preserved (REQ-EDIT-ADP-003).
  const setBodyMarkup = useCallback((next) => {
    adapter.setBodyText(next);
    setContent(adapter.getContent());
  }, [adapter]);

  // @MX:NOTE: [AUTO] Inline embed insertion (REQ-EDIT-EMBED-001) — inserts a structured inline block
  // (image/video/article descriptor) instead of appending a "[source] url" / "기사:id" marker string.
  const embed = useCallback((descriptor) => {
    adapter.embed(descriptor);
    setContent(adapter.getContent());
  }, [adapter]);

  // news.md 기사 에디터: Alt+Y appends "(끝)" to the END of the body text (shown in 골드색 by the view).
  // It persists in markupVersion (round-trips via setMarkup) because it is stored as literal body text.
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
  }, [adapter, user.name]);

  // [DP-F5] send/hold/kill: persist DTO, then submit action+DTO only; display backend-returned state.
  const submitAction = useCallback(async (action) => {
    setActionError(null);
    // news.md 기사작성 워크플로우: 송고/보류 require a title (the editor's first line). When it is
    // empty, abort BEFORE saving or applying the action and surface the inline alert. KILL is exempt.
    if (action === 'send' || action === 'hold') {
      if (adapter.getStructure().title.trim() === '') {
        setActionError('제목이 없어 송고/보류할 수 없습니다.');
        return;
      }
    }
    try {
      let id = articleId;
      if (action === 'send') {
        const saved = await model.saveArticle(articleId, assembleDto());
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
  }, [adapter, articleId, assembleDto, model, user.role, resetDraft]);

  return {
    // Editor surface: structured content (text + ordered inline embeds) + plain body text.
    content,
    bodyText: adapter.getBodyText(),
    setBodyMarkup,
    embed,
    appendEnd,
    getMarkup: adapter.getMarkup,
    assembleDto,
    common, updateCommon,
    status,
    lifecycleStatus, actionError,
    send: () => submitAction('send'),
    hold: () => submitAction('hold'),
    kill: () => submitAction('kill'),
  };
}
