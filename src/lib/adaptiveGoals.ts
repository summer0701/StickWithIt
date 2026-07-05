import { normalizeExerciseRecordType, type ExerciseRecord } from './exerciseRecords';

export type AdaptiveGoalType = 'running' | 'squat' | 'jumping-jack' | 'push-up' | 'lunge';
export type AdaptiveGoalTrend = 'up' | 'same' | 'down';

export type AdaptiveGoalResult = {
  type: AdaptiveGoalType;
  value: number;
  base: number;
  previousGoal: number;
  yesterdayValue: number;
  completionRate: number | null;
  trend: AdaptiveGoalTrend;
};

export type RunLike = Record<string, any>;

const INITIAL_GOALS: Record<AdaptiveGoalType, number> = {
  running: 2,
  squat: 20,
  lunge: 20,
  'push-up': 10,
  'jumping-jack': 25,
};

const REP_GOAL_LIMITS = { min: 10, max: 500 };
const RUNNING_GOAL_LIMITS = { min: 1, max: 100 };
const RECENT_DAYS = 7;
const STORAGE_PREFIX = 'stickWithIt:adaptive-goals:';

export function calculateAdaptiveGoal({
  type,
  recentValues = [],
  yesterdayValue = 0,
  previousGoal,
}: {
  type: AdaptiveGoalType;
  recentValues?: number[];
  yesterdayValue?: number;
  previousGoal?: number;
}): AdaptiveGoalResult {
  const initialGoal = INITIAL_GOALS[type];
  const activeValues = recentValues.filter((value) => Number.isFinite(value) && value > 0);
  const base = activeValues.length > 0
    ? average(activeValues)
    : initialGoal;
  const normalizedPreviousGoal = normalizeGoal(previousGoal ?? base, type);
  const normalizedYesterdayValue = Number.isFinite(yesterdayValue) && yesterdayValue > 0 ? Number(yesterdayValue) : 0;
  const hasYesterdayWorkout = normalizedYesterdayValue > 0;
  const completionRate = hasYesterdayWorkout && normalizedPreviousGoal > 0
    ? normalizedYesterdayValue / normalizedPreviousGoal
    : null;
  const multiplier = completionRate == null ? 1 : goalMultiplier(completionRate);
  const trend = multiplier > 1 ? 'up' : multiplier < 1 ? 'down' : 'same';
  const value = normalizeGoal(base * multiplier, type);

  return {
    type,
    value,
    base: normalizeGoal(base, type),
    previousGoal: normalizedPreviousGoal,
    yesterdayValue: Number(normalizedYesterdayValue.toFixed(3)),
    completionRate,
    trend,
  };
}

export function buildAdaptiveGoalSet({
  runs = [],
  exerciseRecords = [],
  previousGoals = {},
  now = new Date(),
  debug = false,
}: {
  runs?: RunLike[];
  exerciseRecords?: ExerciseRecord[];
  previousGoals?: Partial<Record<AdaptiveGoalType, number>>;
  now?: Date;
  debug?: boolean;
}) {
  const dateKeys = recentDateKeys(now);
  const yesterdayKey = dateKeys[0];
  const goals = ADAPTIVE_GOAL_TYPES.reduce((result, type) => {
    const valuesByDate = type === 'running'
      ? collectRunValuesByDate(runs, dateKeys)
      : collectExerciseValuesByDate(exerciseRecords, type, dateKeys);
    const recentValues = dateKeys.map((dateKey) => valuesByDate.get(dateKey) ?? 0);
    const goal = calculateAdaptiveGoal({
      type,
      recentValues,
      yesterdayValue: valuesByDate.get(yesterdayKey) ?? 0,
      previousGoal: previousGoals[type],
    });
    if (debug) logAdaptiveGoal(goal);
    result[type] = goal;
    return result;
  }, {} as Record<AdaptiveGoalType, AdaptiveGoalResult>);

  return goals;
}

