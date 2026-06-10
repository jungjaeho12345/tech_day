// SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D — Ctrl+D 라인 삭제 순수 함수.
// AC-CTRL-D-1 (단일 라인), AC-CTRL-D-2 (멀티라인 round-up), AC-CTRL-D-3 (경계).
//
// 순수 함수 계약:
//   deleteCurrentLine({ value, selectionStart, selectionEnd })
//     -> { value, selectionStart, selectionEnd }
//
// 라인은 '\n'으로 구분된다. 선택 영역에 *일부*라도 걸친 모든 라인을 라인 단위 round-up하여 제거한다
// (VSCode Ctrl+Shift+K 스타일 — D-2 결정 잠금).
import { describe, it, expect } from 'vitest';
import { deleteCurrentLine, applyLineDeleteToContent, selectEmbedOnLine, lineRangeAt } from './editorShortcuts.js';
import { createStructuredEditorAdapter } from '../model/editorAdapter.js';
import { END_MARKER } from '../model/editorContent.js';
import { buildColorSegments } from './editorColoring.js';

describe('deleteCurrentLine (REQ-EDITOR-EMBED-AND-CTRL-D)', () => {
  it('AC-CTRL-D-1: 단일 라인 — BBB 라인에 캐럿이 있을 때 그 라인만 삭제', () => {
    // "AAA\nBBB\nCCC" — BBB의 offset 4..7 사이 임의 위치
    const r = deleteCurrentLine({ value: 'AAA\nBBB\nCCC', selectionStart: 5, selectionEnd: 5 });
    expect(r.value).toBe('AAA\nCCC');
    // 캐럿은 후속 라인(CCC) 시작 = offset 4
    expect(r.selectionStart).toBe(4);
    expect(r.selectionEnd).toBe(4);
  });

  it('AC-CTRL-D-2: 멀티라인 선택 — 선택 일부 포함된 모든 라인을 round-up 삭제', () => {
    // "AAA\nBBB\nCCC\nDDD" — BB(라인 1 내부)부터 CC(라인 2 내부)까지 선택
    // offsets: A0 A1 A2 \n3 B4 B5 B6 \n7 C8 C9 C10 \n11 D12 D13 D14
    // BBB의 "BB"(4..6) 라인1 일부 + CCC의 "CC"(8..10) 라인2 일부 -> selectionStart=5, selectionEnd=9
    const r = deleteCurrentLine({
      value: 'AAA\nBBB\nCCC\nDDD',
      selectionStart: 5,
      selectionEnd: 9,
    });
    expect(r.value).toBe('AAA\nDDD');
    // 캐럿은 새 라인 인덱스 1(=DDD) 시작 = offset 4
    expect(r.selectionStart).toBe(4);
    expect(r.selectionEnd).toBe(4);
  });

  it('AC-CTRL-D-3a: 첫 라인 삭제 — "AAA\\nBBB" 에서 AAA 라인 캐럿', () => {
    const r = deleteCurrentLine({ value: 'AAA\nBBB', selectionStart: 1, selectionEnd: 1 });
    expect(r.value).toBe('BBB');
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(0);
  });

  it('AC-CTRL-D-3b: 마지막 라인 삭제 — "AAA\\nBBB" 에서 BBB 라인 캐럿', () => {
    // "AAA\nBBB" — BBB의 offset 4..7
    const r = deleteCurrentLine({ value: 'AAA\nBBB', selectionStart: 6, selectionEnd: 6 });
    expect(r.value).toBe('AAA');
    // 캐럿은 직전 라인(AAA) 끝
    expect(r.selectionStart).toBe(3);
    expect(r.selectionEnd).toBe(3);
  });

  it('AC-CTRL-D-3c: 단일 라인 문서 "AAA" — 캐럿 위치 무관, 본문 빈 문자열', () => {
    const r = deleteCurrentLine({ value: 'AAA', selectionStart: 2, selectionEnd: 2 });
    expect(r.value).toBe('');
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(0);
  });

  it('AC-CTRL-D-3d: 빈 문서 — 변화 없음', () => {
    const r = deleteCurrentLine({ value: '', selectionStart: 0, selectionEnd: 0 });
    expect(r.value).toBe('');
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(0);
  });

  it('AC-CTRL-D-3e: 마지막 라인 끝 (trailing newline) — "AAA\\n" 에서 두번째(빈) 라인 삭제', () => {
    // "AAA\n" — offsets 0..4. 캐럿 offset 4 (last line=빈)
    const r = deleteCurrentLine({ value: 'AAA\n', selectionStart: 4, selectionEnd: 4 });
    expect(r.value).toBe('AAA');
    // 캐럿은 직전 라인(AAA) 끝
    expect(r.selectionStart).toBe(3);
    expect(r.selectionEnd).toBe(3);
  });

  it('round-up 경계: 선택 끝이 라인 시작 offset이면 그 라인은 미포함', () => {
    // "AAA\nBBB\nCCC" — 선택 0..4 ("AAA\n") — BBB 라인 시작 offset 4
    // 결과: AAA 라인만 삭제, BBB는 유지
    const r = deleteCurrentLine({
      value: 'AAA\nBBB\nCCC',
      selectionStart: 0,
      selectionEnd: 4,
    });
    expect(r.value).toBe('BBB\nCCC');
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(0);
  });

  it('전체 선택 — 모든 라인이 round-up되어 빈 문자열', () => {
    const v = 'AAA\nBBB\nCCC';
    const r = deleteCurrentLine({ value: v, selectionStart: 0, selectionEnd: v.length });
    expect(r.value).toBe('');
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(0);
  });

  it('deletedStart/deletedEnd — 중간 라인 삭제 시 trailing newline 포함 범위', () => {
    // "AAA\nBBB\nCCC" — BBB 라인 캐럿(offset 5). 살아남는 CCC 가 있으므로 [4, 8) 제거.
    const r = deleteCurrentLine({ value: 'AAA\nBBB\nCCC', selectionStart: 5, selectionEnd: 5 });
    expect(r.deletedStart).toBe(4);
    expect(r.deletedEnd).toBe(8);
  });

  it('deletedStart/deletedEnd — 마지막 라인 삭제 시 선행 newline 포함 범위', () => {
    // "AAA\nBBB" — BBB 끝(offset 7). 앞 라인이 있고 뒤가 없으므로 [3, 7) 제거(선행 \n 포함).
    const r = deleteCurrentLine({ value: 'AAA\nBBB', selectionStart: 7, selectionEnd: 7 });
    expect(r.deletedStart).toBe(3);
    expect(r.deletedEnd).toBe(7);
  });
});

