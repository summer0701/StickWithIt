import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return json({ success: true });
  }

  if (request.method !== 'POST') {
    return json({ success: false, message: 'POST 요청만 지원합니다.' }, 405);
  }

  try {
    const accessToken = readBearerToken(request);
    if (!accessToken) {
      return json({ success: false, message: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' }, 401);
    }

    const supabase = adminClient();
    const { data, error: userError } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    if (userError || !userId) {
      console.error('[account-delete] user lookup failed', userError?.message ?? 'Missing user id');
      return json({ success: false, message: '로그인 세션을 확인할 수 없습니다.' }, 401);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId, false);
    if (deleteError) {
      console.error('[account-delete] delete user failed', deleteError.message);
      return json({ success: false, message: deletionErrorMessage(deleteError.message) }, 500);
    }

    return json({ success: true, message: '회원탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('[account-delete] unexpected error', errorMessage(error));
    return json({ success: false, message: '회원탈퇴 처리 중 문제가 발생했습니다.' }, 500);
  }
});

function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : '';
}

function deletionErrorMessage(message: string) {
  if (/storage|object/i.test(message)) {
    return '보관 중인 파일이 있어 회원탈퇴에 실패했습니다. 관리자에게 문의해 주세요.';
  }
  return '회원탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

function requiredEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
