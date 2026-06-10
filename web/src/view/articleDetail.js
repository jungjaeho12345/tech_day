// Article-detail document builder (news.md "# 상세보기"):
// 상세보기 클릭 시 새 창 — 상단에 공통정보 12개 필드(가로 나열), 하단에 제목/본문을 한 통합 영역에 함께.
// Pure functions only — no DOM/window access here, so they are unit-testable in isolation.
// The view layer (ViewPage) calls window.open and writes the returned HTML string.
//
// 과업 ③: '기사' 영역의 본문은 공통정보의 "내용"(a.content, 짧은 리드)이 아니라 실제 기사 본문
// (a.markupVersion — 에디터 직렬화 JSON)을 파싱한 블록(텍스트 + 이미지/영상/기사 임베드)을 순서대로
// 렌더한다. markupVersion 이 없거나 빈 레거시 기사는 escape 된 a.content 로 안전 폴백한다.

import { deserializeContent } from '../model/editorContent.js';

/**
 * Escape the five HTML-significant characters so dynamic article text cannot break
 * the popup markup or inject script. Used for every interpolated value below.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 공통정보 (common-info) fields per news.md "# 상세보기" enumeration, in display order.
// `content` is the form's "내용" field saved by WritePage (COMMON_FIELDS key: content).
// `secondEmbargoAt` also accepts the write-form alias `secondaryEmbargoAt`.
const COMMON_INFO_FIELDS = Object.freeze([
  ['author', '작성자'],
  ['coAuthor', '공동작성'],
  ['content', '내용'],
  ['region', '지역'],
  ['attribute', '속성'],
  ['keyword', '키워드'],
  ['internalComment', '내부코멘트'],
  ['externalComment', '외부코멘트'],
  ['attachmentFile', '첨부파일'],
  ['referenceFile', '자료파일'],
  ['embargoAt', '엠바고 시간'],
  ['secondEmbargoAt', '2차 엠바고 시간'],
]);

const EMPTY_PLACEHOLDER = '—';

function readField(article, key) {
  const raw = article?.[key];
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') return raw;
  if (key === 'secondEmbargoAt') {
    const alt = article?.secondaryEmbargoAt;
    if (alt !== null && alt !== undefined && String(alt).trim() !== '') return alt;
  }
  return null;
}

function buildCommonInfoRows(article) {
  return COMMON_INFO_FIELDS
    .map(([key, label]) => {
      const v = readField(article, key);
      const cellClass = v === null ? 'yh-detail__row yh-detail__row--empty' : 'yh-detail__row';
      const cellValue = v === null ? EMPTY_PLACEHOLDER : escapeHtml(v);
      return `<div class="${cellClass}"><dt>${escapeHtml(label)}</dt><dd>${cellValue}</dd></div>`;
    })
    .join('\n');
}

/**
 * Render a single embed descriptor to a self-contained HTML fragment for the detail popup.
 * 도메인 §2.4 크기 규약: 사진/영상 figure 폭 612px, 기사 참조 카드 480px. 기존 토큰만 재사용한다.
 * 모든 동적 텍스트/URL 은 escapeHtml 로 이스케이프한다 (XSS 방지).
 * @param {{type?: string, title?: string, url?: string, thumbnailUrl?: string, articleId?: string}} embed
 * @returns {string}
 */
function renderEmbed(embed) {
  if (!embed || typeof embed !== 'object') return '';
  if (embed.type === 'image') {
    const src = escapeHtml(embed.thumbnailUrl || embed.url || '');
    const alt = escapeHtml(embed.title || '삽입 이미지');
    return `<figure class="yh-detail__embed yh-detail__embed--image">`
      + `<img src="${src}" alt="${alt}" /></figure>`;
  }
  if (embed.type === 'video') {
    const thumb = embed.thumbnailUrl
      ? `<img src="${escapeHtml(embed.thumbnailUrl)}" alt="${escapeHtml(embed.title || '영상')}" />`
      : '';
    const title = escapeHtml(embed.title || embed.url || '영상');
    const link = embed.url
      ? `<a class="yh-detail__embed-link" href="${escapeHtml(embed.url)}" rel="noreferrer">${escapeHtml(embed.url)}</a>`
      : '';
    return `<figure class="yh-detail__embed yh-detail__embed--video">`
      + `${thumb}<figcaption class="yh-detail__embed-cap"><span class="yh-detail__embed-mark">영상</span>`
      + `<span class="yh-detail__embed-title">${title}</span>${link}</figcaption></figure>`;
  }
  if (embed.type === 'article') {
    const title = escapeHtml(embed.title || embed.articleId || '내부 기사');
    return `<div class="yh-detail__embed yh-detail__embed--article">`
      + `<span class="yh-detail__embed-mark">기사</span>`
      + `<span class="yh-detail__embed-title">${title}</span></div>`;
  }
  return '';
}

/**
 * Build the '기사' body HTML from a.markupVersion: deserialize to ordered blocks and render text blocks
 * (escaped, white-space preserved) and embed blocks (image/video/article) IN ORDER. Block order — 본문
 * 텍스트 → 임베드 → "(끝)" — is preserved exactly as stored. Legacy articles without markupVersion fall
 * back to the escaped a.content so the popup never breaks.
 * @param {Record<string, unknown>} article
 * @returns {string}
 */
