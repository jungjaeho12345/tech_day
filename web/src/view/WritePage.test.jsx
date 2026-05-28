import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WritePage } from './WritePage.jsx';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';
import { setCaretCharOffset } from './editorCaret.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
// Reporter (role R) sees 송고/보류/KILL on an RDS article; editor (role Z) sees none of the three.
const REPORTER = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };
const EDITOR_Z = { userId: 'z1', name: 'Editor', role: 'Z', department: 'Politics' };

function renderWrite(model = createFakeModel(), user = USER) {
  return render(
    <ModelContext.Provider value={model}>
      <WritePage user={user} />
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
    // 작성자 is now pre-filled with the logged-in user name (USER.name='Desk') per news.md 공통정보;
    // it is sent in the DTO without retyping.
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
    // 보류 now requires a title (the editor's first line); type one so the DDH success path is exercised.
    await user.type(screen.getByTestId('editor-body'), '보류 제목');
    await user.click(screen.getByRole('button', { name: '보류' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'hold');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DDH');
  });

  it('EC-5: backend rejects transition -> no state change shown, rejection notified', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid-transition' });
    renderWrite(createFakeModel({ applyAction }));
    // Provide a title so the title-check passes and the request reaches the (rejecting) backend.
    await user.type(screen.getByTestId('editor-body'), '거부 제목');
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/거부|invalid/i);
    expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
  });
});

describe('WritePage 송고/보류 title requirement (news.md: 제목이 없으면 송고/보류 실패 ALERT)', () => {
  it('AC-TITLE-1: 송고 with an empty editor shows the no-title alert and does NOT save/apply', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    // No title typed -> the action is blocked locally before any Model call.
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/제목/);
    expect(saveArticle).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
  });

  it('AC-TITLE-2: 보류 with an empty editor shows the no-title alert and does NOT apply', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    renderWrite(createFakeModel({ applyAction }));
    await user.click(screen.getByRole('button', { name: '보류' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/제목/);
    expect(applyAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
  });

  it('AC-TITLE-3: with a title present, 송고 proceeds (regression)', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    await user.type(screen.getByTestId('editor-body'), '있는 제목');
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle).toHaveBeenCalled();
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DPS');
  });
});

