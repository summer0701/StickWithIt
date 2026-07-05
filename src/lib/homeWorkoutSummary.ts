import type { ExerciseRecord } from './exerciseRecords';
import { getRunDistanceKm, getRunDurationSeconds } from './runRecords';

export type RunningSummaryRun = Record<string, any>;

export type HomeWorkoutSummary = {
  metrics: Array<{ tone: string; label: string; value: string }>;
  insight: string;
  refreshedAt: string;
  nextRefreshAt: string;
  recordCount: number;
};

type BuildSummaryOptions = {
  userId: string;
  runs?: RunningSummaryRun[];
  exerciseRecords?: ExerciseRecord[];
  now?: Date;
};

const CACHE_PREFIX = 'stickWithIt:home-workout-summary:';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 14;

const exerciseDefinitions = [
  { type: 'running', label: 'Running', metric: 'distance' },
  { type: 'squat', label: 'Squat', metric: 'reps' },
  { type: 'push-up', label: 'Push-up', metric: 'reps' },
  { type: 'lunge', label: 'Lunge', metric: 'reps' },
  { type: 'walking', label: 'Walking', metric: 'distance' },
] as const;

export function getHomeWorkoutSummary(options: BuildSummaryOptions): HomeWorkoutSummary {
  const now = options.now ?? new Date();
  const records = collectWorkoutRecords(options.runs ?? [], options.exerciseRecords ?? []);
  const signature = buildActivitySignature(records);
  const cached = readCachedSummary(options.userId);

  if (cached && cached.signature === signature && now.getTime() < Date.parse(cached.summary.nextRefreshAt)) {
    return cached.summary;
  }

  const summary = buildHomeWorkoutSummary({ records, now });
  writeCachedSummary(options.userId, { signature, summary });
  return summary;
}

export function buildHomeWorkoutSummary({ records, now = new Date() }: { records: ExerciseRecord[]; now?: Date }): HomeWorkoutSummary {
  const recentThreshold = now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = records.filter((record) => new Date(record.completedAt ?? 0).getTime() >= recentThreshold);
  const completed = recent.filter((record) => record.completed);
  const totalDurationSeconds = completed.reduce((sum, record) => sum + Number(record.durationSeconds ?? 0), 0);
  const distanceKm = completed.reduce((sum, record) => sum + Number(record.distanceKm ?? 0), 0);
  const totalReps = completed.reduce((sum, record) => sum + Number(record.reps ?? 0), 0);
  const mostActive = mostActiveExercise(completed);

  return {
    metrics: [
      { tone: 'blue', label: '최근 14일 거리', value: `${distanceKm.toFixed(distanceKm >= 10 ? 1 : 2)} km` },
      { tone: 'cyan', label: '총 운동시간', value: formatDuration(totalDurationSeconds) },
      { tone: 'orange', label: '반복 횟수', value: `${Math.round(totalReps).toLocaleString()} 회` },
      { tone: 'green', label: '주력 운동', value: mostActive?.label ?? '기록 대기' },
    ],
    insight: buildInsight({ completed, distanceKm, totalReps, mostActive }),
    refreshedAt: now.toISOString(),
    nextRefreshAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    recordCount: completed.length,
  };
}

export function collectWorkoutRecords(runs: RunningSummaryRun[], exerciseRecords: ExerciseRecord[]) {
  return [
    ...runs.map(runToExerciseRecord).filter(Boolean),
    ...exerciseRecords,
  ] as ExerciseRecord[];
}

function runToExerciseRecord(run: RunningSummaryRun): ExerciseRecord | null {
  const completedAt = run.ended_at ?? run.started_at ?? run.created_at;
  const status = run.status;
  if (!completedAt) return null;
  if (status != null && status !== 'completed') return null;
  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return null;

  const durationSeconds = getRunDurationSeconds(run);
  const distanceKm = getRunDistanceKm(run);
  return {
    id: String(run.id ?? `run-${completedAt}`),
    userId: String(run.user_id ?? 'unknown'),
    type: String(run.exercise_type ?? run.type ?? 'running'),
    completed: true,
    completedAt: completedDate.toISOString(),
    durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
    distanceKm,
  };
}

function mostActiveExercise(records: ExerciseRecord[]) {
  const scores = new Map<string, number>();
  records.forEach((record) => {
    scores.set(record.type, (scores.get(record.type) ?? 0) + activityScore(record));
  });

  const [type] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return exerciseDefinitions.find((definition) => definition.type === type);
}

function activityScore(record: ExerciseRecord) {
  if (record.durationSeconds) return record.durationSeconds;
  if (record.distanceKm) return record.distanceKm * 600;
  if (record.reps) return record.reps * 4;
  if (record.goodSeconds) return record.goodSeconds;
  return 1;
}

function buildInsight({
  completed,
  distanceKm,
  totalReps,
  mostActive,
}: {
  completed: ExerciseRecord[];
  distanceKm: number;
  totalReps: number;
  mostActive?: { type: string; label: string };
}) {
  if (completed.length === 0) {
    return '최근 운동 기록이 쌓이면 3일마다 AI 요약이 자동으로 갱신됩니다.';
  }

  const covered = new Set(completed.map((record) => record.type));
  const missing = exerciseDefinitions.find((definition) => !covered.has(definition.type));
  if (missing) {
    return `${mostActive?.label ?? '최근 운동'} 흐름이 가장 셉니다. 다음에는 ${missing.label} 기록을 추가하면 균형 분석이 더 좋아집니다.`;
  }
  if (totalReps >= 80) return `최근 반복 운동이 ${Math.round(totalReps)}회입니다. 하체와 상체 루틴이 살아나고 있습니다.`;
  if (distanceKm >= 5) return `최근 운동 거리가 ${distanceKm.toFixed(1)}km입니다. 유산소 루틴이 안정적으로 쌓이고 있습니다.`;
  return `${completed.length}개의 최근 운동을 분석했습니다. 운동이 쌓일수록 카드 내용이 더 구체적으로 바뀍니다.`;
}

function buildActivitySignature(records: ExerciseRecord[]) {
  return records
    .map((record) => [
      record.id,
      record.type,
      record.completedAt,
      record.durationSeconds,
      record.reps,
      record.distanceKm,
      record.goodSeconds,
      record.qualityScore,
    ].join(':'))
    .sort()
    .join('|');
}

function formatDuration(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function readCachedSummary(userId: string): { signature: string; summary: HomeWorkoutSummary } | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    window.localStorage.removeItem(cacheKey(userId));
    return null;
  }
}

function writeCachedSummary(userId: string, value: { signature: string; summary: HomeWorkoutSummary }) {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(value));
  }
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
