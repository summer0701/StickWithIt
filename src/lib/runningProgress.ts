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

export function buildThreeDayRankingPeriod(now = new Date(), anchor = new Date(2025, 5, 28)) {
  const current = startOfLocalDay(now);
  const anchorStart = startOfLocalDay(anchor);
  const dayIndex = Math.max(0, Math.floor((current.getTime() - anchorStart.getTime()) / 86_400_000));
  const periodStart = new Date(anchorStart);
  periodStart.setDate(anchorStart.getDate() + Math.floor(dayIndex / 3) * 3);

  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 2);

  return {
    start: periodStart,
    end: periodEnd,
    title: '3일 랭킹 기간',
    summary: `${formatKoreanDate(periodStart)} ~ ${formatKoreanDate(periodEnd)} · 3일 단위 랭킹`,
  };
}

export function formatKoreanDate(value: Date) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const date = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}.${month}.${date} (${weekdays[value.getDay()]})`;
}

function dedupeRuns(runs: RunRecordLike[]) {
  const uniqueRuns = new Map<string, RunRecordLike>();

  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `run-${index}`), run);
  });

  return Array.from(uniqueRuns.values());
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
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
