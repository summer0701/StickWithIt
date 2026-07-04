import type { ExerciseRecord } from './exerciseRecords';

export type RankingPeriod = 'today' | 'week' | 'month';

export type NeighborhoodProfile = {
  verified: boolean;
  districtName: string;
  districtCode: string;
  verifiedAt: string;
};

export type NeighborhoodProfileRow = {
  neighborhood_name?: string | null;
  neighborhood_code?: string | null;
  neighborhood_verified_at?: string | null;
};

export type NeighborhoodContributionRow = {
  user_id: string;
  neighborhood_code: string;
  neighborhood_name: string;
  points: number;
  source_type: string;
  source_record_id: string;
  contributed_on: string;
};

export type SimpleRankEntry = {
  id: string;
  rank: number;
  name: string;
  score: number;
  movement: number;
  isMine?: boolean;
};

type RivalInfo = {
  title: string;
  name: string;
  gapText: string;
  actionText: string;
};

export type LastNeighborhoodContribution = {
  points: number;
  recordId?: string;
  savedAt: string;
};

export const NEIGHBORHOOD_CORE_MESSAGE = '오늘 운동하면 우리 동네가 올라갑니다.';
const PROFILE_KEY_PREFIX = 'stickWithIt:neighborhood-profile:';
const LAST_CONTRIBUTION_KEY_PREFIX = 'stickWithIt:last-neighborhood-contribution:';

const sampleNeighborhoods: SimpleRankEntry[] = [
  { id: 'kr-48123-joongang', rank: 1, name: '중앙동', score: 9820, movement: 5 },
  { id: 'kr-48123-sapa', rank: 2, name: '사파동', score: 9712, movement: -2 },
  { id: 'kr-48123-banlim', rank: 3, name: '반림동', score: 9560, movement: 0 },
  { id: 'kr-48123-yongho', rank: 4, name: '용호동', score: 9410, movement: 3 },
  { id: 'kr-48123-gageum', rank: 5, name: '가음정동', score: 9322, movement: 1 },
  { id: 'kr-48123-seongsan', rank: 6, name: '성주동', score: 9210, movement: -1 },
  { id: 'kr-48123-daebang', rank: 7, name: '대방동', score: 9108, movement: 4 },
  { id: 'kr-48123-ungnam', rank: 8, name: '웅남동', score: 9006, movement: 0 },
  { id: 'kr-48123-bansong', rank: 9, name: '반송동', score: 8920, movement: -3 },
  { id: 'kr-48123-palyong', rank: 10, name: '팔용동', score: 8840, movement: 2 },
  { id: 'kr-48123-myeongseo', rank: 11, name: '명서동', score: 8764, movement: -1 },
  { id: 'kr-48123-dogye', rank: 12, name: '도계동', score: 8698, movement: 0 },
  { id: 'kr-48123-bonggok', rank: 13, name: '봉곡동', score: 8612, movement: 1 },
  { id: 'kr-48123-sarim', rank: 14, name: '사림동', score: 8540, movement: 0 },
  { id: 'kr-48123-sinchon', rank: 15, name: '신촌동', score: 8464, movement: -2 },
  { id: 'kr-48123-yongji', rank: 16, name: '용지동', score: 8388, movement: 2 },
  { id: 'kr-48123-samjeongja', rank: 17, name: '삼정자동', score: 8316, movement: 1 },
  { id: 'kr-48123-naedong', rank: 18, name: '내동', score: 8240, movement: -1 },
  { id: 'kr-48123-toechon', rank: 19, name: '퇴촌동', score: 8172, movement: 0 },
  { id: 'kr-48123-bongrim', rank: 20, name: '봉림동', score: 8104, movement: -2 },
  { id: 'kr-48123-bongam', rank: 148, name: '봉암동', score: 6565, movement: 0 },
  { id: 'kr-48123-yangdeok', rank: 149, name: '양덕동', score: 6560, movement: 1 },
  { id: 'kr-48123-hapseong', rank: 150, name: '합성동', score: 6550, movement: -1 },
  { id: 'kr-48123-hoewon', rank: 151, name: '회원동', score: 6540, movement: 0 },
  { id: 'kr-48123-gusan', rank: 152, name: '구산동', score: 6530, movement: -2 },
  { id: 'kr-48123-wolyeong', rank: 153, name: '월영동', score: 6520, movement: 3 },
  { id: 'kr-48123-happo', rank: 154, name: '합포동', score: 6510, movement: 0 },
  { id: 'kr-48123-yeojwa', rank: 155, name: '여좌동', score: 6500, movement: 2 },
  { id: 'kr-48123-seokjeon', rank: 156, name: '석전동', score: 6490, movement: -1 },
  { id: 'kr-48123-sangnam', rank: 157, name: '상남동', score: 6480, movement: 8, isMine: true },
  { id: 'kr-48123-gapo', rank: 158, name: '가포동', score: 6468, movement: 0 },
];

