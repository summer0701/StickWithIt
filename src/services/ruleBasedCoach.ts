const DEFAULT_RECENT_LIMIT = 12;

const MESSAGES = {
  ahead: [
    '좋아, 지금 최근 기록 평균보다 앞서고 있어. 이 페이스 유지해!',
    '지금 흐름 좋다. 무리하지 말고 이 리듬 그대로 가져가자.',
    '방금 과거의 너를 넘어서는 페이스야. 오늘 진짜 잘하고 있어.',
    '앞서고 있어. 욕심내지 말고 정확하게 한 걸음씩 가자.',
  ],
  behind: [
    '괜찮아. 아직 충분히 따라잡을 수 있어. 호흡만 유지하자.',
    '조금 늦어도 끝난 건 아니야. 어깨 힘 빼고 다시 리듬 잡자.',
    '지금은 회복 구간이야. 보폭보다 호흡을 먼저 안정시키자.',
    '흔들려도 괜찮아. 다음 1분만 다시 집중하자.',
  ],
  pace_drop: [
    '페이스가 조금 떨어졌어. 보폭보다 리듬을 먼저 잡자.',
    '숨이 거칠어졌다면 팔을 작게 흔들고 호흡을 길게 가져가자.',
    '급하게 만회하지 마. 리듬을 되찾는 게 먼저야.',
    '다리가 무거워도 괜찮아. 상체 힘을 빼고 다시 올라가자.',
  ],
  milestone: [
    '방금 과거의 너를 넘어섰어. 오늘 진짜 잘하고 있어.',
    '목표의 80퍼센트를 넘었어. 여기서부터 진짜 승부야.',
    '거의 다 왔어. 지금부터는 몸보다 마음이 먼저 달린다.',
    '여기까지 온 것만으로도 강해졌어. 이제 마무리하자.',
  ],
  finish_push: [
    '이제 1킬로미터 남았어. 어제의 너를 따라잡을 시간이다.',
    '1킬로미터 남았어. 지금 포기하면 어제의 너한테 진다.',
    '끝이 보인다. 호흡 하나만 더 붙잡고 밀어붙이자.',
    '이제 남은 건 버티는 힘이야. 오늘의 너를 증명할 시간이다.',
  ],
  checkpoint: [
    '좋아, 1분 지났어. 지금 흐름을 기억해.',
    '다음 1분도 지금처럼 차분하게 가자.',
    '발은 가볍게, 호흡은 길게. 끝까지 버티자.',
    '지금은 꾸준함이 이기는 구간이야. 계속 가자.',
  ],
  neutral: [
    '좋아. 지금처럼 호흡을 일정하게 유지하자.',
    '어깨 힘 빼고 시선은 앞으로. 리듬만 잃지 마.',
    '잘하고 있어. 다음 1분도 지금처럼 차분하게 가자.',
    '발은 가볍게, 호흡은 길게. 끝까지 버티자.',
  ],
};

export function ruleBasedCoach({
  currentCheckpoint,
  recentRuns = [],
  recentCheckpoints = [],
  targetDistanceMeters,
  spokenMessages = [],
}) {
  const checkpoint = normalizeCheckpoint(currentCheckpoint);
  if (!checkpoint) return buildCue('neutral', spokenMessages);

  const distanceMeters = checkpoint.distance_meters;
  const pace = checkpoint.pace_seconds_per_km;
  const targetMeters = Number(targetDistanceMeters || 0);

  if (targetMeters > 0) {
    const remainingMeters = targetMeters - distanceMeters;
    if (remainingMeters > 0 && remainingMeters <= 1000) {
      return buildCue('finish_push', spokenMessages, 100);
    }
  }

  const bestRun = findBestComparableRun(recentRuns, targetMeters);
  if (bestRun && distanceMeters >= Number(bestRun.total_distance_meters || bestRun.actual_distance_km * 1000 || 0)) {
    return buildCue('milestone', spokenMessages, 90);
  }

  const recentPaces = recentCheckpoints
    .map((item) => Number(item.pace_seconds_per_km))
    .filter((value) => Number.isFinite(value) && value > 0);
  const previousPace = recentPaces.at(-1);
  if (previousPace && pace && pace - previousPace >= 20) {
    return buildCue('pace_drop', spokenMessages, 80);
  }

  const averageComparableDistance = averageRecentDistanceAtElapsed(recentRuns, checkpoint.elapsed_seconds);
  if (averageComparableDistance > 0) {
    if (distanceMeters >= averageComparableDistance) {
      return buildCue('ahead', spokenMessages, 70);
    }
    return buildCue('behind', spokenMessages, 60);
  }

  return buildCue('checkpoint', spokenMessages, 30, checkpoint);
}

export function rememberSpokenMessage(spokenMessages, message, limit = DEFAULT_RECENT_LIMIT) {
  if (!message) return spokenMessages.slice(-limit);
  return [...spokenMessages, message].slice(-limit);
}

function buildCue(type, spokenMessages, priority = defaultPriority(type), checkpoint = null) {
  const messages = MESSAGES[type] ?? MESSAGES.neutral;
  const message = pickMessage(messages, spokenMessages, checkpoint);
  return { type, message, priority };
}

function pickMessage(messages, spokenMessages, checkpoint) {
  const elapsedMinutes = Math.max(1, Math.floor(Number(checkpoint?.elapsed_seconds ?? 60) / 60));
  const distanceMeters = Math.round(Number(checkpoint?.distance_meters ?? 0));
  const withStats = messages.map((message) =>
    message
      .replace('1분 지났어', `${elapsedMinutes}분 지났어`)
      .replace('지금 흐름을 기억해', `지금 ${distanceMeters}미터 달렸어`),
  );
  return withStats.find((message) => !spokenMessages.includes(message)) ?? withStats[(elapsedMinutes + distanceMeters) % withStats.length];
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

function averageRecentDistanceAtElapsed(recentRuns, elapsedSeconds) {
  const distances = recentRuns
    .slice(0, 5)
    .map((run) => {
      const totalDistanceMeters = Number(run.total_distance_meters ?? Number(run.actual_distance_km || 0) * 1000);
      const totalElapsedSeconds = Number(run.total_elapsed_seconds ?? run.duration_seconds);
      if (!totalDistanceMeters || !totalElapsedSeconds) return 0;
      return Math.min(totalDistanceMeters, (totalDistanceMeters / totalElapsedSeconds) * elapsedSeconds);
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (distances.length === 0) return 0;
  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

function findBestComparableRun(recentRuns, targetDistanceMeters) {
  return recentRuns
    .filter((run) => {
      if (!targetDistanceMeters) return true;
      const distance = Number(run.total_distance_meters ?? Number(run.actual_distance_km || 0) * 1000);
      return Math.abs(distance - targetDistanceMeters) <= 150;
    })
    .sort((a, b) => Number(a.total_elapsed_seconds ?? a.duration_seconds ?? Infinity) - Number(b.total_elapsed_seconds ?? b.duration_seconds ?? Infinity))[0];
}

function defaultPriority(type) {
  return {
    finish_push: 100,
    milestone: 90,
    pace_drop: 80,
    ahead: 70,
    behind: 60,
    neutral: 10,
  }[type] ?? 10;
}
