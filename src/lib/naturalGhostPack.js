const DEFAULT_PROFILES = [
  {
    id: 'G1',
    key: 'bestGhost',
    name: '베스트 고스트',
    speedFactor: 1.05,
    variationMin: 0.92,
    variationMax: 1.08,
    stable: 0.58,
    dipStrength: 0.035,
  },
  {
    id: 'G2',
    key: 'averageGhost',
    name: '평균 고스트',
    speedFactor: 1.0,
    variationMin: 0.92,
    variationMax: 1.08,
    stable: 0.68,
    dipStrength: 0.025,
  },
  {
    id: 'G3',
    key: 'stableGhost',
    name: '안정 고스트',
    speedFactor: 0.99,
    variationMin: 0.96,
    variationMax: 1.04,
    stable: 0.86,
    dipStrength: 0.012,
  },
  {
    id: 'G4',
    key: 'chaserGhost',
    name: '추격 고스트',
    speedFactor: 1.0,
    variationMin: 0.92,
    variationMax: 1.08,
    stable: 0.62,
    chaser: true,
    dipStrength: 0.02,
  },
  {
    id: 'G5',
    key: 'slowGhost',
    name: '워스트 고스트',
    speedFactor: 0.92,
    variationMin: 0.88,
    variationMax: 1.03,
    stable: 0.7,
    dipStrength: 0.018,
  },
];

const MAX_CHANGE_RATIO = 0.15;

export function createGhostPackFromBase(baseGhost) {
  const normalizedBase = normalizeBaseGhost(baseGhost);
  return DEFAULT_PROFILES.map((profile, index) => generateNaturalGhost(normalizedBase, profile, `${normalizedBase.id}:${profile.id}:${index}`));
}

export function generateNaturalGhost(baseGhost, profile, seed) {
  const base = normalizeBaseGhost(baseGhost);
  const route = base.route;
  const variations = smoothRandomVariation(Math.max(0, route.length - 1), seed, profile);
  const deltas = [];
  let previousDelta = null;

  for (let index = 1; index < route.length; index += 1) {
    const baseDelta = Math.max(0, Number(route[index].distance) - Number(route[index - 1].distance));
    const progress = route.length <= 2 ? 1 : (index - 1) / (route.length - 2);
    const chaserFactor = profile.chaser ? 0.9 + progress * 0.2 : 1;
    const dipFactor = naturalDipFactor(progress, profile, index);
    const rawDelta = Math.max(0, baseDelta * profile.speedFactor * chaserFactor * variations[index - 1] * dipFactor);
    const delta = previousDelta == null ? rawDelta : clampPaceChange(rawDelta, previousDelta, MAX_CHANGE_RATIO);
    deltas.push(delta);
    previousDelta = delta;
  }

  const generatedRoute = rebuildRouteFromDeltas(route, deltas);
  const baseTotalDistance = route[route.length - 1]?.distance ?? 0;
  const targetTotalDistance = Math.max(0, baseTotalDistance * profile.speedFactor);

  return {
    id: profile.id,
    key: profile.key ?? profile.id,
    name: profile.name,
    type: 'generated',
    route: normalizeGhostDistance(generatedRoute, targetTotalDistance),
  };
}

export function smoothRandomVariation(length, seed, profile = {}) {
  const random = seededRandom(seed);
  const min = Number(profile.variationMin ?? 0.92);
  const max = Number(profile.variationMax ?? 1.08);
  const stable = Number(profile.stable ?? 0.65);
  const values = [];
  let current = 1;

  for (let index = 0; index < length; index += 1) {
    const target = min + random() * (max - min);
    current = current * stable + target * (1 - stable);
    values.push(clamp(current, min, max));
  }

  return values;
}

export function clampPaceChange(currentPace, previousPace, maxChangeRatio) {
  const current = Math.max(0, Number(currentPace) || 0);
  const previous = Math.max(0, Number(previousPace) || 0);
  if (previous <= 0) return current;
  const ratio = Math.max(0, Number(maxChangeRatio) || 0);
  return clamp(current, previous * (1 - ratio), previous * (1 + ratio));
}

export function normalizeGhostDistance(route, targetTotalDistance) {
  const normalizedRoute = normalizeRoute(route);
  if (normalizedRoute.length === 0) return [];

  const currentTotal = normalizedRoute[normalizedRoute.length - 1].distance;
  const target = Math.max(0, Number(targetTotalDistance) || 0);
  if (currentTotal <= 0) {
    return normalizedRoute.map((point, index) => ({
      ...point,
      distance: index === normalizedRoute.length - 1 ? target : 0,
    }));
  }

  let previousDistance = 0;
  return normalizedRoute.map((point, index) => {
    const scaled = index === 0 ? 0 : point.distance * (target / currentTotal);
    const distance = index === normalizedRoute.length - 1 ? target : Math.max(previousDistance, scaled);
    previousDistance = distance;
    return { ...point, distance: roundDistance(distance) };
  });
}

