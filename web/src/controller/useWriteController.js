// @MX:ANCHOR: [AUTO] Write-page controller — DTO assembly + send/hold action coordination (fan_in across WritePage panels).
// @MX:REASON: centralizes [DP-F5] contract (UI sends action+DTO only, never computes lifecycle state) and [DP-F3]
// proxy search consumption; multiple panels depend on this single coordinator, and tests assert its exact calls.
//
// Controller for the article-write page. Holds editor markup + common-info fields, assembles the DTO,
// and routes send/hold through the Model. The client NEVER computes the next lifecycle state.
import { useState, useCallback } from 'react';
import { useModel } from '../app/context.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';

const EMPTY_COMMON = Object.freeze({
  author: '', coAuthor: '', content: '', region: '', attribute: '', keyword: '',
  internalComment: '', externalComment: '', attachmentFile: '', referenceFile: '',
  embargoAt: '', secondaryEmbargoAt: '',
});

export function useWriteController(user) {
  const model = useModel();
  // Editor adapter (DP-F1): the page programs against the adapter, not a concrete library.
  // SPEC-UI-EDITOR-001 uses the concrete structured adapter (text + ordered inline embeds).
  const [adapter] = useState(() => createStructuredEditorAdapter());
  // React mirror of the adapter content so the editor view re-renders on edits/embeds.
  const [content, setContent] = useState(() => adapter.getContent());
  const [common, setCommon] = useState({ ...EMPTY_COMMON });
  const [articleId, setArticleId] = useState('A-DRAFT');
  const [lifecycleStatus, setLifecycleStatus] = useState(null);
  const [actionError, setActionError] = useState(null);

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

  const updateCommon = useCallback((field, value) => {
    setCommon((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Assemble the article DTO from editor markup (overwrite-on-save markupVersion) + common-info fields. */
  const assembleDto = useCallback(() => ({
    ...common,
    markupVersion: adapter.getMarkup(),
  }), [common, adapter]);

  // [DP-F5] send/hold: persist DTO, then submit action+DTO only; display backend-returned state.
  const submitAction = useCallback(async (action) => {
    setActionError(null);
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
        // EC-5: rejected transition -> notify, do NOT show a state change.
        setActionError(`전송이 거부되었습니다 (${result?.reason ?? 'rejected'}).`);
        return;
      }
      setLifecycleStatus(result.status);
    } catch {
      setActionError('전송 중 오류가 발생했습니다.');
    }
  }, [articleId, assembleDto, model, user.role]);

  return {
    // Editor surface: structured content (text + ordered inline embeds) + plain body text.
    content,
    bodyText: adapter.getBodyText(),
    setBodyMarkup,
    embed,
    getMarkup: adapter.getMarkup,
    assembleDto,
    common, updateCommon,
    lifecycleStatus, actionError,
    send: () => submitAction('send'),
    hold: () => submitAction('hold'),
  };
}
