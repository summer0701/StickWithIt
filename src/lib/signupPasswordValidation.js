export function validateSignupPasswords(password, passwordConfirmation) {
  if (password !== passwordConfirmation) {
    return '비밀번호가 일치하지 않습니다.';
  }

  return '';
}
