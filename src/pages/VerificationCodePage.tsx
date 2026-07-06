import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import loginBg from '../assets/login-bg.webp';
import runningManLogo from '../assets/running-man-logo.webp';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { normalizeVerificationCode } from '../lib/passwordResetValidation';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;
const RESEND_SECONDS = 60;

type VerificationCodePageProps = {
  email: string;
  onBack: () => void;
  onVerified: (code: string) => void;
};

export default function VerificationCodePage({ email, onBack, onVerified }: VerificationCodePageProps) {
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_SECONDS);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const { loading, requestCode, verifyCode } = usePasswordReset();
  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      setResendSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      showMessage('6자리 인증코드를 입력해 주세요.', 'error');
      return;
    }

    try {
      await verifyCode(email, code);
      showMessage('인증되었습니다.', 'success');
      onVerified(code);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '인증코드가 올바르지 않습니다.', 'error');
    }
  }

  async function handleResend() {
    if (resendSecondsLeft > 0 || loading) return;

    try {
      const response = await requestCode(email);
      setDigits(Array(CODE_LENGTH).fill(''));
      setSecondsLeft(CODE_TTL_SECONDS);
      setResendSecondsLeft(RESEND_SECONDS);
      inputsRef.current[0]?.focus();
      showMessage(response.message || '복구 코드가 이메일로 발송되었습니다.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '복구 코드 재전송에 실패했습니다.', 'error');
    }
  }

  function handleDigitChange(index: number, value: string) {
    const normalized = normalizeVerificationCode(value);
    if (normalized.length > 1) {
      applyCode(normalized);
      return;
    }

    setDigits((current) => {
      const next = [...current];
      next[index] = normalized;
      return next;
    });

    if (normalized && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyCode(event.clipboardData.getData('text'));
  }

  function applyCode(value: string) {
    const normalized = normalizeVerificationCode(value);
    const nextDigits = Array(CODE_LENGTH).fill('');
    normalized.split('').forEach((digit, index) => {
      nextDigits[index] = digit;
    });
    setDigits(nextDigits);
    inputsRef.current[Math.min(normalized.length, CODE_LENGTH - 1)]?.focus();
  }

  function showMessage(nextMessage: string, nextType: 'success' | 'error') {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  return (
    <main className="login-screen stick-login-screen password-reset-screen" style={{ '--login-bg': `url(${loginBg})` }}>
      <section className="login-panel stick-login-panel password-reset-panel" aria-label="인증코드 입력">
        <div className="stick-login-brand password-reset-brand">
          <img className="stick-runner-logo" src={runningManLogo} alt="" aria-hidden="true" />
          <h1>인증코드 입력</h1>
          <p>이메일로 받은 6자리 코드를 입력하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form stick-auth-form">
          <div className="verification-code-group" role="group" aria-label="6자리 인증코드">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                value={digit}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                aria-label={`인증코드 ${index + 1}번째 숫자`}
              />
            ))}
          </div>

          <p className="password-reset-timer" aria-live="polite">
            {formatSeconds(secondsLeft)}
          </p>

          <button className="primary-button stick-login-submit" disabled={loading || code.length !== CODE_LENGTH} type="submit">
            {loading ? '인증 중...' : '인증하기'}
          </button>
        </form>

        <p className="password-reset-resend">
          코드를 받지 못하셨나요?
          <button disabled={loading || resendSecondsLeft > 0} onClick={handleResend} type="button">
            {resendSecondsLeft > 0 ? `재전송 ${resendSecondsLeft}s` : '재전송'}
          </button>
        </p>

        {message && <p className={`message ${messageType}`}>{message}</p>}

        <p className="stick-signup-line">
          이메일 다시 입력
          <button type="button" onClick={onBack}>
            돌아가기
          </button>
        </p>
      </section>
    </main>
  );
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