const samplePeople: SimpleRankEntry[] = [
  { id: 'p1', rank: 1, name: '운동왕**', score: 2040, movement: 6 },
  { id: 'p2', rank: 2, name: '김**', score: 1988, movement: 3 },
  { id: 'p3', rank: 3, name: '박**', score: 1912, movement: -1 },
  { id: 'p4', rank: 4, name: '이**', score: 1840, movement: 0 },
  { id: 'p5', rank: 5, name: '최**', score: 1772, movement: 1 },
  { id: 'p6', rank: 6, name: '정**', score: 1708, movement: -2 },
  { id: 'p7', rank: 7, name: '한**', score: 1664, movement: 0 },
  { id: 'p8', rank: 8, name: '서**', score: 1598, movement: 2 },
  { id: 'p9', rank: 9, name: '강**', score: 1530, movement: -1 },
  { id: 'p10', rank: 10, name: '윤**', score: 1488, movement: 0 },
  { id: 'p11', rank: 11, name: '오**', score: 1420, movement: 1 },
  { id: 'p12', rank: 12, name: '임**', score: 1376, movement: -1 },
  { id: 'p13', rank: 13, name: '조**', score: 1312, movement: 0 },
  { id: 'p14', rank: 14, name: '신**', score: 1254, movement: 3 },
  { id: 'p15', rank: 15, name: '문**', score: 1190, movement: -2 },
  { id: 'p16', rank: 16, name: '배**', score: 1134, movement: 1 },
  { id: 'p17', rank: 17, name: '권**', score: 1072, movement: 0 },
  { id: 'p18', rank: 18, name: '남**', score: 1010, movement: -1 },
  { id: 'p19', rank: 19, name: '하**', score: 956, movement: 2 },
  { id: 'p20', rank: 20, name: '유**', score: 952, movement: 0 },
  { id: 'p837', rank: 837, name: '민**', score: 875, movement: 1 },
  { id: 'p838', rank: 838, name: '송**', score: 868, movement: -1 },
  { id: 'p839', rank: 839, name: '장**', score: 861, movement: 0 },
  { id: 'p840', rank: 840, name: '홍**', score: 854, movement: 2 },
  { id: 'p841', rank: 841, name: '러닝**', score: 847, movement: 0 },
  { id: 'me', rank: 842, name: '나', score: 840, movement: 12, isMine: true },
  { id: 'p843', rank: 843, name: '지**', score: 832, movement: -2 },
];

export function readNeighborhoodProfile(userId: string): NeighborhoodProfile | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NeighborhoodProfile;
    if (!parsed?.verified || !parsed.districtName || !parsed.districtCode) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(PROFILE_KEY_PREFIX + userId);
    return null;
  }
}

export function saveNeighborhoodProfile(userId: string, profile: NeighborhoodProfile) {
  if (!canUseLocalStorage()) return profile;
  const safeProfile = {
    verified: true,
    districtName: profile.districtName,
    districtCode: profile.districtCode,
    verifiedAt: profile.verifiedAt,
  };
  window.localStorage.setItem(PROFILE_KEY_PREFIX + userId, JSON.stringify(safeProfile));
  return safeProfile;
}

export function neighborhoodProfileToRow(profile: NeighborhoodProfile) {
  return {
    neighborhood_name: profile.districtName,
    neighborhood_code: profile.districtCode,
    neighborhood_verified_at: profile.verifiedAt,
  };
}

export function neighborhoodProfileFromRow(row: NeighborhoodProfileRow | null | undefined): NeighborhoodProfile | null {
  if (!row?.neighborhood_name || !row.neighborhood_code || !row.neighborhood_verified_at) return null;
  return {
    verified: true,
    districtName: row.neighborhood_name,
    districtCode: row.neighborhood_code,
    verifiedAt: row.neighborhood_verified_at,
  };
}

export function resolveNeighborhoodFromGps(latitude: number, longitude: number): NeighborhoodProfile {
  const district = resolveKnownDistrict(latitude, longitude);
  return {
    verified: true,
    districtName: district.name,
    districtCode: district.code,
    verifiedAt: new Date().toISOString(),
  };
}

