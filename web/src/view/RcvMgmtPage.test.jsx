// 수신처 관리 페이지 테스트 (rcvMgmt.do) — SPEC-RCV-COLLECT-001 REQ-RCV-MGMT-001..006.
// AC-9 (조회/생성/삭제), AC-10 (삭제가 기사 미삭제 — UI 동작·문구), AC-11 (Z 전용: Z 노출, R/D 차단).
// Model 은 기존 패턴대로 createFakeModel 로 stub 한다(실 HTTP 없음).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RcvMgmtPage } from './RcvMgmtPage.jsx';
import { ModelContext, SessionContext } from '../app/context.js';
import { createFakeModel } from '../test/fakeModel.js';

// 관리자(Z) 사용자 기본값 — 페이지 진입 가드(AC-11)를 통과시킨다.
const Z_USER = { userId: 'admin', name: 'Admin', role: 'Z', department: 'IT' };

// Sample receiver-config entries (백엔드 ReceiverConfig 스키마: id/kind/sourceId/config/createdAt).
const SAMPLE_ENTRIES = [
  { id: 'RCV000000001', kind: 'receive', sourceId: 'feed-A', config: { dir: '/in' }, createdAt: '2026-06-13T00:00:00.000Z' },
  { id: 'RCV000000002', kind: 'api', sourceId: null, config: { url: 'https://x' }, createdAt: '2026-06-13T01:00:00.000Z' },
];

/** Render the page inside the Model + Session contexts, awaiting the mount-time load (act). */
async function renderPage({ model, user = Z_USER } = {}) {
  const m = model ?? createFakeModel();
  let utils;
  await act(async () => {
    utils = render(
      <ModelContext.Provider value={m}>
        <SessionContext.Provider value={{ user, navigate: vi.fn(), logout: vi.fn() }}>
          <RcvMgmtPage user={user} nav={null} />
        </SessionContext.Provider>
      </ModelContext.Provider>,
    );
  });
  return { model: m, ...utils };
}

describe('AC-9: rcvMgmt.do 설정 조회/생성/삭제 (REQ-RCV-MGMT-001..003)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('조회: Z 사용자 진입 시 등록된 수신처 설정 목록(스키마 컬럼)이 표로 렌더된다', async () => {
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }) });

    expect(queryReceiverConfig).toHaveBeenCalled();
    const table = await screen.findByTestId('rcv-table');
    // 스키마 컬럼(ID/종류/출처 ID/설정 값/생성 시각)이 1:1 로 노출된다.
    expect(within(table).getByText('RCV000000001')).toBeInTheDocument();
    expect(within(table).getByText('feed-A')).toBeInTheDocument();
    expect(within(table).getByText('RCV000000002')).toBeInTheDocument();
    // kind 는 한글 라벨로 표시된다(receive → 수신, api → API 설정).
    expect(within(table).getByText('수신 (화이트리스트)')).toBeInTheDocument();
    expect(within(table).getByText('API 설정')).toBeInTheDocument();
  });

  it('빈 상태: 목록 0건이면 안내 문구를 보이고 표를 렌더하지 않는다', async () => {
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: [] });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }) });

    expect(screen.getByTestId('rcv-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('rcv-table')).not.toBeInTheDocument();
  });

  it('생성: 수신 설정 생성 폼 제출 시 kind/sourceId/config 가 백엔드 스키마대로 전달되고 목록이 갱신된다', async () => {
    const user = userEvent.setup();
    const createReceiverConfig = vi.fn().mockResolvedValue({ ok: true, id: 'RCV000000009' });
    // 첫 조회는 빈 목록, 생성 후 재조회는 새 엔트리를 반환한다(목록 갱신 검증).
    const queryReceiverConfig = vi.fn()
      .mockResolvedValueOnce({ ok: true, entries: [] })
      .mockResolvedValue({ ok: true, entries: [{ id: 'RCV000000009', kind: 'receive', sourceId: 'feed-Z', config: null, createdAt: '2026-06-13T02:00:00.000Z' }] });
    await renderPage({ model: createFakeModel({ createReceiverConfig, queryReceiverConfig }) });

    await user.selectOptions(screen.getByLabelText('설정 종류'), 'receive');
    await user.type(screen.getByLabelText(/출처 ID/), 'feed-Z');
    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(createReceiverConfig).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'receive', sourceId: 'feed-Z' }),
    );
    // 생성 성공 후 재조회(목록 갱신) — 새 엔트리가 표에 나타난다.
    expect(await screen.findByText('RCV000000009')).toBeInTheDocument();
    expect(queryReceiverConfig).toHaveBeenCalledTimes(2);
  });

  it('생성 실패(중복/검증): 백엔드 reason 을 한글 오류 메시지로 표시한다', async () => {
    const user = userEvent.setup();
    const createReceiverConfig = vi.fn().mockResolvedValue({ ok: false, reason: 'missing-sourceId' });
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: [] });
    await renderPage({ model: createFakeModel({ createReceiverConfig, queryReceiverConfig }) });

    // 'api' kind 로 바꿔 클라이언트측 sourceId 필수 가드를 우회하고, 백엔드 검증 실패 경로를 탄다.
    await user.selectOptions(screen.getByLabelText('설정 종류'), 'api');
    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/출처 ID가 필요/);
  });

  it('삭제: 확인창 수락 시 deleteReceiverConfig(id) 가 호출되고 목록이 갱신된다', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteReceiverConfig = vi.fn().mockResolvedValue({ ok: true });
    const queryReceiverConfig = vi.fn()
      .mockResolvedValueOnce({ ok: true, entries: SAMPLE_ENTRIES })
      .mockResolvedValue({ ok: true, entries: [SAMPLE_ENTRIES[1]] });
    await renderPage({ model: createFakeModel({ deleteReceiverConfig, queryReceiverConfig }) });

    await screen.findByTestId('rcv-table');
    await user.click(screen.getByRole('button', { name: '설정 RCV000000001 삭제' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteReceiverConfig).toHaveBeenCalledWith('RCV000000001');
    // 삭제 후 재조회 — 첫 엔트리가 사라진다.
    await screen.findByText('RCV000000002');
    expect(screen.queryByText('RCV000000001')).not.toBeInTheDocument();
  });

  it('삭제 취소: 확인창 거부 시 deleteReceiverConfig 가 호출되지 않는다', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteReceiverConfig = vi.fn().mockResolvedValue({ ok: true });
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    await renderPage({ model: createFakeModel({ deleteReceiverConfig, queryReceiverConfig }) });

    await screen.findByTestId('rcv-table');
    await user.click(screen.getByRole('button', { name: '설정 RCV000000001 삭제' }));

    expect(deleteReceiverConfig).not.toHaveBeenCalled();
  });
});

