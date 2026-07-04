import { normalizeExerciseRecordType, type ExerciseRecord } from './exerciseRecords';
import { contributionScoreForRecord } from './neighborhoodRanking';

export type HistoryRunLike = Record<string, any>;

export type HistoryWorkout = {
  id: string;
  type: string;
  label: string;
  completedAt: string;
  durationSeconds: number;
  reps: number;
  distanceKm: number;
  calories: number;
  contribution: number;
};

export type HistoryDashboard = {
  workouts: HistoryWorkout[];
  today: {
    completed: boolean;
    count: number;
    minutes: number;
    calories: number;
    remainingGoal: number;
  };
  totals: {
    workoutCount: number;
    durationSeconds: number;
    streakDays: number;
    bestStreakDays: number;
    calories: number;
    distanceKm: number;
  };
  weeklyGoal: {
    completedDays: number;
    targetDays: number;
    percent: number;
  };
  comparison: {
    durationPercent: number;
    caloriesPercent: number;
    workoutDelta: number;
  };
  exerciseStats: ExerciseHistoryStat[];
  heatmap: HeatmapDay[];
  weeklyBars: ChartPoint[];
  monthlyTrend: ChartPoint[];
  timeline: TimelineGroup[];
  personalRecords: PersonalRecord[];
  badges: BadgeSummary[];
  capsules: HistoryWorkout[];
  neighborhood: {
    contribution: number;
    rank: number;
  };
};

export type ExerciseHistoryStat = {
  type: string;
  label: string;
  icon: string;
  count: number;
  totalLabel: string;
  bestLabel: string;
  averageLabel: string;
  recentLabel: string;
};

