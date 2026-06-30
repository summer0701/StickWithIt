const STORAGE_PREFIX = 'stickWithit:squat-ghost-baseline:';
export const DEFAULT_SQUAT_BASE_AVERAGE_REPS = 25;
const BASELINE_DURATION_SECONDS = 120;
const UPDATE_BLEND_RATIO = 0.35;

export type SquatCompletion = {
  durationSeconds: number;
  reps: number;
};

export function readSquatBaseAverageReps(userId: string) {
  if (!canUseLocalStorage()) return DEFAULT_SQUAT_BASE_AVERAGE_REPS;

  const value = Number(window.localStorage.getItem(storageKey(userId)));
  return normalizeBaseAverageReps(value);
}

export function writeSquatBaseAverageReps(userId: string, baseAverageReps: number) {
  const normalized = normalizeBaseAverageReps(baseAverageReps);
  if (canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(userId), String(normalized));
  }
  return normalized;
}

export function updateSquatGhostBaseline(userId: string, completion: SquatCompletion) {
  const completedBaseAverageReps = completionToBaseAverageReps(completion);
  if (completedBaseAverageReps == null) return readSquatBaseAverageReps(userId);

  const currentBaseAverageReps = readSquatBaseAverageReps(userId);
  const nextBaseAverageReps =
    currentBaseAverageReps * (1 - UPDATE_BLEND_RATIO) + completedBaseAverageReps * UPDATE_BLEND_RATIO;
  return writeSquatBaseAverageReps(userId, nextBaseAverageReps);
}

export function completionToBaseAverageReps(completion: SquatCompletion) {
  const durationSeconds = Number(completion.durationSeconds);
  const reps = Number(completion.reps);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  if (!Number.isFinite(reps) || reps < 0) return null;
  return normalizeBaseAverageReps((reps / durationSeconds) * BASELINE_DURATION_SECONDS);
}

export function normalizeBaseAverageReps(value: unknown) {
  const reps = Number(value);
  if (!Number.isFinite(reps) || reps <= 0) return DEFAULT_SQUAT_BASE_AVERAGE_REPS;
  return Number(Math.min(300, Math.max(1, reps)).toFixed(3));
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