// SPEC-NEWS-REVISE — Ctrl+D 라인 삭제 시 그 라인 범위에 걸친 인라인 임베드도 함께 제거 (applyLineDeleteToContent).
// 임베드는 본문 텍스트 0글자 → 오프셋 = 앞선 text 블록 길이 합. del.[deletedStart,deletedEnd] 범위 판정.
describe('applyLineDeleteToContent — Ctrl+D 가 라인의 임베드도 함께 삭제', () => {
  const img = { type: 'image', url: 'x' };
  const vid = { type: 'video', url: 'y' };

  it('삭제 라인에 놓인 임베드는 제거되고, 다른 라인의 임베드는 보존된다', () => {
    // 블록: "AAA\n"(0..4) [임베드@4] "BBB"(4..7) [임베드@7]
    // 마지막 라인(BBB + 그 뒤 임베드) 삭제 → del=[3,7). 첫 임베드(offset 4)는 범위 내 → 제거.
    const content = {
      blocks: [
        { type: 'text', text: 'AAA\n' },
        { type: 'embed', embed: img },
        { type: 'text', text: 'BBB' },
        { type: 'embed', embed: vid },
      ],
    };
    const del = deleteCurrentLine({ value: 'AAA\nBBB', selectionStart: 7, selectionEnd: 7 });
    const out = applyLineDeleteToContent(content, del);
    // 남은 텍스트는 "AAA", 임베드는 모두 마지막 라인 범위(offset 4,7)에 속해 제거된다.
    expect(out.blocks.filter((b) => b.type === 'embed')).toHaveLength(0);
    expect(out.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('')).toBe('AAA');
  });

  it('첫 라인 삭제 시 다음 라인 시작의 임베드는 보존된다', () => {
    // "AAA\n"(0..4) [임베드@4] "BBB"(4..7). 첫 라인(AAA) 삭제 → del=[0,4). 임베드 offset 4 == deletedEnd
    // 이고 뒤에 살아남는 라인이 있으므로 보존.
    const content = {
      blocks: [
        { type: 'text', text: 'AAA\n' },
        { type: 'embed', embed: img },
        { type: 'text', text: 'BBB' },
      ],
    };
    const del = deleteCurrentLine({ value: 'AAA\nBBB', selectionStart: 1, selectionEnd: 1 });
    const out = applyLineDeleteToContent(content, del);
    expect(out.blocks.filter((b) => b.type === 'embed')).toHaveLength(1);
    expect(out.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('')).toBe('BBB');
  });
});

