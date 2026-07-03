import { describe, expect, it } from 'vitest';
import { buildDailyExerciseProgress, formatExerciseValue } from './homeExerciseProgress';

describe('homeExerciseProgress', () => {
  it('builds daily progress for all five home exercises from completed records', () => {
    const progress = buildDailyExerciseProgress({
      dateKey: '2026-07-01',
      runs: [
        {
          id: 'run-1',
          status: 'completed',
          ended_at: '2026-07-01T03:00:00Z',
          total_distance_meters: 3200,
        },
        {
          id: 'old-run',
          status: 'completed',
          ended_at: '2026-06-30T03:00:00Z',
          total_distance_meters: 9000,
        },
      ],
      exerciseRecords: [
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-01T03:00:00Z', reps: 40 },
        { id: 'jack-1', userId: 'user-1', type: 'jumping-jack', completed: true, completedAt: '2026-07-01T03:00:00Z', reps: 55 },
        { id: 'push-1', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-07-01T03:00:00Z', reps: 20 },
        { id: 'lunge-1', userId: 'user-1', type: 'lunge', completed: true, completedAt: '2026-07-01T03:00:00Z', reps: 24 },
        { id: 'old-squat', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-06-30T03:00:00Z', reps: 100 },
      ],
    });

    expect(progress).toEqual({
      runningKm: 3.2,
      squatReps: 40,
      jumpingJackReps: 55,
      pushupReps: 20,
      lungeReps: 24,
    });
  });

  it('formats exercise values for home cards', () => {
    expect(formatExerciseValue(2.345, 'km')).toBe('2.35km');
    expect(formatExerciseValue(12.4, '회')).toBe('12회');
    expect(formatExerciseValue(132, '초')).toBe('2분 12초');
  });
});