function buildBodyHtml(article) {
  const markup = article?.markupVersion;
  if (markup === undefined || markup === null || markup === '') {
    // 레거시 폴백: markupVersion 이 없으면 공통정보 content 를 본문으로 (기존 동작과 동일, escape).
    return escapeHtml(article?.content);
  }
  const { blocks } = deserializeContent(markup);
  if (!blocks.length) {
    return escapeHtml(article?.content);
  }
  return blocks
    .map((b) => {
      if (b.type === 'text') {
        // 텍스트 블록은 escape 하되, .yh-detail__content 의 white-space:pre-wrap 이 개행을 보존한다.
        return escapeHtml(b.text);
      }
      if (b.type === 'embed') {
        return renderEmbed(b.embed);
      }
      return '';
    })
    .join('');
}

/**
 * Build a full standalone HTML document for the article-detail popup window.
 * Layout: 상단 공통정보(12 필드, 가로 나열) → 하단 통합 "기사" 영역(제목 → 본문 함께).
 * 블루/화이트 톤 (CLAUDE.md 디자인 규칙: 파란색과 흰색, 글자색은 파란색).
 * @param {Record<string, unknown>} article
 * @returns {string}
 */
export function buildArticleDetailHtml(article) {
  const a = article ?? {};
  const title = escapeHtml(a.title) || '(제목 없음)';
  // 과업 ③: 본문은 markupVersion 기반 실제 본문(텍스트 + 임베드, 순서 보존) — content 폴백 포함.
  const body = buildBodyHtml(a);
  const commonRows = buildCommonInfoRows(a);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root {
    --yh-blue: #0A4DA6;
    --yh-blue-deep: #08306B;
    --yh-blue-soft: #E8F0FB;
    --yh-ink: #08306B;
    --yh-gray-line: #DDE3EC;
    --yh-gray-mid: #6B7A90;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: 'Noto Sans KR', system-ui, sans-serif;
    color: var(--yh-ink);
    background: #fff;
    line-height: 1.6;
  }
  .yh-detail__section {
    margin: 0 0 24px;
    padding: 16px;
    background: #fff;
    border: 1px solid var(--yh-gray-line);
    border-left: 4px solid var(--yh-blue);
    border-radius: 4px;
  }
  .yh-detail__section:last-child { margin-bottom: 0; }
  .yh-detail__section-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--yh-blue);
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--yh-gray-line);
  }
  /* 공통정보 12 필드를 세로가 아닌 가로로 나열한다 (list.do 상세보기 레이아웃 개편).
     flex-wrap 으로 좁은 새창에서도 줄바꿈되어 깨지지 않는다. */
  .yh-detail__info {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .yh-detail__row {
    flex: 1 1 9rem;
    min-width: 9rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border: 1px solid var(--yh-gray-line);
    border-radius: 4px;
    background: var(--yh-blue-soft);
    font-size: 0.9rem;
  }
  .yh-detail__row dt {
    color: var(--yh-blue);
    font-weight: 600;
  }
  .yh-detail__row dd {
    margin: 0;
    color: var(--yh-ink);
    overflow-wrap: anywhere;
  }
  .yh-detail__row--empty dd {
    color: var(--yh-gray-mid);
  }
  /* SPEC-NEWS-REVISE-013 REQ-DETAIL-NO-SEPARATE-TITLE: 별도 제목 요소(.yh-detail__title) 폐지.
     본문(.yh-detail__content) 첫 줄(markupVersion)이 제목 역할을 한다. 제목은 <head><title> 에만 남는다. */
  .yh-detail__content {
    font-family: 'Nanum Myeongjo', 'Noto Serif KR', serif;
    font-size: 1.75rem;
    line-height: 1.8;
    color: var(--yh-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0;
  }
  /* 인라인 임베드 (도메인 §2.4): 사진/영상 figure 폭 612px, 기사 참조 카드 480px. 기존 토큰만 재사용. */
  .yh-detail__embed {
    display: block;
    margin: 16px 0;
  }
  .yh-detail__embed--image,
  .yh-detail__embed--video {
    max-width: 612px;
  }
  .yh-detail__embed img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--yh-gray-line);
    border-radius: 4px;
  }
  .yh-detail__embed-cap {
    display: block;
    margin-top: 6px;
    font-size: 0.95rem;
    color: var(--yh-gray-mid);
  }
  .yh-detail__embed--article {
    max-width: 480px;
    padding: 12px 16px;
    border: 1px solid var(--yh-gray-line);
    border-left: 4px solid var(--yh-blue);
    border-radius: 4px;
    background: var(--yh-blue-soft);
  }
  .yh-detail__embed-mark {
    display: inline-block;
    margin-right: 8px;
    padding: 1px 8px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #fff;
    background: var(--yh-blue);
    border-radius: 4px;
  }
  .yh-detail__embed-title {
    font-weight: 600;
    color: var(--yh-ink);
  }
  .yh-detail__embed-link {
    display: block;
    margin-top: 4px;
    color: var(--yh-blue);
    overflow-wrap: anywhere;
  }
</style>
</head>
<body>
  <section class="yh-detail__section" aria-label="공통정보">
    <h2 class="yh-detail__section-title">공통정보</h2>
    <dl class="yh-detail__info">
${commonRows}
    </dl>
  </section>
  <section class="yh-detail__section yh-detail__article" aria-label="기사">
    <h2 class="yh-detail__section-title">기사</h2>
    <div class="yh-detail__content">${body}</div>
  </section>
</body>
</html>`;
}
