// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류/KILL above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold/kill go through the controllers (DP-F3/DP-F5). A successful action resets the page.
// The action buttons are role+status gated (news.md 기사 작성 페이지 내 버튼): 송고/보류 for role R|D|Z and
// KILL for role R|Z, both only while the editing article's status is RDS. v0.6.0: KILL additionally
// requires a generated articleId (edit context) — an id-less draft (A-DRAFT) never shows KILL.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useModel } from '../app/context.js';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';
import { buildColorSegments } from './editorColoring.js';
import { getCaretCharOffset, getSelectionOffsets, setCaretCharOffset, setCaretAfterEmbed, setCaretToEditorStart, getBodyTextFromDom, findEmbedIndexBeforeCaret, readOrderedContentFromDom, embedTextOffset } from './editorCaret.js';
import { embedOrdinalAtInsertOffset, insertNewlineIntoContent, contentToText } from '../model/editorContent.js';
import { insertNewlineAt } from './editorNewline.js';
import { deleteCurrentLine, applyLineDeleteToContent, selectEmbedOnLine, lineRangeAt } from './editorShortcuts.js';
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
    // SPEC-NEWS-REVISE-001 — 이미지 임베드는 캡션(.yh-embed__caption, 사진 설명 텍스트)을 렌더링하지 않는다.
    // title 은 img alt 로만 남아 접근성을 유지한다. 이 buildEmbedInlineSpan 이 라이브 에디터 본문의 단일
    // 렌더 경로이며, 미사용 병행 컴포넌트 InlineEmbed.jsx 도 동일하게 캡션을 제거해 일관성을 맞춘다.
    appendDeleteButton(span);
    return span;
  }
  if (embed.type === 'video') {
    span.setAttribute('data-testid', 'embed-video');
    span.classList.add('yh-embed', 'yh-embed--video');
    // news.md 기사 에디터: 클립보드에서 붙여넣기한 이미지/유투브 크기는 에디터크기 기준 10%*10%.
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

// @MX:NOTE: [AUTO] Render the editor contentEditable from a structured content (text blocks + inline
// embeds). Inline embeds appear at their exact position between text blocks, satisfying news.md
// "본문 커서 위치에 임베딩". DOM textContent EXACTLY equals bodyText (embed spans contribute no text),
// so caret offsets and character counts remain byte-stable. Role-based coloring (제목/부제목/본문/(끝))
// is computed from the global bodyText so line semantics survive embeds that split text blocks.
//
// SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE: paintEditor accepts an optional `onRemoveEmbed(index)` so
// each embed renders an × affordance (D2-6 = C); pass `undefined` to keep the old read-only render.
function paintEditor(el, content, onRemoveEmbed) {
  const doc = el.ownerDocument;
  // Backwards-compatible: callers passing a plain string get the legacy text-only paint.
  const blocks = typeof content === 'string'
    ? [{ type: 'text', text: content }]
    : (content?.blocks ?? []);
  const bodyText = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const segments = buildColorSegments(bodyText);

  // Map each embed block to its text-character position (sum of preceding text-block lengths).
  // Also keep the embed's original order index for the data-embed-index attribute.
  const embedAtPos = []; // { pos, embed, index }
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
  let pos = 0; // running text-character position across segments
  let nextEmbedIdx = 0;

  const emitEmbedsAt = (currentPos) => {
    while (nextEmbedIdx < embedAtPos.length && embedAtPos[nextEmbedIdx].pos === currentPos) {
      const { embed, index } = embedAtPos[nextEmbedIdx];
      frag.appendChild(buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed));
      nextEmbedIdx += 1;
    }
  };

  // Flush embeds whose position lies at pos=0 before any segment.
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
    // Any embeds whose position is strictly inside this segment split it.
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
  // Trailing embeds beyond end of text (e.g. legacy append at end with empty body).
  while (nextEmbedIdx < embedAtPos.length) {
    const { embed, index } = embedAtPos[nextEmbedIdx];
    frag.appendChild(buildEmbedInlineSpan(doc, embed, index, onRemoveEmbed));
    nextEmbedIdx += 1;
  }
  // Trailing-newline render padding (v0.3.0 Enter-2회 증상 보정): in a pre-wrap contentEditable a
  // document-final '\n' does NOT create a visible line box, so Enter at the end of the body LOOKED
  // like a no-op until pressed twice. A trailing <br> renders that last empty line; <br> contributes
  // nothing to textContent, so bodyText/caret math is unaffected.
  if (bodyText.endsWith('\n')) {
    frag.appendChild(doc.createElement('br'));
  }
  // SPEC-NEWS-REVISE-001 (첫 줄 점프 fix): when the editor ends with a contenteditable=false embed span,
  // Chrome has NO editable caret position after it — a selection placed there is silently relocated and the
  // next typed character lands at document start (the first-line-jump regression). A trailing <br> gives
  // contentEditable a real final editable line, so a caret anchored just before it is a valid, typeable
  // position right behind the embed. It contributes 0 characters to textContent, so bodyText and all
  // char-offset math (getBodyTextFromDom / setCaretCharOffset, which only walk text nodes) stay byte-stable.
  if (frag.lastChild && frag.lastChild.nodeType === 1
      && frag.lastChild.hasAttribute?.('data-embed-index')) {
    const filler = doc.createElement('br');
    filler.setAttribute('data-embed-trailing-br', '');
    frag.appendChild(filler);
  }
  el.replaceChildren(frag);
}

