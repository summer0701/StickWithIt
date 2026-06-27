export const TEST_SESSION_STORAGE_KEY = 'stickwithit:test-session';

export const TEST_ACCOUNT = {
  id: '00000000-0000-4000-8000-000000000001',
  login: 'test',
  password: '1234',
  email: 'test@stickwithit.local',
};

export function isTestCredentials(login: string, password: string) {
  return login.trim().toLowerCase() === TEST_ACCOUNT.login && password === TEST_ACCOUNT.password;
}

export function createTestSession() {
  return {
    access_token: 'local-test-session',
    token_type: 'bearer',
    user: {
      id: TEST_ACCOUNT.id,
      email: TEST_ACCOUNT.email,
      role: 'authenticated',
      app_metadata: { provider: 'local-test' },
      user_metadata: { nickname: TEST_ACCOUNT.login },
    },
  };
}

export function readTestSession() {
  if (typeof window === 'undefined') return null;

  const rawSession = window.localStorage.getItem(TEST_SESSION_STORAGE_KEY);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession);
  } catch {
    window.localStorage.removeItem(TEST_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveTestSession(session: ReturnType<typeof createTestSession>) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(TEST_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearTestSession() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(TEST_SESSION_STORAGE_KEY);
}
