import { describe, expect, it } from 'vitest';
import { completionGoodSecondsToBaseline, completionRepsToBaseline } from './exerciseGhostBaseline';

describe('exerciseGhostBaseline', () => {
  it('converts repetition completions to a two minute baseline', () => {
    expect(completionRepsToBaseline({ durationSeconds: 60, reps: 30 }, 60)).toBe(60);
    expect(completionRepsToBaseline({ durationSeconds: 180, reps: 75 }, 25)).toBe(50);
  });

  it('converts lunge good seconds to a two minute baseline', () => {
    expect(completionGoodSecondsToBaseline({ durationSeconds: 60, goodSeconds: 45 }, 90)).toBe(90);
    expect(completionGoodSecondsToBaseline({ durationSeconds: 180, goodSeconds: 90 }, 90)).toBe(60);
  });
});
