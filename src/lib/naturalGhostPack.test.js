import { describe, expect, it } from 'vitest';
import {
  blendGhostRoute,
  clampPaceChange,
  createGhostPackFromBase,
  generateNaturalGhost,
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
