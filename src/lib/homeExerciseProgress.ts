import { normalizeExerciseRecordType, type ExerciseRecord } from './exerciseRecords';

export type RunLike = Record<string, any>;

export type ExerciseProgressValues = {
  runningKm: number;
  squatReps: number;
  jumpingJackReps: number;
  pushupReps: number;
  lungeReps: number;
};

export function buildDailyExerciseProgress({
  runs = [],
  exerciseRecords = [],
  dateKey = dateKeyFor(new Date()),
}: {
  runs?: RunLike[];
  exerciseRecords?: ExerciseRecord[];
  dateKey?: string;
}): ExerciseProgressValues {
  const todayRecords = dedupeExerciseRecords(exerciseRecords).filter((record) => isExerciseRecordOnDate(record, dateKey));

  return {
    runningKm: sumCompletedRunDistanceKmOnDate(runs, dateKey),
    squatReps: sumRecordMetric(todayRecords, 'squat', 'reps'),
    jumpingJackReps: sumRecordMetric(todayRecords, 'jumping-jack', 'reps'),
    pushupReps: sumRecordMetric(todayRecords, 'push-up', 'reps'),
    lungeReps: sumRecordMetric(todayRecords, 'lunge', 'reps'),
  };
}

export function formatExerciseValue(value: number, unit: 'km' | '회' | '초') {
  if (unit === 'km') return `${value.toFixed(2)}km`;
  if (unit === '초') return formatSeconds(value);
  return `${Math.round(value)}회`;
}

function sumRecordMetric(records: ExerciseRecord[], type: string, metric: keyof ExerciseRecord) {
  return records
    .filter((record) => normalizeExerciseRecordType(record.type) === type && record.completed)
    .reduce((sum, record) => sum + Number(record[metric] ?? 0), 0);
}

function sumCompletedRunDistanceKmOnDate(runs: RunLike[], dateKey: string) {
  return dedupeRuns(runs)
    .filter((run) => isCompletedRunOnDate(run, dateKey))
    .reduce((sum, run) => sum + runDistanceKm(run), 0);
}

function dedupeRuns(runs: RunLike[]) {
  const uniqueRuns = new Map<string, RunLike>();
  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `run-${index}`), run);
  });
  return [...uniqueRuns.values()];
}

function dedupeExerciseRecords(records: ExerciseRecord[]) {
  const uniqueRecords = new Map<string, ExerciseRecord>();
  records.forEach((record, index) => {
    uniqueRecords.set(String(record.id ?? `${record.type}-${index}`), record);
  });
  return [...uniqueRecords.values()];
}

function isCompletedRunOnDate(run: RunLike, targetDateKey: string) {
  const runDateKey = String(run.ended_at ?? run.started_at ?? run.created_at ?? '').slice(0, 10);
  if (runDateKey !== targetDateKey) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

function isExerciseRecordOnDate(record: ExerciseRecord, targetDateKey: string) {
  if (!record.completed) return false;
  return String(record.completedAt ?? '').slice(0, 10) === targetDateKey;
}

function runDistanceKm(run: RunLike) {
  const meters = Number(run.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const km = Number(run.actual_distance_km);
  return Number.isFinite(km) && km > 0 ? km : 0;
}

function formatSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

function dateKeyFor(date: Date) {
  return date.toISOString().slice(0, 10);
}
