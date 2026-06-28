const DEFAULT_RECENT_LIMIT = 12;
const CLOSE_GHOST_METERS = 15;

const GHOST_LABELS = {
  yesterdayGhost: '어제의 나',
  bestGhost: '최고기록의 나',
  averageGhost: '평균 페이스의 나',
  recentGhost: '최근의 나',
  slowGhost: '끝까지 버틴 나',
};

const GHOST_PRIORITY = [
  'passed',
  'passed_by',
  'closest',
  'bestGhost',
  'yesterdayGhost',
  'averageGhost',
];

const FINISH_MESSAGES = [
  '1킬로미터 남았어. 지금 포기하면 어제의 너한테 진다.',
  '마지막 1킬로미터야. 다리는 무거워도 리듬은 아직 살아 있어.',
  '끝이 보인다. 호흡 하나만 더 붙잡고 밀어붙이자.',
  '이제 남은 건 버티는 힘이야. 오늘의 너를 증명할 시간이다.',
];

export function ruleBasedCoach({
  currentCheckpoint,
  recentRuns = [],
  recentCheckpoints = [],
  targetDistanceMeters = 0,
  spokenMessages = [],
}) {
  const checkpoint = normalizeCheckpoint(currentCheckpoint);
  if (!checkpoint) return buildCue('neutral', '지금 너는 5명의 과거의 너와 달리고 있다.', 10, spokenMessages);

  const targetMeters = Number(targetDistanceMeters || 0);
  if (targetMeters > 0) {
    const remainingMeters = targetMeters - checkpoint.distance_meters;
    if (remainingMeters > 0 && remainingMeters <= 1000) {
      return buildCue('finish_push', pickFresh(FINISH_MESSAGES, spokenMessages, checkpoint), 100, spokenMessages);
    }
  }

  const ghosts = buildGhostRunners(recentRuns, recentCheckpoints);
  const ghostCue = createGhostCue(checkpoint, ghosts, spokenMessages);
  if (ghostCue) return ghostCue;

  const elapsedMinutes = Math.max(1, Math.floor(checkpoint.elapsed_seconds / 60));
  return buildCue(
    'checkpoint',
    `좋아, ${elapsedMinutes}분 지났어. 지금 ${Math.round(checkpoint.distance_meters)}미터 달렸어. 과거의 너들을 하나씩 넘어서자.`,
    30,
    spokenMessages,
  );
}

export function buildGhostRunners(recentRuns = [], recentCheckpoints = [], now = new Date()) {
  const runs = recentRuns
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

export function createGhostCue(checkpoint, ghosts = [], spokenMessages = []) {
  const comparisons = compareGhosts(checkpoint, ghosts);
  if (comparisons.length === 0) return null;

  const passed = comparisons.find((ghost) => ghost.deltaMeters >= 0 && ghost.deltaMeters <= CLOSE_GHOST_METERS);
  if (passed) {
    return buildCue(
      'passed',
      `${passed.label}를 방금 잡았다. 오늘의 너가 과거의 너들을 하나씩 넘어서고 있다.`,
      95,
      spokenMessages,
    );
  }

  const passedBy = comparisons.find((ghost) => ghost.deltaMeters < 0 && Math.abs(ghost.deltaMeters) <= CLOSE_GHOST_METERS);
  if (passedBy) {
    return buildCue(
      'passed_by',
      `${passedBy.label}가 바로 앞 ${Math.abs(Math.round(passedBy.deltaMeters))}미터다. 다음 1분 안에 잡을 수 있어.`,
      90,
      spokenMessages,
    );
  }

  const closest = [...comparisons].sort((a, b) => Math.abs(a.deltaMeters) - Math.abs(b.deltaMeters))[0];
  const priorityGhost =
    pickPriorityGhost(comparisons, closest) ?? closest;

  return buildCue('ghost', buildGhostMessage(priorityGhost), priorityForGhost(priorityGhost), spokenMessages);
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

function buildCue(type, message, priority, spokenMessages) {
  if (!spokenMessages.includes(message)) return { type, message, priority };
  return { type, message: `${message} 계속 가자.`, priority };
}

function pickFresh(messages, spokenMessages, checkpoint) {
  const elapsedMinutes = Math.max(1, Math.floor(Number(checkpoint?.elapsed_seconds ?? 60) / 60));
  const distanceMeters = Math.round(Number(checkpoint?.distance_meters ?? 0));
  const withStats = messages.map((message) =>
    message
      .replace('1분 지났어', `${elapsedMinutes}분 지났어`)
      .replace('지금 흐름을 기억해', `지금 ${distanceMeters}미터의 흐름을 기억해`),
  );
  return withStats.find((message) => !spokenMessages.includes(message)) ?? withStats[(elapsedMinutes + distanceMeters) % withStats.length];
}

function buildGhostMessage(ghost) {
  const meters = Math.abs(Math.round(ghost.deltaMeters));
  if (ghost.deltaMeters >= 0) {
    if (ghost.key === 'slowGhost') return `끝까지 버틴 나는 ${meters}미터 뒤에 있어. 오늘 컨디션 좋다.`;
    if (ghost.key === 'averageGhost') return `평균 페이스의 너는 ${meters}미터 뒤에 있다. 오늘의 네가 앞선다.`;
    return `${ghost.label}는 ${meters}미터 뒤에 있어. 오늘의 네가 앞선다.`;
  }

  if (ghost.key === 'bestGhost') return `최고기록의 너는 아직 ${meters}미터 앞에 있어. 하지만 격차가 줄고 있다.`;
  if (meters <= 30) return `${ghost.label}가 바로 앞 ${meters}미터다. 다음 1분 안에 잡을 수 있어.`;
  return `${ghost.label}는 아직 ${meters}미터 앞에 있어. 리듬을 지키면 따라간다.`;
}

function pickPriorityGhost(comparisons, closest) {
  for (const priority of GHOST_PRIORITY.slice(3)) {
    const ghost = comparisons.find((item) => item.key === priority);
    if (ghost) return ghost;
  }
  return closest;
}

function priorityForGhost(ghost) {
  return {
    bestGhost: 80,
    yesterdayGhost: 70,
    averageGhost: 60,
  }[ghost.key] ?? 50;
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
