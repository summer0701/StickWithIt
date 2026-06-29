import { supabase } from '../lib/supabaseClient';
import { readLocalRuns } from '../lib/localRuns';
import { isTestUserId } from '../lib/testAuth';
import { sameTargetDistance } from '../lib/ghostRun';

export async function loadRecentRunHistory(userId, limit = 5, targetDistanceKm = null) {
  const localResult = isTestUserId(userId) ? loadLocalRunHistory(userId, limit, targetDistanceKm) : null;

  if (!canQuerySupabase()) {
    return localResult ?? { recentRuns: [], recentCheckpoints: [], error: null };
  }

  let serverResult;
  try {
    serverResult = await loadServerRunHistory(userId, limit, targetDistanceKm);
  } catch (error) {
    console.debug('[runComparison] Failed to query run history.', error);
    return localResult ?? { recentRuns: [], recentCheckpoints: [], error };
  }
  if (!localResult) return serverResult;
  if (serverResult.error && localResult.recentRuns.length > 0) return localResult;

  return {
    recentRuns: mergeRunsByStartedAt(serverResult.recentRuns, localResult.recentRuns).slice(0, limit),
    recentCheckpoints: serverResult.recentCheckpoints,
    error: serverResult.error,
  };
}

async function loadServerRunHistory(userId, limit, targetDistanceKm) {
  let query = supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(targetDistanceKm == null ? limit : Math.max(limit * 4, 20));
  if (targetDistanceKm != null) {
    query = query.gte('target_distance_km', targetDistanceKm - 0.01).lte('target_distance_km', targetDistanceKm + 0.01);
  }
  const { data: recentRuns, error: runsError } = await query.eq('status', 'completed');

  if (isMissingColumnError(runsError)) {
    console.debug('[runComparison] Falling back to legacy runs query without status.', runsError);
    return loadRecentRunHistoryWithoutStatus(userId, limit, targetDistanceKm);
  }

  if (runsError) {
    console.debug('[runComparison] Failed to load recent runs.', runsError);
    return { recentRuns: [], recentCheckpoints: [], error: runsError };
  }

  const selectedRuns = filterRunsByTarget(recentRuns ?? [], targetDistanceKm).slice(0, limit);
  const runIds = selectedRuns.map((run) => run.id);
  if (runIds.length === 0) return { recentRuns: [], recentCheckpoints: [], error: null };

  const { data: recentCheckpoints, error: checkpointsError } = await supabase
    .from('run_checkpoints')
    .select('*')
    .in('run_id', runIds)
    .order('created_at', { ascending: true });

  if (checkpointsError) {
    console.debug('[runComparison] Failed to load recent checkpoints.', checkpointsError);
  }

  return {
    recentRuns: selectedRuns,
    recentCheckpoints: recentCheckpoints ?? [],
    error: checkpointsError ?? null,
  };
}

export function isCompletedRun(run) {
  if (!run) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

async function loadRecentRunHistoryWithoutStatus(userId, limit, targetDistanceKm = null) {
  const { data: recentRuns, error: runsError } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(targetDistanceKm == null ? limit : Math.max(limit * 4, 20));

  if (runsError) {
    console.debug('[runComparison] Failed to load legacy recent runs.', runsError);
    return { recentRuns: [], recentCheckpoints: [], error: runsError };
  }

  const selectedRuns = filterRunsByTarget(recentRuns ?? [], targetDistanceKm).slice(0, limit);
  const runIds = selectedRuns.map((run) => run.id);
  if (runIds.length === 0) return { recentRuns: [], recentCheckpoints: [], error: null };

  const { data: recentCheckpoints, error: checkpointsError } = await supabase
    .from('run_checkpoints')
    .select('*')
    .in('run_id', runIds)
    .order('created_at', { ascending: true });

  return {
    recentRuns: selectedRuns,
    recentCheckpoints: checkpointsError ? [] : (recentCheckpoints ?? []),
    error: checkpointsError ?? null,
  };
}

function filterRunsByTarget(runs, targetDistanceKm) {
  if (targetDistanceKm == null) return runs;
  return runs.filter((run) => sameTargetDistance(run.target_distance_km, targetDistanceKm));
}

function loadLocalRunHistory(userId, limit, targetDistanceKm) {
  return {
    recentRuns: filterRunsByTarget(readLocalRuns(userId).filter(isCompletedRun), targetDistanceKm).slice(0, limit),
    recentCheckpoints: [],
    error: null,
  };
}

function mergeRunsByStartedAt(serverRuns = [], localRuns = []) {
  const runsById = new Map();
  [...serverRuns, ...localRuns].forEach((run) => {
    if (run?.id) runsById.set(run.id, run);
  });

  return [...runsById.values()].sort(compareRunStartedDesc);
}

function compareRunStartedDesc(a, b) {
  return new Date(b.started_at ?? b.created_at ?? 0) - new Date(a.started_at ?? a.created_at ?? 0);
}

function canQuerySupabase() {
  return typeof supabase?.from === 'function';
}

function isMissingColumnError(error) {
  if (!error) return false;
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  return /column|schema cache|Could not find/i.test(message);
}
