import { describe, expect, it } from 'vitest';
import {
  buildLeagueRanking,
  buildLeagueRankingFromRatings,
  calculateEndureRating,
  calculateSeasonBadges,
  calculateSeasonOutcome,
  endureRatingFromStoredRow,
  endureRatingToRow,
  generateGhostEntries,
  getEndureLevel,
  rankingEntriesToRows,
} from './endureRanking';
import { RANKING_LEAGUE_SIZE } from './endureRankingConstants';

describe('endureRanking', () => {
  it('converts mixed exercise units to 0-1000 scores before summing ER', () => {
    const rating = calculateEndureRating({
      userId: 'user-1',
      displayName: 'Tester',
      runs: [{ actual_distance_km: 5, duration_seconds: 1800, ended_at: new Date().toISOString() }],
      exerciseRecords: [
        { userId: 'user-1', type: 'squat', completed: true, durationSeconds: 60, reps: 80, qualityScore: 90, completedAt: new Date().toISOString() },
        { userId: 'user-1', type: 'lunge', completed: true, durationSeconds: 60, reps: 50, qualityScore: 90, completedAt: new Date().toISOString() },
        { userId: 'user-1', type: 'push-up', completed: true, durationSeconds: 60, reps: 50, qualityScore: 85, completedAt: new Date().toISOString() },
        { userId: 'user-1', type: 'jumping-jack', completed: true, durationSeconds: 60, reps: 70, qualityScore: 80, completedAt: new Date().toISOString() },
      ],
    });

    expect(Object.values(rating.scores).every((score) => score >= 0 && score <= 1000)).toBe(true);
    expect(rating.baseEr).toBe(Object.values(rating.scores).reduce((sum, score) => sum + score, 0));
    expect(rating.bonusEr).toBeGreaterThan(0);
    expect(rating.totalEr).toBe(rating.baseEr + rating.bonusEr);
  });

  it('assigns levels from ER ranges', () => {
    expect(getEndureLevel(999)).toBe('Rookie');
    expect(getEndureLevel(1000)).toBe('Bronze');
    expect(getEndureLevel(3000)).toBe('Gold');
    expect(getEndureLevel(4500)).toBe('Diamond');
  });

  it('adds running distance and time volume to ER even when the best pace is unchanged', () => {
    const first = calculateEndureRating({
      userId: 'user-1',
      displayName: 'Tester',
      runs: [
        { id: 'run-1', status: 'completed', actual_distance_km: 1, duration_seconds: 600, ended_at: '2026-07-01T00:00:00.000Z' },
      ],
    });
    const second = calculateEndureRating({
      userId: 'user-1',
      displayName: 'Tester',
      runs: [
        { id: 'run-1', status: 'completed', actual_distance_km: 1, duration_seconds: 600, ended_at: '2026-07-01T00:00:00.000Z' },
        { id: 'run-2', status: 'completed', actual_distance_km: 1, duration_seconds: 600, ended_at: '2026-07-02T00:00:00.000Z' },
      ],
    });

    expect(second.scores.running).toBeGreaterThan(first.scores.running);
    expect(second.totalEr).toBeGreaterThan(first.totalEr);
  });

  it('fills the current league to 50 with transparent level-bounded ghosts', () => {
    const league = buildLeagueRanking({
      currentUser: {
        userId: 'user-1',
        displayName: 'Tester',
        runs: [{ actual_distance_km: 5, duration_seconds: 1800 }],
        exerciseRecords: [
          { userId: 'user-1', type: 'squat', completed: true, durationSeconds: 60, reps: 80, qualityScore: 90 },
          { userId: 'user-1', type: 'lunge', completed: true, durationSeconds: 60, reps: 50, qualityScore: 90 },
          { userId: 'user-1', type: 'push-up', completed: true, durationSeconds: 60, reps: 50, qualityScore: 90 },
          { userId: 'user-1', type: 'jumping-jack', completed: true, durationSeconds: 60, reps: 70, qualityScore: 90 },
        ],
      },
      now: new Date('2026-07-01T00:00:00Z'),
    });

    expect(league.entries).toHaveLength(RANKING_LEAGUE_SIZE);
    expect(league.entries.some((entry) => entry.entryType === 'user' && entry.isCurrentUser)).toBe(true);
    expect(league.entries.filter((entry) => entry.entryType === 'ghost')).toHaveLength(RANKING_LEAGUE_SIZE - 1);
    expect(league.entries.every((entry) => entry.level === league.level)).toBe(true);
    expect(league.entries).toEqual([...league.entries].sort((a, b) => b.totalEr - a.totalEr));
  });

  it('generates ghosts within the requested level range', () => {
    const ghosts = generateGhostEntries({ level: 'Gold', neededCount: 20, userEr: 3560, seed: 'gold-test' });

    expect(ghosts).toHaveLength(20);
    expect(ghosts.every((ghost) => ghost.entryType === 'ghost')).toBe(true);
    expect(ghosts.every((ghost) => ghost.totalEr >= 3000 && ghost.totalEr <= 3999)).toBe(true);
    expect(new Set(ghosts.map((ghost) => ghost.ghostType)).size).toBeGreaterThan(1);
  });

  it('mixes stored real user ratings before filling remaining slots with ghosts', () => {
    const currentRating = endureRatingFromStoredRow({
      user_id: 'user-1',
      running_score: 700,
      squat_score: 700,
      lunge_score: 700,
      pushup_score: 700,
      extra_score: 700,
      base_er: 3500,
      bonus_er: 0,
      total_er: 3500,
      level: 'Gold',
      display_name: 'Me',
    });
    const peers = Array.from({ length: 4 }, (_, index) => endureRatingFromStoredRow({
      user_id: `peer-${index}`,
      running_score: 650,
      squat_score: 650,
      lunge_score: 650,
      pushup_score: 650,
      extra_score: 650,
      base_er: 3250 + index,
      bonus_er: 0,
      total_er: 3250 + index,
      level: 'Gold',
      display_name: `Peer ${index}`,
    }));

    const league = buildLeagueRankingFromRatings({ currentRating, peerRatings: peers });

    expect(league.entries).toHaveLength(RANKING_LEAGUE_SIZE);
    expect(league.realUserCount).toBe(5);
    expect(league.ghostCount).toBe(RANKING_LEAGUE_SIZE - 5);
  });

  it('keeps first-season users from demotion', () => {
    expect(calculateSeasonOutcome(49, 50, true).outcome).toBe('stay');
    expect(calculateSeasonOutcome(49, 50, false).outcome).toBe('demotion');
    expect(calculateSeasonOutcome(1, 50, false).badge).toBe('Champion Badge');
  });

  it('awards season badges including balanced endurer separately', () => {
    const result = calculateSeasonBadges({
      rank: 8,
      memberCount: 50,
      isFirstSeason: false,
      scores: { running: 500, squat: 450, lunge: 400, pushup: 420, extra: 380 },
    });

    expect(result.outcome).toBe('promotion');
    expect(result.badges).toEqual(expect.arrayContaining(['Elite Badge', 'Promotion Badge', 'Balanced Endurer Badge']));
  });

  it('serializes ratings and ranking entries with Supabase column names', () => {
    const rating = calculateEndureRating({ userId: 'user-1', displayName: 'Tester' });
    const ratingRow = endureRatingToRow(rating, '2026-07-01T00:00:00.000Z');
    const league = buildLeagueRankingFromRatings({ currentRating: rating });
    const userEntry = league.entries.find((entry) => entry.userId === 'user-1');
    const entryRows = rankingEntriesToRows(userEntry ? [userEntry] : [], 'league-1', '2026-07-01T00:00:00.000Z');

    expect(ratingRow).toMatchObject({
      user_id: 'user-1',
      running_score: 0,
      base_er: 0,
      total_er: 0,
      updated_at: '2026-07-01T00:00:00.000Z',
    });
    expect(entryRows).toHaveLength(1);
    expect(entryRows[0]).toMatchObject({
      league_id: 'league-1',
      entry_type: 'user',
      display_name: 'Tester',
      rank: userEntry?.rank,
      updated_at: '2026-07-01T00:00:00.000Z',
    });
  });
});
