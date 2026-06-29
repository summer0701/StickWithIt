import { beforeEach, describe, expect, it } from 'vitest';
import { deleteLocalRuns, readLocalRuns, saveLocalRun } from './localRuns';

describe('localRuns', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves completed local runs per user sorted newest first', () => {
    saveLocalRun('user-1', {
      id: 'old',
      actual_distance_km: 1,
      duration_seconds: 60,
      started_at: '2026-06-27T09:00:00.000Z',
    });
    saveLocalRun('user-1', {
      id: 'new',
      actual_distance_km: 2,
      duration_seconds: 120,
      started_at: '2026-06-27T10:00:00.000Z',
    });
    saveLocalRun('user-2', {
      id: 'other',
      actual_distance_km: 3,
      duration_seconds: 180,
      started_at: '2026-06-27T11:00:00.000Z',
    });

    const runs = readLocalRuns('user-1');

    expect(runs.map((run) => run.id)).toEqual(['new', 'old']);
    expect(runs[0].is_local).toBe(true);
  });

  it('clears corrupt local run data', () => {
    window.localStorage.setItem('stickwithit:completed-runs', '{broken');

    expect(readLocalRuns('user-1')).toEqual([]);
    expect(window.localStorage.getItem('stickwithit:completed-runs')).toBeNull();
  });

  it('deletes local runs for only one user', () => {
    saveLocalRun('user-1', { id: 'one', started_at: '2026-06-27T09:00:00.000Z' });
    saveLocalRun('user-2', { id: 'two', started_at: '2026-06-27T10:00:00.000Z' });

    expect(deleteLocalRuns('user-1')).toBe(1);
    expect(readLocalRuns('user-1')).toEqual([]);
    expect(readLocalRuns('user-2').map((run) => run.id)).toEqual(['two']);
  });
});
