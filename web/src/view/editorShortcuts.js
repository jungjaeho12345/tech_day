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
 * SPEC-NEWS-REVISE — 반환 객체에 deletedStart/deletedEnd(원본 value 기준 삭제된 문자 범위)를 함께 싣는다.
 * Ctrl+D 가 같은 라인 범위에 걸친 인라인 임베드(이미지/유투브/기사)를 함께 제거할 때, 임베드의 본문
 * 텍스트 오프셋이 [deletedStart, deletedEnd] 안에 들어오는지로 판정하기 위함이다. (기존 호출부는 value/
 * selectionStart/selectionEnd 만 읽으므로 하위호환.)
 *
 * @param {EditorState} state
 * @returns {EditorState & {deletedStart: number, deletedEnd: number}}
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
    return { value: '', selectionStart: 0, selectionEnd: 0, deletedStart: 0, deletedEnd: 0 };
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

  // 삭제된 원본 문자 범위(라인 사이 newline 1개 포함). 배열 slice+join 이 실제로 제거하는 구간과 일치시킨다:
  //  - 뒤에 살아남는 라인이 있으면: [startLine 시작, endLine+1 시작) — endLine 의 trailing newline 포함.
  //  - 마지막 라인(들)을 지우고 앞 라인이 있으면: 선행 newline 이 제거되므로 [startLine 시작 - 1, len).
  //  - 전부 삭제면: [0, len). 이 범위로 같은 라인에 놓인 임베드를 Ctrl+D 가 함께 제거한다.
  const hasSurvivingAfter = endLine + 1 < lines.length;
  const deletedStart = hasSurvivingAfter ? lineStarts[startLine] : Math.max(0, lineStarts[startLine] - 1);
  const deletedEnd = hasSurvivingAfter ? lineStarts[endLine + 1] : len;

  // 삭제 후 새 라인 배열.
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine + 1);
  const nextLines = before.concat(after);

  // 모두 사라졌으면 빈 본문.
  if (nextLines.length === 0) {
    return { value: '', selectionStart: 0, selectionEnd: 0, deletedStart, deletedEnd };
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
  return { value: nextValue, selectionStart: caret, selectionEnd: caret, deletedStart, deletedEnd };
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

/**
 * SPEC-NEWS-REVISE — Ctrl+D 가 캐럿/선택이 걸친 라인을 삭제할 때, 그 라인 범위에 위치한 인라인 임베드
 * (이미지/유투브/기사)도 함께 제거한 ORDERED content 를 만든다. 임베드는 본문 텍스트에 0글자를 기여하므로
 * (contentToText 가 text 블록만 이어붙임), 각 임베드의 "본문 텍스트 오프셋" = 그 앞에 놓인 text 블록 길이의
 * 합이다. deleteCurrentLine 이 돌려준 [deletedStart, deletedEnd] 범위 안(경계 포함)에 오프셋이 들어오는
 * 임베드만 드롭하고, 남는 임베드는 상대 순서를 보존한다. 텍스트는 deleteCurrentLine 의 결과(value)를 단일
 * text 블록으로 둔 뒤 남은 임베드를 뒤에 잇는 대신, 원래 인터리브를 유지하도록 라인 삭제를 블록 경계로 적용한다.
 *
 * 단순화 결정: 본문 편집 모델은 라인 삭제 후 캐럿을 라인 시작에 두므로, 남은 임베드를 인터리브 위치 그대로
 * 유지하기 위해 "삭제 범위 이전 텍스트 + 이후 텍스트"를 각각 text 블록으로 두고 그 사이/주변의 살아남은
 * 임베드를 원래 위치에 끼운다.
 *
 * @param {{blocks: Array<object>}} content ORDERED content (text/embed 블록이 실제 순서대로)
 * @param {{deletedStart: number, deletedEnd: number, value: string}} del deleteCurrentLine 결과
 * @returns {{blocks: Array<object>}} 라인 삭제 + 범위 내 임베드 제거가 반영된 새 content
 */
export function applyLineDeleteToContent(content, del) {
  const blocks = content?.blocks ?? [];
  const { deletedStart, deletedEnd } = del;
  const next = [];
  let offset = 0; // 지금까지 누적된 본문 텍스트 길이 (임베드는 0 기여).
  for (const b of blocks) {
    if (b.type === 'text') {
      const text = typeof b.text === 'string' ? b.text : '';
      const blockStart = offset;
      const blockEnd = offset + text.length;
      // 이 text 블록에서 [deletedStart, deletedEnd] 와 겹치는 구간을 잘라낸다.
      const keepLeft = blockStart < deletedStart ? text.slice(0, Math.max(0, deletedStart - blockStart)) : '';
      const keepRight = blockEnd > deletedEnd ? text.slice(Math.max(0, deletedEnd - blockStart)) : '';
      const kept = keepLeft + keepRight;
      if (kept !== '') next.push({ type: 'text', text: kept });
      offset = blockEnd;
    } else if (b.type === 'embed') {
      // 임베드 오프셋(offset)이 삭제 라인 범위에 속하면 드롭, 아니면 보존.
      // - deletedStart 이상 deletedEnd 미만: 명백히 삭제 라인 내부 → 드롭.
      // - deletedEnd 와 같은 경우: 마지막 라인 삭제(=문서 끝까지, deletedEnd === total)면 그 임베드는
      //   삭제 라인의 trailing 임베드이므로 드롭, 그렇지 않으면(살아남는 다음 라인 시작) 보존.
      const total = typeof del.value === 'string' ? del.value.length + (deletedEnd - deletedStart) : deletedEnd;
      const atDocEnd = deletedEnd >= total;
      const inRange = (offset >= deletedStart && offset < deletedEnd)
        || (offset === deletedEnd && atDocEnd);
      if (!inRange) next.push(b);
      // 임베드는 0글자 → offset 변화 없음.
    } else {
      next.push(b);
    }
  }
  return { blocks: next };
}
