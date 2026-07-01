import {
  completionRepsToBaseline,
  readExerciseBaseline,
  updateExerciseBaseline,
  writeExerciseBaseline,
  type ExerciseCompletion,
} from './exerciseGhostBaseline';

const OPTIONS = {
  storagePrefix: 'stickWithIt:jumping-jack-ghost-baseline:',
  defaultValue: 60,
  valueFromCompletion: (completion: ExerciseCompletion) => completionRepsToBaseline(completion, 60),
};

export function readJumpingJackBaseAverageReps(userId: string) {
  return readExerciseBaseline(userId, OPTIONS);
}

export function writeJumpingJackBaseAverageReps(userId: string, baseAverageReps: number) {
  return writeExerciseBaseline(userId, baseAverageReps, OPTIONS);
}

export function updateJumpingJackGhostBaseline(userId: string, completion: ExerciseCompletion) {
  return updateExerciseBaseline(userId, completion, OPTIONS);
}
