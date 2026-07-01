const DEFAULT_DURATION_SECONDS = 60;
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 600;

export function readTimedExerciseDurationSeconds(storagePrefix: string, userId: string) {
  if (!canUseLocalStorage()) return DEFAULT_DURATION_SECONDS;

  const value = Number(window.localStorage.getItem(storageKey(storagePrefix, userId)));
  return normalizeTimedExerciseDurationSeconds(value);
}

export function writeTimedExerciseDurationSeconds(storagePrefix: string, userId: string, seconds: number) {
  const normalized = normalizeTimedExerciseDurationSeconds(seconds);
  if (canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(storagePrefix, userId), String(normalized));
  }
  return normalized;
}

export function normalizeTimedExerciseDurationSeconds(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(seconds)));
}

function storageKey(storagePrefix: string, userId: string) {
  return `${storagePrefix}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
