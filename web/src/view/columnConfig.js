// @MX:ANCHOR: [AUTO] View list column configuration — column pool, per-menu persistence, grid template.
// @MX:REASON: ViewPage's header + every row share ONE grid-template-columns built here; the show/hide,
// order, width and gap contract is consumed by both the header resizers and the row renderer, so the
// shapes (COLUMN_POOL keys, state schema) are a load-bearing contract for the page and its tests.
//
// Pure module (no React) so it is unit-testable in isolation. Persists per-menu column state to
// localStorage under a menu-scoped key, degrading to an in-memory store when storage is unavailable
// (jsdom without storage, Safari private mode, insecure context) — every access is try/catch guarded.

// ---------------------------------------------------------------------------
// Column pool
// ---------------------------------------------------------------------------
// Each descriptor: { key, label, testId?, cellClass, defaultWidth, minWidth, flex?, defaultVisible }.
//   - key          stable identifier persisted in localStorage (NEVER rename without a migration).
//   - label        header text.
//   - testId       data-testid on the row cell (existing tests assert these — keep them when visible).
//   - cellClass    className applied to the row <span> for styling reuse.
//   - defaultWidth grid track size token (e.g. '11rem'); the title column uses flex instead.
//   - minWidth     px floor enforced while drag-resizing.
//   - flex         when true the column takes the remaining space (minmax(0, 1fr)); width is ignored.
//   - defaultVisible  base 8 columns default to true so the page renders identically to before.
//
// 부서(department)/송고자(sender)/송고시간(sentAt) are REAL Contents columns (src/db/schema.js) returned
// by `SELECT c.*` in articleModel.query — department is stamped at create + backfilled, sender/sentAt are
// populated on 송고(DPS). They are OFF by default (opt-in extra columns); no phantom/empty columns added.
export const COLUMN_POOL = Object.freeze([
  { key: 'articleId', label: '기사아이디', testId: 'article-id', cellClass: 'yh-desk-row__id', defaultWidth: '11rem', minWidth: 80, defaultVisible: true },
  { key: 'title', label: '제목', cellClass: 'yh-article-row__title', flex: true, minWidth: 120, defaultVisible: true },
  { key: 'author', label: '작성자', testId: 'article-author', cellClass: 'yh-article-row__author', defaultWidth: '6rem', minWidth: 56, defaultVisible: true },
  { key: 'modifier', label: '수정자', testId: 'article-modifier', cellClass: 'yh-article-row__modifier', defaultWidth: '6rem', minWidth: 56, defaultVisible: true },
  { key: 'createdAt', label: '작성시간', testId: 'article-time', cellClass: 'yh-article-row__time', defaultWidth: '8.5rem', minWidth: 80, format: 'datetime', defaultVisible: true },
  { key: 'editedAt', label: '수정시간', testId: 'article-edited-time', cellClass: 'yh-article-row__time', defaultWidth: '8.5rem', minWidth: 80, format: 'datetime', defaultVisible: true },
  { key: 'status', label: '기사상태', testId: 'article-status', cellClass: 'yh-desk-row__status', defaultWidth: '4.5rem', minWidth: 48, defaultVisible: true },
  { key: 'lockYN', label: 'LockYN', testId: 'article-lockyn', cellClass: 'yh-desk-row__lock', defaultWidth: '4rem', minWidth: 40, fallback: 'N', defaultVisible: true },
  // Optional opt-in columns (real fields, default-hidden).
  { key: 'department', label: '부서', testId: 'article-department', cellClass: 'yh-desk-row__dept', defaultWidth: '6rem', minWidth: 56, defaultVisible: false },
  { key: 'sender', label: '송고자', testId: 'article-sender', cellClass: 'yh-article-row__author', defaultWidth: '6rem', minWidth: 56, defaultVisible: false },
  { key: 'sentAt', label: '송고시간', testId: 'article-sent-time', cellClass: 'yh-article-row__time', defaultWidth: '8.5rem', minWidth: 80, format: 'datetime', defaultVisible: false },
]);

// Fast key -> descriptor lookup.
const POOL_BY_KEY = Object.freeze(
  Object.fromEntries(COLUMN_POOL.map((c) => [c.key, c])),
);

// All pool keys in their canonical order.
const ALL_KEYS = Object.freeze(COLUMN_POOL.map((c) => c.key));

// Default inter-column gap in px (mirrors --yh-sp-sm = 0.5rem = 8px at the 16px root).
export const DEFAULT_GAP = 8;
// Gap slider bounds.
export const MIN_GAP = 0;
export const MAX_GAP = 32;

