import { getExerciseDurationSeconds, setExerciseDurationSeconds } from './exerciseDurationSettings';

export function readLungeDurationSeconds(userId: string) {
  return getExerciseDurationSeconds(userId, 'lunge');
}

export function writeLungeDurationSeconds(userId: string, seconds: number) {
  return setExerciseDurationSeconds(userId, 'lunge', seconds);
}