export function buildHomeRankingSummary(profile: NeighborhoodProfile | null, records: ExerciseRecord[]) {
  const contribution = calculateTodayContribution(records);
  const districtName = profile?.districtName ?? '동네 미인증';
  const rankingView = buildRankingView(profile, records, 'today');
  const myNeighborhood = rankingView.neighborhoodEntries.find((entry) => entry.isMine);
  const myPersonal = rankingView.personalEntries.find((entry) => entry.isMine);
  return {
    coreMessage: NEIGHBORHOOD_CORE_MESSAGE,
    contribution,
    country: {
      title: '🇰🇷 국가 순위',
      status: '준비중',
    },
    neighborhood: {
      title: profile ? `🏠 ${districtName}` : '🏠 우리 동네 순위',
      rankText: profile && myNeighborhood ? `전국 ${myNeighborhood.rank}위 ${movementText(myNeighborhood.movement)}` : '인증 필요',
      detail: profile ? '오늘 운동하면 올라갑니다' : '동네 인증하면 랭킹에 참여할 수 있어요',
    },
    personal: {
      title: '👤 내 순위',
      rankText: myPersonal ? `${myPersonal.rank}위 ${movementText(myPersonal.movement)}` : '842위 ▲12',
      detail: `오늘 기여 +${contribution}점`,
    },
  };
}

export function saveLastNeighborhoodContribution(userId: string, record: ExerciseRecord) {
  const contribution = {
    points: contributionScoreForRecord(record),
    recordId: record.id,
    savedAt: new Date().toISOString(),
  };
  if (canUseLocalStorage()) {
    window.localStorage.setItem(LAST_CONTRIBUTION_KEY_PREFIX + userId, JSON.stringify(contribution));
  }
  return contribution;
}

export function readLastNeighborhoodContribution(userId: string): LastNeighborhoodContribution | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_CONTRIBUTION_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastNeighborhoodContribution;
    if (!Number.isFinite(parsed.points) || parsed.points <= 0 || !parsed.savedAt) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(LAST_CONTRIBUTION_KEY_PREFIX + userId);
    return null;
  }
}

export function contributionScoreForRecord(record: ExerciseRecord) {
  return recordScore(record);
}

export function neighborhoodContributionToRow({
  userId,
  profile,
  record,
  sourceType = record.type,
}: {
  userId: string;
  profile: NeighborhoodProfile;
  record: ExerciseRecord;
  sourceType?: string;
}): NeighborhoodContributionRow {
  return {
    user_id: userId,
    neighborhood_code: profile.districtCode,
    neighborhood_name: profile.districtName,
    points: contributionScoreForRecord(record),
    source_type: sourceType,
    source_record_id: record.id ?? `${record.type}-${record.completedAt ?? new Date().toISOString()}`,
    contributed_on: toDateKey(record.completedAt ?? new Date().toISOString()),
  };
}

export function buildRankingView(profile: NeighborhoodProfile | null, records: ExerciseRecord[], period: RankingPeriod) {
  const contribution = calculateContribution(records, period);
  const allNeighborhoodEntries = applyContributionToMine(sampleNeighborhoods.map((entry) => ({
    ...entry,
    name: entry.isMine && profile ? profile.districtName : entry.name,
    score: entry.isMine ? entry.score + contribution : entry.score,
  })));
  const allPersonalEntries = applyContributionToMine(samplePeople.map((entry) => ({
    ...entry,
    score: entry.isMine ? entry.score + contribution : entry.score,
  })));
  const neighborhoodEntries = rankTopTwentyWithMine(allNeighborhoodEntries);
  const personalEntries = rankTopTwentyWithMine(allPersonalEntries);
  const myNeighborhood = neighborhoodEntries.find((entry) => entry.isMine);
  const myPersonal = personalEntries.find((entry) => entry.isMine);
  const neighborhoodRival = buildRivalInfo('neighborhood', allNeighborhoodEntries);
  const personalRival = buildRivalInfo('personal', allPersonalEntries);

  return {
    coreMessage: NEIGHBORHOOD_CORE_MESSAGE,
    contribution,
    profile,
    period,
    countryEntries: [],
    neighborhoodEntries,
    personalEntries,
    neighborhoodPrediction: profile && myNeighborhood
      ? buildNeighborhoodPrediction(profile.districtName, myNeighborhood, contribution)
      : NEIGHBORHOOD_CORE_MESSAGE,
    personalPrediction: myPersonal
      ? buildPersonalPrediction(myPersonal)
      : NEIGHBORHOOD_CORE_MESSAGE,
    neighborhoodRival,
    personalRival,
  };
}

