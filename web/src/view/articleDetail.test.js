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
//   하단 = 기사 (본문만; SPEC-NEWS-REVISE-013 으로 별도 제목 요소 폐지, 본문 첫 줄이 제목)
describe('buildArticleDetailHtml (news.md 상세보기)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    coAuthor: '김공동',
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

  it('renders the article body in the bottom section and the title in <head>', () => {
    const html = buildArticleDetailHtml(fullArticle);
    // 제목은 <head><title> 에만 (별도 제목 요소 폐지), 본문은 기사 섹션에.
    expect(html).toContain('<title>속보 제목</title>');
    expect(html).toContain('기사 본문 내용입니다.');
  });

  // SPEC-NEWS-REVISE-013 AC-NOTITLE-4(3): 별도 제목 요소(<h1>) 폐지 후, 섹션 순서는
  // 공통정보 섹션이 기사 섹션보다 먼저 옴으로 단언한다 (이전 <h1> 위치 기준 비교를 대체).
  it('renders the 공통정보 section before the 기사 section', () => {
    const html = buildArticleDetailHtml(fullArticle);
    const body = html.slice(html.indexOf('<body>'));
    const infoIdx = body.indexOf('aria-label="공통정보"');
    const articleIdx = body.indexOf('aria-label="기사"');
    expect(infoIdx).toBeGreaterThan(-1);
    expect(articleIdx).toBeGreaterThan(-1);
    expect(infoIdx).toBeLessThan(articleIdx);
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
      '홍길동', '김공동', '기사 본문 내용입니다.', '서울', '속보', '정치, 외교',
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

  // SPEC-NEWS-REVISE-013 AC-NOTITLE-1/2: 별도 제목 요소(.yh-detail__title/<h1>)를 폐지하고,
  // 기사 섹션은 본문(.yh-detail__content)만 렌더한다 (본문 첫 줄이 제목 역할).
  it('renders 본문 only in the 기사 section with NO separate title element', () => {
    const html = buildArticleDetailHtml(fullArticle);
    expect(html).toContain('aria-label="공통정보"');
    expect(html).toContain('aria-label="기사"');
    expect(html).not.toContain('aria-label="제목"');
    expect(html).not.toContain('aria-label="본문"');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article).not.toBeNull();
    // AC-NOTITLE-1: 기사 섹션 안에 별도 제목 요소가 하나도 없다.
    expect(article.querySelector('.yh-detail__title')).toBeNull();
    expect(article.querySelector('h1')).toBeNull();
    // AC-NOTITLE-2: 본문 요소는 정확히 1개 존재한다.
    expect(article.querySelectorAll('.yh-detail__content').length).toBe(1);
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

  // SPEC-NEWS-REVISE-013 AC-NOTITLE-1/3 (002 AC-FONT-1 폐지 대체): 본문>제목 폰트 비교 폐지.
  // 별도 제목 요소가 없음을 단언하고, 본문(.yh-detail__content) 존재만 확인한다.
  it('AC-NOTITLE: 별도 제목 요소가 없고 본문 요소만 존재한다 (002 AC-FONT-1 대체)', () => {
    const html = buildArticleDetailHtml(fullArticle);
    expect(html).not.toMatch(/\.yh-detail__title\s*\{/);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article.querySelector('.yh-detail__title')).toBeNull();
    expect(article.querySelector('h1')).toBeNull();
    expect(article.querySelector('.yh-detail__content')).not.toBeNull();
  });

  // SPEC-NEWS-REVISE-013 AC-NOTITLE-3 (002 AC-FONT-3 폐지 대체): 빈 제목 시 placeholder
  // 요소를 생성하지 않으며, (제목 없음) 은 <head><title> 에만 잔존한다.
  it('AC-NOTITLE-3: 빈/누락 제목 시 placeholder 제목 요소 미생성, <head><title>=(제목 없음) (002 AC-FONT-3 대체)', () => {
    for (const blank of ['', null, undefined]) {
      const html = buildArticleDetailHtml({ ...fullArticle, title: blank });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const article = doc.querySelector('section[aria-label="기사"]');
      // 기사 섹션에 제목 요소(placeholder 포함)가 생성되지 않는다.
      expect(article.querySelector('h1.yh-detail__title')).toBeNull();
      expect(article.querySelector('.yh-detail__title')).toBeNull();
      expect(article.querySelector('h1')).toBeNull();
      // 본문은 그대로 존재.
      expect(article.querySelector('.yh-detail__content')).not.toBeNull();
      // (제목 없음) 은 <head><title> 에만 잔존.
      expect(doc.querySelector('title').textContent).toBe('(제목 없음)');
    }
  });
});

// SPEC-NEWS-REVISE-001 — REQ-DETAIL-LAYOUT-SPLIT
// [SUPERSEDED by SPEC-NEWS-REVISE-013] 별도 제목 요소 폐지. 제목 요소 존재 단언은
// AC-NOTITLE-* 로 대체했고, 공통정보 12 dt / 섹션 순서 / escape 회귀 가드는 유지한다.
describe('REQ-DETAIL-LAYOUT-SPLIT (SPEC-NEWS-REVISE-001)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    coAuthor: '김공동',
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

  // AC-DTL-1 → SPEC-010 AC-NOTITLE-1/2 대체: 통합 기사 섹션 1개, 별도 제목 요소 부재, 본문 존재.
  it('AC-DTL-1 (SPEC-010 대체): 단일 기사 섹션에 별도 제목 요소 없이 본문만 존재한다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    expect(doc.querySelectorAll('section[aria-label="제목"]').length).toBe(0);
    expect(doc.querySelectorAll('section[aria-label="본문"]').length).toBe(0);
    // 별도 제목 요소 부재.
    expect(articleSections[0].querySelector('h1.yh-detail__title')).toBeNull();
    expect(articleSections[0].querySelector('.yh-detail__title')).toBeNull();
    expect(articleSections[0].querySelector('h1')).toBeNull();
    // 본문은 존재.
    expect(articleSections[0].querySelector('.yh-detail__content')).not.toBeNull();
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

  // AC-DTL-4 → SPEC-010 AC-NOTITLE-3/EC-1 대체: 빈 제목 placeholder 요소 미생성 + 본문 유지.
  it('AC-DTL-4 (SPEC-010 대체): 빈 제목이어도 placeholder 제목 요소 미생성, 본문은 유지', () => {
    for (const blank of ['', null, undefined]) {
      const doc = parse(buildArticleDetailHtml({ ...fullArticle, title: blank }));
      const articleSection = doc.querySelector('section[aria-label="기사"]');
      expect(articleSection).not.toBeNull();
      // placeholder 제목 요소가 기사 섹션에 생성되지 않는다.
      expect(articleSection.querySelector('h1.yh-detail__title')).toBeNull();
      expect(articleSection.querySelector('.yh-detail__title')).toBeNull();
      // 본문은 함께 유지.
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
    expect(articleSection.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('AC-DTL-6: 공통정보 → 기사 순서로 형제 섹션이 배치된다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const sections = Array.from(doc.querySelectorAll('body > section'));
    const labels = sections.map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual(['공통정보', '기사']);
  });
});

// SPEC-NEWS-REVISE-003 — REQ-DETAIL-BODY-EMPHASIS (토픽 B)
// [SUPERSEDED by SPEC-NEWS-REVISE-013] 본문>제목 폰트 강조 비교 폐지(별도 제목 요소 제거).
// 제목 요소 부재 + 본문 존재 회귀 가드로 대체하고, gray-line/12 dt/형제 구조 가드는 유지한다.
describe('SPEC-NEWS-REVISE-003 REQ-DETAIL-BODY-EMPHASIS (토픽 B)', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '테스트 제목',
    content: '테스트 본문 내용',
    author: '홍길동',
    coAuthor: '김공동',
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

  // AC-EMPH-1 → SPEC-010 AC-NOTITLE-1 대체: 폰트 비교 폐지. 제목 CSS 규칙/요소 부재 단언.
  it('AC-EMPH-1 (SPEC-010 대체): .yh-detail__title CSS 규칙도, 제목 요소도 존재하지 않는다', () => {
    const html = buildArticleDetailHtml(fullArticle);
    // 미사용 제목 CSS 규칙이 제거되었다.
    expect(html).not.toMatch(/\.yh-detail__title\s*\{/);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article.querySelector('.yh-detail__title')).toBeNull();
    expect(article.querySelector('h1')).toBeNull();
    // 본문 존재.
    expect(article.querySelector('.yh-detail__content')).not.toBeNull();
  });

  // AC-EMPH-2 → SPEC-010 AC-NOTITLE-2 대체: getComputedStyle 폰트 비교 폐지.
  // 본문 요소만 DOM 에 마운트되고 제목 요소는 없음을 확인한다.
  it('AC-EMPH-2 (SPEC-010 대체): 마운트된 기사 본문 요소만 존재하고 제목 요소는 없다', () => {
    const html = buildArticleDetailHtml(fullArticle);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
    const titleEl = document.querySelector('.yh-detail__title');
    const contentEl = document.querySelector('.yh-detail__content');
    expect(titleEl).toBeNull();
    expect(contentEl).not.toBeNull();
    document.body.innerHTML = '';
  });

  // AC-EMPH-3 → SPEC-010 AC-NOTITLE-3/EC-1 대체: 빈 제목 placeholder 요소 미생성 + 본문 유지.
  it('AC-EMPH-3 (SPEC-010 대체): 빈/null 제목 → placeholder 제목 요소 미생성, 본문은 유지', () => {
    for (const blank of ['', null]) {
      const html = buildArticleDetailHtml({ ...fullArticle, title: blank });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const articleSection = doc.querySelector('section[aria-label="기사"]');
      expect(articleSection).not.toBeNull();
      expect(articleSection.querySelector('h1.yh-detail__title')).toBeNull();
      expect(articleSection.querySelector('.yh-detail__title')).toBeNull();
      // 본문도 같은 통합 영역에 함께 존재한다.
      expect(articleSection.querySelector('.yh-detail__content')).not.toBeNull();
      // (제목 없음) 은 <head><title> 에만 잔존.
      expect(doc.querySelector('title').textContent).toBe('(제목 없음)');
    }
  });

  // SPEC-NEWS-REVISE-004 AC-GRAY-1 → SPEC-010 AC-NOTITLE-4 계승: 제목 요소 전제만 제거하고,
  // gray-line 정확 토큰 #DDE3EC + 12 공통정보 dt label 회귀 가드는 유지한다.
  it('AC-GRAY-1 (SPEC-010 대체): gray-line 정확 토큰 #DDE3EC 구분선 + 12 공통정보 dt label + 본문 존재', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    // 통합 "기사" 섹션이 정확히 1개이며 그 안에 본문이 들어간다 (별도 제목 요소 폐지).
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    expect(articleSections[0].querySelector('.yh-detail__title')).toBeNull();
    expect(articleSections[0].querySelector('h1')).toBeNull();
    expect(articleSections[0].querySelector('.yh-detail__content')).not.toBeNull();

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
  // 정밀화 정규식과 003 의 느슨한 정규식을 샘플 문자열에 대해 직접 비교한다. (제목과 무관, 보존)
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

  // SPEC-NEWS-REVISE-004 AC-GRAY-3 → SPEC-010 AC-NOTITLE-4 계승: 제목 요소 전제만 제거하고,
  // 공통정보↔기사 형제 구조 + 12 공통정보 dt label 회귀 가드는 유지한다.
  it('AC-GRAY-3 (SPEC-010 대체): 공통정보→기사 형제 구조 + 12 공통정보 dt label + 본문 존재가 회귀 없이 유지된다', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    // 통합 "기사" 섹션이 정확히 1개이며 별도 제목 요소 없이 본문만 들어간다.
    const articleSections = doc.querySelectorAll('section[aria-label="기사"]');
    expect(articleSections.length).toBe(1);
    expect(articleSections[0].querySelector('.yh-detail__title')).toBeNull();
    expect(articleSections[0].querySelector('h1')).toBeNull();
    expect(articleSections[0].querySelector('.yh-detail__content')).not.toBeNull();

    // 공통정보 섹션과 기사 섹션은 동일 부모의 형제이며 공통정보가 먼저 온다.
    const sections = Array.from(doc.querySelectorAll('body > section'));
    const labels = sections.map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual(['공통정보', '기사']);

    // 공통정보 dt label 12개가 각각 정확히 한 번씩 enumerate.
    const dts = doc.querySelectorAll('section[aria-label="공통정보"] dt');
    const dtLabels = Array.from(dts).map((dt) => dt.textContent);
    const required = [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일',
    ];
    for (const req of required) {
      expect(dtLabels.filter((l) => l === req).length).toBe(1);
    }
    expect(dtLabels.filter((l) => l === '엠바고' || l.startsWith('엠바고')).length).toBe(1);
    expect(dtLabels.filter((l) => l === '2차 엠바고' || l.startsWith('2차 엠바고')).length).toBe(1);
    expect(dts.length).toBe(12);
  });
});

// 과업 ③ — 상세보기 '기사' 본문을 markupVersion(에디터 직렬화 JSON)을 파싱한 실제 본문으로 렌더한다.
// content(공통정보 "내용")가 아니라 markupVersion 의 블록(텍스트 + 이미지/영상/기사 임베드)을 순서대로 표시.
describe('상세보기 본문 = markupVersion 실제 본문 + 임베드 (과업 ③)', () => {
  // editorContent.serializeContent 와 동일한 포맷 — 테스트에서 직접 markup 문자열을 만든다.
  function markup(blocks) {
    return JSON.stringify({ format: 'yh-editor', version: 1, blocks });
  }

  function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('텍스트 → 이미지 임베드 → "(끝)" 순서를 그대로 보존해 렌더한다', () => {
    const article = {
      title: '제목',
      content: '짧은 리드(공통정보 내용)',
      markupVersion: markup([
        { type: 'text', text: '본문 첫 문단입니다.' },
        { type: 'embed', embed: { type: 'image', title: '현장', url: 'https://u/1', thumbnailUrl: 'https://t/1' } },
        { type: 'text', text: '(끝)' },
      ]),
    };
    const doc = parse(buildArticleDetailHtml(article));
    const content = doc.querySelector('section[aria-label="기사"] .yh-detail__content');
    expect(content).not.toBeNull();
    // 본문 텍스트가 공통정보 "내용"이 아니라 markupVersion 텍스트 블록에서 온다.
    expect(content.textContent).toContain('본문 첫 문단입니다.');
    expect(content.textContent).toContain('(끝)');
    // 이미지 임베드는 <img> 로 렌더 (thumbnailUrl 우선).
    const img = content.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://t/1');
    // 블록 순서 보존: 텍스트 → 이미지 → (끝).
    const text = content.textContent;
    expect(text.indexOf('본문 첫 문단입니다.')).toBeLessThan(text.indexOf('(끝)'));
    const imgPos = content.innerHTML.indexOf('<img');
    expect(content.innerHTML.indexOf('본문 첫 문단입니다.')).toBeLessThan(imgPos);
    expect(imgPos).toBeLessThan(content.innerHTML.lastIndexOf('(끝)'));
  });

  it('이미지 임베드 thumbnailUrl 없으면 url 로 폴백한다', () => {
    const article = {
      title: 't', content: 'c',
      markupVersion: markup([{ type: 'embed', embed: { type: 'image', url: 'https://only/url' } }]),
    };
    const doc = parse(buildArticleDetailHtml(article));
    const img = doc.querySelector('section[aria-label="기사"] img');
    expect(img.getAttribute('src')).toBe('https://only/url');
  });

  it('영상 임베드는 썸네일 + 제목/링크로 렌더한다', () => {
    const article = {
      title: 't', content: 'c',
      markupVersion: markup([
        { type: 'embed', embed: { type: 'video', title: '현장 영상', url: 'https://yt/v', thumbnailUrl: 'https://t/v' } },
      ]),
    };
    const html = buildArticleDetailHtml(article);
    const doc = parse(html);
    const article뷰 = doc.querySelector('section[aria-label="기사"]');
    expect(article뷰.querySelector('img').getAttribute('src')).toBe('https://t/v');
    expect(article뷰.textContent).toContain('현장 영상');
    const link = article뷰.querySelector('a');
    expect(link.getAttribute('href')).toBe('https://yt/v');
  });

  it('기사(article) 임베드는 제목 카드로 렌더한다', () => {
    const article = {
      title: 't', content: 'c',
      markupVersion: markup([{ type: 'embed', embed: { type: 'article', articleId: 'A-77', title: '폭우 피해' } }]),
    };
    const doc = parse(buildArticleDetailHtml(article));
    const section = doc.querySelector('section[aria-label="기사"]');
    expect(section.textContent).toContain('폭우 피해');
  });

  it('임베드 동적 텍스트/URL 을 escape 한다 (XSS 방지)', () => {
    const article = {
      title: 't', content: 'c',
      markupVersion: markup([
        { type: 'text', text: '<img src=x onerror=alert(1)>' },
        { type: 'embed', embed: { type: 'video', title: '<script>bad</script>', url: 'https://"x' } },
      ]),
    };
    const doc = parse(buildArticleDetailHtml(article));
    // 본문 텍스트의 위험 토큰은 노드로 생성되지 않는다.
    const section = doc.querySelector('section[aria-label="기사"]');
    expect(section.querySelectorAll('script').length).toBe(0);
    // onerror 이미지가 실제 img 노드로 생성되지 않는다(텍스트 블록은 escape).
    // (임베드 영상 썸네일 img 는 없을 수 있으나, 위험 텍스트가 attribute 로 새지 않음을 확인)
    expect(section.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(section.textContent).toContain('<script>bad</script>');
  });

  it('markupVersion 이 없거나 빈 레거시 기사는 content 로 폴백한다 (깨지지 않음)', () => {
    for (const mv of [undefined, '', null]) {
      const article = { title: 't', content: '레거시 본문', markupVersion: mv };
      const doc = parse(buildArticleDetailHtml(article));
      const content = doc.querySelector('section[aria-label="기사"] .yh-detail__content');
      expect(content).not.toBeNull();
      expect(content.textContent).toContain('레거시 본문');
    }
  });

  it('공통정보 "내용" 행은 여전히 content(짧은 리드)를 표시한다 (본문과 독립)', () => {
    const article = {
      title: 't',
      content: '짧은 리드',
      markupVersion: markup([{ type: 'text', text: '진짜 본문' }]),
    };
    const doc = parse(buildArticleDetailHtml(article));
    // 공통정보 "내용" = content.
    const rows = doc.querySelectorAll('section[aria-label="공통정보"] .yh-detail__row');
    let 내용 = null;
    for (const row of rows) {
      if (row.querySelector('dt')?.textContent === '내용') {
        내용 = row.querySelector('dd')?.textContent ?? null;
        break;
      }
    }
    expect(내용).toBe('짧은 리드');
    // 기사 본문 = markupVersion.
    const body = doc.querySelector('section[aria-label="기사"] .yh-detail__content').textContent;
    expect(body).toContain('진짜 본문');
    expect(body).not.toContain('짧은 리드');
  });
});

// REGRESSION FIX: 공통정보 "내용" 행은 form/DB의 content 필드와 매핑된다.
// articleDetail.js COMMON_INFO_FIELDS에서 'description' -> 'content' 키로 수정하여 해소.
describe('REGRESSION FIX: 공통정보 "내용" 행은 form/DB의 content 필드와 매핑되어야 한다', () => {
  it('content 필드 값이 공통정보 "내용" 행에 표시된다', () => {
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
    // form-input 값이 공통정보 "내용" 행에 표시된다
    expect(contentRowText).toBe('본문은 별도지만 "내용" 입력 필드 값');
  });
});

// SPEC-NEWS-REVISE-013 회귀 가드 — 별도 제목 요소 폐지 불변식.
describe('SPEC-NEWS-REVISE-013 REQ-DETAIL-NO-SEPARATE-TITLE 회귀 가드', () => {
  const fullArticle = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    coAuthor: '김공동',
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

  // AC-NOTITLE-1: 기사 섹션 내 h1 / .yh-detail__title 가 정확히 0개.
  it('AC-NOTITLE-1: 기사 섹션 내 h1·.yh-detail__title 요소가 정확히 0개다', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    expect(doc.querySelectorAll('section[aria-label="기사"] h1').length).toBe(0);
    expect(doc.querySelectorAll('section[aria-label="기사"] .yh-detail__title').length).toBe(0);
  });

  // 미사용 .yh-detail__title CSS 규칙이 스타일시트에서 제거되었음을 잠근다.
  it('미사용 .yh-detail__title CSS 규칙이 제거되었다', () => {
    const html = buildArticleDetailHtml(fullArticle);
    expect(html).not.toMatch(/\.yh-detail__title\s*\{/);
  });

  // AC-NOTITLE-2: 본문(.yh-detail__content) 요소가 정확히 1개.
  it('AC-NOTITLE-2: 기사 섹션 내 .yh-detail__content 요소가 정확히 1개다', () => {
    const doc = new DOMParser().parseFromString(buildArticleDetailHtml(fullArticle), 'text/html');
    expect(doc.querySelectorAll('section[aria-label="기사"] .yh-detail__content').length).toBe(1);
  });

  // AC-NOTITLE-3: <head><title> 폴백 — title 있으면 escape, 없으면 (제목 없음).
  it('AC-NOTITLE-3: <head><title> 은 title 채워지면 escape, 비면 (제목 없음) 으로 유지', () => {
    const filled = new DOMParser()
      .parseFromString(buildArticleDetailHtml({ ...fullArticle, title: '<b>제목</b>' }), 'text/html');
    expect(filled.querySelector('title').textContent).toBe('<b>제목</b>');

    for (const blank of ['', null, undefined]) {
      const doc = new DOMParser()
        .parseFromString(buildArticleDetailHtml({ ...fullArticle, title: blank }), 'text/html');
      expect(doc.querySelector('title').textContent).toBe('(제목 없음)');
    }
  });

  // EC-2: 레거시(markupVersion 없음) — 제목 요소 부재 + content 폴백 본문.
  it('EC-2: markupVersion 없는 레거시도 제목 요소 부재 + content 폴백 본문을 렌더한다', () => {
    const doc = new DOMParser().parseFromString(
      buildArticleDetailHtml({ title: 't', content: '레거시 본문', markupVersion: undefined }),
      'text/html',
    );
    const article = doc.querySelector('section[aria-label="기사"]');
    expect(article.querySelector('h1')).toBeNull();
    expect(article.querySelector('.yh-detail__title')).toBeNull();
    expect(article.querySelector('.yh-detail__content').textContent).toContain('레거시 본문');
  });
});
