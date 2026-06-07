// @MX:NOTE: [AUTO] Inline embed renderer (REQ-EDIT-EMBED-002/003/004/006) — visual image / video card /
// article card, styled with tokens. Defensive: missing thumbnailUrl falls back to url (EC-5).
//
// SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — `onDelete` prop opt-in: when supplied, the embed renders a
// hover/focus 시 노출되는 × 어포던스 button (`aria-label="임베드 삭제"`, keyboard focusable). The button
// stops propagation so clicking it does NOT bubble into editor caret handling, and is type="button" so
// it never submits a parent form (jsdom defensive).
//
// Each embed type renders a distinct visual element with a stable testid (embed-image / embed-video /
// embed-article) so the editor body shows inline media instead of plain "[source] url" / "기사:id" markers.

/**
 * SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE × button rendered only when `onDelete` is supplied
 * (read-only contexts still mount InlineEmbed without the delete affordance).
 */
function DeleteAffordance({ onDelete }) {
  if (typeof onDelete !== 'function') return null;
  return (
    <button
      type="button"
      className="yh-embed__delete"
      aria-label="임베드 삭제"
      onMouseDown={(e) => {
        // Prevent contentEditable focus loss / caret jump before the click fires.
        e.preventDefault();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
    >
      ×
    </button>
  );
}

/**
 * @param {{ embed: { type: 'image'|'video'|'article', source?: string, title?: string, url?: string,
 *   thumbnailUrl?: string, articleId?: string }, onDelete?: () => void }} props
 */
export function InlineEmbed({ embed, onDelete }) {
  if (!embed) {
    return null;
  }
  if (embed.type === 'image') {
    const src = embed.thumbnailUrl || embed.url || '';
    // news.md 기사 에디터: 클립보드 붙여넣기 이미지/유투브는 에디터크기 기준 10%*10% (yh-embed--clipboard).
    const clipClass = embed.source === 'clipboard' ? ' yh-embed--clipboard' : '';
    return (
      <span data-testid="embed-image" className={`yh-embed yh-embed--image${clipClass}`} contentEditable={false}>
        {/* SPEC-NEWS-REVISE-001 — 이미지 임베드는 캡션(.yh-embed__caption)을 렌더링하지 않는다. title 은
            img alt 로만 남아 접근성을 유지한다 (영상/기사의 식별용 .yh-embed__title 과 달리 캡션은 제거). */}
        <img className="yh-embed__img" src={src} alt={embed.title || '삽입 이미지'} />
        <DeleteAffordance onDelete={onDelete} />
      </span>
    );
  }
  if (embed.type === 'video') {
    const thumb = embed.thumbnailUrl || '';
    const clipClass = embed.source === 'clipboard' ? ' yh-embed--clipboard' : '';
    return (
      <span data-testid="embed-video" className={`yh-embed yh-embed--video${clipClass}`} contentEditable={false}>
        {thumb ? <img className="yh-embed__img" src={thumb} alt={embed.title || '영상'} /> : null}
        <span className="yh-embed__video-mark">영상</span>
        <span className="yh-embed__title">{embed.title || embed.url || '영상'}</span>
        {embed.url ? (
          <a className="yh-embed__link" href={embed.url} rel="noreferrer">{embed.url}</a>
        ) : null}
        <DeleteAffordance onDelete={onDelete} />
      </span>
    );
  }
  if (embed.type === 'article') {
    return (
      <span data-testid="embed-article" className="yh-embed yh-embed--article" contentEditable={false}>
        <span className="yh-embed__article-mark">기사</span>
        <span className="yh-embed__title">{embed.title || embed.articleId || '내부 기사'}</span>
        <DeleteAffordance onDelete={onDelete} />
      </span>
    );
  }
  return null;
}
