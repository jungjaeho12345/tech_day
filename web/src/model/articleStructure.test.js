import { describe, it, expect } from 'vitest';
import { parseArticleStructure } from './articleStructure.js';

// SPEC-UI-EDITOR-001 — REQ-EDIT-PARSE-001..005. Pure parser unit tests.
// Parsing rule = 후보 A (blank-line block separation), confirmed in plan.md §4.

describe('parseArticleStructure (REQ-EDIT-PARSE)', () => {
  it('AC-1: splits title/subtitle/body at the first blank line (후보 A)', () => {
    const input = [
      '속보 제목입니다',
      '부제목 첫째 줄',
      '부제목 둘째 줄',
      '',
      '본문 첫 문단입니다.',
      '본문 둘째 문단입니다.',
    ].join('\n');
    const result = parseArticleStructure(input);
    expect(result).toEqual({
      title: '속보 제목입니다',
      subtitle: '부제목 첫째 줄\n부제목 둘째 줄',
      body: '본문 첫 문단입니다.\n본문 둘째 문단입니다.',
    });
  });

  it('AC-1: is a pure function — same input yields the same result', () => {
    const input = '제목\n부제목\n\n본문';
    expect(parseArticleStructure(input)).toEqual(parseArticleStructure(input));
  });

  it('EC-1: title-only single line -> title set, subtitle/body empty, no error', () => {
    const result = parseArticleStructure('제목만 있음');
    expect(result).toEqual({ title: '제목만 있음', subtitle: '', body: '' });
  });

  it('EC-2: title + subtitle only (no body after blank line) -> body empty', () => {
    const input = '제목줄\n부제목1\n부제목2\n';
    const result = parseArticleStructure(input);
    expect(result.title).toBe('제목줄');
    expect(result.subtitle).toBe('부제목1\n부제목2');
    expect(result.body).toBe('');
  });

  it('EC-2: fully empty input -> all empty, no error', () => {
    expect(parseArticleStructure('')).toEqual({ title: '', subtitle: '', body: '' });
  });

  it('EC-4a: no blank line, 6 lines -> lines 2-5 subtitle, line 6 body', () => {
    const input = ['제목줄', '줄2', '줄3', '줄4', '줄5', '줄6'].join('\n');
    const result = parseArticleStructure(input);
    expect(result).toEqual({
      title: '제목줄',
      subtitle: '줄2\n줄3\n줄4\n줄5',
      body: '줄6',
    });
  });

  it('EC-4b: blank line is the subtitle/body boundary', () => {
    const input = ['제목줄', '부제목1', '부제목2', '', '본문줄1', '본문줄2'].join('\n');
    const result = parseArticleStructure(input);
    expect(result).toEqual({
      title: '제목줄',
      subtitle: '부제목1\n부제목2',
      body: '본문줄1\n본문줄2',
    });
  });

  it('EC-4b: title immediately followed by blank line -> empty subtitle, rest is body', () => {
    const input = '제목\n\n본문1\n본문2';
    const result = parseArticleStructure(input);
    expect(result.title).toBe('제목');
    expect(result.subtitle).toBe('');
    expect(result.body).toBe('본문1\n본문2');
  });

  it('EC-4b: subtitle candidate lines exceeding 4 are capped at 4 (2nd-5th), rest is body', () => {
    // 6 subtitle-candidate lines before the first blank line.
    const input = ['제목', 's2', 's3', 's4', 's5', 's6', '', '본문'].join('\n');
    const result = parseArticleStructure(input);
    expect(result.title).toBe('제목');
    expect(result.subtitle).toBe('s2\ns3\ns4\ns5');
    // Everything after the first blank line is body (line s6 was before the blank line and is dropped from subtitle cap).
    expect(result.body).toBe('본문');
  });

  it('no blank line, fewer than 6 lines -> subtitle takes 2nd-5th available, body empty', () => {
    const input = ['제목', '줄2', '줄3'].join('\n');
    const result = parseArticleStructure(input);
    expect(result).toEqual({ title: '제목', subtitle: '줄2\n줄3', body: '' });
  });
});
