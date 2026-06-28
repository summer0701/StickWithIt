import { describe, expect, it } from 'vitest';
import { createTestSession, isTestCredentials, isTestUser, isTestUserId, TEST_ACCOUNT } from './testAuth';

describe('testAuth', () => {
  it('accepts only the local test credentials', () => {
    expect(isTestCredentials('test', '1234')).toBe(true);
    expect(isTestCredentials(' TEST ', '1234')).toBe(true);
    expect(isTestCredentials('test', '12345')).toBe(false);
    expect(isTestCredentials('runner', '1234')).toBe(false);
  });

  it('creates a local session for the test account', () => {
    const session = createTestSession();

    expect(session.user.id).toBe(TEST_ACCOUNT.id);
    expect(session.user.email).toBe(TEST_ACCOUNT.email);
    expect(session.user.app_metadata.provider).toBe('local-test');
  });

  it('identifies the local test user', () => {
    const session = createTestSession();

    expect(isTestUserId(session.user.id)).toBe(true);
    expect(isTestUser(session.user)).toBe(true);
    expect(isTestUser({ ...session.user, app_metadata: { provider: 'email' } })).toBe(false);
    expect(isTestUserId('00000000-0000-4000-8000-000000000002')).toBe(false);
  });
});
