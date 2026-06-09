import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isYouTubeUrl, findClipboardImageFile, readFileAsDataUrl } from './clipboardEmbed.js';

// yonhap.css 경로를 cwd 기준 후보(repo root 실행: web/src/..., web/ 실행: src/...)에서 탐색해 읽는다.
// (jsdom getComputedStyle 한계 회피 — PD4: CSS 텍스트 정규식 단언.)
function readYonhapCss() {
  const candidates = [
    path.resolve(process.cwd(), 'web/src/styles/yonhap.css'),
    path.resolve(process.cwd(), 'src/styles/yonhap.css'),
  ];
  for (const p of candidates) {
    try { return readFileSync(p, 'utf8'); } catch { /* try next candidate */ }
  }
  throw new Error(`yonhap.css not found in: ${candidates.join(', ')}`);
}

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

// SPEC-NEWS-REVISE-009 REQ-CLIPBOARD-EMBED-SIZE — 클립보드 붙여넣기 이미지/유튜브 사이징 17%×17%,
// 사진/영상 figure 폭 612px, 기사 참조 카드 480px 정본(news.md L127, 기존 10%/360px 의 1.7배)을 잠근다.
// PD4: jsdom getComputedStyle 한계를 피해 yonhap.css 텍스트를 직접 읽어 정규식/문자열로 단언한다(사이징은
// 모두 .yh-embed 계열 CSS 소관 — clipboardEmbed.js 에는 사이즈 로직이 없다).
describe('yonhap.css 클립보드 임베드 사이징 정본 (REQ-CLIPBOARD-EMBED-SIZE)', () => {
  const css = readYonhapCss();

  // 특정 셀렉터 블록의 본문( { ... } )만 추출 — negative 단언이 다른 블록의 값에 오염되지 않게 한다.
  function ruleBody(selector) {
    const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
    const m = re.exec(css);
    expect(m, `${selector} 규칙이 yonhap.css 에 존재해야 한다`).not.toBeNull();
    return m[1];
  }

  // AC-SIZE-1 — 클립보드 임베드(.yh-embed--clipboard)는 17%×17% 로 표시되고, 10% 가 남아 있지 않다.
  it('AC-SIZE-1: .yh-embed--clipboard 가 17%×17% 로 사이징되고 10% 잔존이 없다', () => {
    const body = ruleBody('.yh-embed--clipboard');
    expect(body).toMatch(/max-width:\s*17%/);
    expect(body).toMatch(/max-height:\s*17%/);
    // 구 10% 정책이 클립보드 사이징 규칙에 남아 있지 않다(AC-SIZE-3 negative 와 정합).
    expect(body).not.toMatch(/\b10%/);
  });

  // AC-SIZE-2 — 사진/영상 figure(.yh-embed) 폭 612px, 기사 참조 카드(.yh-embed--article) 폭 480px.
  it('AC-SIZE-2: figure 폭 612px / 기사 참조 카드 폭 480px', () => {
    expect(ruleBody('.yh-embed')).toMatch(/max-width:\s*612px/);
    expect(ruleBody('.yh-embed--article')).toMatch(/max-width:\s*480px/);
  });

  // AC-SIZE-3 — 10% / figure 360px 회귀 금지 (negative 보조 단언).
  it('AC-SIZE-3: 클립보드 10% 또는 figure 360px 로 회귀하지 않는다', () => {
    expect(ruleBody('.yh-embed--clipboard')).not.toMatch(/\b10%/);
    expect(ruleBody('.yh-embed')).not.toMatch(/max-width:\s*360px/);
  });
});
