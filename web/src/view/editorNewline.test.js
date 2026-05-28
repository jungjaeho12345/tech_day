import { describe, it, expect } from 'vitest';
import { insertNewlineAt } from './editorNewline.js';

describe('insertNewlineAt (pure newline splice for the body editor)', () => {
  it('splices a "\\n" at an interior offset', () => {
    // "ab|cd" -> "ab\ncd"
    expect(insertNewlineAt('abcd', 2)).toBe('ab\ncd');
  });

  it('inserts at the start when offset is 0', () => {
    expect(insertNewlineAt('abcd', 0)).toBe('\nabcd');
  });

  it('inserts at the end when offset equals the length', () => {
    expect(insertNewlineAt('abcd', 4)).toBe('abcd\n');
  });

  it('treats a null offset as the end of the text', () => {
    expect(insertNewlineAt('abcd', null)).toBe('abcd\n');
    expect(insertNewlineAt('abcd', undefined)).toBe('abcd\n');
  });

  it('clamps an out-of-range offset to [0, length]', () => {
    expect(insertNewlineAt('abcd', 99)).toBe('abcd\n');
    expect(insertNewlineAt('abcd', -5)).toBe('\nabcd');
  });

  it('handles an empty string (newline only)', () => {
    expect(insertNewlineAt('', 0)).toBe('\n');
    expect(insertNewlineAt('', null)).toBe('\n');
  });

  it('coerces a non-string source to empty', () => {
    expect(insertNewlineAt(undefined, 0)).toBe('\n');
  });

  it('splices a "\\n" between multi-line content (title/subtitle/body model)', () => {
    // Caret after "제목\n부제" (offset 6) -> a new line opens before "본문".
    const text = '제목\n부제\n본문';
    // offsets: 제(0)목(1)\n(2)... actually count code units: '제목'=2, '\n'=1, '부제'=2 => offset 5 is end of 부제
    expect(insertNewlineAt(text, 5)).toBe('제목\n부제\n\n본문');
  });
});
