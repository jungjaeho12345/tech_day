// Article-detail document builder (news.md "# 상세보기"):
// 상세보기 클릭 시 새 창 — 상단에 공통정보 12개 필드(가로 나열), 하단에 제목/본문을 한 통합 영역에 함께.
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
 * Build a full standalone HTML document for the article-detail popup window.
 * Layout: 상단 공통정보(12 필드, 가로 나열) → 하단 통합 "기사" 영역(제목 → 본문 함께).
 * 연합뉴스 블루/화이트 톤 (CLAUDE.md 디자인 규칙: 파란색과 흰색, 글자색은 파란색).
 * @param {Record<string, unknown>} article
 * @returns {string}
 */
export function buildArticleDetailHtml(article) {
  const a = article ?? {};
  const title = escapeHtml(a.title) || '(제목 없음)';
  const body = escapeHtml(a.content);
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
  /* 제목/본문을 하나의 통합 영역(.yh-detail__article)에서 제목 → 본문 순으로 함께 보여준다 (분리 2영역 폐지).
     SPEC-NEWS-REVISE-002 REQ-DETAIL-FONT-EMPHASIS 유지: body font-size > title font-size (시각적 강조). */
  .yh-detail__title {
    font-family: 'Nanum Myeongjo', 'Noto Serif KR', serif;
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--yh-blue-deep);
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--yh-gray-line);
  }
  .yh-detail__content {
    font-family: 'Nanum Myeongjo', 'Noto Serif KR', serif;
    font-size: 1.75rem;
    line-height: 1.8;
    color: var(--yh-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0;
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
    <h1 class="yh-detail__title">${title}</h1>
    <div class="yh-detail__content">${body}</div>
  </section>
</body>
</html>`;
}
