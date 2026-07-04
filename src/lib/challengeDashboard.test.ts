import { describe, expect, it } from 'vitest';
import {
  buildChallengeAchievementDisplay,
  buildChallengeDashboard,
  buildChallengeDisplayModel,
  getDailyChallenge,
} from './challengeDashboard';

describe('challengeDashboard', () => {
  it('selects the same daily challenge for the same user and date', () => {
    expect(getDailyChallenge('user-1', '2026-07-04')).toEqual(getDailyChallenge('user-1', '2026-07-04'));
    expect(getDailyChallenge('user-1', '2026-07-04')).toMatchObject({
      type: 'push-up',
      target: 20,
    });
  });

  it('builds progress, weekly days, streaks, neighborhood impact, and achievements', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'user-1',
      now: new Date('2026-07-04T09:00:00.000Z'),
      runs: [
        {
          id: 'run-1',
          user_id: 'user-1',
          status: 'completed',
          ended_at: '2026-07-04T08:00:00.000Z',
          actual_distance_km: 5.2,
          total_elapsed_seconds: 320,
        },
      ],
      exerciseRecords: [
        { id: 'push-1', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-07-04T07:00:00.000Z', reps: 74, durationSeconds: 374 },
        { id: 'push-2', userId: 'user-1', type: 'push-up', completed: true, completedAt: '2026-07-03T07:00:00.000Z', reps: 30, durationSeconds: 160 },
        { id: 'squat-1', userId: 'user-1', type: 'squat', completed: true, completedAt: '2026-07-02T07:00:00.000Z', reps: 40, durationSeconds: 180 },
      ],
    });

    expect(dashboard.challenge.label).toBeTruthy();
    expect(dashboard.contribution).toBeGreaterThan(0);
    expect(dashboard.weeklyCompletedDays).toBe(3);
    expect(dashboard.streak).toBe(3);
    expect(dashboard.bestStreak).toBe(3);
    expect(dashboard.neighborhood.targetRank).toBeLessThanOrEqual(dashboard.neighborhood.currentRank);
    expect(dashboard.achievements.find((achievement) => achievement.label === '첫 운동')).toMatchObject({ complete: true });
    expect(dashboard.achievements.find((achievement) => achievement.label === '푸시업 100회')).toMatchObject({ complete: true });
  });

  it('uses reference-image display defaults when there is no workout data', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'empty-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
    });

    expect(buildChallengeDisplayModel(dashboard)).toMatchObject({
      progress: 12,
      progressPercent: 60,
      contribution: 35,
      weeklyCompletedDays: 3,
      remainingWeekDays: 2,
      streak: 7,
      bestStreak: 15,
    });
  });

  it('uses real workout values instead of reference defaults when data exists', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'active-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
      exerciseRecords: [
        { id: 'push-1', userId: 'active-user', type: 'push-up', completed: true, completedAt: '2026-07-04T07:00:00.000Z', reps: 18, durationSeconds: 120 },
      ],
    });

    expect(buildChallengeDisplayModel(dashboard)).toMatchObject({
      progress: 18,
      progressPercent: 90,
      weeklyCompletedDays: 1,
      remainingWeekDays: 4,
      streak: 1,
      bestStreak: 1,
    });
  });

  it('uses reference-image achievement display defaults when achievements are empty', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'empty-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
    });

    expect(buildChallengeAchievementDisplay(dashboard.achievements)).toEqual([
      expect.objectContaining({ iconText: '첫', statusText: '완료', complete: true }),
      expect.objectContaining({ iconText: '7', statusText: '완료', complete: true }),
      expect.objectContaining({ iconText: '74%', statusText: '74%', complete: false }),
      expect.objectContaining({ iconText: '40%', statusText: '40%', complete: false }),
    ]);
  });
});