export function blendGhostRoute(oldGhost, newGhost, blendRatio) {
  const oldRoute = normalizeRoute(oldGhost?.route ?? []);
  const newRoute = normalizeRoute(newGhost?.route ?? []);
  if (oldRoute.length === 0) return newRoute;
  if (newRoute.length === 0) return oldRoute;

  const ratio = clamp(Number(blendRatio) || 0, 0, 1);
  const minutes = sortedUniqueMinutes(oldRoute, newRoute);
  let previousDistance = 0;
  const route = minutes.map((minute) => {
    const oldDistance = distanceAtMinute(oldRoute, minute);
    const newDistance = distanceAtMinute(newRoute, minute);
    const distance = Math.max(previousDistance, oldDistance * (1 - ratio) + newDistance * ratio);
    previousDistance = distance;
    return { minute, distance: roundDistance(distance) };
  });

  return route;
}

export function replaceGeneratedGhostSmoothly(ghostPack, newRealGhost, blendRatio) {
  const nextPack = createGhostPackFromBase(newRealGhost);
  const oldById = new Map((ghostPack ?? []).map((ghost) => [ghost.id, ghost]));

  return nextPack.map((newGhost) => {
    const oldGhost = oldById.get(newGhost.id);
    if (!oldGhost) return newGhost;
    return {
      ...newGhost,
      route: blendGhostRoute(oldGhost, newGhost, blendRatio),
    };
  });
}

export function ghostPackRouteToRunner(ghost) {
  const route = normalizeRoute(ghost?.route ?? []);
  const last = route[route.length - 1] ?? { minute: 0, distance: 0 };
  return {
    key: ghost.key ?? ghost.id,
    label: ghost.name,
    generatedGhostId: ghost.id,
    totalDistanceMeters: last.distance,
    totalElapsedSeconds: Math.max(1, Number(last.minute) * 60),
    checkpoints: route
      .filter((point) => point.minute > 0)
      .map((point) => ({
        elapsedSeconds: Math.round(Number(point.minute) * 60),
        distanceMeters: point.distance,
      })),
  };
}

function normalizeBaseGhost(baseGhost) {
  return {
    id: String(baseGhost?.id ?? 'base'),
    name: String(baseGhost?.name ?? '기준 고스트'),
    type: baseGhost?.type ?? 'real',
    route: normalizeRoute(baseGhost?.route ?? []),
  };
}

function normalizeRoute(route) {
  const points = (Array.isArray(route) ? route : [])
    .map((point, index) => ({
      minute: Number.isFinite(Number(point.minute)) ? Number(point.minute) : index,
      distance: Math.max(0, Number(point.distance) || 0),
    }))
    .sort((a, b) => a.minute - b.minute);

  if (points.length === 0) return [{ minute: 0, distance: 0 }];
  if (points[0].minute > 0) points.unshift({ minute: 0, distance: 0 });

  let previousDistance = 0;
  return points.map((point, index) => {
    const distance = index === 0 ? 0 : Math.max(previousDistance, point.distance);
    previousDistance = distance;
    return { minute: point.minute, distance: roundDistance(distance) };
  });
}

function rebuildRouteFromDeltas(baseRoute, deltas) {
  let distance = 0;
  return baseRoute.map((point, index) => {
    if (index > 0) distance += deltas[index - 1] ?? 0;
    return { minute: point.minute, distance: roundDistance(distance) };
  });
}

function naturalDipFactor(progress, profile, index) {
  const strength = Number(profile.dipStrength ?? 0);
  if (strength <= 0) return 1;
  const wave = Math.sin((progress * Math.PI * 4) + index * 0.7);
  return 1 - Math.max(0, wave) * strength;
}

function sortedUniqueMinutes(routeA, routeB) {
  return [...new Set([...routeA, ...routeB].map((point) => point.minute))].sort((a, b) => a - b);
}

function distanceAtMinute(route, minute) {
  const exact = route.find((point) => point.minute === minute);
  if (exact) return exact.distance;

  const before = [...route].reverse().find((point) => point.minute < minute);
  const after = route.find((point) => point.minute > minute);
  if (!before) return after?.distance ?? 0;
  if (!after) return before.distance;

  const span = after.minute - before.minute;
  if (span <= 0) return before.distance;
  const ratio = (minute - before.minute) / span;
  return before.distance + (after.distance - before.distance) * ratio;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashSeed(seed) {
  const text = String(seed ?? 'ghost');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundDistance(value) {
  return Number((Number(value) || 0).toFixed(3));
}
