import type { ExerciseRecord } from './exerciseRecords';
import { supabase } from './supabaseClient';

export type RankingPeriod = 'today' | 'week' | 'month';

export type NeighborhoodProfile = {
  verified: boolean;
  neighborhoodName: string;
  neighborhoodCode: string;
  districtName: string;
  districtCode: string;
  regionName: string;
  regionCode: string;
  latitude?: number;
  longitude?: number;
  verifiedAt: string;
};

export type NeighborhoodProfileRow = {
  neighborhood_name?: string | null;
  neighborhood_code?: string | null;
  district_name?: string | null;
  district_code?: string | null;
  region_name?: string | null;
  region_code?: string | null;
  neighborhood_lat?: number | null;
  neighborhood_lng?: number | null;
  neighborhood_verified_at?: string | null;
};

export type NeighborhoodContributionRow = {
  user_id: string;
  neighborhood_code: string;
  neighborhood_name: string;
  district_name: string;
  region_code: string;
  region_name: string;
  neighborhood_lat?: number;
  neighborhood_lng?: number;
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
const PLACEHOLDER_NEIGHBORHOODS = new Set(['현재 위치 동네', '내 동네', '인증된 동네', '동네 미인증']);

export function formatNeighborhoodDisplayName(
  profile: Pick<NeighborhoodProfile, 'neighborhoodName' | 'districtName' | 'regionName'> | null | undefined,
) {
  const neighborhoodName = cleanDisplayNamePart(profile?.neighborhoodName);
  const districtName = cleanDisplayNamePart(profile?.districtName);
  const regionName = cleanDisplayNamePart(profile?.regionName);

  if (!neighborhoodName) return districtName || regionName || '동네';
  if (districtName && districtName !== neighborhoodName && !neighborhoodName.startsWith(`${districtName} `)) {
    return `${districtName} ${neighborhoodName}`;
  }
  if (!districtName && regionName && regionName !== neighborhoodName && !neighborhoodName.startsWith(`${regionName} `)) {
    return `${regionName} ${neighborhoodName}`;
  }
  return neighborhoodName;
}

export function readNeighborhoodProfile(userId: string): NeighborhoodProfile | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NeighborhoodProfile;
    const normalized = normalizeNeighborhoodProfile(parsed);
    if (!isRealNeighborhoodProfile(normalized)) return null;
    return normalized;
  } catch {
    window.localStorage.removeItem(PROFILE_KEY_PREFIX + userId);
    return null;
  }
}

export function saveNeighborhoodProfile(userId: string, profile: NeighborhoodProfile) {
  const normalized = normalizeNeighborhoodProfile(profile);
  if (!isRealNeighborhoodProfile(normalized)) {
    throw new Error('동네를 확인하지 못했어요.');
  }
  if (!canUseLocalStorage()) return normalized;
  const safeProfile = {
    verified: true,
    neighborhoodName: normalized.neighborhoodName,
    neighborhoodCode: normalized.neighborhoodCode,
    districtName: normalized.districtName,
    districtCode: normalized.districtCode,
    regionName: normalized.regionName,
    regionCode: normalized.regionCode,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    verifiedAt: normalized.verifiedAt,
  };
  window.localStorage.setItem(PROFILE_KEY_PREFIX + userId, JSON.stringify(safeProfile));
  return safeProfile;
}

export function neighborhoodProfileToRow(profile: NeighborhoodProfile) {
  return {
    neighborhood_name: profile.neighborhoodName,
    neighborhood_code: profile.neighborhoodCode,
    district_name: profile.districtName,
    district_code: profile.districtCode,
    region_name: profile.regionName,
    region_code: profile.regionCode,
    neighborhood_lat: profile.latitude,
    neighborhood_lng: profile.longitude,
    neighborhood_verified_at: profile.verifiedAt,
  };
}

