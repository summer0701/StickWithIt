export type PasswordResetRequestResponse = {
  success: boolean;
  message: string;
  expiresInSeconds?: number;
};

export type PasswordResetVerifyResponse = {
  success: boolean;
  message: string;
};

export type PasswordResetResponse = {
  success: boolean;
  message: string;
};

export type PasswordResetStep = 'request' | 'verify' | 'reset';
