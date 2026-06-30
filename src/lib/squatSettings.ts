const STORAGE_PREFIX = 'stickWithit:squat-duration-seconds:';
const DEFAULT_DURATION_SECONDS = 60;
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 600;

export function readSquatDurationSeconds(userId: string) {
  if (!canUseLocalStorage()) return DEFAULT_DURATION_SECONDS;

  const value = Number(window.localStorage.getItem(storageKey(userId)));
  return normalizeSquatDurationSeconds(value);
}

export function writeSquatDurationSeconds(userId: string, seconds: number) {
  const normalized = normalizeSquatDurationSeconds(seconds);
  if (canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(userId), String(normalized));
  }
  return normalized;
}

export function normalizeSquatDurationSeconds(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(seconds)));
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
