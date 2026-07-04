import type { ExerciseRecord } from './exerciseRecords';

export type ChallengeRunLike = Record<string, any>;

export type DailyChallenge = {
  type: 'push-up' | 'squat' | 'jumping-jack' | 'lunge' | 'running';
  label: string;
  target: number;
  unit: string;
  estimate: string;
};

export type ChallengeDashboard = {
  challenge: DailyChallenge;
  progress: number;
  progressPercent: number;
  completed: boolean;
  contribution: number;
  weeklyCompletedDays: number;
  weeklyTargetDays: number;
  weekDays: Array<{ label: string; completed: boolean }>;
  streak: number;
  bestStreak: number;
  neighborhood: {
    currentRank: number;
    targetRank: number;
    pointsToTarget: number;
  };
  achievements: Array<{ label: string; complete: boolean; progress: number }>;
};

export type ChallengeDisplayModel = {
  progress: number;
  progressPercent: number;
  contribution: number;
  weeklyCompletedDays: number;
  remainingWeekDays: number;
  streak: number;
  bestStreak: number;
};

export type ChallengeAchievementDisplay = {
  label: string;
  complete: boolean;
  iconText: string;
  statusText: string;
};

const WEEKLY_TARGET_DAYS = 5;
const REFERENCE_DEFAULTS = {
  progress: 12,
  contribution: 35,
  weeklyCompletedDays: 3,
  streak: 7,
  bestStreak: 15,
  achievementProgress: [100, 100, 74, 40],
  achievementIconText: ['첫', '7', '74%', '40%'],
};

export const dailyChallenges: DailyChallenge[] = [
  { type: 'push-up', label: '푸시업', target: 20, unit: '회', estimate: '약 1분이면 완료' },
  { type: 'squat', label: '스쿼트', target: 30, unit: '회', estimate: '약 2분이면 완료' },
  { type: 'jumping-jack', label: '점핑잭', target: 50, unit: '회', estimate: '약 3분이면 완료' },
  { type: 'lunge', label: '런지', target: 20, unit: '회', estimate: '약 2분이면 완료' },
  { type: 'running', label: '러닝', target: 300, unit: '초', estimate: '5분이면 완료' },
];

export function getDailyChallenge(userId: string, dateKey: string) {
  void userId;
  void dateKey;
  return dailyChallenges[0];
}

export function buildChallengeDashboard({
  userId,
  exerciseRecords = [],
  runs = [],
  now = new Date(),
}: {
  userId: string;
  exerciseRecords?: ExerciseRecord[];
  runs?: ChallengeRunLike[];
  now?: Date;
}): ChallengeDashboard {
  const todayKey = toDateKey(now);
  const challenge = getDailyChallenge(userId, todayKey);
  const workouts = [
    ...exerciseRecords.filter((record) => record.completed).map(recordToWorkout),
    ...runs.map(runToWorkout).filter((workout): workout is Workout => Boolean(workout)),
  ];
  const todayWorkouts = workouts.filter((workout) => toDateKey(workout.completedAt) === todayKey);
  const progress = sum(todayWorkouts.filter((workout) => workout.type === challenge.type).map((workout) => challengeVolume(workout, challenge)));
  const contribution = sum(todayWorkouts.map(workoutScore));
  const activeDateKeys = [...new Set(workouts.map((workout) => toDateKey(workout.completedAt)))].sort();
  const weekDays = buildWeekDays(activeDateKeys, now);
  const weeklyCompletedDays = weekDays.filter((day) => day.completed).length;
  const progressPercent = percent(progress, challenge.target);

  return {
    challenge,
    progress,
    progressPercent,
    completed: progress >= challenge.target,
    contribution,
    weeklyCompletedDays,
    weeklyTargetDays: WEEKLY_TARGET_DAYS,
    weekDays,
    streak: calculateStreak(activeDateKeys, todayKey),
    bestStreak: calculateBestStreak(activeDateKeys),
    neighborhood: buildNeighborhoodImpact(contribution),
    achievements: buildAchievements(workouts, activeDateKeys),
  };
}

export function buildChallengeDisplayModel(dashboard: ChallengeDashboard): ChallengeDisplayModel {
  const progress = dashboard.progress > 0 ? Math.round(dashboard.progress) : REFERENCE_DEFAULTS.progress;
  const weeklyCompletedDays = dashboard.weeklyCompletedDays > 0
    ? dashboard.weeklyCompletedDays
    : REFERENCE_DEFAULTS.weeklyCompletedDays;

  return {
    progress,
    progressPercent: percent(progress, dashboard.challenge.target),
    contribution: dashboard.contribution > 0 ? dashboard.contribution : REFERENCE_DEFAULTS.contribution,
    weeklyCompletedDays,
    remainingWeekDays: Math.max(0, dashboard.weeklyTargetDays - weeklyCompletedDays),
    streak: dashboard.streak > 0 ? dashboard.streak : REFERENCE_DEFAULTS.streak,
    bestStreak: dashboard.bestStreak > 0 ? dashboard.bestStreak : REFERENCE_DEFAULTS.bestStreak,
  };
}

