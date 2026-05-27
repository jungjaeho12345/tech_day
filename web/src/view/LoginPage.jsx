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
    <main>
      <h1>로그인</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="login-userId">아이디</label>
        <input
          id="login-userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          autoComplete="username"
        />
        <label htmlFor="login-password">암호</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit">로그인</button>
      </form>
      {error ? <div role="alert">{error}</div> : null}
    </main>
  );
}
