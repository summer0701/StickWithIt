import { readTimedExerciseDurationSeconds, writeTimedExerciseDurationSeconds } from './timedExerciseSettings';

const STORAGE_PREFIX = 'stickWithIt:jumping-jack-duration-seconds:';

export function readJumpingJackDurationSeconds(userId: string) {
  return readTimedExerciseDurationSeconds(STORAGE_PREFIX, userId);
}

export function writeJumpingJackDurationSeconds(userId: string, seconds: number) {
  return writeTimedExerciseDurationSeconds(STORAGE_PREFIX, userId, seconds);
}
