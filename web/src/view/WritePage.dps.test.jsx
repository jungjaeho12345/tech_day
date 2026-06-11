// SPEC-NEWS-REVISE-011 REQ-DPS-BUTTONS / REQ-SUMMARY-LINE-RECONCILE — DPS 고침/포털고침 송고·보류 버튼
// 게이트 + 요약줄(델타 A) Δ-only 회귀 가드 (프론트엔드, vitest). 실행 `npm run test:web`.
//
// 패턴은 WritePage.ddh.test.jsx 차용: createFakeModel({ queryArticles }) + writer.do?id= 진입 +
// findByTestId('readonly-meta') 로 편집 컨텍스트 로드 완료를 기다린 뒤 버튼 매트릭스를 단언한다.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritePage } from './WritePage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER_R = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };
const USER_D = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
const USER_Z = { userId: 'z1', name: 'Admin', role: 'Z', department: 'Politics' };

function renderWrite(model, user) {
  return render(
    <ModelContext.Provider value={model}>
      <WritePage user={user} />
    </ModelContext.Provider>,
  );
}

// DPS 기사를 편집 컨텍스트로 로드하는 헬퍼 (?id= 진입 → queryArticles 스텁이 DPS row 반환).
function dpsModel(id, bodyText = '배부 대상 기사') {
  const row = {
    articleId: id,
    status: 'DPS',
    markupVersion: contentToMarkup(contentFromText(bodyText)),
    author: '기자',
  };
  return createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) });
}

describe('SPEC-NEWS-REVISE-011 — DPS 고침/포털고침 송고·보류 버튼 게이트', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // AC-DPS-BTN-1 (SPEC-NEWS-REVISE-011): DPS + R/D/Z 송고·보류 노출.
  for (const user of [USER_R, USER_D, USER_Z]) {
    it(`AC-DPS-BTN-1 (SPEC-NEWS-REVISE-011): DPS 기사에서 role ${user.role}는 송고/보류 버튼이 노출된다`, async () => {
      window.history.replaceState({}, '', `/writer.do?id=A-DPS-${user.role}`);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderWrite(dpsModel(`A-DPS-${user.role}`), user);
      await screen.findByTestId('readonly-meta');
      expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
    });
  }

  // AC-DPS-BTN-2 (SPEC-NEWS-REVISE-011): DPS KILL 비표시 (델타 B 신규줄은 송고/보류만 명시).
  for (const user of [USER_R, USER_D, USER_Z]) {
    it(`AC-DPS-BTN-2 (SPEC-NEWS-REVISE-011): DPS 기사에서 role ${user.role}는 KILL 버튼이 노출되지 않는다`, async () => {
      window.history.replaceState({}, '', `/writer.do?id=A-DPSK-${user.role}`);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderWrite(dpsModel(`A-DPSK-${user.role}`), user);
      await screen.findByTestId('readonly-meta');
      expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
    });
  }

  // AC-DPS-BTN-3 (SPEC-NEWS-REVISE-011): DPS 송고 가드 — 본문 끝 "(끝)" 마커가 없으면 송고 차단(ALERT),
  // applyAction(send) 전이가 적용되지 않는다(기존 RDS 송고 가드 재사용).
  it('AC-DPS-BTN-3 (SPEC-NEWS-REVISE-011): "(끝)" 없는 DPS 기사 송고 클릭 시 가드 ALERT + 전이 미발생', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-DPS-NOEND');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const row = {
      articleId: 'A-DPS-NOEND',
      status: 'DPS',
      markupVersion: contentToMarkup(contentFromText('끝 마커 없는 본문')),
      author: '기자',
    };
    const model = createFakeModel({
      queryArticles: vi.fn().mockResolvedValue([row]),
      applyAction,
    });
    renderWrite(model, USER_D);
    await screen.findByTestId('readonly-meta');
    screen.getByRole('button', { name: '송고' }).click();
    // "(끝)" 가드 발화 → ALERT, applyAction(send) 미호출.
    expect(alertSpy).toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
  });

  // AC-SUM-1 (SPEC-NEWS-REVISE-011): RDS 매트릭스 불변 — 송고/보류 R|D|Z, KILL R|Z(+!isDraft), D 는 KILL 비표시.
  // (편집 컨텍스트 RDS row 로드: isDraft=false 가 되어 R/Z KILL 노출 조건 충족)
  it('AC-SUM-1 (SPEC-NEWS-REVISE-011): RDS 기사 role R 은 송고/보류/KILL 모두 노출 (요약줄 변경 무관)', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-RDS-R');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const row = {
      articleId: 'A-RDS-R',
      status: 'RDS',
      markupVersion: contentToMarkup(contentFromText('초안 본문')),
      author: '기자',
    };
    renderWrite(createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), USER_R);
    await screen.findByTestId('readonly-meta');
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KILL' })).toBeInTheDocument();
  });

  // AC-SUM-4 (SPEC-NEWS-REVISE-011): RDS 기사에서 role D 의 KILL 비노출 (구체줄 우선 — 요약줄 곧이곧대로 금지).
  it('AC-SUM-4 (SPEC-NEWS-REVISE-011): RDS 기사 role D 는 송고/보류만, KILL 은 비노출', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-RDS-D');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const row = {
      articleId: 'A-RDS-D',
      status: 'RDS',
      markupVersion: contentToMarkup(contentFromText('초안 본문')),
      author: '기자',
    };
    renderWrite(createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }), USER_D);
    await screen.findByTestId('readonly-meta');
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });
});