describe('WritePage KILL action (news.md 기사작성 워크플로우, 기사 생애주기) [DP-F5]', () => {
  it('AC-KILL-1: KILL button appears alongside 송고/보류 for role R', () => {
    // KILL is role-R-only (news.md 기사 작성 페이지 내 버튼); render with a reporter to see it.
    renderWrite(createFakeModel(), REPORTER);
    expect(screen.getByRole('button', { name: 'KILL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
  });

  it('AC-KILL-2: KILL submits the kill action and shows the backend-returned state (R->RRK)', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'RRK' });
    // Role R required: KILL only renders for reporters.
    renderWrite(createFakeModel({ applyAction }), REPORTER);
    await user.click(screen.getByRole('button', { name: 'KILL' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'R', 'kill');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('RRK');
  });
});

describe('WritePage action-button visibility (news.md 기사 작성 페이지 내 버튼)', () => {
  afterEach(() => {
    // Some tests below drive the ?id= edit-load path; reset the shared jsdom URL so it does not leak.
    window.history.replaceState({}, '', '/');
  });

  it('role D draft (RDS): 송고/보류 visible, KILL hidden', () => {
    // A fresh draft starts at INITIAL_STATUS = RDS. Desk (role D) may 송고/보류 but never KILL.
    renderWrite(createFakeModel(), USER);
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });

  it('role R draft (RDS): 송고/보류/KILL all visible', () => {
    renderWrite(createFakeModel(), REPORTER);
    expect(screen.getByRole('button', { name: '송고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보류' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KILL' })).toBeInTheDocument();
  });

  it('role Z draft (RDS): none of 송고/보류/KILL are shown', () => {
    // Role Z can author/edit per spec but cannot transition the article.
    renderWrite(createFakeModel(), EDITOR_Z);
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });

  it('edit-loaded non-RDS article (DPS): all three buttons hidden even for role R', async () => {
    // An already-sent (DPS) article is not in-progress, so no transition buttons regardless of role.
    window.history.replaceState({}, '', '/writer.do?id=A-DPS');
    const row = {
      articleId: 'A-DPS',
      status: 'DPS',
      markupVersion: contentToMarkup(contentFromText('이미 송고된 기사')),
      author: '데스크',
    };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    renderWrite(createFakeModel({ queryArticles }), REPORTER);

    // Wait for the edit-load to settle (loaded author appears), then assert the buttons are gone.
    await screen.findByDisplayValue('데스크');
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });
});

describe('WritePage reset after successful action (news.md: 기사 작성페이지는 초기화 된다)', () => {
  it('AC-RESET-1: after 송고, editor body + embeds + common fields reset but status stays', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'YT clip', url: 'https://youtu.be/x', thumbnailUrl: 'https://t/x' }],
      error: false,
    });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ searchMedia, applyAction }));

    // Author a body, an embed, and a common field.
    await user.type(screen.getByTestId('editor-body'), 'draft body');
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'a');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 YT clip' }));
    await user.click(screen.getByRole('tab', { name: '공통정보' }));
    // 작성자 is pre-filled with the user name; overwrite it to assert reset re-defaults (not stays edited).
    const authorInput = within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자');
    await user.clear(authorInput);
    await user.type(authorInput, '수정된 작성자');

    // Embed present before send.
    expect(within(screen.getByTestId('editor-region')).getByTestId('embed-image')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '송고' }));

    // Status confirmation remains (AC-5.1 invariant).
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DPS');
    // Editor body text cleared.
    expect(screen.getByTestId('editor-body')).toHaveTextContent('');
    // Inline embeds gone.
    expect(within(screen.getByTestId('editor-region')).queryByTestId('embed-image')).not.toBeInTheDocument();
    // Common field reset: 작성자 re-defaults to the logged-in user name (news.md 공통정보), not blank.
    expect(within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자')).toHaveValue(USER.name);
  });

  it('AC-RESET-2: after KILL, the write page resets the same way', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'RRK' });
    // KILL is role-R-only now; render with a reporter so the KILL button exists to click.
    renderWrite(createFakeModel({ applyAction }), REPORTER);
    await user.type(screen.getByTestId('editor-body'), 'kill body');
    await user.click(screen.getByRole('button', { name: 'KILL' }));
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('RRK');
    expect(screen.getByTestId('editor-body')).toHaveTextContent('');
    // 작성자 re-defaults to the reporter's name after reset (news.md 공통정보).
    expect(within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자')).toHaveValue(REPORTER.name);
  });

  it('EC-RESET-3: a rejected action does NOT reset the page', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid-transition' });
    renderWrite(createFakeModel({ applyAction }));
    // Title present so the request reaches the (rejecting) backend rather than being blocked locally.
    await user.type(screen.getByTestId('editor-body'), '거부될 제목');
    // 작성자 is pre-filled; overwrite it so we can assert the edited value is preserved on rejection.
    const authorInput = within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자');
    await user.clear(authorInput);
    await user.type(authorInput, '편집됨');
    await user.click(screen.getByRole('button', { name: '송고' }));
    await screen.findByRole('alert');
    // Input preserved because the action was rejected.
    expect(within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자')).toHaveValue('편집됨');
  });
});

