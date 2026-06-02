// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류/KILL above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold/kill go through the controllers (DP-F3/DP-F5). A successful action resets the page.
// The action buttons are role+status gated (news.md 기사 작성 페이지 내 버튼): 송고/보류 for role R|D and
// KILL for role R, both only while the editing article's status is RDS.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';
import { buildColorSegments } from './editorColoring.js';
import { getCaretCharOffset, getSelectionOffsets, setCaretCharOffset, getBodyTextFromDom } from './editorCaret.js';
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
  const { results, state, search } = useMediaSearch();
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

// @MX:NOTE: [AUTO] Build an inline embed <span> DOM node for paintEditor. contenteditable=false +
// zero text contribution: the embed span carries NO text children, so DOM textContent stays equal to
// bodyText. data-testid mirrors InlineEmbed (embed-image/embed-video/embed-article) so the existing
// tests find embeds inline within the contentEditable. Defensive: thumbnailUrl falls back to url.
function buildEmbedInlineSpan(doc, embed, index) {
  const span = doc.createElement('span');
  span.className = 'yh-embed-inline';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-embed-index', String(index));

  if (!embed) return span;

  // Title/url labels live INSIDE the embed span. They contribute to DOM textContent, but caret math
  // (editorCaret.js) excludes [data-embed-index] descendants, so the bodyText model stays intact.
  if (embed.type === 'image') {
    span.setAttribute('data-testid', 'embed-image');
    span.classList.add('yh-embed', 'yh-embed--image');
    const img = doc.createElement('img');
    img.className = 'yh-embed__img';
    img.setAttribute('src', embed.thumbnailUrl || embed.url || '');
    img.setAttribute('alt', embed.title || '삽입 이미지');
    span.appendChild(img);
    if (embed.title) {
      const cap = doc.createElement('span');
      cap.className = 'yh-embed__caption';
      cap.textContent = embed.title;
      span.appendChild(cap);
    }
    return span;
  }
  if (embed.type === 'video') {
    span.setAttribute('data-testid', 'embed-video');
    span.classList.add('yh-embed', 'yh-embed--video');
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
    return span;
  }
  return span;
}

