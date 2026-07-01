import {
  getExerciseDurationSeconds,
  normalizeExerciseDurationSeconds,
  setExerciseDurationSeconds,
} from './exerciseDurationSettings';

export function readSquatDurationSeconds(userId: string) {
  return getExerciseDurationSeconds(userId, 'squat');
}

export function writeSquatDurationSeconds(userId: string, seconds: number) {
  return setExerciseDurationSeconds(userId, 'squat', seconds);
}

export function normalizeSquatDurationSeconds(value: unknown) {
  return normalizeExerciseDurationSeconds(value, 'squat');
}
