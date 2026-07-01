export type RankingExerciseType = 'running' | 'squat' | 'plank' | 'pushup' | 'extra';
export type EndureLevel = 'Rookie' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type GhostProfileType = 'Balanced Ghost' | 'Runner Ghost' | 'Strength Ghost' | 'Endurance Ghost' | 'Lazy Genius Ghost' | 'Rookie Ghost';
export type RankingTab = 'league' | 'overall' | 'friends' | 'ghosts';

export const RANKING_EXERCISES: RankingExerciseType[] = ['running', 'squat', 'plank', 'pushup', 'extra'];
export const RANKING_LEAGUE_SIZE = 50;
export const BASE_ER_MAX = 5000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const ENDURE_LEVELS: Array<{ level: EndureLevel; min: number; max: number }> = [
  { level: 'Rookie', min: 0, max: 999 },
  { level: 'Bronze', min: 1000, max: 1999 },
  { level: 'Silver', min: 2000, max: 2999 },
  { level: 'Gold', min: 3000, max: 3999 },
  { level: 'Platinum', min: 4000, max: 4499 },
  { level: 'Diamond', min: 4500, max: Number.POSITIVE_INFINITY },
];

export const EXERCISE_LABELS: Record<RankingExerciseType, string> = {
  running: '러닝',
  squat: '스쿼트',
  plank: '플랭크',
  pushup: '푸쉬업',
  extra: '기타',
};

export const GHOST_NAMES = [
  'Ghost Alpha',
  'Ghost Nova',
  'Ghost Titan',
  'Ghost Luna',
  'Ghost Orion',
  'Ghost Vega',
  'Ghost Pulse',
  'Ghost Echo',
  'Ghost Blaze',
  'Ghost Comet',
];

export const GHOST_TYPES: GhostProfileType[] = [
  'Balanced Ghost',
  'Runner Ghost',
  'Strength Ghost',
  'Endurance Ghost',
  'Lazy Genius Ghost',
  'Rookie Ghost',
];

export const RANKING_TAB_LABELS: Record<RankingTab, string> = {
  league: '내 리그',
  overall: '전체 랭킹',
  friends: '친구 랭킹',
  ghosts: '고스트 랭킹',
};
