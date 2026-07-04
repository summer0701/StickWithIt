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
    expect(JSON.stringify(saved)).not.toContain('35.223');
    expect(JSON.stringify(saved)).not.toContain('128.681');
  });

  it('serializes neighborhood profile rows without exact coordinates', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const row = neighborhoodProfileToRow(profile);

    expect(row).toEqual({
      neighborhood_name: '상남동',
      neighborhood_code: 'KR-48123-SANGNAM',
      neighborhood_verified_at: profile.verifiedAt,
    });
    expect(JSON.stringify(row)).not.toContain('latitude');
    expect(JSON.stringify(row)).not.toContain('longitude');
    expect(neighborhoodProfileFromRow(row)?.districtName).toBe('상남동');
  });

  it('does not derive fallback district codes from coordinate buckets', () => {
    const profile = resolveNeighborhoodFromGps(37.5665, 126.9780);

    expect(profile.districtCode).toBe('GPS-VERIFIED-DISTRICT');
    expect(JSON.stringify(profile)).not.toContain('3757');
    expect(JSON.stringify(profile)).not.toContain('12698');
  });

  it('keeps the one core message on the home summary', () => {
    const summary = buildHomeRankingSummary(null, []);

    expect(summary.coreMessage).toBe(NEIGHBORHOOD_CORE_MESSAGE);
    expect(summary.neighborhood.rankText).toBe('인증 필요');
  });

  it('shows my neighborhood outside top 20 after a separator candidate', () => {
    const profile = resolveNeighborhoodFromGps(35.223, 128.681);
    const view = buildRankingView(profile, [], 'today');

    expect(view.neighborhoodEntries).toHaveLength(21);
    expect(view.neighborhoodEntries[19]?.rank).toBe(20);
    expect(view.neighborhoodEntries.at(-1)?.isMine).toBe(true);
    expect(view.neighborhoodEntries.at(-1)?.rank).toBeGreaterThan(20);
  });

  it('shows personal ranking rows as a selectable ranking tab source', () => {
    const view = buildRankingView(null, [], 'today');

    expect(view.personalEntries).toHaveLength(21);
    expect(view.personalEntries[0]?.rank).toBe(1);
    expect(view.personalEntries[19]?.rank).toBe(20);
    expect(view.personalEntries.at(-1)).toMatchObject({ isMine: true });
  });

  it('uses today contribution to raise neighborhood and personal ranks', () => {
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
    expect(view.neighborhoodEntries.at(-1)).toMatchObject({ name: '상남동', rank: 149, movement: 8 });
    expect(view.personalEntries.at(-1)).toMatchObject({ name: '나', rank: 837, movement: 5 });
    expect(view.neighborhoodPrediction).toContain('상남동 149위 ▲8');
    expect(view.personalPrediction).toContain('내 순위 837위 ▲5');
    expect(view.neighborhoodRival).toMatchObject({
      title: '바로 위 동네',
      gapText: '차이 1점',
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
      source_record_id: 'run-1',
      contributed_on: '2026-07-04',
    });
    expect(row.points).toBe(180);
    expect(JSON.stringify(row)).not.toContain('35.223');
    expect(JSON.stringify(row)).not.toContain('128.681');
  });
});