// @MX:NOTE: [AUTO] contentEditable body editor — typeable plain text (editor-body) plus a rendered list of
// ordered inline embeds (REQ-EDIT-ADP/EMBED). The contentEditable text is uncontrolled to preserve the caret;
// it is only written from props when the markup is loaded externally (length change without focus).
// news.md 기사 에디터: lines are colored by role and Alt+Y appends a gold "(끝)". Korean IME safety: the editor
// is NEVER recolored on keystroke/during composition (that breaks Hangul). Recoloring happens only on
// compositionend, blur, and programmatic body-text changes — the caret is preserved by character offset.
// Enter/Shift+Enter are intercepted on keydown to splice a model '\n' at the caret (the model is authoritative
// for newlines), so the browser never inserts block markup that would desync the repaint and jump the caret.
function BodyEditor({ content, bodyText, onChangeText, onAltY, onPasteEmbed, onCaretChange, onRemoveEmbed, pendingEmbedCaretRef, readOnly = false }) {
  const ref = useRef(null);
  // SPEC-NEWS-REVISE-001 — embed model count seen at the last repaint, so the repaint effect can detect
  // an embed INSERTION (count increase) and place the caret right after the new embed span instead of at
  // the shared char-offset (which can land the caret BEFORE the 0-char embed). pendingEmbedCaretRef (from
  // the parent) carries the inserted embed's caret offset; handlePaste sets it for the paste path.
  const prevEmbedCountRef = useRef((content?.blocks ?? []).filter((b) => b.type === 'embed').length);
  const composingRef = useRef(false);
  // SPEC-NEWS-REVISE-002 IME 보강 — composingRef 는 onCompositionEnd 맨 처음에 동기적으로 false 가 되어
  // onInput 게이팅을 그대로 유지하지만, "방금 합성을 끝낸" 한 틱 동안에는 repaint useEffect 가 절대
  // replaceChildren 하지 않도록 별도 플래그를 둔다. 실제 Chrome 에서 한 음절의 compositionend 와 다음
  // 음절의 compositionstart 사이(=composingRef false 윈도)에 passive useEffect 가 끼어들어 살아있는 IME
  // 합성 노드를 파괴하는 race 를 흡수한다(jsdom 동기 테스트로는 재현 불가한 실브라우저 한정 윈도). 다음
  // 음절의 compositionStart 또는 unmount 가 이 플래그/예약을 취소한다.
  const justComposedRef = useRef(false);
  const justComposedRafRef = useRef(null);
  // Stable ref to onRemoveEmbed so paintWithCaret/recolor/insertNewline never close over a stale handler.
  const onRemoveEmbedRef = useRef(onRemoveEmbed);
  onRemoveEmbedRef.current = onRemoveEmbed;
  // Korean IME 1-press Enter fix: when Enter commits an active composition, the IME consumes the
  // keystroke and our handleEnter must NOT preventDefault (else the syllable is lost). We record the
  // user's intent here and flush a single newline insertion on compositionend so a single Enter both
  // commits the syllable AND breaks the line, instead of requiring a second Enter.
  const pendingEnterAfterIme = useRef(false);
  // SPEC-NEWS-REVISE 한글 IME 1-press Enter 보강 — 합성 중 Enter 를 compositionend 분기로 위임하지만,
  // Windows 한글 IME 에는 Enter keydown 이 isComposing/keyCode 229 를 보고하면서도 뒤따르는
  // compositionend 가 끝내 발생하지 않는 상태가 존재한다(이미 commit 된 음절 직후 등). 그 경우 첫 Enter 는
  // preventDefault 로 삼켜지고 pendingEnterAfterIme 만 true 로 남아 줄바꿈이 영영 삽입되지 않는다(사용자가
  // Enter 를 2~3 번 눌러야 하는 간헐 증상). 한 프레임 뒤 폴백을 예약해, compositionend 가 끝내 소비하지
  // 않으면(pendingEnterAfterIme 여전히 true) 직접 줄바꿈을 삽입한다. 예약 id 는 cancel 용으로 보관한다.
  const pendingEnterRafRef = useRef(null);
  // Stable ref to current content so imperative paintEditor calls (insertNewline, Ctrl+D, recolor)
  // can preserve inline embeds when only the text changes. Updated on every render.
  const contentRef = useRef(content);
  contentRef.current = content;
  // SPEC-NEWS-REVISE — 임베드 1개 삭제(Backspace/Ctrl+D) 직후 캐럿 복원 디스크립터. 재페인트(임베드 count
  // 감소) 후 이 앵커로 캐럿을 DOM 위치에 둔다. 문자 오프셋만으로는 임베드 전용/연속 임베드/빈 줄에서 삭제
  // 지점을 못 짚어 "텍스트가 있는 곳"으로 캐럿이 튀므로, DOM 앵커(직전 임베드 뒤 / 에디터 시작)를 우선한다.
  // 삽입의 pendingEmbedCaretRef 와 대칭. × 버튼 삭제는 mousedown=preventDefault 라 이 경로를 타지 않는다.
  const pendingDeleteCaretRef = useRef(null);

  // 임베드(ordinal N, 전체 임베드 기준 0-based)를 지우기 직전, 삭제 후 캐럿을 어디에 둘지 디스크립터로 캡처한다.
  //  - N > 0 → 남아있는 직전 임베드(ordinal N-1) 뒤로 (DOM 앵커, 텍스트 없어도 안전).
  //  - N === 0 이고 텍스트 앵커가 있으면 → 그 본문 문자 오프셋(charOffset) 폴백.
  //  - 그 외(첫 임베드 + 텍스트 앵커 없음) → 에디터 시작.
  const captureDeleteAnchor = useCallback((el, ordinal) => {
    if (ordinal > 0) return { kind: 'afterEmbed', ordinal: ordinal - 1 };
    const offset = embedTextOffset(el, ordinal);
    if (offset != null && offset > 0) return { kind: 'charOffset', offset };
    return { kind: 'start' };
  }, []);

  // Build a content snapshot with the given replacement bodyText, preserving existing embed blocks.
  // The new bodyText becomes a single text block; trailing embeds (or originally interleaved embeds)
  // are appended in their original relative order. This is a presentation-only helper used by the
  // imperative paint paths; the controller (setBodyMarkup) will normalize the model on the next tick.
  const contentWithText = useCallback((text) => {
    const embedBlocks = (contentRef.current?.blocks ?? []).filter((b) => b.type === 'embed');
    const blocks = text === '' ? [...embedBlocks] : [{ type: 'text', text }, ...embedBlocks];
    return { blocks };
  }, []);

  // Bug 1 fix — read the editor's live DOM into an ORDERED content document so the true interleave of
  // text and inline embeds is preserved through a repaint. Embed descriptors are recovered from the
  // model (contentRef) by their data-embed-index ordinal; a fallback minimal descriptor is used if an
  // ordinal is missing. Unlike contentWithText (which placed all text before all embeds), this keeps a
  // trailing embed ABOVE text typed after it — so pressing Enter never hoists the embed below the text.
  const orderedContentFromDom = useCallback((el) => {
    const embedBlocks = (contentRef.current?.blocks ?? []).filter((b) => b.type === 'embed');
    return readOrderedContentFromDom(el, (ordinal) => {
      const block = embedBlocks[ordinal];
      return block ? { ...block.embed } : null;
    });
  }, []);

  // news.md 기사 에디터: 클립보드에서 복사하여 붙여넣기한 이미지/유투브를 본문에 임베딩한다. (10%x10% size
  // comes from the existing .yh-embed CSS.) An image item -> read as a data URL and embed as an inline image;
  // a YouTube URL in the pasted text -> embed as an inline video. Otherwise let normal plain-text paste proceed
  // (do NOT preventDefault). Resilient to jsdom (clipboardData/items may be missing).
  const handlePaste = useCallback((e) => {
    const cd = e.clipboardData;
    if (!cd) return; // no clipboard data -> normal paste
    const imageFile = findClipboardImageFile(cd.items);
    if (imageFile) {
      e.preventDefault();
      readFileAsDataUrl(imageFile)
        .then((dataUrl) => {
          // SPEC-NEWS-REVISE-001 — paste appends at body end (offset undefined): mark a pending insert so
          // the repaint anchors the caret right after the new (trailing) embed span.
          if (pendingEmbedCaretRef) pendingEmbedCaretRef.current = { offset: undefined };
          onPasteEmbed({
            type: 'image', source: 'clipboard', title: '붙여넣은 이미지',
            url: dataUrl, thumbnailUrl: dataUrl,
          });
        })
        .catch(() => { /* read failed -> nothing to embed */ });
      return;
    }
    const text = cd.getData ? cd.getData('text') : '';
    if (isYouTubeUrl(text)) {
      e.preventDefault();
      if (pendingEmbedCaretRef) pendingEmbedCaretRef.current = { offset: undefined };
      onPasteEmbed({ type: 'video', source: 'clipboard', title: '붙여넣은 영상', url: text.trim() });
      return;
    }
    // Plain text (or anything else): do not preventDefault — let the browser paste the text normally.
  }, [onPasteEmbed]);

  // Paint a content snapshot (or string) into the editor while preserving the caret by character
  // offset (caret restored only when the editor is focused). Pure presentation — DOM textContent
  // ends up exactly equal to the body text (embed spans contribute no text).
  // SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — single source of truth for paint calls so EVERY repaint
  // (initial mount, Enter, Ctrl+D, IME compositionEnd, paintWithCaret) consistently carries the latest
  // onRemoveEmbed callback. Using a ref means React re-renders never produce a stale callback closure.
  const paintNow = useCallback((el, contentOrText) => {
    paintEditor(el, contentOrText, onRemoveEmbedRef.current);
  }, []);

  const paintWithCaret = useCallback((contentOrText) => {
    const el = ref.current;
    if (!el) return;
    // IME 보강(방어): 어떤 paint 경로든 합성 진행 중에는 replaceChildren 으로 살아있는 IME 노드를
    // 파괴하지 않는다. 동기 테스트에서는 composingRef 가 항상 false 라 무영향(테스트 불변).
    if (composingRef.current) return;
    const focused = el.ownerDocument.activeElement === el;
    const caret = focused ? getCaretCharOffset(el) : null;
    paintNow(el, contentOrText);
    if (caret != null) setCaretCharOffset(el, caret);
  }, [paintNow]);

  // Recolor the editor's CURRENT contents in place (compositionend/blur). Caret-preserving.
  // Use the latest content (with existing embeds) reskinned with the live DOM text so inline embeds
  // are preserved across recolor.
  const recolor = useCallback(() => {
    const el = ref.current;
    if (el) paintWithCaret(contentWithText(getBodyTextFromDom(el)));
  }, [paintWithCaret, contentWithText]);

  // Make the MODEL authoritative for newlines (caret-jump bug fix). The browser's default Enter in a
  // contentEditable inserts block markup (<div>/<br>) that does NOT match our '\n'-based colored model;
  // the structural mismatch makes the sync repaint restore the caret to offset 0 (the first/제목 line).
  // Instead we intercept Enter here, splice a literal '\n' into the body text at the caret ourselves, then
  // paint + place the caret + push the model — so the browser never inserts block markup. Shared by Enter
  // (insertParagraph) and Shift+Enter (insertLineBreak); both produce a single '\n' in this plain model.
  const insertNewline = useCallback((el) => {
    // Source of truth is the colored model's `bodyText` prop, NOT el.textContent, so the splice stays
    // consistent with what the recolor paints (null offset -> end of text).
    const offset = getCaretCharOffset(el);
    const next = insertNewlineAt(bodyText, offset);
    const caret = (offset == null ? bodyText.length : Math.min(offset, bodyText.length)) + 1;
    // Bug 1 fix — splice the newline into the DOM-ORDERED content so a trailing embed stays ABOVE the
    // text typed after it (the old contentWithText put all text before all embeds, hoisting the image
    // below the typed line). insertNewlineIntoContent keeps every embed at its interleaved position.
    const nextContent = insertNewlineIntoContent(orderedContentFromDom(el), offset);
    paintNow(el, nextContent);
    setCaretCharOffset(el, caret);
    // Push the ORDERED content (2nd arg) so the model/markup keeps the embed above the typed line.
    onChangeText(next, nextContent);
  }, [bodyText, onChangeText, orderedContentFromDom, paintNow]);

  // SPEC-NEWS-REVISE-001 — Korean IME 1-press Enter fix (stale-closure 회피). compositionEnd 시점에는
  // 직전 onChangeText(textContent) 호출이 비동기 state update라 `bodyText` 클로저가 아직 IME-commit
  // 이전 값이다. 클로저 대신 el.textContent를 source of truth로 사용해 splice 한다 — 방금 commit된
  // 한글 음절이 paintEditor에 의해 덮어쓰여 사라지는 문제(두 번째 Enter 필요)를 제거.
  const insertNewlineFromDom = useCallback((el) => {
    const text = getBodyTextFromDom(el);
    const offset = getCaretCharOffset(el);
    const next = insertNewlineAt(text, offset);
    const caret = (offset == null ? text.length : Math.min(offset, text.length)) + 1;
    // Bug 1 fix (same ordering preservation as insertNewline, for the IME-commit Enter path).
    const nextContent = insertNewlineIntoContent(orderedContentFromDom(el), offset);
    paintNow(el, nextContent);
    setCaretCharOffset(el, caret);
    onChangeText(next, nextContent);
  }, [onChangeText, orderedContentFromDom, paintNow]);

  // Intercept Enter / Shift+Enter on keydown and splice a model '\n' ourselves. We use keydown (one path,
  // not also beforeinput) because it fires reliably in the target browser AND is testable.
  // SPEC-NEWS-REVISE-001 D-7: Enter는 합성 여부와 무관하게 ALWAYS preventDefault한다. 합성 중 Enter일
  // 경우에도 브라우저 기본 <br>/<div> 삽입을 막아야 DOM 구조가 일관되며 (이전엔 preventDefault를 생략해
  // <br>이 들어가 두 번째 Enter가 필요했다). 합성 commit은 IME가 preventDefault와 무관하게 처리하고
  // compositionend가 fire되며, 그 안에서 pendingEnterAfterIme 분기가 '\n' 한 번을 끼워 넣는다.
  const handleEnter = useCallback((e) => {
    if (e.key !== 'Enter') return false;
    e.preventDefault();
    if (composingRef.current || e.isComposing || e.keyCode === 229) {
      pendingEnterAfterIme.current = true;
      // 폴백 예약(IME 보강) — compositionend 가 줄바꿈을 소비하지 않는 IME 상태를 대비해 한 프레임 뒤
      // pendingEnterAfterIme 가 여전히 true 면 직접 insertNewlineFromDom 으로 줄바꿈을 끼워 넣는다. 정상
      // 케이스에서는 compositionend 가 이 콜백보다 먼저 fire 되어 플래그를 false 로 내리므로 폴백은 아무
      // 것도 하지 않는다(중복 '\n' 방지). el 은 클로저로 캡처. 이미 예약된 폴백이 있으면 취소 후 재예약.
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
        // rAF 미지원 환경(구형 jsdom 등) — justComposed 정리와 동일한 마이크로태스크 폴백 패턴.
        Promise.resolve().then(runFallback);
      }
      return true;
    }
    insertNewline(e.currentTarget);
    return true;
  }, [insertNewline, insertNewlineFromDom]);

  // Sync the body text from props into the (uncontrolled) contentEditable. This fires for:
  //   - initial mount (paint empty/loaded text),
  //   - programmatic changes: edit-load (?id=), embed insert, reset, and Alt+Y "(끝)" append.
  // It deliberately repaints (with coloring) ONLY when el.textContent !== bodyText, i.e. when the DOM is
  // out of sync with the model — which is true for programmatic changes but NOT for in-progress typing
  // (where onInput already pushed the same text to the model). This is the IME-safety guarantee: ordinary
  // keystrokes/composition never trigger a repaint here; coloring during typing only happens on
  // compositionend/blur. The caret (when focused, e.g. Alt+Y) is preserved by paintWithCaret.
  // SPEC-NEWS-REVISE-001 D-7: 합성(composition) 중에는 절대 repaint하지 않는다 — replaceChildren이
  // IME 내부 상태를 파괴해 "1글자 지연" 증상을 유발한다.
  useEffect(() => {
    // SPEC-NEWS-REVISE-002 IME 보강 — composingRef(합성 중)뿐 아니라 justComposedRef(직전 compositionend
    // 한 틱)도 가드한다. compositionend → 다음 compositionstart 사이의 짧은 윈도에서 이 passive effect 가
    // 끼어들어 새로 시작된 합성 노드를 replaceChildren 으로 파괴하는 실브라우저 race 를 흡수한다. 동기
    // jsdom 테스트에서는 텍스트가 핸들러 내부 paintNow 로 이미 그려지므로 이 한 틱 지연은 관측되지 않는다.
    if (composingRef.current || justComposedRef.current) return;
    const el = ref.current;
    if (!el) return;
    // Repaint when DOM is out of sync with the model text OR when content (embed blocks) changes.
    // Embeds contribute no text so we cannot rely on textContent alone; check embed count too.
    const embedDomCount = el.querySelectorAll('[data-embed-index]').length;
    const embedModelCount = (content?.blocks ?? []).filter((b) => b.type === 'embed').length;
    if (getBodyTextFromDom(el) !== bodyText || embedDomCount !== embedModelCount) {
      // SPEC-NEWS-REVISE-001 — detect an embed INSERTION (count increased) with a pending insert marker
      // (set by the button path in the parent or the paste path in handlePaste). After painting, anchor
      // the caret right after the inserted embed span so the next keystroke lands behind the 0-char embed,
      // not in front of it. Non-embed repaints (Alt+Y, edit-load, reset, Ctrl+D) keep the char-offset path.
      const inserted = embedModelCount > prevEmbedCountRef.current
        && pendingEmbedCaretRef?.current != null;
      if (inserted) {
        const { offset } = pendingEmbedCaretRef.current;
        pendingEmbedCaretRef.current = null;
        const ordinal = embedOrdinalAtInsertOffset(content, offset);
        paintNow(el, content);
        // Only steer the caret when the editor is focused; otherwise leave selection untouched (the
        // button path blurs the editor, but focusing+placing the caret restores the expected typing point).
        if (ordinal != null) {
          el.focus?.();
          setCaretAfterEmbed(el, ordinal);
        }
      } else if (pendingDeleteCaretRef.current != null
        && embedModelCount < prevEmbedCountRef.current) {
        // SPEC-NEWS-REVISE — 임베드 1개 삭제(Backspace/Ctrl+D) 직후 재페인트. 캐럿을 DOM 위치로 복원한다.
        // 임베드는 0글자라 텍스트 없는 레이아웃(임베드 전용/연속 임베드/빈 줄)에서는 문자 오프셋이 삭제
        // 지점을 못 짚어 "텍스트가 있는 곳"으로 캐럿이 튀던 실브라우저 회귀를 DOM 앵커로 차단한다. 앵커
        // 디스크립터: { kind:'afterEmbed', ordinal }(남은 직전 임베드 뒤) / { kind:'start' }(에디터 시작) /
        // { kind:'charOffset', offset }(텍스트 앵커 폴백).
        const anchor = pendingDeleteCaretRef.current;
        pendingDeleteCaretRef.current = null;
        paintNow(el, content);
        if (el.ownerDocument.activeElement === el) {
          if (anchor.kind === 'afterEmbed') setCaretAfterEmbed(el, anchor.ordinal);
          else if (anchor.kind === 'charOffset') setCaretCharOffset(el, anchor.offset);
          else setCaretToEditorStart(el);
        }
      } else {
        pendingDeleteCaretRef.current = null;
        paintWithCaret(content);
      }
    }
    prevEmbedCountRef.current = embedModelCount;
  }, [content, bodyText, paintWithCaret, paintNow, pendingEmbedCaretRef]);

  // Initial mount: paint whatever the model currently holds so loaded/colored text shows immediately.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent === '' && (bodyText !== '' || (content?.blocks ?? []).length > 0)) {
      paintNow(el, content);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IME 보강 — unmount 시 예약된 just-composed 클리어 rAF 를 취소해 언마운트된 컴포넌트의 ref 에
  // 늦게 기록하는 stale 콜백을 막는다 (진단 risk (a) 완화).
  useEffect(() => () => {
    if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(justComposedRafRef.current);
      justComposedRafRef.current = null;
    }
    // IME 보강 — 언마운트 시 줄바꿈 폴백 예약도 취소해 언마운트된 컴포넌트에 늦게 삽입하는 stale 콜백을 막는다.
    if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingEnterRafRef.current);
      pendingEnterRafRef.current = null;
    }
  }, []);

  return (
    <>
      {/* news.md v0.3.0: 에디터 본문 영역 위에 '본문' 라벨 텍스트는 표시하지 않는다 (aria-label 유지). */}
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
          // SPEC-NEWS-REVISE-001 D-7: 합성 중에는 state를 갱신하지 않는다 — onChangeText가 호출되면
          // 부모가 re-render되고 useEffect의 repaint 가드(또는 paintEditor)가 IME 합성 노드를
          // 파괴해 입력 1글자가 지연된 듯 보이는 증상이 발생한다. 합성 결과는 compositionEnd에서
          // 한 번에 flush한다.
          if (composingRef.current) return;
          // Bug 1 fix — push the DOM-ORDERED content so text typed AFTER a trailing embed keeps the
          // embed above it in the model/markup (not just visually). Flat text alone reordered them.
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
          // 다음 음절이 시작됐다 — 직전 compositionend 가 예약한 "just-composed" 클리어를 취소하고
          // 플래그를 내려, 이 합성 동안 repaint useEffect 가 정상 가드(composingRef)로만 동작하게 한다.
          justComposedRef.current = false;
          if (justComposedRafRef.current != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(justComposedRafRef.current);
            justComposedRafRef.current = null;
          }
          // IME 보강 — 다음 음절이 시작됐으므로 직전 Enter 폴백 예약을 취소한다. 그래야 정상적으로
          // 이어질 compositionend 가 줄바꿈을 처리할 기회를 갖고, 연속 타이핑 race 에서 폴백이 잘못
          // 끼어들지 않는다. (pendingEnterAfterIme 플래그 자체는 그대로 둬 compositionend 가 소비한다.)
          if (pendingEnterRafRef.current != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(pendingEnterRafRef.current);
            pendingEnterRafRef.current = null;
          }
        }}
        onCompositionEnd={(e) => {
          // Hangul composition finished: flush the text to state. SPEC-NEWS-REVISE-001 D-7:
          // 절대 여기서 recolor()를 호출하지 않는다. 연속 한글 타이핑 시 한 음절의 compositionEnd
          // 직후 다음 음절의 compositionStart가 동기적으로 fire되는데, 그 사이의 paintEditor는
          // 새로 시작된 IME 합성을 파괴해 "1글자 지연" 증상을 만든다. 색칠은 onBlur, Enter(insertNewline),
          // 기타 모델-주도 변경 시점에만 수행한다.
          composingRef.current = false;
          // IME 보강 — composingRef 는 즉시 false 로 내려 onInput 게이팅을 종전대로 유지하되,
          // "방금 합성을 끝냈다" 플래그를 한 틱(다음 프레임) 동안 켜 둔다. 그 사이에 다음 음절의
          // compositionStart 가 오면 위에서 이 예약을 취소한다(연속 타이핑 = race 흡수). 타이핑이 실제로
          // 멈추면 rAF 가 한 번 fire 되어 플래그를 내린다. cancelAnimationFrame 으로 중복 예약을 방지.
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
            // rAF 미지원 환경(구형 jsdom 등) — 마이크로태스크로 폴백.
            Promise.resolve().then(() => { justComposedRef.current = false; });
          }
          // Bug 1 fix — preserve text/embed interleave on IME commit too (ordered DOM snapshot).
          onChangeText(getBodyTextFromDom(e.currentTarget), orderedContentFromDom(e.currentTarget));
          // If the composition was committed by Enter, also break the line here so the user does not
          // need to press Enter a second time (Korean IME 1-press Enter fix). insertNewlineFromDom의
          // paintEditor는 합성이 막 끝난(=새 합성이 아직 시작되지 않은) 안전한 순간에만 수행된다.
          if (pendingEnterAfterIme.current) {
            pendingEnterAfterIme.current = false;
            // 폴백 예약이 살아 있으면 취소한다 — 여기서 줄바꿈을 소비했으므로 폴백이 또 삽입하면 중복 '\n'.
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
          // SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE (D2-6 = C) — Backspace on a focused embed node
          // removes that embed (AC-EMB-DEL-1). The target may be the embed span itself or any of its
          // children; walk up to the nearest [data-embed-index] ancestor.
          if (e.key === 'Backspace' && typeof onRemoveEmbedRef.current === 'function') {
            let node = e.target;
            while (node && node !== e.currentTarget) {
              if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-embed-index')) {
                const idx = Number(node.getAttribute('data-embed-index'));
                if (Number.isFinite(idx)) {
                  e.preventDefault();
                  // 삭제 후 캐럿을 DOM 위치(직전 임베드 뒤 / 에디터 시작)에 복원할 앵커를 캡처한다.
                  pendingDeleteCaretRef.current = captureDeleteAnchor(e.currentTarget, idx);
                  onRemoveEmbedRef.current(idx);
                  return;
                }
              }
              node = node.parentNode;
            }
            // SPEC-NEWS-REVISE-003 — caret-adjacent Backspace: when the collapsed caret sits
            // immediately AFTER an inline embed (no intervening text character), delete exactly that
            // one embed (preventDefault + existing removal path). Delete key is out of scope; the
            // inside-embed Backspace above and the × button are untouched.
            const adjacentIdx = findEmbedIndexBeforeCaret(e.currentTarget);
            if (adjacentIdx != null) {
              e.preventDefault();
              // 같은 이유로 삭제 후 캐럿 앵커를 캡처해 둔다(DOM 위치 복원).
              pendingDeleteCaretRef.current = captureDeleteAnchor(e.currentTarget, adjacentIdx);
              onRemoveEmbedRef.current(adjacentIdx);
              return;
            }
            node = node.parentNode;
          }
          // Enter / Shift+Enter -> insert a model '\n' (caret-jump fix). Handled first; if it consumed the
          // key, do not fall through to Alt+Y. handleEnter returns false for non-Enter / IME-commit Enter.
          if (handleEnter(e)) return;
          // SPEC-NEWS-REVISE / REQ-EDITOR-EMBED-AND-CTRL-D: Ctrl+D 의미.
          //  (1) 현재 캐럿 줄에 인라인 임베드가 하나라도 있으면 → 그 줄의 임베드를 "한 개씩" 제거한다
          //      (사용자 요구: "ctrl+d 누르면 글기사/이미지/영상 한개씩 지워주고"). 텍스트는 건드리지 않고,
          //      누를 때마다 다음 임베드가 하나씩 사라진다. 임베드는 0글자라 연속 임베드가 같은 줄에 몰리는데,
          //      라인 삭제로 한꺼번에 지워지던 실브라우저 회귀를 이 분기가 차단한다.
          //  (2) 현재 줄에 임베드가 없으면 → 기존 라인 단위 round-up 삭제(텍스트 줄 의미 불변).
          // preventDefault 로 Chrome 북마크 추가 기본 동작을 차단. 에디터 컨테이너 onKeyDown 한정(AC-CTRL-D-4).
          if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
            e.preventDefault();
            const el = e.currentTarget;
            const sel = getSelectionOffsets(el);
            const caret = sel ?? { start: getCaretCharOffset(el) ?? bodyText.length, end: getCaretCharOffset(el) ?? bodyText.length };
            // (1) 현재 줄에 임베드가 있으면 한 개만 제거 (캐럿 at/before 우선). DOM-ORDERED content 기준.
            const { lineStart, lineEnd } = lineRangeAt(bodyText, caret.start);
            const ordered = orderedContentFromDom(el);
            const pick = selectEmbedOnLine(ordered, lineStart, lineEnd, caret.start);
            if (pick) {
              // 삭제 후 캐럿 앵커를 캡처(직전 임베드 뒤 / 에디터 시작)하고, 컨트롤러로 그 한 임베드만 제거한다.
              pendingDeleteCaretRef.current = captureDeleteAnchor(el, pick.ordinal);
              if (typeof onRemoveEmbedRef.current === 'function') onRemoveEmbedRef.current(pick.ordinal);
              return;
            }
            // (2) 임베드 없는 줄 → 기존 라인 삭제(텍스트 전용 줄 의미 보존, REQ-EDITOR-EMBED-AND-CTRL-D).
            const next = deleteCurrentLine({
              value: bodyText,
              selectionStart: caret.start,
              selectionEnd: caret.end,
            });
            const nextContent = applyLineDeleteToContent(ordered, next);
            paintNow(el, nextContent);
            setCaretCharOffset(el, next.selectionStart);
            onChangeText(contentToText(nextContent), nextContent);
            return;
          }
          // Alt+Y: append "(끝)" (골드색) to the end of the body. preventDefault so no 'y' is typed.
          if (e.altKey && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
            e.preventDefault();
            onAltY();
          }
        }}
      />
    </>
  );
}

