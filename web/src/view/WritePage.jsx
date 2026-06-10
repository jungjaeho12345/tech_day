// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류/KILL above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold/kill go through the controllers (DP-F3/DP-F5). A successful action resets the page.
// The action buttons are role+status gated (news.md 기사 작성 페이지 내 버튼): 송고/보류 for role R|D and
// KILL for role R, both only while the editing article's status is RDS.
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

// SPEC-NEWS-REVISE-007 REQ-VO-MAPPING: 8 ContentsVO fields displayed read-only in the metadata panel.
const READONLY_META_LABELS = {
  articleId: '기사아이디', modifier: '수정자', sender: '송고자',
  department: '부서', departmentCode: '부서코드', createdAt: '작성시간',
  editedAt: '편집시간', sentAt: '송고시간',
};
const READONLY_META_KEYS = [
  'articleId', 'modifier', 'sender', 'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt',
];
function ReadonlyMetaPanel({ meta }) {
  return (
    <div data-testid="readonly-meta" className="yh-readonly-meta">
      {READONLY_META_KEYS.map((key) => (
        <div key={key} className="yh-field-row">
          <span className="yh-field-label">{READONLY_META_LABELS[key]}</span>
          <span className="yh-field-value">{meta[key] || ''}</span>
        </div>
      ))}
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
    // SPEC-NEWS-REVISE-001 — 이미지 임베드는 캐플션(.yh-embed__caption, 사진 설명 텍스트)을 렌더링하지 않는다.
    // title 은 img alt 로만 남아 접근성을 유지한다. 이 buildEmbedInlineSpan 이 라이브 에디터 본문의 단일
    // 렌더 경로이며, 미사용 병행 컴포넌트 InlineEmbed.jsx 도 동일하게 캐플션을 제거해 일관성을 맞스다.
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
  // SPEC-NEWS-REVISE-002 IME 보강 — composingRef 는 onCompositionEnd 맨 첫에 동기적으로 false 가 되어
  // onInput 게이팅을 그대로 유지하지만, "방금 합성을 끝낸" 한 틱 동안에는 repaint useEffect 가 절대
  // replaceChildren 하지 않도록 별도 플래그를 둔다. 실제 Chrome 에서 한 음절의 compositionend 와 다음
  // 음절의 compositionstart 사이(=composingRef false 윈도)에 passive useEffect 가 끼어들어 살아있는 IME
  // 합성 노드를 파괴하는 race 를 흡수한다(jsdom 동기 테스트로는 재현 불가한 실브라우저 한정 윈도). 다음
  // 음절의 compositionStart 또는 unmount 가 이 플래그/예약을 취소한다.
  const justComposedRef = useRef(false);
  const justComposedRafRef = useRef(null);
  const onRemoveEmbedRef = useRef(onRemoveEmbed);
  onRemoveEmbedRef.current = onRemoveEmbed;
  const pendingEnterAfterIme = useRef(false);
  // SPEC-NEWS-REVISE 한글 IME 1-press Enter 보강 — 합성 중 Enter 를 compositionend 분기로 위임하지만,
  // Windows 한글 IME 에는 Enter keydown 이 isComposing/keyCode 229 를 보고하면서도 뒤따르는
  // compositionend 가 끊내 발생하지 않는 상태가 존재한다(이미 commit 된 음절 직후 등). 그 경우 첫 Enter 는
  // preventDefault 로 삼켜지고 pendingEnterAfterIme 만 true 로 남아 줄바꾸이 영영 삽입되지 않는다(사용자가
  // Enter 를 2~3 번 눐러야 하는 간헐 증상). 한 프레임 뒤 폴백을 예약해, compositionend 가 끝내 소비하지
  // 않으면(pendingEnterAfterIme 여전히 true) 직접 줄바꾸을 삽입한다. 예약 id 는 cancel 용으로 보관한다.
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
    // IME 보강(방어): 어뗤 paint 경로든 합성 진행 중에는 replaceChildren 으로 살아있는 IME 노드를
    // 파괴하지 않는다. 동기 테스트에서는 composingRef 가 항상 false 라 무영향(테스트 불변).
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

  // SPEC-NEWS-REVISE-001 — Korean IME 1-press Enter fix (stale-closure 회피). compositionEnd 시점에는
  // 직전 onChangeText(textContent) 호울이 비동기 state update라 `bodyText` 클로저가 아직 IME-commit
  // 이전 값이다. 클로저 대신 el.textContent를 source of truth로 사용해 splice 한다 — 방금 commit된
  // 한글 음절이 paintEditor에 의해 덮어쓰여 사라지는 문제(두 번째 Enter 필요)를 제거.
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

  // Intercept Enter / Shift+Enter on keydown and splice a model '\n' ourselves. We use keydown (one path,
  // not also beforeinput) because it fires reliably in the target browser AND is testable.
  // SPEC-NEWS-REVISE-001 D-7: Enter는 합성 여부와 무관하게 ALWAYS preventDefault한다. 합성 중 Enter일
  // 경우에도 브라우저 기본 <br>/<div> 삽입을 막아야 DOM 구조가 일관되며 (이전에는 preventDefault를 생략해
  // <br>이 들어가 두 번째 Enter가 필요했다). 합성 commit은 IME가 preventDefault와 무관하게 정주하고
  // compositionend가 fire되며, 그 안에서 pendingEnterAfterIme 분기가 '\n' 한 번을 끼워 넣는다.
  const handleEnter = useCallback((e) => {
    if (e.key !== 'Enter') return false;
    e.preventDefault();
    if (composingRef.current || e.isComposing || e.keyCode === 229) {
      pendingEnterAfterIme.current = true;
      // 폴백 예약(IME 보강) — compositionend 가 줄바꾸을 소비하지 않는 IME 상태를 대비해 한 프레임 뒤
      // pendingEnterAfterIme 가 여전히 true 면 직접 insertNewlineFromDom 으로 줄바꾸을 끼워 넣는다. 정상
      // 케이스에서는 compositionend 가 이 콜백보다 먼저 fire 되어 플래그를 false 로 내리므로 폴백은 아무
      // 것도 하지 않는다(중복 '\n' 방지). el 은 클로저로 캐포. 이미 예약된 폴백이 있으면 취소 후 재예약.
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
    // SPEC-NEWS-REVISE-002 IME 보강 — composingRef(합성 중)밐 아니라 justComposedRef(직전 compositionend
    // 한 틱)도 가드한다. compositionend → 다음 compositionstart 사이의 짧은 윈도에서 이 passive effect 가
    // 끼어들어 새로 시작된 합성 노드를 replaceChildren 으로 파괴하는 실브라우저 race 를 흡수한다. 동기
    // jsdom 테스트에서는 텍스트가 핸들러 내부 paintNow 로 이미 그려지므로 이 한 틱 지연은 관측되지 않는다.
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
    // IME 보강 — 언마운트 시 줄바꾸 폴백 예약도 취소해 언마운트된 컴포넌트에 늦게 삽입하는 stale 콜백을 막는다.
    if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingEnterRafRef.current);
      pendingEnterRafRef.current = null;
    }
  }, []);

  return (
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
        // SPEC-NEWS-REVISE-001 D-7: 합성 중에는 state를 갱신하지 않는다 — onChangeText가 호울되면
        // 부모가 re-render되고 useEffect의 repaint 가드(또는 paintEditor)가 IME 합성 노드를
        // 파괴해 입력 1글자가 지연된 듯 보이는 증상이 발생한다. 합성 결과는 compositionEnd에서
        // 한 번에 flush한다.
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
        // 다음 음절이 시작됨다 — 직전 compositionend 가 예약한 "just-composed" 클리어를 취소하고
        // 플래그를 내려, 이 합성 동안 repaint useEffect 가 정상 가드(composingRef)로만 동작하게 한다.
        justComposedRef.current = false;
        if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(justComposedRafRef.current);
          justComposedRafRef.current = null;
        }
        // IME 보강 — 다음 음절이 시작됐으므로 직전 Enter 폴백 예약을 취소한다. 그래야 정상적으로
        // 이어질 compositionend 가 줄바꾸을 처리할 기회를 갖고, 연속 타이핑 race 에서 폴백이 잘못
        // 끼어들지 않는다. (pendingEnterAfterIme 플래그 자체는 그대로 둔 compositionend 가 소비한다.)
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
          // 폴백 예약이 살아 있으면 취소한다 — 여기서 줄바꾸을 소비했으므로 폴백이 또 삽입하면 중복 '\n'.
          // (플래그를 이미 false 로 내렸으므로 폴백 콜백 가드도 막아주지만, 예약 자체를 정리해 둔다.)
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
        // SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D: Ctrl+D -> 쫠랿이 위치한 라인(또는
        // 선택에 일부라도 걸친 모든 라인)을 라인 단위 round-up 삭제 (D-2 결정 잠금). preventDefault로
        // Chrome 북마크 추가 기본 동작을 차단. 핸들러는 에디터 컨테이너의 onKeyDown 한정이므로
        // 에디터가 포커스를 받지 않은 상태에서는 호출되지 않는다 (AC-CTRL-D-4 스코프).
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
  );
}

