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

  it('returns category cues instead of dynamic spoken sentences', () => {
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1050, pace_seconds_per_km: 286 },
      recentRuns,
      recentCheckpoints,
    });

    expect(cue.category).toBe('close');
    expect(cue.fallbackText).toBe('거의 따라잡았어. 지금부터 집중하자.');
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
    const spokenMessages = rememberSpokenMessage([], '거의 따라잡았어. 지금부터 집중하자.');
    const cue = ruleBasedCoach({
      currentCheckpoint: { elapsed_seconds: 300, distance_meters: 1030, pace_seconds_per_km: 291 },
      recentRuns,
      recentCheckpoints,
      spokenMessages,
    });

    expect(cue.fallbackText).not.toBe('거의 따라잡았어. 지금부터 집중하자.');
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
