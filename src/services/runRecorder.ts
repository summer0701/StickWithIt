import { supabase } from '../lib/supabaseClient';
import { saveLocalRun } from '../lib/localRuns';
import { isTestUserId } from '../lib/testAuth';

const QUEUE_KEY = 'stickwithit:checkpoint-queue';

export async function createRunRecord({ userId, startedAt = new Date(), targetDistanceMeters }) {
  if (!isValidUuid(userId)) {
    throw new Error('러닝 기록을 만들 수 없습니다. 사용자 정보가 아직 준비되지 않았습니다.');
  }

  const startedAtIso = toIso(startedAt);
  const targetDistanceKm = targetDistanceMeters ? targetDistanceMeters / 1000 : null;

  if (isTestUserId(userId)) {
    return createLocalRunRecord({ userId, startedAtIso, targetDistanceKm });
  }

  const modernPayload = {
    user_id: userId,
    started_at: startedAtIso,
    status: 'running',
    target_distance_km: targetDistanceKm,
    actual_distance_km: 0,
    duration_seconds: 1,
    total_distance_meters: 0,
    total_elapsed_seconds: 0,
  };
  const { data, error } = await supabase
    .from('runs')
    .insert(modernPayload)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    console.debug('[runRecorder] Falling back to legacy runs schema.', error);
    const legacyPayload = toLegacyRunPayload(modernPayload, startedAtIso);
    const legacyResult = await supabase.from('runs').insert(legacyPayload).select().single();
    if (!legacyResult.error) return legacyResult.data;
    console.debug('[runRecorder] Failed to create legacy run.', legacyResult.error);
    throw legacyResult.error;
  }

  if (error) {
    console.debug('[runRecorder] Failed to create run.', error);
    throw error;
  }

  return data;
}

export async function saveRunCheckpoint(checkpoint) {
  const payload = normalizeCheckpointPayload(checkpoint);
  if (!payload) {
    console.debug('[runRecorder] Dropping invalid checkpoint payload.', checkpoint);
    return { data: null, error: new Error('Invalid checkpoint payload.'), queued: false, dropped: true };
  }

  if (isTestUserId(payload.user_id)) {
    return { data: { ...payload, id: createLocalUuid() }, error: null, queued: false };
  }

  const { data, error } = await supabase.from('run_checkpoints').insert(payload).select().single();

  if (error) {
    console.debug('[runRecorder] Queueing checkpoint after Supabase failure.', error);
    queueCheckpoint(payload);
    return { data: null, error, queued: true };
  }

  return { data, error: null, queued: false };
}

export async function completeRunRecord({
  runId,
  userId,
  startedAt,
  endedAt = new Date(),
  totalDistanceMeters,
  totalElapsedSeconds,
  targetDistanceKm = null,
}) {
  if (!isValidUuid(runId) || !isValidUuid(userId)) {
    return { data: null, error: new Error('Invalid run id or user id.') };
  }

  const distanceKm = totalDistanceMeters / 1000;
  const avgPace = distanceKm > 0 ? Math.round(totalElapsedSeconds / distanceKm) : null;
  const startedAtIso = toIso(startedAt);
  const endedAtIso = toIso(endedAt);

  if (isTestUserId(userId)) {
    const localRun = saveLocalRun(userId, {
      id: runId,
      user_id: userId,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      status: 'completed',
      target_distance_km: targetDistanceKm,
      actual_distance_km: Number(distanceKm.toFixed(3)),
      duration_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
      avg_pace_seconds_per_km: avgPace,
      total_distance_meters: Number(totalDistanceMeters.toFixed(2)),
      total_elapsed_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
    });

    return {
      data: localRun,
      error: null,
    };
  }

  const updatePayload = {
    ended_at: endedAtIso,
    status: 'completed',
    total_distance_meters: Number(totalDistanceMeters.toFixed(2)),
    total_elapsed_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
    avg_pace_seconds_per_km: avgPace,
    actual_distance_km: Number(distanceKm.toFixed(3)),
    duration_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
    started_at: startedAtIso,
  };

  const { data, error } = await supabase
    .from('runs')
    .update(updatePayload)
    .eq('id', runId)
    .eq('user_id', userId)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    const legacyPayload = toLegacyRunPayload(updatePayload, startedAtIso, endedAtIso);
    const legacyResult = await supabase
      .from('runs')
      .update(legacyPayload)
      .eq('id', runId)
      .eq('user_id', userId)
      .select()
      .single();
    if (!legacyResult.error) return { data: legacyResult.data, error: null };
    console.debug('[runRecorder] Failed to complete legacy run.', legacyResult.error);
    return { data: null, error: legacyResult.error };
  }

  if (error) {
    console.debug('[runRecorder] Failed to complete run.', error);
  }

  return { data, error };
}

