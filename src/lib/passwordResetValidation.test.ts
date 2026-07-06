import { describe, expect, it } from 'vitest';
import {
  isCompleteVerificationCode,
  isValidPasswordResetEmail,
  normalizePasswordResetEmail,
  normalizeVerificationCode,
  validateNewPassword,
} from './passwordResetValidation';

describe('password reset validation', () => {
  it('normalizes and validates email input', () => {
    expect(normalizePasswordResetEmail('  Polly@GNU.ac.kr ')).toBe('polly@gnu.ac.kr');
    expect(isValidPasswordResetEmail('polly@gnu.ac.kr')).toBe(true);
    expect(isValidPasswordResetEmail('polly')).toBe(false);
  });

  it('keeps verification codes numeric and six digits long', () => {
    expect(normalizeVerificationCode('42a8-3919')).toBe('428391');
    expect(isCompleteVerificationCode('428391')).toBe(true);
    expect(isCompleteVerificationCode('42839')).toBe(false);
  });

  it('requires strong matching passwords', () => {
    expect(validateNewPassword('abc12345', 'abc12345')).toBe('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.');
    expect(validateNewPassword('abc12345!', 'abc12345?')).toBe('비밀번호가 일치하지 않습니다.');
    expect(validateNewPassword('abc12345!', 'abc12345!')).toBe('');
  });
});