export function neighborhoodProfileFromRow(row: NeighborhoodProfileRow | null | undefined): NeighborhoodProfile | null {
  if (!row?.neighborhood_name || !row.neighborhood_code || !row.neighborhood_verified_at) return null;
  const profile = normalizeNeighborhoodProfile({
    verified: true,
    neighborhoodName: row.neighborhood_name,
    neighborhoodCode: row.neighborhood_code,
    districtName: row.district_name ?? row.neighborhood_name,
    districtCode: row.district_code ?? row.neighborhood_code,
    regionName: row.region_name ?? row.district_name ?? row.neighborhood_name,
    regionCode: row.region_code ?? row.district_code ?? row.neighborhood_code,
    latitude: row.neighborhood_lat ?? undefined,
    longitude: row.neighborhood_lng ?? undefined,
    verifiedAt: row.neighborhood_verified_at,
  });
  return isRealNeighborhoodProfile(profile) ? profile : null;
}

export async function resolveNeighborhoodFromGps(latitude: number, longitude: number): Promise<NeighborhoodProfile> {
  const { data, error } = await supabase.functions.invoke('reverse-geocode', {
    body: { latitude, longitude },
  });

  if (error || !data?.neighborhood_name || !data?.district_name || !data?.region_name) {
    throw new Error('동네를 확인하지 못했어요.');
  }

  const profile = normalizeNeighborhoodProfile({
    verified: true,
    neighborhoodName: String(data.neighborhood_name),
    neighborhoodCode: String(data.neighborhood_code ?? data.neighborhood_name),
    districtName: String(data.district_name),
    districtCode: String(data.district_code ?? data.district_name),
    regionName: String(data.region_name),
    regionCode: String(data.region_code ?? data.region_name),
    latitude,
    longitude,
    verifiedAt: new Date().toISOString(),
  });

  if (!isRealNeighborhoodProfile(profile)) {
    throw new Error('동네를 확인하지 못했어요.');
  }

  return profile;
}

export function buildHomeRankingSummary(profile: NeighborhoodProfile | null, records: ExerciseRecord[]) {
  const contribution = calculateTodayContribution(records);
  const neighborhoodName = profile ? formatNeighborhoodDisplayName(profile) : '동네 미인증';
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
      title: profile ? `🏠 ${neighborhoodName}` : '🏠 우리 동네 순위',
      rankText: profile ? (myNeighborhood ? `전국 ${myNeighborhood.rank}위 ${movementText(myNeighborhood.movement)}` : '0 ER') : '인증 필요',
      detail: profile ? '오늘 운동하면 올라갑니다' : '동네 인증하면 랭킹에 참여할 수 있어요',
    },
    personal: {
      title: '👤 내 순위',
      rankText: myPersonal ? `${myPersonal.rank}위 ${movementText(myPersonal.movement)}` : '기록 필요',
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
    neighborhood_code: profile.neighborhoodCode,
    neighborhood_name: profile.neighborhoodName,
    district_name: profile.districtName,
    region_code: profile.regionCode,
    region_name: profile.regionName,
    neighborhood_lat: profile.latitude,
    neighborhood_lng: profile.longitude,
    points: contributionScoreForRecord(record),
    source_type: sourceType,
    source_record_id: record.id ?? `${record.type}-${record.completedAt ?? new Date().toISOString()}`,
    contributed_on: toDateKey(record.completedAt ?? new Date().toISOString()),
  };
}