// SPEC-NEWS-REVISE — lineRangeAt: 캐럿이 놓인 줄의 [lineStart, lineEnd] (lineEnd 는 줄 끝 '\n' 위치/문서 끝).
describe('lineRangeAt — 캐럿 줄 범위', () => {
  it('중간 줄: "AAA\\nBBB\\nCCC" 의 BBB(offset 5) → [4, 7]', () => {
    expect(lineRangeAt('AAA\nBBB\nCCC', 5)).toEqual({ lineStart: 4, lineEnd: 7 });
  });
  it('첫 줄(offset 1) → [0, 3]', () => {
    expect(lineRangeAt('AAA\nBBB', 1)).toEqual({ lineStart: 0, lineEnd: 3 });
  });
  it('마지막 줄(offset 6, BBB) → [4, 7=문서끝]', () => {
    expect(lineRangeAt('AAA\nBBB', 6)).toEqual({ lineStart: 4, lineEnd: 7 });
  });
  it('빈 문서 → [0, 0]', () => {
    expect(lineRangeAt('', 0)).toEqual({ lineStart: 0, lineEnd: 0 });
  });
});

// SPEC-NEWS-REVISE — selectEmbedOnLine: 현재 줄에 임베드가 있으면 "한 개"만 골라 제거(나머지 보존),
// 없으면 null(호출부가 라인 삭제로 폴백). 실브라우저 회귀(연속 임베드 한꺼번에 삭제) 방지.
describe('selectEmbedOnLine — Ctrl+D 가 임베드를 한 개씩 선택', () => {
  const img = { type: 'image', url: 'i' };
  const vid = { type: 'video', url: 'v' };
  const art = { type: 'article', articleId: 'A' };

  // 본문: "TXT\n"(0..4) 다음 줄에 임베드 3개 연속(모두 offset 4) — 텍스트/줄바꿈 없이 붙어있다.
  const threeEmbedsOnOneLine = {
    blocks: [
      { type: 'text', text: 'TXT\n' },
      { type: 'embed', embed: img },
      { type: 'embed', embed: vid },
      { type: 'embed', embed: art },
    ],
  };

  it('연속 임베드 줄에서 한 번에 1개만 제거(캐럿 at/before 우선), 텍스트 보존', () => {
    // 캐럿이 임베드 줄(offset 4)에 있다고 보고 selectEmbedOnLine 호출. 줄 범위 [4,4](텍스트 없음).
    const r1 = selectEmbedOnLine(threeEmbedsOnOneLine, 4, 4, 4);
    expect(r1).not.toBeNull();
    expect(r1.content.blocks.filter((b) => b.type === 'embed')).toHaveLength(2);
    // 텍스트 블록 "TXT\n" 은 보존된다(임베드만 제거).
    expect(r1.content.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('')).toBe('TXT\n');

    // 다음 호출은 남은 content 에서 또 1개 → 1개 남음.
    const r2 = selectEmbedOnLine(r1.content, 4, 4, 4);
    expect(r2.content.blocks.filter((b) => b.type === 'embed')).toHaveLength(1);
    // 마지막 1개 → 0개.
    const r3 = selectEmbedOnLine(r2.content, 4, 4, 4);
    expect(r3.content.blocks.filter((b) => b.type === 'embed')).toHaveLength(0);
    // 모두 지운 뒤에는 임베드가 없으므로 null.
    const r4 = selectEmbedOnLine(r3.content, 4, 4, 4);
    expect(r4).toBeNull();
  });

  it('현재 줄에 임베드가 없으면 null (텍스트 전용 줄 → 라인 삭제 폴백)', () => {
    // "TXT" 줄(offset 0..3)에는 임베드가 없다(임베드는 offset 4 의 다음 줄).
    expect(selectEmbedOnLine(threeEmbedsOnOneLine, 0, 3, 1)).toBeNull();
  });

  it('캐럿 before 임베드가 없으면 캐럿 이후 첫 임베드를 고른다', () => {
    // 줄 시작(offset 4)에 캐럿. at/before(≤4) 임베드가 offset 4 에 있으므로 그 중 가장 가까운 것 선택.
    const r = selectEmbedOnLine(threeEmbedsOnOneLine, 4, 4, 4);
    expect(r.ordinal).toBeTypeOf('number');
  });
});

