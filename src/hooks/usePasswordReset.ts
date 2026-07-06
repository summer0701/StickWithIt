import { useCallback, useState } from 'react';
import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY } from '../lib/supabaseClient';
import type {
  PasswordResetRequestResponse,
  PasswordResetResponse,
  PasswordResetVerifyResponse,
} from '../types/passwordReset';

class PasswordResetApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PasswordResetApiError';
    this.status = status;
  }
}

export function usePasswordReset() {
  const [loading, setLoading] = useState(false);

  const requestCode = useCallback(async (email: string) => {
    return withLoading(setLoading, () => callPasswordResetApi<PasswordResetRequestResponse>('request', { email }));
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    return withLoading(setLoading, () => callPasswordResetApi<PasswordResetVerifyResponse>('verify', { email, code }));
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    return withLoading(setLoading, () => callPasswordResetApi<PasswordResetResponse>('reset', { email, code, newPassword }));
  }, []);

  return {
    loading,
    requestCode,
    verifyCode,
    resetPassword,
  };
}

async function withLoading<T>(setLoading: (loading: boolean) => void, action: () => Promise<T>) {
  setLoading(true);
  try {
    return await action();
  } finally {
    setLoading(false);
  }
}

async function callPasswordResetApi<T>(action: 'request' | 'verify' | 'reset', body: Record<string, string>) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/password/${action}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await parseJsonResponse<T & { message?: string; success?: boolean }>(response);
  if (!response.ok || data.success === false) {
    throw new PasswordResetApiError(data.message ?? '요청 처리 중 문제가 발생했습니다.', response.status);
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
