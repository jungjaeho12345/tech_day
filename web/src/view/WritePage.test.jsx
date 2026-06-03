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

// SPEC-NEWS-REVISE-003 — REQ-WRITE-LIFECYCLE-API AC-WLC-4 (토픽 D): 제목 미입력 → ALERT + API 미호출.
// 002 AC-API-4 / news.md "제목이 없으면 송고/보류 실패" 와 정합. 빈 문자열과 공백만 두 케이스를 잠근다.
// 에러는 role="alert" 로 렌더되며 메시지는 /제목.*없/ 에 매치되어야 한다 (loose regex — 정확 문구 비종속).
describe('SPEC-NEWS-REVISE-003 REQ-WRITE-LIFECYCLE-API AC-WLC-4 (토픽 D)', () => {
  for (const [label, titleInput] of [['빈 문자열', ''], ['공백만', '   ']]) {
    it(`AC-WLC-4: 제목=${label} + 송고 → ALERT 1회(/제목.*없/) + saveArticle/applyAction 모두 미호출`, async () => {
      const user = userEvent.setup();
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
      renderWrite(createFakeModel({ saveArticle, applyAction }));
      const body = screen.getByTestId('editor-body');
      // 빈 문자열은 아무것도 입력하지 않고, 공백만은 공백을 입력한다 (첫 라인 = 제목).
      if (titleInput !== '') {
        await user.type(body, titleInput);
      }
      await user.click(screen.getByRole('button', { name: '송고' }));

      // ALERT 가 정확히 1개 렌더되고 메시지가 /제목.*없/ 에 매치된다.
      const alerts = await screen.findAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveTextContent(/제목.*없/);
      // 어떤 transport 도 호출되지 않는다 (Insert/Update 진입 이전 가드).
      expect(saveArticle).not.toHaveBeenCalled();
      expect(applyAction).not.toHaveBeenCalled();
      // 백엔드 반환 상태도 표시되지 않는다.
      expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
    });

    it(`AC-WLC-4: 제목=${label} + 보류 → ALERT 1회(/제목.*없/) + saveArticle/applyAction 모두 미호출`, async () => {
      const user = userEvent.setup();
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
      renderWrite(createFakeModel({ saveArticle, applyAction }));
      const body = screen.getByTestId('editor-body');
      if (titleInput !== '') {
        await user.type(body, titleInput);
      }
      await user.click(screen.getByRole('button', { name: '보류' }));

      const alerts = await screen.findAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveTextContent(/제목.*없/);
      expect(saveArticle).not.toHaveBeenCalled();
      expect(applyAction).not.toHaveBeenCalled();
      expect(screen.queryByTestId('lifecycle-status')).not.toBeInTheDocument();
    });
  }
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

  // SPEC-NEWS-REVISE-001 / REQ-AUTH-Z-BUTTONS AC-Z-1:
  // Z권한도 RDS 기사에서는 송고/보류/KILL 3개 버튼이 모두 보인다 (R과 동일 매트릭스).
  it('AC-Z-1: role Z draft (RDS): 송고/보류/KILL all visible and enabled', () => {
    renderWrite(createFakeModel(), EDITOR_Z);
    const send = screen.getByRole('button', { name: '송고' });
    const hold = screen.getByRole('button', { name: '보류' });
    const kill = screen.getByRole('button', { name: 'KILL' });
    expect(send).toBeInTheDocument();
    expect(hold).toBeInTheDocument();
    expect(kill).toBeInTheDocument();
    expect(send).toBeEnabled();
    expect(hold).toBeEnabled();
    expect(kill).toBeEnabled();
  });

  // SPEC-NEWS-REVISE-001 AC-Z-2: Z권한이라도 송고/보류/KILL 외 추가 액션 버튼은 노출 금지.
  it('AC-Z-2: role Z (RDS) does not expose any extra action buttons beyond 송고/보류/KILL', () => {
    renderWrite(createFakeModel(), EDITOR_Z);
    for (const extra of ['고침', '포털고침', '재송', '삭제요청', '후속기사작성']) {
      expect(screen.queryByRole('button', { name: extra })).not.toBeInTheDocument();
    }
    // 액션 컨테이너(yh-meta-actions) 내부에 정확히 3개의 버튼만 존재한다.
    const actionsContainer = document.querySelector('.yh-meta-actions');
    expect(actionsContainer).not.toBeNull();
    const buttons = actionsContainer.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    const names = Array.from(buttons).map((b) => b.textContent);
    expect(new Set(names)).toEqual(new Set(['송고', '보류', 'KILL']));
  });

  // SPEC-NEWS-REVISE-001 AC-Z-3: Z권한이라도 status가 RDS가 아니면 송고/보류/KILL 비표시 (D-1 잠금).
  it('AC-Z-3: role Z with non-RDS article (DPS): 송고/보류/KILL all hidden', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-DPS-Z');
    const row = {
      articleId: 'A-DPS-Z',
      status: 'DPS',
      markupVersion: contentToMarkup(contentFromText('이미 송고된 기사')),
      author: '편집자',
    };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    renderWrite(createFakeModel({ queryArticles }), EDITOR_Z);
    await screen.findByDisplayValue('편집자');
    expect(screen.queryByRole('button', { name: '송고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보류' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KILL' })).not.toBeInTheDocument();
  });

  // SPEC-NEWS-REVISE-001 AC-Z-5: 접근성 — Z권한 버튼들이 키보드 포커스 가능 + visible text.
  it('AC-Z-5: role Z buttons are keyboard-focusable and have visible accessible labels', () => {
    renderWrite(createFakeModel(), EDITOR_Z);
    for (const name of ['송고', '보류', 'KILL']) {
      const btn = screen.getByRole('button', { name });
      // visible text가 있어 role + name 기반 쿼리가 성공한다는 사실이 접근 가능 라벨 존재의 증거.
      expect(btn.textContent.trim()).toBe(name);
      btn.focus();
      expect(document.activeElement).toBe(btn);
    }
  });

  // SPEC-NEWS-REVISE-001 REQ-AUTH-Z-BUTTONS 회귀 가드: Z 클릭 시 articleUpdate 호출 경로가 살아 있다.
  it('AC-Z (regression): role Z KILL click triggers applyAction(kill) and shows returned status', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'RRK' });
    renderWrite(createFakeModel({ applyAction }), EDITOR_Z);
    await user.click(screen.getByRole('button', { name: 'KILL' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'Z', 'kill');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('RRK');
  });

  // PR-REVIEW REGRESSION (lifecycle gap): Z권한 송고/보류 클릭 시 applyAction이 'Z' role로 호출되는지
  // 검증. 현재 백엔드 lifecycle.js TRANSITIONS 맵에 'RDS|Z|send/hold'가 없어 ok:false 반환되며
  // 프론트는 actionError를 표시하지만 dispatch 자체는 정상 발생해야 한다 (visibility만 검증한 AC-Z-1과
  // 별도). 백엔드 lifecycle 정책이 추후 Z권한을 허용하도록 확장되면 이 테스트는 그 시점의 ok:false ->
  // 성공 mock으로 자연스럽게 진화시킬 수 있다.
  // SPEC-NEWS-REVISE-001 D-6: Z권한 송고/보류 click -> applyAction('Z', send|hold) dispatch +
  // 백엔드 success 응답 (DPS/DDH) 반영. visibility AC-Z-1과는 별개로 click->backend 경로를 잠근다.
  it('AC-Z (regression): role Z 송고 click -> applyAction(Z, send) and DPS status displayed', async () => {
    const user = userEvent.setup();
    // D-6: lifecycle.js Z|send -> DPS (D-mirror)
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ applyAction }), EDITOR_Z);
    // send/hold는 제목(에디터 첫 라인)이 비어있으면 client-side에서 차단되므로 제목 입력 필요.
    await user.type(screen.getByTestId('editor-body'), 'Z테스트제목');
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'Z', 'send');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DPS');
  });

  it('AC-Z (regression): role Z 보류 click -> applyAction(Z, hold) and DDH status displayed', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    renderWrite(createFakeModel({ applyAction }), EDITOR_Z);
    await user.type(screen.getByTestId('editor-body'), 'Z보류제목');
    await user.click(screen.getByRole('button', { name: '보류' }));
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'Z', 'hold');
    expect(await screen.findByTestId('lifecycle-status')).toHaveTextContent('DDH');
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

  // SPEC-NEWS-REVISE-002 — AC-ENDMARK-1/3: Alt+Y가 prefix 없이 정확히 "(끝)" 1회를 본문 끝에 삽입한다.
  it('AC-ENDMARK-1/3: Alt+Y inserts exactly "(끝)" (prefix-free) and renders it in a gold-colored element', async () => {
    const user = userEvent.setup();
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ saveArticle, applyAction }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문 내용');
    await user.keyboard('{Alt>}y{/Alt}');

    // SPEC-NEWS-REVISE-002: prefix-free "(끝)" appended at body end.
    expect(body.textContent).toBe('본문 내용(끝)');
    const endEl = body.querySelector('.yh-end-mark');
    expect(endEl).not.toBeNull();
    expect(endEl).toHaveTextContent('(끝)');

    // It persists into markupVersion (round-trip): 송고 saves a DTO whose markupVersion contains "(끝)".
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].markupVersion).toContain('(끝)');
  });

  // SPEC-NEWS-REVISE-002 — AC-ENDMARK-2: idempotent Alt+Y.
  it('AC-ENDMARK-2: Alt+Y is idempotent — pressing it twice keeps exactly one "(끝)"', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문 내용');
    await user.keyboard('{Alt>}y{/Alt}');
    await user.keyboard('{Alt>}y{/Alt}');
    expect(body.textContent).toBe('본문 내용(끝)');
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

// PR-REVIEW REGRESSION (RED — pending fix): Korean IME 1-press Enter stale-closure 버그.
// 합성(composition) 도중 Enter가 눌리면 keyCode=229로 IME가 keystroke를 소비하므로 handleEnter는
// preventDefault 없이 pendingEnterAfterIme=true만 설정한다 (WritePage.jsx:219-230). compositionend가
// 발화하면 (1) composingRef=false, (2) onChangeText(textContent) -- React state update는 async,
// (3) recolor(), (4) pendingEnterAfterIme=true 이면 insertNewline(el) 호출.
//
// 그러나 insertNewline은 useCallback([bodyText, onChangeText])로 메모이즈되어 있어 compositionend
// 시점의 closure는 *직전* render의 bodyText를 캡쳐한다. onChangeText는 방금 호출됐지만 React가
// 아직 re-render 하지 않았으므로, insertNewline 내부 getCaretCharOffset(el)는 새 textContent
// 기준의 offset (예: '가' 한 글자 = offset 1)을 받지만 splice 대상 bodyText는 ''(빈 문자열)이다.
// 결과: insertNewlineAt('', 1) -> '\n'만 들어가고 방금 커밋된 '가' 음절이 paintEditor로 덮어쓰여
// 사라질 수 있다.
//
// 이 테스트는 그 시나리오를 jsdom에서 재현한다. RED일 가능성이 높으며, 실제 production 동작이
// (조건부) 음절 보존이라면 자연스럽게 PASS한다 (회귀 가드).
// NOTE: jsdom 검증 결과 production 동작은 음절 보존 + '\n' 추가가 GREEN으로 통과한다.
// 실제 production 브라우저(Chrome/Edge IME)에서도 동일하게 동작하는지는 별도 E2E 검증 필요.
// stale-closure 의심은 jsdom 동기 fireEvent 순서로는 재현되지 않음 -- 이 테스트는 회귀 가드로 잠금.
describe('REGRESSION (guard): Korean IME 1-press Enter -- 음절 보존', () => {
  it('합성 중 Enter -> compositionend 시 한글 음절 + 줄바꿈 모두 유지', () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    body.focus();
    // 1. compositionstart -- 합성 시작 (composingRef=true)
    fireEvent.compositionStart(body, { data: '' });
    // 2. input 이벤트로 IME가 'ㄱ' -> '가' 음절을 contentEditable에 commit (DOM textContent='가')
    //    jsdom에서는 input 이벤트가 textContent를 자동 갱신하지 않으므로 직접 설정 후 dispatch.
    body.textContent = '가';
    fireEvent.input(body, { data: '가' });
    // 3. Enter 키 (IME commit 시 keyCode=229) -- handleEnter는 preventDefault 안 하고
    //    pendingEnterAfterIme=true 설정만 한다.
    fireEvent.keyDown(body, { key: 'Enter', keyCode: 229 });
    // 4. compositionend -- onChangeText('가') 후 insertNewline 호출 (stale closure 가능성)
    fireEvent.compositionEnd(body, { data: '가' });

    // 기대: '가' 음절 + '\n' 모두 유지. 현재 stale-closure 버그 의심: '가'가 누락된 채 '\n'만 적용될 가능성.
    expect(body.textContent).toContain('가');
    expect(body.textContent).toContain('\n');
  });

  it('compositionend 없이 blur가 발생해도 다음 합성에서 stray newline이 삽입되지 않는다', () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    body.focus();
    // 첫 합성: Enter 누르고 compositionend 없이 blur (예: 사용자가 Escape 후 다른 곳 클릭)
    fireEvent.compositionStart(body, { data: '' });
    body.textContent = '나';
    fireEvent.input(body, { data: '나' });
    fireEvent.keyDown(body, { key: 'Enter', keyCode: 229 });
    // compositionend 발화 없이 blur -- pendingEnterAfterIme=true 상태로 stuck 가능
    fireEvent.blur(body);

    // 두 번째 합성 (정상 종료) -- 이전 stuck 플래그가 stray '\n'을 삽입하면 회귀.
    body.focus();
    fireEvent.compositionStart(body, { data: '' });
    body.textContent = '나다';
    fireEvent.input(body, { data: '다' });
    fireEvent.compositionEnd(body, { data: '다' });

    // 두 번째 합성에는 Enter가 없었음 -- '\n'이 추가로 들어가면 안 됨.
    // 단, 첫 번째 compositionend가 누락된 시점의 pendingEnterAfterIme 플래그가 carry-over 되면 회귀.
    // 정확한 단언은 production 정책에 따라 다르지만, 최소한 textContent에 '\n' 이 한 개를 초과해서
    // 들어가면 명확한 버그다.
    const newlines = (body.textContent.match(/\n/g) || []).length;
    expect(newlines).toBeLessThanOrEqual(1);
  });
});

