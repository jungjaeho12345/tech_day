// Article-detail document builder (news.md 기사 조회페이지):
// "기사를 클릭하면 새로운 창에서 기사의 제목, 내용, 공통정보 내용을 볼 수 있다."
// Pure functions only — no DOM/window access here, so they are unit-testable in isolation.
// The view layer (ViewPage) calls window.open and writes the returned HTML string.

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

// 공통정보 (common-info) fields, in display order, mapped to Korean labels.
// These mirror the Contents row fields the Model returns (no backend change).
const COMMON_INFO_FIELDS = Object.freeze([
  ['author', '작성자'],
  ['modifier', '수정자'],
  ['sender', '송고자'],
  ['department', '부서'],
  ['departmentCode', '부서코드'],
  ['createdAt', '작성시간'],
  ['editedAt', '수정시간'],
  ['sentAt', '송고시간'],
  ['distributedAt', '배부시간'],
  ['embargoAt', '엠바고'],
  ['secondEmbargoAt', '2차 엠바고'],
  ['status', '상태값'],
]);

/**
 * Build the 공통정보 definition-list rows for the fields that are present (non-empty).
 * @param {Record<string, unknown>} article
 * @returns {string}
 */
function buildCommonInfoRows(article) {
  return COMMON_INFO_FIELDS
    .filter(([key]) => {
      const v = article?.[key];
      return v !== null && v !== undefined && String(v).trim() !== '';
    })
    .map(
      ([key, label]) =>
        `<div class="yh-detail__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(article[key])}</dd></div>`,
    )
    .join('\n');
}

/**
 * Build a full standalone HTML document for the article-detail popup window.
 * Shows the 제목(title) as a heading, the 내용(content) body, and a 공통정보 section.
 * Light 연합뉴스 styling is inlined so the popup is self-contained and readable.
 * @param {Record<string, unknown>} article
 * @returns {string}
 */
export function buildArticleDetailHtml(article) {
  const a = article ?? {};
  const title = escapeHtml(a.title) || '(제목 없음)';
  const content = escapeHtml(a.content);
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
    --yh-red: #C8102E;
    --yh-ink: #1a1a1a;
    --yh-gray-line: #DDD;
    --yh-gray-bg: #f5f5f5;
    --yh-gray-mid: #888;
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
  .yh-detail__title {
    font-family: 'Nanum Myeongjo', 'Noto Serif KR', serif;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 3px solid var(--yh-blue);
  }
  .yh-detail__content {
    font-family: 'Nanum Myeongjo', 'Noto Serif KR', serif;
    font-size: 1.02rem;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0 0 24px;
  }
  .yh-detail__section-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--yh-blue);
    border-left: 3px solid var(--yh-red);
    padding-left: 8px;
    margin: 0 0 8px;
  }
  .yh-detail__info {
    margin: 0;
    border-top: 1px solid var(--yh-gray-line);
  }
  .yh-detail__row {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 8px;
    padding: 6px 4px;
    border-bottom: 1px solid var(--yh-gray-line);
    font-size: 0.88rem;
  }
  .yh-detail__row dt {
    color: var(--yh-gray-mid);
    font-weight: 600;
  }
  .yh-detail__row dd {
    margin: 0;
    color: var(--yh-ink);
    overflow-wrap: anywhere;
  }
</style>
</head>
<body>
  <h1 class="yh-detail__title">${title}</h1>
  <div class="yh-detail__content">${content}</div>
  <h2 class="yh-detail__section-title">공통정보</h2>
  <dl class="yh-detail__info">
${commonRows}
  </dl>
</body>
</html>`;
}
