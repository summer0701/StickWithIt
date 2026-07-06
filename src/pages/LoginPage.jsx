import { useState } from 'react';
import { Eye, Lock, Mail, User } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { signUpWithImmediateSession } from '../lib/authSignup';
import { clearTestSession, createTestSession, isTestCredentials, saveTestSession, TEST_ACCOUNT } from '../lib/testAuth';
import loginBg from '../assets/login-bg.webp';
import runningManLogo from '../assets/running-man-logo.webp';

const APP_AUTH_CALLBACK_URL = 'com.stickwithit.endure://auth/callback';
const EMAIL_REDIRECT_TO = typeof window === 'undefined' ? APP_AUTH_CALLBACK_URL : window.location.origin;
const KAKAO_PROFILE_SCOPES = 'profile_nickname profile_image';

export default function LoginPage({ onAuthSuccess, onForgotPassword, onTestLogin, initialMessage = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState(initialMessage);
  const [messageType, setMessageType] = useState('success');
  const [submitting, setSubmitting] = useState(false);
  const [kakaoSubmitting, setKakaoSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);

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

    const result = isSignup
      ? await signUpWithImmediateSession(supabase, {
          email: login,
          password,
          nickname,
          emailRedirectTo: EMAIL_REDIRECT_TO,
        })
      : { response: await supabase.auth.signInWithPassword({ email: login, password }) };
    const { response } = result;

    if (response.error) {
      showMessage(response.error.message, 'error');
    } else if (response.data?.session) {
      clearTestSession();
      onAuthSuccess?.(response.data.session);
      showMessage('로그인되었습니다.');
    } else if (result.requiresEmailConfirmation) {
      showMessage('가입은 완료됐지만 이메일 확인 설정 때문에 바로 로그인할 수 없습니다.', 'error');
    } else {
      showMessage('로그인 세션을 만들지 못했습니다. 다시 로그인해 주세요.', 'error');
    }

    setSubmitting(false);
  }

  return (
    <main className="login-screen stick-login-screen" style={{ '--login-bg': `url(${loginBg})` }}>
      <section className="login-panel stick-login-panel" aria-label="로그인">
        <div className="stick-login-brand">
          <img className="stick-runner-logo" src={runningManLogo} alt="" aria-hidden="true" />
          <h1>STICK WITH IT</h1>
          <p>끝까지 버티는 당신을 위한 시작</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form stick-auth-form">
          {isSignup && (
            <label>
              <strong>닉네임</strong>
              <span className="input-shell stick-input-shell">
                <User size={28} aria-hidden="true" />
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  type="text"
                  autoComplete="nickname"
                  placeholder="닉네임을 입력하세요"
                />
              </span>
            </label>
          )}
          <label>
            <strong>이메일</strong>
            <span className="input-shell stick-input-shell">
              <Mail size={30} aria-hidden="true" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="이메일을 입력하세요"
                required
              />
            </span>
          </label>
          <label>
            <strong>비밀번호</strong>
            <span className="input-shell stick-input-shell">
              <Lock size={30} aria-hidden="true" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={4}
                placeholder="비밀번호를 입력하세요"
                required
              />
              <button
                className="password-eye-button"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <Eye size={31} aria-hidden="true" />
              </button>
            </span>
          </label>

          {!isSignup && (
            <div className="login-options-row">
              <label className="remember-check">
                <input
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                  type="checkbox"
                />
                <span>로그인 상태 유지</span>
              </label>
              <button type="button" onClick={onForgotPassword}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          <button className="primary-button stick-login-submit" disabled={submitting || kakaoSubmitting} type="submit">
            {submitting ? '처리 중...' : isSignup ? '회원가입' : '로그인'}
          </button>
        </form>

        <div className="auth-divider stick-auth-divider">
          <span>또는</span>
        </div>

        {!isSignup && (
          <button className="kakao-login-button stick-outline-login" disabled={kakaoSubmitting || submitting} onClick={handleKakaoLogin} type="button">
            <span className="talk-badge">TALK</span>
            <span>{kakaoSubmitting ? '카카오 연결 중...' : '카카오로 로그인'}</span>
          </button>
        )}

        <p className="stick-signup-line">
          {isSignup ? '계정이 있으신가요?' : '계정이 없으신가요?'}
          <button type="button" onClick={() => setMode(isSignup ? 'login' : 'signup')}>
            {isSignup ? '로그인' : '회원가입'}
          </button>
        </p>

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