// SPEC-NEWS-REVISE-001 — IME compositionEnd Enter (stale bodyText 클로저 제거) 1-press 줄바꿈.
describe('WritePage IME compositionEnd Enter (AC-IME-ENTER)', () => {
  it('AC-IME-ENTER-1: 합성 중 Enter -> compositionEnd 1회로 한글 + 줄바꿈 모두 본문에 들어간다', () => {
    renderWrite();
    const body = screen.getByTestId('editor-body');
    body.focus();
    fireEvent.compositionStart(body, { data: '' });
    body.textContent = '한글';
    fireEvent.input(body, { data: '한글' });
    setCaretCharOffset(body, 2);
    fireEvent.keyDown(body, { key: 'Enter', keyCode: 229 });
    fireEvent.compositionEnd(body, { data: '한글' });

    expect(body.textContent).toBe('한글\n');
  });

  it('AC-IME-ENTER-2: 일반(non-IME) Enter 1회 줄바꿈 (회귀 가드)', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'abc');
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(body.textContent).toBe('abc\n');
  });
});

// SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D — AC-EMB-2 임베드 영속성 회귀 가드.
describe('WritePage inline embed persistence (AC-EMB-2)', () => {
  it('AC-EMB-2: 이미지 임베드 후 본문 텍스트 추가 입력해도 embed가 동일 위치에 유지된다', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'persist-img', url: 'https://u/p', thumbnailUrl: 'https://t/p' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    // 이미지 임베드 삽입
    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 persist-img' }));

    const editorRegion = screen.getByTestId('editor-region');
    const embedBefore = within(editorRegion).getByTestId('embed-image');
    const srcBefore = embedBefore.querySelector('img').getAttribute('src');

    // 본문에 추가 텍스트 입력
    const body = screen.getByTestId('editor-body');
    await user.type(body, '추가본문');

    // embed 노드 여전히 1개 존재, 동일 src 보존
    const embedsAfter = within(editorRegion).getAllByTestId('embed-image');
    expect(embedsAfter).toHaveLength(1);
    expect(embedsAfter[0].querySelector('img').getAttribute('src')).toBe(srcBefore);
    // 추가본문 텍스트도 본문에 존재
    expect(body.textContent).toContain('추가본문');
  });
});

