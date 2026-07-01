import { getExerciseDurationSeconds, setExerciseDurationSeconds } from './exerciseDurationSettings';

export function readJumpingJackDurationSeconds(userId: string) {
  return getExerciseDurationSeconds(userId, 'jumpingJack');
}

export function writeJumpingJackDurationSeconds(userId: string, seconds: number) {
  return setExerciseDurationSeconds(userId, 'jumpingJack', seconds);
}
