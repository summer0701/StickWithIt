import { describe, expect, it } from 'vitest';
import { buildGhostRaceSnapshot, buildGhostRunners, compareGhosts, rememberSpokenMessage, ruleBasedCoach } from './ruleBasedCoach';

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
      'bestGhost',
      'averageGhost',
      'stableGhost',
      'chaserGhost',
      'slowGhost',
    ]);
    expect(ghosts[0].label).toBe('G1');
  });

  it('compares each ghost with interpolated checkpoint timing', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'));
    const comparisons = compareGhosts({ elapsed_seconds: 300, distance_meters: 1050 }, ghosts);

    expect(comparisons.find((ghost) => ghost.key === 'bestGhost')?.deltaMeters).toBeLessThan(0);
    expect(comparisons.find((ghost) => ghost.key === 'slowGhost')?.deltaMeters).toBeDefined();
    expect(comparisons.every((ghost) => Number.isFinite(ghost.deltaMeters))).toBe(true);
  });

  it('builds a ranked ghost race snapshot for visual comparison', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'));
    const snapshot = buildGhostRaceSnapshot({
      currentDistanceMeters: 1050,
      elapsedSeconds: 300,
      targetDistanceMeters: 5000,
      ghosts,
    });

    expect(snapshot.entries[0].key).toBe('bestGhost');
    expect(snapshot.entries[0].label).toBe('G1');
    expect(snapshot.current.rank).toBeGreaterThan(1);
    expect(snapshot.ghosts.find((ghost) => ghost.key === 'slowGhost')).toBeDefined();
    expect(snapshot.current.progressPercent).toBe(21);
  });

  it('returns close cues for the nearest past ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1050, pace_seconds_per_km: 286 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('close');
    expect(cue.ghostLabel).toBe('G5');
    expect(cue.comparisonText).toContain('G5');
  });

  it('returns priority cues when no past ghost is close', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 700, pace_seconds_per_km: 280 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('behind');
    expect(cue.ghostLabel).toBe('G1');
  });

  it('returns personal record cues when ahead of the best ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1160, pace_seconds_per_km: 260 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('personal_record');
    expect(cue.ghostLabel).toBe('G1');
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

  it('does not create ghosts when no run data exists', () => {
    const ghosts = buildGhostRunners([], [], new Date('2026-06-28T00:00:00Z'));

    expect(ghosts).toEqual([]);
  });

  it('generates five natural ghosts from a single completed run', () => {
    const ghosts = buildGhostRunners([recentRuns[0]], recentCheckpoints, new Date('2026-06-28T00:00:00Z'));

    expect(ghosts.map((ghost) => ghost.key)).toEqual([
      'bestGhost',
      'averageGhost',
      'stableGhost',
      'chaserGhost',
      'slowGhost',
    ]);
    expect(ghosts).toHaveLength(5);
    expect(ghosts[0].totalDistanceMeters).toBeGreaterThan(ghosts[1].totalDistanceMeters);
    expect(ghosts[4].totalDistanceMeters).toBeLessThan(ghosts[1].totalDistanceMeters);
  });

  it('interpolates generated ghost distance per second before the first minute', () => {
    const ghosts = buildGhostRunners([recentRuns[0]], recentCheckpoints, new Date('2026-06-28T00:00:00Z'));
    const afterOneSecond = buildGhostRaceSnapshot({
      currentDistanceMeters: 0,
      elapsedSeconds: 1,
      targetDistanceMeters: 5000,
      ghosts,
    }).ghosts.find((ghost) => ghost.key === 'bestGhost');
    const afterOneMinute = buildGhostRaceSnapshot({
      currentDistanceMeters: 0,
      elapsedSeconds: 60,
      targetDistanceMeters: 5000,
      ghosts,
    }).ghosts.find((ghost) => ghost.key === 'bestGhost');

    expect(afterOneSecond?.distanceMeters).toBeGreaterThan(0);
    expect(afterOneSecond?.distanceMeters).toBeLessThan(20);
    expect(afterOneMinute?.distanceMeters).toBeGreaterThan(afterOneSecond?.distanceMeters ?? 0);
  });
});
