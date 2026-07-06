import { useCallback, useState } from 'react';
import { consumeSignupVerificationCode, requestSignupVerificationCode } from '../lib/signupVerificationApi';

export function useSignupVerification() {
  const [loading, setLoading] = useState(false);

  const requestCode = useCallback(async (email: string) => {
    return withLoading(setLoading, () => requestSignupVerificationCode(email));
  }, []);

  const consumeCode = useCallback(async (email: string, code: string) => {
    return withLoading(setLoading, () => consumeSignupVerificationCode(email, code));
  }, []);

  return {
    loading,
    requestCode,
    consumeCode,
  };
}

async function withLoading<T>(setLoading: (loading: boolean) => void, action: () => Promise<T>) {
  setLoading(true);
  try {
    return await action();
  } finally {
    setLoading(false);
  }
}
