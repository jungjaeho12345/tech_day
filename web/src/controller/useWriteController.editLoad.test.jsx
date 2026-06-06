// Feature 3 — 데스크 미송고 edit: useWriteController(user, { editArticleId }) loads the article on mount
// (markupVersion + common fields) and saves with the loaded id (PUT/update path), while blank-new is
// unchanged when no editArticleId is supplied.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function renderCtrl(model, options) {
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
  );
  return renderHook(() => useWriteController(USER, options), { wrapper });
}

// Build a realistic markupVersion string for the loaded row (versioned JSON from the editor model).
function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

describe('useWriteController edit-load (Feature 3)', () => {
  it('loads markupVersion + common fields from the row identified by editArticleId', async () => {
    const loadedMarkup = markupFor('로드된 본문');
    const row = {
      articleId: 'A-100',
      markupVersion: loadedMarkup,
      author: '김기자',
      region: '서울',
      attribute: '일반',
      keyword: '폭우',
    };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-100' });

    // Queried by the edit id.
    await waitFor(() => expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-100' }));
    // Editor markup loaded — assembleDto().markupVersion reflects the loaded markup (AC invariant).
    await waitFor(() => {
      expect(result.current.assembleDto().markupVersion).toBe(loadedMarkup);
    });
    expect(result.current.assembleDto().markupVersion).toBe(result.current.getMarkup());
    expect(result.current.bodyText).toContain('로드된 본문');
    // Common fields populated from the present row fields.
    expect(result.current.common.author).toBe('김기자');
    expect(result.current.common.region).toBe('서울');
    expect(result.current.common.attribute).toBe('일반');
    expect(result.current.common.keyword).toBe('폭우');
    // Fields absent on the row stay blank.
    expect(result.current.common.coAuthor).toBe('');
  });

  it('saving an edited article uses the loaded id (update/PUT path), not A-DRAFT', async () => {
    const row = { articleId: 'A-200', markupVersion: markupFor('기존 본문(끝)'), author: '원작성자' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-200' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(
      createFakeModel({ queryArticles, saveArticle, applyAction }),
      { editArticleId: 'A-200' },
    );

    await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
    await act(async () => { await result.current.send(); });

    // saveArticle called with the LOADED id -> the model PUTs (updates) instead of POSTing a new row.
    expect(saveArticle).toHaveBeenCalled();
    expect(saveArticle.mock.calls[0][0]).toBe('A-200');
    // applyAction uses the same id — edit context rides the page lock sessionId (AC-EDIT-LOCK-6).
    expect(applyAction).toHaveBeenCalledWith('A-200', 'D', 'send',
      expect.objectContaining({ sessionId: expect.any(String) }));
  });

  // 적대적 리뷰 보강: 2차 엠바고 저장 방향 매핑 회귀 가드 — 에디터 필드명(secondaryEmbargoAt)과
  // 백엔드 컬럼명(secondEmbargoAt)이 달라 INSERT/UPDATE에서 조용히 유실되던 버그의 특성 테스트.
  // assembleDto의 secondEmbargoAt 한 줄 매핑이 사라지면 본 테스트가 즉시 FAIL한다.
  it('assembleDto duplicates secondaryEmbargoAt onto the backend column name secondEmbargoAt (save path)', () => {
    const { result } = renderCtrl(createFakeModel({}));

    act(() => result.current.updateCommon('secondaryEmbargoAt', '2026-06-07T09:00'));

    const dto = result.current.assembleDto();
    expect(dto.secondEmbargoAt).toBe('2026-06-07T09:00');
    // 에디터 측 키도 그대로 유지된다 (commonFromRow 역방향 매핑과의 라운드트립 보존).
    expect(dto.secondaryEmbargoAt).toBe('2026-06-07T09:00');
  });

  // v0.6.0 — isDraft 계약: 기사아이디가 생성되지 않은 신규 초안에서 true, 편집 로드 후 false.
  // WritePage가 이 값으로 KILL 버튼 노출을 게이트한다 (news.md: 미생성 기사 화면엔 KILL 없음).
  it('isDraft is true for an id-less draft and false once an edit-load adopts a real articleId', async () => {
    const blank = renderCtrl(createFakeModel({}));
    expect(blank.result.current.isDraft).toBe(true);

    const row = { articleId: 'A-300', markupVersion: markupFor('기존 본문(끝)'), author: '원작성자' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-300' });
    await waitFor(() => expect(result.current.common.author).toBe('원작성자'));
    expect(result.current.isDraft).toBe(false);
  });

  it('no editArticleId => blank-new behavior is unchanged (no query, A-DRAFT)', async () => {
    const queryArticles = vi.fn().mockResolvedValue([]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-0001' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(createFakeModel({ queryArticles, saveArticle, applyAction }));

    // No edit-load query is fired.
    expect(queryArticles).not.toHaveBeenCalled();
    // Blank editor + a save uses the A-DRAFT id (POST/create path in the model).
    act(() => result.current.setBodyMarkup('새 본문(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
  });

  // SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — frontend lock integration (AC-EDIT-LOCK-1/2/4/5).
  describe('edit lock integration (AC-EDIT-LOCK-1/2/4/5)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('AC-EDIT-LOCK-1: editArticleId 마운트 시 acquireEditLock(articleId, { sessionId })가 호출된다', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: true });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-1', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-1' },
      );
      await waitFor(() => expect(acquireEditLock).toHaveBeenCalled());
      const [callArticleId, opts] = acquireEditLock.mock.calls[0];
      expect(callArticleId).toBe('A-LOCK-1');
      expect(opts).toEqual(expect.objectContaining({ sessionId: expect.any(String) }));
      // page-scoped sessionId은 비어 있지 않다.
      expect(opts.sessionId.length).toBeGreaterThan(0);
    });

    it('AC-EDIT-LOCK-2: acquireEditLock이 { ok:false, reason:"locked" } 반환 → lockError state 설정', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-2', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      const { result } = renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-2' },
      );
      await waitFor(() => expect(result.current.lockError).toBeTruthy());
      // locked는 명시적 distinguishable reason이 노출되어야 한다.
      expect(result.current.lockError).toEqual(expect.objectContaining({ reason: 'locked' }));
    });

    it('AC-EDIT-LOCK-4: beforeunload + visibilitychange:hidden 둘 다 navigator.sendBeacon으로 락 해제', async () => {
      const sendBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { ...globalThis.navigator, sendBeacon });
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: true });
      const releaseEditLock = vi.fn().mockResolvedValue({ ok: true });
      const row = { articleId: 'A-LOCK-4', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, releaseEditLock }),
        { editArticleId: 'A-LOCK-4' },
      );
      await waitFor(() => expect(acquireEditLock).toHaveBeenCalled());
      // 채널 1 — beforeunload
      act(() => { window.dispatchEvent(new Event('beforeunload')); });
      // 채널 2 — visibilitychange (hidden)
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      // sendBeacon은 두 채널 모두에서 호출되어야 한다.
      expect(sendBeacon).toHaveBeenCalledTimes(2);
      // 호출 URL이 락 해제 endpoint를 가리킨다.
      for (const call of sendBeacon.mock.calls) {
        expect(call[0]).toContain('/api/articles/A-LOCK-4/lock');
      }
    });

    it('AC-EDIT-LOCK-2: lockError 보유 시 submitAction은 ALERT만 띄우고 모델 호출 없음', async () => {
      const acquireEditLock = vi.fn().mockResolvedValue({ ok: false, reason: 'locked' });
      const saveArticle = vi.fn();
      const applyAction = vi.fn();
      const row = { articleId: 'A-LOCK-2b', markupVersion: markupFor('본문'), author: 'a' };
      const queryArticles = vi.fn().mockResolvedValue([row]);
      const { result } = renderCtrl(
        createFakeModel({ queryArticles, acquireEditLock, saveArticle, applyAction }),
        { editArticleId: 'A-LOCK-2b' },
      );
      await waitFor(() => expect(result.current.lockError).toBeTruthy());
      await act(async () => { await result.current.send(); });
      // 락 거부 상태에선 어떤 transport 호출도 발생하지 않는다.
      expect(saveArticle).not.toHaveBeenCalled();
      expect(applyAction).not.toHaveBeenCalled();
    });
  });

  // SPEC-NEWS-REVISE-007 — ContentsVO 읽기전용 8필드 매핑 (REQ-VO-MAPPING / AC-MAP-2/4) +
  // 고침/포털고침 단순 편집 진입(전이 없음, REQ-REVISE-SEMANTICS / AC-REV-1).
  describe('SPEC-NEWS-REVISE-007 ContentsVO read-only 8 fields + no transition (REQ-VO-MAPPING/REQ-REVISE-SEMANTICS)', () => {
    const fullRow = {
      articleId: 'A-VO',
      markupVersion: markupFor('본문'),
      author: '작성자',
      modifier: '수정자값',
      sender: '송고자값',
      department: '정치부',
      departmentCode: 'POL',
      createdAt: '2026-06-01T08:00:00Z',
      editedAt: '2026-06-02T09:00:00Z',
      sentAt: '2026-06-03T10:00:00Z',
      embargoAt: '2026-06-04T11:00',
      secondEmbargoAt: '2026-06-05T12:00',
      status: 'DPS',
    };

    it('AC-MAP-2: 편집 컨텍스트에서 읽기전용 8필드가 controller state(readonlyMeta)로 노출된다', async () => {
      const queryArticles = vi.fn().mockResolvedValue([fullRow]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-VO' });
      await waitFor(() => expect(result.current.readonlyMeta).toBeTruthy());
      expect(result.current.readonlyMeta).toMatchObject({
        articleId: 'A-VO',
        modifier: '수정자값',
        sender: '송고자값',
        department: '정치부',
        departmentCode: 'POL',
        createdAt: '2026-06-01T08:00:00Z',
        editedAt: '2026-06-02T09:00:00Z',
        sentAt: '2026-06-03T10:00:00Z',
      });
    });

    it('AC-MAP-1 (회귀): 읽기전용 매핑 추가가 편집 5필드(author/embargo/2차) 로드를 깨지 않는다', async () => {
      const queryArticles = vi.fn().mockResolvedValue([fullRow]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-VO' });
      await waitFor(() => expect(result.current.common.author).toBe('작성자'));
      expect(result.current.common.embargoAt).toBe('2026-06-04T11:00');
      expect(result.current.common.secondaryEmbargoAt).toBe('2026-06-05T12:00');
    });

    it('AC-MAP-3: 신규 작성 컨텍스트(editArticleId 없음)에서는 readonlyMeta가 null이다', async () => {
      const queryArticles = vi.fn().mockResolvedValue([]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }));
      // 한 틱 양보해도 신규 컨텍스트에서는 매핑이 절대 채워지지 않는다.
      await act(async () => {});
      expect(result.current.readonlyMeta).toBeNull();
      expect(queryArticles).not.toHaveBeenCalled();
    });

    it('AC-MAP-4: 누락(undefined/null) 필드는 빈 문자열로 안전 표시되고 다른 필드는 보존된다', async () => {
      const partialRow = {
        articleId: 'A-PART',
        markupVersion: markupFor('부분'),
        author: 'a',
        modifier: '수정만',
        // sender/department/departmentCode/editedAt/sentAt 누락 + createdAt null
        createdAt: null,
        status: 'DPS',
      };
      const queryArticles = vi.fn().mockResolvedValue([partialRow]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-PART' });
      await waitFor(() => expect(result.current.readonlyMeta).toBeTruthy());
      const meta = result.current.readonlyMeta;
      // 존재하는 필드는 보존.
      expect(meta.articleId).toBe('A-PART');
      expect(meta.modifier).toBe('수정만');
      // 누락/널 필드는 빈 문자열 — 'undefined'/'null' 문자열을 노출하지 않는다.
      for (const key of ['sender', 'department', 'departmentCode', 'createdAt', 'editedAt', 'sentAt']) {
        expect(meta[key]).toBe('');
      }
    });

    it('AC-REV-1: 고침/포털고침 진입(편집 로드)은 lifecycle 전이 API(applyAction)를 호출하지 않는다', async () => {
      const queryArticles = vi.fn().mockResolvedValue([fullRow]);
      const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
      const { result } = renderCtrl(
        createFakeModel({ queryArticles, applyAction }),
        { editArticleId: 'A-VO' },
      );
      // 편집 로드가 완료될 때까지 기다린다 (진입 = 단순 편집 로드).
      await waitFor(() => expect(result.current.readonlyMeta).toBeTruthy());
      // 진입 자체로는 applyAction(전이)이 전혀 호출되지 않는다.
      expect(applyAction).not.toHaveBeenCalled();
    });

    it('AC-REV-1: 고침/포털고침 진입 후 편집 상태값은 원래 상태값(DPS)을 그대로 채택한다', async () => {
      const queryArticles = vi.fn().mockResolvedValue([fullRow]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-VO' });
      await waitFor(() => expect(result.current.status).toBe('DPS'));
    });

    it('AC-REV-2: 고침 모드 플래그를 도입하지 않는다 — 편집/고침/포털고침은 동일한 단일 editArticleId 컨텍스트', async () => {
      // (a) 진입점이 무엇이든(편집/고침/포털고침) controller에는 "고침 전용" 모드 플래그 키가 없다.
      // 데스크 미송고 편집과 동일한 단일 편집 컨텍스트(editArticleId)만 사용한다는 계약을 잠근다.
      const queryArticles = vi.fn().mockResolvedValue([fullRow]);
      const { result } = renderCtrl(createFakeModel({ queryArticles }), { editArticleId: 'A-VO' });
      await waitFor(() => expect(result.current.readonlyMeta).toBeTruthy());

      // 반환 객체에 reviseMode/isRevise/mode 등 어떤 고침 모드 플래그도 노출되지 않는다.
      for (const flag of ['reviseMode', 'isRevise', 'mode', 'revise', 'reviseRoute', 'reviseParam']) {
        expect(result.current).not.toHaveProperty(flag);
      }

      // (b) 별도 라우트 파라미터 없이 동일한 editArticleId 단일 컨텍스트로 로드된다 — queryArticles는
      // 오직 { articleId } 만으로 호출되며, 고침/포털고침 전용 식별자(action/revise 등)를 받지 않는다.
      expect(queryArticles).toHaveBeenCalledWith({ articleId: 'A-VO' });
      for (const [filter] of queryArticles.mock.calls) {
        expect(Object.keys(filter)).toEqual(['articleId']);
      }
    });

    it('AC-REV-2: 데스크 미송고 편집과 부서별 송고 고침 진입의 controller 반환 키 집합이 동일하다', async () => {
      // 진입점이 달라도 작성 페이지(controller) 표면은 동일해야 한다(고침 전용 키 무도입 증거).
      const baseRow = { articleId: 'A-K', markupVersion: markupFor('본문'), author: 'a', status: 'DPS' };
      const deskEdit = renderCtrl(
        createFakeModel({ queryArticles: vi.fn().mockResolvedValue([{ ...baseRow, articleId: 'A-DESK' }]) }),
        { editArticleId: 'A-DESK' },
      );
      const songoRevise = renderCtrl(
        createFakeModel({ queryArticles: vi.fn().mockResolvedValue([{ ...baseRow, articleId: 'A-SONGO' }]) }),
        { editArticleId: 'A-SONGO' },
      );
      await waitFor(() => expect(deskEdit.result.current.readonlyMeta).toBeTruthy());
      await waitFor(() => expect(songoRevise.result.current.readonlyMeta).toBeTruthy());
      // 두 진입점의 반환 키 집합이 정확히 같다 — 고침 진입이 추가 플래그/상태를 끼워넣지 않는다.
      expect(new Set(Object.keys(songoRevise.result.current)))
        .toEqual(new Set(Object.keys(deskEdit.result.current)));
    });
  });

  it('after a successful action the edit id is cleared (articleId back to A-DRAFT) so a new save creates', async () => {
    const row = { articleId: 'A-300', markupVersion: markupFor('reset me(끝)'), author: 'A' };
    const queryArticles = vi.fn().mockResolvedValue([row]);
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-300' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const { result } = renderCtrl(
      createFakeModel({ queryArticles, saveArticle, applyAction }),
      { editArticleId: 'A-300' },
    );
    await waitFor(() => expect(result.current.common.author).toBe('A'));

    await act(async () => { await result.current.send(); });
    // Page reset to blank-new: editor cleared; 작성자 re-defaults to the logged-in user name (news.md 공통정보).
    expect(result.current.bodyText).toBe('');
    expect(result.current.common.author).toBe(USER.name);

    // A subsequent send now targets A-DRAFT (create), not the old A-300.
    saveArticle.mockClear();
    act(() => result.current.setBodyMarkup('a brand new article(끝)'));
    await act(async () => { await result.current.send(); });
    expect(saveArticle.mock.calls[0][0]).toBe('A-DRAFT');
  });
});
