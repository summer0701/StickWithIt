import {
  GHOST_SETTING_SLOTS,
  normalizeGhostDifficulty,
  type GhostDifficultySetting,
  type GhostSlotKey,
} from './ghostSettings';

export type ExerciseGhostType = 'squat' | 'lunge' | 'pushup' | 'lunge';

export type ExerciseGhostSetting = {
  key: GhostSlotKey;
  defaultName: string;
  description: string;
  name: string;
  averageValue: number | null;
};

const SETTINGS_STORAGE_PREFIX = 'stickWithIt:exercise-ghost-settings:';
const DIFFICULTY_STORAGE_PREFIX = 'stickWithIt:exercise-ghost-difficulty:';
const MIN_AVERAGE_VALUE = 0.1;
const MAX_AVERAGE_VALUE = 999;

export function defaultExerciseGhostSettings(): ExerciseGhostSetting[] {
  return GHOST_SETTING_SLOTS.map((slot) => ({
    ...slot,
    name: '',
    averageValue: null,
  }));
}

export function normalizeExerciseGhostSettings(value: unknown): ExerciseGhostSetting[] {
  const source = Array.isArray(value) ? value : [];
  return defaultExerciseGhostSettings().map((slot, index) => {
    const item = source.find((candidate) => candidate?.key === slot.key) ?? source[index] ?? {};
    return {
      ...slot,
      name: normalizeGhostName((item as Partial<ExerciseGhostSetting>).name),
      averageValue: normalizeAverageValue((item as Partial<ExerciseGhostSetting>).averageValue),
    };
  });
}

export function readExerciseGhostSettings(userId: string, exerciseType: ExerciseGhostType) {
  if (!canUseLocalStorage()) return defaultExerciseGhostSettings();

  try {
    return normalizeExerciseGhostSettings(JSON.parse(window.localStorage.getItem(settingsStorageKey(userId, exerciseType)) ?? '[]'));
  } catch {
    return defaultExerciseGhostSettings();
  }
}

export function writeExerciseGhostSettings(
  userId: string,
  exerciseType: ExerciseGhostType,
  settings: ExerciseGhostSetting[],
) {
  const normalized = normalizeExerciseGhostSettings(settings);
  if (!canUseLocalStorage()) return normalized;

  window.localStorage.setItem(settingsStorageKey(userId, exerciseType), JSON.stringify(normalized));
  return normalized;
}

export function readExerciseGhostDifficulty(userId: string, exerciseType: ExerciseGhostType): GhostDifficultySetting {
  if (!canUseLocalStorage()) return normalizeGhostDifficulty({});

  try {
    return normalizeGhostDifficulty(JSON.parse(window.localStorage.getItem(difficultyStorageKey(userId, exerciseType)) ?? '{}'));
  } catch {
    return normalizeGhostDifficulty({});
  }
}

export function writeExerciseGhostDifficulty(
  userId: string,
  exerciseType: ExerciseGhostType,
  setting: GhostDifficultySetting,
) {
  const normalized = normalizeGhostDifficulty(setting);
  if (!canUseLocalStorage()) return normalized;

  window.localStorage.setItem(difficultyStorageKey(userId, exerciseType), JSON.stringify(normalized));
  return normalized;
}

export function exerciseGhostDisplayName(key: string, settings: ExerciseGhostSetting[] = defaultExerciseGhostSettings()) {
  const slot = normalizeExerciseGhostSettings(settings).find((item) => item.key === key);
  if (!slot) return String(key);
  return slot.name || slot.defaultName;
}

function normalizeGhostName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 16) : '';
}

function normalizeAverageValue(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(MAX_AVERAGE_VALUE, Math.max(MIN_AVERAGE_VALUE, Number(number.toFixed(1))));
}

function settingsStorageKey(userId: string, exerciseType: ExerciseGhostType) {
  return `${SETTINGS_STORAGE_PREFIX}${exerciseType}:${userId || 'anonymous'}`;
}

function difficultyStorageKey(userId: string, exerciseType: ExerciseGhostType) {
  return `${DIFFICULTY_STORAGE_PREFIX}${exerciseType}:${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
