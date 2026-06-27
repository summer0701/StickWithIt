import { describe, expect, it } from 'vitest';
import { calculateCalories, formatGhostDelta, formatHudClock, formatHudPace } from './runningHud';

describe('runningHud', () => {
  it('formats elapsed time for the HUD', () => {
    expect(formatHudClock(0)).toBe('0:00');
    expect(formatHudClock(768)).toBe('12:48');
  });

  it('formats pace as min/km and hides empty pace', () => {
    expect(formatHudPace(null)).toBe("--'--\"");
    expect(formatHudPace(0)).toBe("--'--\"");
    expect(formatHudPace(358)).toBe('5\'58"/km');
  });

  it('formats ghost delta with sign and minute seconds', () => {
    expect(formatGhostDelta(-16)).toBe('+0:16');
    expect(formatGhostDelta(75)).toBe('-1:15');
  });

  it('calculates temporary calories from distance', () => {
    expect(calculateCalories(2.14)).toBe(158);
    expect(calculateCalories(-1)).toBe(0);
  });
});
