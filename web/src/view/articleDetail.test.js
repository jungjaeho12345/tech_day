import { describe, it, expect } from 'vitest';
import { buildArticleDetailHtml, escapeHtml } from './articleDetail.js';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>"a"&'b'`)).toBe(
      '&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;',
    );
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

// news.md "# 상세보기":
//   상단 = 공통정보(작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트,
//                   첨부파일, 자료파일, 엠바고 시간, 2차 엠바고 시간)
//   하단 = 기사 제목, 본문
describe('buildArticleDetailHtml (news.md 상세보기)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    coAuthor: '김공동',
    description: '요약 내용',
    region: '서울',
    attribute: '속보',
    keyword: '정치, 외교',
    internalComment: '내부메모',
    externalComment: '외부메모',
    attachmentFile: 'photo.jpg',
    referenceFile: 'data.csv',
    embargoAt: '2026-05-01T10:00:00Z',
    secondEmbargoAt: '2026-05-02T10:00:00Z',
  };

  it('renders the article title and body in the bottom section', () => {
    const html = buildArticleDetailHtml(fullArticle);
    expect(html).toContain('속보 제목');
    expect(html).toContain('기사 본문 내용입니다.');
  });

  it('renders the 공통정보 section header above the title block', () => {
    const html = buildArticleDetailHtml(fullArticle);
    // Compare positions within the <body> (CSS rule names also contain the title class).
    const body = html.slice(html.indexOf('<body>'));
    const infoIdx = body.indexOf('공통정보');
    const titleIdx = body.indexOf('<h1');
    expect(infoIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(infoIdx).toBeLessThan(titleIdx);
  });

  it('lists ALL twelve 공통정보 labels enumerated in news.md', () => {
    const html = buildArticleDetailHtml(fullArticle);
    for (const label of [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일',
      '엠바고 시간', '2차 엠바고 시간',
    ]) {
      expect(html).toContain(label);
    }
  });

  it('renders each populated common-info value', () => {
    const html = buildArticleDetailHtml(fullArticle);
    for (const value of [
      '홍길동', '김공동', '요약 내용', '서울', '속보', '정치, 외교',
      '내부메모', '외부메모', 'photo.jpg', 'data.csv',
      '2026-05-01T10:00:00Z', '2026-05-02T10:00:00Z',
    ]) {
      expect(html).toContain(value);
    }
  });

  it('accepts secondaryEmbargoAt (write-form alias) for the 2차 엠바고 row', () => {
    const html = buildArticleDetailHtml({
      title: 't', content: 'b', secondaryEmbargoAt: '2026-06-01T00:00:00Z',
    });
    expect(html).toContain('2차 엠바고 시간');
    expect(html).toContain('2026-06-01T00:00:00Z');
  });

  it('shows an em-dash placeholder for absent fields (so all 12 rows are always visible)', () => {
    const html = buildArticleDetailHtml({ title: 't', content: 'b', author: '홍' });
    expect(html).toContain('작성자');
    expect(html).toContain('홍');
    // missing fields still rendered with em-dash placeholder
    expect(html).toContain('—');
    expect(html).toContain('yh-detail__row--empty');
  });

  it('renders 제목 and 본문 together in ONE unified 기사 section (제목 → 본문 연속)', () => {
    const html = buildArticleDetailHtml(fullArticle);
    // 레이아웃 개편: 분리된 제목/본문 섹션을 폐지하고 하나의 통합 "기사" 영역에서 함께 보여준다.
    expect(html).toContain('aria-label="공통정보"');
    expect(html).toContain('aria-label="기사"');
    expect(html).not.toContain('aria-label="제목"');
    expect(html).not.toContain('aria-label="본문"');
    // 통합 영역 안에서 제목(.yh-detail__title) → 본문(.yh-detail__content) 순으로 함께 보인다.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article).not.toBeNull();
    const titleEl = article.querySelector('.yh-detail__title');
    const contentEl = article.querySelector('.yh-detail__content');
    expect(titleEl).not.toBeNull();
    expect(contentEl).not.toBeNull();
    expect(titleEl.compareDocumentPosition(contentEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Order: 공통정보 → 기사
    const body = html.slice(html.indexOf('<body>'));
    expect(body.indexOf('aria-label="공통정보"')).toBeLessThan(body.indexOf('aria-label="기사"'));
  });

  it('escapes HTML special chars in dynamic text (no injection)', () => {
    const html = buildArticleDetailHtml({
      title: '<b>x</b>',
      content: '<img src=x onerror=alert(1)>',
      author: 'a&b',
    });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('a&amp;b');
  });

  // SPEC-NEWS-REVISE-002 — AC-FONT-1: 본문 폰트 사이즈 > 제목 폰트 사이즈 (CSS rule regex).
  it('AC-FONT-1: 본문 폰트 사이즈가 제목 폰트 사이즈보다 크다', () => {
    const html = buildArticleDetailHtml(fullArticle);
    const titleMatch = html.match(/\.yh-detail__title\s*\{[^}]*font-size:\s*([\d.]+)rem/);
    const contentMatch = html.match(/\.yh-detail__content\s*\{[^}]*font-size:\s*([\d.]+)rem/);
    expect(titleMatch).not.toBeNull();
    expect(contentMatch).not.toBeNull();
    expect(parseFloat(contentMatch[1])).toBeGreaterThan(parseFloat(titleMatch[1]));
  });

  // SPEC-NEWS-REVISE-002 — AC-FONT-3: 빈 제목 placeholder 케이스에서도 폰트 관계 유지.
  it('AC-FONT-3: 빈 제목 placeholder 시에도 본문 폰트 > 제목 폰트 관계가 유지된다', () => {
    for (const blank of ['', null, undefined]) {
      const html = buildArticleDetailHtml({ ...fullArticle, title: blank });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h1 = doc.querySelector('h1.yh-detail__title');
      expect(h1).not.toBeNull();
      expect(h1.textContent).toBe('(제목 없음)');
      const titleMatch = html.match(/\.yh-detail__title\s*\{[^}]*font-size:\s*([\d.]+)rem/);
      const contentMatch = html.match(/\.yh-detail__content\s*\{[^}]*font-size:\s*([\d.]+)rem/);
      expect(parseFloat(contentMatch[1])).toBeGreaterThan(parseFloat(titleMatch[1]));
    }
  });

  // SPEC-NEWS-REVISE-002 — AC-FONT-4: 통합 구조 회귀 (공통정보 + 기사 2섹션).
  it('AC-FONT-4: 통합 구조 + aria-label 회귀 (공통정보 → 기사)', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    const sections = Array.from(doc.querySelectorAll('body > section'));
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual(['공통정보', '기사']);
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article.querySelector('.yh-detail__title')).not.toBeNull();
    expect(article.querySelector('.yh-detail__content')).not.toBeNull();
  });
});

// SPEC-NEWS-REVISE-001 — REQ-DETAIL-LAYOUT-SPLIT
// AC-DTL-1 ~ AC-DTL-6 DOMParser-based structural assertions.
describe('REQ-DETAIL-LAYOUT-SPLIT (SPEC-NEWS-REVISE-001)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    coAuthor: '김공동',
    description: '요약 내용',
    region: '서울',
    attribute: '속보',
    keyword: '정치, 외교',
    internalComment: '내부메모',
    externalComment: '외부메모',
    attachmentFile: 'photo.jpg',
    referenceFile: 'data.csv',
    embargoAt: '2026-05-01T10:00:00Z',
    secondEmbargoAt: '2026-05-02T10:00:00Z',
  };

  function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('AC-DTL-1: 제목과 본문이 하나의 통합 기사 섹션 안에 제목 → 본문 순으로 함께 존재한다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    // 레이아웃 개편: 분리 섹션 폐지. 통합 "기사" 섹션 1개 안에 제목/본문이 함께 들어간다.
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    expect(doc.querySelectorAll('section[aria-label="제목"]').length).toBe(0);
    expect(doc.querySelectorAll('section[aria-label="본문"]').length).toBe(0);
    const titleEl = articleSections[0].querySelector('h1.yh-detail__title');
    const contentEl = articleSections[0].querySelector('.yh-detail__content');
    expect(titleEl).not.toBeNull();
    expect(contentEl).not.toBeNull();
    expect(titleEl.parentElement).toBe(contentEl.parentElement);
    expect(titleEl.compareDocumentPosition(contentEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('AC-DTL-2: 통합 기사 섹션은 시각적 분리(섹션 헤더 + border) 속성을 가진다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const articleSection = doc.querySelector('section[aria-label="기사"]');
    // 섹션 헤더 존재
    expect(articleSection.querySelector('h2.yh-detail__section-title')).not.toBeNull();
    // 공유 클래스로 시각 토큰 적용 (border + border-left blue)
    expect(articleSection.classList.contains('yh-detail__section')).toBe(true);
  });

  it('AC-DTL-3: 공통정보 섹션 내 12 필드 라벨이 모두 enumerate된다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const dts = doc.querySelectorAll('section[aria-label="공통정보"] dt');
    const labels = Array.from(dts).map((dt) => dt.textContent);
    // acceptance.md AC-DTL-3 라벨 (접두사 매칭, "엠바고"/"2차 엠바고"는 "시간" 접미사 포함 가능)
    const required = [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일',
    ];
    for (const req of required) {
      expect(labels).toContain(req);
    }
    // 엠바고 / 2차 엠바고 (시간 접미사 허용)
    expect(labels.some((l) => l === '엠바고' || l.startsWith('엠바고'))).toBe(true);
    expect(labels.some((l) => l === '2차 엠바고' || l.startsWith('2차 엠바고'))).toBe(true);
    // 정확히 12 개
    expect(dts.length).toBe(12);
  });

  it('AC-DTL-4: 빈 제목이면 placeholder "(제목 없음)" 으로 렌더링되고 통합 기사 섹션에 본문도 함께 유지', () => {
    for (const blank of ['', null, undefined]) {
      const doc = parse(buildArticleDetailHtml({ ...fullArticle, title: blank }));
      const articleSection = doc.querySelector('section[aria-label="기사"]');
      expect(articleSection).not.toBeNull();
      const h1 = articleSection.querySelector('h1.yh-detail__title');
      expect(h1).not.toBeNull();
      expect(h1.textContent).toBe('(제목 없음)');
      expect(articleSection.querySelector('.yh-detail__content')).not.toBeNull();
    }
  });

  it('AC-DTL-5: XSS 시도 토큰이 escape되어 <script>/<img> 노드가 생성되지 않는다', () => {
    const doc = parse(buildArticleDetailHtml({
      ...fullArticle,
      title: '<script>alert(1)</script>',
      content: '<img src=x onerror=alert(1)>',
    }));
    expect(doc.querySelectorAll('script').length).toBe(0);
    expect(doc.querySelectorAll('img').length).toBe(0);
    // 통합 기사 영역에 텍스트로 escape되어 표시
    const articleSection = doc.querySelector('section[aria-label="기사"]');
    expect(articleSection.textContent).toContain('<script>alert(1)</script>');
  });

  it('AC-DTL-6: 공통정보 → 기사(제목+본문 통합) 순서로 형제 섹션이 배치된다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const sections = Array.from(doc.querySelectorAll('body > section'));
    const labels = sections.map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual(['공통정보', '기사']);
  });
});

// SPEC-NEWS-REVISE-003 — REQ-DETAIL-BODY-EMPHASIS (토픽 B): 상세보기 본문 폰트 > 제목 폰트.
// 002 AC-FONT-1/3/4 와 정합하는 회귀 가드 + 003 고유 보강(빈 제목 케이스 + 분리 구조 12 필드 enumerate).
// 기존 describe 블록을 건드리지 않고 새 블록만 추가한다.
describe('SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS (토픽 B)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '테스트 제목',
    content: '테스트 본문 내용',
    author: '홍길동',
    coAuthor: '김공동',
    description: '요약 내용',
    region: '서울',
    attribute: '속보',
    keyword: '정치, 외교',
    internalComment: '내부메모',
    externalComment: '외부메모',
    attachmentFile: 'photo.jpg',
    referenceFile: 'data.csv',
    embargoAt: '2026-05-01T10:00:00Z',
    secondEmbargoAt: '2026-05-02T10:00:00Z',
  };

  // CSS 룰 텍스트에서 해당 클래스의 font-size(rem)를 추출한다.
  function fontSizeRem(html, className) {
    const re = new RegExp(`\\.${className}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem`);
    const m = html.match(re);
    return m ? parseFloat(m[1]) : null;
  }

  it('AC-EMPH-1: .yh-detail__content font-size 가 .yh-detail__title font-size 보다 크다 (CSS 룰 정규식)', () => {
    const html = buildArticleDetailHtml(fullArticle);
    const titleSize = fontSizeRem(html, 'yh-detail__title');
    const contentSize = fontSizeRem(html, 'yh-detail__content');
    expect(titleSize).not.toBeNull();
    expect(contentSize).not.toBeNull();
    expect(contentSize).toBeGreaterThan(titleSize);
  });

  it('AC-EMPH-2: jsdom getComputedStyle 비교 — 미지원 시 AC-EMPH-1 정규식 fallback (둘 중 하나는 GREEN)', () => {
    const html = buildArticleDetailHtml(fullArticle);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
    // <style>은 head에 있으므로 getComputedStyle은 jsdom에서 인라인 스타일만 반영할 수 있다.
    const titleEl = document.querySelector('.yh-detail__title');
    const contentEl = document.querySelector('.yh-detail__content');
    expect(titleEl).not.toBeNull();
    expect(contentEl).not.toBeNull();
    const px = (v) => {
      const f = parseFloat(v);
      return Number.isFinite(f) ? f : null;
    };
    const titlePx = px(getComputedStyle(titleEl).fontSize);
    const contentPx = px(getComputedStyle(contentEl).fontSize);

    const computedHolds = titlePx !== null && contentPx !== null && contentPx > titlePx;
    // Fallback: CSS 룰 정규식 비교 (R8 전략 — jsdom getComputedStyle 한계 대응).
    const regexHolds = fontSizeRem(html, 'yh-detail__content') > fontSizeRem(html, 'yh-detail__title');
    expect(computedHolds || regexHolds).toBe(true);
    // jsdom이 외부 <style>을 적용하지 않더라도 정규식 fallback은 반드시 성립한다.
    expect(regexHolds).toBe(true);
    document.body.innerHTML = '';
  });

  it('AC-EMPH-3: 빈 제목/null → "(제목 없음)" placeholder + content 폰트 > title 폰트 유지 (003 고유)', () => {
    for (const blank of ['', null]) {
      const html = buildArticleDetailHtml({ ...fullArticle, title: blank });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // 통합 "기사" 섹션이 존재하고 그 안에 placeholder가 렌더된다.
      const articleSection = doc.querySelector('section[aria-label="기사"]');
      expect(articleSection).not.toBeNull();
      const h1 = articleSection.querySelector('h1.yh-detail__title');
      expect(h1).not.toBeNull();
      expect(h1.textContent).toBe('(제목 없음)');
      // 본문도 같은 통합 영역에 함께 존재한다.
      expect(articleSection.querySelector('.yh-detail__content')).not.toBeNull();
      // placeholder 케이스에서도 폰트 관계 유지.
      expect(fontSizeRem(html, 'yh-detail__content')).toBeGreaterThan(fontSizeRem(html, 'yh-detail__title'));
    }
  });

  // SPEC-NEWS-REVISE-004 AC-GRAY-1: 003 AC-EMPH-4 의 gray-line 가드를 정확 토큰 #DDE3EC 로 정밀화.
  // 느슨한 #DD[0-9A-Fa-f]{4} 패턴이 #DD0000 같은 의도하지 않은 값까지 통과시키던 false-positive 구멍을 막는다.
  it('AC-GRAY-1 (003 AC-EMPH-4 정밀화): 분리 구조 회귀 — 제목/본문 섹션 각 1개 형제 + gray-line 정확 토큰 #DDE3EC 구분선 + 12 공통정보 dt label', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    // 통합 "기사" 섹션이 정확히 1개이며 그 안에 제목/본문이 함께 들어간다 (분리 섹션 폐지).
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    const titleEl = articleSections[0].querySelector('.yh-detail__title');
    const contentEl = articleSections[0].querySelector('.yh-detail__content');
    expect(titleEl).not.toBeNull();
    expect(contentEl).not.toBeNull();
    // 제목과 본문은 동일 부모(기사 섹션)의 형제 노드.
    expect(titleEl.parentElement).toBe(contentEl.parentElement);

    // 1px 회색 구분선. gray-line 디자인 토큰이 정확한 production 값 #DDE3EC 임을 단언한다(대소문자 무시).
    const styleText = doc.querySelector('style').textContent;
    expect(styleText).toMatch(/--yh-gray-line:\s*#DDE3EC/i);
    expect(styleText).toMatch(/1px solid var\(--yh-gray-line\)/);

    // 공통정보 섹션의 dt label 12개가 각각 정확히 한 번씩 enumerate.
    const dts = doc.querySelectorAll('section[aria-label="공통정보"] dt');
    const labels = Array.from(dts).map((dt) => dt.textContent);
    const required = [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일',
    ];
    for (const req of required) {
      expect(labels.filter((l) => l === req).length).toBe(1);
    }
    // 엠바고 / 2차 엠바고는 "시간" 접미사 포함 형태로 각 1회.
    expect(labels.filter((l) => l === '엠바고' || l.startsWith('엠바고')).length).toBe(1);
    expect(labels.filter((l) => l === '2차 엠바고' || l.startsWith('2차 엠바고')).length).toBe(1);
    expect(dts.length).toBe(12);
  });

  // SPEC-NEWS-REVISE-004 AC-GRAY-2: false-positive 제거 증명 — production 파일을 건드리지 않고
  // 정밀화 정규식과 003 의 느슨한 정규식을 샘플 문자열에 대해 직접 비교한다.
  it('AC-GRAY-2: 정밀화 정규식은 의도하지 않은 #DD0000 을 거부하고 #DDE3EC 만 수용한다(느슨한 패턴 대비 false-positive 제거 증명)', () => {
    const precise = /--yh-gray-line:\s*#DDE3EC/i;
    const loose = /--yh-gray-line:\s*#DD[0-9A-Fa-f]{4}/;

    // 정밀화 가드: 레드 계열 오변경 #DD0000 은 거부된다.
    expect(precise.test('--yh-gray-line: #DD0000')).toBe(false);
    // 대조: 003 의 느슨한 가드였다면 같은 샘플을 통과시켜 회귀를 놓쳤을 것이다(구멍 증명).
    expect(loose.test('--yh-gray-line: #DD0000')).toBe(true);
    // true-positive 보존: 정확 토큰 #DDE3EC 는 그대로 수용된다.
    expect(precise.test('--yh-gray-line: #DDE3EC')).toBe(true);
  });

  // SPEC-NEWS-REVISE-004 AC-GRAY-3: gray-line 정밀화가 003 AC-EMPH-4 의 나머지 구조 단언을 회귀시키지 않음을
  // production 출력(buildArticleDetailHtml)에 대해 재확인한다 — 제목/본문 형제 섹션 + 12 공통정보 dt label.
  //
  // [SPEC-NEWS-REVISE-006 AC-HARDEN-2 역할 명확화] 이 케이스는 AC-GRAY-1 과 구조 검증이 의도적으로
  // 중복된다. 역할은 "gray-line 토큰 정밀화(AC-GRAY-1) 이후 분리 구조(제목/본문 형제 + 12 dt label)가
  // 회귀하지 않았음을 확인하는 최소 회귀 가드" 전용이다. 실질 gray-line 가드는 AC-GRAY-1(정확 토큰
  // #DDE3EC 수용 + 오변경 거부)이 담당하며, 본 케이스는 그 정밀화의 부수효과로 구조가 깨지지 않았음만
  // 잠근다. PD1 기본값에 따라 단언 코드는 무변경(주석만 명확화)이며 삭제/통합하지 않는다.
  it('AC-GRAY-3: 정밀화 후에도 제목/본문 섹션 각 1개 형제 + 12 공통정보 dt label 구조가 회귀 없이 유지된다', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    // 통합 "기사" 섹션이 정확히 1개이며 그 안에 제목/본문이 형제로 함께 들어간다.
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    const titleEl = articleSections[0].querySelector('.yh-detail__title');
    const contentEl = articleSections[0].querySelector('.yh-detail__content');
    expect(titleEl).not.toBeNull();
    expect(contentEl).not.toBeNull();
    expect(titleEl.parentElement).toBe(contentEl.parentElement);

    // 공통정보 dt label 12개가 각각 정확히 한 번씩 enumerate.
    const dts = doc.querySelectorAll('section[aria-label="공통정보"] dt');
    const labels = Array.from(dts).map((dt) => dt.textContent);
    const required = [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일',
    ];
    for (const req of required) {
      expect(labels.filter((l) => l === req).length).toBe(1);
    }
    expect(labels.filter((l) => l === '엠바고' || l.startsWith('엠바고')).length).toBe(1);
    expect(labels.filter((l) => l === '2차 엠바고' || l.startsWith('2차 엠바고')).length).toBe(1);
    expect(dts.length).toBe(12);
  });
});

// PR-REVIEW REGRESSION (RED — pending fix):
// 폼/DB는 "내용" 입력을 `content` 키로 저장하지만 articleDetail.js의 COMMON_INFO_FIELDS는
// `description` 키에서 "내용" 행 값을 읽는다 (articleDetail.js:28). 따라서 실제 작성 흐름
// (WritePage common.content -> articleInsert -> queryArticles -> 상세보기 popup)에서 사용자가
// 입력한 "내용" 값이 공통정보 "내용" 행에 표시되지 않고 em-dash placeholder로 렌더된다.
//
// 이 테스트는 폼 데이터 형태로 article을 구성하고 (description 키 없음, content 키만 있음)
// 공통정보 "내용" 행이 form-input 값을 표시할 것을 단언한다. 현재 production 동작은 placeholder
// "—"를 표시하므로 RED. 수정 시 articleDetail.js의 COMMON_INFO_FIELDS에서 'description' -> 'content'
// 또는 readField에 description<->content alias 추가 필요.
describe('REGRESSION (RED): 공통정보 "내용" 행은 form/DB의 content 필드와 매핑되어야 한다', () => {
  it.fails('content 필드 값이 공통정보 "내용" 행에 표시되어야 한다 (현재 description만 인식)', () => {
    // 폼 흐름의 데이터: WritePage common.content -> articleInsert -> DB row 형태
    const formArticle = {
      articleId: 'A-FORM',
      title: '제목',
      content: '본문은 별도지만 "내용" 입력 필드 값',
      // description 키 자체가 존재하지 않음 (폼/DB가 만들지 않음)
    };
    const html = buildArticleDetailHtml(formArticle);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('section[aria-label="공통정보"] .yh-detail__row');
    // "내용" 라벨의 dd 텍스트
    let contentRowText = null;
    for (const row of rows) {
      const dt = row.querySelector('dt');
      if (dt && dt.textContent === '내용') {
        contentRowText = row.querySelector('dd')?.textContent ?? null;
        break;
      }
    }
    // 기대: form-input 값이 공통정보 "내용" 행에 표시 (현재는 em-dash로 placeholder됨)
    expect(contentRowText).toBe('본문은 별도지만 "내용" 입력 필드 값');
  });
});