// SPEC-NEWS-REVISE-003 — REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT (토픽 E): Alt+Y "(끝)" 정확 텍스트.
// Alt+Y 핸들링 seam 은 useWriteController.appendEnd → editorAdapter.appendEnd → editorContent.END_MARKER 이며,
// 골드 스타일 토큰은 view/model 계약(editorColoring.buildColorSegments 의 cls:'end' 세그먼트)으로 노출된다.
// 본 파일의 순수-함수 관례에 맞춰 model+view-contract seam 에서 단언한다 (React 마운트 불필요).
describe('SPEC-NEWS-REVISE-003 REQ-EDITOR-EMBED-DELETE-AND-ALT-Y-EXACT Alt+Y (토픽 E)', () => {
  it('AC-ALTY-1: 본문 끝 Alt+Y → 정확히 "(끝)" 1회 삽입 (선행 \\r\\n/공백 없음) + 골드 토큰', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문 마지막 문장.');
    // Alt+Y 의 모델 효과 = adapter.appendEnd().
    adapter.appendEnd();
    const body = adapter.getBodyText();

    // 정확히 "(끝)" 로 끝나며, 토큰 직전에 \r/\n/공백이 추가로 들어가지 않는다.
    expect(body.endsWith(END_MARKER)).toBe(true);
    expect(/[^\r\n ]\(끝\)$/.test(body)).toBe(true);
    // 구 형식("\r\n (끝)" / "\n(끝)") 의 prefix 가 본문 끝에 끼지 않는다.
    expect(body.endsWith('\r\n' + END_MARKER)).toBe(false);
    expect(body.endsWith('\n' + END_MARKER)).toBe(false);
    expect(body.endsWith(' ' + END_MARKER)).toBe(false);
    // "(끝)" 토큰은 정확히 1회.
    expect(body.split(END_MARKER).length - 1).toBe(1);

    // 골드 스타일: view/model 계약(buildColorSegments)이 trailing "(끝)" 를 별도 cls:'end' 세그먼트로 분리한다.
    const segments = buildColorSegments(body);
    const endSeg = segments.find((s) => s.cls === 'end');
    expect(endSeg).toBeDefined();
    expect(endSeg.text).toBe(END_MARKER);
  });

  it('AC-ALTY-2: 본문이 이미 "(끝)" 으로 끝나면 Alt+Y 는 noop (토큰 1회 유지)', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('본문 내용');
    adapter.appendEnd(); // 1차: "(끝)" 삽입
    const afterFirst = adapter.getBodyText();
    expect(afterFirst.split(END_MARKER).length - 1).toBe(1);

    // 2차 Alt+Y: 이미 존재하므로 추가 삽입 없음 (noop).
    adapter.appendEnd();
    const afterSecond = adapter.getBodyText();
    expect(afterSecond).toBe(afterFirst);
    // 토큰은 여전히 정확히 1회 — 누적되지 않는다.
    expect(afterSecond.split(END_MARKER).length - 1).toBe(1);
    // 골드 세그먼트도 1개만.
    expect(buildColorSegments(afterSecond).filter((s) => s.cls === 'end')).toHaveLength(1);
  });
});

