import { describe, expect, it } from 'vitest';
import { formatAuthErrorMessage } from './authErrorMessages';

describe('auth error messages', () => {
  it('translates invalid login credentials to Korean', () => {
    expect(formatAuthErrorMessage({ message: 'Invalid login credentials' })).toBe('이메일 또는 비밀번호가 맞지 않습니다.');
  });

  it('translates unconfirmed email errors to Korean', () => {
    expect(formatAuthErrorMessage({ message: 'Email not confirmed' })).toBe(
      '계정 확인이 아직 완료되지 않았습니다. 다시 회원가입하거나 관리자에게 문의해 주세요.',
    );
  });

  it('keeps unknown messages visible', () => {
    expect(formatAuthErrorMessage({ message: 'Too many requests' })).toBe('Too many requests');
  });
});
