import { describe, expect, it } from 'vitest';
import {
  achievementRate,
  bestCompletedRunDistanceKmOnDate,
  buildRunningProgress,
  dateKeyForDaysAgo,
  sumCompletedRunDistanceKmOnDate,
} from './runningProgress';

describe('runningProgress', () => {
  it('uses yesterday best distance as the achievement target and marks a new record', () => {
    const progress = buildRunningProgress({
      targetDistanceKm: 10,
      todayRunningKm: 5.2,
      yesterdayBestRunningKm: 5,
    });

    expect(progress.targetValue).toBe(5);
    expect(progress.goalLabel).toBe('5.00km');
    expect(progress.recordLabel).toBe('5.20km');
    expect(progress.statusLabel).toBe('어제 대비 신기록');
    expect(achievementRate(progress.currentValue, progress.targetValue)).toBe(104);
  });

  it('falls back to the selected target when yesterday has no completed run', () => {
    const progress = buildRunningProgress({
      targetDistanceKm: 3,
      todayRunningKm: 1.5,
      yesterdayBestRunningKm: 0,
    });

    expect(progress.targetValue).toBe(3);
    expect(progress.goalLabel).toBe('3.0km');
    expect(progress.statusLabel).toBeUndefined();
  });

  it('finds yesterday best distance and sums today completed distances', () => {
    const runs = [
      { id: 'yesterday-short', status: 'completed', actual_distance_km: 3, ended_at: '2026-06-27T01:00:00.000Z' },
      { id: 'yesterday-best', status: 'completed', total_distance_meters: 5200, ended_at: '2026-06-27T02:00:00.000Z' },
      { id: 'yesterday-open', actual_distance_km: 10, started_at: '2026-06-27T03:00:00.000Z' },
      { id: 'today-a', status: 'completed', actual_distance_km: 2, ended_at: '2026-06-28T01:00:00.000Z' },
      { id: 'today-b', status: 'completed', total_distance_meters: 1500, ended_at: '2026-06-28T02:00:00.000Z' },
    ];

    expect(bestCompletedRunDistanceKmOnDate(runs, '2026-06-27')).toBe(5.2);
    expect(sumCompletedRunDistanceKmOnDate(runs, '2026-06-28')).toBe(3.5);
    expect(dateKeyForDaysAgo(1, new Date('2026-06-28T12:00:00.000Z'))).toBe('2026-06-27');
  });
});
