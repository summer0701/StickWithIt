import {
  completionGoodSecondsToBaseline,
  readExerciseBaseline,
  updateExerciseBaseline,
  writeExerciseBaseline,
  type ExerciseCompletion,
} from './exerciseGhostBaseline';

const OPTIONS = {
  storagePrefix: 'stickWithIt:plank-ghost-baseline:',
  defaultValue: 90,
  maxValue: 300,
  valueFromCompletion: (completion: ExerciseCompletion) => completionGoodSecondsToBaseline(completion, 90),
};

export function readPlankBaseGoodSeconds(userId: string) {
  return readExerciseBaseline(userId, OPTIONS);
}

export function writePlankBaseGoodSeconds(userId: string, baseGoodSeconds: number) {
  return writeExerciseBaseline(userId, baseGoodSeconds, OPTIONS);
}

export function updatePlankGhostBaseline(userId: string, completion: ExerciseCompletion) {
  return updateExerciseBaseline(userId, completion, OPTIONS);
}
