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
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'), undefined, 5);

    expect(ghosts.map((ghost) => ghost.key)).toEqual([
      'bestGhost',
      'averageGhost',
      'stableGhost',
      'chaserGhost',
      'slowGhost',
    ]);
    expect(ghosts[0].label).toBe('G1');
    expect(ghosts.map((ghost) => ghost.source)).toEqual([
      'initial_default',
      'initial_default',
      'average_user_run',
      'latest_user_run',
      'personal_best',
    ]);
  });

  it('compares each ghost with interpolated checkpoint timing', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'), undefined, 5);
    const comparisons = compareGhosts({ elapsed_seconds: 300, distance_meters: 1050 }, ghosts);

    expect(comparisons.find((ghost) => ghost.key === 'bestGhost')?.deltaMeters).toBeGreaterThan(0);
    expect(comparisons.find((ghost) => ghost.key === 'slowGhost')?.deltaMeters).toBeLessThan(0);
    expect(comparisons.every((ghost) => Number.isFinite(ghost.deltaMeters))).toBe(true);
  });

  it('builds a ranked ghost race snapshot for visual comparison', () => {
    const ghosts = buildGhostRunners(recentRuns, recentCheckpoints, new Date('2026-06-28T00:00:00Z'), undefined, 5);
    const snapshot = buildGhostRaceSnapshot({
      currentDistanceMeters: 1050,
      elapsedSeconds: 300,
      targetDistanceMeters: 5000,
      ghosts,
    });

    expect(snapshot.entries[0].key).toBe('slowGhost');
    expect(snapshot.entries[0].label).toBe('G5');
    expect(snapshot.current.rank).toBeGreaterThan(1);
    expect(snapshot.ghosts.find((ghost) => ghost.key === 'bestGhost')).toBeDefined();
    expect(snapshot.current.progressPercent).toBe(21);
  });

  it('returns close cues for the nearest past ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1050, pace_seconds_per_km: 286 },
      recentRuns,
      recentCheckpoints,
      targetDistanceMeters: 5000,
    });

    expect(cue.category).toBe('close');
    expect(cue.ghostLabel).toBe('G4');
    expect(cue.comparisonText).toContain('G4');
    expect(cue.comparisonText).toMatch(/\d+미터, 약 \d+초/);
  });

  it('returns priority cues when no past ghost is close', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 700, pace_seconds_per_km: 280 },
      recentRuns,
      recentCheckpoints,
      targetDistanceMeters: 5000,
    });

    expect(cue.category).toBe('behind');
    expect(cue.ghostLabel).toBe('G5');
  });

  it('returns personal record cues when ahead of the best ghost', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1160, pace_seconds_per_km: 260 },
      recentRuns,
      recentCheckpoints,
      targetDistanceMeters: 5000,
    });

    expect(cue.category).toBe('personal_record');
    expect(cue.ghostLabel).toBe('G5');
  });

  it('returns overtake cues when the selected ghost delta crosses ahead', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1160, pace_seconds_per_km: 260 },
      recentRuns,
      recentCheckpoints,
      targetDistanceMeters: 5000,
      previousGhostDeltas: { slowGhost: -20 },
    });

    expect(cue.category).toBe('overtake');
    expect(cue.nextGhostDeltas.slowGhost).toBe(40);
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

  it('creates beginner heuristic ghosts when no run data exists', () => {
    const ghosts = buildGhostRunners([], [], new Date('2026-06-28T00:00:00Z'));

    expect(ghosts).toHaveLength(5);
    expect(ghosts.map((ghost) => ghost.key)).toEqual([
      'bestGhost',
      'averageGhost',
      'stableGhost',
      'chaserGhost',
      'slowGhost',
    ]);
    expect(ghosts.map((ghost) => ghost.totalElapsedSeconds)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(ghosts[0].totalDistanceMeters).toBe(2000);
    expect(ghosts[0].avgSpeedKmh).toBe(5.8);
    expect(ghosts[4].avgSpeedKmh).toBe(8.3);
    expect(ghosts.every((ghost) => Array.isArray(ghost.speedProfile) && ghost.speedProfile.length > 1)).toBe(true);
  });

  it('replaces only G4 with the latest completed run after one record', () => {
    const ghosts = buildGhostRunners([recentRuns[0]], recentCheckpoints, new Date('2026-06-28T00:00:00Z'), undefined, 5);

    expect(ghosts.map((ghost) => ghost.key)).toEqual([
      'bestGhost',
      'averageGhost',
      'stableGhost',
      'chaserGhost',
      'slowGhost',
    ]);
    expect(ghosts).toHaveLength(5);
    expect(ghosts.map((ghost) => ghost.source)).toEqual([
      'initial_default',
      'initial_default',
      'initial_default',
      'latest_user_run',
      'initial_default',
    ]);
  });

  it('progressively replaces initial ghosts as completed records accumulate', () => {
    const expectedSourcesByCount = new Map([
      [2, ['initial_default', 'initial_default', 'average_user_run', 'latest_user_run', 'initial_default']],
      [3, ['initial_default', 'initial_default', 'average_user_run', 'latest_user_run', 'personal_best']],
      [5, ['personal_worst', 'initial_default', 'average_user_run', 'latest_user_run', 'personal_best']],
      [7, ['personal_worst', 'adjusted_from_user_data', 'average_user_run', 'latest_user_run', 'personal_best']],
    ]);

    expectedSourcesByCount.forEach((expectedSources, count) => {
      const ghosts = buildGhostRunners(makeCompletedRuns(count), [], new Date('2026-06-28T00:00:00Z'), undefined, 2);
      expect(ghosts.map((ghost) => ghost.source)).toEqual(expectedSources);
    });
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

function makeCompletedRuns(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return {
      id: `run-${index + 1}`,
      started_at: `2026-06-${day}T00:00:00Z`,
      ended_at: `2026-06-${day}T00:20:00Z`,
      status: 'completed',
      total_elapsed_seconds: 1200 - index * 20,
      total_distance_meters: 2000,
    };
  });
}
