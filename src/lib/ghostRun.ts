export function sameTargetDistance(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

export function pickGhostRun(runs = [], targetDistanceKm, now = new Date()) {
  const candidates = runs
    .filter((run) => sameTargetDistance(run.target_distance_km, targetDistanceKm))
    .sort((a, b) => new Date(b.started_at ?? b.created_at) - new Date(a.started_at ?? a.created_at));

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const yesterdayRuns = candidates.filter((run) => (run.started_at ?? run.created_at ?? '').slice(0, 10) === yesterdayKey);
  if (yesterdayRuns.length > 0) {
    return bestByDuration(yesterdayRuns, 'yesterday');
  }

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRuns = candidates.filter((run) => new Date(run.started_at ?? run.created_at) >= sevenDaysAgo);
  if (recentRuns.length > 0) {
    return bestByDuration(recentRuns, 'recent_best');
  }

  if (candidates.length > 0) {
    return bestByDuration(candidates, 'personal_best');
  }

  return null;
}

function bestByDuration(runs, source) {
  const run = [...runs].sort((a, b) => a.duration_seconds - b.duration_seconds)[0];
  return { ...run, ghost_source: source };
}

export function interpolateGhostElapsed(splits = [], currentDistanceKm) {
  if (!splits.length || currentDistanceKm <= 0) {
    return null;
  }

  const ordered = [...splits].sort((a, b) => a.distance_km - b.distance_km);
  const exact = ordered.find((split) => Number(split.distance_km) >= currentDistanceKm);

  if (!exact) {
    return ordered[ordered.length - 1].elapsed_seconds;
  }

  const previousIndex = ordered.indexOf(exact) - 1;
  const previous = previousIndex >= 0 ? ordered[previousIndex] : { distance_km: 0, elapsed_seconds: 0 };
  const span = Number(exact.distance_km) - Number(previous.distance_km);

  if (span <= 0) {
    return exact.elapsed_seconds;
  }

  const ratio = (currentDistanceKm - Number(previous.distance_km)) / span;
  return Math.round(previous.elapsed_seconds + ratio * (exact.elapsed_seconds - previous.elapsed_seconds));
}

export function compareWithGhost({ currentDistanceKm, elapsedSeconds, ghostSplits }) {
  const ghostElapsed = interpolateGhostElapsed(ghostSplits, currentDistanceKm);

  if (ghostElapsed == null) {
    return null;
  }

  return elapsedSeconds - ghostElapsed;
}