// SPEC-NEWS-REVISE-001 — 본문 커서 위치 인라인 임베드 (AC-EMB-INLINE).
describe('WritePage inline embed at caret (AC-EMB-INLINE)', () => {
  it('AC-EMB-INLINE-1: 본문 "안녕하세요"에서 caret offset 2 -> 영상 삽입 시 blocks=[text:"안녕", embed:video, text:"하세요"]', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'mid-video', url: 'https://yt/m', thumbnailUrl: 'https://th/m' }],
      error: false,
    });
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    renderWrite(createFakeModel({ searchMedia, saveArticle, applyAction }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '안녕하세요');
    // 캐럿을 '안녕' 다음(offset=2)에 둔다 — onMouseUp으로 lastCaretRef 갱신.
    setCaretCharOffset(body, 2);
    fireEvent.mouseUp(body);

    // 영상 탭에서 검색 후 "삽입" 클릭 (포커스가 BodyEditor를 떠나지만 lastCaretRef 보존).
    await user.click(screen.getByRole('tab', { name: '영상' }));
    await user.type(within(screen.getByTestId('panel-영상')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-영상')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 mid-video' }));

    // 송고로 markupVersion 확보해 블록 순서를 검증.
    await user.click(screen.getByRole('button', { name: '송고' }));
    expect(saveArticle).toHaveBeenCalled();
    const dto = saveArticle.mock.calls[0][1];
    const parsed = JSON.parse(dto.markupVersion);
    // 기대: [text:"안녕", embed:video, text:"하세요"]
    expect(parsed.blocks.length).toBe(3);
    expect(parsed.blocks[0]).toMatchObject({ type: 'text', text: '안녕' });
    expect(parsed.blocks[1]).toMatchObject({ type: 'embed', embed: { type: 'video' } });
    expect(parsed.blocks[2]).toMatchObject({ type: 'text', text: '하세요' });
  });

  it('AC-EMB-INLINE-2: contentEditable 내부에 인라인 embed 스팬이 올바른 위치에 렌더된다', async () => {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'inline', url: 'https://yt/i', thumbnailUrl: 'https://th/i' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '안녕하세요');
    setCaretCharOffset(body, 2);
    fireEvent.mouseUp(body);

    await user.click(screen.getByRole('tab', { name: '영상' }));
    await user.type(within(screen.getByTestId('panel-영상')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-영상')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 inline' }));

    // 인라인 embed 스팬이 본문 editor-body 안에 존재한다 (별도 컨테이너 아님).
    const inlineEmbeds = body.querySelectorAll('[data-embed-index]');
    expect(inlineEmbeds.length).toBe(1);
    expect(inlineEmbeds[0].getAttribute('data-testid')).toBe('embed-video');
    expect(inlineEmbeds[0].classList.contains('yh-embed-inline')).toBe(true);
    // editor-body의 body text (embed 텍스트 제외)는 모델과 동일 — 즉 "안녕하세요"가 유지.
    // (caret helper의 getBodyTextFromDom과 동일한 로직)
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        let p = n.parentNode;
        while (p && p !== body) {
          if (p.nodeType === 1 && p.hasAttribute && p.hasAttribute('data-embed-index')) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let bodyText = '';
    let n = walker.nextNode();
    while (n) { bodyText += n.textContent; n = walker.nextNode(); }
    expect(bodyText).toBe('안녕하세요');
  });

  it('AC-EMB-INLINE-3: markupVersion 라운드트립 — setMarkup 후 blocks 동일 (AC-EMB-2 정합)', () => {
    const sourceBlocks = [
      { type: 'text', text: '안녕' },
      { type: 'embed', embed: { type: 'video', source: 'youtube', title: 'rt', url: 'https://u/rt' } },
      { type: 'text', text: '하세요' },
    ];
    const markup = contentToMarkup({ blocks: sourceBlocks });
    // 라운드트립: deserialize -> serialize 결과가 동일 (AC-EMB-2 invariant).
    const parsed = JSON.parse(markup);
    expect(parsed.blocks).toEqual(sourceBlocks);
  });
});