export type HeatmapDay = {
  dateKey: string;
  day: number;
  count: number;
  intensity: number;
  workouts: HistoryWorkout[];
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type TimelineGroup = {
  dateKey: string;
  label: string;
  workouts: HistoryWorkout[];
};

export type PersonalRecord = {
  type: string;
  label: string;
  valueLabel: string;
};

export type BadgeSummary = {
  label: string;
  achieved: boolean;
};

const DAILY_GOAL_COUNT = 1;
const WEEKLY_GOAL_DAYS = 7;

const EXERCISES = [
  { type: 'running', label: 'Running', icon: '🏃', metric: 'distance' },
  { type: 'push-up', label: 'Push-up', icon: '💪', metric: 'reps' },
  { type: 'squat', label: 'Squat', icon: '🏋️', metric: 'reps' },
  { type: 'lunge', label: 'Lunge', icon: '🦵', metric: 'reps' },
  { type: 'jumping-jack', label: 'Jumping Jack', icon: '⚡', metric: 'reps' },
] as const;

const EXERCISE_BY_TYPE = new Map<string, typeof EXERCISES[number]>(EXERCISES.map((exercise) => [exercise.type, exercise]));

export function buildHistoryDashboard({
  exerciseRecords = [],
  runs = [],
  now = new Date(),
}: {
  exerciseRecords?: ExerciseRecord[];
  runs?: HistoryRunLike[];
  now?: Date;
}): HistoryDashboard {
  const workouts = [
    ...runs.map(runToWorkout).filter(Boolean),
    ...exerciseRecords.map(exerciseRecordToWorkout).filter(Boolean),
  ]
    .filter((workout): workout is HistoryWorkout => Boolean(workout))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

  const todayKey = dateKey(now);
  const todayWorkouts = workouts.filter((workout) => dateKey(workout.completedAt) === todayKey);
  const activeDateKeys = uniqueDateKeys(workouts);
  const streak = calculateStreak(activeDateKeys, todayKey);
  const bestStreak = calculateBestStreak(activeDateKeys);
  const weeklyBars = buildWeeklyBars(workouts, now);
  const completedWeekDays = weeklyBars.filter((point) => point.value > 0).length;
  const contribution = sum(workouts.map((workout) => workout.contribution));

  return {
    workouts,
    today: {
      completed: todayWorkouts.length > 0,
      count: todayWorkouts.length,
      minutes: Math.round(sum(todayWorkouts.map((workout) => workout.durationSeconds)) / 60),
      calories: sum(todayWorkouts.map((workout) => workout.calories)),
      remainingGoal: Math.max(0, DAILY_GOAL_COUNT - todayWorkouts.length),
    },
    totals: {
      workoutCount: workouts.length,
      durationSeconds: sum(workouts.map((workout) => workout.durationSeconds)),
      streakDays: streak,
      bestStreakDays: bestStreak,
      calories: sum(workouts.map((workout) => workout.calories)),
      distanceKm: sum(workouts.map((workout) => workout.distanceKm)),
    },
    weeklyGoal: {
      completedDays: completedWeekDays,
      targetDays: WEEKLY_GOAL_DAYS,
      percent: Math.round((completedWeekDays / WEEKLY_GOAL_DAYS) * 100),
    },
    comparison: buildComparison(workouts, now),
    exerciseStats: EXERCISES.map((exercise) => buildExerciseStat(exercise, workouts)),
    heatmap: buildMonthHeatmap(workouts, now),
    weeklyBars,
    monthlyTrend: buildMonthlyTrend(workouts, now),
    timeline: buildTimeline(workouts),
    personalRecords: buildPersonalRecords(workouts),
    badges: buildBadges(workouts, streak),
    capsules: workouts.slice(0, 12),
    neighborhood: {
      contribution,
      rank: Math.max(1, 42 - Math.floor(contribution / 200)),
    },
  };
}

export function filterHistoryWorkouts(workouts: HistoryWorkout[], {
  type = 'all',
  query = '',
  sort = 'latest',
}: {
  type?: string;
  query?: string;
  sort?: 'latest' | 'oldest' | 'duration' | 'volume' | 'calories';
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = workouts
    .filter((workout) => type === 'all' || workout.type === type)
    .filter((workout) => {
      if (!normalizedQuery) return true;
      const haystack = [
        workout.label,
        dateKey(workout.completedAt),
        `${workout.reps}`,
        `${workout.distanceKm}`,
        `${workout.durationSeconds}`,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });

  return [...filtered].sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.completedAt) - Date.parse(b.completedAt);
    if (sort === 'duration') return b.durationSeconds - a.durationSeconds;
    if (sort === 'volume') return workoutVolume(b) - workoutVolume(a);
    if (sort === 'calories') return b.calories - a.calories;
    return Date.parse(b.completedAt) - Date.parse(a.completedAt);
  });
}

export function formatHistoryDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

export function dateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function exerciseRecordToWorkout(record: ExerciseRecord): HistoryWorkout | null {
  if (!record.completed) return null;
  const completedAt = record.completedAt ?? new Date().toISOString();
  const type = normalizeExerciseRecordType(record.type);
  const durationSeconds = finite(record.durationSeconds);
  const reps = finite(record.reps);
  const distanceKm = finite(record.distanceKm);
  const calories = estimateCalories({ type, durationSeconds, reps, distanceKm });
  const normalizedRecord = { ...record, type, completedAt, durationSeconds, reps, distanceKm };
  return {
    id: record.id ?? `${type}-${completedAt}`,
    type,
    label: exerciseLabel(type),
    completedAt,
    durationSeconds,
    reps,
    distanceKm,
    calories,
    contribution: contributionScoreForRecord(normalizedRecord),
  };
}

