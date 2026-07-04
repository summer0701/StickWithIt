import { describe, expect, it } from 'vitest';
import {
  buildHomeRankingSummary,
  buildRankingView,
  NEIGHBORHOOD_CORE_MESSAGE,
  neighborhoodProfileFromRow,
  neighborhoodProfileToRow,
  neighborhoodContributionToRow,
  readLastNeighborhoodContribution,
  resolveNeighborhoodFromGps,
  saveLastNeighborhoodContribution,
  saveNeighborhoodProfile,
  movementText,
} from './neighborhoodRanking';

describe('neighborhoodRanking', () => {
  it('stores only verified district data, not exact GPS coordinates', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const saved = saveNeighborhoodProfile('user-1', profile);

    expect(saved.districtName).toBe('상남동');
    expect(saved.districtCode).toBe('KR-48123-SANGNAM');
    expect(saved.regionName).toBe('경상남도 창원시');
    expect(saved.regionCode).toBe('KR-48-CHANGWON');
    expect(JSON.stringify(saved)).not.toContain('35.223');
    expect(JSON.stringify(saved)).not.toContain('128.681');
  });

  it('serializes neighborhood profile rows without exact coordinates', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const row = neighborhoodProfileToRow(profile);

    expect(row).toEqual({
      neighborhood_name: '상남동',
      neighborhood_code: 'KR-48123-SANGNAM',
      region_name: '경상남도 창원시',
      region_code: 'KR-48-CHANGWON',
      neighborhood_verified_at: profile.verifiedAt,
    });
    expect(JSON.stringify(row)).not.toContain('latitude');
    expect(JSON.stringify(row)).not.toContain('longitude');
    expect(neighborhoodProfileFromRow(row)?.districtName).toBe('상남동');
  });

  it('does not derive fallback district codes from coordinate buckets', () => {
    const profile = resolveNeighborhoodFromGps(37.5665, 126.9780);

    expect(profile.districtCode).toBe('GPS-VERIFIED-DISTRICT');
    expect(profile.regionCode).toBe('GPS-VERIFIED-REGION');
    expect(JSON.stringify(profile)).not.toContain('3757');
    expect(JSON.stringify(profile)).not.toContain('12698');
  });

  it('keeps the one core message on the home summary', () => {
    const summary = buildHomeRankingSummary(null, []);

    expect(summary.coreMessage).toBe(NEIGHBORHOOD_CORE_MESSAGE);
    expect(summary.neighborhood.rankText).toBe('인증 필요');
  });

  it('does not create fake ranking rows without workout data', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const view = buildRankingView(profile, [], 'today');

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
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const view = buildRankingView(profile, [
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
      expect.objectContaining({ name: '경상남도 창원시', rank: 1, score: 84, isMine: true }),
    ]);
    expect(view.personalEntries).toEqual([
      expect.objectContaining({ name: '나', rank: 1, score: 84, isMine: true }),
    ]);
    expect(view.neighborhoodPrediction).toContain('경상남도 창원시 1위 · 오늘 +84점');
    expect(view.personalPrediction).toContain('내 순위 1위 · 오늘 +84점');
    expect(view.neighborhoodRival).toMatchObject({
      title: '바로 위 동네',
      gapText: '실제 랭킹 데이터 대기 중',
    });
  });

  it('formats ranking movement with simple arrows', () => {
    expect(movementText(8)).toBe('▲8');
    expect(movementText(-2)).toBe('▼2');
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

  it('serializes contribution rows without exact coordinates', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const row = neighborhoodContributionToRow({
      userId: 'user-1',
      profile,
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
      neighborhood_code: 'KR-48123-SANGNAM',
      neighborhood_name: '상남동',
      region_code: 'KR-48-CHANGWON',
      region_name: '경상남도 창원시',
      source_record_id: 'run-1',
      contributed_on: '2026-07-04',
    });
    expect(row.points).toBe(180);
    expect(JSON.stringify(row)).not.toContain('35.223');
    expect(JSON.stringify(row)).not.toContain('128.681');
  });
});
