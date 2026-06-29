import { runningCoachPhrases } from '../data/runningCoachPhrases';
import { applyGhostSettingsToRunners, defaultGhostSettings } from '../lib/ghostSettings';
import { createGhostPackFromBase, ghostPackRouteToRunner } from '../lib/naturalGhostPack';

const DEFAULT_RECENT_LIMIT = 12;
const CLOSE_GHOST_METERS = 30;
const GHOST_EVENT_METERS = 10;

const GHOST_LABELS = {
  bestGhost: '베스트 고스트',
  averageGhost: '평균 고스트',
  stableGhost: '안정 고스트',
  chaserGhost: '추격 고스트',
  slowGhost: '워스트 고스트',
};

const GHOST_PRIORITY = [
  'bestGhost',
  'averageGhost',
  'stableGhost',
  'chaserGhost',
  'slowGhost',
];

const CATEGORY_PRIORITY = {
  completed: 110,
  finish_push: 100,
  one_km_left: 95,
  personal_record: 90,
  overtake: 88,
  overtaken: 86,
  close: 80,
  ahead: 70,
  behind: 70,
  halfway: 60,
  tired: 50,
  slow_down: 45,
  encouragement: 35,
  warmup: 30,
  start: 20,
};

export function ruleBasedCoach({
  currentCheckpoint,
  recentRuns = [],
  recentCheckpoints = [],
  ghostRunners = null,
  targetDistanceMeters = 0,
  spokenMessages = [],
  previousGhostDeltas = {},
}) {
  const checkpoint = normalizeCheckpoint(currentCheckpoint);
  if (!checkpoint) return buildCue('warmup', spokenMessages);

  const targetMeters = Number(targetDistanceMeters || 0);
  if (targetMeters > 0) {
    const remainingMeters = targetMeters - checkpoint.distance_meters;
    if (remainingMeters > 0 && remainingMeters <= 500) {
      return buildCue('finish_push', spokenMessages);
    }
    if (remainingMeters > 0 && remainingMeters <= 1000) {
      return buildCue('one_km_left', spokenMessages);
    }
    if (checkpoint.distance_meters >= targetMeters * 0.5 && checkpoint.distance_meters < targetMeters * 0.55) {
      return buildCue('halfway', spokenMessages);
    }
  }

  const ghosts = ghostRunners ?? buildGhostRunners(recentRuns, recentCheckpoints);
  const ghostCue = createGhostCue(checkpoint, ghosts, spokenMessages, previousGhostDeltas);
  if (ghostCue) return ghostCue;

  if (checkpoint.speed_kmh != null && checkpoint.speed_kmh > 0 && checkpoint.speed_kmh < 5) {
    return buildCue('tired', spokenMessages);
  }

  return buildCue(checkpoint.elapsed_seconds < 300 ? 'warmup' : 'encouragement', spokenMessages);
}

export function buildGhostRunners(
  recentRuns = [],
  recentCheckpoints = [],
  now = new Date(),
  ghostSettings = defaultGhostSettings(),
  targetDistanceKm = null,
) {
  const runs = recentRuns
    .filter(isCompletedRun)
    .map((run) => normalizeRun(run, recentCheckpoints))
    .filter(Boolean)
    .slice(0, 5);

  if (runs.length === 0) {
    return applyGhostSettingsToRunners({ runners: [], settings: ghostSettings, targetDistanceKm });
  }

  if (runs.length === 1) {
    const generatedRunners = createGhostPackFromBase(runToBaseGhost(runs[0])).map(ghostPackRouteToRunner);
    return applyGhostSettingsToRunners({
      runners: generatedRunners,
      settings: ghostSettings,
      targetDistanceKm,
    });
  }

  const byStartedAtDesc = [...runs].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const byPaceAsc = [...runs].sort((a, b) => a.paceSecondsPerKm - b.paceSecondsPerKm);
  const bestRun = byPaceAsc[0];
  const slowRun = byPaceAsc[byPaceAsc.length - 1];
  const chaserRun = byStartedAtDesc[0];
  const averageGhost = buildAverageGhost(runs);
  const stableGhost = buildStableGhost(runs);

  return applyGhostSettingsToRunners({
    runners: [
      ghostFromRun('bestGhost', bestRun),
      averageGhost,
      stableGhost,
      ghostFromRun('chaserGhost', chaserRun),
      ghostFromRun('slowGhost', slowRun),
    ].filter(Boolean),
    settings: ghostSettings,
    targetDistanceKm,
  });
}

