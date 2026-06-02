// SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D — Ctrl+D 라인 삭제 순수 함수.
// 본문 텍스트와 선택 상태를 받아, 선택에 일부라도 걸친 모든 라인을 라인 단위 round-up하여 제거한
// 새 텍스트와 보정된 캐럿 위치를 반환한다 (D-2 결정 잠금: VSCode Ctrl+Shift+K 스타일).
//
// DOM 의존성 없음 — Vitest 단위테스트로 결정성 검증 가능. React 통합(BodyEditor의 onKeyDown)에서
// contentEditable이 아닌 plain text 모델 기준으로 호출된다.

/**
 * @typedef {Object} EditorState
 * @property {string} value
 * @property {number} selectionStart
 * @property {number} selectionEnd
 */

/**
 * 캐럿/선택 위치가 걸친 라인(들)을 통째로 삭제한다.
 *
 * 라인 산출: text.split('\n') → lines[].
 * 선택 시작이 위치한 라인 startLine, 선택 끝이 위치한 라인 endLine. 단, selectionEnd가
 * 정확히 어느 라인의 시작 offset이면(=직전 \n 바로 뒤) 그 라인은 *미포함* — 선택이 라인을
 * 실제로 침범하지 않았다고 간주 (round-up 경계 보정).
 *
 * 캐럿 보정: 삭제 후 startLine 인덱스 위치의 새 라인 시작에 캐럿을 둔다.
 * - 그 인덱스가 새 lines 배열 길이 이상이면(=마지막 라인이 통째로 사라짐) 직전 라인의 끝.
 * - 모두 사라졌으면 (0, 0).
 *
 * @param {EditorState} state
 * @returns {EditorState}
 */
export function deleteCurrentLine(state) {
  const value = typeof state?.value === 'string' ? state.value : '';
  const len = value.length;
  const selStart = clamp(Number.isFinite(state?.selectionStart) ? state.selectionStart : 0, 0, len);
  const selEnd = clamp(Number.isFinite(state?.selectionEnd) ? state.selectionEnd : selStart, 0, len);
  const start = Math.min(selStart, selEnd);
  const end = Math.max(selStart, selEnd);

  // 빈 문서: 변화 없음.
  if (len === 0) {
    return { value: '', selectionStart: 0, selectionEnd: 0 };
  }

  const lines = value.split('\n');
  // 각 라인의 시작 offset을 누적해 둔다 (lines[i] 시작 = lineStarts[i]).
  const lineStarts = computeLineStarts(lines);

  // start가 속한 라인 index.
  const startLine = lineIndexAt(lineStarts, start);
  // end가 속한 라인 index. selection이 라인 시작 offset에 정확히 걸치고 start != end 이면,
  // 그 라인은 실제로 침범하지 않았다고 간주하고 직전 라인을 endLine으로 한다 (round-up 경계).
  let endLine = lineIndexAt(lineStarts, end);
  if (end > start && endLine > 0 && end === lineStarts[endLine]) {
    endLine = endLine - 1;
  }

  // 삭제 후 새 라인 배열.
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine + 1);
  const nextLines = before.concat(after);

  // 모두 사라졌으면 빈 본문.
  if (nextLines.length === 0) {
    return { value: '', selectionStart: 0, selectionEnd: 0 };
  }

  const nextValue = nextLines.join('\n');
  // 캐럿: 새 라인 인덱스 startLine 위치의 라인 시작.
  // - startLine < nextLines.length: 그 라인 시작.
  // - else: 직전 라인의 끝 (nextValue 끝).
  let caret;
  if (startLine < nextLines.length) {
    caret = computeLineStarts(nextLines)[startLine];
  } else {
    caret = nextValue.length;
  }
  return { value: nextValue, selectionStart: caret, selectionEnd: caret };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** lines 배열에서 각 라인의 본문 내 시작 offset 배열을 계산한다. */
function computeLineStarts(lines) {
  const starts = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = acc;
    acc += lines[i].length + 1; // '\n' 한 글자
  }
  return starts;
}

/** 주어진 offset이 속한 라인 index를 반환 (라인 시작 offset 포함, 다음 라인 시작 직전까지). */
function lineIndexAt(lineStarts, offset) {
  for (let i = lineStarts.length - 1; i >= 0; i--) {
    if (offset >= lineStarts[i]) return i;
  }
  return 0;
}
