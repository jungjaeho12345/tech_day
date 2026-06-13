// @MX:ANCHOR: [AUTO] Receiver-management controller — drives rcvMgmt.do read/create/delete (fan_in: RcvMgmtPage + its tests).
// @MX:REASON: encodes the SPEC-RCV-COLLECT-001 REQ-RCV-MGMT-001..006 client contract (list/create/delete
// against { ok, entries } / { ok, id } / { ok } shapes, Z-only denial surfaced as state); the page and its
// tests depend on these exact loading/error semantics.
//
// Controller for the 수신처 관리 page. The backend (server/index.js) enforces Z-only from the validated
// session and returns { ok:false, reason } to R/D/unauthenticated callers; this controller treats that
// denial as a first-class state (denied) rather than an error, and never sends a role from the client.
import { useState, useEffect, useCallback } from 'react';
import { useModel } from '../app/context.js';

// Allowed receiver-config kinds — 1:1 with the backend RECEIVER_CONFIG_KINDS (src/db/schema.js):
// api 설정 / FTP 송신 / 수신(화이트리스트) 설정. A 'receive' entry MUST carry a sourceId (whitelist member).
export const RECEIVER_KINDS = Object.freeze([
  { value: 'receive', label: '수신 (화이트리스트)' },
  { value: 'api', label: 'API 설정' },
  { value: 'ftp-send', label: 'FTP 송신' },
]);

/** Human-readable kind label for a stored entry; falls back to the raw value for unknown kinds. */
export function kindLabel(value) {
  return RECEIVER_KINDS.find((k) => k.value === value)?.label ?? value;
}

export function useRcvMgmtController() {
  const model = useModel();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  // 'denied' is set when the backend rejects (R/D/unauthenticated) — REQ-RCV-MGMT-005 Z-only gate.
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(null);

  // REQ-RCV-MGMT-001 — load the configuration entries. A { ok:false } response means the session is not
  // Z (server-side Z-gate); surface it as `denied` so the page renders an access-denied state.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await model.queryReceiverConfig();
      if (result?.ok) {
        setDenied(false);
        setEntries(Array.isArray(result.entries) ? result.entries : []);
      } else {
        // forbidden/unauthenticated -> Z-only denial; any other reason -> generic error message.
        if (result?.reason === 'forbidden' || result?.reason === 'unauthenticated') {
          setDenied(true);
          setEntries([]);
        } else {
          setError('수신처 설정을 불러오지 못했습니다.');
        }
      }
    } catch {
      setError('수신처 설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    load();
  }, [load]);

  // REQ-RCV-MGMT-002 — create an entry. Returns true on success so the page can reset its form.
  // On failure, maps the backend reason to a Korean message (중복/검증/권한 거부) without throwing.
  const create = useCallback(async (entry) => {
    setError(null);
    try {
      const result = await model.createReceiverConfig(entry);
      if (result?.ok) {
        await load(); // 성공 후 목록 갱신 (REQ-RCV-MGMT-001 재조회).
        return true;
      }
      setError(reasonToMessage(result?.reason, 'create'));
      return false;
    } catch {
      setError('수신처 설정 생성에 실패했습니다.');
      return false;
    }
  }, [model, load]);

  // REQ-RCV-MGMT-003 — delete an entry by id, then refresh the list (REQ-RCV-MGMT-001).
  // REQ-RCV-MGMT-004: this removes ONLY the config entry; collected articles are never touched
  // (enforced server-side). Returns true on success.
  const remove = useCallback(async (id) => {
    setError(null);
    try {
      const result = await model.deleteReceiverConfig(id);
      if (result?.ok) {
        await load();
        return true;
      }
      setError(reasonToMessage(result?.reason, 'delete'));
      return false;
    } catch {
      setError('수신처 설정 삭제에 실패했습니다.');
      return false;
    }
  }, [model, load]);

  return { entries, loading, denied, error, reload: load, create, remove };
}

/** Map a backend reason code to a user-facing Korean message for create/delete failures. */
function reasonToMessage(reason, op) {
  switch (reason) {
    case 'forbidden':
    case 'unauthenticated':
      return '권한이 없습니다. 관리자(Z) 권한이 필요합니다.';
    case 'invalid-kind':
      return '설정 종류가 올바르지 않습니다.';
    case 'missing-sourceId':
      return '수신 설정에는 출처 ID가 필요합니다.';
    case 'not-found':
      return '대상 설정을 찾을 수 없습니다.';
    default:
      return op === 'delete' ? '수신처 설정 삭제에 실패했습니다.' : '수신처 설정 생성에 실패했습니다.';
  }
}
