// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류 above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold go through the controllers (DP-F3/DP-F5).
import { useState, useRef, useEffect } from 'react';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';
import { InlineEmbed } from './InlineEmbed.jsx';

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

// @MX:NOTE: [AUTO] contentEditable body editor — typeable plain text (editor-body) plus a rendered list of
// ordered inline embeds (REQ-EDIT-ADP/EMBED). The contentEditable text is uncontrolled to preserve the caret;
// it is only written from props when the markup is loaded externally (length change without focus).
function BodyEditor({ content, bodyText, onChangeText }) {
  const ref = useRef(null);
  const embeds = content.blocks.filter((b) => b.type === 'embed');

  // Sync external body text into the (uncontrolled) contentEditable without disturbing the caret on typing.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== bodyText && document.activeElement !== el) {
      el.textContent = bodyText;
    }
  }, [bodyText]);

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
  const ctrl = useWriteController(user);
  const [activeTab, setActiveTab] = useState('공통정보');

  return (
    <main className="yh-write-layout">
      {/* Left: body editor (60%) — typeable text + ordered inline embeds (DP-F1 adapter behind ctrl). */}
      <section data-testid="editor-region" className="yh-editor-region" aria-label="에디터">
        <BodyEditor content={ctrl.content} bodyText={ctrl.bodyText} onChangeText={ctrl.setBodyMarkup} />
      </section>

      {/* Right: metadata panel (40%) */}
      <section data-testid="metadata-region" className="yh-meta-region" aria-label="메타데이터">
        {/* 송고 / 보류 action buttons at the top */}
        <div className="yh-meta-actions">
          <button type="button" className="yh-btn yh-btn--primary" onClick={ctrl.send}>송고</button>
          <button type="button" className="yh-btn yh-btn--hold" onClick={ctrl.hold}>보류</button>
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
