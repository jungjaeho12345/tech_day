import { describe, it, expect } from 'vitest';
import { sortByCreatedAtDesc } from './useViewController.js';

describe('sortByCreatedAtDesc (news.md: 기사는 시간 내림차순)', () => {
  it('orders rows newest-first by createdAt', () => {
    const rows = [
      { articleId: 'A', createdAt: '2026-05-01T08:00:00Z' },
      { articleId: 'B', createdAt: '2026-05-03T08:00:00Z' },
      { articleId: 'C', createdAt: '2026-05-02T08:00:00Z' },
    ];
    const ids = sortByCreatedAtDesc(rows).map((r) => r.articleId);
    expect(ids).toEqual(['B', 'C', 'A']);
  });

  it('puts rows with a missing createdAt last', () => {
    const rows = [
      { articleId: 'no-time' },
      { articleId: 'older', createdAt: '2026-05-01T08:00:00Z' },
      { articleId: 'newer', createdAt: '2026-05-05T08:00:00Z' },
    ];
    const ids = sortByCreatedAtDesc(rows).map((r) => r.articleId);
    expect(ids).toEqual(['newer', 'older', 'no-time']);
  });

  it('does not mutate the input array and tolerates non-array input', () => {
    const rows = [
      { articleId: 'A', createdAt: '2026-05-01T08:00:00Z' },
      { articleId: 'B', createdAt: '2026-05-02T08:00:00Z' },
    ];
    const snapshot = [...rows];
    sortByCreatedAtDesc(rows);
    expect(rows).toEqual(snapshot); // original order preserved
    expect(sortByCreatedAtDesc(null)).toEqual([]);
    expect(sortByCreatedAtDesc(undefined)).toEqual([]);
  });
});
