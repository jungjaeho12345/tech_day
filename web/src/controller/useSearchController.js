// Search controllers for the write page (REQ-FE-WRITE-007..011) [DP-F3].
// Media search consumes the single proxy interface (provider-agnostic); text-article search is internal.
import { useState, useCallback } from 'react';
import { useModel } from '../app/context.js';

export function useMediaSearch() {
  const model = useModel();
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle'); // idle | empty | error

  const search = useCallback(async (query) => {
    setState('idle');
    try {
      const { items, error } = await model.searchMedia(query);
      if (error || !items || items.length === 0) {
        setResults([]);
        setState('empty'); // EC-2: both providers empty.
        return;
      }
      setResults(items);
      setState('idle');
    } catch {
      setResults([]);
      setState('error'); // EC-2b: proxy call failed.
    }
  }, [model]);

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
