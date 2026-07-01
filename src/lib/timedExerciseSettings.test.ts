import { describe, expect, it } from 'vitest';
import { normalizeTimedExerciseDurationSeconds } from './timedExerciseSettings';

describe('timedExerciseSettings', () => {
  it('normalizes exercise duration to the supported 30-600 second range', () => {
    expect(normalizeTimedExerciseDurationSeconds(null)).toBe(60);
    expect(normalizeTimedExerciseDurationSeconds(12)).toBe(30);
    expect(normalizeTimedExerciseDurationSeconds(75.4)).toBe(75);
    expect(normalizeTimedExerciseDurationSeconds(900)).toBe(600);
  });
});
