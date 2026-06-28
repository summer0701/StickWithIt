import { runningCoachPhrases } from '../data/runningCoachPhrases';

const DEFAULT_RECENT_LIMIT = 12;
const CLOSE_GHOST_METERS = 30;

const GHOST_LABELS = {
  yesterdayGhost: '어제의 나',
  bestGhost: '최고 기록의 나',
  averageGhost: '평균 페이스의 나',
  recentGhost: '최근 기록의 나',
  slowGhost: '끝까지 버틴 나',
};

const GHOST_PRIORITY = [
  'bestGhost',
  'yesterdayGhost',
  'averageGhost',
  'recentGhost',
  'slowGhost',
];

const CATEGORY_PRIORITY = {
  completed: 110,
  finish_push: 100,
  one_km_left: 95,
  personal_record: 90,
  close: 80,
  ahead: 70,
  behind: 70,
  halfway: 60,
  tired: 50,
  slow_down: 45,
  warmup: 30,
  start: 20,
};

export function ruleBasedCoach({
  currentCheckpoint,
  recentRuns = [],
  recentCheckpoints = [],
  targetDistanceMeters = 0,
  spokenMessages = [],
}) {
  const checkpoint = normalizeCheckpoint(currentCheckpoint);
  if (!checkpoint) return buildCue('warmup', spokenMessages);

  const targetMeters = Number(targetDistanceMeters || 0);
  if (targetMeters > 0) {
    const remainingMeters = targetMeters - checkpoint.distance_meters;
    if (remainingMeters > 0 && remainingMeters <= 1000) {
      return buildCue('one_km_left', spokenMessages);
    }
    if (checkpoint.distance_meters >= targetMeters * 0.9) {
      return buildCue('finish_push', spokenMessages);
    }
    if (checkpoint.distance_meters >= targetMeters * 0.5 && checkpoint.distance_meters < targetMeters * 0.55) {
      return buildCue('halfway', spokenMessages);
    }
  }

  const ghosts = buildGhostRunners(recentRuns, recentCheckpoints);
  const ghostCue = createGhostCue(checkpoint, ghosts, spokenMessages);
  if (ghostCue) return ghostCue;

  if (checkpoint.speed_kmh != null && checkpoint.speed_kmh > 0 && checkpoint.speed_kmh < 5) {
    return buildCue('tired', spokenMessages);
  }

  return buildCue('warmup', spokenMessages);
}

export function buildGhostRunners(recentRuns = [], recentCheckpoints = [], now = new Date()) {
  const runs = recentRuns
    .filter(isCompletedRun)
    .map((run) => normalizeRun(run, recentCheckpoints))
    .filter(Boolean)
    .slice(0, 5);

  if (runs.length === 0) return [];

  const byStartedAtDesc = [...runs].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const byPaceAsc = [...runs].sort((a, b) => a.paceSecondsPerKm - b.paceSecondsPerKm);
  const yesterdayRun = runs.find((run) => isYesterday(run.startedAt, now)) ?? byStartedAtDesc[0];
  const bestRun = byPaceAsc[0];
  const slowRun = byPaceAsc[byPaceAsc.length - 1];
  const recentRun = byStartedAtDesc.find((run) => run.id !== yesterdayRun?.id) ?? byStartedAtDesc[0];
  const averageGhost = buildAverageGhost(runs);

  return [
    ghostFromRun('yesterdayGhost', yesterdayRun),
    ghostFromRun('bestGhost', bestRun),
    averageGhost,
    ghostFromRun('recentGhost', recentRun),
    ghostFromRun('slowGhost', slowRun),
  ].filter(Boolean);
}

