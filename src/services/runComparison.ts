import { supabase } from '../lib/supabaseClient';

export async function loadRecentRunHistory(userId, limit = 5) {
  const query = supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  const { data: recentRuns, error: runsError } = await query.eq('status', 'completed');

  if (isMissingColumnError(runsError)) {
    console.debug('[runComparison] Falling back to legacy runs query without status.', runsError);
    return loadRecentRunHistoryWithoutStatus(userId, limit);
  }

  if (runsError) {
    console.debug('[runComparison] Failed to load recent runs.', runsError);
    return { recentRuns: [], recentCheckpoints: [], error: runsError };
  }

  const runIds = (recentRuns ?? []).map((run) => run.id);
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
    recentRuns: recentRuns ?? [],
    recentCheckpoints: recentCheckpoints ?? [],
    error: checkpointsError ?? null,
  };
}

async function loadRecentRunHistoryWithoutStatus(userId, limit) {
  const { data: recentRuns, error: runsError } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (runsError) {
    console.debug('[runComparison] Failed to load legacy recent runs.', runsError);
    return { recentRuns: [], recentCheckpoints: [], error: runsError };
  }

  const runIds = (recentRuns ?? []).map((run) => run.id);
  if (runIds.length === 0) return { recentRuns: [], recentCheckpoints: [], error: null };

  const { data: recentCheckpoints, error: checkpointsError } = await supabase
    .from('run_checkpoints')
    .select('*')
    .in('run_id', runIds)
    .order('created_at', { ascending: true });

  return {
    recentRuns: recentRuns ?? [],
    recentCheckpoints: checkpointsError ? [] : (recentCheckpoints ?? []),
    error: checkpointsError ?? null,
  };
}

function isMissingColumnError(error) {
  if (!error) return false;
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  return /column|schema cache|Could not find/i.test(message);
}