describe('WritePage editor coloring + Alt+Y (news.md 기사 에디터)', () => {
  it('after blur, the first line (제목) is wrapped in a blue-colored element', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '헤드라인 제목');
    // Coloring is re-applied on blur (NOT on every keystroke — Hangul IME safety).
    await user.tab();
    // The 제목 line is now inside a role-colored element (class marks it; resilient query by class).
    const titleEl = body.querySelector('.yh-line--title');
    expect(titleEl).not.toBeNull();
    expect(titleEl).toHaveTextContent('헤드라인 제목');
    // Underlying plain text is unchanged by the presentational coloring.
    expect(body).toHaveTextContent('헤드라인 제목');
  });

  it('Alt+Y inserts a newline + "(끝)" at the body end and renders it in a gold-colored element', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문 내용');
    await user.keyboard('{Alt>}y{/Alt}');

    // "\n (끝)" is appended to the body text (the marker is on its own new line)...
    expect(body.textContent).toBe('본문 내용\n (끝)');
    // ...and the trailing "(끝)" is rendered in a gold-colored element.
    const endEl = body.querySelector('.yh-end-mark');
    expect(endEl).not.toBeNull();
    expect(endEl).toHaveTextContent('(끝)');

    // It persists into markupVersion (round-trip): 송고 saves a DTO whose markupVersion contains "(끝)".
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].markupVersion).toContain('(끝)');
  });

  it('Alt+Y is idempotent: pressing it twice keeps exactly one "(끝)"', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문 내용');
    await user.keyboard('{Alt>}y{/Alt}');
    await user.keyboard('{Alt>}y{/Alt}'); // second Alt+Y -> no duplicate (news.md: 이미 있으면 삽입하지 않는다)
    expect(body.textContent).toBe('본문 내용\n (끝)');
    // Exactly one occurrence of the gold marker.
    expect(body.textContent.split('(끝)').length - 1).toBe(1);
    expect(body.querySelectorAll('.yh-end-mark')).toHaveLength(1);
  });
});

describe('WritePage Enter inserts a model "\\n" (caret-jump bug fix)', () => {
  // Regression for the real-browser bug: type 제목/부제/본문 then Enter -> caret jumped back to the first
  // line because the browser's default contentEditable Enter inserted block markup that did not match the
  // '\n'-based colored model. The fix intercepts Enter on keydown and splices a literal '\n' into the model
  // itself. jsdom can't render a visual caret, so we assert the MODEL result (the '\n' landing at the caret
  // offset and the full text being retained) — that is the substance of the fix.

  // The editor intercepts Enter on keydown (the one reliable, testable path). Fire an Enter keydown; Shift+
  // Enter sets shiftKey. (Both produce a single '\n' in this plain '\n'-based model.)
  function fireEnter(el, { shift = false } = {}) {
    return fireEvent.keyDown(el, { key: 'Enter', shiftKey: shift });
  }

  it('Enter at the end of the body appends a "\\n" and keeps the full text', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '제목줄');
    // Caret is at the end after typing. Press Enter.
    fireEnter(body);
    // Model now holds the text + a trailing newline (the new blank line the caret should sit on).
    expect(body.textContent).toBe('제목줄\n');
  });

  it('Enter in the MIDDLE splits the line at the caret, not at offset 0', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '제목본문'); // 4 chars
    // Place the caret between 제목 and 본문 (offset 2), then press Enter.
    setCaretCharOffset(body, 2);
    fireEnter(body);
    // The '\n' lands at the caret, splitting "제목" / "본문" — NOT at the start (the old bug symptom).
    expect(body.textContent).toBe('제목\n본문');
  });

  it('typing title -> Enter -> subtitle -> Enter -> body builds a multi-line model (the reported flow)', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '제목');
    fireEnter(body);
    // After Enter the caret is at offset 3 (just past the '\n'); continue typing the subtitle there.
    await user.type(body, '부제');
    fireEnter(body);
    await user.type(body, '본문');
    // All three lines present in order, separated by '\n' — multi-line authoring works.
    expect(body.textContent).toBe('제목\n부제\n본문');
  });

  it('Shift+Enter (insertLineBreak) also inserts a single "\\n"', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'line');
    fireEnter(body, { shift: true });
    expect(body.textContent).toBe('line\n');
  });

  it('a multi-line body round-trips into markupVersion on 송고 (the model carries the newlines)', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '제목');
    fireEnter(body);
    await user.type(body, '본문');
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle).toHaveBeenCalled();
    const markup = saveArticle.mock.calls[0][1].markupVersion;
    // The persisted markup carries the multi-line body text (제목\n본문).
    expect(markup).toContain('제목');
    expect(markup).toContain('본문');
    expect(JSON.parse(markup).blocks.some((b) => b.type === 'text' && b.text.includes('\n'))).toBe(true);
  });
});

