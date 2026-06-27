import { supabase } from '../lib/supabaseClient';

const QUEUE_KEY = 'stickwithit:checkpoint-queue';

export async function createRunRecord({ userId, startedAt = new Date(), targetDistanceMeters }) {
  const startedAtIso = toIso(startedAt);
  const targetDistanceKm = targetDistanceMeters ? targetDistanceMeters / 1000 : null;
  const { data, error } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      started_at: startedAtIso,
      status: 'running',
      target_distance_km: targetDistanceKm,
      actual_distance_km: 0,
      duration_seconds: 1,
      total_distance_meters: 0,
      total_elapsed_seconds: 0,
    })
    .select()
    .single();

  if (error) {
    console.debug('[runRecorder] Failed to create run.', error);
    throw error;
  }

  return data;
}

export async function saveRunCheckpoint(checkpoint) {
  const payload = normalizeCheckpointPayload(checkpoint);
  const { data, error } = await supabase.from('run_checkpoints').insert(payload).select().single();

  if (error) {
    console.debug('[runRecorder] Queueing checkpoint after Supabase failure.', error);
    queueCheckpoint(payload);
    return { data: null, error, queued: true };
  }

  return { data, error: null, queued: false };
}

export async function completeRunRecord({ runId, userId, startedAt, endedAt = new Date(), totalDistanceMeters, totalElapsedSeconds }) {
  const distanceKm = totalDistanceMeters / 1000;
  const avgPace = distanceKm > 0 ? Math.round(totalElapsedSeconds / distanceKm) : null;
  const updatePayload = {
    ended_at: toIso(endedAt),
    status: 'completed',
    total_distance_meters: Number(totalDistanceMeters.toFixed(2)),
    total_elapsed_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
    avg_pace_seconds_per_km: avgPace,
    actual_distance_km: Number(distanceKm.toFixed(3)),
    duration_seconds: Math.max(1, Math.round(totalElapsedSeconds)),
    started_at: toIso(startedAt),
  };

  const { data, error } = await supabase
    .from('runs')
    .update(updatePayload)
    .eq('id', runId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.debug('[runRecorder] Failed to complete run.', error);
  }

  return { data, error };
}

export async function cancelRunRecord({ runId, userId }) {
  if (!runId) return { data: null, error: null };
  return supabase.from('runs').update({ status: 'cancelled', ended_at: new Date().toISOString() }).eq('id', runId).eq('user_id', userId);
}

export async function flushCheckpointQueue() {
  const queued = readCheckpointQueue();
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
