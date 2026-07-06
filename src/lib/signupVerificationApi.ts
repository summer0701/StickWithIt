import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseClient';

export class SignupVerificationApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SignupVerificationApiError';
    this.status = status;
  }
}

export function requestSignupVerificationCode(email: string) {
  return callSignupVerificationApi('request', { email });
}

export function consumeSignupVerificationCode(email: string, code: string) {
  return callSignupVerificationApi('consume', { email, code });
}

async function callSignupVerificationApi(action: 'request' | 'consume', body: Record<string, string>) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/signup-verification/${action}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await parseJsonResponse<{ message?: string; success?: boolean; expiresInSeconds?: number }>(response);
  if (!response.ok || data.success === false) {
    throw new SignupVerificationApiError(data.message ?? '요청 처리 중 문제가 발생했습니다.', response.status);
  }

  return data;
}

async function parseJsonResponse<T>(response: Response) {
  try {
    return await response.json() as T;
  } catch {
    return { success: false, message: '서버 응답을 읽을 수 없습니다.' } as T;
  }
}
