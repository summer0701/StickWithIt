import { describe, expect, it } from 'vitest';
import {
  buildHistoryDashboard,
  filterHistoryWorkouts,
  formatHistoryDuration,
} from './historyDashboard';

describe('historyDashboard', () => {
  const now = new Date('2026-07-04T09:00:00.000Z');

  it('builds today, streak, exercise stats, charts, records, and timeline summaries', () => {
    const dashboard = buildHistoryDashboard({
      now,
      runs: [
        {
          id: 'run-1',
          user_id: 'user-1',
          status: 'completed',
          ended_at: '2026-07-04T08:00:00.000Z',
          actual_distance_km: 5.2,
          total_elapsed_seconds: 1860,
        },
      ],
      exerciseRecords: [
        {
          id: 'push-1',
          userId: 'user-1',
          type: 'push-up',
          completed: true,
          completedAt: '2026-07-04T07:00:00.000Z',
          reps: 74,
          durationSeconds: 374,
        },
        {
          id: 'squat-1',
          userId: 'user-1',
          type: 'squat',
          completed: true,
          completedAt: '2026-07-03T07:00:00.000Z',
          reps: 210,
          durationSeconds: 600,
        },
        {
          id: 'jack-1',
          userId: 'user-1',
          type: 'jumping-jack',
          completed: true,
          completedAt: '2026-07-02T07:00:00.000Z',
          reps: 153,
          durationSeconds: 420,
        },
      ],
    });

    expect(dashboard.today).toMatchObject({ completed: true, count: 2 });
    expect(dashboard.totals.workoutCount).toBe(4);
    expect(dashboard.totals.streakDays).toBe(3);
    expect(dashboard.exerciseStats.find((item) => item.type === 'push-up')).toMatchObject({
      count: 1,
      bestLabel: '74회',
    });
    expect(dashboard.weeklyBars).toHaveLength(7);
    expect(dashboard.monthlyTrend).toHaveLength(12);
    expect(dashboard.heatmap.find((day) => day.dateKey === '2026-07-04')?.count).toBe(2);
    expect(dashboard.personalRecords.find((item) => item.type === 'running')?.valueLabel).toBe('5.2km');
    expect(dashboard.timeline[0]).toMatchObject({ dateKey: '2026-07-04' });
  });

  it('filters and sorts workouts for timeline controls', () => {
    const dashboard = buildHistoryDashboard({
      now,
      exerciseRecords: [
        { id: 'a', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-07-01T00:00:00.000Z', reps: 20, durationSeconds: 60 },
        { id: 'b', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-02T00:00:00.000Z', reps: 80, durationSeconds: 120 },
      ],
    });

    expect(filterHistoryWorkouts(dashboard.workouts, { type: 'push-up' })).toHaveLength(1);
    expect(filterHistoryWorkouts(dashboard.workouts, { query: 'squat' })[0]?.type).toBe('squat');
    expect(filterHistoryWorkouts(dashboard.workouts, { sort: 'volume' })[0]?.type).toBe('squat');
  });

  it('counts camel case local run duration in history totals', () => {
    const dashboard = buildHistoryDashboard({
      now,
      runs: [
        {
          id: 'run-1',
          user_id: 'user-1',
          status: 'completed',
          ended_at: '2026-07-04T08:00:00.000Z',
          totalDistanceMeters: 1200,
          totalElapsedSeconds: 600,
        },
      ],
    });

    expect(dashboard.totals.durationSeconds).toBe(600);
    expect(dashboard.today.minutes).toBe(10);
  });

  it('formats total history duration', () => {
    expect(formatHistoryDuration(3660)).toBe('1시간 1분');
    expect(formatHistoryDuration(600)).toBe('10분');
  });
});
