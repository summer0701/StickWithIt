import { useState } from 'react';
import { Lock, Mail, MessageCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { clearTestSession, createTestSession, isTestCredentials, saveTestSession, TEST_ACCOUNT } from '../lib/testAuth';

const APP_AUTH_CALLBACK_URL = 'com.stickwithit.endure://auth/callback';
const EMAIL_REDIRECT_TO = typeof window === 'undefined' ? APP_AUTH_CALLBACK_URL : window.location.origin;
const KAKAO_PROFILE_SCOPES = 'profile_nickname profile_image';

export default function LoginPage({ onTestLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [submitting, setSubmitting] = useState(false);
  const [kakaoSubmitting, setKakaoSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  function showMessage(nextMessage, nextType = 'success') {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  async function handleKakaoLogin() {
    setKakaoSubmitting(true);
    showMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: APP_AUTH_CALLBACK_URL,
        scopes: KAKAO_PROFILE_SCOPES,
        queryParams: {
          scope: KAKAO_PROFILE_SCOPES,
        },
      },
    });

    if (error) {
      showMessage(error.message, 'error');
      setKakaoSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    showMessage('');

    const login = email.trim();

    if (!isSignup && isTestCredentials(login, password)) {
      const response = await signInTestAccount();
      if (response.data?.session) {
        clearTestSession();
      } else {
        const testSession = createTestSession();
        saveTestSession(testSession);
        onTestLogin?.(testSession);
      }
      showMessage('로그인되었습니다.');
      setSubmitting(false);
      return;
    }

    const response = isSignup
      ? await supabase.auth.signUp({
          email: login,
          password,
          options: {
            data: {
              nickname: nickname.trim() || login.split('@')[0],
            },
            emailRedirectTo: EMAIL_REDIRECT_TO,
          },
        })
      : await supabase.auth.signInWithPassword({ email: login, password });

    if (response.error) {
      showMessage(response.error.message, 'error');
    } else {
      showMessage(isSignup ? '가입 확인 메일을 확인해 주세요.' : '로그인되었습니다.');
    }

    setSubmitting(false);
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label="로그인">
        <p className="eyebrow">Stick With It</p>
        <h1>끝까지 버티는 사람들의 운동 기록</h1>
        <p className="login-copy">카카오로 바로 시작하거나 이메일로 로그인하세요.</p>

        <button className="kakao-login-button" disabled={kakaoSubmitting || submitting} onClick={handleKakaoLogin} type="button">
          <MessageCircle size={20} aria-hidden="true" />
          <span>{kakaoSubmitting ? '카카오 연결 중...' : '카카오로 계속하기'}</span>
        </button>

        <div className="auth-divider">
          <span>또는</span>
        </div>

        <div className="mode-switch auth-mode-switch" role="tablist" aria-label="인증 방식">
          <button className={!isSignup ? 'active' : ''} onClick={() => setMode('login')} type="button">
            로그인
          </button>
          <button className={isSignup ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup && (
            <label>
              닉네임
              <span className="input-shell">
                <User size={18} aria-hidden="true" />
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  type="text"
                  autoComplete="nickname"
                  placeholder="운동 이름"
                />
              </span>
            </label>
          )}
          <label>
            이메일
            <span className="input-shell">
              <Mail size={18} aria-hidden="true" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </span>
          </label>
          <label>
            비밀번호
            <span className="input-shell">
              <Lock size={18} aria-hidden="true" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={4}
                placeholder="4자 이상"
                required
              />
            </span>
          </label>
          <button className="primary-button" disabled={submitting || kakaoSubmitting} type="submit">
            {submitting ? '처리 중...' : isSignup ? '회원가입' : '로그인'}
          </button>
        </form>
        {message && <p className={`message ${messageType}`}>{message}</p>}
      </section>
    </main>
  );
}

async function signInTestAccount() {
  const signIn = await supabase.auth.signInWithPassword({
    email: TEST_ACCOUNT.email,
    password: TEST_ACCOUNT.password,
  });
  if (!signIn.error) return signIn;

  return supabase.auth.signUp({
    email: TEST_ACCOUNT.email,
    password: TEST_ACCOUNT.password,
    options: { data: { nickname: TEST_ACCOUNT.login } },
  });
}
