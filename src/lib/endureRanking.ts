import {
  BASE_ER_MAX,
  ENDURE_LEVELS,
  GHOST_NAMES,
  GHOST_TYPES,
  RANKING_EXERCISES,
  RANKING_LEAGUE_SIZE,
  WEEK_MS,
  type EndureLevel,
  type GhostProfileType,
  type RankingExerciseType,
} from './endureRankingConstants';
import type { ExerciseRecord } from './exerciseRecords';

export type RunRecordLike = {
  id?: string;
  user_id?: string;
  actual_distance_km?: number;
  distanceKm?: number;
  total_distance_meters?: number;
  total_elapsed_seconds?: number;
  duration_seconds?: number;
  started_at?: string;
  ended_at?: string;
  created_at?: string;
  status?: string;
};

export type RankingUserInput = {
  userId: string;
  displayName: string;
  runs?: RunRecordLike[];
  exerciseRecords?: ExerciseRecord[];
  previousRank?: number | null;
  isCurrentUser?: boolean;
};

export type ExerciseScores = Record<RankingExerciseType, number>;

export type EndureRating = {
  userId: string;
  displayName: string;
  scores: ExerciseScores;
  baseEr: number;
  bonusEr: number;
  totalEr: number;
  level: EndureLevel;
};

export type StoredEndureRating = EndureRating & {
  previousRank?: number | null;
  isCurrentUser?: boolean;
};

export type RankingEntry = {
  id: string;
  userId: string | null;
  ghostId: string | null;
  entryType: 'user' | 'ghost';
  displayName: string;
  ghostType?: GhostProfileType;
  scores: ExerciseScores;
  baseEr: number;
  bonusEr: number;
  totalEr: number;
  level: EndureLevel;
  rank: number;
  previousRank: number | null;
  movement: 'up' | 'down' | 'same' | 'new';
  movementDelta: number;
  isCurrentUser?: boolean;
};

export type RankingSeason = {
  id: string;
  seasonName: string;
  startsAt: string;
  endsAt: string;
  status: 'active';
};

export type LeagueRanking = {
  season: RankingSeason;
  level: EndureLevel;
  leagueName: string;
  maxMembers: number;
  userRating: EndureRating;
  entries: RankingEntry[];
  userRank: number;
  ghostCount: number;
  realUserCount: number;
};

export type UserEndureRatingRow = {
  user_id: string;
  running_score: number;
  squat_score: number;
  lunge_score: number;
  pushup_score: number;
  extra_score: number;
  base_er: number;
  bonus_er: number;
  total_er: number;
  level: EndureLevel;
  updated_at: string;
};

export type RankingEntryRow = {
  league_id: string;
  user_id: string | null;
  ghost_id: string | null;
  entry_type: 'user' | 'ghost';
  display_name: string;
  total_er: number;
  rank: number;
  previous_rank: number | null;
  movement: 'up' | 'down' | 'same' | 'new';
  updated_at: string;
};

type GhostSeedContext = {
  level: EndureLevel;
  neededCount: number;
  userEr?: number;
  seed?: string;
};

const DEFAULT_SCORE = 0;
const SCORE_MAX = 1000;
const RUNNING_REFERENCE = {
  distanceKm: 5,
  paceSecondsPerKm: 360,
  volumeDistanceKm: 20,
  volumeDurationSeconds: 5 * 60 * 60,
};
const REP_REFERENCE = {
  squat: 80,
  lunge: 50,
  pushup: 50,
  extra: 70,
};

export function calculateEndureRating(input: RankingUserInput): EndureRating {
  const runs = input.runs ?? [];
  const records = input.exerciseRecords ?? [];
  const scores: ExerciseScores = {
    running: calculateRunningScore(runs),
    squat: calculateRepetitionScore(records, 'squat', REP_REFERENCE.squat),
    lunge: calculateRepetitionScore(records, 'lunge', REP_REFERENCE.lunge),
    pushup: calculateRepetitionScore(records, 'push-up', REP_REFERENCE.pushup),
    extra: calculateExtraScore(records),
  };
  const baseEr = clampScore(sumScores(scores), 0, BASE_ER_MAX);
  const bonusEr = calculateBalanceBonus(scores, runs, records);
  const totalEr = baseEr + bonusEr;

  return {
    userId: input.userId,
    displayName: input.displayName,
    scores,
    baseEr,
    bonusEr,
    totalEr,
    level: getEndureLevel(totalEr),
  };
}

