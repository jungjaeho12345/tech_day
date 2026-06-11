import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewPage } from './ViewPage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

const USER_D = { userId: 'd1', name: 'Desk', role: 'D', department: '정치부' };

function renderView() {
  return render(
    <ModelContext.Provider value={createFakeModel()}>
      <ViewPage user={USER_D} />
    </ModelContext.Provider>,
  );
}

describe('Issue #13 (Medium): DeptMultiSelect 외부 클릭 닫기 (news.md 기사 조회페이지)', () => {
  it('AC-MULTI-1: 드롭다운이 열린 후 외부를 클릭하면 닫힌다', async () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '부서별 송고' }));
    const trigger = await screen.findByRole('button', { name: /선택|전체/ });
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox', { name: '부서 선택' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox', { name: '부서 선택' })).not.toBeInTheDocument();
  });

  it('AC-MULTI-2: 드롭다운 내부 클릭은 닫지 않는다', async () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '부서별 송고' }));
    const trigger = await screen.findByRole('button', { name: /선택|전체/ });
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox', { name: '부서 선택' });
    fireEvent.mouseDown(listbox);
    expect(screen.queryByRole('listbox', { name: '부서 선택' })).toBeInTheDocument();
  });
});
