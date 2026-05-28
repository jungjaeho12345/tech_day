import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WritePage } from './WritePage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderWrite(model = createFakeModel()) {
  return render(
    <ModelContext.Provider value={model}>
      <WritePage user={USER} />
    </ModelContext.Provider>,
  );
}

describe('WritePage layout/tabs/fields (REQ-FE-WRITE-001..006,015)', () => {
  it('AC-3.1: two regions + four tabs + 송고/보류 above tabs', () => {
    renderWrite();
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-region')).toBeInTheDocument();
    for (const tab of ['공통정보', '이미지', '영상', '글기사']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
  });

  it('AC-3.2: selecting a tab shows only that panel', async () => {
    const user = userEvent.setup();
    renderWrite();
    // Default: 공통정보 visible, others hidden.
    expect(screen.getByTestId('panel-공통정보')).toBeVisible();
    expect(screen.queryByTestId('panel-이미지')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    expect(screen.getByTestId('panel-이미지')).toBeVisible();
    expect(screen.queryByTestId('panel-공통정보')).not.toBeInTheDocument();
  });

  it('AC-3.3: 공통정보 tab has all required fields', () => {
    renderWrite();
    const fields = [
      '작성자', '공동작성', '내용', '지역', '속성', '키워드',
      '내부코멘트', '외부코멘트', '첨부파일', '자료파일', '엠바고 시간', '2차 엠바고 시간',
    ];
    const panel = screen.getByTestId('panel-공통정보');
    for (const f of fields) {
      expect(within(panel).getByLabelText(f)).toBeInTheDocument();
    }
  });
});

describe('WritePage media + text-article search (REQ-FE-WRITE-007..011) [DP-F3]', () => {
  it('AC-4.1: image search calls Model.searchMedia (proxy) and shows YouTube results', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'flood');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    expect(searchMedia).toHaveBeenCalledWith('flood');
    expect(await screen.findByText('YT clip')).toBeInTheDocument();
  });

  it('AC-4.2: provider-agnostic — Google fallback results are shown the same way', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'google', title: 'G result', url: 'https://g/x' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    await user.click(screen.getByRole('tab', { name: '영상' }));
    await user.type(within(screen.getByTestId('panel-영상')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-영상')).getByRole('button', { name: '검색' }));
    expect(await screen.findByText('G result')).toBeInTheDocument();
  });

  it('EC-2: both providers empty -> "결과 없음" shown, no crash', async () => {
    const user = userEvent.setup();
    renderWrite(createFakeModel({ searchMedia: vi.fn().mockResolvedValue({ items: [], error: true }) }));
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'none');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    expect(await screen.findByText('결과 없음')).toBeInTheDocument();
  });

  it('EC-2b: proxy call throws -> search error shown, other functions still work', async () => {
    const user = userEvent.setup();
    renderWrite(createFakeModel({ searchMedia: vi.fn().mockRejectedValue(new Error('network')) }));
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    expect(await screen.findByText('검색 오류')).toBeInTheDocument();
    // Other tabs still usable.
    await user.click(screen.getByRole('tab', { name: '공통정보' }));
    expect(screen.getByTestId('panel-공통정보')).toBeVisible();
  });

  it('AC-2/AC-4.1 embed: image-tab result renders a VISUAL inline image, not a marker string', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x', thumbnailUrl: 'https://thumb/x' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'flood');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 YT clip' }));

    const editorRegion = screen.getByTestId('editor-region');
    // NEW behavior: a visual inline image element appears (REQ-EDIT-EMBED-002).
    const embed = within(editorRegion).getByTestId('embed-image');
    const img = within(embed).getByRole('img');
    expect(img).toHaveAttribute('src', 'https://thumb/x');
    // OLD behavior gone: no plain "[youtube] url" marker text inside the editor body (REQ-EDIT-EMBED-001).
    expect(within(editorRegion).queryByText(/\[youtube\]/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId('editor-body')).queryByText('https://youtu.be/x')).not.toBeInTheDocument();
  });

  it('EC-5: image result without thumbnailUrl falls back to url and does not crash', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x' }], // no thumbnailUrl
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'flood');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 YT clip' }));
    const img = within(screen.getByTestId('editor-region')).getByRole('img');
    expect(img).toHaveAttribute('src', 'https://youtu.be/x');
  });

  it('AC-2/EC-3: 영상 tab result renders a VISUAL inline video reference card', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    await user.click(screen.getByRole('tab', { name: '영상' }));
    await user.type(within(screen.getByTestId('panel-영상')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-영상')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 YT clip' }));
    const editorRegion = screen.getByTestId('editor-region');
    expect(within(editorRegion).getByTestId('embed-video')).toBeInTheDocument();
    expect(within(editorRegion).getByText('YT clip')).toBeInTheDocument();
  });

  it('AC-4.3: 글기사 internal search + inline article card on select (not 기사:id marker)', async () => {
    const user = userEvent.setup();
    const searchArticles = vi.fn().mockResolvedValue([
      { articleId: 'A-1', title: '폭우 피해', content: '본문...' },
    ]);
    renderWrite(createFakeModel({ searchArticles }));
    await user.click(screen.getByRole('tab', { name: '글기사' }));
    await user.type(within(screen.getByTestId('panel-글기사')).getByLabelText('검색어'), '폭우');
    await user.click(within(screen.getByTestId('panel-글기사')).getByRole('button', { name: '검색' }));
    expect(searchArticles).toHaveBeenCalledWith('폭우');
    await user.click(await screen.findByRole('button', { name: '삽입 폭우 피해' }));

    const editorRegion = screen.getByTestId('editor-region');
    // NEW behavior: a visual inline article card showing the title (REQ-EDIT-EMBED-004).
    const card = within(editorRegion).getByTestId('embed-article');
    expect(within(card).getByText('폭우 피해')).toBeInTheDocument();
    // OLD behavior gone: no "기사:A-1" marker text (REQ-EDIT-EMBED-001).
    expect(within(editorRegion).queryByText('기사:A-1')).not.toBeInTheDocument();
  });

  it('EC-3: embedding image + youtube + article in sequence yields three distinct ordered embeds', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'M item', url: 'https://m/1', thumbnailUrl: 'https://t/1' }],
      error: false,
    });
    const searchArticles = vi.fn().mockResolvedValue([{ articleId: 'A-1', title: '내부기사', content: 'c' }]);
    renderWrite(createFakeModel({ searchMedia, searchArticles }));

    // image
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'a');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 M item' }));
    // video
    await user.click(screen.getByRole('tab', { name: '영상' }));
    await user.type(within(screen.getByTestId('panel-영상')).getByLabelText('검색어'), 'b');
    await user.click(within(screen.getByTestId('panel-영상')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 M item' }));
    // article
    await user.click(screen.getByRole('tab', { name: '글기사' }));
    await user.type(within(screen.getByTestId('panel-글기사')).getByLabelText('검색어'), 'c');
    await user.click(within(screen.getByTestId('panel-글기사')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 내부기사' }));

    const editorRegion = screen.getByTestId('editor-region');
    expect(within(editorRegion).getByTestId('embed-image')).toBeInTheDocument();
    expect(within(editorRegion).getByTestId('embed-video')).toBeInTheDocument();
    expect(within(editorRegion).getByTestId('embed-article')).toBeInTheDocument();
    // Order preserved: image before video before article in DOM order.
    const embeds = within(editorRegion).getAllByTestId(/^embed-/);
    expect(embeds.map((e) => e.getAttribute('data-testid'))).toEqual([
      'embed-image', 'embed-video', 'embed-article',
    ]);
  });
});

describe('WritePage send/hold (REQ-FE-WRITE-012..014) [DP-F5]', () => {
  it('AC-5.1: 송고 assembles DTO, sends action+DTO only, shows backend-returned state', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    await user.type(screen.getByTestId('editor-body'), 'hello body');
    await user.type(within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자'), 'Desk');
    await user.click(screen.getByRole('button', { name: '송고' }));

    // DTO assembled from editor markup + common-info fields and persisted.
    expect(saveArticle).toHaveBeenCalled();
    const dto = saveArticle.mock.calls[0][1];
    expect(dto).toMatchObject({ markupVersion: expect.stringContaining('hello body'), author: 'Desk' });
    // Action sent as send; client did NOT compute next state.
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DPS');
  });

  it('AC-5.2: 보류 submits hold action and shows returned state', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    renderWrite(createFakeModel({ applyAction }));
    await user.click(screen.getByRole('button', { name: '보류' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'hold');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DDH');
  });

  it('EC-5: backend rejects transition -> no state change shown, rejection notified', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid-transition' });
    renderWrite(createFakeModel({ applyAction }));
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/거부|invalid/i);
    expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
  });
});
