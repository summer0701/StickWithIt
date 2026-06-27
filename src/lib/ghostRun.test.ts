import { describe, expect, it } from 'vitest';
import { compareWithGhost, estimateGhostElapsed, interpolateGhostElapsed, pickGhostRun } from './ghostRun';

describe('ghostRun', () => {
  it('prefers yesterday same target, then recent best, then personal best', () => {
    const now = new Date('2026-06-27T12:00:00Z');
    const ghost = pickGhostRun(
      [
        { id: 'old', target_distance_km: 3, duration_seconds: 900, started_at: '2026-06-01T00:00:00Z' },
        { id: 'yesterday', target_distance_km: 3, duration_seconds: 1000, started_at: '2026-06-26T00:00:00Z' },
        { id: 'recent', target_distance_km: 3, duration_seconds: 800, started_at: '2026-06-25T00:00:00Z' },
      ],
      3,
      now,
    );

    expect(ghost.id).toBe('yesterday');
    expect(ghost.ghost_source).toBe('yesterday');
  });

  it('interpolates split elapsed time and compares current effort', () => {
    const splits = [
      { distance_km: 0.5, elapsed_seconds: 160 },
      { distance_km: 1, elapsed_seconds: 320 },
    ];

    expect(interpolateGhostElapsed(splits, 0.75)).toBe(240);
    expect(compareWithGhost({ currentDistanceKm: 0.75, elapsedSeconds: 228, ghostSplits: splits })).toBe(-12);
  });

  it('falls back to total ghost run duration when splits are missing', () => {
    const ghostRun = { target_distance_km: 3, actual_distance_km: 3, duration_seconds: 900 };

    expect(estimateGhostElapsed({ currentDistanceKm: 1.5, ghostRun, ghostSplits: [] })).toBe(450);
    expect(compareWithGhost({ currentDistanceKm: 1.5, elapsedSeconds: 420, ghostRun, ghostSplits: [] })).toBe(-30);
  });
});
