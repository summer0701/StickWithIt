import type { ExerciseRecord } from './exerciseRecords';

export type CompletedRunLike = Record<string, any>;

export function completedRunToExerciseRecord(userId: string, run: CompletedRunLike): ExerciseRecord | null {
  const completedAt = run.ended_at ?? run.started_at ?? run.created_at;
  if (!completedAt || (run.status != null && run.status !== 'completed')) return null;

  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return null;

  return {
    id: String(run.id ?? `run-${completedDate.toISOString()}`),
    userId,
    type: 'running',
    completed: true,
    completedAt: completedDate.toISOString(),
    durationSeconds: getRunDurationSeconds(run),
    distanceKm: getRunDistanceKm(run),
  };
}

export function completedRunsToExerciseRecords(userId: string, runs: CompletedRunLike[]): ExerciseRecord[] {
  return runs
    .map((run) => completedRunToExerciseRecord(userId, run))
    .filter((record): record is ExerciseRecord => Boolean(record));
}

export function getRunDistanceKm(run: CompletedRunLike) {
  const actualDistanceKm = Number(run.actual_distance_km ?? run.distanceKm);
  if (Number.isFinite(actualDistanceKm) && actualDistanceKm > 0) return actualDistanceKm;

  const totalDistanceMeters = Number(run.total_distance_meters ?? run.totalDistanceMeters);
  if (Number.isFinite(totalDistanceMeters) && totalDistanceMeters > 0) return totalDistanceMeters / 1000;

  return 0;
}

export function getRunDurationSeconds(run: CompletedRunLike) {
  const durationSeconds = Number(run.duration_seconds ?? run.durationSeconds);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) return durationSeconds;

  const totalElapsedSeconds = Number(run.total_elapsed_seconds ?? run.totalElapsedSeconds);
  if (Number.isFinite(totalElapsedSeconds) && totalElapsedSeconds > 0) return totalElapsedSeconds;

  return 0;
}
