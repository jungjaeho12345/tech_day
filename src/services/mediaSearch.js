// @MX:ANCHOR: [AUTO] Media search proxy — YouTube-first with Google fallback (REQ-SRCH-M-*, fan_in >= 3).
// @MX:REASON: encapsulates provider ordering, fallback, normalization, and API-key non-exposure.
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

/** Call a provider; return [] on any error so the proxy can decide on fallback. */
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
 * Default Google provider. Keys stay server-side (env) and are never exposed.
 * @returns {MediaProvider}
 */
function defaultGoogleProvider() {
  return {
    async search(query) {
      const apiKey = process.env.GOOGLE_API_KEY;
      const cx = process.env.GOOGLE_SEARCH_CX;
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('google upstream error');
      }
      const data = await res.json();
      return (data.items ?? []).map((it) => ({
        title: it.title,
        url: it.link,
        thumbnailUrl: it.pagemap?.cse_thumbnail?.[0]?.src,
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
     * Search media: YouTube first, Google fallback on error/empty, normalized output.
     * @param {string} query
     * @returns {Promise<{ items: Array<object>, error: boolean }>}
     */
    async search(query) {
      const ytItems = await safeSearch(youtube, query);
      if (ytItems.length > 0) {
        return { items: ytItems.map((raw) => normalize('youtube', raw)), error: false };
      }
      const gItems = await safeSearch(google, query);
      if (gItems.length > 0) {
        return { items: gItems.map((raw) => normalize('google', raw)), error: false };
      }
      // REQ-SRCH-M-004: both failed/empty -> empty set + error indicator.
      return { items: [], error: true };
    },
  };
}
