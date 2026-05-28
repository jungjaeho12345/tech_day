// @MX:NOTE: [AUTO] Role-based editor coloring model (news.md 기사 에디터: 제목 파란색 / 부제목 빨간색 / 본문 검정색,
// Alt+Y "(끝)" 골드색). Pure, deterministic: maps body text -> a flat list of colored segments that the view
// renders as <span class="yh-line--*"> nodes inside the contentEditable, WITHOUT changing the underlying text.
//
// Line-role rule mirrors 후보 A (articleStructure.js): line[0] = title; lines after the title up to (not
// including) the first blank line = subtitle (capped at 4 lines); everything after = body. A trailing "(끝)"
// end marker is split into its own gold segment (it lives at the end of the body text).

import { END_MARKER } from '../model/editorContent.js';

const MAX_SUBTITLE_LINES = 4; // 2nd through 5th lines (matches articleStructure.js).

/** @typedef {{ text: string, cls: 'title'|'subtitle'|'body'|'end', newline: boolean }} ColorSegment */

/**
 * Assign a role class to each line of the body text (without the trailing end marker concern).
 * @param {string[]} lines
 * @returns {Array<'title'|'subtitle'|'body'>} per-line role classes
 */
function lineRoles(lines) {
  if (lines.length === 0) return [];
  const roles = new Array(lines.length).fill('body');
  roles[0] = 'title';
  const rest = lines.slice(1);
  // First blank line within the rest bounds the subtitle (else the 4-line cap does).
  let blankIndex = rest.findIndex((l) => l === '');
  const subtitleEnd = blankIndex === -1
    ? Math.min(MAX_SUBTITLE_LINES, rest.length)
    : Math.min(blankIndex, MAX_SUBTITLE_LINES);
  for (let i = 0; i < subtitleEnd; i += 1) {
    roles[i + 1] = 'subtitle';
  }
  // Lines from subtitleEnd onward (after the title) stay 'body' (default).
  return roles;
}

/**
 * Build the ordered colored segments for the editor body text. Pure & deterministic.
 * Newlines are represented by `newline: true` segments so the renderer can emit <br> between lines
 * while preserving exact character count (textContent must equal the original text).
 * @param {string} [text]
 * @returns {ColorSegment[]}
 */
export function buildColorSegments(text) {
  const source = typeof text === 'string' ? text : '';
  if (source === '') return [];

  // Detect a trailing end marker and peel it off so it can be colored gold separately.
  const hasEndMarker = source.endsWith(END_MARKER);
  const core = hasEndMarker ? source.slice(0, source.length - END_MARKER.length) : source;

  const lines = core.split('\n');
  const roles = lineRoles(lines);
  const segments = [];

  lines.forEach((line, i) => {
    if (i > 0) segments.push({ text: '\n', cls: roles[i], newline: true });
    if (line !== '') segments.push({ text: line, cls: roles[i], newline: false });
  });

  if (hasEndMarker) {
    segments.push({ text: END_MARKER, cls: 'end', newline: false });
  }
  return segments;
}