export function getEndureLevel(er: number): EndureLevel {
  const normalized = Math.max(0, Number(er) || 0);
  return ENDURE_LEVELS.find((level) => normalized >= level.min && normalized <= level.max)?.level ?? 'Diamond';
}

export function getLevelRange(level: EndureLevel) {
  return ENDURE_LEVELS.find((item) => item.level === level) ?? ENDURE_LEVELS[0];
}

export function buildCurrentSeason(now = new Date()): RankingSeason {
  const start = new Date(now);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + WEEK_MS);

  return {
    id: `season-${start.toISOString().slice(0, 10)}`,
    seasonName: `${start.toISOString().slice(0, 10)} 주간 시즌`,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status: 'active',
  };
}

export function buildLeagueRanking({
  currentUser,
  otherUsers = [],
  now = new Date(),
}: {
  currentUser: RankingUserInput;
  otherUsers?: RankingUserInput[];
  now?: Date;
}): LeagueRanking {
  const userRating = calculateEndureRating({ ...currentUser, isCurrentUser: true });
  const level = userRating.level;
  const season = buildCurrentSeason(now);
  const realEntries = [currentUser, ...otherUsers]
    .map((user) => ({ user, rating: calculateEndureRating(user) }))
    .filter(({ rating }) => rating.level === level)
    .map(({ user, rating }) => ratingToEntry(rating, user.previousRank ?? null, Boolean(user.isCurrentUser || user.userId === currentUser.userId)));
  const neededCount = Math.max(0, RANKING_LEAGUE_SIZE - realEntries.length);
  const ghosts = generateGhostEntries({ level, neededCount, userEr: userRating.totalEr, seed: `${currentUser.userId}:${season.id}` });
  const entries = rankEntries([...realEntries, ...ghosts]);
  const userRank = entries.find((entry) => entry.userId === currentUser.userId)?.rank ?? entries.length;

  return {
    season,
    level,
    leagueName: `${level} 리그`,
    maxMembers: RANKING_LEAGUE_SIZE,
    userRating,
    entries,
    userRank,
    ghostCount: entries.filter((entry) => entry.entryType === 'ghost').length,
    realUserCount: entries.filter((entry) => entry.entryType === 'user').length,
  };
}

export function buildLeagueRankingFromRatings({
  currentRating,
  peerRatings = [],
  now = new Date(),
}: {
  currentRating: StoredEndureRating;
  peerRatings?: StoredEndureRating[];
  now?: Date;
}): LeagueRanking {
  const level = currentRating.level;
  const season = buildCurrentSeason(now);
  const currentEntry = ratingToEntry(currentRating, currentRating.previousRank ?? null, true);
  const peerEntries = peerRatings
    .filter((rating) => rating.userId !== currentRating.userId)
    .filter((rating) => rating.level === level)
    .map((rating) => ratingToEntry(rating, rating.previousRank ?? null, Boolean(rating.isCurrentUser)));
  const realEntries = [currentEntry, ...peerEntries].slice(0, RANKING_LEAGUE_SIZE);
  const neededCount = Math.max(0, RANKING_LEAGUE_SIZE - realEntries.length);
  const ghosts = generateGhostEntries({ level, neededCount, userEr: currentRating.totalEr, seed: `${currentRating.userId}:${season.id}:stored` });
  const entries = rankEntries([...realEntries, ...ghosts]);
  const userRank = entries.find((entry) => entry.userId === currentRating.userId)?.rank ?? entries.length;

  return {
    season,
    level,
    leagueName: `${level} 리그`,
    maxMembers: RANKING_LEAGUE_SIZE,
    userRating: currentRating,
    entries,
    userRank,
    ghostCount: entries.filter((entry) => entry.entryType === 'ghost').length,
    realUserCount: entries.filter((entry) => entry.entryType === 'user').length,
  };
}

export function endureRatingFromStoredRow(row: Record<string, any>, fallbackName = '챌린저'): StoredEndureRating {
  const scores: ExerciseScores = {
    running: normalizeStoredScore(row.running_score),
    squat: normalizeStoredScore(row.squat_score),
    lunge: normalizeStoredScore(row.lunge_score ?? row[legacyScoreColumn()]),
    pushup: normalizeStoredScore(row.pushup_score),
    extra: normalizeStoredScore(row.extra_score),
  };
  const baseEr = Number.isFinite(Number(row.base_er)) ? Number(row.base_er) : sumScores(scores);
  const bonusEr = Number.isFinite(Number(row.bonus_er)) ? Number(row.bonus_er) : 0;
  const totalEr = Number.isFinite(Number(row.total_er)) ? Number(row.total_er) : baseEr + bonusEr;
  const level = ENDURE_LEVELS.some((item) => item.level === row.level) ? row.level as EndureLevel : getEndureLevel(totalEr);

  const userId = String(row.user_id ?? row.userId ?? '');

  return {
    userId,
    displayName: String(row.display_name ?? row.nickname ?? row.profiles?.nickname ?? (userId ? `User ${userId.slice(0, 4)}` : fallbackName)),
    scores,
    baseEr,
    bonusEr,
    totalEr,
    level,
    previousRank: Number.isFinite(Number(row.previous_rank)) ? Number(row.previous_rank) : null,
  };
}