export function WritePage({ user, editArticleId: editArticleIdProp, draftKey, onEditContextEnded }) {
  // news.md 데스크 미송고 편집: writer.do?id=<articleId> loads that article for editing.
  // Prop takes precedence; fall back to URL param for standalone page navigation.
  const editArticleId = editArticleIdProp !== undefined
    ? (editArticleIdProp || undefined)
    : (new URLSearchParams(window.location.search).get('id') || undefined);
  const ctrl = useWriteController(user, { editArticleId, draftKey, onEditContextEnded });
  const [activeTab, setActiveTab] = useState('공통정보');
  // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — show ALERT once on lock rejection (D2-1 = C: ALERT + inline
  // banner). The banner stays visible (aria-live="assertive") and the editor body is disabled below.
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
  const isDdh = ctrl.status === 'DDH';
  // SPEC-NEWS-REVISE-001 — 본문 커서 위치 임베드 (Phase C): 메타 패널의 "삽입" 버튼을 클릭하면
  // 포커스가 BodyEditor를 떠난 뒤지만, 마지막으로 알려진 쫠랿 offset을 ref로 보존해 인라인 삽입한다.
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
        {/* 송고 / 보류 / KILL action buttons at the top (news.md 기사 작성 페이지 내 버튼).
            Visibility is gated by role + the editing article's status:
            - 송고/보류: role R, D, or Z AND status RDS
            - KILL:    role R or Z      AND status RDS
            SPEC-NEWS-REVISE-001 / REQ-AUTH-Z-BUTTONS (D-1 잠금): Z권한도 R/D와 동일한 RDS gate를
            적용해 송고/보류/KILL을 노출한다. status가 RDS가 아니면 어느 권한도 노출하지 않는다. */}
        <div className="yh-meta-actions">
          {(user.role === 'R' || user.role === 'D' || user.role === 'Z') && isRds ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary"
                disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold"
                disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('보류하시겠습니까?')) ctrl.hold(); }}>보류</button>
            </>
          ) : null}
          {(user.role === 'R' || user.role === 'Z') && isRds ? (
            <button type="button" className="yh-btn yh-btn--kill"
              disabled={!!ctrl.lockError}
              onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
          ) : null}
          {isDdh && (user.role === 'D' || user.role === 'Z') ? (
            <button type="button" className="yh-btn yh-btn--primary"
              disabled={!!ctrl.lockError}
              onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
          ) : null}
          {isDdh && user.role === 'Z' ? (
            <button type="button" className="yh-btn yh-btn--kill"
              disabled={!!ctrl.lockError}
              onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
          ) : null}
        </div>

        {ctrl.lifecycleStatus ? (
          <div data-testid="lifecycle-status" className="yh-lifecycle-status">
            상태: {ctrl.lifecycleStatus}
          </div>
        ) : null}
        {ctrl.actionError ? <div role="alert" className="yh-alert">{ctrl.actionError}</div> : null}
        {ctrl.readonlyMeta ? <ReadonlyMetaPanel meta={ctrl.readonlyMeta} /> : null}

        {/* Tab strip */}
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
