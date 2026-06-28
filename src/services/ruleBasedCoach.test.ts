import { describe, expect, it } from 'vitest';
import { buildGhostRunners, compareGhosts, rememberSpokenMessage, ruleBasedCoach } from './ruleBasedCoach';

describe('ruleBasedCoach', () => {
  const recentRuns = [
    {
      id: 'yesterday',
      started_at: '2026-06-27T00:00:00Z',
      total_elapsed_seconds: 1800,
      total_distance_meters: 5000,
    },
    {
      id: 'best',
      started_at: '2026-06-25T00:00:00Z',
      total_elapsed_seconds: 1500,
      total_distance_meters: 5000,
    },
    {
      id: 'slow',
      started_at: '2026-06-20T00:00:00Z',
      total_elapsed_seconds: 2400,
      total_distance_meters: 5000,
    },
  ];

  const recentCheckpoints = [
    { run_id: 'yesterday', elapsed_seconds: 300, distance_meters: 1030 },
    { run_id: 'best', elapsed_seconds: 300, distance_meters: 1120 },
    { run_id: 'slow', elapsed_seconds: 300, distance_meters: 980 },
  ];

  it('builds named ghost runners from recent runs', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'));

    expect(ghosts.map((ghost) => ghost.key)).toEqual([
      'yesterdayGhost',
      'bestGhost',
      'averageGhost',
      'recentGhost',
      'slowGhost',
    ]);
    expect(ghosts[0].label).toBe('어제의 나');
  });

  it('compares each ghost at the closest checkpoint time', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'));
    const comparisons = compareGhosts({ elapsed_seconds: 300, distance_meters: 1050 }, ghosts);

    expect(comparisons.find((ghost) => ghost.key === 'yesterdayGhost')?.deltaMeters).toBe(20);
    expect(comparisons.find((ghost) => ghost.key === 'bestGhost')?.deltaMeters).toBe(-70);
    expect(comparisons.find((ghost) => ghost.key === 'slowGhost')?.deltaMeters).toBe(70);
  });

  it('speaks about a meaningful ghost instead of a plain average', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1050, pace_seconds_per_km: 286 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.type).toBe('ghost');
    expect(cue.message).toMatch(/어제|최고기록|평균|최근|끝까지/);
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

  it('does not repeat an identical spoken message', () => {
    const spokenMessages = rememberSpokenMessage([], '어제의 나를 방금 잡았다. 오늘의 너가 과거의 너들을 하나씩 넘어서고 있다.');
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1030, pace_seconds_per_km: 291 },
      recentRuns,
      recentCheckpoints,
      spokenMessages,
    });

    expect(cue.message).not.toBe('어제의 나를 방금 잡았다. 오늘의 너가 과거의 너들을 하나씩 넘어서고 있다.');
  });
});
