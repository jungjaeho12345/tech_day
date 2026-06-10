import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritePage } from './WritePage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER_D = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
const USER_R = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };

function renderWrite(model, user = USER_D) {
  return render(
    <ModelContext.Provider value={model}>
      <WritePage user={user} />
    </ModelContext.Provider>,
  );
}

describe('Issue #3 (Low): lockError 시 액션 버튼 disabled (SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('AC-BTN-DISABLED-1: 락 거부 시 role D 편집 컨텍스트에서 송고/보류 버튼이 비활성화된다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-LK1');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const row = {
      articleId: 'A-LK1',
      status: 'RDS',
      markupVersion: contentToMarkup(contentFromText('편집중')),
      author: '기자',
    };
    const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    renderWrite(
      createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]), lockArticle }),
      USER_D,
    );
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '송고' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '보류' })).toBeDisabled();
  });

  it('AC-BTN-DISABLED-2: 락 거부 시 role R 편집 컨텍스트에서 송고/보류/KILL 버튼이 모두 비활성화된다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-LK2');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const row = {
      articleId: 'A-LK2',
      status: 'RDS',
      markupVersion: contentToMarkup(contentFromText('편집중')),
      author: '기자',
    };
    const lockArticle = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    renderWrite(
      createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]), lockArticle }),
      USER_R,
    );
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '송고' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '보류' })).toBeDisabled();
    // SPEC-EDIT-LOCK-001: 락 거부 시 기사 로드가 차단되어 articleId 가 'A-DRAFT' 로 남는다.
    // KILL 은 !isDraft 게이트(v0.6.0, news.md "기사아이디가 생성되지 않은 기사는 KILL 미표시")로
    // 아예 렌더되지 않는 것이 현재 계약이다 — disabled 가 아니라 부재를 단언한다.
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });

  it('AC-BTN-DISABLED-3: 락 없는 정상 상태에서 버튼이 활성화된다 (회귀 가드)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWrite(createFakeModel(), USER_D);
    expect(screen.getByRole('button', { name: '송고' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '보류' })).toBeEnabled();
  });
});
