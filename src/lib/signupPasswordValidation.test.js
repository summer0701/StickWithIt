import { describe, expect, it } from 'vitest';
import { validateSignupPasswords } from './signupPasswordValidation';

describe('signup password validation', () => {
  it('accepts matching signup passwords', () => {
    expect(validateSignupPasswords('password', 'password')).toBe('');
  });

  it('rejects mismatched signup passwords', () => {
    expect(validateSignupPasswords('password', 'different')).toBe('비밀번호가 일치하지 않습니다.');
  });
});
