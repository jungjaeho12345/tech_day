import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

// SPEC-NEWS-REVISE-003 — edit-load row 의 markupVersion 을 만드는 헬퍼 (editLoad 테스트와 동일 관례).
function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

// SPEC-UI-EDITOR-001 — AC-4 (adapter-swap does not affect DTO assembly), REQ-EDIT-EMBED-001/007.

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderCtrl(model = createFakeModel()) {
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
  );
  return renderHook(() => useWriteController(USER), { wrapper });
}

describe('useWriteController editor integration (AC-4, REQ-EDIT-EMBED)', () => {
  it('AC-4: assembleDto().markupVersion exactly equals adapter.getMarkup()', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문 텍스트'));
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('AC-4: markupVersion stays in sync after embedding an inline block', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문'));
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 't', url: 'https://img/x' }));
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('REQ-EDIT-EMBED-001: embed inserts a structured inline block, NOT an appended marker string', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('본문'));
    act(() => result.current.embed({ type: 'video', source: 'youtube', title: 'YT', url: 'https://youtu.be/x' }));
    const embeds = result.current.content.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('video');
    // Body text must NOT contain the old marker form.
    expect(result.current.bodyText).not.toContain('[youtube]');
    expect(result.current.bodyText).not.toContain('https://youtu.be/x');
  });

  it('REQ-EDIT-EMBED-007: multiple embeds preserve insertion order', () => {
    const { result } = renderCtrl();
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 'i', url: 'https://i/1' }));
    act(() => result.current.embed({ type: 'video', source: 'youtube', title: 'v', url: 'https://v/1' }));
    act(() => result.current.embed({ type: 'article', articleId: 'A-1', title: 'a' }));
    const types = result.current.content.blocks.filter((b) => b.type === 'embed').map((b) => b.embed.type);
    expect(types).toEqual(['image', 'video', 'article']);
  });

  // SPEC-NEWS-REVISE-002 REQ-EMBED-DELETE — controller seam for removeEmbed.
  it('AC-EMB-DEL-1/3: removeEmbed(index) drops the N-th embed and content/markup reflect the deletion', () => {
    const { result } = renderCtrl();
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 'i', url: 'https://i/1' }));
    act(() => result.current.embed({ type: 'video', source: 'youtube', title: 'v', url: 'https://v/1' }));
    expect(result.current.content.blocks.filter((b) => b.type === 'embed')).toHaveLength(2);
    act(() => result.current.removeEmbed(0));
    const embeds = result.current.content.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('video');
    // markupVersion reflects the deletion (AC-4 invariant + AC-EMB-DEL-3).
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('USER-REQ: assembleDto().title equals the editor\'s first line (parsed 후보 A title)', () => {
    const { result } = renderCtrl();
    act(() => result.current.setBodyMarkup('헤드라인 제목\n부제목\n\n본문 내용'));
    expect(result.current.assembleDto().title).toBe('헤드라인 제목');
    // AC-4 invariant unaffected by adding title to the DTO.
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('USER-REQ: 송고 calls saveArticle with a DTO carrying the parsed title', async () => {
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('DB 제목\n본문(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].title).toBe('DB 제목');
  });

  it('DP-F5 invariant: send persists DTO then submits action only (no client state computation)', async () => {
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('hello body(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][1].markupVersion).toContain('hello body');
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
    expect(result.current.lifecycleStatus).toBe('DPS');
  });

  it('DP-F5 invariant: kill submits the kill action only and shows returned state', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDK' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    await act(async () => { await result.current.kill(); });
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'kill');
    expect(result.current.lifecycleStatus).toBe('DDK');
  });

  it('reset: a successful action clears editor + common + articleId but keeps status', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    act(() => result.current.setBodyMarkup('to be cleared'));
    act(() => result.current.embed({ type: 'image', source: 'youtube', title: 't', url: 'https://i/1' }));
    act(() => result.current.updateCommon('author', 'Desk'));
    await act(async () => { await result.current.hold(); });
    // Status confirmation kept.
    expect(result.current.lifecycleStatus).toBe('DDH');
    // Input state reset.
    expect(result.current.bodyText).toBe('');
    expect(result.current.content.blocks).toHaveLength(0);
    // 작성자 re-defaults to the logged-in user's name after reset (news.md 공통정보), not blank.
    expect(result.current.common.author).toBe(USER.name);
    // assembleDto invariant still holds after reset (markupVersion === adapter.getMarkup()).
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
  });

  it('공통정보: a fresh write controller pre-fills 작성자 with the logged-in user name', () => {
    const { result } = renderCtrl();
    // news.md 기사 에디터 공통정보: 작성자는 로그인한 사용자 정보의 이름을 입력한다.
    expect(result.current.common.author).toBe(USER.name);
  });

  it('공통정보: after a successful action + reset, 작성자 is the user name again (re-defaulted)', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    // Overwrite the autofilled author, then 보류 (success) triggers reset.
    act(() => result.current.updateCommon('author', '다른작성자'));
    act(() => result.current.setBodyMarkup('제목'));
    await act(async () => { await result.current.hold(); });
    expect(result.current.common.author).toBe(USER.name);
  });

  it('공통정보: the autofilled 작성자 is still editable (updateCommon overrides it)', () => {
    const { result } = renderCtrl();
    act(() => result.current.updateCommon('author', '직접 입력'));
    expect(result.current.common.author).toBe('직접 입력');
  });

  // SPEC-NEWS-REVISE-002 REQ-API-INSERT-UPDATE-SPLIT — explicit insert/update branching per context
  // (AC-API-1/AC-API-3). The httpModel routes A-DRAFT id -> POST (insert) and any other id -> PUT
  // (update); the controller must call saveArticle with the LOADED article id when editing, and with
  // 'A-DRAFT' when creating, so the transport branch follows the user's intent.
  describe('REQ-API-INSERT-UPDATE-SPLIT (AC-API-1/AC-API-3/AC-API-4)', () => {
    it('AC-API-1: 신규 작성 컨텍스트 (articleId=A-DRAFT) → saveArticle("A-DRAFT", ...) — POST 라우팅 보장', async () => {
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-NEW' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
      const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
      act(() => result.current.setBodyMarkup('새 제목\n본문(끝)'));
      await act(async () => { await result.current.send(); });
      expect(saveArticle).toHaveBeenCalledTimes(1);
      expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
    });

    it('AC-API-4: 제목 없음 → ALERT 후 saveArticle / applyAction 어느 것도 호출되지 않는다 (R 권한 회귀)', async () => {
      const saveArticle = vi.fn();
      const applyAction = vi.fn();
      const reporter = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };
      const wrapper = ({ children }) => (
        <ModelContext.Provider value={createFakeModel({ saveArticle, applyAction })}>{children}</ModelContext.Provider>
      );
      const { result } = renderHook(() => useWriteController(reporter), { wrapper });
      await act(async () => { await result.current.send(); });
      expect(result.current.actionError).toContain('제목이 없어');
      expect(saveArticle).not.toHaveBeenCalled();
      expect(applyAction).not.toHaveBeenCalled();
    });

    // 매트릭스: 권한 R/D/Z × 신규 컨텍스트 — 모두 saveArticle('A-DRAFT', ...) 호출.
    // (분기 기준은 권한이 아니라 컨텍스트이므로 동일 분기가 적용된다 — AC-WLC-5 정합.)
    for (const role of ['R', 'D', 'Z']) {
      it(`AC-API-1 매트릭스: role=${role} 신규 컨텍스트는 saveArticle('A-DRAFT', ...) 로 호출된다`, async () => {
        const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-NEW' });
        const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
        const userInRole = { userId: `${role}1`, name: role, role, department: '정치부' };
        const wrapper = ({ children }) => (
          <ModelContext.Provider value={createFakeModel({ saveArticle, applyAction })}>{children}</ModelContext.Provider>
        );
        const { result } = renderHook(() => useWriteController(userInRole), { wrapper });
        act(() => result.current.setBodyMarkup('제목\n본문(끝)'));
        await act(async () => { await result.current.send(); });
        expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
      });
    }
  });

  it('reset: a rejected action leaves the page state untouched', async () => {
    const applyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid-transition' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    act(() => result.current.setBodyMarkup('keep me'));
    act(() => result.current.updateCommon('author', 'Desk'));
    await act(async () => { await result.current.hold(); });
    expect(result.current.bodyText).toBe('keep me');
    expect(result.current.common.author).toBe('Desk');
    expect(result.current.lifecycleStatus).toBeNull();
  });

  // SPEC-NEWS-REVISE-003 — REQ-WRITE-LIFECYCLE-API (토픽 D): 신규 작성 vs 편집 진입의 Insert/Update 분기.
  //
  // 본 리포에는 articleInsert/articleUpdate 모델 메서드가 존재하지 않는다. 분기는 컨텍스트(editArticleId /
  // A-DRAFT sentinel)로만 결정되며, 그 RESULTANT 동작은: 신규 → saveArticle('A-DRAFT', ...) (httpModel POST=insert),
  // 편집 → saveArticle('<loaded id>', ...) (httpModel PUT=update) 이다. KILL 은 saveArticle 을 호출하지 않고
  // applyAction(id, role, 'kill') 만 호출한다. SPEC 의 articleInsert/articleUpdate 명칭은 illustrative 이므로
  // RESULTANT 동작(어느 id 로 saveArticle 이 불리는지 / 불리지 않는지)을 단언한다.
  describe('SPEC-NEWS-REVISE-003 REQ-WRITE-LIFECYCLE-API (토픽 D)', () => {
    // edit 컨텍스트(editArticleId)로 컨트롤러를 마운트하고 해당 row 를 로드한다.
    function renderEditCtrl(model, editArticleId, user = USER) {
      const wrapper = ({ children }) => (
        <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
      );
      return renderHook(() => useWriteController(user, { editArticleId }), { wrapper });
    }

    it('AC-WLC-1: 신규 작성 컨텍스트(editArticleId null) → saveArticle("A-DRAFT", ...) 1회, 편집 경로(다른 id) 0회', async () => {
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-NEW' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
      const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
      act(() => result.current.setBodyMarkup('신규 제목\n내용(끝)'));
      await act(async () => { await result.current.send(); });
      // Insert 경로: saveArticle 이 A-DRAFT sentinel 로 1회 호출 (=POST/insert 라우팅).
      expect(saveArticle).toHaveBeenCalledTimes(1);
      expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
      // Update 경로(로드된 기사 id 로의 호출)는 발생하지 않는다.
      const updateCalls = saveArticle.mock.calls.filter((c) => c[0] !== 'A-DRAFT');
      expect(updateCalls).toHaveLength(0);
    });

    it('AC-WLC-2: 편집 컨텍스트("AKR-001") → saveArticle("AKR-001", ...) 1회 (Update), Insert(A-DRAFT) 0회', async () => {
      const queryArticles = vi.fn().mockResolvedValue([
        { articleId: 'AKR-001', status: 'RDS', markupVersion: markupFor('편집 제목\n편집 내용(끝)'), author: '원작성자' },
      ]);
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'AKR-001' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
      const { result } = renderEditCtrl(
        createFakeModel({ queryArticles, saveArticle, applyAction }),
        'AKR-001',
      );
      await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
      await act(async () => { await result.current.send(); });
      // Update 경로: saveArticle 이 로드된 id 로 1회 (=PUT/update 라우팅).
      expect(saveArticle).toHaveBeenCalledTimes(1);
      expect(saveArticle.mock.calls[0][0]).toBe('AKR-001');
      // Insert(A-DRAFT) 경로는 발생하지 않는다.
      const insertCalls = saveArticle.mock.calls.filter((c) => c[0] === 'A-DRAFT');
      expect(insertCalls).toHaveLength(0);
      // applyAction 도 동일 id 로.
      expect(applyAction).toHaveBeenCalledWith('AKR-001', 'D', 'send');
    });

    it('AC-WLC-3: 편집 + KILL → applyAction(loaded id, role, "kill") 1회, Insert(A-DRAFT) 0회', async () => {
      const queryArticles = vi.fn().mockResolvedValue([
        { articleId: 'AKR-001', status: 'RDS', markupVersion: markupFor('편집 제목\n편집 내용'), author: '원작성자' },
      ]);
      const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'AKR-001' });
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDK' });
      const { result } = renderEditCtrl(
        createFakeModel({ queryArticles, saveArticle, applyAction }),
        'AKR-001',
      );
      await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
      await act(async () => { await result.current.kill(); });
      // KILL 은 Update lifecycle 전이만 발생 — applyAction 이 로드된 id + 'kill' 로 1회.
      expect(applyAction).toHaveBeenCalledTimes(1);
      expect(applyAction).toHaveBeenCalledWith('AKR-001', 'D', 'kill');
      // KILL 컨텍스트에서 Insert(A-DRAFT) saveArticle 은 발생하지 않는다 (신규 작성 오용 방지).
      const insertCalls = saveArticle.mock.calls.filter((c) => c[0] === 'A-DRAFT');
      expect(insertCalls).toHaveLength(0);
    });

    // 6-combination matrix: 권한 R/D/Z × {신규, 편집}. 분기는 컨텍스트로만 결정되며 권한은 영향 없음.
    for (const role of ['R', 'D', 'Z']) {
      const userInRole = { userId: `${role}1`, name: role, role, department: '정치부' };

      it(`AC-WLC-5: role=${role} × 신규 → saveArticle("A-DRAFT", ...) (권한 무관, 컨텍스트만 분기 결정)`, async () => {
        const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-NEW' });
        const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
        const wrapper = ({ children }) => (
          <ModelContext.Provider value={createFakeModel({ saveArticle, applyAction })}>{children}</ModelContext.Provider>
        );
        const { result } = renderHook(() => useWriteController(userInRole), { wrapper });
        act(() => result.current.setBodyMarkup('제목\n본문(끝)'));
        await act(async () => { await result.current.send(); });
        expect(saveArticle).toHaveBeenCalledTimes(1);
        expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
      });

      it(`AC-WLC-5: role=${role} × 편집 → saveArticle("AKR-${role}", ...) (권한 무관, 컨텍스트만 분기 결정)`, async () => {
        const editId = `AKR-${role}`;
        const queryArticles = vi.fn().mockResolvedValue([
          { articleId: editId, status: 'RDS', markupVersion: markupFor('편집 제목\n본문(끝)'), author: '원작성자' },
        ]);
        const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: editId });
        const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
        const { result } = renderEditCtrl(
          createFakeModel({ queryArticles, saveArticle, applyAction }),
          editId,
          userInRole,
        );
        await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
        await act(async () => { await result.current.send(); });
        expect(saveArticle).toHaveBeenCalledTimes(1);
        expect(saveArticle.mock.calls[0][0]).toBe(editId);
        // 편집 컨텍스트에서는 어떤 권한이든 A-DRAFT(insert) 호출이 없다.
        expect(saveArticle.mock.calls.filter((c) => c[0] === 'A-DRAFT')).toHaveLength(0);
      });
    }
  });
});

