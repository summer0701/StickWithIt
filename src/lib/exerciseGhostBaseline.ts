export type ExerciseCompletion = {
  durationSeconds: number;
  reps?: number;
  goodSeconds?: number;
};

type BaselineOptions = {
  storagePrefix: string;
  defaultValue: number;
  baselineDurationSeconds?: number;
  maxValue?: number;
  valueFromCompletion: (completion: ExerciseCompletion) => number | null;
};

const DEFAULT_BASELINE_DURATION_SECONDS = 120;
const UPDATE_BLEND_RATIO = 0.35;

export function readExerciseBaseline(userId: string, options: BaselineOptions) {
  if (!canUseLocalStorage()) return options.defaultValue;

  const value = Number(window.localStorage.getItem(storageKey(options.storagePrefix, userId)));
  return normalizeBaseline(value, options);
}

export function writeExerciseBaseline(userId: string, value: number, options: BaselineOptions) {
  const normalized = normalizeBaseline(value, options);
  if (canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(options.storagePrefix, userId), String(normalized));
  }
  return normalized;
}

export function updateExerciseBaseline(userId: string, completion: ExerciseCompletion, options: BaselineOptions) {
  const completedBaseline = options.valueFromCompletion(completion);
  if (completedBaseline == null) return readExerciseBaseline(userId, options);

  const currentBaseline = readExerciseBaseline(userId, options);
  const nextBaseline = currentBaseline * (1 - UPDATE_BLEND_RATIO) + completedBaseline * UPDATE_BLEND_RATIO;
  return writeExerciseBaseline(userId, nextBaseline, options);
}

export function completionRepsToBaseline(completion: ExerciseCompletion, defaultValue: number, maxValue = 300) {
  const durationSeconds = Number(completion.durationSeconds);
  const reps = Number(completion.reps);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  if (!Number.isFinite(reps) || reps < 0) return null;
  return normalizeBaseline((reps / durationSeconds) * DEFAULT_BASELINE_DURATION_SECONDS, { defaultValue, maxValue });
}

export function completionGoodSecondsToBaseline(completion: ExerciseCompletion, defaultValue: number, maxValue = 300) {
  const durationSeconds = Number(completion.durationSeconds);
  const goodSeconds = Number(completion.goodSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  if (!Number.isFinite(goodSeconds) || goodSeconds < 0) return null;
  return normalizeBaseline((goodSeconds / durationSeconds) * DEFAULT_BASELINE_DURATION_SECONDS, { defaultValue, maxValue });
}

function normalizeBaseline(value: unknown, options: Pick<BaselineOptions, 'defaultValue' | 'maxValue'>) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return options.defaultValue;
  return Number(Math.min(options.maxValue ?? 300, Math.max(1, numeric)).toFixed(3));
}

function storageKey(storagePrefix: string, userId: string) {
  return `${storagePrefix}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