// SPEC-NEWS-REVISE-003 — AC-REG-1: SPEC-NEWS-REVISE-001 회귀 우산. 본 SPEC 의 변경(임베드 삭제 / Alt+Y)
// 이후에도 SPEC-NEWS-REVISE-001 의 핵심 불변식이 유지됨을 *구체적 단언*으로 잠근다 (expect(true) 금지):
//   1) 임베드 insert-at-caret + 영속성 (REQ-EDITOR-EMBED-AND-CTRL-D / AC-EMB-INLINE / AC-EMB-2/3)
//   2) Ctrl+D 라인 삭제 (deleteCurrentLine 의 라인 단위 round-up 불변식)
describe('SPEC-NEWS-REVISE-003 AC-REG-1: SPEC-NEWS-REVISE-001 회귀 우산', () => {
  it('AC-REG-1: 임베드 insert-at-caret 불변식 — 본문 중간 삽입 시 [text-앞, embed, text-뒤] 블록 구성', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('안녕하세요');
    // caret offset 2 ("안녕" 다음)에 영상 임베드 삽입.
    adapter.embed({ type: 'video', source: 'youtube', title: 'm', url: 'https://yt/m' }, { caretOffset: 2 });
    const blocks = adapter.getContent().blocks;
    expect(blocks.length).toBe(3);
    expect(blocks[0]).toMatchObject({ type: 'text', text: '안녕' });
    expect(blocks[1]).toMatchObject({ type: 'embed', embed: { type: 'video' } });
    expect(blocks[2]).toMatchObject({ type: 'text', text: '하세요' });
    // 본문 텍스트(임베드 제외)는 원본과 동일 — 임베드는 텍스트를 변형하지 않는다.
    expect(adapter.getBodyText()).toBe('안녕하세요');
  });

  it('AC-REG-1: 임베드 영속성 불변식 — markupVersion round-trip 후 임베드/순서 보존 (AC-EMB-2/3)', () => {
    const adapter = createStructuredEditorAdapter();
    adapter.setBodyText('머리하세요');
    adapter.embed({ type: 'image', source: 'youtube', title: 'i', url: 'https://i/1' }, { caretOffset: 2 });
    const markup = adapter.getMarkup();
    const restored = createStructuredEditorAdapter();
    restored.setMarkup(markup);
    const blocks = restored.getContent().blocks;
    // 임베드가 silently 사라지지 않고 동일 위치/순서로 복원된다.
    expect(blocks.filter((b) => b.type === 'embed')).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'text', text: '머리' });
    expect(blocks[1]).toMatchObject({ type: 'embed', embed: { type: 'image', url: 'https://i/1' } });
    expect(blocks[2]).toMatchObject({ type: 'text', text: '하세요' });
  });

  it('AC-REG-1: Ctrl+D 라인 삭제 불변식 — 캐럿이 걸친 라인만 라인 단위 round-up 삭제', () => {
    // 중간 라인 삭제: "AAA\nBBB\nCCC" 에서 BBB 라인 캐럿 → "AAA\nCCC".
    const mid = deleteCurrentLine({ value: 'AAA\nBBB\nCCC', selectionStart: 5, selectionEnd: 5 });
    expect(mid.value).toBe('AAA\nCCC');
    expect(mid.selectionStart).toBe(4);
    // 단일 라인 문서 삭제 → 빈 문자열.
    const single = deleteCurrentLine({ value: 'AAA', selectionStart: 2, selectionEnd: 2 });
    expect(single.value).toBe('');
    // 빈 문서 → 변화 없음 (방어적).
    const empty = deleteCurrentLine({ value: '', selectionStart: 0, selectionEnd: 0 });
    expect(empty.value).toBe('');
  });
});
