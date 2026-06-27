import { describe, expect, it } from 'vitest';
import { rememberSpokenMessage, ruleBasedCoach } from './ruleBasedCoach';

describe('ruleBasedCoach', () => {
  it('returns an ahead cue when current distance beats recent average at elapsed time', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1100, pace_seconds_per_km: 273 },
      recentRuns: [
        { total_elapsed_seconds: 3000, total_distance_meters: 9000 },
        { total_elapsed_seconds: 3000, total_distance_meters: 9000 },
      ],
      recentCheckpoints: [],
    });

    expect(cue.type).toBe('ahead');
    expect(cue.message).toBe('좋아, 지금 최근 기록 평균보다 앞서고 있어. 이 페이스 유지해!');
  });

  it('returns finish push inside the last kilometer', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 1200, distance_meters: 4200, pace_seconds_per_km: 286 },
      recentRuns: [],
      recentCheckpoints: [],
      targetDistanceMeters: 5000,
    });

    expect(cue.type).toBe('finish_push');
  });

  it('does not repeat a recently spoken message when another scenario line is available', () => {
    const spokenMessages = rememberSpokenMessage([], '좋아, 지금 최근 기록 평균보다 앞서고 있어. 이 페이스 유지해!');
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1100, pace_seconds_per_km: 273 },
      recentRuns: [{ total_elapsed_seconds: 3000, total_distance_meters: 9000 }],
      recentCheckpoints: [],
      spokenMessages,
    });

    expect(cue.type).toBe('ahead');
    expect(cue.message).not.toBe('좋아, 지금 최근 기록 평균보다 앞서고 있어. 이 페이스 유지해!');
  });
});
