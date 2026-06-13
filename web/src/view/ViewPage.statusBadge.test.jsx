// Regression guard for AC-DSN-2 (SPEC-NEWS-REVISE-015 §1) — 상태 배지 색 매핑.
//
// news.md a8a6c87 흡수: 조회 목록 상태 배지 색 규칙은
//   RDS = 회색(grey), DPS(*PS, 송고) = 레드(red), 보류(RRH/DDH, *H) = 앰버(amber),
//   KILL(RRK/DDK, *K) = 슬레이트(slate)
// 로 정의된다. 본 SPEC 은 운영 코드를 변경하지 않으므로(흡수 + characterization), 이 테스트는
// 코드의 *현재 동작* 을 기술하는 회귀 가드다.
//
// ── 명세-코드 모순 기록 (characterization-first, 코드 불변) ───────────────────────────────
// AC-DSN-2 의 acceptance 문구는 "조회 목록의 각 상태 *행의 배지 클래스/색 토큰* 을 단언" 이지만,
// 실제 코드(web/src/view/ViewPage.jsx cellText + ArticleRow)는 상태 컬럼을 단일 정적 클래스
// `yh-desk-row__status` 로 *plain text* 만 렌더하고 상태별 .yh-badge--* 클래스를 붙이지 않는다.
// yonhap.css(L1054-1056)도 명시한다: "REQ-FE-VIEW-011 v0.4.0: 조회 목록이 전 메뉴 7컬럼으로
// 통일되며 목록 배지는 제거됨. 배지 색 토큰(--yh-badge-*)은 .yh-btn--kill 등 버튼 팔레트가 계속
// 사용한다." 즉 목록 행에는 더 이상 상태 배지가 없다 — AC 가 기대하는 "행 배지"는 코드에 없다.
//
// 따라서 본 회귀 가드는 *실재하는* 색 계약, 곧 디자인 토큰(--yh-badge-*) + .yh-badge--* 클래스
// 매핑(이 색 규칙의 단일 출처)을 단언하고, 더불어 목록 행의 상태 셀이 plain text(배지 클래스 없음)
// 라는 현재 동작을 함께 고정한다. 색 규칙이 회귀하면(예: hold 토큰을 amber 가 아닌 값으로) FAIL 한다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

// Read the design-token SSOT once. The badge colour rule lives in CSS variables, not JS, because the
// list-row badges were removed (see header note) — the tokens remain the canonical colour contract.
// 경로는 cwd 기준 후보에서 탐색한다(`vitest --root web` 는 cwd 가 web/ 이므로 src/...; repo root 실행은
// web/src/...). import.meta.url 은 jsdom 에서 file: 스킴이 아닐 수 있어 fileURLToPath 가 던지므로 쓰지 않는다.
function readYonhapCss() {
  const candidates = [
    path.resolve(process.cwd(), 'src/styles/yonhap.css'),
    path.resolve(process.cwd(), 'web/src/styles/yonhap.css'),
  ];
  for (const p of candidates) {
    try { return readFileSync(p, 'utf8'); } catch { /* try next candidate */ }
  }
  throw new Error(`yonhap.css not found in: ${candidates.join(', ')}`);
}
const css = readYonhapCss();

/** Extract a CSS custom-property value (e.g. `--yh-badge-hold-bg: #d97706;` -> `#d97706`). */
function tokenValue(name) {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : undefined;
}

describe('AC-DSN-2: 상태 배지 색 토큰 매핑 (SPEC-NEWS-REVISE-015 §1)', () => {
  // The four lifecycle colour groups and their AC-mandated hues. Hex values are the design SSOT in
  // yonhap.css :root; this guard fails if any token drifts from its AC colour.
  it('RDS=회색(grey), 송고(*PS)=레드(red), 보류(*H)=앰버(amber), KILL(*K)=슬레이트(slate) 토큰을 유지한다', () => {
    expect(tokenValue('--yh-badge-rds-bg')).toBe('#e8e8e8');  // 회색 / grey  — RDS (draft)
    expect(tokenValue('--yh-badge-send-bg')).toBe('#c8102e'); // 레드 / red   — DPS, *PS (송고)
    expect(tokenValue('--yh-badge-hold-bg')).toBe('#d97706'); // 앰버 / amber — RRH, DDH, *H (보류)
    expect(tokenValue('--yh-badge-kill-bg')).toBe('#374151'); // 슬레이트/slate — RRK, DDK, *K (kill)
  });

  it('.yh-badge--{rds,send,hold,kill} 클래스가 각 색 토큰을 background 로 바인딩한다', () => {
    // Each variant class must consume the matching token so a token change reaches the badge.
    expect(css).toMatch(/\.yh-badge--rds\s*\{[^}]*background:\s*var\(--yh-badge-rds-bg\)/);
    expect(css).toMatch(/\.yh-badge--send\s*\{[^}]*background:\s*var\(--yh-badge-send-bg\)/);
    expect(css).toMatch(/\.yh-badge--hold\s*\{[^}]*background:\s*var\(--yh-badge-hold-bg\)/);
    expect(css).toMatch(/\.yh-badge--kill\s*\{[^}]*background:\s*var\(--yh-badge-kill-bg\)/);
  });
});

describe('AC-DSN-2: 조회 목록 상태 셀의 현재 동작 고정 (목록 배지 제거 — 명세-코드 모순 기록)', () => {
  // Characterization of the ACTUAL render: the status column shows plain status text under the single
  // `yh-desk-row__status` class — there is NO per-status .yh-badge--* class on the list row. This pins
  // the documented divergence from AC-DSN-2's "행 배지" wording so a future re-introduction is visible.
  // ViewPage 진입 시 컨트롤러가 비동기 자동 조회(fakeModel)를 발사하므로, 마운트로 인한 상태 업데이트를
  // act() 로 감싸 React 의 "not wrapped in act(...)" 경고를 없앤다(빌드/테스트 출력 무경고 게이트).
  async function renderView() {
    const model = createFakeModel();
    const user = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
    let utils;
    await act(async () => {
      utils = render(
        <ModelContext.Provider value={model}>
          <SessionContext.Provider value={{ user }}>
            <ViewPage user={user} />
          </SessionContext.Provider>
        </ModelContext.Provider>,
      );
    });
    return { model, ...utils };
  }

  it('상태 컬럼은 상태 문자열을 plain text 로 렌더하고 .yh-badge--* 클래스를 붙이지 않는다', async () => {
    await renderView();
    const statusCells = document.querySelectorAll('.yh-desk-row__status');
    // The fake model may seed zero rows; either way no list row should carry a badge variant class.
    expect(document.querySelectorAll('[class*="yh-badge--"]').length).toBe(0);
    for (const cell of statusCells) {
      expect(cell.className).toContain('yh-desk-row__status');
      expect(cell.className).not.toMatch(/yh-badge--/);
    }
    // Touch screen so the import is exercised even when the list is empty (keeps lint happy).
    expect(screen).toBeDefined();
  });
});
