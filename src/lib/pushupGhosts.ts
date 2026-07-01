import {
  completionRepsToBaseline,
  readExerciseBaseline,
  updateExerciseBaseline,
  writeExerciseBaseline,
  type ExerciseCompletion,
} from './exerciseGhostBaseline';

const OPTIONS = {
  storagePrefix: 'stickWithIt:pushup-ghost-baseline:',
  defaultValue: 25,
  valueFromCompletion: (completion: ExerciseCompletion) => completionRepsToBaseline(completion, 25),
};

export function readPushupBaseAverageReps(userId: string) {
  return readExerciseBaseline(userId, OPTIONS);
}

export function writePushupBaseAverageReps(userId: string, baseAverageReps: number) {
  return writeExerciseBaseline(userId, baseAverageReps, OPTIONS);
}

export function updatePushupGhostBaseline(userId: string, completion: ExerciseCompletion) {
  return updateExerciseBaseline(userId, completion, OPTIONS);
}