function isCompletedRun(run) {
  if (!run) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

export function createGhostCue(checkpoint, ghosts = [], spokenMessages = [], previousGhostDeltas = {}) {
  const comparisons = compareGhosts(checkpoint, ghosts);
  if (comparisons.length === 0) return null;

  const selected = pickPriorityGhost(comparisons);
  if (!selected) return null;

  const transition = ghostTransitionFor(selected, previousGhostDeltas[selected.key]);
  if (transition) {
    return buildGhostCue(transition, selected, spokenMessages, comparisons);
  }

  if (Math.abs(selected.deltaMeters) <= CLOSE_GHOST_METERS) {
    return buildGhostCue('close', selected, spokenMessages, comparisons);
  }

  if (selected.key === 'bestGhost' && selected.deltaMeters > CLOSE_GHOST_METERS) {
    return buildGhostCue('personal_record', selected, spokenMessages, comparisons);
  }

  if (selected.deltaMeters > 0) {
    return buildGhostCue('ahead', selected, spokenMessages, comparisons);
  }

  return buildGhostCue('behind', selected, spokenMessages, comparisons);
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

export function buildGhostRaceSnapshot({
  currentDistanceMeters = 0,
  elapsedSeconds = 0,
  targetDistanceMeters = 0,
  ghosts = [],
}) {
  const currentDistance = Math.max(0, Number(currentDistanceMeters) || 0);
  const targetMeters = Math.max(1, Number(targetDistanceMeters) || currentDistance || 1);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);

  const ghostEntries = ghosts
    .map((ghost) => {
      const distanceMeters = distanceAtElapsed(ghost, elapsed);
      if (!Number.isFinite(distanceMeters)) return null;
      return raceEntry({
        key: ghost.key,
        label: ghost.label,
        distanceMeters,
        targetMeters,
        deltaFromCurrentMeters: distanceMeters - currentDistance,
        isCurrent: false,
      });
    })
    .filter(Boolean);

  const currentEntry = raceEntry({
    key: 'current',
    label: '나',
    distanceMeters: currentDistance,
    targetMeters,
    deltaFromCurrentMeters: 0,
    isCurrent: true,
  });

  const ranked = [...ghostEntries, currentEntry]
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    targetDistanceMeters: targetMeters,
    entries: ranked,
    current: ranked.find((entry) => entry.isCurrent) ?? currentEntry,
    ghosts: ranked.filter((entry) => !entry.isCurrent),
  };
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
    priority: priorityForCategory(category),
    fallbackText,
    message: fallbackText,
  };
}

function buildGhostCue(category, selected, spokenMessages, comparisons) {
  return {
    ...buildCue(category, spokenMessages),
    ghostKey: selected.key,
    ghostLabel: selected.label,
    deltaMeters: selected.deltaMeters,
    ghostDistanceMeters: selected.ghostDistanceMeters,
    comparisonText: formatGhostComparison(selected),
    nextGhostDeltas: Object.fromEntries(comparisons.map((comparison) => [comparison.key, comparison.deltaMeters])),
  };
}

function ghostTransitionFor(selected, previousDelta) {
  if (!Number.isFinite(previousDelta)) return null;
  if (previousDelta < -GHOST_EVENT_METERS && selected.deltaMeters >= GHOST_EVENT_METERS) return 'overtake';
  if (previousDelta > GHOST_EVENT_METERS && selected.deltaMeters <= -GHOST_EVENT_METERS) return 'overtaken';
  return null;
}

function formatGhostComparison(selected) {
  const gapMeters = Math.round(Math.abs(selected.deltaMeters));
  if (Math.abs(selected.deltaMeters) <= CLOSE_GHOST_METERS) {
    return `${selected.label}와 ${gapMeters}미터 차이로 거의 나란히 달리고 있습니다.`;
  }
  if (selected.deltaMeters > 0) {
    return `${selected.label}보다 ${gapMeters}미터 앞서고 있습니다.`;
  }
  return `${selected.label}보다 ${gapMeters}미터 뒤처져 있습니다.`;
}

function priorityForCategory(category) {
  return CATEGORY_PRIORITY[category] ?? CATEGORY_PRIORITY[ghostStatusFromCategory(category)] ?? 10;
}

function ghostStatusFromCategory(category) {
  return String(category ?? '').split('_').pop();
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

function runToBaseGhost(run) {
  const checkpoints = run.checkpoints?.length
    ? [{ elapsedSeconds: 0, distanceMeters: 0 }, ...run.checkpoints]
    : [
        { elapsedSeconds: 0, distanceMeters: 0 },
        { elapsedSeconds: run.totalElapsedSeconds, distanceMeters: run.totalDistanceMeters },
      ];

  return {
    id: run.id,
    name: '기준 고스트',
    type: 'real',
    route: checkpoints.map((checkpoint) => ({
      minute: Number(checkpoint.elapsedSeconds) / 60,
      distance: Number(checkpoint.distanceMeters),
    })),
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

function buildStableGhost(runs) {
  const averageGhost = buildAverageGhost(runs);
  return {
    ...averageGhost,
    key: 'stableGhost',
    label: GHOST_LABELS.stableGhost,
  };
}

function distanceAtElapsed(ghost, elapsedSeconds) {
  const checkpoints = ghost.checkpoints ?? [];
  if (checkpoints.length > 0) {
    return closestCheckpoint(checkpoints, elapsedSeconds)?.distanceMeters;
  }

  if (!ghost.totalElapsedSeconds || !ghost.totalDistanceMeters) return null;
  return Math.min(ghost.totalDistanceMeters, (ghost.totalDistanceMeters / ghost.totalElapsedSeconds) * elapsedSeconds);
}

function closestCheckpoint(checkpoints, elapsedSeconds) {
  return checkpoints.reduce((closest, checkpoint) => {
    if (!closest) return checkpoint;
    const currentGap = Math.abs(checkpoint.elapsedSeconds - elapsedSeconds);
    const closestGap = Math.abs(closest.elapsedSeconds - elapsedSeconds);
    return currentGap < closestGap ? checkpoint : closest;
  }, null);
}

function raceEntry({ key, label, distanceMeters, targetMeters, deltaFromCurrentMeters, isCurrent }) {
  const normalizedDistance = Math.max(0, Math.min(Number(distanceMeters) || 0, targetMeters));
  return {
    key,
    label,
    distanceMeters: normalizedDistance,
    distanceKm: normalizedDistance / 1000,
    progressPercent: Math.min(100, Math.max(0, (normalizedDistance / targetMeters) * 100)),
    deltaFromCurrentMeters,
    deltaFromCurrentKm: deltaFromCurrentMeters / 1000,
    isCurrent,
  };
}

function isYesterday(value, now) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10);
}
