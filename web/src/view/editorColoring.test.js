import { describe, it, expect } from 'vitest';
import { buildColorSegments } from './editorColoring.js';

// news.md 기사 에디터: 제목 파란색 / 부제목 빨간색 / 본문 검정색, Alt+Y "(끝)" 골드색.
// buildColorSegments is pure & deterministic; it maps body text to colored segments (presentation only).

// Concatenating all segment text must reconstruct the original input exactly (no data loss / no extra chars).
function rebuild(segments) {
  return segments.map((s) => s.text).join('');
}

describe('buildColorSegments (role-based editor coloring)', () => {
  it('empty text yields no segments', () => {
    expect(buildColorSegments('')).toEqual([]);
  });

  it('line 1 = title (파란색 → cls "title")', () => {
    const segs = buildColorSegments('헤드라인');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ text: '헤드라인', cls: 'title' });
  });

  it('후보 A: line1 title, lines 2..(first blank) subtitle, rest body', () => {
    const segs = buildColorSegments('제목\n부제목1\n부제목2\n\n본문1\n본문2');
    const byRole = (cls) => segs.filter((s) => !s.newline && s.cls === cls).map((s) => s.text);
    expect(byRole('title')).toEqual(['제목']);
    expect(byRole('subtitle')).toEqual(['부제목1', '부제목2']);
    expect(byRole('body')).toEqual(['본문1', '본문2']);
  });

  it('subtitle is capped at 4 lines when there is no blank line', () => {
    const segs = buildColorSegments('T\ns1\ns2\ns3\ns4\nb1\nb2');
    const subtitles = segs.filter((s) => !s.newline && s.cls === 'subtitle').map((s) => s.text);
    expect(subtitles).toEqual(['s1', 's2', 's3', 's4']);
    const body = segs.filter((s) => !s.newline && s.cls === 'body').map((s) => s.text);
    expect(body).toEqual(['b1', 'b2']);
  });

  it('trailing "(끝)" is a distinct gold segment (cls "end")', () => {
    const segs = buildColorSegments('제목\n본문(끝)');
    const end = segs.find((s) => s.cls === 'end');
    expect(end).toBeDefined();
    expect(end.text).toBe('(끝)');
  });

  it('Alt+Y form "\\n (끝)": the marker on its own line is still a gold "(끝)" segment', () => {
    // news.md: Alt+Y inserts "\n (끝)" — the preceding newline is an ordinary line break, the "(끝)" is gold.
    const segs = buildColorSegments('제목\n본문\n (끝)');
    const end = segs.find((s) => s.cls === 'end');
    expect(end).toBeDefined();
    expect(end.text).toBe('(끝)');
    // The text is reconstructed exactly (newline + space preserved).
    expect(segs.map((s) => s.text).join('')).toBe('제목\n본문\n (끝)');
  });

  it('reconstructs the original text exactly (character-preserving)', () => {
    const inputs = [
      '제목\n부제목\n\n본문',
      'T\ns1\ns2\ns3\ns4\nb1',
      '제목\n본문(끝)',
      'one line',
    ];
    for (const input of inputs) {
      expect(rebuild(buildColorSegments(input))).toBe(input);
    }
  });
});
