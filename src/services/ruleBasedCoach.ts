import { runningCoachPhrases } from '../data/runningCoachPhrases';
import { applyGhostSettingsToRunners, defaultGhostDifficulty, defaultGhostSettings, ghostDifficultyTargetKm } from '../lib/ghostSettings';
import { createHeuristicGhostPack, ghostPackRouteToRunner } from '../lib/naturalGhostPack';

const DEFAULT_RECENT_LIMIT = 12;
const CLOSE_GHOST_METERS = 30;
const GHOST_EVENT_METERS = 10;

const GHOST_LABELS = {
  bestGhost: '워스트 고스트',
  averageGhost: '쉬운 고스트',
  stableGhost: '평균 고스트',
  chaserGhost: '도전 고스트',
  slowGhost: '베스트 고스트',
};

const GHOST_PRIORITY = [
  'slowGhost',
  'chaserGhost',
  'stableGhost',
  'averageGhost',
  'bestGhost',
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

  const ghosts = ghostRunners ?? buildGhostRunners(
    recentRuns,
    recentCheckpoints,
    new Date(),
    defaultGhostSettings(),
    targetMeters > 0 ? targetMeters / 1000 : null,
  );
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
  ghostDifficulty = defaultGhostDifficulty(),
) {
  const runs = recentRuns
    .filter(isCompletedRun)
    .map((run) => normalizeRun(run, recentCheckpoints))
    .filter(Boolean);

  const difficulty = defaultGhostDifficultySafe(ghostDifficulty);
  const defaultRunners = createHeuristicGhostPack({
    difficulty: difficulty.difficulty,
    targetDistanceKm: targetDistanceKm ?? ghostDifficultyTargetKm(difficulty),
    customDistanceKm: difficulty.customDistanceKm,
    seed: `${now.getTime?.() ?? Date.now()}:${targetDistanceKm ?? ''}`,
  }).map(ghostPackRouteToRunner);

  if (runs.length === 0) {
    return applyGhostSettingsToRunners({
      runners: defaultRunners,
      settings: ghostSettings,
      targetDistanceKm: targetDistanceKm ?? ghostDifficultyTargetKm(difficulty),
    });
  }

  const byStartedAtDesc = [...runs].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const byPaceAsc = [...runs].sort((a, b) => a.paceSecondsPerKm - b.paceSecondsPerKm);
  const bestRun = byPaceAsc[0];
  const slowRun = byPaceAsc[byPaceAsc.length - 1];
  const latestRun = byStartedAtDesc[0];
  const runnersByKey = new Map(defaultRunners.map((runner) => [runner.key, runner]));

  if (runs.length >= 1) runnersByKey.set('chaserGhost', ghostFromRun('chaserGhost', latestRun, 'latest_user_run'));
  if (runs.length >= 2) runnersByKey.set('stableGhost', buildAverageGhost(runs, 'stableGhost', 'average_user_run'));
  if (runs.length >= 3) runnersByKey.set('slowGhost', ghostFromRun('slowGhost', bestRun, 'personal_best'));
  if (runs.length >= 5) runnersByKey.set('bestGhost', ghostFromRun('bestGhost', slowRun, 'personal_worst'));
  if (runs.length >= 7) runnersByKey.set('averageGhost', buildAdjustedStableGhost(runs));

  const mixedRunners = GHOST_PRIORITY.map((key) => runnersByKey.get(key)).filter(Boolean);

  return applyGhostSettingsToRunners({
    runners: mixedRunners,
    settings: ghostSettings,
    targetDistanceKm,
  });
}

