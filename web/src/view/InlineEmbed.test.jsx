import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEmbed } from './InlineEmbed.jsx';

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
