import {
  completionRepsToBaseline,
  readExerciseBaseline,
  updateExerciseBaseline,
  writeExerciseBaseline,
  type ExerciseCompletion,
} from './exerciseGhostBaseline';

const OPTIONS = {
  storagePrefix: 'stickWithIt:lunge-ghost-baseline:',
  defaultValue: 30,
  maxValue: 300,
  valueFromCompletion: (completion: ExerciseCompletion) => completionRepsToBaseline(completion, 30),
};

export function readLungeBaseReps(userId: string) {
  return readExerciseBaseline(userId, OPTIONS);
}

export function writeLungeBaseReps(userId: string, baseReps: number) {
  return writeExerciseBaseline(userId, baseReps, OPTIONS);
}

export function updateLungeGhostBaseline(userId: string, completion: ExerciseCompletion) {
  return updateExerciseBaseline(userId, completion, OPTIONS);
}
