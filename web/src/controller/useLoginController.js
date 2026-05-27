// Login controller (REQ-FE-LOGIN-002..004, EC-1): handles submit, calls Model.login,
// strips any password field from the returned identity, and reports success/error.
import { useState } from 'react';
import { useModel } from '../app/context.js';

/** Remove any password/hash field so the UI never stores or displays it (EC-1, REQ-USR-LOGIN-004). */
function sanitizeUser(user) {
  if (!user) return user;
  const { password, passwordHash, ...safe } = user;
  return safe;
}

export function useLoginController(onSuccess) {
  const model = useModel();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(userId, password) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await model.login(userId, password);
      if (!result?.ok) {
        setError('로그인 실패: 아이디 또는 암호를 확인하세요.');
        return;
      }
      onSuccess(sanitizeUser(result.user));
    } catch {
      setError('로그인 실패: 인증 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, error, submitting };
}
