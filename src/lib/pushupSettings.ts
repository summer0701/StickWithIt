import { getExerciseDurationSeconds, setExerciseDurationSeconds } from './exerciseDurationSettings';

export function readPushupDurationSeconds(userId: string) {
  return getExerciseDurationSeconds(userId, 'pushup');
}

export function writePushupDurationSeconds(userId: string, seconds: number) {
  return setExerciseDurationSeconds(userId, 'pushup', seconds);
}
