import { describe, it, expect, beforeEach } from 'vitest';
import {
  COLUMN_POOL,
  DEFAULT_GAP,
  MIN_GAP,
  MAX_GAP,
  storageKeyFor,
  defaultColumnState,
  sanitizeColumnState,
  loadColumnState,
  saveColumnState,
  visibleColumns,
  buildGridTemplate,
  columnByKey,
} from './columnConfig.js';

const MENU = '데스크 미송고';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* no storage */ }
});

describe('COLUMN_POOL', () => {
  it('includes the 8 base columns visible by default and 3 opt-in extras hidden by default', () => {
    const base = COLUMN_POOL.filter((c) => c.defaultVisible).map((c) => c.key);
    expect(base).toEqual([
      'articleId', 'title', 'author', 'modifier', 'createdAt', 'editedAt', 'status', 'lockYN',
    ]);
    const extras = COLUMN_POOL.filter((c) => !c.defaultVisible).map((c) => c.key);
    expect(extras).toEqual(['department', 'sender', 'sentAt']);
  });

  it('every column carries a stable label; only the title column flexes', () => {
    for (const c of COLUMN_POOL) expect(typeof c.label).toBe('string');
    expect(COLUMN_POOL.filter((c) => c.flex).map((c) => c.key)).toEqual(['title']);
  });
});

describe('defaultColumnState', () => {
  it('orders all pool keys, seeds base columns visible, and uses the default gap', () => {
    const s = defaultColumnState();
    expect(s.order).toEqual(COLUMN_POOL.map((c) => c.key));
    expect(s.visible.articleId).toBe(true);
    expect(s.visible.department).toBe(false);
    expect(s.gap).toBe(DEFAULT_GAP);
    // Non-flex columns get a width track; the flex title column does not.
    expect(s.widths.articleId).toBe('11rem');
    expect(s.widths.title).toBeUndefined();
  });
});

describe('sanitizeColumnState', () => {
  it('returns defaults for non-object input', () => {
    expect(sanitizeColumnState(null)).toEqual(defaultColumnState());
    expect(sanitizeColumnState(42)).toEqual(defaultColumnState());
  });

  it('drops unknown keys from order and appends missing pool keys', () => {
    const s = sanitizeColumnState({ order: ['status', 'ZZZ', 'status', 'title'] });
    // de-dup + unknown dropped, then the rest of the pool appended in canonical order.
    expect(s.order[0]).toBe('status');
    expect(s.order[1]).toBe('title');
    expect(s.order).not.toContain('ZZZ');
    expect(new Set(s.order)).toEqual(new Set(COLUMN_POOL.map((c) => c.key)));
    expect(s.order).toHaveLength(COLUMN_POOL.length);
  });

  it('preserves stored visibility booleans and fills missing ones from defaults', () => {
    const s = sanitizeColumnState({ visible: { department: true, articleId: false } });
    expect(s.visible.department).toBe(true);
    expect(s.visible.articleId).toBe(false);
    expect(s.visible.title).toBe(true); // unspecified -> default
  });

  it('keeps stored widths and clamps the gap into bounds', () => {
    expect(sanitizeColumnState({ gap: 999 }).gap).toBe(MAX_GAP);
    expect(sanitizeColumnState({ gap: -50 }).gap).toBe(MIN_GAP);
    expect(sanitizeColumnState({ widths: { author: '10rem' } }).widths.author).toBe('10rem');
    // a bogus width type falls back to default.
    expect(sanitizeColumnState({ widths: { author: 123 } }).widths.author).toBe('6rem');
  });
});

describe('persistence (per-menu, localStorage with fallback)', () => {
  it('uses a menu-scoped storage key', () => {
    expect(storageKeyFor('부서별 송고')).toBe('tech_day.viewColumns.부서별 송고');
    expect(storageKeyFor(MENU)).not.toBe(storageKeyFor('부서별 송고'));
  });

  it('round-trips a saved state and keeps menus independent', () => {
    const a = defaultColumnState();
    a.visible.department = true;
    a.gap = 20;
    saveColumnState(MENU, a);

    const loaded = loadColumnState(MENU);
    expect(loaded.visible.department).toBe(true);
    expect(loaded.gap).toBe(20);

    // A different menu is unaffected — returns defaults.
    expect(loadColumnState('부서별 송고')).toEqual(defaultColumnState());
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadColumnState('개인별 수정')).toEqual(defaultColumnState());
  });

  it('returns defaults on a corrupt stored payload', () => {
    try { localStorage.setItem(storageKeyFor(MENU), '{ not json'); } catch { /* ignore */ }
    expect(loadColumnState(MENU)).toEqual(defaultColumnState());
  });
});

describe('visibleColumns + buildGridTemplate', () => {
  it('lists visible columns in order and skips hidden ones', () => {
    const s = defaultColumnState();
    s.visible.modifier = false;
    const keys = visibleColumns(s).map((c) => c.key);
    expect(keys).toContain('author');
    expect(keys).not.toContain('modifier');
    expect(keys).not.toContain('department'); // hidden by default
  });

  it('builds a grid template synced for header and rows, flex column as minmax(0, 1fr)', () => {
    const s = defaultColumnState();
    const tpl = buildGridTemplate(s);
    expect(tpl).toBe('11rem minmax(0, 1fr) 6rem 6rem 8.5rem 8.5rem 4.5rem 4rem');
  });

  it('reflects a resized width in the template', () => {
    const s = defaultColumnState();
    s.widths.author = '9rem';
    expect(buildGridTemplate(s)).toContain('9rem');
  });

  it('returns an empty template when all columns are hidden', () => {
    const s = defaultColumnState();
    for (const k of Object.keys(s.visible)) s.visible[k] = false;
    expect(buildGridTemplate(s)).toBe('');
    expect(visibleColumns(s)).toEqual([]);
  });
});

describe('columnByKey', () => {
  it('resolves a known key and returns undefined for an unknown one', () => {
    expect(columnByKey('title').label).toBe('제목');
    expect(columnByKey('nope')).toBeUndefined();
  });
});
