// 수신처 관리 페이지 (rcvMgmt.do) — SPEC-RCV-COLLECT-001 REQ-RCV-MGMT-001..006, AC-9/AC-10/AC-11.
// API 설정 / FTP 송신 / 수신(화이트리스트) 설정을 조회(GET)·생성(POST)·삭제(DELETE)한다.
// 권한: Z 전용(REQ-RCV-MGMT-005, DP-RCV-6) — 백엔드가 세션 역할로 Z-gate 하고, 프런트도 동일하게
// 비-Z 사용자에게는 거부 메시지를 보인다(App 라우팅은 Z 사용자에게만 진입 링크/페이지를 노출).
// 디자인: 기존 토큰만 재사용(.yh-table=blue 헤더 underline + 1px 회색 행 구분선, .yh-btn, .yh-field, .yh-alert).
import { useState } from 'react';
import { TopBar } from './TopBar.jsx';
import { useRcvMgmtController, RECEIVER_KINDS, kindLabel } from '../controller/useRcvMgmtController.js';

export function RcvMgmtPage({ user, nav }) {
  const { entries, loading, denied, error, create, remove } = useRcvMgmtController();
  const [kind, setKind] = useState('receive');
  const [sourceId, setSourceId] = useState('');
  const [configText, setConfigText] = useState('');
  const [formError, setFormError] = useState(null);

  // Frontend Z-gate (AC-11): mirror the backend Z-only rule. R/D never reach here via the nav link,
  // but a direct /rcvMgmt.do visit (or a server denial) must show an explicit access-denied message.
  const isZ = user?.role === 'Z';
  if (!isZ || denied) {
    return (
      <main className="yh-page-content">
        <TopBar />
        {nav}
        {/* 제목=파란색: 기존 --yh-blue 토큰을 인라인으로 재사용(LoginPage 인라인 스타일 관례). */}
        <h1 style={{ color: 'var(--yh-blue)' }}>수신처 관리</h1>
        <div role="alert" className="yh-alert" data-testid="rcv-denied">
          접근 권한이 없습니다. 수신처 관리는 관리자(Z) 권한 전용입니다.
        </div>
      </main>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    // 'receive' 설정은 화이트리스트 멤버이므로 출처 ID가 필수다 (백엔드 missing-sourceId 와 정합).
    if (kind === 'receive' && sourceId.trim() === '') {
      setFormError('수신 설정에는 출처 ID가 필요합니다.');
      return;
    }
    // config 입력은 선택. 입력 시 JSON 으로 해석 시도하고, JSON 이 아니면 원문 문자열로 보낸다.
    let config;
    const trimmed = configText.trim();
    if (trimmed !== '') {
      try {
        config = JSON.parse(trimmed);
      } catch {
        config = trimmed;
      }
    }
    const entry = { kind };
    if (sourceId.trim() !== '') entry.sourceId = sourceId.trim();
    if (config !== undefined) entry.config = config;

    const ok = await create(entry);
    if (ok) {
      // 성공 후 폼 초기화 (목록 갱신은 컨트롤러가 수행).
      setSourceId('');
      setConfigText('');
    }
  }

  async function handleDelete(id) {
    // 삭제 확인창 — 설정만 제거되고 이미 수집된 기사는 보존됨을 명시 (REQ-RCV-MGMT-004 / AC-10).
    const confirmed = window.confirm(
      '이 수신처 설정을 삭제하시겠습니까?\n설정 항목만 제거되며, 이미 수집된 기사는 삭제되지 않습니다.',
    );
    if (!confirmed) return;
    await remove(id);
  }

  return (
    <main className="yh-page-content">
      <TopBar />
      {nav}
      {/* 제목=파란색: 기존 --yh-blue 토큰 재사용(신규 토큰 정의 없음). */}
      <h1 style={{ color: 'var(--yh-blue)' }}>수신처 관리</h1>

      {/* 삭제 의미 안내 (AC-10): 설정 삭제는 기사 데이터를 삭제하지 않는다. */}
      <p className="yh-text-muted" data-testid="rcv-delete-note">
        수신처 설정 삭제는 해당 설정 항목만 제거합니다. 이미 수집된 기사(Article/Contents)는 삭제되지 않습니다.
      </p>

      {error ? <div role="alert" className="yh-alert">{error}</div> : null}

      {/* 생성 폼 (REQ-RCV-MGMT-002) — 백엔드 ReceiverConfig 스키마(kind/sourceId/config)에 1:1 정합. */}
      <section aria-labelledby="rcv-create-heading">
        <h2 id="rcv-create-heading" style={{ color: 'var(--yh-blue)' }}>수신처 설정 생성</h2>
        <form onSubmit={handleCreate} noValidate>
          <div className="yh-field">
            <label htmlFor="rcv-kind">설정 종류</label>
            <select id="rcv-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {RECEIVER_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          <div className="yh-field">
            <label htmlFor="rcv-sourceId">
              출처 ID{kind === 'receive' ? ' (필수)' : ' (선택)'}
            </label>
            <input
              id="rcv-sourceId"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="외부 피드/송신처 식별자"
            />
          </div>

          <div className="yh-field">
            <label htmlFor="rcv-config">설정 값 (JSON, 선택)</label>
            <textarea
              id="rcv-config"
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={3}
              placeholder='예: {"host":"ftp.example.com","port":21}'
            />
          </div>

          {formError ? <div role="alert" className="yh-alert">{formError}</div> : null}

          <button type="submit" className="yh-btn yh-btn--primary">생성</button>
        </form>
      </section>

      {/* 목록 조회 (REQ-RCV-MGMT-001) + 삭제 (REQ-RCV-MGMT-003). */}
      <section aria-labelledby="rcv-list-heading">
        <h2 id="rcv-list-heading" style={{ color: 'var(--yh-blue)' }}>등록된 수신처 설정</h2>
        {loading ? (
          <p data-testid="rcv-loading">불러오는 중…</p>
        ) : entries.length === 0 ? (
          // 빈 상태 (목록 0건).
          <p className="yh-text-muted" data-testid="rcv-empty">등록된 수신처 설정이 없습니다.</p>
        ) : (
          <table className="yh-table" data-testid="rcv-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">종류</th>
                <th scope="col">출처 ID</th>
                <th scope="col">설정 값</th>
                <th scope="col">생성 시각</th>
                <th scope="col">작업</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.id}</td>
                  <td>{kindLabel(entry.kind)}</td>
                  <td>{entry.sourceId ?? ''}</td>
                  <td>{formatConfig(entry.config)}</td>
                  <td>{entry.createdAt ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      className="yh-btn yh-btn--kill yh-btn--sm"
                      aria-label={`설정 ${entry.id} 삭제`}
                      onClick={() => handleDelete(entry.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

/** Render a stored config (object or string) compactly for the table cell. */
function formatConfig(config) {
  if (config === null || config === undefined) return '';
  if (typeof config === 'string') return config;
  try {
    return JSON.stringify(config);
  } catch {
    return String(config);
  }
}