export function movementText(movement: number) {
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return '-';
}

function calculateTodayContribution(records: ExerciseRecord[]) {
  return calculateContribution(records, 'today');
}

function calculateContribution(records: ExerciseRecord[], period: RankingPeriod) {
  const start = periodStart(period);
  return records
    .filter((record) => record.completed)
    .filter((record) => new Date(record.completedAt ?? 0).getTime() >= start.getTime())
    .reduce((sum, record) => sum + recordScore(record), 0);
}

function recordScore(record: ExerciseRecord) {
  const reps = record.reps ?? 0;
  const distance = Math.round((record.distanceKm ?? 0) * 100);
  const seconds = Math.round((record.goodSeconds ?? record.durationSeconds ?? 0) / 10);
  return Math.max(1, Math.round(reps + distance + seconds));
}

function toDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function rankTopTwentyWithMine(entries: SimpleRankEntry[]) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const topTwenty = sorted.filter((entry) => entry.rank <= 20);
  const mine = sorted.find((entry) => entry.isMine);
  if (mine && !topTwenty.some((entry) => entry.id === mine.id)) {
    return [...topTwenty, mine];
  }
  return topTwenty;
}

function applyContributionToMine(entries: SimpleRankEntry[]) {
  const mine = entries.find((entry) => entry.isMine);
  if (!mine) return entries;

  const surpassed = entries
    .filter((entry) => !entry.isMine && entry.rank < mine.rank)
    .filter((entry) => entry.score <= mine.score)
    .length;
  const nextRank = Math.max(1, mine.rank - surpassed);

  return entries.map((entry) => {
    if (!entry.isMine) return entry;
    return {
      ...entry,
      rank: nextRank,
      movement: entry.rank - nextRank,
    };
  });
}

function buildRivalInfo(kind: 'neighborhood' | 'personal', entries: SimpleRankEntry[]): RivalInfo {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const mine = sorted.find((entry) => entry.isMine);
  const rival = mine ? [...sorted].reverse().find((entry) => !entry.isMine && entry.rank < mine.rank) : null;
  const gap = Math.max(1, (rival?.score ?? 0) - (mine?.score ?? 0));

  if (kind === 'personal') {
    return {
      title: '바로 위 사용자',
      name: rival?.name ?? '운동왕**',
      gapText: `차이 ${gap}점`,
      actionText: `점핑잭 ${gap}개면 역전`,
    };
  }

  return {
    title: '바로 위 동네',
    name: rival?.name ?? '중앙동',
    gapText: `차이 ${gap}점`,
    actionText: `스쿼트 ${gap}개면 역전`,
  };
}

function buildNeighborhoodPrediction(name: string, mine: SimpleRankEntry, contribution: number) {
  const needed = Math.max(0, 80 - contribution);
  const targetRank = Math.max(1, mine.rank - 8);
  if (needed <= 0) return `${name} ${mine.rank}위 ▲${Math.max(1, mine.movement)}`;
  return `오늘 ${needed}점만 더하면 ${name} ${mine.rank}위 → ${targetRank}위`;
}

function buildPersonalPrediction(mine: SimpleRankEntry) {
  if (mine.movement > 0) return `내 순위 ${mine.rank}위 ▲${mine.movement}`;
  return '오늘 운동하면 내 순위가 올라갑니다.';
}

function periodStart(period: RankingPeriod) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }
  if (period === 'month') {
    start.setDate(1);
  }
  return start;
}

function resolveKnownDistrict(latitude: number, longitude: number) {
  if (latitude >= 35.20 && latitude <= 35.24 && longitude >= 128.66 && longitude <= 128.70) {
    return { name: '상남동', code: 'KR-48123-SANGNAM' };
  }
  if (latitude >= 35.21 && latitude <= 35.25 && longitude >= 128.62 && longitude < 128.66) {
    return { name: '중앙동', code: 'KR-48123-JOONGANG' };
  }
  if (latitude >= 35.18 && latitude < 35.22 && longitude >= 128.68 && longitude <= 128.73) {
    return { name: '사파동', code: 'KR-48123-SAPA' };
  }
  return {
    name: '현재 위치 동네',
    code: 'GPS-VERIFIED-DISTRICT',
  };
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