function runToWorkout(run: HistoryRunLike): HistoryWorkout | null {
  const completedAt = run.ended_at ?? run.started_at ?? run.created_at;
  if (!completedAt || (run.status != null && run.status !== 'completed')) return null;
  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return null;

  const durationSeconds = finite(run.total_elapsed_seconds ?? run.duration_seconds);
  const distanceKm = runDistanceKm(run);
  const type = 'running';
  const calories = estimateCalories({ type, durationSeconds, reps: 0, distanceKm });
  const recordLike: ExerciseRecord = {
    id: String(run.id ?? `run-${completedDate.toISOString()}`),
    userId: String(run.user_id ?? 'unknown'),
    type,
    completed: true,
    completedAt: completedDate.toISOString(),
    durationSeconds,
    distanceKm,
  };
  return {
    id: recordLike.id ?? `run-${completedDate.toISOString()}`,
    type,
    label: exerciseLabel(type),
    completedAt: completedDate.toISOString(),
    durationSeconds,
    reps: 0,
    distanceKm,
    calories,
    contribution: contributionScoreForRecord(recordLike),
  };
}

function buildExerciseStat(exercise: typeof EXERCISES[number], workouts: HistoryWorkout[]): ExerciseHistoryStat {
  const items = workouts.filter((workout) => workout.type === exercise.type);
  const values = items.map((workout) => exercise.metric === 'distance' ? workout.distanceKm : workout.reps).filter((value) => value > 0);
  const total = sum(values);
  const best = values.length ? Math.max(...values) : 0;
  const average = values.length ? total / values.length : 0;
  const recent = items[0]?.completedAt;

  return {
    type: exercise.type,
    label: exercise.label,
    icon: exercise.icon,
    count: items.length,
    totalLabel: exercise.metric === 'distance' ? `${total.toFixed(1)}km` : `${Math.round(total)}회`,
    bestLabel: exercise.metric === 'distance' ? `${best.toFixed(1)}km` : `${Math.round(best)}회`,
    averageLabel: exercise.metric === 'distance' ? `${average.toFixed(1)}km` : `${Math.round(average)}회`,
    recentLabel: recent ? relativeDay(recent, new Date()) : '기록 없음',
  };
}

function buildMonthHeatmap(workouts: HistoryWorkout[], now: Date): HeatmapDay[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const grouped = groupByDate(workouts);
  const maxCount = Math.max(1, ...Object.values(grouped).map((items) => items.length));

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = dateKey(new Date(Date.UTC(year, month, day)));
    const items = grouped[key] ?? [];
    return {
      dateKey: key,
      day,
      count: items.length,
      intensity: items.length === 0 ? 0 : Math.max(1, Math.ceil((items.length / maxCount) * 4)),
      workouts: items,
    };
  });
}

function buildWeeklyBars(workouts: HistoryWorkout[], now: Date): ChartPoint[] {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const monday = startOfWeek(now);
  return labels.map((label, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    const key = dateKey(day);
    const items = workouts.filter((workout) => dateKey(workout.completedAt) === key);
    return {
      label,
      value: Math.round(sum(items.map((workout) => workout.durationSeconds)) / 60),
    };
  });
}

function buildMonthlyTrend(workouts: HistoryWorkout[], now: Date): ChartPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const monthKey = date.toISOString().slice(0, 7);
    return {
      label: `${date.getUTCMonth() + 1}월`,
      value: workouts.filter((workout) => workout.completedAt.slice(0, 7) === monthKey).length,
    };
  });
}

function buildTimeline(workouts: HistoryWorkout[]): TimelineGroup[] {
  const grouped = groupByDate(workouts);
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      dateKey: key,
      label: relativeDay(key, new Date()),
      workouts: items,
    }));
}

function buildPersonalRecords(workouts: HistoryWorkout[]): PersonalRecord[] {
  return EXERCISES.map((exercise) => {
    const items = workouts.filter((workout) => workout.type === exercise.type);
    const best = Math.max(0, ...items.map((workout) => exercise.metric === 'distance' ? workout.distanceKm : workout.reps));
    return {
      type: exercise.type,
      label: exercise.label,
      valueLabel: exercise.metric === 'distance' ? `${best.toFixed(1)}km` : `${Math.round(best)}회`,
    };
  });
}

