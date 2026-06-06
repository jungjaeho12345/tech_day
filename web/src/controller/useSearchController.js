// Search controllers for the write page (REQ-FE-WRITE-007..011) [DP-F3].
// Media search consumes the single proxy interface (provider-agnostic); text-article search is internal.
import { useState, useCallback } from 'react';
import { useModel } from '../app/context.js';

export function useMediaSearch(mediaType) {
  const model = useModel();
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle'); // idle | empty | error

  const search = useCallback(async (query) => {
    setState('idle');
    try {
      // type-routed: 'video' -> YouTube, 'image' -> Google Images (server-side). The tab supplies
      // mediaType ('image'|'video'); there is no cross-provider fallback anymore.
      const { items, error } = await model.searchMedia(query, mediaType);
      if (error || !items || items.length === 0) {
        setResults([]);
        setState('empty'); // EC-2: the routed provider returned nothing (or errored).
        return;
      }
      setResults(items);
      setState('idle');
    } catch {
      setResults([]);
      setState('error'); // EC-2b: proxy call failed.
    }
  }, [model, mediaType]);

  return { results, state, search };
}

export function useArticleSearch() {
  const model = useModel();
  const [results, setResults] = useState([]);

  const search = useCallback(async (query) => {
    const items = await model.searchArticles(query);
    setResults(Array.isArray(items) ? items : []);
  }, [model]);

  return { results, search };
}
