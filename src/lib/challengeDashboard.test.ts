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
    expect(getDailyChallenge('user-1', '2026-07-04')).toHaveProperty('target');
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
      neighborhoodImpact: {
        currentRank: 8,
        targetRank: 7,
        pointsToTarget: 42,
      },
    });

    expect(dashboard.challenge.label).toBeTruthy();
    expect(dashboard.contribution).toBeGreaterThan(0);
    expect(dashboard.weeklyCompletedDays).toBe(3);
    expect(dashboard.streak).toBe(3);
    expect(dashboard.bestStreak).toBe(3);
    expect(dashboard.neighborhood).toMatchObject({ currentRank: 8, targetRank: 7, pointsToTarget: 42 });
    expect(dashboard.achievements.find((achievement) => achievement.label === '첫 운동')).toMatchObject({ complete: true });
    expect(dashboard.achievements.find((achievement) => achievement.label === '푸시업 100회')).toMatchObject({ complete: true });
  });

  it('uses zero display values when there is no workout data', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'empty-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
    });

    expect(buildChallengeDisplayModel(dashboard)).toMatchObject({
      progress: 0,
      progressPercent: 0,
      contribution: 0,
      weeklyCompletedDays: 0,
      remainingWeekDays: 5,
      streak: 0,
      bestStreak: 0,
    });
  });

  it('uses real workout values instead of reference defaults when data exists', () => {
    const challenge = getDailyChallenge('active-user', '2026-07-04');
    const dashboard = buildChallengeDashboard({
      userId: 'active-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
      exerciseRecords: [
        { id: 'workout-1', userId: 'active-user', type: challenge.type, completed: true, completedAt: '2026-07-04T07:00:00.000Z', reps: 18, durationSeconds: 120 },
      ],
    });

    const expectedProgress = challenge.type === 'running' ? 120 : 18;
    expect(buildChallengeDisplayModel(dashboard)).toMatchObject({
      progress: expectedProgress,
      weeklyCompletedDays: 1,
      remainingWeekDays: 4,
      streak: 1,
      bestStreak: 1,
    });
  });

  it('does not complete achievements when achievements are empty', () => {
    const dashboard = buildChallengeDashboard({
      userId: 'empty-user',
      now: new Date('2026-07-04T09:00:00.000Z'),
    });

    expect(buildChallengeAchievementDisplay(dashboard.achievements)).toEqual([
      expect.objectContaining({ iconText: '0%', statusText: '0%', complete: false }),
      expect.objectContaining({ iconText: '0%', statusText: '0%', complete: false }),
      expect.objectContaining({ iconText: '0%', statusText: '0%', complete: false }),
      expect.objectContaining({ iconText: '0%', statusText: '0%', complete: false }),
    ]);
  });
});