describe('AC-10: 설정 삭제가 기사 데이터를 삭제하지 않음 (REQ-RCV-MGMT-004 — UI 동작·문구)', () => {
  it('삭제 의미 안내 문구가 "설정만 제거, 기사 미삭제"를 명시한다', async () => {
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }) });

    const note = screen.getByTestId('rcv-delete-note');
    expect(note).toHaveTextContent(/설정 항목만 제거/);
    expect(note).toHaveTextContent(/이미 수집된 기사.*삭제되지 않/);
  });

  it('삭제 확인창 메시지에도 기사 미삭제 안내가 포함된다', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }) });

    await screen.findByTestId('rcv-table');
    await user.click(screen.getByRole('button', { name: '설정 RCV000000001 삭제' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/이미 수집된 기사.*삭제되지 않/s));
  });
});

describe('AC-11: 관리 권한 게이트 — Z 전용 (REQ-RCV-MGMT-005, DP-RCV-6)', () => {
  it('Z 사용자: 페이지(생성 폼·목록)가 정상 노출된다', async () => {
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }), user: Z_USER });

    expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
    expect(await screen.findByTestId('rcv-table')).toBeInTheDocument();
    expect(screen.queryByTestId('rcv-denied')).not.toBeInTheDocument();
  });

  it('R 사용자: 거부 화면을 보이고 조회 자체를 시도하지 않는다(생성 폼 미노출)', async () => {
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: true, entries: SAMPLE_ENTRIES });
    const rUser = { userId: 'r1', name: 'Reporter', role: 'R', department: 'Politics' };
    await renderPage({ model: createFakeModel({ queryReceiverConfig }), user: rUser });

    expect(screen.getByTestId('rcv-denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
  });

  it('D 사용자: 거부 화면을 보인다', async () => {
    const dUser = { userId: 'd1', name: 'Desk', role: 'D', department: 'Politics' };
    await renderPage({ model: createFakeModel(), user: dUser });

    expect(screen.getByTestId('rcv-denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
  });

  it('서버 거부(forbidden): Z 라 주장해도 백엔드가 거부하면 거부 화면으로 전환된다(이중 가드)', async () => {
    // 프런트 user.role 은 Z 지만 서버가 forbidden 을 반환 — 컨트롤러가 denied 상태로 전환한다.
    const queryReceiverConfig = vi.fn().mockResolvedValue({ ok: false, reason: 'forbidden' });
    await renderPage({ model: createFakeModel({ queryReceiverConfig }), user: Z_USER });

    expect(await screen.findByTestId('rcv-denied')).toBeInTheDocument();
  });
});