export function buildRankingView(profile: NeighborhoodProfile | null, records: ExerciseRecord[], period: RankingPeriod) {
  const contribution = calculateContribution(records, period);
  const neighborhoodDisplayName = profile ? formatNeighborhoodDisplayName(profile) : '동네';
  const neighborhoodEntries = profile && contribution > 0
    ? [{
      id: profile.neighborhoodCode,
      rank: 1,
      name: neighborhoodDisplayName,
      score: contribution,
      movement: 0,
      isMine: true,
    }]
    : [];
  const personalEntries = contribution > 0
    ? [{
      id: 'me',
      rank: 1,
      name: '나',
      score: contribution,
      movement: 0,
      isMine: true,
    }]
    : [];
  const myNeighborhood = neighborhoodEntries.find((entry) => entry.isMine);
  const myPersonal = personalEntries.find((entry) => entry.isMine);
  const neighborhoodRival = buildRivalInfo('neighborhood', neighborhoodEntries);
  const personalRival = buildRivalInfo('personal', personalEntries);

  return {
    coreMessage: NEIGHBORHOOD_CORE_MESSAGE,
    contribution,
    profile,
    period,
    countryEntries: [],
    neighborhoodEntries,
    personalEntries,
    neighborhoodPrediction: profile && myNeighborhood
      ? buildNeighborhoodPrediction(neighborhoodDisplayName, myNeighborhood, contribution)
      : NEIGHBORHOOD_CORE_MESSAGE,
    personalPrediction: myPersonal
      ? buildPersonalPrediction(myPersonal)
      : NEIGHBORHOOD_CORE_MESSAGE,
    neighborhoodRival,
    personalRival,
  };
}

export function movementText(movement: number) {
  if (movement > 0) return `▲ ${movement}`;
  if (movement < 0) return `▼ ${Math.abs(movement)}`;
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

function buildRivalInfo(kind: 'neighborhood' | 'personal', entries: SimpleRankEntry[]): RivalInfo {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const mine = sorted.find((entry) => entry.isMine);
  const rival = mine ? [...sorted].reverse().find((entry) => !entry.isMine && entry.rank < mine.rank) : null;
  const gap = Math.max(0, (rival?.score ?? 0) - (mine?.score ?? 0));

  if (kind === 'personal') {
    return {
      title: '바로 위 사용자',
      name: rival?.name ?? '아직 비교 대상 없음',
      gapText: rival ? `차이 ${gap}점` : '실제 랭킹 데이터 대기 중',
      actionText: rival ? `점핑잭 ${gap}개면 역전` : '운동 기록을 저장하면 반영됩니다',
    };
  }

  return {
    title: '바로 위 동네',
    name: rival?.name ?? '아직 비교 대상 없음',
    gapText: rival ? `차이 ${gap}점` : '실제 랭킹 데이터 대기 중',
    actionText: rival ? `스쿼트 ${gap}개면 역전` : '동네 인증 후 운동하면 반영됩니다',
  };
}

function buildNeighborhoodPrediction(name: string, mine: SimpleRankEntry, contribution: number) {
  if (contribution <= 0) return '오늘 운동하면 우리 동네가 올라갑니다.';
  return `${name} ${mine.rank}위 · 오늘 +${contribution}점`;
}

function buildPersonalPrediction(mine: SimpleRankEntry) {
  return `내 순위 ${mine.rank}위 · 오늘 +${mine.score}점`;
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

function normalizeNeighborhoodProfile(profile: NeighborhoodProfile): NeighborhoodProfile {
  const neighborhoodName = String(profile.neighborhoodName ?? profile.districtName ?? '').trim();
  const neighborhoodCode = String(profile.neighborhoodCode ?? profile.districtCode ?? '').trim();
  const districtName = String(profile.districtName ?? '').trim();
  const districtCode = String(profile.districtCode ?? '').trim();
  const regionName = String(profile.regionName ?? districtName ?? neighborhoodName).trim();
  const regionCode = String(profile.regionCode ?? districtCode ?? neighborhoodCode).trim();

  return {
    verified: true,
    neighborhoodName,
    neighborhoodCode,
    districtName,
    districtCode,
    regionName,
    regionCode,
    latitude: profile.latitude,
    longitude: profile.longitude,
    verifiedAt: profile.verifiedAt,
  };
}

function cleanDisplayNamePart(value: unknown) {
  return String(value ?? '').trim();
}

function isRealNeighborhoodProfile(profile: NeighborhoodProfile | null | undefined) {
  if (!profile?.verified) return false;
  if (!profile.neighborhoodName || !profile.neighborhoodCode || !profile.verifiedAt) return false;
  return !PLACEHOLDER_NEIGHBORHOODS.has(profile.neighborhoodName);
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