function isCompletedRun(run) {
  if (!run) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

export function createGhostCue(checkpoint, ghosts = [], spokenMessages = []) {
  const comparisons = compareGhosts(checkpoint, ghosts);
  if (comparisons.length === 0) return null;

  const selected = pickPriorityGhost(comparisons);
  if (!selected) return null;

  if (Math.abs(selected.deltaMeters) <= CLOSE_GHOST_METERS) {
    return buildCue('close', spokenMessages);
  }

  if (selected.deltaMeters > 0) {
    return buildCue('ahead', spokenMessages);
  }

  return buildCue('behind', spokenMessages);
}

export function compareGhosts(checkpoint, ghosts = []) {
  return ghosts
    .map((ghost) => {
      const ghostDistanceMeters = distanceAtElapsed(ghost, checkpoint.elapsed_seconds);
      if (!Number.isFinite(ghostDistanceMeters)) return null;
      return {
        ...ghost,
        ghostDistanceMeters,
        deltaMeters: checkpoint.distance_meters - ghostDistanceMeters,
      };
    })
    .filter(Boolean);
}

export function rememberSpokenMessage(spokenMessages, message, limit = DEFAULT_RECENT_LIMIT) {
  if (!message) return spokenMessages.slice(-limit);
  return [...spokenMessages, message].slice(-limit);
}

function buildCue(category, spokenMessages) {
  const phrases = runningCoachPhrases[category] ?? runningCoachPhrases.warmup;
  const fallbackText = pickFresh(phrases, spokenMessages);
  return {
    type: category,
    category,
    priority: CATEGORY_PRIORITY[category] ?? 10,
    fallbackText,
    message: fallbackText,
  };
}

function pickFresh(messages, spokenMessages) {
  return messages.find((message) => !spokenMessages.includes(message)) ?? messages[0];
}

function pickPriorityGhost(comparisons) {
  const close = [...comparisons].sort((a, b) => Math.abs(a.deltaMeters) - Math.abs(b.deltaMeters))[0];
  if (close && Math.abs(close.deltaMeters) <= CLOSE_GHOST_METERS) return close;

  for (const priority of GHOST_PRIORITY) {
    const ghost = comparisons.find((item) => item.key === priority);
    if (ghost) return ghost;
  }

  return close;
}

function normalizeCheckpoint(checkpoint) {
  if (!checkpoint) return null;
  const distanceMeters = Number(checkpoint.distance_meters);
  const elapsedSeconds = Number(checkpoint.elapsed_seconds);
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds)) return null;
  return {
    ...checkpoint,
    distance_meters: distanceMeters,
    elapsed_seconds: elapsedSeconds,
    pace_seconds_per_km: checkpoint.pace_seconds_per_km == null ? null : Number(checkpoint.pace_seconds_per_km),
    speed_kmh: checkpoint.speed_kmh == null ? null : Number(checkpoint.speed_kmh),
  };
}

function normalizeRun(run, recentCheckpoints) {
  const id = run?.id;
  const distanceMeters = Number(run?.total_distance_meters ?? Number(run?.actual_distance_km || 0) * 1000);
  const elapsedSeconds = Number(run?.total_elapsed_seconds ?? run?.duration_seconds);
  if (!id || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return null;
  }

  const checkpoints = recentCheckpoints
    .filter((checkpoint) => checkpoint.run_id === id)
    .map((checkpoint) => ({
      elapsedSeconds: Number(checkpoint.elapsed_seconds),
      distanceMeters: Number(checkpoint.distance_meters),
    }))
    .filter((checkpoint) => Number.isFinite(checkpoint.elapsedSeconds) && Number.isFinite(checkpoint.distanceMeters))
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  const startedAt = run.started_at ?? run.created_at ?? '';
  return {
    id,
    startedAt,
    startedAtMs: startedAt ? new Date(startedAt).getTime() : 0,
    totalDistanceMeters: distanceMeters,
    totalElapsedSeconds: elapsedSeconds,
    paceSecondsPerKm: elapsedSeconds / (distanceMeters / 1000),
    checkpoints,
  };
}

function ghostFromRun(key, run) {
  if (!run) return null;
  return {
    key,
    label: GHOST_LABELS[key],
    sourceRunId: run.id,
    totalDistanceMeters: run.totalDistanceMeters,
    totalElapsedSeconds: run.totalElapsedSeconds,
    checkpoints: run.checkpoints,
  };
}

function buildAverageGhost(runs) {
  const totalElapsedSeconds = runs.reduce((sum, run) => sum + run.totalElapsedSeconds, 0);
  const totalDistanceMeters = runs.reduce((sum, run) => sum + run.totalDistanceMeters, 0);
  const combinedSpeedMetersPerSecond = totalDistanceMeters / totalElapsedSeconds;
  const averageElapsedSeconds = totalElapsedSeconds / runs.length;
  return {
    key: 'averageGhost',
    label: GHOST_LABELS.averageGhost,
    totalDistanceMeters: combinedSpeedMetersPerSecond * averageElapsedSeconds,
    totalElapsedSeconds: averageElapsedSeconds,
    checkpoints: [],
  };
}

function distanceAtElapsed(ghost, elapsedSeconds) {
  const checkpoints = ghost.checkpoints ?? [];
  if (checkpoints.length > 0) {
    return [...checkpoints].sort(
      (a, b) => Math.abs(a.elapsedSeconds - elapsedSeconds) - Math.abs(b.elapsedSeconds - elapsedSeconds),
    )[0].distanceMeters;
  }

  if (!ghost.totalElapsedSeconds || !ghost.totalDistanceMeters) return null;
  return Math.min(ghost.totalDistanceMeters, (ghost.totalDistanceMeters / ghost.totalElapsedSeconds) * elapsedSeconds);
}

function isYesterday(value, now) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10);
}
