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

  it('renders 제목 and 본문 in separate sections (news.md 분리해서 보여준다)', () => {
    const html = buildArticleDetailHtml(fullArticle);
    // Each section is its own <section> with an aria-label
    expect(html).toContain('aria-label="공통정보"');
    expect(html).toContain('aria-label="제목"');
    expect(html).toContain('aria-label="본문"');
    // Order: 공통정보 → 제목 → 본문
    const body = html.slice(html.indexOf('<body>'));
    const infoIdx = body.indexOf('aria-label="공통정보"');
    const titleIdx = body.indexOf('aria-label="제목"');
    const contentIdx = body.indexOf('aria-label="본문"');
    expect(infoIdx).toBeGreaterThan(-1);
    expect(infoIdx).toBeLessThan(titleIdx);
    expect(titleIdx).toBeLessThan(contentIdx);
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

  it('AC-DTL-1: 제목 섹션과 본문 섹션이 각각 1개씩 분리되어 존재한다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const titleSections = doc.querySelectorAll('section[aria-label="제목"]');
    const bodySections = doc.querySelectorAll('section[aria-label="본문"]');
    expect(titleSections.length).toBe(1);
    expect(bodySections.length).toBe(1);
    // 형제 노드 검증: 동일 부모 + 사이에 다른 콘텐츠 섹션 없음 (공통정보 외).
    expect(titleSections[0].parentElement).toBe(bodySections[0].parentElement);
    // 제목 다음 형제(공백 텍스트 노드 무시)가 본문 섹션이어야 한다.
    let next = titleSections[0].nextElementSibling;
    expect(next).toBe(bodySections[0]);
  });

  it('AC-DTL-2: 두 섹션은 시각적 분리(섹션 헤더 + border) 속성을 가진다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const titleSection = doc.querySelector('section[aria-label="제목"]');
    const bodySection = doc.querySelector('section[aria-label="본문"]');
    // 섹션 헤더 존재
    expect(titleSection.querySelector('h2.yh-detail__section-title')).not.toBeNull();
    expect(bodySection.querySelector('h2.yh-detail__section-title')).not.toBeNull();
    // 공유 클래스로 시각 토큰 적용 (border + border-left blue)
    expect(titleSection.classList.contains('yh-detail__section')).toBe(true);
    expect(bodySection.classList.contains('yh-detail__section')).toBe(true);
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

  it('AC-DTL-4: 빈 제목이면 placeholder "(제목 없음)" 으로 렌더링되고 본문 섹션은 별도 유지', () => {
    for (const blank of ['', null, undefined]) {
      const doc = parse(buildArticleDetailHtml({ ...fullArticle, title: blank }));
      const titleSection = doc.querySelector('section[aria-label="제목"]');
      const bodySection = doc.querySelector('section[aria-label="본문"]');
      expect(titleSection).not.toBeNull();
      expect(bodySection).not.toBeNull();
      const h1 = titleSection.querySelector('h1.yh-detail__title');
      expect(h1).not.toBeNull();
      expect(h1.textContent).toBe('(제목 없음)');
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
    // 본문 영역에 텍스트로 escape되어 표시
    const titleSection = doc.querySelector('section[aria-label="제목"]');
    expect(titleSection.textContent).toContain('<script>alert(1)</script>');
  });

  it('AC-DTL-6: 공통정보 → 제목 → 본문 순서로 형제 섹션이 배치된다', () => {
    const doc = parse(buildArticleDetailHtml(fullArticle));
    const sections = Array.from(doc.querySelectorAll('body > section'));
    const labels = sections.map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual(['공통정보', '제목', '본문']);
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