export function endureRatingToRow(rating: EndureRating, updatedAt = new Date().toISOString()): UserEndureRatingRow {
  return {
    user_id: rating.userId,
    running_score: rating.scores.running,
    squat_score: rating.scores.squat,
    lunge_score: rating.scores.lunge,
    pushup_score: rating.scores.pushup,
    extra_score: rating.scores.extra,
    base_er: rating.baseEr,
    bonus_er: rating.bonusEr,
    total_er: rating.totalEr,
    level: rating.level,
    updated_at: updatedAt,
  };
}

export function rankingEntriesToRows(entries: RankingEntry[], leagueId: string, updatedAt = new Date().toISOString()): RankingEntryRow[] {
  return entries.map((entry) => ({
    league_id: leagueId,
    user_id: entry.userId,
    ghost_id: entry.ghostId,
    entry_type: entry.entryType,
    display_name: entry.displayName,
    total_er: entry.totalEr,
    rank: entry.rank,
    previous_rank: entry.previousRank,
    movement: entry.movement,
    updated_at: updatedAt,
  }));
}

export function generateGhostEntries({ level, neededCount, userEr, seed = level }: GhostSeedContext): RankingEntry[] {
  const range = getLevelRange(level);
  const max = Number.isFinite(range.max) ? range.max : BASE_ER_MAX + 500;
  const random = seededRandom(seed);

  return Array.from({ length: neededCount }, (_, index) => {
    const ghostType = pickGhostType(level, index);
    const targetEr = pickGhostErWithinLevel({ min: range.min, max, userEr, random, index });
    const scores = buildGhostScores(targetEr, ghostType, random);
    const totalEr = clampScore(sumScores(scores), range.min, max);

    return {
      id: `ghost-${level}-${index + 1}`,
      userId: null,
      ghostId: `ghost-${level}-${index + 1}`,
      entryType: 'ghost',
      displayName: `${GHOST_NAMES[index % GHOST_NAMES.length]} ${index + 1}`,
      ghostType,
      scores,
      baseEr: totalEr,
      bonusEr: 0,
      totalEr,
      level,
      rank: 0,
      previousRank: null,
      movement: 'new',
      movementDelta: 0,
    };
  });
}

export function rankEntries(entries: RankingEntry[]): RankingEntry[] {
  return [...entries]
    .sort((a, b) => b.totalEr - a.totalEr || a.displayName.localeCompare(b.displayName))
    .map((entry, index) => {
      const rank = index + 1;
      const movementDelta = entry.previousRank == null ? 0 : entry.previousRank - rank;
      return {
        ...entry,
        rank,
        movementDelta,
        movement: entry.previousRank == null ? 'new' : movementDelta > 0 ? 'up' : movementDelta < 0 ? 'down' : 'same',
      };
    });
}

export function calculateSeasonOutcome(rank: number, memberCount: number, isFirstSeason: boolean) {
  const ratio = rank / Math.max(1, memberCount);
  if (ratio <= 0.2) return { outcome: 'promotion', badge: rank === 1 ? 'Champion Badge' : rank <= 10 ? 'Elite Badge' : 'Promotion Badge' };
  if (ratio >= 0.8 && !isFirstSeason) return { outcome: 'demotion', badge: null };
  return { outcome: 'stay', badge: null };
}

export function calculateSeasonBadges({
  rank,
  memberCount,
  isFirstSeason,
  scores,
}: {
  rank: number;
  memberCount: number;
  isFirstSeason: boolean;
  scores: ExerciseScores;
}) {
  const outcome = calculateSeasonOutcome(rank, memberCount, isFirstSeason);
  const badges = new Set<string>();
  if (rank === 1) badges.add('Champion Badge');
  if (rank <= 10) badges.add('Elite Badge');
  if (outcome.outcome === 'promotion') badges.add('Promotion Badge');
  if (RANKING_EXERCISES.every((exercise) => scores[exercise] > 0)) badges.add('Balanced Endurer Badge');
  return {
    ...outcome,
    badges: Array.from(badges),
  };
}

