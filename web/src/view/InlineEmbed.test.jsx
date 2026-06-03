import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEmbed } from './InlineEmbed.jsx';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';

// SPEC-UI-EDITOR-001 — REQ-EDIT-EMBED-002/003/004/006, EC-5 defensive rendering.

describe('InlineEmbed (REQ-EDIT-EMBED render types)', () => {
  it('renders an image embed using thumbnailUrl', () => {
    render(<InlineEmbed embed={{ type: 'image', title: 'cap', url: 'https://u/1', thumbnailUrl: 'https://t/1' }} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://t/1');
    expect(screen.getByText('cap')).toBeInTheDocument();
  });

  it('EC-5: image embed without thumbnailUrl falls back to url', () => {
    render(<InlineEmbed embed={{ type: 'image', title: 'cap', url: 'https://u/1' }} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://u/1');
  });

  it('renders a video embed with the 영상 marker, title and a thumbnail when present', () => {
    render(<InlineEmbed embed={{ type: 'video', title: 'clip', url: 'https://v/1', thumbnailUrl: 'https://t/1' }} />);
    expect(screen.getByTestId('embed-video')).toBeInTheDocument();
    expect(screen.getByText('영상')).toBeInTheDocument();
    expect(screen.getByText('clip')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://t/1');
  });

  it('EC-5: video embed without thumbnailUrl/title still renders (url fallback, no crash)', () => {
    render(<InlineEmbed embed={{ type: 'video', url: 'https://v/2' }} />);
    expect(screen.getByTestId('embed-video')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an internal-article card showing the title with a 기사 marker', () => {
    render(<InlineEmbed embed={{ type: 'article', articleId: 'A-1', title: '폭우 피해' }} />);
    expect(screen.getByTestId('embed-article')).toBeInTheDocument();
    expect(screen.getByText('기사')).toBeInTheDocument();
    expect(screen.getByText('폭우 피해')).toBeInTheDocument();
  });

  it('article card without title falls back to articleId', () => {
    render(<InlineEmbed embed={{ type: 'article', articleId: 'A-2' }} />);
    expect(screen.getByText('A-2')).toBeInTheDocument();
  });

  it('renders nothing for a missing or unknown embed (defensive)', () => {
    const { container: c1 } = render(<InlineEmbed embed={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<InlineEmbed embed={{ type: 'unknown' }} />);
    expect(c2.firstChild).toBeNull();
  });
});

// SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — AC-EMB-DEL-1 (× 클릭) + AC-EMB-DEL-5 (a11y).
describe('InlineEmbed delete affordance (AC-EMB-DEL-1, AC-EMB-DEL-5)', () => {
  it('AC-EMB-DEL-1: × 버튼 클릭 시 onDelete가 1회 호출된다 (image embed)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <InlineEmbed
        embed={{ type: 'image', title: 'cap', url: 'https://u/1', thumbnailUrl: 'https://t/1' }}
        onDelete={onDelete}
      />,
    );
    const deleteButton = screen.getByRole('button', { name: '임베드 삭제' });
    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('AC-EMB-DEL-1: × 버튼 클릭 시 onDelete 1회 호출 (video embed)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <InlineEmbed
        embed={{ type: 'video', title: 'clip', url: 'https://v/1', thumbnailUrl: 'https://t/1' }}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: '임베드 삭제' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('AC-EMB-DEL-1: × 버튼 클릭 시 onDelete 1회 호출 (article embed)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <InlineEmbed embed={{ type: 'article', articleId: 'A-1', title: 'a' }} onDelete={onDelete} />,
    );
    await user.click(screen.getByRole('button', { name: '임베드 삭제' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('AC-EMB-DEL-5: × 버튼은 aria-label="임베드 삭제"를 가지며 키보드 포커스 가능하다', () => {
    const onDelete = vi.fn();
    render(
      <InlineEmbed embed={{ type: 'image', title: 'cap', url: 'https://u/1' }} onDelete={onDelete} />,
    );
    const deleteButton = screen.getByRole('button', { name: '임베드 삭제' });
    expect(deleteButton).toHaveAttribute('aria-label', '임베드 삭제');
    // type="button" 으로 form submit 막기.
    expect(deleteButton.tagName).toBe('BUTTON');
    expect(deleteButton.getAttribute('type')).toBe('button');
    // 키보드 포커스 가능 (tabIndex 음수 아님).
    expect(deleteButton.tabIndex).not.toBe(-1);
  });

  it('AC-EMB-DEL-5: onDelete prop 미지정 시 × 버튼이 렌더되지 않는다 (read-only 컨텍스트 보호)', () => {
    render(<InlineEmbed embed={{ type: 'image', title: 'cap', url: 'https://u/1' }} />);
    expect(screen.queryByRole('button', { name: '임베드 삭제' })).not.toBeInTheDocument();
  });
});

// SPEC-NEWS-REVISE-003 — REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT (토픽 E): 단일 임베드 삭제 시 인접
// 텍스트/다른 임베드 보존 + markupVersion round-trip 에서 삭제된 임베드가 silently 복원되지 않음.
// 삭제는 어댑터 계약(removeEmbed)을 통한다 (SPEC-UI-EDITOR-001 어댑터 계약 변경 없음). InlineEmbed 의
// onDelete × 어포던스는 위 블록(AC-EMB-DEL-1)에서 이미 검증되므로 여기서는 content/markup 결과를 잠근다.
describe('SPEC-NEWS-REVISE-003 REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT (토픽 E)', () => {
  // 임베드의 안정적 식별을 위한 마커(url/articleId)로 본문 블록 구성을 단언한다.
  function embedTypes(content) {
    return content.blocks.filter((b) => b.type === 'embed').map((b) => b.embed.type);
  }
  function texts(content) {
    return content.blocks.filter((b) => b.type === 'text').map((b) => b.text);
  }
  function embedUrls(content) {
    return content.blocks.filter((b) => b.type === 'embed').map((b) => b.embed.url ?? b.embed.articleId);
  }

  it('AC-EMB-DEL-1: AAA + embed + BBB 에서 임베드만 삭제 → AAA/BBB 텍스트 보존', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('AAABBB');
    // caret offset 3 ("AAA" 다음)에 임베드 삽입 → [text:AAA, embed, text:BBB].
    adapter.embed({ type: 'image', source: 'youtube', title: 'E', url: 'https://e/1' }, { caretOffset: 3 });
    let content = adapter.getContent();
    expect(embedTypes(content)).toEqual(['image']);
    expect(texts(content)).toEqual(['AAA', 'BBB']);

    // 임베드(ordinal 0) 삭제 → 인접 텍스트 보존, 임베드 0개.
    adapter.removeEmbed(0);
    content = adapter.getContent();
    expect(embedTypes(content)).toEqual([]);
    // 본문 텍스트는 AAA + BBB 가 그대로 남는다 (인접 텍스트 보존).
    expect(adapter.getBodyText()).toBe('AAABBB');
  });

  it('AC-EMB-DEL-2: E1,E2,E3 + 사이 텍스트 → 가운데 E2 만 삭제, E1/E3 + 텍스트 보존', () => {
    const adapter = createStructuredEditorAdapter();
    // [text:AAA, E1, text:BBB, E2, text:CCC, E3, text:DDD] 구조를 markup 으로 직접 구성.
    const sourceBlocks = [
      { type: 'text', text: 'AAA' },
      { type: 'embed', embed: { type: 'image', source: 'youtube', title: 'E1', url: 'https://e/1' } },
      { type: 'text', text: 'BBB' },
      { type: 'embed', embed: { type: 'video', source: 'youtube', title: 'E2', url: 'https://e/2' } },
      { type: 'text', text: 'CCC' },
      { type: 'embed', embed: { type: 'article', articleId: 'E3', title: 'E3' } },
      { type: 'text', text: 'DDD' },
    ];
    // JSON.stringify of the versioned-markup shape via a throwaway adapter that serializes.
    const seed = createStructuredEditorAdapter();
    seed.setMarkup(JSON.stringify({ format: 'yh-editor', version: 1, blocks: sourceBlocks }));
    adapter.setMarkup(seed.getMarkup());

    expect(embedTypes(adapter.getContent())).toEqual(['image', 'video', 'article']);

    // 가운데 임베드 E2 (ordinal 1) 만 삭제.
    adapter.removeEmbed(1);
    const content = adapter.getContent();
    // E1, E3 보존 (E2 만 사라짐).
    expect(embedTypes(content)).toEqual(['image', 'article']);
    expect(embedUrls(content)).toEqual(['https://e/1', 'E3']);
    // 모든 텍스트(AAA/BBB/CCC/DDD)는 보존 — 합쳐진 본문에 4개 모두 존재.
    const body = adapter.getBodyText();
    for (const t of ['AAA', 'BBB', 'CCC', 'DDD']) {
      expect(body).toContain(t);
    }
  });

  it('AC-EMB-DEL-3: 삭제 후 getMarkup → 새 adapter.setMarkup round-trip — 삭제 임베드 복원 없음, 생존 임베드는 복원', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('AAABBB');
    adapter.embed({ type: 'image', source: 'youtube', title: 'keep', url: 'https://keep/1' }, { caretOffset: 3 });
    adapter.embed({ type: 'video', source: 'youtube', title: 'drop', url: 'https://drop/1' }); // append at end
    expect(embedTypes(adapter.getContent())).toEqual(['image', 'video']);

    // 'video' (ordinal 1) 삭제.
    adapter.removeEmbed(1);
    expect(embedTypes(adapter.getContent())).toEqual(['image']);

    // getMarkup → 새 adapter 로 setMarkup round-trip.
    const markup = adapter.getMarkup();
    const restored = createStructuredEditorAdapter();
    restored.setMarkup(markup);
    const restoredContent = restored.getContent();

    // 삭제된 'video' 임베드는 round-trip 후에도 silently 복원되지 않는다.
    expect(embedTypes(restoredContent)).toEqual(['image']);
    expect(embedUrls(restoredContent)).toEqual(['https://keep/1']);
    expect(embedUrls(restoredContent)).not.toContain('https://drop/1');
    // 생존 임베드 + 인접 텍스트는 정상 복원 (SPEC-NEWS-REVISE-001 AC-EMB-3 정합).
    expect(restored.getBodyText()).toBe('AAABBB');
  });
});
