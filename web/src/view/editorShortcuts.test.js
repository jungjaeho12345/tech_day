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