// SPEC-NEWS-REVISE-001 / REQ-EDITOR-EMBED-AND-CTRL-D — Ctrl+D 라인 삭제 React 통합.
describe('WritePage Ctrl+D line delete (REQ-EDITOR-EMBED-AND-CTRL-D)', () => {
  it('AC-CTRL-D-1: BBB 라인 캐럿에서 Ctrl+D -> "AAA\\nCCC", preventDefault', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'AAA');
    fireEvent.keyDown(body, { key: 'Enter' });
    await user.type(body, 'BBB');
    fireEvent.keyDown(body, { key: 'Enter' });
    await user.type(body, 'CCC');
    // 캐럿을 BBB 라인 내부(offset 5 = AAA\nB|BB)에 둔다.
    setCaretCharOffset(body, 5);
    const evt = fireEvent.keyDown(body, { key: 'd', ctrlKey: true });
    expect(evt).toBe(false); // fireEvent returns false when preventDefault was called
    expect(body.textContent).toBe('AAA\nCCC');
  });

  it('AC-CTRL-D-3: 마지막 라인 캐럿에서 Ctrl+D -> 직전 라인의 끝으로 캐럿 보정', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'AAA');
    fireEvent.keyDown(body, { key: 'Enter' });
    await user.type(body, 'BBB');
    // 캐럿 BBB 끝
    setCaretCharOffset(body, body.textContent.length);
    fireEvent.keyDown(body, { key: 'd', ctrlKey: true });
    expect(body.textContent).toBe('AAA');
  });

  it('AC-CTRL-D-4: 에디터 외부 input 포커스 상태에서 Ctrl+D는 본문에 영향 없음', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'AAA');
    fireEvent.keyDown(body, { key: 'Enter' });
    await user.type(body, 'BBB');
    const before = body.textContent;
    // 공통정보 탭의 검색 input(작성자 필드)로 포커스 이동.
    const authorInput = within(screen.getByTestId('panel-공통정보')).getByLabelText('작성자');
    authorInput.focus();
    // Ctrl+D 이벤트를 input에 발화 — BodyEditor의 onKeyDown은 호출되지 않음.
    fireEvent.keyDown(authorInput, { key: 'd', ctrlKey: true });
    expect(body.textContent).toBe(before);
  });

  // SPEC-NEWS-REVISE-001 AC-CTRL-D-5 회귀 — Ctrl+D 핸들러가 Alt+Y 동작을 방해하지 않는다.
  // SPEC-NEWS-REVISE-002 REQ-EDITOR-END-MARKER로 단언 문자열을 "\n (끝)" → "(끝)"로 동기 갱신.
  it('AC-CTRL-D-5: Alt+Y 회귀 — Ctrl+D 핸들러 도입 후에도 "(끝)" 삽입 동작 보존 (SPEC-NEWS-REVISE-002 동기 갱신)', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문');
    await user.keyboard('{Alt>}y{/Alt}');
    expect(body.textContent).toBe('본문(끝)');
    expect(body.querySelector('.yh-end-mark')).not.toBeNull();
  });

  it('Ctrl+D 전체 선택 후 -> 본문 빈 문자열', async () => {
    const user = userEvent.setup();
    renderWrite();
    const body = screen.getByTestId('editor-body');
    await user.type(body, 'AAA');
    fireEvent.keyDown(body, { key: 'Enter' });
    await user.type(body, 'BBB');
    // 전체 선택을 모방: getSelectionOffsets는 collapsed caret만 인식하므로 selection range 직접 설정.
    const range = document.createRange();
    range.selectNodeContents(body);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(body, { key: 'd', ctrlKey: true });
    expect(body.textContent).toBe('');
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

// SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — × 어포던스 클릭/Backspace 통합 (AC-EMB-DEL-1/2/4).
describe('WritePage inline embed delete (AC-EMB-DEL-1/2/4)', () => {
  async function setupWithEmbed() {
    const user = userEvent.setup();
    const searchMedia = vi.fn().mockResolvedValue({
      items: [{ source: 'youtube', title: 'will-delete', url: 'https://yt/d', thumbnailUrl: 'https://th/d' }],
      error: false,
    });
    renderWrite(createFakeModel({ searchMedia }));
    const body = screen.getByTestId('editor-body');
    await user.type(body, '본문 전');
    setCaretCharOffset(body, '본문 전'.length);
    fireEvent.mouseUp(body);

    await user.click(screen.getByRole('tab', { name: '이미지' }));
    await user.type(within(screen.getByTestId('panel-이미지')).getByLabelText('검색어'), 'q');
    await user.click(within(screen.getByTestId('panel-이미지')).getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: '삽입 will-delete' }));

    const editorRegion = screen.getByTestId('editor-region');
    return { user, body, editorRegion };
  }

  it('AC-EMB-DEL-1: editor inline embed에 × 어포던스가 렌더되며 클릭 시 해당 embed가 사라진다', async () => {
    const { user, editorRegion } = await setupWithEmbed();
    // × 어포던스(aria-label="임베드 삭제")가 본문 안에 노출된다.
    const delBtn = within(editorRegion).getByRole('button', { name: '임베드 삭제' });
    expect(delBtn).toBeInTheDocument();
    // 클릭 → embed 제거.
    await user.click(delBtn);
    expect(within(editorRegion).queryByTestId('embed-image')).not.toBeInTheDocument();
  });

  it('AC-EMB-DEL-2: × 삭제 후 인접 본문 텍스트는 보존된다', async () => {
    const { user, body, editorRegion } = await setupWithEmbed();
    const delBtn = within(editorRegion).getByRole('button', { name: '임베드 삭제' });
    await user.click(delBtn);
    // 본문 텍스트 "본문 전"이 그대로 유지된다.
    expect(body.textContent).toContain('본문 전');
  });

  it('AC-EMB-DEL-1: embed 노드 포커스 + Backspace → removeEmbed 트리거 (embed 제거)', async () => {
    const { editorRegion } = await setupWithEmbed();
    const embedSpan = within(editorRegion).getByTestId('embed-image');
    // contentEditable 내부에서 임베드 span에 직접 keydown 이벤트.
    // BodyEditor는 contentEditable 컨테이너에서 keydown을 받는다 — embed 자식이 이벤트 발생원.
    fireEvent.keyDown(embedSpan, { key: 'Backspace', bubbles: true });
    // 같은 editor-body의 keydown 핸들러가 처리한다 (target 검사로 embed 식별).
    expect(within(editorRegion).queryByTestId('embed-image')).not.toBeInTheDocument();
  });

  it('AC-EMB-DEL-4: × 삭제 후에도 SPEC-NEWS-REVISE-001 AC-EMB-2 회귀 없음 — 추가 본문 입력 가능', async () => {
    const { user, body, editorRegion } = await setupWithEmbed();
    await user.click(within(editorRegion).getByRole('button', { name: '임베드 삭제' }));
    // embed 삭제 후에도 본문 입력 정상 동작.
    await user.type(body, '추가');
    expect(body.textContent).toContain('추가');
    // embed는 여전히 0개.
    expect(within(editorRegion).queryByTestId('embed-image')).not.toBeInTheDocument();
  });
});

// SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — lockError UI (AC-EDIT-LOCK-2, NFR-A11Y).
describe('WritePage edit lock rejection UI (AC-EDIT-LOCK-2, NFR-A11Y)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('AC-EDIT-LOCK-2: 락 거부 시 ALERT가 1회 발생하고 aria-live="assertive" 배너가 잔존한다', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-LOCKED');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const row = { articleId: 'A-LOCKED', markupVersion: contentToMarkup(contentFromText('편집중')), author: '편집기자' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    renderWrite(createFakeModel({ queryArticles, acquireEditLock }));

    // ALERT가 호출된다 — "다른 페이지/세션" 메시지를 포함한다.
    await screen.findByRole('alert');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain('다른 페이지');
    // inline alert 배너가 본문 영역 위에 잔존한다 (aria-live="assertive").
    const banner = screen.getByRole('alert');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
  });

  it('AC-EDIT-LOCK-2: 락 거부 시 본문 영역(editor-body)이 비활성화된다 (contentEditable=false)', async () => {
    window.history.replaceState({}, '', '/writer.do?id=A-LOCKED2');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const row = { articleId: 'A-LOCKED2', markupVersion: contentToMarkup(contentFromText('잠김')), author: '편집기자' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
    renderWrite(createFakeModel({ queryArticles, acquireEditLock }));
    await screen.findByRole('alert');
    const body = screen.getByTestId('editor-body');
    // contentEditable=false 또는 readonly 속성으로 비활성화 — 어느 형태든 입력 차단되어야 한다.
    expect(body.getAttribute('contenteditable')).toBe('false');
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
