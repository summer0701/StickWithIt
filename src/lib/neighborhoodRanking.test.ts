import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHomeRankingSummary,
  buildRankingView,
  formatNeighborhoodDisplayName,
  movementText,
  NEIGHBORHOOD_CORE_MESSAGE,
  neighborhoodContributionToRow,
  neighborhoodProfileFromRow,
  neighborhoodProfileToRow,
  readLastNeighborhoodContribution,
  resolveNeighborhoodFromGps,
  saveLastNeighborhoodContribution,
  saveNeighborhoodProfile,
  type NeighborhoodProfile,
} from './neighborhoodRanking';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

const realProfile: NeighborhoodProfile = {
  verified: true,
  neighborhoodName: '상남동',
  neighborhoodCode: 'H-4812312700',
  districtName: '창원시 성산구',
  districtCode: '48123',
  regionName: '경상남도',
  regionCode: '48',
  latitude: 35.223,
  longitude: 128.681,
  verifiedAt: '2026-07-05T00:00:00.000Z',
};

describe('neighborhoodRanking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        neighborhood_name: realProfile.neighborhoodName,
        neighborhood_code: realProfile.neighborhoodCode,
        district_name: realProfile.districtName,
        district_code: realProfile.districtCode,
        region_name: realProfile.regionName,
        region_code: realProfile.regionCode,
      },
      error: null,
    });
  });

  it('resolves a neighborhood through the reverse-geocode edge function', async () => {
    const profile = await resolveNeighborhoodFromGps(35.223, 128.681);

    expect(invokeMock).toHaveBeenCalledWith('reverse-geocode', {
      body: { latitude: 35.223, longitude: 128.681 },
    });
    expect(profile).toMatchObject({
      neighborhoodName: '상남동',
      districtName: '창원시 성산구',
      regionName: '경상남도',
      latitude: 35.223,
      longitude: 128.681,
    });
  });

  it('does not save placeholder neighborhoods as verified profiles', () => {
    expect(() => saveNeighborhoodProfile('user-1', {
      ...realProfile,
      neighborhoodName: '현재 위치 동네',
      neighborhoodCode: 'GPS-VERIFIED-DISTRICT',
    })).toThrow('동네를 확인하지 못했어요.');
  });

  it('serializes real neighborhood profile rows with district and coordinates', () => {
    const row = neighborhoodProfileToRow(realProfile);

    expect(row).toEqual({
      neighborhood_name: '상남동',
      neighborhood_code: 'H-4812312700',
      district_name: '창원시 성산구',
      district_code: '48123',
      region_name: '경상남도',
      region_code: '48',
      neighborhood_lat: 35.223,
      neighborhood_lng: 128.681,
      neighborhood_verified_at: realProfile.verifiedAt,
    });
    expect(neighborhoodProfileFromRow(row)).toMatchObject({
      neighborhoodName: '상남동',
      districtName: '창원시 성산구',
      regionName: '경상남도',
    });
  });

  it('rejects remote rows that only contain placeholder neighborhoods', () => {
    expect(neighborhoodProfileFromRow({
      neighborhood_name: '현재 위치 동네',
      neighborhood_code: 'GPS-VERIFIED-DISTRICT',
      neighborhood_verified_at: realProfile.verifiedAt,
    })).toBeNull();
  });

  it('keeps the one core message on the home summary', () => {
    const summary = buildHomeRankingSummary(null, []);

    expect(summary.coreMessage).toBe(NEIGHBORHOOD_CORE_MESSAGE);
    expect(summary.neighborhood.rankText).toBe('인증 필요');
  });

  it('does not show auth required on the home summary after neighborhood verification', () => {
    const summary = buildHomeRankingSummary(realProfile, []);

    expect(summary.neighborhood.title).toContain('창원시 성산구 상남동');
    expect(summary.neighborhood.rankText).toBe('0 ER');
  });

  it('formats neighborhood names with district context for duplicate dong names', () => {
    expect(formatNeighborhoodDisplayName({
      neighborhoodName: '가호동',
      districtName: '진주시',
      regionName: '경상남도',
    })).toBe('진주시 가호동');
    expect(formatNeighborhoodDisplayName({
      neighborhoodName: '진주시 가호동',
      districtName: '진주시',
      regionName: '경상남도',
    })).toBe('진주시 가호동');
    expect(formatNeighborhoodDisplayName({
      neighborhoodName: '가호동',
      districtName: '',
      regionName: '경상남도',
    })).toBe('경상남도 가호동');
  });

  it('does not create fake ranking rows without workout data', () => {
    const view = buildRankingView(realProfile, [], 'today');

    expect(view.neighborhoodEntries).toEqual([]);
    expect(view.personalEntries).toEqual([]);
  });

  it('shows only my real personal ranking row when local workout data exists', () => {
    const view = buildRankingView(null, [{
      id: 'record-1',
      userId: 'user-1',
      type: 'jumping-jack',
      completed: true,
      completedAt: new Date().toISOString(),
      reps: 84,
      durationSeconds: 0,
    }], 'today');

    expect(view.neighborhoodEntries).toEqual([]);
    expect(view.personalEntries).toEqual([
      expect.objectContaining({ name: '나', rank: 1, score: 84, isMine: true }),
    ]);
  });

  it('uses today contribution for real local neighborhood and personal rows', () => {
    const view = buildRankingView(realProfile, [
      {
        id: 'record-1',
        userId: 'user-1',
        type: 'jumping-jack',
        completed: true,
        completedAt: new Date().toISOString(),
        reps: 84,
        durationSeconds: 0,
      },
    ], 'today');

    expect(view.contribution).toBe(84);
    expect(view.neighborhoodEntries).toEqual([
      expect.objectContaining({ name: '창원시 성산구 상남동', rank: 1, score: 84, isMine: true }),
    ]);
    expect(view.personalEntries).toEqual([
      expect.objectContaining({ name: '나', rank: 1, score: 84, isMine: true }),
    ]);
    expect(view.neighborhoodPrediction).toContain('창원시 성산구 상남동');
    expect(view.personalPrediction).toContain('1위');
  });

  it('formats ranking movement with simple arrows', () => {
    expect(movementText(8)).toBe('▲ 8');
    expect(movementText(-2)).toBe('▼ 2');
    expect(movementText(0)).toBe('-');
  });

  it('stores the last workout contribution for the home ranking card', () => {
    const contribution = saveLastNeighborhoodContribution('user-1', {
      id: 'record-1',
      userId: 'user-1',
      type: 'jumping-jack',
      completed: true,
      reps: 42,
      durationSeconds: 60,
    });

    expect(contribution.points).toBe(48);
    expect(readLastNeighborhoodContribution('user-1')?.points).toBe(48);
  });

  it('serializes contribution rows only for a real neighborhood', () => {
    const row = neighborhoodContributionToRow({
      userId: 'user-1',
      profile: realProfile,
      record: {
        id: 'run-1',
        userId: 'user-1',
        type: 'running',
        completed: true,
        completedAt: '2026-07-04T03:10:00.000Z',
        distanceKm: 1.2,
        durationSeconds: 600,
      },
    });

    expect(row).toMatchObject({
      user_id: 'user-1',
      neighborhood_code: 'H-4812312700',
      neighborhood_name: '상남동',
      district_name: '창원시 성산구',
      region_code: '48',
      region_name: '경상남도',
      neighborhood_lat: 35.223,
      neighborhood_lng: 128.681,
      source_record_id: 'run-1',
      contributed_on: '2026-07-04',
    });
    expect(row.points).toBe(180);
  });
});
