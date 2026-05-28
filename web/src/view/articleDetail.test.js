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

describe('buildArticleDetailHtml (news.md: 제목, 내용, 공통정보)', () => {
  const article = {
    articleId: 'A-1',
    title: '속보 제목',
    content: '기사 본문 내용입니다.',
    author: '홍길동',
    modifier: '김수정',
    sender: '이송고',
    department: 'Politics',
    departmentCode: 'POL',
    createdAt: '2026-05-01T08:00:00Z',
    status: 'RDS',
  };

  it('includes the title, content, and 공통정보 section header', () => {
    const html = buildArticleDetailHtml(article);
    expect(html).toContain('속보 제목');
    expect(html).toContain('기사 본문 내용입니다.');
    expect(html).toContain('공통정보');
  });

  it('renders present common-info fields with their Korean labels', () => {
    const html = buildArticleDetailHtml(article);
    expect(html).toContain('작성자');
    expect(html).toContain('홍길동');
    expect(html).toContain('수정자');
    expect(html).toContain('김수정');
    expect(html).toContain('상태값');
    expect(html).toContain('RDS');
  });

  it('omits common-info fields that are absent', () => {
    const html = buildArticleDetailHtml(article);
    // editedAt / sentAt were not provided -> their labels must not appear
    expect(html).not.toContain('수정시간');
    expect(html).not.toContain('송고시간');
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
