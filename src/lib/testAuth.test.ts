import { describe, expect, it } from 'vitest';
import { createTestSession, isTestCredentials, TEST_ACCOUNT } from './testAuth';

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
});
