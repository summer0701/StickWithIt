import { describe, expect, it } from 'vitest';
import { COACH_INTERVAL_SECONDS, shouldPlayCoachCue } from './coachTiming';

describe('coachTiming', () => {
  it('allows coach audio only once every 45 seconds', () => {
    expect(COACH_INTERVAL_SECONDS).toBe(45);
    expect(shouldPlayCoachCue(44, 0)).toBe(false);
    expect(shouldPlayCoachCue(45, 0)).toBe(true);
    expect(shouldPlayCoachCue(89, 45)).toBe(false);
    expect(shouldPlayCoachCue(90, 45)).toBe(true);
  });

  it('allows forced coach audio for explicit save or finish events', () => {
    expect(shouldPlayCoachCue(10, 0, true)).toBe(true);
  });
});