export function WritePage({ user, editArticleId: editArticleIdProp, draftKey, onEditContextEnded, onForceClosed }) {
  // news.md 데스크 미송고 편집: writer.do?id=<articleId> loads that article for editing.
  // 멀티탭 — 워크스페이스(WriteWorkspace)는 탭 모델의 editArticleId 를 prop 으로 명시한다 (null = 새 기사
  // 탭; URL 의 ?id= 는 활성 탭만 반영하므로 비활성 탭이 읽으면 안 된다). prop 이 주어지지 않은 단독
  // 사용(기존 단일 페이지/테스트)은 종전대로 URL 에서 한 번 읽는다 (the page remounts on navigation).
  const urlArticleId = new URLSearchParams(window.location.search).get('id') || undefined;
  const editArticleId = editArticleIdProp === undefined ? urlArticleId : (editArticleIdProp || undefined);
  const model = useModel();
  const ctrl = useWriteController(user, { editArticleId, draftKey });
  const [activeTab, setActiveTab] = useState('공통정보');
  // 멀티탭 — 편집 컨텍스트 탭에서 송고/보류/KILL 이 성공하면 컨트롤러가 빈 초안으로 리셋된다
  // (isDraft=true + lifecycleStatus 확정). 워크스페이스에 알려 탭을 '새 기사' 탭으로 전환시킨다
  // (라벨 갱신 + editArticleId 해제 → 잠금 해제 + 초안 보존 활성화). lifecycleStatus 가드가 있어
  // 편집 row 로드 전의 일시적 isDraft(A-DRAFT 초기값)에는 절대 발화하지 않는다.
  useEffect(() => {
    if (editArticleId && ctrl.isDraft && ctrl.lifecycleStatus != null) onEditContextEnded?.();
  }, [editArticleId, ctrl.isDraft, ctrl.lifecycleStatus, onEditContextEnded]);
  // SPEC-NEWS-REVISE-014 REQ-EDITOR-AUTOCLOSE — 편집 잠금을 보유한(editArticleId 있는) 동안에만 강제 해제
  // SSE 를 구독한다(ViewPage 와 동일한 model.subscribe 컨트랙트 재사용 — 새 채널/폴링/타이머 없음). 자기
  // 기사에 대한 { type:'unlock', articleId:X, forced:true } 프레임이 오면 alert 1회 후 탭을 닫는다(onForceClosed
  // → WriteWorkspace.closeTab → 저장 안 한 변경분 폐기). 초안 탭(editArticleId=null)은 구독하지 않고
  // (AC-CLOSE-3), 다른 articleId(AC-CLOSE-2)·forced 아닌 자기 해제(AC-CLOSE-4)는 무시하며, closed 플래그로
  // 중복 프레임에도 alert 는 1회만(AC-CLOSE-5). unmount 시 unsubscribe 로 정리한다(NFR 6.2).
  useEffect(() => {
    if (!editArticleId) return undefined;
    let closed = false;
    const sub = model.subscribe(undefined, (payload) => {
      if (closed) return;
      if (payload?.type !== 'unlock' || !payload.forced || payload.articleId !== editArticleId) return;
      closed = true;
      window.alert('Lock이 해제되어 편집을 종료합니다');
      onForceClosed?.();
    });
    return () => sub.unsubscribe();
  }, [editArticleId, model, onForceClosed]);
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
  // SPEC-NEWS-REVISE-009 lineage-Y — DDH(데스크 보류) 기사: role D|Z 에게 송고/KILL 만 노출(보류 없음),
  // role R 은 아무 버튼도 없음. RDS 분기와 배타적으로 동작한다 (status 가 정확히 하나여서 겹치지 않음).
  const isDdh = ctrl.status === 'DDH';
  // SPEC-NEWS-REVISE-011 — DPS(배부 대상) 기사를 고침/포털고침으로 연 작성 페이지: R/D/Z 에게 송고/보류만
  // 노출(KILL 비표시). 게이트는 로드된 기사 상태값(ctrl.status)으로만 판정 — 모드 플래그 무도입(SPEC-007 정합).
  const isDps = ctrl.status === 'DPS';
  // SPEC-NEWS-REVISE-001 — 본문 커서 위치 임베드 (Phase C): 메타 패널의 "삽입" 버튼을 클릭하면
  // 포커스가 BodyEditor를 떠난 뒤지만, 마지막으로 알려진 캐럿 offset을 ref로 보존해 인라인 삽입한다.
  const lastCaretRef = useRef(null);
  const handleCaretChange = useCallback((off) => { lastCaretRef.current = off; }, []);
  // SPEC-NEWS-REVISE-001 — shared "pending embed insert" channel between the button path (here) and the
  // paste path (BodyEditor). Set to { offset } right before ctrl.embed so BodyEditor's repaint can place
  // the caret right after the freshly inserted embed span. `offset === undefined` => append semantics.
  const pendingEmbedCaretRef = useRef(null);
  const insertEmbedAtCaret = useCallback((descriptor) => {
    const caret = lastCaretRef.current;
    pendingEmbedCaretRef.current = { offset: caret == null ? undefined : caret };
    ctrl.embed(descriptor, caret == null ? undefined : caret);
  }, [ctrl]);

  return (
    <main className="yh-write-layout">
      {/* SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — lockError banner stays above the editor and is announced
          assertively to screen readers (D2-1 = C, NFR-A11Y). The editor body is contentEditable=false
          while lockError is set so the user cannot type into a locked article. */}
      {ctrl.lockError ? (
        <div role="alert" aria-live="assertive" className="yh-lock-banner">
          해당 기사는 다른 페이지/세션에서 편집 중입니다.
        </div>
      ) : null}

      {/* Left: body editor (60%) — typeable text + ordered inline embeds (DP-F1 adapter behind ctrl). */}
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

      {/* Right: metadata panel (40%) */}
      <section data-testid="metadata-region" className="yh-meta-region" aria-label="메타데이터">
        {/* 송고 / 보류 / KILL action buttons at the top (news.md 기사 작성 페이지 내 버튼).
            Visibility is gated by role + the editing article's status:
            - 송고/보류: role R, D, or Z AND status RDS
            - KILL:    role R or Z      AND status RDS AND 기사아이디 생성됨 (!ctrl.isDraft, v0.6.0)
            SPEC-NEWS-REVISE-001 / REQ-AUTH-Z-BUTTONS (D-1 잠금): Z권한도 R/D와 동일한 RDS gate를
            적용해 송고/보류/KILL을 노출한다. status가 RDS가 아니면 어느 권한도 노출하지 않는다.
            v0.6.0: 기사아이디가 생성되지 않은 신규 초안(A-DRAFT)에서는 KILL을 표시하지 않는다 —
            존재하지 않는 기사는 KILL 대상이 아니며, 초안 KILL은 기사를 만들었다 바로 죽이는 동작이 된다. */}
        {/* REQ-FE-WRITE-012/013 v0.3.0: 송고/보류/KILL은 확인창(window.confirm)을 선행하고,
            확인했을 때만 진행한다. 취소 시 저장/액션 모두 미발생 (AC-5.4). */}
        <div className="yh-meta-actions">
          {(user.role === 'R' || user.role === 'D' || user.role === 'Z') && isRds ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary" disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold" disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('보류하시겠습니까?')) ctrl.hold(); }}>보류</button>
            </>
          ) : null}
          {(user.role === 'R' || user.role === 'Z') && isRds && !ctrl.isDraft ? (
            <button type="button" className="yh-btn yh-btn--kill" disabled={!!ctrl.lockError}
              onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
          ) : null}
          {/* SPEC-NEWS-REVISE-009 lineage-Y — DDH(데스크 보류) 기사: role D|Z 에게 송고 노출(보류 없음),
              KILL 은 Z 전용(news.md 권한 매트릭스 — role D 비표시, #19 8e4b1eb).
              role R 은 어떤 액션 버튼도 보이지 않는다. lockError 시 비활성화. */}
          {isDdh && (user.role === 'D' || user.role === 'Z') ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary" disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              {user.role === 'Z' ? (
                <button type="button" className="yh-btn yh-btn--kill" disabled={!!ctrl.lockError}
                  onClick={() => { if (window.confirm('KILL하시겠습니까?')) ctrl.kill(); }}>KILL</button>
              ) : null}
            </>
          ) : null}
          {/* SPEC-NEWS-REVISE-011 — DPS 고침/포털고침: R/D/Z 에게 송고/보류만 노출(KILL 비표시). 기존 RDS
              블록과 동일 클래스·확인창·lockError disabled·송고 가드(ctrl.send 내부 "(끝)"/제목 가드)를 재사용한다. */}
          {isDps && (user.role === 'R' || user.role === 'D' || user.role === 'Z') ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary" disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('송고하시겠습니까?')) ctrl.send(); }}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold" disabled={!!ctrl.lockError}
                onClick={() => { if (window.confirm('보류하시겠습니까?')) ctrl.hold(); }}>보류</button>
            </>
          ) : null}
        </div>

        {/* REQ-FE-WRITE-014 v0.3.0: 성공 시 버튼 아래 상태 메시지를 표시하지 않는다 — lifecycleStatus
            표시 블록 제거. 거부/오류(actionError)는 종전대로 노출한다. */}
        {ctrl.actionError ? <div role="alert" className="yh-alert">{ctrl.actionError}</div> : null}

        {/* SPEC-NEWS-REVISE-007 REQ-VO-MAPPING (AC-MAP-2/3): read-only ContentsVO 8 fields, shown only in
            an edit context (ctrl.readonlyMeta non-null). A blank-new draft renders nothing here. */}
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
