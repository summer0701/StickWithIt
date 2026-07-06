import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPageSource = readFileSync(resolve(process.cwd(), 'src/pages/LoginPage.jsx'), 'utf8');

describe('login page copy', () => {
  it('uses nickname-specific copy for the signup nickname field', () => {
    expect(loginPageSource).toContain('placeholder="닉네임을 입력하세요"');
    expect(loginPageSource).not.toContain('placeholder="운동 이름"');
  });

  it('uses the password recovery link copy on the login page', () => {
    expect(loginPageSource).toContain('비밀번호를 잊으셨나요?');
    expect(loginPageSource).not.toContain('비밀번호 재설정 기능은 준비 중입니다.');
  });

  it('does not tell new users to check a signup confirmation email', () => {
    expect(loginPageSource).not.toContain('가입 확인 메일을 확인해 주세요.');
  });

  it('passes successful auth sessions to the parent app', () => {
    expect(loginPageSource).toContain('onAuthSuccess?.(response.data.session)');
  });

  it('asks signup users to confirm their password', () => {
    expect(loginPageSource).toContain('<strong>비밀번호 확인</strong>');
    expect(loginPageSource).toContain('placeholder="비밀번호를 다시 입력하세요"');
  });

  it('validates matching signup passwords before calling Supabase', () => {
    expect(loginPageSource).toContain('validateSignupPasswords(password, passwordConfirmation)');
  });

  it('does not require a Resend email verification code before signup', () => {
    expect(loginPageSource).not.toContain('이메일 인증코드');
    expect(loginPageSource).not.toContain('이메일 인증코드 받기');
    expect(loginPageSource).not.toContain('인증 후 회원가입');
    expect(loginPageSource).not.toContain('consumeSignupCode(login, signupVerificationCode)');
  });
});
