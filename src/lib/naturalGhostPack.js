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
const HEURISTIC_DISTANCE_KM = {
  beginner: 2,
  novice: 3,
  standard: 5,
};
const HEURISTIC_GHOSTS = [
  { id: 'G1', key: 'bestGhost', name: '워스트 고스트', role: 'easy_win', avgSpeedKmh: 5.8, phase: 0.1 },
  { id: 'G2', key: 'averageGhost', name: '쉬운 고스트', role: 'steady_win', avgSpeedKmh: 6.5, phase: 1.35 },
  { id: 'G3', key: 'stableGhost', name: '평균 고스트', role: 'baseline', avgSpeedKmh: 7.2, phase: 2.35 },
  { id: 'G4', key: 'chaserGhost', name: '도전 고스트', role: 'next_goal', avgSpeedKmh: 7.8, phase: 3.4 },
  { id: 'G5', key: 'slowGhost', name: '베스트 고스트', role: 'long_term_goal', avgSpeedKmh: 8.3, phase: 4.55 },
];
const RACE_WEAVE_PATTERN = [95, 98, 100, 101, 102, 100, 99, 101, 103, 102, 100, 99, 101, 104, 103, 101, 100, 103, 105];

export function createGhostPackFromBase(baseGhost) {
  const normalizedBase = normalizeBaseGhost(baseGhost);
  return DEFAULT_PROFILES.map((profile, index) => generateNaturalGhost(normalizedBase, profile, `${normalizedBase.id}:${profile.id}:${index}`));
}

export function createHeuristicGhostPack({
  difficulty = 'beginner',
  targetDistanceKm = null,
  customDistanceKm = null,
  seed = Date.now(),
} = {}) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const distanceKm = resolveHeuristicDistanceKm(normalizedDifficulty, targetDistanceKm, customDistanceKm);

  return HEURISTIC_GHOSTS.map((ghost, index) => {
    const targetSeconds = speedToTargetSeconds(distanceKm, ghost.avgSpeedKmh, seed, index);
    const finishSprint = shouldFinishSprint(seed, index);
    const speedProfile = buildMinuteSpeedProfile({
      minutes: Math.ceil(targetSeconds / 60),
      seed: `${seed}:${normalizedDifficulty}:${ghost.id}`,
      phase: ghost.phase,
      finishSprint,
    });
    const route = buildRouteFromSpeedProfile({
      distanceMeters: distanceKm * 1000,
      targetSeconds,
      speedProfile,
    });

    return {
      id: ghost.id,
      key: ghost.key,
      name: ghost.name,
      role: ghost.role,
      targetRole: ghost.role,
      source: 'initial_default',
      type: 'heuristic',
      distanceKm,
      avgSpeedKmh: ghost.avgSpeedKmh,
      targetTime: formatClock(targetSeconds),
      targetSeconds,
      pace: formatPaceSeconds(targetSeconds / distanceKm),
      speedProfile,
      finishSprint,
      points: routeToPoints(route),
      route,
      preservePace: true,
    };
  });
}

