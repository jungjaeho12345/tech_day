import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