export async function cancelRunRecord({ runId, userId }) {
  if (!isValidUuid(runId) || !isValidUuid(userId)) return { data: null, error: null };
  if (isTestUserId(userId)) return { data: null, error: null };

  const result = await supabase
    .from('runs')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('user_id', userId);

  if (!isMissingColumnError(result.error)) return result;

  return supabase.from('runs').update({ ended_at: new Date().toISOString() }).eq('id', runId).eq('user_id', userId);
}

export async function flushCheckpointQueue() {
  const queued = readCheckpointQueue().filter((checkpoint) => normalizeCheckpointPayload(checkpoint));
  if (queued.length !== readCheckpointQueue().length) writeCheckpointQueue(queued);
  if (queued.length === 0) return { flushed: 0, remaining: 0 };

  const { error } = await supabase.from('run_checkpoints').insert(queued);
  if (error) {
    console.debug('[runRecorder] Checkpoint queue flush failed.', error);
    return { flushed: 0, remaining: queued.length, error };
  }

  writeCheckpointQueue([]);
  return { flushed: queued.length, remaining: 0, error: null };
}

export function readCheckpointQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function queueCheckpoint(checkpoint) {
  writeCheckpointQueue([...readCheckpointQueue(), checkpoint].slice(-200));
}

function writeCheckpointQueue(queue) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function normalizeCheckpointPayload(checkpoint) {
  if (!isValidUuid(checkpoint?.run_id) || !isValidUuid(checkpoint?.user_id)) {
    return null;
  }

  return {
    run_id: checkpoint.run_id,
    user_id: checkpoint.user_id,
    elapsed_seconds: Math.max(0, Math.round(checkpoint.elapsed_seconds)),
    distance_meters: Number(Number(checkpoint.distance_meters).toFixed(2)),
    pace_seconds_per_km: checkpoint.pace_seconds_per_km == null ? null : Math.round(checkpoint.pace_seconds_per_km),
    speed_kmh: Number(Number(checkpoint.speed_kmh || 0).toFixed(3)),
    latitude: checkpoint.latitude,
    longitude: checkpoint.longitude,
    created_at: checkpoint.created_at ?? new Date().toISOString(),
  };
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function isValidUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingColumnError(error) {
  if (!error) return false;
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  return /column|schema cache|Could not find/i.test(message);
}

function toLegacyRunPayload(payload, startedAtIso, endedAtIso = startedAtIso) {
  return {
    user_id: payload.user_id,
    target_distance_km: payload.target_distance_km,
    actual_distance_km: payload.actual_distance_km ?? Number(((payload.total_distance_meters ?? 0) / 1000).toFixed(3)),
    duration_seconds: Math.max(1, Math.round(payload.duration_seconds ?? payload.total_elapsed_seconds ?? 1)),
    avg_pace_seconds_per_km: payload.avg_pace_seconds_per_km ?? null,
    started_at: startedAtIso,
    ended_at: endedAtIso,
  };
}

function createLocalRunRecord({ userId, startedAtIso, targetDistanceKm }) {
  return {
    id: createLocalUuid(),
    user_id: userId,
    started_at: startedAtIso,
    ended_at: null,
    status: 'running',
    target_distance_km: targetDistanceKm,
    actual_distance_km: 0,
    duration_seconds: 1,
    total_distance_meters: 0,
    total_elapsed_seconds: 0,
  };
}

function createLocalUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
