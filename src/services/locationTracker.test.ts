import { describe, expect, it } from 'vitest';
import { buildCheckpoint } from './locationTracker';

describe('locationTracker', () => {
  it('builds checkpoint pace and speed from elapsed time and distance', () => {
    const checkpoint = buildCheckpoint({
      runId: 'run-id',
      userId: 'user-id',
      elapsedSeconds: 600,
      distanceMeters: 2000,
      point: { latitude: 37.5, longitude: 127 },
    });

    expect(checkpoint.pace_seconds_per_km).toBe(300);
    expect(checkpoint.speed_kmh).toBe(12);
    expect(checkpoint.latitude).toBe(37.5);
  });
});
