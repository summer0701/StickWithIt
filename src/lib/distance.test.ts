import { describe, expect, it } from 'vitest';
import { calculateNextDistance, haversineMeters, shouldAcceptPoint } from './distance';

describe('distance', () => {
  it('calculates haversine distance in meters', () => {
    const distance = haversineMeters(
      { latitude: 37.5665, longitude: 126.978 },
      { latitude: 37.5651, longitude: 126.98955 },
    );

    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1100);
  });

  it('ignores inaccurate, tiny, and unrealistically fast GPS points', () => {
    const previous = { latitude: 37, longitude: 127, accuracy: 10, timestamp: 1000 };

    expect(shouldAcceptPoint(null, { ...previous, accuracy: 60 }).reason).toBe('low_accuracy');
    expect(shouldAcceptPoint(previous, { latitude: 37.00001, longitude: 127, accuracy: 10, timestamp: 2000 }).reason).toBe(
      'too_short',
    );
    expect(shouldAcceptPoint(previous, { latitude: 37.01, longitude: 127, accuracy: 10, timestamp: 2000 }).reason).toBe(
      'too_fast',
    );
  });

  it('adds only accepted movement to total distance', () => {
    const previous = { latitude: 37, longitude: 127, accuracy: 10, timestamp: 1000 };
    const next = { latitude: 37.0001, longitude: 127, accuracy: 10, timestamp: 5000 };

    const result = calculateNextDistance(previous, next, 1);

    expect(result.accepted).toBe(true);
    expect(result.totalDistanceKm).toBeGreaterThan(1);
  });
});