// localStorage key scheme: one entry per menu so the four menus configure independently.
const STORAGE_PREFIX = 'tech_day.viewColumns.';
export function storageKeyFor(menu) {
  return `${STORAGE_PREFIX}${menu}`;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
// State schema: { order: string[], visible: Record<key, boolean>, widths: Record<key, string>, gap: number }.
// width is the grid track size for non-flex columns (e.g. '6rem'); the flex column ignores width.
export function defaultColumnState() {
  const visible = {};
  const widths = {};
  for (const col of COLUMN_POOL) {
    visible[col.key] = col.defaultVisible;
    if (!col.flex) widths[col.key] = col.defaultWidth;
  }
  return { order: [...ALL_KEYS], visible, widths, gap: DEFAULT_GAP };
}

// Look up a column descriptor by key (or undefined for an unknown key).
export function columnByKey(key) {
  return POOL_BY_KEY[key];
}

// ---------------------------------------------------------------------------
// Sanitize / merge
// ---------------------------------------------------------------------------
// Reconcile a (possibly stale or partial) stored state against the current pool: drop unknown keys,
// append any newly-added pool columns at their default visibility, and fill missing widths/gap. This
// keeps old localStorage payloads forward-compatible when the pool gains a column.
export function sanitizeColumnState(raw) {
  const base = defaultColumnState();
  if (!raw || typeof raw !== 'object') return base;

  // order: keep stored known keys (de-duplicated), then append any pool keys not present.
  const seen = new Set();
  const order = [];
  if (Array.isArray(raw.order)) {
    for (const k of raw.order) {
      if (POOL_BY_KEY[k] && !seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
  }
  for (const k of ALL_KEYS) {
    if (!seen.has(k)) order.push(k);
  }

  // visible: stored boolean wins; otherwise the column default.
  const visible = {};
  for (const k of ALL_KEYS) {
    visible[k] = typeof raw.visible?.[k] === 'boolean' ? raw.visible[k] : base.visible[k];
  }

  // widths: stored string wins for non-flex columns; otherwise the default track.
  const widths = {};
  for (const col of COLUMN_POOL) {
    if (col.flex) continue;
    const stored = raw.widths?.[col.key];
    widths[col.key] = typeof stored === 'string' && stored ? stored : base.widths[col.key];
  }

  // gap: clamp a finite stored number into bounds; else default.
  const gap = Number.isFinite(raw.gap)
    ? Math.min(MAX_GAP, Math.max(MIN_GAP, raw.gap))
    : base.gap;

  return { order, visible, widths, gap };
}

// ---------------------------------------------------------------------------
// Persistence (localStorage with in-memory fallback)
// ---------------------------------------------------------------------------
// In-memory mirror used when localStorage is unavailable so config still survives within a session.
const memoryStore = new Map();

function readRaw(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // storage access threw (insecure context / disabled) — fall through to memory.
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function writeRaw(key, value) {
  // Always update the in-memory mirror so a later read is consistent even if localStorage throws.
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // quota/disabled — in-memory mirror already holds the value; no throw.
  }
}

// Load a menu's column state, reconciled against the current pool. Always returns a valid state.
export function loadColumnState(menu) {
  const raw = readRaw(storageKeyFor(menu));
  if (!raw) return defaultColumnState();
  try {
    return sanitizeColumnState(JSON.parse(raw));
  } catch {
    return defaultColumnState();
  }
}

// Persist a menu's column state (sanitized first so we never store garbage).
export function saveColumnState(menu, state) {
  const safe = sanitizeColumnState(state);
  try {
    writeRaw(storageKeyFor(menu), JSON.stringify(safe));
  } catch {
    // JSON.stringify cannot realistically throw here (plain data); guarded for total safety.
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Derivations for rendering
// ---------------------------------------------------------------------------
// Ordered list of visible column descriptors for the current state.
export function visibleColumns(state) {
  return state.order
    .filter((k) => state.visible[k])
    .map((k) => POOL_BY_KEY[k])
    .filter(Boolean);
}

// Build the grid-template-columns string shared by the header and every row. Flex columns become
// minmax(0, 1fr); fixed columns use their stored width track. An empty selection yields '' (caller
// renders no header/grid in that case). Guarantees header and rows stay byte-for-byte in sync.
export function buildGridTemplate(state) {
  const cols = visibleColumns(state);
  if (cols.length === 0) return '';
  return cols
    .map((col) => (col.flex ? 'minmax(0, 1fr)' : (state.widths[col.key] ?? col.defaultWidth)))
    .join(' ');
}
