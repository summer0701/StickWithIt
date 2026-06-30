import { describe, expect, it } from 'vitest';
import {
  blendGhostRoute,
  clampPaceChange,
  createGhostPackFromBase,
  createHeuristicGhostRunData,
  createHeuristicGhostPack,
  generateNaturalGhost,
  ghostPackRouteToRunner,
  normalizeGhostDistance,
  replaceGeneratedGhostSmoothly,
  smoothRandomVariation,
} from './naturalGhostPack';

const baseGhost = {
  id: 'real_001',
  name: '기준 고스트',
  type: 'real',
  route: [
    { minute: 0, distance: 0 },
    { minute: 1, distance: 120 },
    { minute: 2, distance: 245 },
    { minute: 3, distance: 370 },
    { minute: 4, distance: 488 },
    { minute: 5, distance: 612 },
  ],
};

describe('naturalGhostPack', () => {
  it('creates five deterministic generated ghosts from one base ghost', () => {
    const first = createGhostPackFromBase(baseGhost);
    const second = createGhostPackFromBase(baseGhost);

    expect(first).toEqual(second);
    expect(first.map((ghost) => ghost.id)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5']);
    expect(first.map((ghost) => ghost.name)).toEqual(['베스트 고스트', '평균 고스트', '안정 고스트', '추격 고스트', '워스트 고스트']);
  });

  it('keeps generated route distances monotonic and target-scaled', () => {
    const ghosts = createGhostPackFromBase(baseGhost);

    ghosts.forEach((ghost) => {
      for (let index = 1; index < ghost.route.length; index += 1) {
        expect(ghost.route[index].distance).toBeGreaterThanOrEqual(ghost.route[index - 1].distance);
      }
    });
    expect(ghosts[0].route.at(-1).distance).toBeCloseTo(baseGhost.route.at(-1).distance * 1.05, 3);
    expect(ghosts[4].route.at(-1).distance).toBeCloseTo(baseGhost.route.at(-1).distance * 0.92, 3);
  });

  it('keeps a zero-second checkpoint for second-by-second interpolation', () => {
    const runner = ghostPackRouteToRunner(createGhostPackFromBase(baseGhost)[0]);

    expect(runner.checkpoints[0]).toEqual({ elapsedSeconds: 0, distanceMeters: 0 });
    expect(runner.checkpoints[1].elapsedSeconds).toBe(60);
    expect(runner.checkpoints[1].distanceMeters).toBeGreaterThan(0);
  });

  it('creates beginner heuristic ghosts with human minute speed changes and target records', () => {
    const ghosts = createHeuristicGhostPack({ difficulty: 'beginner', seed: 'new-run' });

    expect(ghosts).toHaveLength(5);
    expect(ghosts.map((ghost) => ghost.id)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5']);
    expect(ghosts.map((ghost) => ghost.name)).toEqual(['워스트 고스트', '쉬운 고스트', '평균 고스트', '도전 고스트', '베스트 고스트']);
    expect(ghosts.map((ghost) => ghost.role)).toEqual(['easy_win', 'steady_win', 'baseline', 'next_goal', 'long_term_goal']);
    expect(ghosts.map((ghost) => ghost.source)).toEqual(Array(5).fill('initial_default'));
    expect(ghosts.map((ghost) => ghost.avgSpeedKmh)).toEqual([5.8, 6.5, 7.2, 7.8, 8.3]);

    ghosts.forEach((ghost) => {
      expect(ghost.targetTime).toMatch(/^\d+:\d{2}$/);
      expect(ghost.route.at(-1).distance).toBe(2000);
      expect(ghost.points.at(-1)).toEqual({ minute: ghost.route.at(-1).minute, distanceM: 2000 });
      expect(ghost.pace).toMatch(/\/km$/);
      expect(ghost.speedProfile).toHaveLength(Math.ceil(ghost.targetSeconds / 60));
      expect(new Set(ghost.speedProfile).size).toBeGreaterThan(1);
      expect(typeof ghost.finishSprint).toBe('boolean');
      for (let index = 1; index < ghost.speedProfile.length; index += 1) {
        expect(Math.abs(ghost.speedProfile[index] - ghost.speedProfile[index - 1])).toBeLessThanOrEqual(8);
      }
    });
    expect(ghosts.map((ghost) => ghost.targetSeconds)).toEqual([...ghosts].map((ghost) => ghost.targetSeconds).sort((a, b) => b - a));
    expect(Math.abs(ghosts[2].targetSeconds - 1000)).toBeLessThanOrEqual(9);
  });

  it('starts beginner ghosts gently and finishes faster without abrupt changes', () => {
    const ghosts = createHeuristicGhostPack({ difficulty: 'beginner', seed: 'start-a' });

    ghosts.forEach((ghost) => {
      const earlyAverage = average(ghost.speedProfile.slice(0, Math.max(1, Math.floor(ghost.speedProfile.length * 0.2))));
      const middleAverage = average(ghost.speedProfile.slice(
        Math.floor(ghost.speedProfile.length * 0.2),
        Math.max(Math.floor(ghost.speedProfile.length * 0.8), Math.floor(ghost.speedProfile.length * 0.2) + 1),
      ));
      const lateAverage = average(ghost.speedProfile.slice(Math.floor(ghost.speedProfile.length * 0.8)));

      expect(earlyAverage).toBeLessThan(middleAverage);
      expect(lateAverage).toBeGreaterThan(middleAverage);
    });
  });

  it('changes heuristic ghosts between new starts while preserving difficulty', () => {
    const first = createHeuristicGhostPack({ difficulty: 'beginner', seed: 'start-a' });
    const second = createHeuristicGhostPack({ difficulty: 'beginner', seed: 'start-b' });

    expect(first.map((ghost) => ghost.targetSeconds)).not.toEqual(second.map((ghost) => ghost.targetSeconds));
    expect(first[0].avgSpeedKmh).toBe(5.8);
    expect(second[4].avgSpeedKmh).toBe(8.3);
  });

  it('uses difficulty distances and custom distance for heuristic ghosts', () => {
    expect(createHeuristicGhostPack({ difficulty: 'novice', seed: 'same' })[0].route.at(-1).distance).toBe(3000);
    expect(createHeuristicGhostPack({ difficulty: 'standard', seed: 'same' })[0].route.at(-1).distance).toBe(5000);
    expect(createHeuristicGhostPack({ difficulty: 'custom', customDistanceKm: 4.2, seed: 'same' })[0].route.at(-1).distance).toBe(4200);
  });

  it('returns the requested JSON contract for initial ghost run data', () => {
    const data = createHeuristicGhostRunData({ difficulty: 'beginner', seed: 'json-contract' });

    expect(data.distanceKm).toBe(2);
    expect(data.mode).toBe('beginner');
    expect(data.ghosts).toHaveLength(5);
    expect(data.ghosts[0]).toMatchObject({
      id: 'G1',
      name: '워스트 고스트',
      source: 'initial_default',
      avgSpeedKmh: 5.8,
      targetRole: 'easy_win',
    });
    expect(data.ghosts[0].points[0]).toEqual({ minute: 0, distanceM: 0 });
  });

  it('smooths seeded random variation and changes when seed changes', () => {
    const a = smoothRandomVariation(6, 'same-seed');
    const b = smoothRandomVariation(6, 'same-seed');
    const c = smoothRandomVariation(6, 'other-seed');

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.every((value) => value >= 0.92 && value <= 1.08)).toBe(true);
  });

  it('limits minute delta changes with clampPaceChange', () => {
    expect(clampPaceChange(150, 100, 0.15)).toBeCloseTo(115);
    expect(clampPaceChange(70, 100, 0.15)).toBe(85);
  });

  it('normalizes final distance and blends route replacement smoothly', () => {
    const normalized = normalizeGhostDistance(baseGhost.route, 1000);
    expect(normalized.at(-1).distance).toBe(1000);

    const oldGhost = generateNaturalGhost(baseGhost, { id: 'G1', name: '베스트 고스트', speedFactor: 1.02 }, 'old');
    const newGhost = generateNaturalGhost({ ...baseGhost, id: 'real_002' }, { id: 'G1', name: '베스트 고스트', speedFactor: 1.08 }, 'new');
    const blended = blendGhostRoute(oldGhost, newGhost, 0.25);
    expect(blended.at(-1).distance).toBeGreaterThan(oldGhost.route.at(-1).distance);
    expect(blended.at(-1).distance).toBeLessThan(newGhost.route.at(-1).distance);

    const replaced = replaceGeneratedGhostSmoothly([oldGhost], { ...baseGhost, id: 'real_002' }, 0.4);
    expect(replaced).toHaveLength(5);
    expect(replaced[0].route.at(-1).distance).toBeGreaterThan(0);
  });
});

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
