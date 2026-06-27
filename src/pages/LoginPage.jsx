import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createTestSession, isTestCredentials, saveTestSession } from '../lib/testAuth';

export default function LoginPage({ onTestLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('password');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const login = email.trim();

    if (mode === 'password' && isTestCredentials(login, password)) {
      const testSession = createTestSession();
      saveTestSession(testSession);
      onTestLogin?.(testSession);
      setMessage('로그인되었습니다.');
      setSubmitting(false);
      return;
    }

    const response =
      mode === 'magic'
        ? await supabase.auth.signInWithOtp({
            email: login,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email: login, password });

    if (response.error && mode === 'password') {
      const signUp = await supabase.auth.signUp({ email: login, password });
      if (signUp.error) setMessage(signUp.error.message);
      else setMessage('가입 확인 메일을 확인해 주세요.');
    } else if (response.error) {
      setMessage(response.error.message);
    } else {
      setMessage(mode === 'magic' ? '메일의 로그인 링크를 확인해 주세요.' : '로그인되었습니다.');
    }

    setSubmitting(false);
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <p className="eyebrow">Ghost Run MVP</p>
        <h1>끝까지 버텨라</h1>
        <p className="login-copy">오늘의 목표를 정하고 어제의 나를 이겨보세요.</p>

        <div className="mode-switch">
          <button className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')} type="button">
            비밀번호
          </button>
          <button className={mode === 'magic' ? 'active' : ''} onClick={() => setMode('magic')} type="button">
            매직 링크
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            이메일 또는 ID
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="text" required />
          </label>
          {mode === 'password' && (
            <label>
              비밀번호
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={4}
                required
              />
            </label>
          )}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? '처리 중...' : '시작하기'}
          </button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
