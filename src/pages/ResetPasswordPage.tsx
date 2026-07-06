import { FormEvent, useState } from 'react';
import { CheckCircle2, Eye, Lock } from 'lucide-react';
import loginBg from '../assets/login-bg.webp';
import runningManLogo from '../assets/running-man-logo.webp';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { validateNewPassword } from '../lib/passwordResetValidation';

type ResetPasswordPageProps = {
  email: string;
  code: string;
  onBack: () => void;
  onComplete: (message: string) => void;
};

export default function ResetPasswordPage({ email, code, onBack, onComplete }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [completed, setCompleted] = useState(false);
  const { loading, resetPassword } = usePasswordReset();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationMessage = validateNewPassword(password, confirmPassword);
    if (validationMessage) {
      showMessage(validationMessage, 'error');
      return;
    }

    try {
      const response = await resetPassword(email, code, password);
      setCompleted(true);
      showMessage(response.message || '비밀번호가 성공적으로 변경되었습니다.', 'success');
      window.setTimeout(() => onComplete(response.message || '비밀번호가 성공적으로 변경되었습니다.'), 650);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.', 'error');
    }
  }

  function showMessage(nextMessage: string, nextType: 'success' | 'error') {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  return (
    <main className="login-screen stick-login-screen password-reset-screen" style={{ '--login-bg': `url(${loginBg})` }}>
      <section className="login-panel stick-login-panel password-reset-panel" aria-label="비밀번호 변경">
        <div className="stick-login-brand password-reset-brand">
          <img className="stick-runner-logo" src={runningManLogo} alt="" aria-hidden="true" />
          <h1>비밀번호 변경</h1>
          <p>새로운 비밀번호를 입력하세요.</p>
          {completed && <CheckCircle2 className="password-reset-success-icon" size={46} aria-hidden="true" />}
        </div>

        <form onSubmit={handleSubmit} className="auth-form stick-auth-form">
          <label>
            <strong>새 비밀번호</strong>
            <span className="input-shell stick-input-shell">
              <Lock size={30} aria-hidden="true" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="새 비밀번호를 입력하세요"
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

          <label>
            <strong>비밀번호 확인</strong>
            <span className="input-shell stick-input-shell">
              <Lock size={30} aria-hidden="true" />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </span>
          </label>

          <button className="primary-button stick-login-submit" disabled={loading || completed} type="submit">
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        {message && <p className={`message ${messageType}`}>{message}</p>}

        <p className="stick-signup-line">
          인증코드 다시 입력
          <button type="button" onClick={onBack}>
            돌아가기
          </button>
        </p>
      </section>
    </main>
  );
}
