// @MX:ANCHOR: [AUTO] Write-page controller — DTO assembly + send/hold action coordination (fan_in across WritePage panels).
// @MX:REASON: centralizes [DP-F5] contract (UI sends action+DTO only, never computes lifecycle state) and [DP-F3]
// proxy search consumption; multiple panels depend on this single coordinator, and tests assert its exact calls.
//
// Controller for the article-write page. Holds editor markup + common-info fields, assembles the DTO,
// and routes send/hold through the Model. The client NEVER computes the next lifecycle state.
import { useState, useCallback } from 'react';
import { useModel } from '../app/context.js';
import { createPlainTextEditorAdapter } from '../model/editorAdapter.js';

const EMPTY_COMMON = Object.freeze({
  author: '', coAuthor: '', content: '', region: '', attribute: '', keyword: '',
  internalComment: '', externalComment: '', attachmentFile: '', referenceFile: '',
  embargoAt: '', secondaryEmbargoAt: '',
});

export function useWriteController(user) {
  const model = useModel();
  // Editor adapter (DP-F1): the page programs against the adapter, not a concrete library.
  const [adapter] = useState(() => createPlainTextEditorAdapter());
  const [body, setBody] = useState('');
  const [common, setCommon] = useState({ ...EMPTY_COMMON });
  const [articleId, setArticleId] = useState('A-DRAFT');
  const [lifecycleStatus, setLifecycleStatus] = useState(null);
  const [actionError, setActionError] = useState(null);

  const setBodyMarkup = useCallback((next) => {
    adapter.setMarkup(next);
    setBody(next);
  }, [adapter]);

  const embed = useCallback((reference) => {
    // Embed a media/article reference into the editor body (REQ-FE-WRITE-010/011).
    setBody((prev) => {
      const next = prev ? `${prev}\n${reference}` : reference;
      adapter.setMarkup(next);
      return next;
    });
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
    body, setBodyMarkup, embed,
    common, updateCommon,
    lifecycleStatus, actionError,
    send: () => submitAction('send'),
    hold: () => submitAction('hold'),
  };
}
