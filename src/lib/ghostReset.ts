const GHOST_RESET_STORAGE_PREFIX = 'stickWithit:ghost-reset-at:';

export function readGhostResetAt(userId: string): string | null {
  if (!canUseLocalStorage()) return null;
  const value = window.localStorage.getItem(storageKey(userId));
  return isIsoDate(value) ? value : null;
}

export function resetGhostHistory(userId: string, resetAt = new Date()): string {
  const value = resetAt.toISOString();
  if (canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(userId), value);
  }
  return value;
}

export function clearGhostReset(userId: string) {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(storageKey(userId));
}

export function isAfterGhostReset(value: unknown, resetAt: string | null) {
  if (!resetAt) return true;
  const timestamp = timestampFor(value);
  const resetTimestamp = timestampFor(resetAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(resetTimestamp)) return false;
  return timestamp >= resetTimestamp;
}

function storageKey(userId: string) {
  return `${GHOST_RESET_STORAGE_PREFIX}${userId || 'anonymous'}`;
}

function isIsoDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function timestampFor(value: unknown) {
  return typeof value === 'string' || value instanceof Date ? Date.parse(String(value)) : Number.NaN;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
