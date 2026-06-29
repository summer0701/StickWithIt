import { describe, expect, it } from 'vitest';
import { buildGhostRunners, compareGhosts, rememberSpokenMessage, ruleBasedCoach } from './ruleBasedCoach';

describe('ruleBasedCoach', () => {
  const recentRuns = [
    {
      id: 'yesterday',
      started_at: '2026-06-27T00:00:00Z',
      ended_at: '2026-06-27T00:30:00Z',
      status: 'completed',
      total_elapsed_seconds: 1800,
      total_distance_meters: 5000,
    },
    {
      id: 'best',
      started_at: '2026-06-25T00:00:00Z',
      ended_at: '2026-06-25T00:25:00Z',
      status: 'completed',
      total_elapsed_seconds: 1500,
      total_distance_meters: 5000,
    },
    {
      id: 'slow',
      started_at: '2026-06-20T00:00:00Z',
      ended_at: '2026-06-20T00:40:00Z',
      status: 'completed',
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

  it('returns close cues for the nearest past ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1050, pace_seconds_per_km: 286 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('close');
    expect(cue.ghostLabel).toBe('어제의 나');
    expect(cue.comparisonText).toContain('어제의 나');
  });

  it('returns priority cues when no past ghost is close', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1070, pace_seconds_per_km: 280 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('behind');
    expect(cue.ghostLabel).toBe('최고 기록의 나');
  });

  it('returns personal record cues when ahead of the best ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1160, pace_seconds_per_km: 260 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('personal_record');
    expect(cue.ghostLabel).toBe('최고 기록의 나');
  });

  it('returns overtake cues when the selected ghost delta crosses ahead', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1160, pace_seconds_per_km: 260 },
      recentRuns,
      recentCheckpoints,
      previousGhostDeltas: { bestGhost: -20 },
    });

    expect(cue.category).toBe('overtake');
    expect(cue.nextGhostDeltas.bestGhost).toBe(40);
  });

  it('returns one kilometer cue inside the last kilometer', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 1200, distance_meters: 4200, pace_seconds_per_km: 286 },
      recentRuns: [],
      recentCheckpoints: [],
      targetDistanceMeters: 5000,
    });

    expect(cue.category).toBe('one_km_left');
  });

  it('does not repeat an identical fallback phrase when alternatives exist', () => {
    const spokenMessages = rememberSpokenMessage([], '3초 차이다. 거의 붙었다.');
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1030, pace_seconds_per_km: 291 },
      recentRuns,
      recentCheckpoints,
      spokenMessages,
    });

    expect(cue.fallbackText).not.toBe('3초 차이다. 거의 붙었다.');
  });

  it('uses only completed runs as ghost candidates', () => {
    const ghosts = buildGhostRunners([
      ...recentRuns,
      {
        id: 'running',
        started_at: '2026-06-28T00:00:00Z',
        status: 'running',
        total_elapsed_seconds: 100,
        total_distance_meters: 1000,
      },
    ], recentCheckpoints, new Date('2026-06-28T00:00:00Z'));

    expect(ghosts.some((ghost) => ghost.sourceRunId === 'running')).toBe(false);
  });
});
