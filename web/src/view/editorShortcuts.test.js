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
import { deleteCurrentLine } from './editorShortcuts.js';
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
