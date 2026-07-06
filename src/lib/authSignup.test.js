import { describe, expect, it, vi } from 'vitest';
import {
  buildSignupMetadata,
  isDuplicateNicknameError,
  isEmailConfirmationRequired,
  isNicknameAvailable,
  normalizeNickname,
  signUpWithImmediateSession,
} from './authSignup';

describe('auth signup helpers', () => {
  it('normalizes signup email and falls back to the email local part for nickname', () => {
    expect(buildSignupMetadata(' runner@example.com ', '')).toEqual({
      email: 'runner@example.com',
      nickname: 'runner',
    });
  });

  it('keeps an explicitly provided nickname after trimming it', () => {
    expect(buildSignupMetadata('runner@example.com', ' 철인 ')).toEqual({
      email: 'runner@example.com',
      nickname: '철인',
    });
  });

  it('normalizes nickname spacing', () => {
    expect(normalizeNickname('  철인  ')).toBe('철인');
  });

  it('checks nickname availability through the Supabase RPC', async () => {
    const supabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    await expect(isNicknameAvailable(supabaseClient, ' 철인 ')).resolves.toBe(true);
    expect(supabaseClient.rpc).toHaveBeenCalledWith('is_nickname_available', {
      requested_nickname: '철인',
    });
  });

  it('rejects blank nicknames before calling the Supabase RPC', async () => {
    const supabaseClient = {
      rpc: vi.fn(),
    };

    await expect(isNicknameAvailable(supabaseClient, '   ')).resolves.toBe(false);
    expect(supabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('returns a duplicate nickname error before signup when the nickname is unavailable', async () => {
    const supabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
      },
    };

    const result = await signUpWithImmediateSession(supabaseClient, {
      email: 'runner@example.com',
      password: 'password',
      nickname: 'runner',
      emailRedirectTo: 'http://localhost',
    });

    expect(result.response.error.message).toBe('이미 사용 중인 닉네임입니다.');
    expect(supabaseClient.auth.signUp).not.toHaveBeenCalled();
  });

  it('does not sign in again when signup already returns a session', async () => {
    const session = { access_token: 'token' };
    const supabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signInWithPassword: vi.fn(),
      },
    };

    const result = await signUpWithImmediateSession(supabaseClient, {
      email: 'runner@example.com',
      password: 'password',
      nickname: '',
      emailRedirectTo: 'http://localhost',
    });

    expect(result).toEqual({
      response: { data: { session }, error: null },
      requiresEmailConfirmation: false,
    });
    expect(supabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in after signup when signup does not return a session', async () => {
    const signInResponse = { data: { session: { access_token: 'token' } }, error: null };
    const supabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' }, session: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue(signInResponse),
      },
    };

    const result = await signUpWithImmediateSession(supabaseClient, {
      email: ' runner@example.com ',
      password: 'password',
      nickname: '',
      emailRedirectTo: 'http://localhost',
    });

    expect(supabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'runner@example.com',
      password: 'password',
      options: {
        data: { nickname: 'runner' },
        emailRedirectTo: 'http://localhost',
      },
    });
    expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'runner@example.com',
      password: 'password',
    });
    expect(result).toEqual({
      response: signInResponse,
      requiresEmailConfirmation: false,
    });
  });

  it('reports when Supabase still requires email confirmation', async () => {
    const signUpResponse = { data: { user: { id: 'user-id' }, session: null }, error: null };
    const supabaseClient = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      auth: {
        signUp: vi.fn().mockResolvedValue(signUpResponse),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'Email not confirmed' },
        }),
      },
    };

    const result = await signUpWithImmediateSession(supabaseClient, {
      email: 'runner@example.com',
      password: 'password',
      nickname: 'runner',
      emailRedirectTo: 'http://localhost',
    });

    expect(result).toEqual({
      response: signUpResponse,
      requiresEmailConfirmation: true,
    });
  });

  it('detects confirmation errors case-insensitively', () => {
    expect(isEmailConfirmationRequired({ message: 'EMAIL NOT CONFIRMED' })).toBe(true);
    expect(isEmailConfirmationRequired({ message: 'Invalid login credentials' })).toBe(false);
  });

  it('detects duplicate nickname database errors', () => {
    expect(isDuplicateNicknameError({ message: 'duplicate key value violates unique constraint "profiles_nickname_unique_idx"' })).toBe(true);
    expect(isDuplicateNicknameError({ message: 'Invalid login credentials' })).toBe(false);
  });
});
