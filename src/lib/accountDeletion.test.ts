import { describe, expect, it, vi } from 'vitest';
import { AccountDeletionError, requestAccountDeletion } from './accountDeletion';

describe('account deletion API', () => {
  it('sends the current access token to the account deletion function', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: '회원탈퇴가 완료되었습니다.' }),
    } as Response);

    await expect(requestAccountDeletion('access-token', fetchMock)).resolves.toEqual({
      success: true,
      message: '회원탈퇴가 완료되었습니다.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/account-delete'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('requires a valid access token', async () => {
    await expect(requestAccountDeletion('')).rejects.toMatchObject({
      name: 'AccountDeletionError',
      status: 401,
      message: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
    });
  });

  it('throws the server message when account deletion fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: '회원탈퇴 처리에 실패했습니다.' }),
    } as Response);

    await expect(requestAccountDeletion('access-token', fetchMock)).rejects.toBeInstanceOf(AccountDeletionError);
    await expect(requestAccountDeletion('access-token', fetchMock)).rejects.toThrow('회원탈퇴 처리에 실패했습니다.');
  });
});
