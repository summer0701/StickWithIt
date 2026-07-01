import { readTimedExerciseDurationSeconds, writeTimedExerciseDurationSeconds } from './timedExerciseSettings';

const STORAGE_PREFIX = 'stickWithIt:pushup-duration-seconds:';

export function readPushupDurationSeconds(userId: string) {
  return readTimedExerciseDurationSeconds(STORAGE_PREFIX, userId);
}

export function writePushupDurationSeconds(userId: string, seconds: number) {
  return writeTimedExerciseDurationSeconds(STORAGE_PREFIX, userId, seconds);
}
