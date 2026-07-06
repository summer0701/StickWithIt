import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseClient';

export class AccountDeletionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountDeletionError';
    this.status = status;
  }
}

export async function deleteCurrentAccount(supabaseClient: {
  auth: {
    getSession: () => Promise<{ data?: { session?: { access_token?: string } | null }; error?: { message?: string } | null }>;
  };
}) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw new AccountDeletionError(error.message ?? '로그인 세션을 확인할 수 없습니다.', 401);

  return requestAccountDeletion(data?.session?.access_token);
}

export async function requestAccountDeletion(accessToken?: string, fetchImpl: typeof fetch = fetch) {
  if (!accessToken) {
    throw new AccountDeletionError('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', 401);
  }

  const response = await fetchImpl(`${SUPABASE_FUNCTIONS_URL}/account-delete`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await parseJsonResponse<{ success?: boolean; message?: string }>(response);
  if (!response.ok || data.success === false) {
    throw new AccountDeletionError(data.message ?? '회원탈퇴 처리에 실패했습니다.', response.status);
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
