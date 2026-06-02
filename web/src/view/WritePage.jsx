// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류/KILL above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold/kill go through the controllers (DP-F3/DP-F5). A successful action resets the page.
// The action buttons are role+status gated (news.md 기사 작성 페이지 내 버튼): 송고/보류 for role R|D and
// KILL for role R, both only while the editing article's status is RDS.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';
import { InlineEmbed } from './InlineEmbed.jsx';
import { buildColorSegments } from './editorColoring.js';
import { getCaretCharOffset, setCaretCharOffset } from './editorCaret.js';
import { insertNewlineAt } from './editorNewline.js';
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

// @MX:NOTE: [AUTO] Apply role-based coloring to the contentEditable: 제목 파란색 / 부제목 빨간색 / 본문 검정색,
// trailing "(끝)" 골드색 (news.md 기사 에디터). Rebuilds child nodes as colored <span> lines while keeping
// el.textContent EXACTLY equal to `text` (presentation-only): newlines stay as text nodes between line spans
// so white-space:pre-wrap renders them and the character count is preserved (AC-5.1 asserts the typed text
// appears verbatim in markupVersion, so the DOM textContent must stay byte-identical to the body text).
function paintEditor(el, text) {
  const segments = buildColorSegments(text);
  // Build into a fragment, then swap in one shot (fewer reflows, atomic for the caller's caret restore).
  const frag = el.ownerDocument.createDocumentFragment();
  for (const seg of segments) {
    if (seg.newline) {
      // Newline as a bare text node (rendered by white-space:pre-wrap); keeps offsets exact.
      frag.appendChild(el.ownerDocument.createTextNode('\n'));
      continue;
    }
    const span = el.ownerDocument.createElement('span');
    span.className = seg.cls === 'end' ? 'yh-end-mark' : `yh-line yh-line--${seg.cls}`;
    span.textContent = seg.text;
    frag.appendChild(span);
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
function BodyEditor({ content, bodyText, onChangeText, onAltY, onPasteEmbed }) {
  const ref = useRef(null);
  const composingRef = useRef(false);
  // Korean IME 1-press Enter fix: when Enter commits an active composition, the IME consumes the
  // keystroke and our handleEnter must NOT preventDefault (else the syllable is lost). We record the
  // user's intent here and flush a single newline insertion on compositionend so a single Enter both
  // commits the syllable AND breaks the line, instead of requiring a second Enter.
  const pendingEnterAfterIme = useRef(false);
  const embeds = content.blocks.filter((b) => b.type === 'embed');

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

  // Paint `text` into the editor while preserving the caret by character offset (caret restored only
  // when the editor is focused). Pure presentation — el.textContent ends up exactly equal to `text`.
  const paintWithCaret = useCallback((text) => {
    const el = ref.current;
    if (!el) return;
    const focused = el.ownerDocument.activeElement === el;
    const caret = focused ? getCaretCharOffset(el) : null;
    paintEditor(el, text);
    if (caret != null) setCaretCharOffset(el, caret);
  }, []);

  // Recolor the editor's CURRENT contents in place (compositionend/blur). Caret-preserving.
  const recolor = useCallback(() => {
    const el = ref.current;
    if (el) paintWithCaret(el.textContent ?? '');
  }, [paintWithCaret]);

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
    // Paint + place the caret immediately (no flicker, no stale-offset repaint). After this,
    // el.textContent === next; onChangeText(next) then makes bodyText === next, so the sync useEffect
    // (which repaints only when el.textContent !== bodyText) does NOT fire a second repaint — the caret
    // stays exactly where we put it.
    paintEditor(el, next);
    setCaretCharOffset(el, caret);
    onChangeText(next);
  }, [bodyText, onChangeText]);

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
    if (el.textContent !== bodyText) {
      paintWithCaret(bodyText);
    }
  }, [bodyText, paintWithCaret]);

  // Initial mount: paint whatever the model currently holds so loaded/colored text shows immediately.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent === '' && bodyText !== '') paintEditor(el, bodyText);
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
        onInput={(e) => onChangeText(e.currentTarget.textContent ?? '')}
        onPaste={handlePaste}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          // Hangul composition finished: flush the text, then recolor (safe now that no IME is active).
          composingRef.current = false;
          onChangeText(e.currentTarget.textContent ?? '');
          recolor();
          // If the composition was committed by Enter, also break the line here so the user does not
          // need to press Enter a second time (Korean IME 1-press Enter fix).
          if (pendingEnterAfterIme.current) {
            pendingEnterAfterIme.current = false;
            insertNewline(e.currentTarget);
          }
        }}
        onBlur={() => { if (!composingRef.current) recolor(); }}
        onKeyDown={(e) => {
          // Enter / Shift+Enter -> insert a model '\n' (caret-jump fix). Handled first; if it consumed the
          // key, do not fall through to Alt+Y. handleEnter returns false for non-Enter / IME-commit Enter.
          if (handleEnter(e)) return;
          // Alt+Y: append "(끝)" (골드색) to the end of the body. preventDefault so no 'y' is typed.
          if (e.altKey && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
            e.preventDefault();
            onAltY();
          }
        }}
      />
      {embeds.length > 0 ? (
        <div data-testid="editor-embeds" className="yh-editor-embeds">
          {embeds.map((b, i) => (
            <InlineEmbed key={`${b.embed.type}-${b.embed.url ?? b.embed.articleId ?? i}-${i}`} embed={b.embed} />
          ))}
        </div>
      ) : null}
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
        />
      </section>

      {/* Right: metadata panel (40%) */}
      <section data-testid="metadata-region" className="yh-meta-region" aria-label="메타데이터">
        {/* 송고 / 보류 / KILL action buttons at the top (news.md 기사 작성 페이지 내 버튼).
            Visibility is gated by role + the editing article's status:
            - 송고/보류: role R or D AND status RDS
            - KILL: role R only AND status RDS
            (Role Z can author/edit but never transition; non-RDS articles show none.) */}
        <div className="yh-meta-actions">
          {(user.role === 'R' || user.role === 'D') && isRds ? (
            <>
              <button type="button" className="yh-btn yh-btn--primary" onClick={ctrl.send}>송고</button>
              <button type="button" className="yh-btn yh-btn--hold" onClick={ctrl.hold}>보류</button>
            </>
          ) : null}
          {user.role === 'R' && isRds ? (
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
        {activeTab === '이미지' ? <MediaPanel tabName="이미지" embedType="image" onEmbed={ctrl.embed} /> : null}
        {activeTab === '영상' ? <MediaPanel tabName="영상" embedType="video" onEmbed={ctrl.embed} /> : null}
        {activeTab === '글기사' ? <TextArticlePanel onEmbed={ctrl.embed} /> : null}
      </section>
    </main>
  );
}
