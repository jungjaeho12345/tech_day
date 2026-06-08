// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류/KILL above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold/kill go through the controllers (DP-F3/DP-F5). A successful action resets the page.
// The action buttons are role+status gated (news.md 기사 작성 페이지 내 버튼): 송고/보류 for role R|D|Z and
// KILL for role R|Z, both only while the editing article's status is RDS. v0.6.0: KILL additionally
// requires a generated articleId (edit context) — an id-less draft (A-DRAFT) never shows KILL.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';
import { buildColorSegments } from './editorColoring.js';
import { getCaretCharOffset, getSelectionOffsets, setCaretCharOffset, setCaretAfterEmbed, getBodyTextFromDom, findEmbedIndexBeforeCaret, readOrderedContentFromDom } from './editorCaret.js';
import { embedOrdinalAtInsertOffset, insertNewlineIntoContent } from '../model/editorContent.js';
import { insertNewlineAt } from './editorNewline.js';
import { deleteCurrentLine } from './editorShortcuts.js';
import { isYouTubeUrl, findClipboardImageFile, readFileAsDataUrl } from './clipboardEmbed.js';

const TABS = ['공통정보', '이미지', '영상', '글기사'];

const COMMON_FIELDS = [
  ['author', '작성자'], ['coAuthor', '공동작성'], ['content', '내용'], ['region', '지역'],
  ['attribute', '속성'], ['keyword', '키워드'], ['internalComment', '내부코멘트'],
  ['externalComment', '외부코멘트'], ['attachmentFile', '첨부파일'], ['referenceFile', '자료파일'],
];

// SPEC-NEWS-REVISE-007 REQ-VO-MAPPING — read-only ContentsVO 8 fields shown in the edit context
// (기사아이디·수정자·송고자·부서·부서코드·작성시간·편집시간·송고시간). Ordered label/value pairs.
const READONLY_META_FIELDS = [
  ['articleId', '기사아이디'], ['modifier', '수정자'], ['sender', '송고자'],
  ['department', '부서'], ['departmentCode', '부서코드'], ['createdAt', '작성시간'],
  ['editedAt', '편집시간'], ['sentAt', '송고시간'],
];

