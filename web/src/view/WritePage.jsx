// Article-write page (REQ-FE-WRITE-001..015). Left editor region + right metadata region with
// four tabs and 송고/보류 above the tabs. The editor is behind the adapter (DP-F1); search and
// send/hold go through the controllers (DP-F3/DP-F5).
import { useState } from 'react';
import { useWriteController } from '../controller/useWriteController.js';
import { useMediaSearch, useArticleSearch } from '../controller/useSearchController.js';

const TABS = ['공통정보', '이미지', '영상', '글기사'];

const COMMON_FIELDS = [
  ['author', '작성자'], ['coAuthor', '공동작성'], ['content', '내용'], ['region', '지역'],
  ['attribute', '속성'], ['keyword', '키워드'], ['internalComment', '내부코멘트'],
  ['externalComment', '외부코멘트'], ['attachmentFile', '첨부파일'], ['referenceFile', '자료파일'],
];

function CommonInfoPanel({ common, updateCommon }) {
  return (
    <div data-testid="panel-공통정보" role="tabpanel">
      {COMMON_FIELDS.map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`f-${key}`}>{label}</label>
          <input id={`f-${key}`} value={common[key]} onChange={(e) => updateCommon(key, e.target.value)} />
        </div>
      ))}
      <div>
        <label htmlFor="f-embargoAt">엠바고 시간</label>
        <input id="f-embargoAt" type="datetime-local" value={common.embargoAt}
          onChange={(e) => updateCommon('embargoAt', e.target.value)} />
      </div>
      <div>
        <label htmlFor="f-secondaryEmbargoAt">2차 엠바고 시간</label>
        <input id="f-secondaryEmbargoAt" type="datetime-local" value={common.secondaryEmbargoAt}
          onChange={(e) => updateCommon('secondaryEmbargoAt', e.target.value)} />
      </div>
    </div>
  );
}

function MediaPanel({ tabName, onEmbed }) {
  const { results, state, search } = useMediaSearch();
  const [query, setQuery] = useState('');
  return (
    <div data-testid={`panel-${tabName}`} role="tabpanel">
      <label htmlFor={`media-q-${tabName}`}>검색어</label>
      <input id={`media-q-${tabName}`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <button type="button" onClick={() => search(query)}>검색</button>
      {state === 'empty' ? <p>결과 없음</p> : null}
      {state === 'error' ? <p role="status">검색 오류</p> : null}
      <ul>
        {results.map((r) => (
          <li key={r.url}>
            <span>{r.title}</span>
            <button type="button" onClick={() => onEmbed(`[${r.source}] ${r.url}`)}>
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
    <div data-testid="panel-글기사" role="tabpanel">
      <label htmlFor="article-q">검색어</label>
      <input id="article-q" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button type="button" onClick={() => search(query)}>검색</button>
      <ul>
        {results.map((a) => (
          <li key={a.articleId}>
            <span>{a.title}</span>
            <button type="button" onClick={() => onEmbed(`기사:${a.articleId}`)}>삽입 {a.title}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WritePage({ user }) {
  const ctrl = useWriteController(user);
  const [activeTab, setActiveTab] = useState('공통정보');

  return (
    <main style={{ display: 'flex', gap: '1rem' }}>
      <section data-testid="editor-region" style={{ flex: 1 }} aria-label="에디터">
        <label htmlFor="editor-body">본문</label>
        <textarea
          id="editor-body"
          data-testid="editor-body"
          value={ctrl.body}
          onChange={(e) => ctrl.setBodyMarkup(e.target.value)}
        />
      </section>

      <section data-testid="metadata-region" style={{ flex: 1 }} aria-label="메타데이터">
        <div>
          <button type="button" onClick={ctrl.send}>송고</button>
          <button type="button" onClick={ctrl.hold}>보류</button>
        </div>
        {ctrl.lifecycleStatus ? (
          <div data-testid="lifecycle-status">상태: {ctrl.lifecycleStatus}</div>
        ) : null}
        {ctrl.actionError ? <div role="alert">{ctrl.actionError}</div> : null}

        <div role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === '공통정보' ? (
          <CommonInfoPanel common={ctrl.common} updateCommon={ctrl.updateCommon} />
        ) : null}
        {activeTab === '이미지' ? <MediaPanel tabName="이미지" onEmbed={ctrl.embed} /> : null}
        {activeTab === '영상' ? <MediaPanel tabName="영상" onEmbed={ctrl.embed} /> : null}
        {activeTab === '글기사' ? <TextArticlePanel onEmbed={ctrl.embed} /> : null}
      </section>
    </main>
  );
}
