import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeSignupVerificationCode, requestSignupVerificationCode } from './signupVerificationApi';

describe('signup verification API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a signup verification code', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'sent' }),
    } as Response);

    await expect(requestSignupVerificationCode('runner@example.com')).resolves.toEqual({
      success: true,
      message: 'sent',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/signup-verification/request'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'runner@example.com' }),
      }),
    );
  });

  it('consumes a verified signup code', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'verified' }),
    } as Response);

    await expect(consumeSignupVerificationCode('runner@example.com', '123456')).resolves.toEqual({
      success: true,
      message: 'verified',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/signup-verification/consume'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'runner@example.com', code: '123456' }),
      }),
    );
  });

  it('throws the API message when signup verification fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, message: '인증코드가 올바르지 않습니다.' }),
    } as Response);

    await expect(consumeSignupVerificationCode('runner@example.com', '000000')).rejects.toThrow('인증코드가 올바르지 않습니다.');
  });
});