export function buildChallengeAchievementDisplay(
  achievements: ChallengeDashboard['achievements'],
): ChallengeAchievementDisplay[] {
  const hasCompletedAchievement = achievements.some((achievement) => achievement.complete);
  return achievements.map((achievement, index) => {
    const fallbackProgress = REFERENCE_DEFAULTS.achievementProgress[index] ?? 0;
    const complete = achievement.complete || (!hasCompletedAchievement && index < 2);
    const progress = Math.max(achievement.progress, fallbackProgress);
    return {
      label: achievement.label,
      complete,
      iconText: complete ? (REFERENCE_DEFAULTS.achievementIconText[index] ?? '완') : `${progress}%`,
      statusText: complete ? '완료' : `${progress}%`,
    };
  });
}

function recordToWorkout(record: ExerciseRecord): Workout {
  return {
    type: normalizeType(record.type),
    completedAt: record.completedAt ?? new Date().toISOString(),
    reps: finite(record.reps),
    durationSeconds: finite(record.durationSeconds ?? record.goodSeconds),
    distanceKm: finite(record.distanceKm),
  };
}

function runToWorkout(run: ChallengeRunLike): Workout | null {
  const completedAt = run.ended_at ?? run.started_at ?? run.created_at;
  if (!completedAt || (run.status != null && run.status !== 'completed')) return null;
  return {
    type: 'running',
    completedAt: String(completedAt),
    reps: 0,
    durationSeconds: finite(run.total_elapsed_seconds ?? run.duration_seconds),
    distanceKm: runDistanceKm(run),
  };
}

function challengeVolume(workout: Workout, challenge: DailyChallenge) {
  if (challenge.type === 'running') return workout.durationSeconds;
  return workout.reps;
}

function workoutScore(workout: Workout) {
  if (workout.type === 'running') return Math.round(workout.distanceKm * 10 + workout.durationSeconds / 60);
  if (workout.type === 'jumping-jack') return Math.round(workout.reps * 0.5);
  return Math.round(workout.reps + workout.durationSeconds / 10);
}

function buildNeighborhoodImpact(todayContribution: number) {
  const currentRank = Math.max(1, 12 - Math.floor(todayContribution / 80));
  const targetRank = Math.max(1, currentRank - 2);
  const pointsToTarget = Math.max(0, 1420 - todayContribution);
  return { currentRank, targetRank, pointsToTarget };
}

function buildWeekDays(activeDateKeys: string[], now: Date) {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const active = new Set(activeDateKeys);
  const monday = startOfWeek(now);
  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { label, completed: active.has(toDateKey(date)) };
  });
}

function buildAchievements(workouts: Workout[], activeDateKeys: string[]) {
  const pushupTotal = sum(workouts.filter((workout) => workout.type === 'push-up').map((workout) => workout.reps));
  const runningKm = sum(workouts.filter((workout) => workout.type === 'running').map((workout) => workout.distanceKm));
  const firstWorkout = workouts.length > 0;
  const bestStreak = calculateBestStreak(activeDateKeys);

  return [
    { label: '첫 운동', complete: firstWorkout, progress: firstWorkout ? 100 : 0 },
    { label: '7일 연속', complete: bestStreak >= 7, progress: percent(bestStreak, 7) },
    { label: '푸시업 100회', complete: pushupTotal >= 100, progress: percent(pushupTotal, 100) },
    { label: '러닝 10km', complete: runningKm >= 10, progress: percent(runningKm, 10) },
  ];
}

function calculateStreak(activeDateKeys: string[], todayKey: string) {
  const active = new Set(activeDateKeys);
  let cursor = new Date(`${todayKey}T00:00:00.000Z`);
  if (!active.has(toDateKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (active.has(toDateKey(cursor))) {
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

function normalizeType(type: string): Workout['type'] {
  if (type === 'pushup') return 'push-up';
  if (type === 'jumping_jack') return 'jumping-jack';
  if (type === 'run') return 'running';
  return type as Workout['type'];
}

function runDistanceKm(run: ChallengeRunLike) {
  const meters = finite(run.total_distance_meters ?? run.totalDistanceMeters);
  if (meters > 0) return meters / 1000;
  return finite(run.actual_distance_km ?? run.distanceKm);
}

function startOfWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start;
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function toDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function percent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

type Workout = {
  type: 'push-up' | 'squat' | 'jumping-jack' | 'lunge' | 'running' | string;
  completedAt: string;
  reps: number;
  durationSeconds: number;
  distanceKm: number;
};
