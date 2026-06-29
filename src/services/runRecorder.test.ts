import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ACCOUNT } from '../lib/testAuth';

const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const fromMock = vi.fn();

function createQueryBuilder() {
  const builder: Record<string, any> = {};
  builder.insert = insertMock;
  builder.update = updateMock;
  builder.eq = eqMock;
  builder.select = selectMock;
  builder.single = singleMock;
  insertMock.mockReturnValue(builder);
  updateMock.mockReturnValue(builder);
  eqMock.mockReturnValue(builder);
  selectMock.mockReturnValue(builder);
  return builder;
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: fromMock,
  },
}));

describe('runRecorder local test account', () => {
  beforeEach(() => {
    vi.resetModules();
    insertMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    singleMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation(() => createQueryBuilder());
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

  it('queues failed server run completions and flushes them later', async () => {
    const { completeRunRecord, flushRunCompletionQueue, readRunCompletionQueue } = await import('./runRecorder');
    const serverError = new Error('network down');
    singleMock.mockResolvedValueOnce({ data: null, error: serverError });

    const result = await completeRunRecord({
      runId: '00000000-0000-4000-8000-000000000002',
      userId: '00000000-0000-4000-8000-000000000003',
      startedAt: new Date('2026-06-28T08:00:00.000Z'),
      endedAt: new Date('2026-06-28T08:30:00.000Z'),
      totalDistanceMeters: 5000,
      totalElapsedSeconds: 1800,
      targetDistanceKm: 5,
    });

    expect(result.error).toBe(serverError);
    expect(readRunCompletionQueue()).toHaveLength(1);
    expect(readRunCompletionQueue()[0].payload).toMatchObject({
      status: 'completed',
      actual_distance_km: 5,
      duration_seconds: 1800,
    });

    const flushResult = await flushRunCompletionQueue();

    expect(flushResult).toMatchObject({ flushed: 1, remaining: 0, error: null });
    expect(readRunCompletionQueue()).toHaveLength(0);
  });
});
