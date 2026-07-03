import { beforeEach, describe, expect, it } from 'vitest';
import { getHomeWorkoutSummary } from './homeWorkoutSummary';

describe('homeWorkoutSummary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('analyzes running, squat, push-up, lunge, and walking records into summary metrics', () => {
    const summary = getHomeWorkoutSummary({
      userId: 'user-1',
      now: new Date('2026-07-01T00:00:00Z'),
      runs: [
        {
          id: 'run-1',
          user_id: 'user-1',
          status: 'completed',
          ended_at: '2026-06-30T00:00:00Z',
          actual_distance_km: 3,
          total_elapsed_seconds: 1500,
        },
      ],
      exerciseRecords: [
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-06-30T00:00:00Z', durationSeconds: 60, reps: 30 },
        { id: 'push-1', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-06-30T00:00:00Z', durationSeconds: 60, reps: 20 },
        { id: 'lunge-1', userId: 'user-1', type: 'lunge', completed: true, completedAt: '2026-06-30T00:00:00Z', durationSeconds: 90, reps: 34 },
        { id: 'walk-1', userId: 'user-1', type: 'walking', completed: true, completedAt: '2026-06-30T00:00:00Z', durationSeconds: 1200, distanceKm: 2 },
      ],
    });

    expect(summary.metrics[0]).toEqual({ tone: 'blue', label: '최근 14일 거리', value: '5.00 km' });
    expect(summary.metrics[2]).toEqual({ tone: 'orange', label: '반복 횟수', value: '84 회' });
    expect(summary.recordCount).toBe(5);
    expect(summary.insight).toContain('84회');
  });

  it('keeps the cached summary for three days until activity changes', () => {
    const first = getHomeWorkoutSummary({
      userId: 'user-1',
      now: new Date('2026-07-01T00:00:00Z'),
      exerciseRecords: [
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-01T00:00:00Z', durationSeconds: 60, reps: 10 },
      ],
    });
    const cached = getHomeWorkoutSummary({
      userId: 'user-1',
      now: new Date('2026-07-02T00:00:00Z'),
      exerciseRecords: [
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-01T00:00:00Z', durationSeconds: 60, reps: 10 },
      ],
    });
    const changed = getHomeWorkoutSummary({
      userId: 'user-1',
      now: new Date('2026-07-02T00:00:00Z'),
      exerciseRecords: [
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-01T00:00:00Z', durationSeconds: 60, reps: 10 },
        { id: 'push-1', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-07-02T00:00:00Z', durationSeconds: 60, reps: 15 },
      ],
    });

    expect(cached.refreshedAt).toBe(first.refreshedAt);
    expect(changed.refreshedAt).toBe('2026-07-02T00:00:00.000Z');
    expect(changed.recordCount).toBe(2);
  });
});
