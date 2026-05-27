// @MX:ANCHOR: [AUTO] Article ID generator — reused by backend SPEC for INSERT path (expected fan_in >= 3).
// @MX:REASON: implements the format + uniqueness contract (REQ-ID-001..005) the backend SPEC depends on.
//
// Article ID generation for SPEC-DB-FOUNDATION-001.
// Format: 'AKR' + YYYYMMDD + 9-digit zero-padded random => exactly 20 chars.
// On collision with an existing Article.articleId, the random portion regenerates until unique.

const RANDOM_MAX = 1_000_000_000; // 9 digits: 0 .. 999,999,999

/**
 * Build an article ID from a date and an explicit random integer.
 * @param {Date} date
 * @param {number} randomValue integer in [0, 999999999]
 * @returns {string} 20-char ID
 */
export function formatArticleId(date, randomValue) {
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const random = randomValue.toString().padStart(9, '0');
  return `AKR${yyyy}${mm}${dd}${random}`;
}

function defaultRandom() {
  return Math.floor(Math.random() * RANDOM_MAX);
}

/**
 * Generate a unique article ID, regenerating the random portion on collision.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ now?: Date, randomFn?: () => number }} [options]
 * @returns {string} unique 20-char article ID
 */
export function generateArticleId(db, options = {}) {
  const now = options.now ?? new Date();
  const randomFn = options.randomFn ?? defaultRandom;
  const exists = db.prepare('SELECT 1 FROM Article WHERE articleId = ?');

  for (;;) {
    const id = formatArticleId(now, randomFn());
    if (exists.get(id) === undefined) {
      return id;
    }
    // Collision (REQ-ID-004): regenerate random portion and retry.
  }
}
