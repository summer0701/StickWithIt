const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function normalizePasswordResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidPasswordResetEmail(email: string) {
  return EMAIL_PATTERN.test(normalizePasswordResetEmail(email));
}

export function normalizeVerificationCode(code: string) {
  return code.replace(/\D/g, '').slice(0, 6);
}

export function isCompleteVerificationCode(code: string) {
  return /^\d{6}$/.test(code);
}

export function validateNewPassword(password: string, confirmPassword: string) {
  if (!PASSWORD_PATTERN.test(password)) {
    return '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.';
  }

  if (password !== confirmPassword) {
    return '비밀번호가 일치하지 않습니다.';
  }

  return '';
}
