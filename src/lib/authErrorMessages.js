const INVALID_LOGIN_PATTERN = /invalid login credentials/i;
const EMAIL_NOT_CONFIRMED_PATTERN = /email.*not.*confirmed|confirm/i;

export function formatAuthErrorMessage(error) {
  const message = error?.message ?? '';

  if (INVALID_LOGIN_PATTERN.test(message)) {
    return '이메일 또는 비밀번호가 맞지 않습니다.';
  }

  if (EMAIL_NOT_CONFIRMED_PATTERN.test(message)) {
    return '계정 확인이 아직 완료되지 않았습니다. 다시 회원가입하거나 관리자에게 문의해 주세요.';
  }

  return message || '인증 처리 중 오류가 발생했습니다.';
}