export function readAdaptiveGoalSnapshot(userId: string, dateKey: string): Partial<Record<AdaptiveGoalType, number>> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId, dateKey));
    return raw ? JSON.parse(raw) : {};
  } catch {
    window.localStorage.removeItem(storageKey(userId, dateKey));
    return {};
  }
}

export function writeAdaptiveGoalSnapshot(
  userId: string,
  dateKey: string,
  goals: Record<AdaptiveGoalType, AdaptiveGoalResult>,
) {
  if (!canUseLocalStorage()) return;
  const snapshot = ADAPTIVE_GOAL_TYPES.reduce((result, type) => {
    result[type] = goals[type].value;
    return result;
  }, {} as Record<AdaptiveGoalType, number>);
  window.localStorage.setItem(storageKey(userId, dateKey), JSON.stringify(snapshot));
}

export function formatAdaptiveGoalValue(goal: AdaptiveGoalResult) {
  if (goal.type === 'running') return `${goal.value}km`;
  return `${goal.value}회`;
}

export const ADAPTIVE_GOAL_TYPES: AdaptiveGoalType[] = ['running', 'squat', 'jumping-jack', 'push-up', 'lunge'];

function goalMultiplier(completionRate: number) {
  if (completionRate >= 1.3) return 1.15;
  if (completionRate >= 1) return 1.05;
  if (completionRate >= 0.7) return 1;
  return 0.9;
}

function normalizeGoal(value: number, type: AdaptiveGoalType) {
  const limits = type === 'running' ? RUNNING_GOAL_LIMITS : REP_GOAL_LIMITS;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return INITIAL_GOALS[type];
  return Math.min(limits.max, Math.max(limits.min, Math.round(numeric)));
}

function recentDateKeys(now: Date) {
  return Array.from({ length: RECENT_DAYS }, (_, index) => dateKeyForDaysAgo(index + 1, now));
}

export function dateKeyForDaysAgo(daysAgo: number, now = new Date()) {
  const value = new Date(now);
  value.setDate(value.getDate() - daysAgo);
  return value.toISOString().slice(0, 10);
}

function collectExerciseValuesByDate(records: ExerciseRecord[], type: AdaptiveGoalType, dateKeys: string[]) {
  const acceptedDates = new Set(dateKeys);
  const values = new Map<string, number>();
  records.forEach((record) => {
    if (!record.completed || normalizeExerciseRecordType(record.type) !== type) return;
    const dateKey = String(record.completedAt ?? '').slice(0, 10);
    if (!acceptedDates.has(dateKey)) return;
    values.set(dateKey, (values.get(dateKey) ?? 0) + Number(record.reps ?? 0));
  });
  return values;
}

function collectRunValuesByDate(runs: RunLike[], dateKeys: string[]) {
  const acceptedDates = new Set(dateKeys);
  const values = new Map<string, number>();
  dedupeRuns(runs).forEach((run) => {
    if (!isCompletedRun(run)) return;
    const dateKey = String(run.ended_at ?? run.started_at ?? run.created_at ?? '').slice(0, 10);
    if (!acceptedDates.has(dateKey)) return;
    values.set(dateKey, (values.get(dateKey) ?? 0) + runDistanceKm(run));
  });
  return values;
}

function dedupeRuns(runs: RunLike[]) {
  const uniqueRuns = new Map<string, RunLike>();
  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `run-${index}`), run);
  });
  return [...uniqueRuns.values()];
}

function isCompletedRun(run: RunLike) {
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

function runDistanceKm(run: RunLike) {
  const meters = Number(run.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;
  const km = Number(run.actual_distance_km);
  return Number.isFinite(km) && km > 0 ? km : 0;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function logAdaptiveGoal(goal: AdaptiveGoalResult) {
  console.debug('[adaptive-goal]', {
    type: goal.type,
    value: goal.value,
    base: goal.base,
    previousGoal: goal.previousGoal,
    yesterdayValue: goal.yesterdayValue,
    completionRate: goal.completionRate,
    trend: goal.trend,
  });
}

function storageKey(userId: string, dateKey: string) {
  return `${STORAGE_PREFIX}${userId || 'anonymous'}:${dateKey}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
