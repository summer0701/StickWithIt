import { getExerciseDurationSeconds, setExerciseDurationSeconds } from './exerciseDurationSettings';

export function readPlankDurationSeconds(userId: string) {
  return getExerciseDurationSeconds(userId, 'plank');
}

export function writePlankDurationSeconds(userId: string, seconds: number) {
  return setExerciseDurationSeconds(userId, 'plank', seconds);
}
