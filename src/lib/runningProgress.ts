export type RunRecordLike = Record<string, any>;

export function buildRunningProgress({
  targetDistanceKm,
  todayRunningKm,
  yesterdayBestRunningKm,
}: {
  targetDistanceKm: number;
  todayRunningKm: number;
  yesterdayBestRunningKm: number;
}) {
  const fallbackTargetKm = Number(targetDistanceKm || 10);
  const hasYesterdayBest = Number.isFinite(yesterdayBestRunningKm) && yesterdayBestRunningKm > 0;
  const targetValue = hasYesterdayBest ? yesterdayBestRunningKm : fallbackTargetKm;
  const isYesterdayRecord = hasYesterdayBest && todayRunningKm > yesterdayBestRunningKm;

  return {
    goalLabel: `${targetValue.toFixed(hasYesterdayBest ? 2 : 1)}km`,
    recordLabel: `${todayRunningKm.toFixed(2)}km`,
    targetValue,
    currentValue: todayRunningKm,
    statusLabel: isYesterdayRecord ? '어제 대비 신기록' : undefined,
  };
}

export function achievementRate(currentValue: number, targetValue: number) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) return 0;
  return Math.max(0, Math.round((currentValue / targetValue) * 100));
}

export function bestCompletedRunDistanceKmOnDate(runs: RunRecordLike[], dateKey: string) {
  return Math.max(
    0,
    ...dedupeRuns(runs)
      .filter((run) => isCompletedOnDate(run, dateKey))
      .map(runDistanceKm),
  );
}

export function sumCompletedRunDistanceKmOnDate(runs: RunRecordLike[], dateKey: string) {
  return dedupeRuns(runs)
    .filter((run) => isCompletedOnDate(run, dateKey))
    .reduce((sum, run) => sum + runDistanceKm(run), 0);
}

export function dateKeyForDaysAgo(daysAgo: number, now = new Date()) {
  const value = new Date(now);
  value.setDate(value.getDate() - daysAgo);
  return value.toISOString().slice(0, 10);
}

function dedupeRuns(runs: RunRecordLike[]) {
  const uniqueRuns = new Map<string, RunRecordLike>();

  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `run-${index}`), run);
  });

  return Array.from(uniqueRuns.values());
}

function isCompletedOnDate(run: RunRecordLike, dateKey: string) {
  const runDateKey = String(run.ended_at ?? run.started_at ?? run.created_at ?? '').slice(0, 10);
  if (runDateKey !== dateKey) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

function runDistanceKm(run: RunRecordLike) {
  const meters = Number(run.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const km = Number(run.actual_distance_km);
  return Number.isFinite(km) && km > 0 ? km : 0;
}