// SPEC-NEWS-REVISE-005 REQ-SEND-END-MARKER-GUARD — 송고 "(끝)" 마커 가드 (AC-SEND-GUARD-1~6).
// news.md L66: 송고는 본문에 "(끝)" 표시가 있어야 한다. 없으면 ALERT 후 송고 차단. 보류/KILL 은 마커 없이 진행.
// 가드 위치: 제목 가드 직후·transport 진입 전 (useWriteController.js). 정본 hasEndMarker 를 소비.
describe('SPEC-NEWS-REVISE-005 REQ-SEND-END-MARKER-GUARD (AC-SEND-GUARD-1~6)', () => {
  const GUARD_ALERT = '본문에 (끝) 표시가 없어 송고할 수 없습니다.';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC-SEND-GUARD-1/2: 본문 (끝) 미존재 송고 → ALERT 1회 + saveArticle/applyAction 미호출', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    // 제목은 채우되 본문은 (끝) 마커로 끝나지 않게 둔다.
    act(() => result.current.setBodyMarkup('제목\n마커 없는 본문'));
    await act(async () => { await result.current.send(); });
    // ALERT 가 정확히 1회, 정확한 문구로 표시된다.
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(GUARD_ALERT);
    // 저장/액션 경로에 진입하지 않는다 (call count 0).
    expect(saveArticle).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
    // 페이지 상태(리셋/lifecycleStatus) 변화 없음.
    expect(result.current.lifecycleStatus).toBeNull();
    expect(result.current.bodyText).toContain('마커 없는 본문');
  });

  it('AC-SEND-GUARD-3: 본문 (끝) 존재 송고 → ALERT 없이 saveArticle → applyAction 정상 진행', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('제목\n본문(끝)'));
    await act(async () => { await result.current.send(); });
    // (끝) ALERT 가 발생하지 않는다.
    expect(alertSpy).not.toHaveBeenCalled();
    // 기존 송고 경로(Insert 분기 → saveArticle → applyAction)가 정상 진행된다.
    expect(saveArticle).toHaveBeenCalledTimes(1);
    expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
    expect(result.current.lifecycleStatus).toBe('DPS');
  });

  it('AC-SEND-GUARD-4: 보류(hold)는 (끝) 없이도 비차단 진행 (제목만 요구)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDH' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    // 제목은 있고 본문에 (끝) 없음 — 보류는 통과해야 한다.
    act(() => result.current.setBodyMarkup('제목\n마커 없는 본문'));
    await act(async () => { await result.current.hold(); });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'hold');
    expect(result.current.lifecycleStatus).toBe('DDH');
  });

  it('AC-SEND-GUARD-4: KILL(kill)은 (끝)/제목 모두 없이도 비차단 진행', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DDK' });
    const { result } = renderCtrl(createFakeModel({ applyAction }));
    // 본문 비움 (제목도 (끝)도 없음) — KILL 은 통과해야 한다.
    await act(async () => { await result.current.kill(); });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(applyAction).toHaveBeenCalledWith(expect.any(String), 'D', 'kill');
    expect(result.current.lifecycleStatus).toBe('DDK');
  });

  it('AC-SEND-GUARD-5: 제목 가드가 (끝) 가드보다 우선 — 제목 빈 송고는 제목 ALERT 만, (끝) ALERT 없음', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    // 제목 비움 + 본문 (끝) 없음 — 제목 가드가 먼저 발동한다.
    await act(async () => { await result.current.send(); });
    // 제목 가드는 inline actionError 로 표면화된다 (window.alert 아님).
    expect(result.current.actionError).toContain('제목이 없어');
    // (끝) ALERT(window.alert)는 발생하지 않는다 — 제목 가드에서 이미 반환.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(saveArticle).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
  });

  it('AC-SEND-GUARD-6: 정본 hasEndMarker 무변경 회귀 — trailing 공백/개행 뒤 (끝) 도 통과', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    // 정본 hasEndMarker 는 trimEnd() 후 판정하므로 (끝) 뒤 공백/개행은 여전히 통과한다 (EC-1).
    act(() => result.current.setBodyMarkup('제목\n본문(끝)\n  '));
    await act(async () => { await result.current.send(); });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(saveArticle).toHaveBeenCalledTimes(1);
    expect(applyAction).toHaveBeenCalledWith('A-9', 'D', 'send');
  });

  it('EC-2: 본문 중간에만 (끝) 이 있고 끝이 아니면 차단 (끝 마커가 아님)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ saveArticle, applyAction }));
    act(() => result.current.setBodyMarkup('제목\n(끝) 가운데 본문'));
    await act(async () => { await result.current.send(); });
    expect(alertSpy).toHaveBeenCalledWith(GUARD_ALERT);
    expect(saveArticle).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
  });
});
