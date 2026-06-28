import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ACCOUNT } from '../lib/testAuth';

const insertMock = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: insertMock,
      update: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    })),
  },
}));

describe('runRecorder local test account', () => {
  beforeEach(() => {
    insertMock.mockReset();
    window.localStorage.clear();
  });

  it('creates and completes test runs without calling Supabase', async () => {
    const { completeRunRecord, createRunRecord, isValidUuid } = await import('./runRecorder');
    const startedAt = new Date('2026-06-28T08:00:00.000Z');
    const endedAt = new Date('2026-06-28T08:30:00.000Z');

    const run = await createRunRecord({
      userId: TEST_ACCOUNT.id,
      startedAt,
      targetDistanceMeters: 10000,
    });

    const result = await completeRunRecord({
      runId: run.id,
      userId: TEST_ACCOUNT.id,
      startedAt,
      endedAt,
      totalDistanceMeters: 5000,
      totalElapsedSeconds: 1800,
      targetDistanceKm: 10,
    });

    expect(isValidUuid(run.id)).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data?.target_distance_km).toBe(10);
    expect(result.data?.actual_distance_km).toBe(5);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('saves test checkpoints without calling Supabase', async () => {
    const { saveRunCheckpoint } = await import('./runRecorder');

    const result = await saveRunCheckpoint({
      run_id: '00000000-0000-4000-8000-000000000002',
      user_id: TEST_ACCOUNT.id,
      elapsed_seconds: 60,
      distance_meters: 200,
      speed_kmh: 12,
    });

    expect(result.error).toBeNull();
    expect(result.queued).toBe(false);
    expect(result.data?.distance_meters).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
