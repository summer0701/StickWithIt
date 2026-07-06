import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import loginBg from '../assets/login-bg.webp';
import runningManLogo from '../assets/running-man-logo.webp';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { isValidPasswordResetEmail, normalizePasswordResetEmail } from '../lib/passwordResetValidation';

type ForgotPasswordPageProps = {
  onBack: () => void;
  onCodeSent: (email: string) => void;
};

export default function ForgotPasswordPage({ onBack, onCodeSent }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const { loading, requestCode } = usePasswordReset();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = normalizePasswordResetEmail(email);

    if (!isValidPasswordResetEmail(normalizedEmail)) {
      showMessage('올바른 이메일 주소를 입력해 주세요.', 'error');
      return;
    }

    try {
      const response = await requestCode(normalizedEmail);
      showMessage(response.message || '복구 코드가 이메일로 발송되었습니다.', 'success');
      onCodeSent(normalizedEmail);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '복구 코드 발송에 실패했습니다.', 'error');
    }
  }

  function showMessage(nextMessage: string, nextType: 'success' | 'error') {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  return (
    <main className="login-screen stick-login-screen password-reset-screen" style={{ '--login-bg': `url(${loginBg})` }}>
      <section className="login-panel stick-login-panel password-reset-panel" aria-label="비밀번호 찾기">
        <div className="stick-login-brand password-reset-brand">
          <img className="stick-runner-logo" src={runningManLogo} alt="" aria-hidden="true" />
          <h1>비밀번호 찾기</h1>
          <p>가입한 이메일 주소를 입력하면 복구 코드를 보내드립니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form stick-auth-form">
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

          <button className="primary-button stick-login-submit" disabled={loading} type="submit">
            {loading ? '발송 중...' : '복구 코드 보내기'}
          </button>
        </form>

        {message && <p className={`message ${messageType}`}>{message}</p>}

        <p className="stick-signup-line">
          로그인 화면으로
          <button type="button" onClick={onBack}>
            돌아가기
          </button>
        </p>
      </section>
    </main>
  );
}
