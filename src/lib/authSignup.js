const EMAIL_NOT_CONFIRMED_PATTERN = /email.*not.*confirmed|confirm/i;
const DUPLICATE_NICKNAME_PATTERN = /profiles_nickname_unique_idx|duplicate key|unique/i;
const DUPLICATE_NICKNAME_MESSAGE = '이미 사용 중인 닉네임입니다.';

export function normalizeNickname(nickname) {
  return nickname.trim();
}

export function buildSignupMetadata(email, nickname) {
  const trimmedEmail = email.trim();
  const trimmedNickname = normalizeNickname(nickname);

  return {
    email: trimmedEmail,
    nickname: trimmedNickname || trimmedEmail.split('@')[0],
  };
}

export function isEmailConfirmationRequired(error) {
  return EMAIL_NOT_CONFIRMED_PATTERN.test(error?.message ?? '');
}

export function isDuplicateNicknameError(error) {
  return DUPLICATE_NICKNAME_PATTERN.test(error?.message ?? '') || DUPLICATE_NICKNAME_PATTERN.test(error?.details ?? '');
}

export async function isNicknameAvailable(supabaseClient, nickname) {
  const normalizedNickname = normalizeNickname(nickname);
  if (!normalizedNickname) return false;

  const { data, error } = await supabaseClient.rpc('is_nickname_available', {
    requested_nickname: normalizedNickname,
  });

  if (error) throw error;
  return data === true;
}

function createSignupErrorResponse(message) {
  return {
    data: { user: null, session: null },
    error: { message },
  };
}

export async function signUpWithImmediateSession(supabaseClient, { email, password, nickname, emailRedirectTo }) {
  const metadata = buildSignupMetadata(email, nickname);
  const nicknameAvailable = await isNicknameAvailable(supabaseClient, metadata.nickname);

  if (!nicknameAvailable) {
    return {
      response: createSignupErrorResponse(DUPLICATE_NICKNAME_MESSAGE),
      requiresEmailConfirmation: false,
    };
  }

  const signUpResponse = await supabaseClient.auth.signUp({
    email: metadata.email,
    password,
    options: {
      data: {
        nickname: metadata.nickname,
      },
      emailRedirectTo,
    },
  });

  if (isDuplicateNicknameError(signUpResponse.error)) {
    return {
      response: createSignupErrorResponse(DUPLICATE_NICKNAME_MESSAGE),
      requiresEmailConfirmation: false,
    };
  }

  if (signUpResponse.error || signUpResponse.data?.session) {
    return {
      response: signUpResponse,
      requiresEmailConfirmation: false,
    };
  }

  const signInResponse = await supabaseClient.auth.signInWithPassword({
    email: metadata.email,
    password,
  });

  if (!signInResponse.error) {
    return {
      response: signInResponse,
      requiresEmailConfirmation: false,
    };
  }

  return {
    response: signUpResponse,
    requiresEmailConfirmation: true,
  };
}
