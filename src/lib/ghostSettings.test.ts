import { describe, expect, it } from 'vitest';
import {
  applyGhostSettingsToRunners,
  defaultGhostDifficulty,
  defaultGhostSettings,
  ghostDifficultyTargetKm,
  ghostDisplayName,
  normalizeGhostDifficulty,
  normalizeGhostSettings,
} from './ghostSettings';

describe('ghostSettings', () => {
  it('uses G1 through G5 when names are empty', () => {
    const settings = normalizeGhostSettings([
      { key: 'bestGhost', name: '' },
      { key: 'averageGhost', name: '  ' },
    ]);

    expect(ghostDisplayName('bestGhost', settings)).toBe('G1');
    expect(ghostDisplayName('averageGhost', settings)).toBe('G2');
    expect(ghostDisplayName('stableGhost', settings)).toBe('G3');
    expect(ghostDisplayName('chaserGhost', settings)).toBe('G4');
    expect(ghostDisplayName('slowGhost', settings)).toBe('G5');
  });

  it('does not invent default speeds when a speed is blank', () => {
    const settings = normalizeGhostSettings([
      { key: 'bestGhost', averageSpeedKmh: '' },
      { key: 'averageGhost', averageSpeedKmh: null },
    ]);

    expect(settings[0].averageSpeedKmh).toBeNull();
    expect(settings[1].averageSpeedKmh).toBeNull();
  });

  it('keeps names by slot when the ghost runner changes', () => {
    const settings = normalizeGhostSettings([
      { key: 'bestGhost', name: '스피드' },
      { key: 'averageGhost', name: '평균' },
    ]);
    const first = applyGhostSettingsToRunners({
      runners: [{ key: 'bestGhost', sourceRunId: 'old', totalDistanceMeters: 5000, totalElapsedSeconds: 1500 }],
      settings,
      targetDistanceKm: 5,
    });
    const second = applyGhostSettingsToRunners({
      runners: [{ key: 'bestGhost', sourceRunId: 'new', totalDistanceMeters: 5000, totalElapsedSeconds: 1400 }],
      settings,
      targetDistanceKm: 5,
    });

    expect(first[0].label).toBe('스피드');
    expect(second[0].label).toBe('스피드');
    expect(second[0].sourceRunId).toBe('new');
  });

  it('overrides a ghost runner with configured average speed', () => {
    const settings = defaultGhostSettings();
    settings[0] = { ...settings[0], averageSpeedKmh: 12 };
    const ghosts = applyGhostSettingsToRunners({
      runners: [{ key: 'bestGhost', totalDistanceMeters: 3000, totalElapsedSeconds: 1200, checkpoints: [{ elapsedSeconds: 60, distanceMeters: 150 }] }],
      settings,
      targetDistanceKm: 3,
    });

    expect(ghosts[0].totalElapsedSeconds).toBe(900);
    expect(ghosts[0].checkpoints).toEqual([{ elapsedSeconds: 45, distanceMeters: 150 }]);
  });

  it('creates a configured speed ghost even when no past run exists', () => {
    const settings = defaultGhostSettings();
    settings[1] = { ...settings[1], averageSpeedKmh: 10 };
    const ghosts = applyGhostSettingsToRunners({ runners: [], settings, targetDistanceKm: 5 });

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].key).toBe('averageGhost');
    expect(ghosts[0].label).toBe('G2');
    expect(ghosts[0].totalElapsedSeconds).toBe(1800);
  });

  it('starts new users on beginner ghost difficulty at 2km', () => {
    const difficulty = defaultGhostDifficulty();

    expect(difficulty).toEqual({ difficulty: 'beginner', customDistanceKm: 2 });
    expect(ghostDifficultyTargetKm(difficulty)).toBe(2);
  });

  it('normalizes ghost difficulty and custom distance safely', () => {
    expect(normalizeGhostDifficulty({ difficulty: 'standard', customDistanceKm: 8.24 })).toEqual({
      difficulty: 'standard',
      customDistanceKm: 8.2,
    });
    expect(ghostDifficultyTargetKm({ difficulty: 'custom', customDistanceKm: 4.5 })).toBe(4.5);
    expect(normalizeGhostDifficulty({ difficulty: 'broken', customDistanceKm: -1 })).toEqual({
      difficulty: 'beginner',
      customDistanceKm: 2,
    });
  });

  it('preserves generated heuristic target pace when applying display settings', () => {
    const ghosts = applyGhostSettingsToRunners({
      runners: [{
        key: 'bestGhost',
        totalDistanceMeters: 2000,
        totalElapsedSeconds: 1080,
        checkpoints: [{ elapsedSeconds: 60, distanceMeters: 100 }],
        preservePace: true,
      }],
      settings: defaultGhostSettings(),
      targetDistanceKm: 2,
    });

    expect(ghosts[0].totalElapsedSeconds).toBe(1080);
    expect(ghosts[0].checkpoints).toEqual([{ elapsedSeconds: 60, distanceMeters: 100 }]);
  });
});
