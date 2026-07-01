export type ExerciseDurationType = 'squat' | 'jumpingJack' | 'pushup' | 'plank';

const STORAGE_PREFIX = 'stickWithIt';
const LEGACY_SQUAT_STORAGE_PREFIX = 'stickWithit:squat-duration-seconds:';
const DEFAULT_DURATION_SECONDS: Record<ExerciseDurationType, number> = {
  squat: 60,
  jumpingJack: 60,
  pushup: 60,
  plank: 60,
};
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 600;

export function getExerciseDurationSeconds(userId: string | undefined, exerciseType: ExerciseDurationType) {
  if (!canUseLocalStorage()) return DEFAULT_DURATION_SECONDS[exerciseType];

  try {
    const value = window.localStorage.getItem(storageKey(userId, exerciseType));
    if (value != null) return normalizeExerciseDurationSeconds(value, exerciseType);

    const legacyValue = readLegacyDuration(userId, exerciseType);
    if (legacyValue != null) {
      const normalized = normalizeExerciseDurationSeconds(legacyValue, exerciseType);
      try {
        window.localStorage.setItem(storageKey(userId, exerciseType), String(normalized));
      } catch {
        return normalized;
      }
      return normalized;
    }

    return DEFAULT_DURATION_SECONDS[exerciseType];
  } catch {
    return DEFAULT_DURATION_SECONDS[exerciseType];
  }
}

export function setExerciseDurationSeconds(
  userId: string | undefined,
  exerciseType: ExerciseDurationType,
  seconds: number,
) {
  const normalized = normalizeExerciseDurationSeconds(seconds, exerciseType);
  if (!canUseLocalStorage()) return normalized;

  try {
    window.localStorage.setItem(storageKey(userId, exerciseType), String(normalized));
    if (exerciseType === 'squat') {
      window.localStorage.setItem(legacySquatStorageKey(userId), String(normalized));
    }
  } catch {
    return normalized;
  }

  return normalized;
}

export function formatExerciseDuration(seconds: number) {
  const totalSeconds = normalizeExerciseDurationSeconds(seconds, 'squat');
  const minutes = Math.floor(totalSeconds / 60);
  const rest = totalSeconds % 60;
  if (minutes <= 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분 ${rest}초`;
}

export function normalizeExerciseDurationSeconds(value: unknown, exerciseType: ExerciseDurationType = 'squat') {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_DURATION_SECONDS[exerciseType];
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(seconds)));
}

function readLegacyDuration(userId: string | undefined, exerciseType: ExerciseDurationType) {
  if (exerciseType !== 'squat') return null;
  return window.localStorage.getItem(legacySquatStorageKey(userId));
}

function storageKey(userId: string | undefined, exerciseType: ExerciseDurationType) {
  return `${STORAGE_PREFIX}:${exerciseType}-duration-seconds:${userId || 'anonymous'}`;
}

function legacySquatStorageKey(userId: string | undefined) {
  return `${LEGACY_SQUAT_STORAGE_PREFIX}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