describe('WritePage clipboard paste -> inline embed (news.md 기사 에디터: 붙여넣기 이미지/유투브)', () => {
  // Build a paste-event clipboardData stub. `imageFile` (a real File) sets up an image item;
  // `text` is returned by getData('text'). The 10%x10% size comes from the existing .yh-embed CSS.
  function pasteData({ imageFile = null, text = '' } = {}) {
    const itemList = [];
    if (imageFile) {
      itemList.push({ kind: 'file', type: imageFile.type, getAsFile: () => imageFile });
    }
    if (text) {
      itemList.push({ kind: 'string', type: 'text/plain', getAsFile: () => null });
    }
    const items = { length: itemList.length };
    itemList.forEach((it, i) => { items[i] = it; });
    return { items, getData: (t) => (t === 'text' || t === 'text/plain' ? text : '') };
  }

  it('pasting an image inserts an inline image embed (read as a data URL)', async () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    // A real File so jsdom's FileReader.readAsDataURL produces a real data: URL.
    const imageFile = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    fireEvent.paste(body, { clipboardData: pasteData({ imageFile }) });

    // The FileReader read is async; wait for the inline image embed to appear.
    const embed = await within(screen.getByTestId('editor-region')).findByTestId('embed-image');
    const img = within(embed).getByRole('img');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png/);
  });

  it('pasting a YouTube URL inserts an inline video embed', async () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    fireEvent.paste(body, {
      clipboardData: pasteData({ text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const embed = await within(screen.getByTestId('editor-region')).findByTestId('embed-video');
    expect(embed).toBeInTheDocument();
    // The pasted URL is carried on the embed (rendered as a link/title).
    expect(within(embed).getByText('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeInTheDocument();
  });

  it('pasting plain text creates NO embed and is not prevented (normal paste proceeds)', async () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    const evt = fireEvent.paste(body, { clipboardData: pasteData({ text: '그냥 텍스트' }) });
    // No embed strip appears.
    expect(within(screen.getByTestId('editor-region')).queryByTestId('embed-image')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('editor-region')).queryByTestId('embed-video')).not.toBeInTheDocument();
    // preventDefault was NOT called -> the event remains "not defaultPrevented" so the browser pastes text.
    expect(evt).toBe(true); // fireEvent returns true when the event was not cancelled (no preventDefault)
  });
});

describe('WritePage edit-load from ?id= (Feature 3 — 데스크 미송고 편집)', () => {
  afterEach(() => {
    // Reset the shared jsdom URL so a stale ?id= does not leak into other WritePage tests.
    window.history.replaceState({}, '', '/');
  });

  it('with ?id= set, loads the article markupVersion + common fields into the editor', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-555');
    const loadedMarkup = contentToMarkup(contentFromText('편집 대상 본문'));
    const row = { articleId: 'A-555', markupVersion: loadedMarkup, author: '편집기자', region: '부산' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    renderWrite(createFakeModel({ queryArticles }));

    // Editor body shows the loaded text. The body text is now wrapped in a role-colored <span>
    // (제목 파란색), so assert on the editor-body's textContent (resilient to the coloring markup).
    await screen.findByDisplayValue('편집기자');
    expect(screen.getByTestId('editor-body')).toHaveTextContent('편집 대상 본문');
    expect(within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자')).toHaveValue('편집기자');
    expect(within(screen.getByTestId('panel-공통정보')).getByLabelText('지역')).toHaveValue('부산');
    expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-555' });
  });

  it('saving the loaded article persists with the loaded id (update path)', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-777');
    const row = { articleId: 'A-777', markupVersion: contentToMarkup(contentFromText('기존')), author: '원본' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-777' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const user = userEvent.setup();
    renderWrite(createFakeModel({ queryArticles, saveArticle, applyAction }));

    // Wait until the loaded common field appears, then 송고.
    await screen.findByDisplayValue('원본');
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle.mock.calls[0][0]).toBe('A-777');
    expect(applyAction).toHaveBeenCalledWith('A-777', 'D', 'send');
  });
});
