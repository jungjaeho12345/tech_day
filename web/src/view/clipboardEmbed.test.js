import { describe, it, expect } from 'vitest';
import { isYouTubeUrl, findClipboardImageFile, readFileAsDataUrl } from './clipboardEmbed.js';

// news.md 기사 에디터: 클립보드에서 복사하여 붙여넣기한 이미지/유투브를 임베딩한다. These pure helpers back
// WritePage's onPaste handler and are unit-tested independently of the contentEditable DOM.

describe('isYouTubeUrl (clipboard YouTube detection)', () => {
  it('matches youtube.com/watch?v= links', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('http://youtube.com/watch?v=abc123XYZ')).toBe(true);
    expect(isYouTubeUrl('https://m.youtube.com/watch?v=abc123XYZ')).toBe(true);
    // Extra query params before/after v=
    expect(isYouTubeUrl('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe(true);
  });

  it('matches youtu.be short links and shorts', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('https://www.youtube.com/shorts/abc123XYZ')).toBe(true);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(isYouTubeUrl('  https://youtu.be/dQw4w9WgXcQ\n')).toBe(true);
  });

  it('rejects non-YouTube text and non-strings', () => {
    expect(isYouTubeUrl('https://example.com/watch?v=abc')).toBe(false);
    expect(isYouTubeUrl('just some pasted text')).toBe(false);
    expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
    expect(isYouTubeUrl('')).toBe(false);
    expect(isYouTubeUrl(undefined)).toBe(false);
    expect(isYouTubeUrl(null)).toBe(false);
  });
});

describe('findClipboardImageFile (clipboard image detection)', () => {
  // A minimal DataTransferItemList-like stub.
  function items(list) {
    return { length: list.length, ...list };
  }

  it('returns the first image file from the items list', () => {
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    const list = items([
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => file },
    ]);
    expect(findClipboardImageFile(list)).toBe(file);
  });

  it('returns null when no image item is present', () => {
    const list = items([{ kind: 'string', type: 'text/plain', getAsFile: () => null }]);
    expect(findClipboardImageFile(list)).toBeNull();
  });

  it('is resilient to a missing items list (jsdom)', () => {
    expect(findClipboardImageFile(undefined)).toBeNull();
  });
});

describe('readFileAsDataUrl (FileReader wrapper)', () => {
  it('resolves with a data URL string for a blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await readFileAsDataUrl(blob);
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:')).toBe(true);
  });
});
