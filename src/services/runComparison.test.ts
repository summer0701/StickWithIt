import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveLocalRun } from '../lib/localRuns';
import { TEST_ACCOUNT } from '../lib/testAuth';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

describe('runComparison', () => {
  beforeEach(() => {
    window.localStorage.clear();
    supabaseMock.from.mockReset();
  });

  it('loads only completed local runs matching the target distance for ghost rebuilding', async () => {
    const { loadRecentRunHistory } = await import('./runComparison');

    saveLocalRun(TEST_ACCOUNT.id, {
      id: 'five-k',
      status: 'completed',
      target_distance_km: 5,
      total_distance_meters: 5000,
      total_elapsed_seconds: 1500,
      started_at: '2026-06-28T00:00:00Z',
      ended_at: '2026-06-28T00:25:00Z',
    });
    saveLocalRun(TEST_ACCOUNT.id, {
      id: 'ten-k',
      status: 'completed',
      target_distance_km: 10,
      total_distance_meters: 10000,
      total_elapsed_seconds: 3600,
      started_at: '2026-06-27T00:00:00Z',
      ended_at: '2026-06-27T01:00:00Z',
    });

    const result = await loadRecentRunHistory(TEST_ACCOUNT.id, 5, 5);

    expect(result.recentRuns.map((run) => run.id)).toEqual(['five-k']);
  });

  it('ignores local ghost runs before the reset timestamp', async () => {
    const { resetGhostHistory } = await import('../lib/ghostReset');
    const { loadRecentRunHistory } = await import('./runComparison');
    resetGhostHistory(TEST_ACCOUNT.id, new Date('2026-06-28T12:00:00.000Z'));

    saveLocalRun(TEST_ACCOUNT.id, {
      id: 'before-reset',
      status: 'completed',
      target_distance_km: 5,
      total_distance_meters: 5000,
      total_elapsed_seconds: 1500,
      started_at: '2026-06-28T11:59:59.000Z',
      ended_at: '2026-06-28T12:25:00.000Z',
    });
    saveLocalRun(TEST_ACCOUNT.id, {
      id: 'after-reset',
      status: 'completed',
      target_distance_km: 5,
      total_distance_meters: 5000,
      total_elapsed_seconds: 1480,
      started_at: '2026-06-28T12:00:00.000Z',
      ended_at: '2026-06-28T12:24:40.000Z',
    });

    const result = await loadRecentRunHistory(TEST_ACCOUNT.id, 5, 5);

    expect(result.recentRuns.map((run) => run.id)).toEqual(['after-reset']);
  });

  it('includes server runs for the test account when Supabase is available', async () => {
    const { loadRecentRunHistory } = await import('./runComparison');
    const runsQuery = createRunsQuery([
      {
        id: 'server-five-k',
        status: 'completed',
        target_distance_km: 5,
        total_distance_meters: 5000,
        total_elapsed_seconds: 1400,
        started_at: '2026-06-29T00:00:00Z',
        ended_at: '2026-06-29T00:23:20Z',
      },
      {
        id: 'server-ten-k',
        status: 'completed',
        target_distance_km: 10,
        total_distance_meters: 10000,
        total_elapsed_seconds: 3500,
        started_at: '2026-06-28T00:00:00Z',
        ended_at: '2026-06-28T00:58:20Z',
      },
    ]);
    const checkpointsQuery = createCheckpointsQuery([
      { run_id: 'server-five-k', elapsed_seconds: 300, distance_meters: 1000 },
    ]);
    supabaseMock.from.mockImplementation((table) => (table === 'runs' ? runsQuery : checkpointsQuery));

    const result = await loadRecentRunHistory(TEST_ACCOUNT.id, 5, 5);

    expect(result.recentRuns.map((run) => run.id)).toEqual(['server-five-k']);
    expect(result.recentCheckpoints).toEqual([{ run_id: 'server-five-k', elapsed_seconds: 300, distance_meters: 1000 }]);
  });
});

function createRunsQuery(data) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column) => (column === 'status' ? Promise.resolve({ data, error: null }) : query)),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
  };
  return query;
}

function createCheckpointsQuery(data) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}