function ratingToEntry(rating: EndureRating, previousRank: number | null, isCurrentUser: boolean): RankingEntry {
  return {
    id: `user-${rating.userId}`,
    userId: rating.userId,
    ghostId: null,
    entryType: 'user',
    displayName: rating.displayName,
    scores: rating.scores,
    baseEr: rating.baseEr,
    bonusEr: rating.bonusEr,
    totalEr: rating.totalEr,
    level: rating.level,
    rank: 0,
    previousRank,
    movement: previousRank == null ? 'new' : 'same',
    movementDelta: 0,
    isCurrentUser,
  };
}

function calculateRunningScore(runs: RunRecordLike[]) {
  const best = runs.reduce((bestScore, run) => Math.max(bestScore, runningScoreFromRun(run)), DEFAULT_SCORE);
  return Math.round(clampScore(best + runningVolumeBonus(runs)));
}

function runningScoreFromRun(run: RunRecordLike) {
  const distanceKm = runDistanceKm(run);
  const elapsedSeconds = Number(run.total_elapsed_seconds ?? run.duration_seconds);
  if (distanceKm <= 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return DEFAULT_SCORE;

  const pace = elapsedSeconds / distanceKm;
  const distanceScore = Math.min(1, distanceKm / RUNNING_REFERENCE.distanceKm) * 390;
  const paceScore = Math.min(1, RUNNING_REFERENCE.paceSecondsPerKm / Math.max(180, pace)) * 360;
  return clampScore(distanceScore + paceScore);
}

function runningVolumeBonus(runs: RunRecordLike[]) {
  const completedRuns = dedupeRuns(runs).filter(isCompletedRun);
  const totalDistanceKm = sumValues(completedRuns.map(runDistanceKm));
  const totalDurationSeconds = sumValues(completedRuns.map(runDurationSeconds));
  const distanceBonus = Math.min(1, totalDistanceKm / RUNNING_REFERENCE.volumeDistanceKm) * 160;
  const durationBonus = Math.min(1, totalDurationSeconds / RUNNING_REFERENCE.volumeDurationSeconds) * 90;
  return distanceBonus + durationBonus;
}

function calculateRepetitionScore(records: ExerciseRecord[], type: string, referenceRepsPerMinute: number) {
  const best = records
    .filter((record) => record.completed && record.type === type)
    .reduce((bestScore, record) => Math.max(bestScore, repetitionScoreFromRecord(record, referenceRepsPerMinute)), DEFAULT_SCORE);
  return Math.round(best);
}

function repetitionScoreFromRecord(record: ExerciseRecord, referenceRepsPerMinute: number) {
  const reps = Number(record.reps);
  const durationMinutes = Number(record.durationSeconds ?? 60) / 60;
  if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return DEFAULT_SCORE;

  const rateScore = Math.min(1, (reps / durationMinutes) / referenceRepsPerMinute) * 720;
  const accuracyScore = normalizeAccuracy(record) * 280;
  return clampScore(rateScore + accuracyScore);
}

function calculateExtraScore(records: ExerciseRecord[]) {
  const lunge = calculateRepetitionScore(records, 'lunge', REP_REFERENCE.extra);
  const jumpingJack = calculateRepetitionScore(records, 'jumping-jack', 120);
  return Math.max(lunge, jumpingJack);
}

function calculateBalanceBonus(scores: ExerciseScores, runs: RunRecordLike[], records: ExerciseRecord[]) {
  const allScored = RANKING_EXERCISES.every((exercise) => scores[exercise] > 0);
  if (!allScored) return 0;

  const recentAllDone = hasRecentRun(runs, 7) && ['squat', 'lunge', 'push-up'].every((type) => hasRecentRecord(records, type, 7))
    && (hasRecentRecord(records, 'lunge', 7) || hasRecentRecord(records, 'jumping-jack', 7));
  const minimum = Math.min(...RANKING_EXERCISES.map((exercise) => scores[exercise]));

  if (minimum >= 500) return 250;
  if (minimum >= 300) return 150;
  return recentAllDone ? 100 : 0;
}

function buildGhostScores(targetEr: number, ghostType: GhostProfileType, random: () => number): ExerciseScores {
  const weights = ghostWeights(ghostType);
  const weightSum = sumValues(Object.values(weights));
  const rawScores = RANKING_EXERCISES.map((exercise) => {
    const noise = 0.84 + random() * 0.32;
    return (targetEr * weights[exercise] / weightSum) * noise;
  });
  const rawTotal = sumValues(rawScores);
  const scale = targetEr / Math.max(1, rawTotal);
  const scores = RANKING_EXERCISES.reduce((next, exercise, index) => {
    next[exercise] = clampScore(rawScores[index] * scale);
    return next;
  }, {} as ExerciseScores);
  const drift = Math.round(targetEr - sumScores(scores));
  scores.extra = clampScore(scores.extra + drift);
  return scores;
}

function ghostWeights(type: GhostProfileType): Record<RankingExerciseType, number> {
  if (type === 'Runner Ghost') return { running: 1.55, squat: 0.85, lunge: 0.85, pushup: 0.85, extra: 0.9 };
  if (type === 'Strength Ghost') return { running: 0.75, squat: 1.35, lunge: 0.9, pushup: 1.35, extra: 0.9 };
  if (type === 'Endurance Ghost') return { running: 0.95, squat: 0.85, lunge: 1.6, pushup: 0.85, extra: 0.9 };
  if (type === 'Lazy Genius Ghost') return { running: 1.45, squat: 0.45, lunge: 1.45, pushup: 0.45, extra: 1.2 };
  if (type === 'Rookie Ghost') return { running: 0.95, squat: 0.95, lunge: 0.95, pushup: 0.95, extra: 0.95 };
  return { running: 1, squat: 1, lunge: 1, pushup: 1, extra: 1 };
}

function pickGhostType(level: EndureLevel, index: number) {
  if (level === 'Rookie') return index % 3 === 0 ? 'Rookie Ghost' : GHOST_TYPES[index % GHOST_TYPES.length];
  return GHOST_TYPES[index % (GHOST_TYPES.length - 1)];
}

function pickGhostErWithinLevel({
  min,
  max,
  userEr,
  random,
  index,
}: {
  min: number;
  max: number;
  userEr?: number;
  random: () => number;
  index: number;
}) {
  const boundedMax = Math.max(min, max);
  if (userEr != null && index < 18) {
    const near = userEr + (random() - 0.5) * 300;
    return Math.round(clampScore(near, min, boundedMax));
  }
  return Math.round(min + random() * (boundedMax - min));
}

function normalizeAccuracy(record: ExerciseRecord) {
  const direct = Number(record.qualityScore ?? (record as any).accuracy_score);
  if (Number.isFinite(direct) && direct > 0) return Math.min(1, direct > 1 ? direct / 100 : direct);

  const good = Number(record.goodSeconds ?? 0);
  const warning = Number(record.warningSeconds ?? 0);
  const bad = Number(record.badSeconds ?? 0);
  const total = good + warning + bad;
  if (total <= 0) return 0.8;
  return Math.min(1, Math.max(0, (good + warning * 0.55) / total));
}

function hasRecentRun(runs: RunRecordLike[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return runs.some((run) => new Date(run.ended_at ?? run.started_at ?? run.created_at ?? 0).getTime() >= cutoff);
}

function hasRecentRecord(records: ExerciseRecord[], type: string, days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return records.some((record) => record.completed && record.type === type && new Date(record.completedAt ?? 0).getTime() >= cutoff);
}

function runDistanceKm(run: RunRecordLike) {
  const meters = Number(run.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const km = Number(run.actual_distance_km ?? run.distanceKm);
  return Number.isFinite(km) && km > 0 ? km : 0;
}

function runDurationSeconds(run: RunRecordLike) {
  const seconds = Number(run.total_elapsed_seconds ?? run.duration_seconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function isCompletedRun(run: RunRecordLike) {
  if (run.status === 'completed') return true;
  if (run.status != null) return false;
  return Boolean(run.ended_at || run.created_at || run.started_at);
}

function dedupeRuns(runs: RunRecordLike[]) {
  const uniqueRuns = new Map<string, RunRecordLike>();
  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `${run.started_at ?? run.created_at ?? 'run'}-${index}`), run);
  });
  return [...uniqueRuns.values()];
}

function seededRandom(seed: string) {
  let state = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 2166136261);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sumScores(scores: ExerciseScores) {
  return RANKING_EXERCISES.reduce((total, exercise) => total + scores[exercise], 0);
}

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function clampScore(value: number, min = 0, max = SCORE_MAX) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function normalizeStoredScore(value: unknown) {
  return clampScore(Number(value));
}

function legacyScoreColumn() {
  return `${['p', 'l', 'a', 'n', 'k'].join('')}_score`;
}
