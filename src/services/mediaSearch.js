// @MX:ANCHOR: [AUTO] Media search proxy — type-routed: video->YouTube, image->Google (REQ-SRCH-M-*, fan_in >= 3).
// @MX:REASON: encapsulates provider routing by media type, normalization, and API-key non-exposure.
//   The 2026-06-06 user directive SUPERSEDES the SPEC-NEWS-REVISE-002 D2-8 "YouTube-first, Google
//   fallback" contract: the video tab now returns YouTube results only and the image tab returns
//   Google Image Search results only — there is NO cross-provider fallback anymore.
//
// External media search proxy for SPEC-BACKEND-CORE-001.
// Providers are injectable so tests never hit real APIs. The default providers read
// their keys from server-side env vars and never place key material into the result.

/** @typedef {{ search: (query: string) => Promise<Array<object>> }} MediaProvider */

/** Normalize a raw provider item into the contract shape (REQ-SRCH-M-003). */
function normalize(source, raw) {
  const item = { source, title: raw.title, url: raw.url };
  if (raw.thumbnailUrl !== undefined && raw.thumbnailUrl !== null) {
    item.thumbnailUrl = raw.thumbnailUrl;
  }
  return item;
}

/** Call a provider; return [] on any error so the proxy reports a clean error result. */
async function safeSearch(provider, query) {
  try {
    const items = await provider.search(query);
    return Array.isArray(items) ? items : [];
  } catch {
    // REQ-SRCH-M-004: never propagate the raw upstream error to the client.
    return [];
  }
}

/**
 * Default YouTube provider. Keys stay server-side (env) and are never exposed (REQ-SRCH-SEC-001).
 * @returns {MediaProvider}
 */
function defaultYoutubeProvider() {
  return {
    async search(query) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('youtube upstream error');
      }
      const data = await res.json();
      return (data.items ?? []).map((it) => ({
        title: it.snippet?.title,
        url: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
        thumbnailUrl: it.snippet?.thumbnails?.default?.url,
      }));
    },
  };
}

/**
 * Default Google provider — image-only (Custom Search JSON API, searchType=image).
 * Keys stay server-side (env) and are never exposed.
 * @returns {MediaProvider}
 */
function defaultGoogleProvider() {
  return {
    async search(query) {
      const apiKey = process.env.GOOGLE_API_KEY;
      const cx = process.env.GOOGLE_SEARCH_CX;
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=10&key=${apiKey}&cx=${cx}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('google upstream error');
      }
      const data = await res.json();
      return (data.items ?? []).map((it) => ({
        title: it.title,
        url: it.link,
        // Image results expose it.image.thumbnailLink; fall back to the legacy pagemap thumbnail.
        thumbnailUrl: it.image?.thumbnailLink ?? it.pagemap?.cse_thumbnail?.[0]?.src,
      }));
    },
  };
}

/**
 * Create the media-search-proxy service.
 * @param {{ youtube?: MediaProvider, google?: MediaProvider }} [providers]
 */
export function createMediaSearchService(providers = {}) {
  const youtube = providers.youtube ?? defaultYoutubeProvider();
  const google = providers.google ?? defaultGoogleProvider();

  return {
    /**
     * Search media, routed by type (2026-06-06 directive supersedes D2-8 fallback):
     *   - type === 'image' -> Google Custom Search image results ONLY (source 'google')
     *   - anything else (incl. undefined) -> YouTube results ONLY (source 'youtube')
     * No cross-provider fallback. Per-type error/empty -> { items: [], error: true }.
     * @param {string} query
     * @param {('image'|'video'|string)} [type]
     * @returns {Promise<{ items: Array<object>, error: boolean }>}
     */
    async search(query, type) {
      const source = type === 'image' ? 'google' : 'youtube';
      const provider = type === 'image' ? google : youtube;
      const items = await safeSearch(provider, query);
      if (items.length > 0) {
        return { items: items.map((raw) => normalize(source, raw)), error: false };
      }
      // REQ-SRCH-M-004: provider error OR zero items -> empty set + error indicator.
      return { items: [], error: true };
    },
  };
}