export function createHeuristicGhostRunData(options = {}) {
  const difficulty = normalizeDifficulty(options.difficulty);
  const distanceKm = resolveHeuristicDistanceKm(difficulty, options.targetDistanceKm, options.customDistanceKm);
  const ghosts = createHeuristicGhostPack({ ...options, difficulty, targetDistanceKm: distanceKm });

  return {
    distanceKm,
    mode: difficulty,
    ghosts: ghosts.map((ghost) => ({
      id: ghost.id,
      name: ghost.name,
      source: ghost.source,
      avgSpeedKmh: ghost.avgSpeedKmh,
      targetRole: ghost.targetRole,
      targetTime: ghost.targetTime,
      pace: ghost.pace,
      speedProfile: ghost.speedProfile,
      finishSprint: ghost.finishSprint,
      points: ghost.points,
    })),
  };
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
    ghostRole: ghost.role,
    source: ghost.source,
    avgSpeedKmh: ghost.avgSpeedKmh,
    targetRole: ghost.targetRole,
    targetTime: ghost.targetTime,
    pace: ghost.pace,
    speedProfile: ghost.speedProfile,
    finishSprint: ghost.finishSprint,
    points: ghost.points,
    preservePace: ghost.preservePace,
    totalDistanceMeters: last.distance,
    totalElapsedSeconds: Math.max(1, Number(last.minute) * 60),
    checkpoints: route
      .filter((point) => point.minute >= 0)
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

function normalizeDifficulty(value) {
  if (['beginner', 'novice', 'standard', 'custom'].includes(value)) return value;
  return 'beginner';
}

function resolveHeuristicDistanceKm(difficulty, targetDistanceKm, customDistanceKm) {
  const requestedDistance = Number(difficulty === 'custom' ? customDistanceKm : targetDistanceKm);
  if (Number.isFinite(requestedDistance) && requestedDistance > 0) return requestedDistance;
  if (difficulty === 'custom') return HEURISTIC_DISTANCE_KM.beginner;
  return HEURISTIC_DISTANCE_KM[difficulty] ?? HEURISTIC_DISTANCE_KM.beginner;
}

function speedToTargetSeconds(distanceKm, avgSpeedKmh, seed, index) {
  const baseSeconds = (distanceKm / avgSpeedKmh) * 3600;
  const randomOffset = Math.round((seededRandom(`${seed}:target:${index}`)() - 0.5) * 18);
  return Math.max(60, Math.round(baseSeconds) + randomOffset);
}

function shouldFinishSprint(seed, index) {
  return seededRandom(`${seed}:sprint:${index}`)() > 0.18;
}

function buildMinuteSpeedProfile({ minutes, seed, phase, finishSprint }) {
  const random = seededRandom(seed);
  const profile = [];

  for (let minute = 0; minute < minutes; minute += 1) {
    const progress = minutes <= 1 ? 1 : minute / (minutes - 1);
    const basePhase =
      progress < 0.2 ? 95 :
      progress > 0.8 ? 103 :
      100;
    const weave = RACE_WEAVE_PATTERN[minute % RACE_WEAVE_PATTERN.length] - 100;
    const roleWave = Math.sin(minute * 0.73 + phase) * 1.2;
    const jitter = (random() - 0.5) * 2;
    const sprint = finishSprint && progress > 0.86 ? 3 * ((progress - 0.86) / 0.14) : 0;
    const target = clamp(basePhase + weave + roleWave + jitter + sprint, 93, 107);
    const previous = profile[profile.length - 1] ?? 100;
    profile.push(Math.round(clamp(target, previous - 8, previous + 8)));
  }

  return normalizeSpeedProfile(profile);
}

function normalizeSpeedProfile(profile) {
  const average = profile.reduce((sum, value) => sum + value, 0) / Math.max(1, profile.length);
  if (!Number.isFinite(average) || average <= 0) return profile;

  const scaled = profile.map((value) => Math.round(value * (100 / average)));
  return scaled.map((value, index) => {
    const previous = scaled[index - 1];
    if (previous == null) return clamp(value, 92, 108);
    return clamp(value, previous - 8, previous + 8);
  });
}

function buildRouteFromSpeedProfile({ distanceMeters, targetSeconds, speedProfile }) {
  const safeDistance = Math.max(0, Number(distanceMeters) || 0);
  const safeSeconds = Math.max(1, Number(targetSeconds) || 1);
  const minuteCount = Math.max(1, speedProfile.length);
  const segmentWeights = speedProfile.map((speed, index) => {
    const segmentSeconds = index === minuteCount - 1 ? safeSeconds - (minuteCount - 1) * 60 : 60;
    return Math.max(1, segmentSeconds) * Math.max(1, Number(speed) || 100);
  });
  const totalWeight = segmentWeights.reduce((sum, value) => sum + value, 0);
  const route = [{ minute: 0, distance: 0 }];
  let distance = 0;

  segmentWeights.forEach((weight, index) => {
    distance += safeDistance * (weight / totalWeight);
    const elapsedSeconds = index === minuteCount - 1 ? safeSeconds : (index + 1) * 60;
    route.push({
      minute: elapsedSeconds / 60,
      distance: roundDistance(index === minuteCount - 1 ? safeDistance : distance),
    });
  });

  return route;
}

function formatClock(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatPaceSeconds(secondsPerKm) {
  return `${formatClock(secondsPerKm)}/km`;
}

function routeToPoints(route) {
  return route.map((point) => ({
    minute: point.minute,
    distanceM: Math.round(point.distance),
  }));
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