// @MX:NOTE: [AUTO] Render the editor contentEditable from a structured content (text blocks + inline
// embeds). Inline embeds appear at their exact position between text blocks, satisfying news.md
// "본문 커서 위치에 임베딩". DOM textContent EXACTLY equals bodyText (embed spans contribute no text),
// so caret offsets and character counts remain byte-stable. Role-based coloring (제목/부제목/본문/(끝))
// is computed from the global bodyText so line semantics survive embeds that split text blocks.
function paintEditor(el, content) {
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
      frag.appendChild(buildEmbedInlineSpan(doc, embed, index));
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
      frag.appendChild(buildEmbedInlineSpan(doc, embed, index));
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
    frag.appendChild(buildEmbedInlineSpan(doc, embed, index));
    nextEmbedIdx += 1;
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
function BodyEditor({ content, bodyText, onChangeText, onAltY, onPasteEmbed, onCaretChange }) {
  const ref = useRef(null);
  const composingRef = useRef(false);
  // Korean IME 1-press Enter fix: when Enter commits an active composition, the IME consumes the
  // keystroke and our handleEnter must NOT preventDefault (else the syllable is lost). We record the
  // user's intent here and flush a single newline insertion on compositionend so a single Enter both
  // commits the syllable AND breaks the line, instead of requiring a second Enter.
  const pendingEnterAfterIme = useRef(false);
  // Stable ref to current content so imperative paintEditor calls (insertNewline, Ctrl+D, recolor)
  // can preserve inline embeds when only the text changes. Updated on every render.
  const contentRef = useRef(content);
  contentRef.current = content;

  // Build a content snapshot with the given replacement bodyText, preserving existing embed blocks.
  // The new bodyText becomes a single text block; trailing embeds (or originally interleaved embeds)
  // are appended in their original relative order. This is a presentation-only helper used by the
  // imperative paint paths; the controller (setBodyMarkup) will normalize the model on the next tick.
  const contentWithText = useCallback((text) => {
    const embedBlocks = (contentRef.current?.blocks ?? []).filter((b) => b.type === 'embed');
    const blocks = text === '' ? [...embedBlocks] : [{ type: 'text', text }, ...embedBlocks];
    return { blocks };
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
      onPasteEmbed({ type: 'video', source: 'clipboard', title: '붙여넣은 영상', url: text.trim() });
      return;
    }
    // Plain text (or anything else): do not preventDefault — let the browser paste the text normally.
  }, [onPasteEmbed]);

  // Paint a content snapshot (or string) into the editor while preserving the caret by character
  // offset (caret restored only when the editor is focused). Pure presentation — DOM textContent
  // ends up exactly equal to the body text (embed spans contribute no text).
  const paintWithCaret = useCallback((contentOrText) => {
    const el = ref.current;
    if (!el) return;
    const focused = el.ownerDocument.activeElement === el;
    const caret = focused ? getCaretCharOffset(el) : null;
    paintEditor(el, contentOrText);
    if (caret != null) setCaretCharOffset(el, caret);
  }, []);

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
    // Paint + place the caret immediately (no flicker). Pass a content snapshot so inline embeds are
    // preserved through the repaint.
    paintEditor(el, contentWithText(next));
    setCaretCharOffset(el, caret);
    onChangeText(next);
  }, [bodyText, onChangeText, contentWithText]);

  // SPEC-NEWS-REVISE-001 — Korean IME 1-press Enter fix (stale-closure 회피). compositionEnd 시점에는
  // 직전 onChangeText(textContent) 호출이 비동기 state update라 `bodyText` 클로저가 아직 IME-commit
  // 이전 값이다. 클로저 대신 el.textContent를 source of truth로 사용해 splice 한다 — 방금 commit된
  // 한글 음절이 paintEditor에 의해 덮어쓰여 사라지는 문제(두 번째 Enter 필요)를 제거.
  const insertNewlineFromDom = useCallback((el) => {
    const text = getBodyTextFromDom(el);
    const offset = getCaretCharOffset(el);
    const next = insertNewlineAt(text, offset);
    const caret = (offset == null ? text.length : Math.min(offset, text.length)) + 1;
    paintEditor(el, contentWithText(next));
    setCaretCharOffset(el, caret);
    onChangeText(next);
  }, [onChangeText, contentWithText]);

  // Intercept Enter / Shift+Enter on keydown and splice a model '\n' ourselves. We use keydown (one path,
  // not also beforeinput) because it fires reliably in the target browser AND is testable. Korean IME
  // safety: an Enter that COMMITS an active composition must be left to the IME — browsers signal this with
  // e.isComposing === true or e.keyCode === 229 (and composingRef is set on compositionstart). In that case
  // we return WITHOUT preventDefault so the IME commits; the compositionend recolor then applies normally.
  const handleEnter = useCallback((e) => {
    if (e.key !== 'Enter') return false;
    if (composingRef.current || e.isComposing || e.keyCode === 229) {
      // IME commit Enter: let the IME finish the syllable; remember the intent so compositionend
      // can insert the model '\n' a tick later. This makes a single Enter both commit and break.
      pendingEnterAfterIme.current = true;
      return false;
    }
    e.preventDefault(); // stop the browser inserting <div>/<br> block markup
    insertNewline(e.currentTarget);
    return true;
  }, [insertNewline]);

  // Sync the body text from props into the (uncontrolled) contentEditable. This fires for:
  //   - initial mount (paint empty/loaded text),
  //   - programmatic changes: edit-load (?id=), embed insert, reset, and Alt+Y "(끝)" append.
  // It deliberately repaints (with coloring) ONLY when el.textContent !== bodyText, i.e. when the DOM is
  // out of sync with the model — which is true for programmatic changes but NOT for in-progress typing
  // (where onInput already pushed the same text to the model). This is the IME-safety guarantee: ordinary
  // keystrokes/composition never trigger a repaint here; coloring during typing only happens on
  // compositionend/blur. The caret (when focused, e.g. Alt+Y) is preserved by paintWithCaret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Repaint when DOM is out of sync with the model text OR when content (embed blocks) changes.
    // Embeds contribute no text so we cannot rely on textContent alone; check embed count too.
    const embedDomCount = el.querySelectorAll('[data-embed-index]').length;
    const embedModelCount = (content?.blocks ?? []).filter((b) => b.type === 'embed').length;
    if (getBodyTextFromDom(el) !== bodyText || embedDomCount !== embedModelCount) {
      paintWithCaret(content);
    }
  }, [content, bodyText, paintWithCaret]);

  // Initial mount: paint whatever the model currently holds so loaded/colored text shows immediately.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent === '' && (bodyText !== '' || (content?.blocks ?? []).length > 0)) {
      paintEditor(el, content);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <label htmlFor="editor-body">본문</label>
      <div
        id="editor-body"
        data-testid="editor-body"
        className="yh-editor-body"
        role="textbox"
        aria-multiline="true"
        aria-label="본문"
        contentEditable
        suppressContentEditableWarning
        ref={ref}
        onInput={(e) => {
          onChangeText(getBodyTextFromDom(e.currentTarget));
          if (onCaretChange) {
            const off = getCaretCharOffset(e.currentTarget);
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
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          // Hangul composition finished: flush the text, then recolor (safe now that no IME is active).
          composingRef.current = false;
          onChangeText(getBodyTextFromDom(e.currentTarget));
          recolor();
          // If the composition was committed by Enter, also break the line here so the user does not
          // need to press Enter a second time (Korean IME 1-press Enter fix).
          if (pendingEnterAfterIme.current) {
            pendingEnterAfterIme.current = false;
            insertNewlineFromDom(e.currentTarget);
          }
        }}
        onBlur={() => { if (!composingRef.current) recolor(); }}
        onKeyDown={(e) => {
          // Enter / Shift+Enter -> insert a model '\n' (caret-jump fix). Handled first; if it consumed the
          // key, do not fall through to Alt+Y. handleEnter returns false for non-Enter / IME-commit Enter.
          if (handleEnter(e)) return;
          // SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D: Ctrl+D -> 캐럿이 위치한 라인(또는
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
            paintEditor(el, contentWithText(next.value));
            setCaretCharOffset(el, next.selectionStart);
            onChangeText(next.value);
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

export function WritePage({ user }) {
  // news.md 데스크 미송고 편집: writer.do?id=<articleId> loads that article for editing.
  // Read the id once from the URL (the page remounts on navigation, so a per-render read is fine).
  const editArticleId = new URLSearchParams(window.location.search).get('id') || undefined;
  const ctrl = useWriteController(user, { editArticleId });
  const [activeTab, setActiveTab] = useState('공통정보');
  // Action buttons only apply to an RDS (in-progress) article (news.md 기사 작성 페이지 내 버튼).
  const isRds = ctrl.status === 'RDS';
  // SPEC-NEWS-REVISE-001 — 본문 커서 위치 임베드 (Phase C): 메타 패널의 "삽입" 버튼을 클릭하면
  // 포커스가 BodyEditor를 떠난 뒤지만, 마지막으로 알려진 캐럿 offset을 ref로 보존해 인라인 삽입한다.
  const lastCaretRef = useRef(null);
  const handleCaretChange = useCallback((off) => { lastCaretRef.current = off; }, []);
  const insertEmbedAtCaret = useCallback((descriptor) => {
    const caret = lastCaretRef.current;
    ctrl.embed(descriptor, caret == null ? undefined : caret);
  }, [ctrl]);

  return (
    <main className="yh-write-layout">
      {/* Left: body editor (60%) — typeable text + ordered inline embeds (DP-F1 adapter behind ctrl). */}
      <section data-testid="editor-region" className="yh-editor-region" aria-label="에디터">
        <BodyEditor
          content={ctrl.content}
          bodyText={ctrl.bodyText}
          onChangeText={ctrl.setBodyMarkup}
          onAltY={ctrl.appendEnd}
          onPasteEmbed={ctrl.embed}
          onCaretChange={handleCaretChange}
        />
      </section>

      {/* Right: metadata panel (40%) */}
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
              <button type="button" className="yh-btn yh-btn--primary" onClick={ctrl.send}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold" onClick={ctrl.hold}>보류</button>
            </>
          ) : null}
          {(user.role === 'R' || user.role === 'Z') && isRds ? (
            <button type="button" className="yh-btn yh-btn--kill" onClick={ctrl.kill}>KILL</button>
          ) : null}
        </div>

        {ctrl.lifecycleStatus ? (
          <div data-testid="lifecycle-status" className="yh-lifecycle-status">
            상태: {ctrl.lifecycleStatus}
          </div>
        ) : null}
        {ctrl.actionError ? <div role="alert" className="yh-alert">{ctrl.actionError}</div> : null}

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
