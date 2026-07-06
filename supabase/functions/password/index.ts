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

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const DAILY_SEND_LIMIT = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PasswordResetToken = {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  used: boolean;
  attempt_count: number;
  verified_at: string | null;
  reset_at: string | null;
  created_at: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return json({ success: true });
  }

  if (request.method !== 'POST') {
    return json({ success: false, message: 'POST 요청만 지원합니다.' }, 405);
  }

  const pathname = new URL(request.url).pathname;
  const action = pathname.split('/').filter(Boolean).pop();

  try {
    if (action === 'request') return await requestResetCode(request);
    if (action === 'verify') return await verifyResetCode(request);
    if (action === 'reset') return await resetPassword(request);
    return json({ success: false, message: '지원하지 않는 비밀번호 재설정 경로입니다.' }, 404);
  } catch (error) {
    console.error('[password-reset] unexpected error', errorMessage(error));
    return json({ success: false, message: '요청 처리 중 문제가 발생했습니다.' }, 500);
  }
});

async function requestResetCode(request: Request) {
  const { email } = await readBody(request);
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return json({ success: false, message: '올바른 이메일 주소를 입력해 주세요.' }, 400);
  }

  const supabase = adminClient();
  const userId = await findUserIdByEmail(supabase, normalizedEmail);
  if (!userId) {
    return json({ success: false, message: '가입되지 않은 이메일입니다.' }, 404);
  }

  const now = new Date();
  const recentToken = await findRecentToken(supabase, normalizedEmail);
  if (recentToken && now.getTime() - new Date(recentToken.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return json({ success: false, message: '복구 코드는 1분에 한 번만 발송할 수 있습니다.' }, 429);
  }

  const sentToday = await countTokensCreatedToday(supabase, normalizedEmail, now);
  if (sentToday >= DAILY_SEND_LIMIT) {
    return json({ success: false, message: '오늘 발송 가능한 복구 코드 횟수를 초과했습니다.' }, 429);
  }

  const code = generateNumericCode(CODE_LENGTH);
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const codeHash = await hashResetCode(normalizedEmail, code);

  await supabase
    .from('password_reset_tokens')
    .update({ reset_at: now.toISOString() })
    .eq('email', normalizedEmail)
    .is('reset_at', null);

  const { error: insertError } = await supabase.from('password_reset_tokens').insert({
    user_id: userId,
    email: normalizedEmail,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('[password-reset] token insert failed', insertError.message);
    return json({ success: false, message: '복구 코드 저장에 실패했습니다.' }, 500);
  }

  const emailResult = await sendResetCodeEmail(normalizedEmail, code);
  if (!emailResult.success) {
    console.error('[password-reset] resend failed', emailResult.message);
    return json({ success: false, message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  }

  return json({ success: true, message: '복구 코드가 이메일로 발송되었습니다.', expiresInSeconds: CODE_TTL_MINUTES * 60 });
}

async function verifyResetCode(request: Request) {
  const { email, code } = await readBody(request);
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeCode(code);
  if (!isValidEmail(normalizedEmail) || !isValidCode(normalizedCode)) {
    return json({ success: false, message: '인증코드가 올바르지 않습니다.' }, 400);
  }

  const supabase = adminClient();
  const token = await findLatestResetToken(supabase, normalizedEmail);
  if (!token) {
    return json({ success: false, message: '인증코드가 올바르지 않습니다.' }, 400);
  }

  const validation = await validateTokenCode(supabase, token, normalizedEmail, normalizedCode);
  if (!validation.success) {
    return json({ success: false, message: validation.message }, validation.status);
  }

  const { error } = await supabase
    .from('password_reset_tokens')
    .update({ used: true, verified_at: new Date().toISOString() })
    .eq('id', token.id);

  if (error) {
    console.error('[password-reset] token verify update failed', error.message);
    return json({ success: false, message: '인증 처리에 실패했습니다.' }, 500);
  }

  return json({ success: true, message: '인증되었습니다.' });
}

async function resetPassword(request: Request) {
  const { email, code, newPassword } = await readBody(request);
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeCode(code);
  const password = typeof newPassword === 'string' ? newPassword : '';

  if (!isValidEmail(normalizedEmail) || !isValidCode(normalizedCode)) {
    return json({ success: false, message: '인증코드가 올바르지 않습니다.' }, 400);
  }

  if (!isStrongPassword(password)) {
    return json({ success: false, message: '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.' }, 400);
  }

  const supabase = adminClient();
  const token = await findLatestVerifiedToken(supabase, normalizedEmail);
  if (!token) {
    return json({ success: false, message: '인증코드가 올바르지 않습니다.' }, 400);
  }

  const validation = await validateTokenCode(supabase, token, normalizedEmail, normalizedCode, { countFailure: false });
  if (!validation.success) {
    return json({ success: false, message: validation.message }, validation.status);
  }

  const { error: passwordError } = await supabase.auth.admin.updateUserById(token.user_id, { password });
  if (passwordError) {
    console.error('[password-reset] password update failed', passwordError.message);
    return json({ success: false, message: '비밀번호 변경에 실패했습니다.' }, 500);
  }

  const { error: tokenError } = await supabase
    .from('password_reset_tokens')
    .update({ reset_at: new Date().toISOString() })
    .eq('id', token.id);

  if (tokenError) {
    console.error('[password-reset] token reset update failed', tokenError.message);
    return json({ success: false, message: '비밀번호 변경 상태 저장에 실패했습니다.' }, 500);
  }

  return json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function adminClient() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function findUserIdByEmail(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase.rpc('find_auth_user_id_by_email', { email_to_find: email });
  if (error) {
    console.error('[password-reset] user lookup failed', error.message);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

async function findRecentToken(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[password-reset] recent token lookup failed', error.message);
    return null;
  }
  return data as Pick<PasswordResetToken, 'created_at'> | null;
}

async function countTokensCreatedToday(supabase: ReturnType<typeof adminClient>, email: string, now: Date) {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('password_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    console.error('[password-reset] daily token count failed', error.message);
    return DAILY_SEND_LIMIT;
  }

  return count ?? 0;
}

async function findLatestResetToken(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('*')
    .eq('email', email)
    .eq('used', false)
    .is('reset_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[password-reset] latest token lookup failed', error.message);
    return null;
  }

  return data as PasswordResetToken | null;
}

async function findLatestVerifiedToken(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('*')
    .eq('email', email)
    .eq('used', true)
    .not('verified_at', 'is', null)
    .is('reset_at', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[password-reset] verified token lookup failed', error.message);
    return null;
  }

  return data as PasswordResetToken | null;
}

async function validateTokenCode(
  supabase: ReturnType<typeof adminClient>,
  token: PasswordResetToken,
  email: string,
  code: string,
  options: { countFailure?: boolean } = {},
) {
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', token.id);
    return { success: false as const, message: '인증코드가 만료되었습니다.', status: 410 };
  }

  const expectedHash = await hashResetCode(email, code);
  if (expectedHash === token.code_hash) {
    return { success: true as const };
  }

  if (options.countFailure !== false) {
    const nextAttemptCount = token.attempt_count + 1;
    await supabase
      .from('password_reset_tokens')
      .update({
        attempt_count: nextAttemptCount,
        used: nextAttemptCount >= MAX_VERIFY_ATTEMPTS,
      })
      .eq('id', token.id);
  }

  return { success: false as const, message: '인증코드가 올바르지 않습니다.', status: 400 };
}

async function sendResetCodeEmail(email: string, code: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'Missing RESEND_API_KEY' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('PASSWORD_RESET_EMAIL_FROM') ?? 'onboarding@resend.dev',
      to: email,
      subject: '비밀번호 재설정 인증코드',
      html: resetCodeEmailHtml(code),
    }),
  });

  if (!response.ok) {
    return { success: false, message: await response.text() };
  }

  return { success: true };
}

function resetCodeEmailHtml(code: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>안녕하세요.</p>
      <p>비밀번호 재설정을 위한 인증코드입니다.</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:24px 0">${code}</p>
      <p>10분 이내에 입력해주세요.</p>
      <p>본인이 요청하지 않았다면 무시하시면 됩니다.</p>
    </div>
  `;
}

async function hashResetCode(email: string, code: string) {
  const pepper = Deno.env.get('PASSWORD_RESET_CODE_PEPPER') ?? requiredEnv('JWT_SECRET');
  const input = new TextEncoder().encode(`${normalizeEmail(email)}:${code}:${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateNumericCode(length: number) {
  let code = '';
  while (code.length < length) {
    code += String(randomInt(10));
  }
  return code;
}

function randomInt(maxExclusive: number) {
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const bytes = new Uint8Array(1);

  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);

  return bytes[0] % maxExclusive;
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, CODE_LENGTH) : '';
}

function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

function isValidCode(code: string) {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
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