function buildBadges(workouts: HistoryWorkout[], streak: number): BadgeSummary[] {
  const workoutCount = workouts.length;
  const calories = sum(workouts.map((workout) => workout.calories));
  const runningKm = sum(workouts.filter((workout) => workout.type === 'running').map((workout) => workout.distanceKm));
  return [
    { label: '첫 운동', achieved: workoutCount >= 1 },
    { label: '10회 달성', achieved: workoutCount >= 10 },
    { label: '100회 달성', achieved: workoutCount >= 100 },
    { label: '7일 연속', achieved: streak >= 7 },
    { label: '30일 연속', achieved: streak >= 30 },
    { label: '5000 kcal', achieved: calories >= 5000 },
    { label: '100km 러닝', achieved: runningKm >= 100 },
  ];
}

function buildComparison(workouts: HistoryWorkout[], now: Date) {
  const thisWeekStart = startOfWeek(now).getTime();
  const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = workouts.filter((workout) => Date.parse(workout.completedAt) >= thisWeekStart);
  const lastWeek = workouts.filter((workout) => {
    const time = Date.parse(workout.completedAt);
    return time >= lastWeekStart && time < thisWeekStart;
  });
  return {
    durationPercent: percentChange(sum(thisWeek.map((workout) => workout.durationSeconds)), sum(lastWeek.map((workout) => workout.durationSeconds))),
    caloriesPercent: percentChange(sum(thisWeek.map((workout) => workout.calories)), sum(lastWeek.map((workout) => workout.calories))),
    workoutDelta: thisWeek.length - lastWeek.length,
  };
}

function calculateStreak(activeDateKeys: string[], todayKey: string) {
  const active = new Set(activeDateKeys);
  let cursor = new Date(`${todayKey}T00:00:00.000Z`);
  if (!active.has(dateKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (active.has(dateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function calculateBestStreak(activeDateKeys: string[]) {
  const sorted = [...new Set(activeDateKeys)].sort();
  let best = 0;
  let current = 0;
  let previous = '';
  sorted.forEach((key) => {
    const expected = previous ? addDays(previous, 1) : '';
    current = previous && key === expected ? current + 1 : 1;
    best = Math.max(best, current);
    previous = key;
  });
  return best;
}

function uniqueDateKeys(workouts: HistoryWorkout[]) {
  return [...new Set(workouts.map((workout) => dateKey(workout.completedAt)))].sort();
}

function groupByDate(workouts: HistoryWorkout[]) {
  return workouts.reduce<Record<string, HistoryWorkout[]>>((groups, workout) => {
    const key = dateKey(workout.completedAt);
    groups[key] = [...(groups[key] ?? []), workout];
    return groups;
  }, {});
}

function startOfWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start;
}

function relativeDay(value: string, now: Date) {
  const key = value.length >= 10 ? value.slice(0, 10) : value;
  const today = dateKey(now);
  const yesterday = addDays(today, -1);
  if (key === today) return '오늘';
  if (key === yesterday) return '어제';
  return key;
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function exerciseLabel(type: string) {
  return EXERCISE_BY_TYPE.get(type)?.label ?? type;
}

function workoutVolume(workout: HistoryWorkout) {
  return workout.distanceKm > 0 ? workout.distanceKm * 100 : workout.reps;
}

function runDistanceKm(run: HistoryRunLike) {
  const meters = finite(run.total_distance_meters ?? run.totalDistanceMeters);
  if (meters > 0) return meters / 1000;
  return finite(run.actual_distance_km ?? run.distanceKm);
}

function estimateCalories({
  type,
  durationSeconds,
  reps,
  distanceKm,
}: {
  type: string;
  durationSeconds: number;
  reps: number;
  distanceKm: number;
}) {
  if (type === 'running') return Math.round(distanceKm * 62 + durationSeconds / 60 * 4);
  return Math.max(1, Math.round(reps * 0.48 + durationSeconds / 60 * 4));
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
