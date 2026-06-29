const LOCAL_RUNS_STORAGE_KEY = 'stickwithit:completed-runs';

export function readLocalRuns(userId) {
  try {
    const rawRuns = window.localStorage.getItem(LOCAL_RUNS_STORAGE_KEY);
    if (!rawRuns) return [];

    return JSON.parse(rawRuns)
      .filter((run) => run.user_id === userId)
      .sort(compareRunStartedDesc);
  } catch {
    window.localStorage.removeItem(LOCAL_RUNS_STORAGE_KEY);
    return [];
  }
}

export function saveLocalRun(userId, run) {
  const savedRun = {
    ...run,
    id: run.id ?? `local-${Date.now()}`,
    user_id: userId,
    is_local: true,
  };

  const allRuns = readAllLocalRuns();
  const nextRuns = [savedRun, ...allRuns.filter((item) => item.id !== savedRun.id)].slice(0, 50);
  window.localStorage.setItem(LOCAL_RUNS_STORAGE_KEY, JSON.stringify(nextRuns));

  return savedRun;
}

export function deleteLocalRuns(userId) {
  const allRuns = readAllLocalRuns();
  const nextRuns = allRuns.filter((run) => run.user_id !== userId);

  if (nextRuns.length === 0) {
    window.localStorage.removeItem(LOCAL_RUNS_STORAGE_KEY);
  } else {
    window.localStorage.setItem(LOCAL_RUNS_STORAGE_KEY, JSON.stringify(nextRuns));
  }

  return allRuns.length - nextRuns.length;
}

function readAllLocalRuns() {
  try {
    const rawRuns = window.localStorage.getItem(LOCAL_RUNS_STORAGE_KEY);
    return rawRuns ? JSON.parse(rawRuns) : [];
  } catch {
    return [];
  }
}

function compareRunStartedDesc(a, b) {
  return new Date(b.started_at ?? b.created_at ?? 0) - new Date(a.started_at ?? a.created_at ?? 0);
}
