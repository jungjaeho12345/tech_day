import { describe, it, expect } from 'vitest';
import {
  createEmptyContent,
  contentFromText,
  appendEmbed,
  removeEmbedAt,
  contentToText,
  serializeContent,
  deserializeContent,
  contentToMarkup,
  markupToStructuredDto,
  MARKUP_FORMAT,
  END_MARKER,
  END_MARKER_BLOCK,
  hasEndMarker,
} from './editorContent.js';

// SPEC-UI-EDITOR-001 — REQ-EDIT-PARSE-006, REQ-EDIT-EMBED-005/007.
// The editor content is an ordered list of blocks (text + embeds). markupVersion is versioned JSON
// encoding BOTH the blocks AND the derived title/subtitle/body structure (round-trip stable).

const IMG = { type: 'image', source: 'youtube', title: '현장 사진', url: 'https://img/x', thumbnailUrl: 'https://thumb/x' };
const ARTICLE = { type: 'article', articleId: 'A-1', title: '폭우 피해' };
const VIDEO = { type: 'video', source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x' };

describe('editorContent model (REQ-EDIT-PARSE-006, REQ-EDIT-EMBED)', () => {
  it('contentFromText keeps the plain text recoverable', () => {
    const content = contentFromText('hello body');
    expect(contentToText(content)).toContain('hello body');
  });

  it('appendEmbed adds a distinct embed block preserving order (REQ-EDIT-EMBED-007)', () => {
    let content = contentFromText('intro');
    content = appendEmbed(content, IMG);
    content = appendEmbed(content, ARTICLE);
    const embeds = content.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(2);
    expect(embeds[0].embed.type).toBe('image');
    expect(embeds[1].embed.type).toBe('article');
  });

  it('serialize -> deserialize round-trips blocks and order (AC-3 / EC-3)', () => {
    let content = contentFromText('본문 시작');
    content = appendEmbed(content, IMG);
    content = appendEmbed(content, ARTICLE);
    const markup = serializeContent(content);
    const restored = deserializeContent(markup);
    expect(restored.blocks).toEqual(content.blocks);
    // round-trip is idempotent on the markup string itself.
    expect(serializeContent(restored)).toBe(markup);
  });

  it('markup is versioned JSON with a format tag (forward-compat)', () => {
    const markup = serializeContent(createEmptyContent());
    const parsed = JSON.parse(markup);
    expect(parsed.format).toBe(MARKUP_FORMAT);
    expect(parsed.version).toBeGreaterThanOrEqual(1);
  });

  it('deserialize tolerates a plain (legacy) string without crashing', () => {
    const content = deserializeContent('just plain text');
    expect(contentToText(content)).toContain('just plain text');
  });

  it('deserialize tolerates empty/undefined markup', () => {
    expect(deserializeContent('').blocks).toBeDefined();
    expect(deserializeContent(undefined).blocks).toBeDefined();
  });

  it('EC-5: an embed missing thumbnailUrl survives round-trip and resolves to url', () => {
    let content = contentFromText('');
    content = appendEmbed(content, VIDEO); // no thumbnailUrl
    const restored = deserializeContent(serializeContent(content));
    const embed = restored.blocks.find((b) => b.type === 'embed').embed;
    expect(embed.thumbnailUrl).toBeUndefined();
    expect(embed.url).toBe('https://youtu.be/x');
  });

  it('contentToMarkup encodes the parsed structure so DTO can consume it (REQ-EDIT-PARSE-006)', () => {
    const content = contentFromText('제목\n부제목\n\n본문 텍스트');
    const markup = contentToMarkup(content);
    const dto = markupToStructuredDto(markup);
    expect(dto.title).toBe('제목');
    expect(dto.subtitle).toBe('부제목');
    expect(dto.body).toBe('본문 텍스트');
  });

  it('markup contains typed plain text as a substring (AC-5.1 contract)', () => {
    const content = contentFromText('hello body');
    expect(contentToMarkup(content)).toContain('hello body');
  });
});

// SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER: Alt+Y 마커가 prefix 없이 정확히 "(끝)"로 단순화.
describe('end marker (SPEC-NEWS-REVISE-002 simplified to "(끝)")', () => {
  it('AC-ENDMARK-1: END_MARKER_BLOCK is exactly the "(끝)" token (prefix-free)', () => {
    expect(END_MARKER_BLOCK).toBe(END_MARKER);
    expect(END_MARKER_BLOCK).toBe('(끝)');
  });

  it('AC-ENDMARK-2: hasEndMarker detects both new "(끝)" and legacy "\\n (끝)" forms', () => {
    expect(hasEndMarker('본문(끝)')).toBe(true);
    expect(hasEndMarker('본문\n (끝)')).toBe(true);
    expect(hasEndMarker('본문(끝)  ')).toBe(true);
    expect(hasEndMarker('본문\n (끝)  ')).toBe(true);
  });

  it('hasEndMarker is false when the marker is absent or not at the end', () => {
    expect(hasEndMarker('본문')).toBe(false);
    expect(hasEndMarker('(끝) 본문')).toBe(false);
    expect(hasEndMarker('')).toBe(false);
    expect(hasEndMarker(undefined)).toBe(false);
  });
});

// SPEC-NEWS-REVISE-002 — REQ-EMBED-DELETE (AC-EMB-DEL-1/2/3)
describe('removeEmbedAt (SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE)', () => {
  const IMG2 = { type: 'image', source: 'youtube', title: '현장', url: 'https://img/y' };
  const VIDEO2 = { type: 'video', source: 'youtube', title: 'YT', url: 'https://youtu.be/y' };
  const ARTICLE2 = { type: 'article', articleId: 'A-2', title: '내부' };

  it('AC-EMB-DEL-1: removes the N-th embed by ordinal index (0-based)', () => {
    let content = contentFromText('intro');
    content = appendEmbed(content, IMG2);
    content = appendEmbed(content, VIDEO2);
    content = appendEmbed(content, ARTICLE2);
    const next = removeEmbedAt(content, 1);
    const embeds = next.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(2);
    expect(embeds[0].embed.type).toBe('image');
    expect(embeds[1].embed.type).toBe('article');
  });

  it('AC-EMB-DEL-2: adjacent text blocks and other embeds are preserved verbatim', () => {
    const content = { blocks: [
      { type: 'text', text: 'AAA' },
      { type: 'embed', embed: { ...IMG2 } },
      { type: 'text', text: 'BBB' },
      { type: 'embed', embed: { ...VIDEO2 } },
      { type: 'text', text: 'CCC' },
    ] };
    const next = removeEmbedAt(content, 0);
    expect(next.blocks).toEqual([
      { type: 'text', text: 'AAA' },
      { type: 'text', text: 'BBB' },
      { type: 'embed', embed: { ...VIDEO2 } },
      { type: 'text', text: 'CCC' },
    ]);
  });

  it('AC-EMB-DEL-3: markup round-trip — the removed embed does not resurrect', () => {
    let content = contentFromText('body');
    content = appendEmbed(content, IMG2);
    content = appendEmbed(content, ARTICLE2);
    const next = removeEmbedAt(content, 0);
    const markup = serializeContent(next);
    const restored = deserializeContent(markup);
    const embeds = restored.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('article');
  });

  it('out-of-range or non-finite index is a defensive no-op', () => {
    let content = contentFromText('body');
    content = appendEmbed(content, IMG2);
    const before = content.blocks.length;
    expect(removeEmbedAt(content, 5).blocks).toHaveLength(before);
    expect(removeEmbedAt(content, -1).blocks).toHaveLength(before);
    expect(removeEmbedAt(content, NaN).blocks).toHaveLength(before);
  });
});