// @MX:NOTE: [AUTO] Read-only ContentsVO display area (SPEC-NEWS-REVISE-007 AC-MAP-2/4). Rendered ONLY
// when meta is non-null (edit context); a blank-new page passes null and renders nothing (AC-MAP-3).
// Values are display-only <span>s (never inputs) so the 8 fields cannot be edited; a missing field is
// already coerced to '' by the controller, so no 'undefined'/'null' text ever appears.
function ReadonlyMetaPanel({ meta }) {
  return (
    <dl data-testid="readonly-meta" className="yh-readonly-meta" aria-label="기사 정보">
      {READONLY_META_FIELDS.map(([key, label]) => (
        <div key={key} className="yh-readonly-meta__row">
          <dt className="yh-readonly-meta__label">{label}</dt>
          <dd className="yh-readonly-meta__value" data-testid={`readonly-${key}`}>{meta[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

function CommonInfoPanel({ common, updateCommon }) {
  return (
    <div data-testid="panel-공통정보" role="tabpanel" className="yh-tabpanel">
      {COMMON_FIELDS.map(([key, label]) => (
        <div key={key} className="yh-field-row">
          <label htmlFor={`f-${key}`}>{label}</label>
          <input id={`f-${key}`} value={common[key]} onChange={(e) => updateCommon(key, e.target.value)} />
        </div>
      ))}
      <div className="yh-field-row">
        <label htmlFor="f-embargoAt">엠바고 시간</label>
        <input id="f-embargoAt" type="datetime-local" value={common.embargoAt}
          onChange={(e) => updateCommon('embargoAt', e.target.value)} />
      </div>
      <div className="yh-field-row">
        <label htmlFor="f-secondaryEmbargoAt">2차 엠바고 시간</label>
        <input id="f-secondaryEmbargoAt" type="datetime-local" value={common.secondaryEmbargoAt}
          onChange={(e) => updateCommon('secondaryEmbargoAt', e.target.value)} />
      </div>
    </div>
  );
}

// '이미지' tab embeds images; '영상' tab embeds video references (REQ-EDIT-EMBED-002/003).
function MediaPanel({ tabName, embedType, onEmbed }) {
  // type-routed search: embedType ('image'|'video') selects the provider (image=Google, video=YouTube).
  const { results, state, search } = useMediaSearch(embedType);
  const [query, setQuery] = useState('');
  return (
    <div data-testid={`panel-${tabName}`} role="tabpanel" className="yh-tabpanel">
      <div className="yh-search-bar">
        <label htmlFor={`media-q-${tabName}`} className="yh-text-muted" style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>검색어</label>
        <input id={`media-q-${tabName}`} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="yh-btn yh-btn--secondary yh-btn--sm" onClick={() => search(query)}>검색</button>
      </div>
      {state === 'empty' ? <p className="yh-text-muted">결과 없음</p> : null}
      {state === 'error' ? <p role="status" className="yh-alert">검색 오류</p> : null}
      <ul className="yh-result-list">
        {results.map((r) => (
          <li key={r.url} className="yh-result-row">
            {r.thumbnailUrl ? <img className="yh-result-thumb" src={r.thumbnailUrl} alt="" /> : null}
            <span>{r.title}</span>
            <button
              type="button"
              className="yh-btn yh-btn--secondary yh-btn--sm"
              onClick={() => onEmbed({ type: embedType, source: r.source, title: r.title, url: r.url, thumbnailUrl: r.thumbnailUrl })}
            >
              삽입 {r.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextArticlePanel({ onEmbed }) {
  const { results, search } = useArticleSearch();
  const [query, setQuery] = useState('');
  return (
    <div data-testid="panel-글기사" role="tabpanel" className="yh-tabpanel">
      <div className="yh-search-bar">
        <label htmlFor="article-q" className="yh-text-muted" style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>검색어</label>
        <input id="article-q" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="yh-btn yh-btn--secondary yh-btn--sm" onClick={() => search(query)}>검색</button>
      </div>
      <ul className="yh-result-list">
        {results.map((a) => (
          <li key={a.articleId} className="yh-result-row">
            <span>{a.title}</span>
            <button
              type="button"
              className="yh-btn yh-btn--secondary yh-btn--sm"
              onClick={() => onEmbed({ type: 'article', articleId: a.articleId, title: a.title })}
            >
              삽입 {a.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// @MX:NOTE: [AUTO] Build an inline embed <span> DOM node for paintEditor. contenteditable=false +
// zero text contribution: the embed span carries NO text children, so DOM textContent stays equal to
// bodyText. data-testid mirrors InlineEmbed (embed-image/embed-video/embed-article) so the existing
// tests find embeds inline within the contentEditable. Defensive: thumbnailUrl falls back to url.
//
// SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE (D2-6 = C): when `onRemoveEmbed` is supplied, every embed gets
// an × affordance (<button aria-label="임베드 삭제">) that triggers onRemoveEmbed(index). The button is
// type="button" so it never submits a parent form, and uses onMouseDown=preventDefault to keep the
// contentEditable caret state stable across the click.
function buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed) {
  const span = doc.createElement('span');
  span.className = 'yh-embed-inline';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-embed-index', String(index));

  // Tab-focusable so Backspace handling can target the embed (and a11y).
  span.setAttribute('tabindex', '0');

  if (!embed) return span;

  // Title/url labels live INSIDE the embed span. They contribute to DOM textContent, but caret math
  // (editorCaret.js) excludes [data-embed-index] descendants, so the bodyText model stays intact.
  // SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — × affordance creator (D2-6 = C).
  const appendDeleteButton = (target) => {
    if (typeof onRemoveEmbed !== 'function') return;
    const btn = doc.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', '임베드 삭제');
    btn.className = 'yh-embed__delete';
    btn.textContent = '×';
    btn.addEventListener('mousedown', (e) => {
      // Keep the contentEditable caret stable across the click.
      e.preventDefault();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRemoveEmbed(index);
    });
    target.appendChild(btn);
  };

  if (embed.type === 'image') {
    span.setAttribute('data-testid', 'embed-image');
    span.classList.add('yh-embed', 'yh-embed--image');
    // news.md 기사 에디터: 클립보드에서 붙여넣기한 이미지/유투브 크기는 에디터크기 기준 10%*10%.
    if (embed.source === 'clipboard') span.classList.add('yh-embed--clipboard');
    const img = doc.createElement('img');
    img.className = 'yh-embed__img';
    img.setAttribute('src', embed.thumbnailUrl || embed.url || '');
    img.setAttribute('alt', embed.title || '삽입 이미지');
    span.appendChild(img);
    appendDeleteButton(span);
    return span;
  }
  if (embed.type === 'video') {
    span.setAttribute('data-testid', 'embed-video');
    span.classList.add('yh-embed', 'yh-embed--video');
    if (embed.source === 'clipboard') span.classList.add('yh-embed--clipboard');
    if (embed.thumbnailUrl) {
      const img = doc.createElement('img');
      img.className = 'yh-embed__img';
      img.setAttribute('src', embed.thumbnailUrl);
      img.setAttribute('alt', embed.title || '영상');
      span.appendChild(img);
    }
    const mark = doc.createElement('span');
    mark.className = 'yh-embed__video-mark';
    mark.textContent = '영상';
    span.appendChild(mark);
    const titleSpan = doc.createElement('span');
    titleSpan.className = 'yh-embed__title';
    titleSpan.textContent = embed.title || embed.url || '영상';
    span.appendChild(titleSpan);
    if (embed.url) {
      const link = doc.createElement('a');
      link.className = 'yh-embed__link';
      link.setAttribute('href', embed.url);
      link.setAttribute('rel', 'noreferrer');
      link.textContent = embed.url;
      span.appendChild(link);
    }
    appendDeleteButton(span);
    return span;
  }
  if (embed.type === 'article') {
    span.setAttribute('data-testid', 'embed-article');
    span.classList.add('yh-embed', 'yh-embed--article');
    const mark = doc.createElement('span');
    mark.className = 'yh-embed__article-mark';
    mark.textContent = '기사';
    span.appendChild(mark);
    const titleSpan = doc.createElement('span');
    titleSpan.className = 'yh-embed__title';
    titleSpan.textContent = embed.title || embed.articleId || '내부 기사';
    span.appendChild(titleSpan);
    appendDeleteButton(span);
    return span;
  }
  return span;
}

function paintEditor(el, content, onRemoveEmbed) {
  const doc = el.ownerDocument;
  const blocks = typeof content === 'string'
    ? [{ type: 'text', text: content }]
    : (content?.blocks ?? []);
  const bodyText = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const segments = buildColorSegments(bodyText);

  const embedAtPos = [];
  let textPos = 0;
  let embedIndex = 0;
  for (const b of blocks) {
    if (b.type === 'text') {
      textPos += b.text.length;
    } else if (b.type === 'embed') {
      embedAtPos.push({ pos: textPos, embed: b.embed, index: embedIndex });
      embedIndex += 1;
    }
  }

  const frag = doc.createDocumentFragment();
  let pos = 0;
  let nextEmbedIdx = 0;

  const emitEmbedsAt = (currentPos) => {
    while (nextEmbedIdx < embedAtPos.length && embedAtPos[nextEmbedIdx].pos === currentPos) {
      const { embed, index } = embedAtPos[nextEmbedIdx];
      frag.appendChild(buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed));
      nextEmbedIdx += 1;
    }
  };

  emitEmbedsAt(0);

  for (const seg of segments) {
    if (seg.newline) {
      frag.appendChild(doc.createTextNode('\n'));
      pos += 1;
      emitEmbedsAt(pos);
      continue;
    }
    const segStart = pos;
    const segEnd = pos + seg.text.length;
    let cursor = segStart;
    while (nextEmbedIdx < embedAtPos.length && embedAtPos[nextEmbedIdx].pos < segEnd) {
      const target = embedAtPos[nextEmbedIdx].pos;
      if (target > cursor) {
        const span = doc.createElement('span');
        span.className = seg.cls === 'end' ? 'yh-end-mark' : `yh-line yh-line--${seg.cls}`;
        span.textContent = seg.text.slice(cursor - segStart, target - segStart);
        frag.appendChild(span);
      }
      const { embed, index } = embedAtPos[nextEmbedIdx];
      frag.appendChild(buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed));
      nextEmbedIdx += 1;
      cursor = target;
    }
    if (cursor < segEnd) {
      const span = doc.createElement('span');
      span.className = seg.cls === 'end' ? 'yh-end-mark' : `yh-line yh-line--${seg.cls}`;
      span.textContent = seg.text.slice(cursor - segStart);
      frag.appendChild(span);
    }
    pos = segEnd;
    emitEmbedsAt(pos);
  }
  while (nextEmbedIdx < embedAtPos.length) {
    const { embed, index } = embedAtPos[nextEmbedIdx];
    frag.appendChild(buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed));
    nextEmbedIdx += 1;
  }
  if (bodyText.endsWith('\n')) {
    frag.appendChild(doc.createElement('br'));
  }
  if (frag.lastChild && frag.lastChild.nodeType === 1
      && frag.lastChild.hasAttribute?.('data-embed-index')) {
    const filler = doc.createElement('br');
    filler.setAttribute('data-embed-trailing-br', '');
    frag.appendChild(filler);
  }
  el.replaceChildren(frag);
}

function BodyEditor({ content, bodyText, onChangeText, onAltY, onPasteEmbed, onCaretChange, onRemoveEmbed, pendingEmbedCaretRef, readOnly = false }) {
  const ref = useRef(null);
  const prevEmbedCountRef = useRef((content?.blocks ?? []).filter((b) => b.type === 'embed').length);
  const composingRef = useRef(false);
  const justComposedRef = useRef(false);
  const justComposedRafRef = useRef(null);
  const onRemoveEmbedRef = useRef(onRemoveEmbed);
  onRemoveEmbedRef.current = onRemoveEmbed;
  const pendingEnterAfterIme = useRef(false);
  const pendingEnterRafRef = useRef(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const contentWithText = useCallback((text) => {
    const embedBlocks = (contentRef.current?.blocks ?? []).filter((b) => b.type === 'embed');
    const blocks = text === '' ? [...embedBlocks] : [{ type: 'text', text }, ...embedBlocks];
    return { blocks };
  }, []);

  const orderedContentFromDom = useCallback((el) => {
    const embedBlocks = (contentRef.current?.blocks ?? []).filter((b) => b.type === 'embed');
    return readOrderedContentFromDom(el, (ordinal) => {
      const block = embedBlocks[ordinal];
      return block ? { ...block.embed } : null;
    });
  }, []);

  const handlePaste = useCallback((e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const imageFile = findClipboardImageFile(cd.items);
    if (imageFile) {
      e.preventDefault();
      readFileAsDataUrl(imageFile)
        .then((dataUrl) => {
          if (pendingEmbedCaretRef) pendingEmbedCaretRef.current = { offset: undefined };
          onPasteEmbed({
            type: 'image', source: 'clipboard', title: '붙여넣은 이미지',
            url: dataUrl, thumbnailUrl: dataUrl,
          });
        })
        .catch(() => {});
      return;
    }
    const text = cd.getData ? cd.getData('text') : '';
    if (isYouTubeUrl(text)) {
      e.preventDefault();
      if (pendingEmbedCaretRef) pendingEmbedCaretRef.current = { offset: undefined };
      onPasteEmbed({ type: 'video', source: 'clipboard', title: '붙여넣은 영상', url: text.trim() });
      return;
    }
  }, [onPasteEmbed]);

  const paintNow = useCallback((el, contentOrText) => {
    paintEditor(el, contentOrText, onRemoveEmbedRef.current);
  }, []);

  const paintWithCaret = useCallback((contentOrText) => {
    const el = ref.current;
    if (!el) return;
    if (composingRef.current) return;
    const focused = el.ownerDocument.activeElement === el;
    const caret = focused ? getCaretCharOffset(el) : null;
    paintNow(el, contentOrText);
    if (caret != null) setCaretCharOffset(el, caret);
  }, [paintNow]);

  const recolor = useCallback(() => {
    const el = ref.current;
    if (el) paintWithCaret(contentWithText(getBodyTextFromDom(el)));
  }, [paintWithCaret, contentWithText]);

  const insertNewline = useCallback((el) => {
    const offset = getCaretCharOffset(el);
    const next = insertNewlineAt(bodyText, offset);
    const caret = (offset == null ? bodyText.length : Math.min(offset, bodyText.length)) + 1;
    const nextContent = insertNewlineIntoContent(orderedContentFromDom(el), offset);
    paintNow(el, nextContent);
    setCaretCharOffset(el, caret);
    onChangeText(next, nextContent);
  }, [bodyText, onChangeText, orderedContentFromDom, paintNow]);

  const insertNewlineFromDom = useCallback((el) => {
    const text = getBodyTextFromDom(el);
    const offset = getCaretCharOffset(el);
    const next = insertNewlineAt(text, offset);
    const caret = (offset == null ? text.length : Math.min(offset, text.length)) + 1;
    const nextContent = insertNewlineIntoContent(orderedContentFromDom(el), offset);
    paintNow(el, nextContent);
    setCaretCharOffset(el, caret);
    onChangeText(next, nextContent);
  }, [onChangeText, orderedContentFromDom, paintNow]);

  const handleEnter = useCallback((e) => {
    if (e.key !== 'Enter') return false;
    e.preventDefault();
    if (composingRef.current || e.isComposing || e.keyCode === 229) {
      pendingEnterAfterIme.current = true;
      const el = e.currentTarget;
      if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingEnterRafRef.current);
        pendingEnterRafRef.current = null;
      }
      const runFallback = () => {
        pendingEnterRafRef.current = null;
        if (pendingEnterAfterIme.current) {
          pendingEnterAfterIme.current = false;
          insertNewlineFromDom(el);
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        pendingEnterRafRef.current = requestAnimationFrame(runFallback);
      } else {
        Promise.resolve().then(runFallback);
      }
      return true;
    }
    insertNewline(e.currentTarget);
    return true;
  }, [insertNewline, insertNewlineFromDom]);

  useEffect(() => {
    if (composingRef.current || justComposedRef.current) return;
    const el = ref.current;
    if (!el) return;
    const embedDomCount = el.querySelectorAll('[data-embed-index]').length;
    const embedModelCount = (content?.blocks ?? []).filter((b) => b.type === 'embed').length;
    if (getBodyTextFromDom(el) !== bodyText || embedDomCount !== embedModelCount) {
      const inserted = embedModelCount > prevEmbedCountRef.current
        && pendingEmbedCaretRef?.current != null;
      if (inserted) {
        const { offset } = pendingEmbedCaretRef.current;
        pendingEmbedCaretRef.current = null;
        const ordinal = embedOrdinalAtInsertOffset(content, offset);
        paintNow(el, content);
        if (ordinal != null) {
          el.focus?.();
          setCaretAfterEmbed(el, ordinal);
        }
      } else {
        paintWithCaret(content);
      }
    }
    prevEmbedCountRef.current = embedModelCount;
  }, [content, bodyText, paintWithCaret, paintNow, pendingEmbedCaretRef]);

  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent === '' && (bodyText !== '' || (content?.blocks ?? []).length > 0)) {
      paintNow(el, content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(justComposedRafRef.current);
      justComposedRafRef.current = null;
    }
    if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingEnterRafRef.current);
      pendingEnterRafRef.current = null;
    }
  }, []);

  return (
    <>
      <div
        id="editor-body"
        data-testid="editor-body"
        className="yh-editor-body"
        role="textbox"
        aria-multiline="true"
        aria-label="본문"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        ref={ref}
        onInput={(e) => {
          if (composingRef.current) return;
          const el = e.currentTarget;
          onChangeText(getBodyTextFromDom(el), orderedContentFromDom(el));
          if (onCaretChange) {
            const off = getCaretCharOffset(el);
            if (off != null) onCaretChange(off);
          }
        }}
        onKeyUp={(e) => {
          if (onCaretChange) {
            const off = getCaretCharOffset(e.currentTarget);
            if (off != null) onCaretChange(off);
          }
        }}
        onMouseUp={(e) => {
          if (onCaretChange) {
            const off = getCaretCharOffset(e.currentTarget);
            if (off != null) onCaretChange(off);
          }
        }}
        onPaste={handlePaste}
        onCompositionStart={() => {
          composingRef.current = true;
          justComposedRef.current = false;
          if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(justComposedRafRef.current);
            justComposedRafRef.current = null;
          }
          if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(pendingEnterRafRef.current);
            pendingEnterRafRef.current = null;
          }
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(justComposedRafRef.current);
          }
          justComposedRef.current = true;
          if (typeof requestAnimationFrame === 'function') {
            justComposedRafRef.current = requestAnimationFrame(() => {
              justComposedRef.current = false;
              justComposedRafRef.current = null;
            });
          } else {
            Promise.resolve().then(() => { justComposedRef.current = false; });
          }
          onChangeText(getBodyTextFromDom(e.currentTarget), orderedContentFromDom(e.currentTarget));
          if (pendingEnterAfterIme.current) {
            pendingEnterAfterIme.current = false;
            if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
              cancelAnimationFrame(pendingEnterRafRef.current);
              pendingEnterRafRef.current = null;
            }
            insertNewlineFromDom(e.currentTarget);
          }
        }}
        onBlur={() => { if (!composingRef.current) recolor(); }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && typeof onRemoveEmbedRef.current === 'function') {
            let node = e.target;
            while (node && node !== e.currentTarget) {
              if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-embed-index')) {
                const idx = Number(node.getAttribute('data-embed-index'));
                if (Number.isFinite(idx)) {
                  e.preventDefault();
                  onRemoveEmbedRef.current(idx);
                  return;
                }
              }
              node = node.parentNode;
            }
            const adjacentIdx = findEmbedIndexBeforeCaret(e.currentTarget);
            if (adjacentIdx != null) {
              e.preventDefault();
              onRemoveEmbedRef.current(adjacentIdx);
              return;
            }
          }
          if (handleEnter(e)) return;
          if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
            e.preventDefault();
            const el = e.currentTarget;
            const sel = getSelectionOffsets(el);
            const caret = sel ?? { start: getCaretCharOffset(el) ?? bodyText.length, end: getCaretCharOffset(el) ?? bodyText.length };
            const next = deleteCurrentLine({
              value: bodyText,
              selectionStart: caret.start,
              selectionEnd: caret.end,
            });
            paintNow(el, contentWithText(next.value));
            setCaretCharOffset(el, next.selectionStart);
            onChangeText(next.value);
            return;
          }
          if (e.altKey && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
            e.preventDefault();
            onAltY();
          }
        }}
      />
    </>
  );
}

export function WritePage({ user, editArticleId: editArticleIdProp, draftKey, onEditContextEnded }) {
  const urlArticleId = new URLSearchParams(window.location.search).get('id') || undefined;
  const editArticleId = editArticleIdProp === undefined ? urlArticleId : (editArticleIdProp || undefined);
  const ctrl = useWriteController(user, { editArticleId, draftKey });
  const [activeTab, setActiveTab] = useState('공통정보');
  useEffect(() => {
    if (editArticleId && ctrl.isDraft && ctrl.lifecycleStatus != null) onEditContextEnded?.();
  }, [editArticleId, ctrl.isDraft, ctrl.lifecycleStatus, onEditContextEnded]);
  const alertedRef = useRef(false);
  useEffect(() => {
    if (ctrl.lockError && !alertedRef.current) {
      alertedRef.current = true;
      window.alert('해당 기사는 다른 페이지/세션에서 편집 중입니다.');
    }
    if (!ctrl.lockError) {
      alertedRef.current = false;
    }
  }, [ctrl.lockError]);
  // Action buttons only apply to an RDS (in-progress) article (news.md 기사 작성 페이지 내 버튼).
  const isRds = ctrl.status === 'RDS';
  // DDH (데스크 보류) 기사: D/Z 권한에게 송고+KILL 표시, 보류 없음, R에게 아무것도 표시 안 함.
  const isDdh = ctrl.status === 'DDH';
  const lastCaretRef = useRef(null);
  const handleCaretChange = useCallback((off) => { lastCaretRef.current = off; }, []);
  const pendingEmbedCaretRef = useRef(null);
  const insertEmbedAtCaret = useCallback((descriptor) => {
    const caret = lastCaretRef.current;
    pendingEmbedCaretRef.current = { offset: caret == null ? undefined : caret };
    ctrl.embed(descriptor, caret == null ? undefined : caret);
  }, [ctrl]);

  return (
    <main className="yh-write-layout">
      {ctrl.lockError ? (
        <div role="alert" aria-live="assertive" className="yh-lock-banner">
          해당 기사는 다른 페이지/세션에서 편집 중입니다.
        </div>
      ) : null}

      <section data-testid="editor-region" className="yh-editor-region" aria-label="에디터">
        <BodyEditor
          content={ctrl.content}
          bodyText={ctrl.bodyText}
          onChangeText={ctrl.setBodyMarkup}
          onAltY={ctrl.appendEnd}
          onPasteEmbed={ctrl.embed}
          onCaretChange={handleCaretChange}
          onRemoveEmbed={ctrl.removeEmbed}
          pendingEmbedCaretRef={pendingEmbedCaretRef}
          readOnly={!!ctrl.lockError}
        />
      </section>

      <section data-testid="metadata-region" className="yh-meta-region" aria-label="메타데이터">
        <div className="yh-meta-actions">
          {(user.role === 'R' || user.role === 'D' || user.role === 'Z') && isRds ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary"
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold"
                onClick={() => { if (window.confirm('보류하시겠습니까?')) ctrl.hold(); }}>보류</button>
            </>
          ) : null}
          {(user.role === 'R' || user.role === 'Z') && isRds && !ctrl.isDraft ? (
            <button type="button" className="yh-btn yh-btn--kill"
              onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
          ) : null}
          {isDdh && (user.role === 'D' || user.role === 'Z') ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary"
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              <button type="button" className="yh-btn yh-btn--kill"
                onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
            </>
          ) : null}
        </div>

        {ctrl.actionError ? <div role="alert" className="yh-alert">{ctrl.actionError}</div> : null}

        {ctrl.readonlyMeta ? <ReadonlyMetaPanel meta={ctrl.readonlyMeta} /> : null}

        <div role="tablist" className="yh-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              className={`yh-tab${activeTab === t ? ' yh-tab--active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === '공통정보' ? (
          <CommonInfoPanel common={ctrl.common} updateCommon={ctrl.updateCommon} />
        ) : null}
        {activeTab === '이미지' ? <MediaPanel tabName="이미지" embedType="image" onEmbed={insertEmbedAtCaret} /> : null}
        {activeTab === '영상' ? <MediaPanel tabName="영상" embedType="video" onEmbed={insertEmbedAtCaret} /> : null}
        {activeTab === '글기사' ? <TextArticlePanel onEmbed={insertEmbedAtCaret} /> : null}
      </section>
    </main>
  );
}
