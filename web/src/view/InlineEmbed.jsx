// @MX:NOTE: [AUTO] Inline embed renderer (REQ-EDIT-EMBED-002/003/004/006) — visual image / video card /
// article card, styled with 연합뉴스 tokens. Defensive: missing thumbnailUrl falls back to url (EC-5).
//
// Each embed type renders a distinct visual element with a stable testid (embed-image / embed-video /
// embed-article) so the editor body shows inline media instead of plain "[source] url" / "기사:id" markers.

/**
 * @param {{ embed: { type: 'image'|'video'|'article', source?: string, title?: string, url?: string,
 *   thumbnailUrl?: string, articleId?: string } }} props
 */
export function InlineEmbed({ embed }) {
  if (!embed) {
    return null;
  }
  if (embed.type === 'image') {
    const src = embed.thumbnailUrl || embed.url || '';
    return (
      <span data-testid="embed-image" className="yh-embed yh-embed--image" contentEditable={false}>
        <img className="yh-embed__img" src={src} alt={embed.title || '삽입 이미지'} />
        {embed.title ? <span className="yh-embed__caption">{embed.title}</span> : null}
      </span>
    );
  }
  if (embed.type === 'video') {
    const thumb = embed.thumbnailUrl || '';
    return (
      <span data-testid="embed-video" className="yh-embed yh-embed--video" contentEditable={false}>
        {thumb ? <img className="yh-embed__img" src={thumb} alt={embed.title || '영상'} /> : null}
        <span className="yh-embed__video-mark">영상</span>
        <span className="yh-embed__title">{embed.title || embed.url || '영상'}</span>
        {embed.url ? (
          <a className="yh-embed__link" href={embed.url} rel="noreferrer">{embed.url}</a>
        ) : null}
      </span>
    );
  }
  if (embed.type === 'article') {
    return (
      <span data-testid="embed-article" className="yh-embed yh-embed--article" contentEditable={false}>
        <span className="yh-embed__article-mark">기사</span>
        <span className="yh-embed__title">{embed.title || embed.articleId || '내부 기사'}</span>
      </span>
    );
  }
  return null;
}
