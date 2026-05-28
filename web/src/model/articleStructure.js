// @MX:NOTE: [AUTO] Deterministic article-structure parser (REQ-EDIT-PARSE) — 후보 A blank-line block separation.
//
// Pure, side-effect-free function that decomposes editor body TEXT into the three logical roles
// title (제목) / subtitle (부제목) / body (본문). The rule (confirmed 후보 A, plan.md §4):
//   1. line[0] = title.
//   2. From the line after the title up to (NOT including) the FIRST blank line, take those lines
//      as subtitle, capped at 4 lines (the 2nd-5th lines).
//   3. Everything after that first blank line = body.
//   4. If there is no blank line at all: lines 2-5 (max 4) = subtitle, line 6 onward = body.
// The same input always produces the same {title, subtitle, body} (deterministic, unit-testable).

const MAX_SUBTITLE_LINES = 4; // 2nd through 5th lines.

/**
 * Parse editor body text into {title, subtitle, body}. Pure & deterministic (REQ-EDIT-PARSE-005).
 * @param {string} [text]
 * @returns {{title: string, subtitle: string, body: string}}
 */
export function parseArticleStructure(text) {
  const source = typeof text === 'string' ? text : '';
  if (source === '') {
    return { title: '', subtitle: '', body: '' };
  }

  const lines = source.split('\n');
  const title = lines[0] ?? '';

  // Lines after the title.
  const rest = lines.slice(1);
  if (rest.length === 0) {
    return { title, subtitle: '', body: '' };
  }

  // Locate the first blank line within the rest (a blank line = produced by consecutive newlines).
  const blankIndex = rest.findIndex((line) => line === '');

  if (blankIndex === -1) {
    // Rule 4: no blank line -> 2nd-5th lines (max 4) = subtitle, 6th line onward = body.
    const subtitle = rest.slice(0, MAX_SUBTITLE_LINES).join('\n');
    const body = rest.slice(MAX_SUBTITLE_LINES).join('\n');
    return { title, subtitle, body };
  }

  // Rules 2-3: subtitle is the lines before the first blank line (capped at 4); body is everything after it.
  const subtitle = rest.slice(0, blankIndex).slice(0, MAX_SUBTITLE_LINES).join('\n');
  const body = rest.slice(blankIndex + 1).join('\n');
  return { title, subtitle, body };
}
