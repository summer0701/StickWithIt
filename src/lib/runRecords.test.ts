import { describe, expect, it } from 'vitest';
import { completedRunToExerciseRecord, completedRunsToExerciseRecords, getRunDistanceKm, getRunDurationSeconds } from './runRecords';

describe('runRecords', () => {
  it('converts a completed run to an exercise record for ranking contribution', () => {
    const record = completedRunToExerciseRecord('user-1', {
      id: 'run-1',
      status: 'completed',
      ended_at: '2026-07-05T10:00:00.000Z',
      total_distance_meters: 1200,
      total_elapsed_seconds: 420,
    });

    expect(record).toMatchObject({
      id: 'run-1',
      userId: 'user-1',
      type: 'running',
      completed: true,
      completedAt: '2026-07-05T10:00:00.000Z',
      distanceKm: 1.2,
      durationSeconds: 420,
    });
  });

  it('ignores unfinished runs and reads modern or camel case distance fields', () => {
    expect(completedRunsToExerciseRecords('user-1', [{ id: 'run-1', status: 'running', started_at: '2026-07-05T10:00:00.000Z' }])).toEqual([]);
    expect(getRunDistanceKm({ totalDistanceMeters: 900 })).toBe(0.9);
    expect(getRunDurationSeconds({ totalElapsedSeconds: 300 })).toBe(300);
  });
});
