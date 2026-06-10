import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritePage } from './WritePage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER_D = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
const USER_Z = { userId: 'z1', name: 'Admin', role: 'Z', department: 'Politics' };
const USER_R = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };

function renderWrite(model, user = USER_D) {
  return render(
    <ModelContext.Provider value={model}>
      <WritePage user={user} />
    </ModelContext.Provider>,
  );
}

describe('Issue #9 (Medium): DDH 기사 버튼 표시 (news.md 기사 작성 페이지 내 버튼)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('AC-DDH-1: DDH 기사에서 role D는 송고만 보이고 KILL 버튼은 보이지 않는다 (news.md 권한 매트릭스)', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-DDH1');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const row = {
      articleId: 'A-DDH1',
      status: 'DDH',
      markupVersion: contentToMarkup(contentFromText('보류된 기사')),
      author: '기자',
    };
    renderWrite(
      createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }),
      USER_D,
    );
    await screen.findByTestId('readonly-meta');
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
  });

  it('AC-DDH-2: DDH 기사에서 role Z는 송고/KILL 버튼만 보이고 보류 버튼은 없다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-DDH2');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const row = {
      articleId: 'A-DDH2',
      status: 'DDH',
      markupVersion: contentToMarkup(contentFromText('보류된 기사')),
      author: '기자',
    };
    renderWrite(
      createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }),
      USER_Z,
    );
    await screen.findByTestId('readonly-meta');
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KILL' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
  });

  it('AC-DDH-3: DDH 기사에서 role R은 어떤 액션 버튼도 보이지 않는다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-DDH3');
    const row = {
      articleId: 'A-DDH3',
      status: 'DDH',
      markupVersion: contentToMarkup(contentFromText('보류된 기사')),
      author: '기자',
    };
    renderWrite(
      createFakeModel({ queryArticles: vi.fn().mockResolvedValue([row]) }),
      USER_R,
    );
    await screen.findByTestId('readonly-meta');
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });

  it('AC-DDH-4: RDS 기사에서 role D는 송고/보류 버튼이 보인다 (회귀 가드)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWrite(createFakeModel(), USER_D);
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
  });
});
