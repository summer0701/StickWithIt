import { readTimedExerciseDurationSeconds, writeTimedExerciseDurationSeconds } from './timedExerciseSettings';

const STORAGE_PREFIX = 'stickWithIt:plank-duration-seconds:';

export function readPlankDurationSeconds(userId: string) {
  return readTimedExerciseDurationSeconds(STORAGE_PREFIX, userId);
}

export function writePlankDurationSeconds(userId: string, seconds: number) {
  return writeTimedExerciseDurationSeconds(STORAGE_PREFIX, userId, seconds);
}
