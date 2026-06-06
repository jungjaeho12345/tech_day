// SPEC-NEWS-REVISE — 작성 중이던 새 초안 유지 (작성 writer.do → 조회 list.do 전환 → 복귀).
// WritePage 는 라우팅 시 unmount/remount 되므로, 컨트롤러 상태는 sessionStorage 영속(httpModel 의
// sessionId 패턴과 동일)으로만 살아남는다. 본 스위트는 컨트롤러 단위로 그 보존/우선순위/초기화를 단언한다.
//
// 시뮬레이션: "조회로 떠남 → 복귀" = renderHook 의 unmount() 후 동일 sessionStorage 에서 재마운트.
// (setup.js afterEach 가 매 테스트 후 sessionStorage.clear() 하므로 케이스 간 누수는 없다.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ModelContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';
import { useWriteController } from './useWriteController.js';
import { contentToMarkup, contentFromText } from '../model/editorContent.js';

const USER = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };

function markupFor(text) {
  return contentToMarkup(contentFromText(text));
}

function mount(model, options) {
  const wrapper = ({ children }) => (
    <ModelContext.Provider value={model}>{children}</ModelContext.Provider>
  );
  return renderHook(() => useWriteController(USER, options), { wrapper });
}

describe('useWriteController draft persistence (작성 → 조회 전환 → 복귀)', () => {
  beforeEach(() => {
    // Defensive: ensure each case starts with no stored draft regardless of suite ordering.
    try { sessionStorage.clear(); } catch { /* no storage in this env */ }
  });

  it('본문/제목을 입력하고 조회로 떠났다 돌아오면 에디터 내용이 유지된다', () => {
    const model = createFakeModel();
    const first = mount(model);
    act(() => first.result.current.setBodyMarkup('제목 줄\n본문 단락'));
    // 조회 페이지로 이동 = WritePage unmount.
    first.unmount();

    // 작성 페이지로 복귀 = WritePage 재마운트 (새 컨트롤러 인스턴스).
    const second = mount(model);
    expect(second.result.current.bodyText).toBe('제목 줄\n본문 단락');
    // 파생 제목(첫 줄)도 그대로 복원된다.
    expect(second.result.current.assembleDto().title).toBe('제목 줄');
    // AC-4 불변: 복원 후에도 markupVersion === adapter.getMarkup().
    expect(second.result.current.assembleDto().markupVersion).toBe(second.result.current.getMarkup());
  });

  it('공통정보 12필드도 전환/복귀 시 유지된다', () => {
    const model = createFakeModel();
    const first = mount(model);
    act(() => {
      first.result.current.setBodyMarkup('제목');
      first.result.current.updateCommon('region', '서울');
      first.result.current.updateCommon('keyword', '폭우, 호우');
      first.result.current.updateCommon('embargoAt', '2026-06-06T09:00');
    });
    first.unmount();

    const second = mount(model);
    expect(second.result.current.common.region).toBe('서울');
    expect(second.result.current.common.keyword).toBe('폭우, 호우');
    expect(second.result.current.common.embargoAt).toBe('2026-06-06T09:00');
  });

  it('인라인 임베드도 보존된다 (markupVersion 라운드트립)', () => {
    const model = createFakeModel();
    const first = mount(model);
    act(() => first.result.current.setBodyMarkup('본문'));
    act(() => first.result.current.embed({ type: 'image', source: 'youtube', title: 't', url: 'https://i/1' }));
    first.unmount();

    const second = mount(model);
    const embeds = second.result.current.content.blocks.filter((b) => b.type === 'embed');
    expect(embeds).toHaveLength(1);
    expect(embeds[0].embed.type).toBe('image');
  });

  it('아무것도 입력하지 않은 깨끗한 페이지는 떠났다 돌아와도 빈 초안이다 (빈 draft 미보존)', () => {
    const model = createFakeModel();
    const first = mount(model);
    // 入力 없음 — 작성자만 자동 채워진 기본 상태.
    first.unmount();

    const second = mount(model);
    expect(second.result.current.bodyText).toBe('');
    expect(second.result.current.common.author).toBe(USER.name);
    // 빈 초안은 저장조차 되지 않아야 한다 (storage 키 부재).
    expect(sessionStorage.getItem('newsroom.writeDraft')).toBeNull();
  });

  it('편집 진입(?id=)은 보존된 새 초안을 덮어쓰지 않고 서버 로드가 우선한다 (편집 로드 우선)', async () => {
    const model = createFakeModel();
    // 사용자가 새 초안을 작성하다 조회로 떠났다 (draft 보존).
    const first = mount(model);
    act(() => first.result.current.setBodyMarkup('보존된 새 초안'));
    first.unmount();

    // 이제 편집 컨텍스트(?id=)로 진입한다 — 서버 row 가 로드되어야 하고, 보존된 새 초안이 새어들면 안 된다.
    const queryArticles = vi.fn().mockResolvedValue([
      { articleId: 'AKR-001', status: 'RDS', markupVersion: markupFor('편집 제목\n편집 본문(끝)'), author: '원작성자' },
    ]);
    const editModel = createFakeModel({ queryArticles });
    const edit = mount(editModel, { editArticleId: 'AKR-001' });
    await waitFor(() => expect(edit.result.current.common.author).toBe('원작성자'));
    // 서버 로드가 이긴다 — 보존된 새 초안 텍스트가 아니라 편집 row 본문이 보인다.
    expect(edit.result.current.bodyText).toContain('편집 본문');
    expect(edit.result.current.bodyText).not.toContain('보존된 새 초안');
    // 편집 컨텍스트에선 read-only ContentsVO(편집 row 메타)가 노출되고, 저장은 로드된 id 로 PUT 된다.
    expect(edit.result.current.readonlyMeta?.articleId).toBe('AKR-001');
  });

  it('송고 성공 후 복귀하면 초기화된 빈 페이지다 (보존 draft 도 함께 비워짐)', async () => {
    const saveArticle = vi.fn().mockResolvedValue({ ok: true, articleId: 'A-9' });
    const applyAction = vi.fn().mockResolvedValue({ ok: true, status: 'DPS' });
    const model = createFakeModel({ saveArticle, applyAction });
    const first = mount(model);
    act(() => first.result.current.setBodyMarkup('보낼 제목\n본문(끝)'));
    await act(async () => { await first.result.current.send(); });
    // 성공 → 컨트롤러가 리셋되어 본문이 비워진다.
    expect(first.result.current.bodyText).toBe('');
    // 저장된 draft 도 비워져야 한다 (news.md: 액션 성공 후 작성 페이지 초기화는 보존 대상이 아님).
    expect(sessionStorage.getItem('newsroom.writeDraft')).toBeNull();
    first.unmount();

    // 복귀해도 옛 초안이 되살아나지 않는다.
    const second = mount(model);
    expect(second.result.current.bodyText).toBe('');
  });
});
