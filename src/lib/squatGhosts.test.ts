import { beforeEach, describe, expect, it } from 'vitest';
import {
  completionToBaseAverageReps,
  readSquatBaseAverageReps,
  updateSquatGhostBaseline,
} from './squatGhosts';

describe('squatGhosts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('converts completion reps to a two-minute baseline', () => {
    expect(completionToBaseAverageReps({ durationSeconds: 60, reps: 15 })).toBe(30);
    expect(completionToBaseAverageReps({ durationSeconds: 180, reps: 45 })).toBe(30);
  });

  it('smoothly updates the stored ghost baseline after normal completion', () => {
    expect(readSquatBaseAverageReps('user-1')).toBe(25);

    const updated = updateSquatGhostBaseline('user-1', { durationSeconds: 60, reps: 20 });

    expect(updated).toBe(30.25);
    expect(readSquatBaseAverageReps('user-1')).toBe(30.25);
  });
});