function isCompletedRun(run) {
  if (!run) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

function defaultGhostDifficultySafe(value) {
  return value && typeof value === 'object' ? value : defaultGhostDifficulty();
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

  if (selected.key === 'slowGhost' && selected.deltaMeters > CLOSE_GHOST_METERS) {
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

  const rawCheckpoints = recentCheckpoints
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
    checkpoints: interpolateRunCheckpoints(rawCheckpoints, elapsedSeconds, distanceMeters),
  };
}

function ghostFromRun(key, run, source = 'latest_user_run') {
  if (!run) return null;
  return {
    key,
    label: GHOST_LABELS[key],
    source,
    sourceRunId: run.id,
    totalDistanceMeters: run.totalDistanceMeters,
    totalElapsedSeconds: run.totalElapsedSeconds,
    avgSpeedKmh: runAverageSpeedKmh(run),
    targetTime: formatClock(run.totalElapsedSeconds),
    pace: `${formatClock(run.paceSecondsPerKm)}/km`,
    points: checkpointsToPoints(run.checkpoints),
    checkpoints: run.checkpoints,
    preservePace: true,
  };
}

function runToBaseGhost(run) {
  const checkpoints = interpolateRunCheckpoints(run.checkpoints, run.totalElapsedSeconds, run.totalDistanceMeters);

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

function interpolateRunCheckpoints(checkpoints = [], totalElapsedSeconds, totalDistanceMeters) {
  const totalElapsed = Math.max(1, Number(totalElapsedSeconds) || 1);
  const totalDistance = Math.max(0, Number(totalDistanceMeters) || 0);
  const anchors = [
    { elapsedSeconds: 0, distanceMeters: 0 },
    ...checkpoints
      .map((checkpoint) => ({
        elapsedSeconds: Math.max(0, Number(checkpoint.elapsedSeconds) || 0),
        distanceMeters: Math.max(0, Number(checkpoint.distanceMeters) || 0),
      }))
      .filter((checkpoint) => checkpoint.elapsedSeconds > 0 && checkpoint.elapsedSeconds < totalElapsed),
    { elapsedSeconds: totalElapsed, distanceMeters: totalDistance },
  ]
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
    .reduce((items, checkpoint) => {
      const previous = items[items.length - 1];
      const distanceMeters = Math.max(previous?.distanceMeters ?? 0, checkpoint.distanceMeters);
      if (previous && Math.abs(previous.elapsedSeconds - checkpoint.elapsedSeconds) < 1) {
        items[items.length - 1] = { elapsedSeconds: previous.elapsedSeconds, distanceMeters };
      } else {
        items.push({ elapsedSeconds: checkpoint.elapsedSeconds, distanceMeters });
      }
      return items;
    }, []);

  const interpolated = [];
  for (let elapsedSeconds = 0; elapsedSeconds < totalElapsed; elapsedSeconds += 60) {
    interpolated.push({
      elapsedSeconds,
      distanceMeters: Number(distanceAtInterpolatedElapsed(anchors, elapsedSeconds).toFixed(3)),
    });
  }

  if (interpolated[interpolated.length - 1]?.elapsedSeconds !== totalElapsed) {
    interpolated.push({ elapsedSeconds: totalElapsed, distanceMeters: totalDistance });
  }

  return interpolated;
}

function distanceAtInterpolatedElapsed(points, elapsedSeconds) {
  const after = points.find((point) => point.elapsedSeconds >= elapsedSeconds);
  if (!after) return points[points.length - 1]?.distanceMeters ?? 0;
  if (after.elapsedSeconds === elapsedSeconds) return after.distanceMeters;

  const before = [...points].reverse().find((point) => point.elapsedSeconds < elapsedSeconds);
  if (!before) {
    if (elapsedSeconds <= 0) return 0;
    if (after.elapsedSeconds <= 0) return after.distanceMeters;
    return after.distanceMeters * (elapsedSeconds / after.elapsedSeconds);
  }

  const span = after.elapsedSeconds - before.elapsedSeconds;
  if (span <= 0) return before.distanceMeters;
  const ratio = (elapsedSeconds - before.elapsedSeconds) / span;
  return before.distanceMeters + (after.distanceMeters - before.distanceMeters) * ratio;
}

function buildAverageGhost(runs, key = 'stableGhost', source = 'average_user_run') {
  const totalElapsedSeconds = runs.reduce((sum, run) => sum + run.totalElapsedSeconds, 0);
  const totalDistanceMeters = runs.reduce((sum, run) => sum + run.totalDistanceMeters, 0);
  const combinedSpeedMetersPerSecond = totalDistanceMeters / totalElapsedSeconds;
  const averageElapsedSeconds = totalElapsedSeconds / runs.length;
  const distanceMeters = combinedSpeedMetersPerSecond * averageElapsedSeconds;
  return {
    key,
    label: GHOST_LABELS[key],
    source,
    totalDistanceMeters: distanceMeters,
    totalElapsedSeconds: averageElapsedSeconds,
    avgSpeedKmh: Number((combinedSpeedMetersPerSecond * 3.6).toFixed(2)),
    targetTime: formatClock(averageElapsedSeconds),
    pace: `${formatClock(averageElapsedSeconds / (distanceMeters / 1000))}/km`,
    checkpoints: [],
    preservePace: true,
  };
}

function buildAdjustedStableGhost(runs) {
  const averageGhost = buildAverageGhost(runs, 'averageGhost', 'adjusted_from_user_data');
  const slowdownRatio = 1.09;
  const elapsedSeconds = averageGhost.totalElapsedSeconds * slowdownRatio;
  return {
    ...averageGhost,
    totalElapsedSeconds: elapsedSeconds,
    avgSpeedKmh: Number((averageGhost.avgSpeedKmh / slowdownRatio).toFixed(2)),
    targetTime: formatClock(elapsedSeconds),
    pace: `${formatClock(elapsedSeconds / (averageGhost.totalDistanceMeters / 1000))}/km`,
  };
}

function runAverageSpeedKmh(run) {
  return Number(((run.totalDistanceMeters / 1000) / (run.totalElapsedSeconds / 3600)).toFixed(2));
}

function checkpointsToPoints(checkpoints = []) {
  return checkpoints.map((checkpoint) => ({
    minute: Number((checkpoint.elapsedSeconds / 60).toFixed(3)),
    distanceM: Math.round(checkpoint.distanceMeters),
  }));
}

function formatClock(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function distanceAtElapsed(ghost, elapsedSeconds) {
  const checkpoints = ghost.checkpoints ?? [];
  if (checkpoints.length > 0) {
    return distanceAtInterpolatedElapsed(checkpoints, elapsedSeconds);
  }

  if (!ghost.totalElapsedSeconds || !ghost.totalDistanceMeters) return null;
  return Math.min(ghost.totalDistanceMeters, (ghost.totalDistanceMeters / ghost.totalElapsedSeconds) * elapsedSeconds);
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
