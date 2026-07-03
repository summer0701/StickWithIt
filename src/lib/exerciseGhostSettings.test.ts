import { beforeEach, describe, expect, it } from 'vitest';
import {
  exerciseGhostDisplayName,
  normalizeExerciseGhostSettings,
  readExerciseGhostDifficulty,
  readExerciseGhostSettings,
  writeExerciseGhostDifficulty,
  writeExerciseGhostSettings,
} from './exerciseGhostSettings';

describe('exerciseGhostSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores ghost slots independently for each exercise', () => {
    const squat = readExerciseGhostSettings('user-1', 'squat');
    const lunge = readExerciseGhostSettings('user-1', 'lunge');

    writeExerciseGhostSettings('user-1', 'squat', [
      { ...squat[0], name: '스쿼트 베스트', averageValue: 42 },
      ...squat.slice(1),
    ]);
    writeExerciseGhostSettings('user-1', 'lunge', [
      { ...lunge[0], name: '런지 베스트', averageValue: 75 },
      ...lunge.slice(1),
    ]);

    expect(exerciseGhostDisplayName('bestGhost', readExerciseGhostSettings('user-1', 'squat'))).toBe('스쿼트 베스트');
    expect(exerciseGhostDisplayName('bestGhost', readExerciseGhostSettings('user-1', 'lunge'))).toBe('런지 베스트');
    expect(readExerciseGhostSettings('user-1', 'squat')[0].averageValue).toBe(42);
    expect(readExerciseGhostSettings('user-1', 'lunge')[0].averageValue).toBe(75);
  });

  it('normalizes slot names, metric values, and difficulty settings', () => {
    const settings = normalizeExerciseGhostSettings([
      { key: 'bestGhost', name: '  12345678901234567890  ', averageValue: 1200 },
      { key: 'averageGhost', name: 'G2', averageValue: -1 },
    ]);

    expect(settings[0].name).toBe('1234567890123456');
    expect(settings[0].averageValue).toBe(999);
    expect(settings[1].averageValue).toBeNull();

    writeExerciseGhostDifficulty('user-1', 'pushup', { difficulty: 'custom', customDistanceKm: 38.24 });

    expect(readExerciseGhostDifficulty('user-1', 'pushup')).toEqual({
      difficulty: 'custom',
      customDistanceKm: 38.2,
    });
  });
});
