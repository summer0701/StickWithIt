export type ExerciseRecord = {
  id?: string;
  userId: string;
  type: string;
  completed: boolean;
  completedAt?: string;
  durationSeconds?: number;
  reps?: number;
  distanceKm?: number;
  goodSeconds?: number;
  warningSeconds?: number;
  badSeconds?: number;
  qualityScore?: number;
};

const STORAGE_KEY = 'stickWithIt:exercise-records';
const MAX_RECORDS = 250;

export function readExerciseRecords(userId: string, types?: string[]) {
  const typeSet = types ? new Set(types) : null;
  return readAllExerciseRecords()
    .filter((record) => record.userId === userId)
    .filter((record) => !typeSet || typeSet.has(record.type))
    .sort(compareCompletedDesc);
}

export function saveExerciseRecord(record: ExerciseRecord) {
  const savedRecord = normalizeRecord(record);
  const allRecords = readAllExerciseRecords();
  const nextRecords = [savedRecord, ...allRecords.filter((item) => item.id !== savedRecord.id)].slice(0, MAX_RECORDS);
  if (canUseLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  }
  return savedRecord;
}

export function normalizeRecord(record: ExerciseRecord): ExerciseRecord {
  const completedAt = record.completedAt ?? new Date().toISOString();
  return {
    ...record,
    id: record.id ?? `${record.type}-${Date.parse(completedAt) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt,
    completed: Boolean(record.completed),
    durationSeconds: finitePositive(record.durationSeconds),
    reps: finiteNonNegative(record.reps),
    distanceKm: finiteNonNegative(record.distanceKm),
    goodSeconds: finiteNonNegative(record.goodSeconds),
    warningSeconds: finiteNonNegative(record.warningSeconds),
    badSeconds: finiteNonNegative(record.badSeconds),
    qualityScore: finiteNonNegative(record.qualityScore),
  };
}

function readAllExerciseRecords(): ExerciseRecord[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function compareCompletedDesc(a: ExerciseRecord, b: ExerciseRecord) {
  return new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime();
}

function finitePositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(3)) : undefined;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
