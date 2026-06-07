// Login page view (REQ-FE-LOGIN-001/005, AC-2.1/2.2/2.3).
// Design: 연합뉴스 blue+white style — blue gradient background, white card,
// blue brand wordmark with red left rule, blue field labels. (CLAUDE.md)
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
        <header className="yh-card__header">
          <h1 className="yh-card__logo">연합뉴스</h1>
          <p className="yh-card__subtitle">기사 제작 시스템</p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="yh-field">
            <label htmlFor="login-userId">아이디</label>
            <input
              id="login-userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              placeholder="아이디를 입력하세요"
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
              placeholder="암호를 입력하세요"
            />
          </div>

          <button type="submit" className="yh-btn yh-btn--primary" style={{ width: '100%', marginTop: '0.75rem' }}>
            로그인
          </button>
        </form>

        {error ? <div role="alert" className="yh-alert">{error}</div> : null}
      </div>
    </main>
  );
}
