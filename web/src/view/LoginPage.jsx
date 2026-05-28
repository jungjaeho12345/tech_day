// Login page view (REQ-FE-LOGIN-001/005, AC-2.1/2.2/2.3).
import { useState } from 'react';
import { useLoginController } from '../controller/useLoginController.js';

export function LoginPage({ onSuccess }) {
  const { submit, error } = useLoginController(onSuccess);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    submit(userId, password);
  }

  return (
    <main className="yh-login-wrap">
      <div className="yh-card">
        <div className="yh-card__header">
          <div className="yh-card__logo">연합뉴스</div>
          <div className="yh-card__subtitle">기사 제작 시스템</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="yh-field">
            <label htmlFor="login-userId">아이디</label>
            <input
              id="login-userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="yh-field">
            <label htmlFor="login-password">암호</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="yh-btn yh-btn--primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            로그인
          </button>
        </form>

        {error ? <div role="alert" className="yh-alert" style={{ marginTop: '0.75rem' }}>{error}</div> : null}
      </div>
    </main>
  );
}
