export type GhostSlotKey = 'bestGhost' | 'averageGhost' | 'stableGhost' | 'chaserGhost' | 'slowGhost';

export type GhostSetting = {
  key: GhostSlotKey;
  defaultName: string;
  description: string;
  name: string;
  averageSpeedKmh: number | null;
};

export type GhostRunnerLike = {
  key: string;
  label?: string;
  totalDistanceMeters?: number;
  totalElapsedSeconds?: number;
  checkpoints?: unknown[];
  [key: string]: unknown;
};

export const GHOST_SETTING_SLOTS: Array<Pick<GhostSetting, 'key' | 'defaultName' | 'description'>> = [
  { key: 'bestGhost', defaultName: 'G1', description: '최고 기록 고스트' },
  { key: 'averageGhost', defaultName: 'G2', description: '평균 고스트' },
  { key: 'stableGhost', defaultName: 'G3', description: '안정 고스트' },
  { key: 'chaserGhost', defaultName: 'G4', description: '추격 고스트' },
  { key: 'slowGhost', defaultName: 'G5', description: '워스트 고스트' },
];

const STORAGE_PREFIX = 'stickWithit:ghost-settings:';
const MIN_GHOST_SPEED_KMH = 1;
const MAX_GHOST_SPEED_KMH = 30;
const DEFAULT_GHOST_SPEEDS_KMH = [12, 10.5, 10, 10.8, 8.5];

export function defaultGhostSettings(): GhostSetting[] {
  return GHOST_SETTING_SLOTS.map((slot, index) => ({
    ...slot,
    name: '',
    averageSpeedKmh: DEFAULT_GHOST_SPEEDS_KMH[index] ?? 10.5,
  }));
}

export function normalizeGhostSettings(value: unknown): GhostSetting[] {
  const source = Array.isArray(value) ? value : [];
  return defaultGhostSettings().map((slot, index) => {
    const item = source.find((candidate) => candidate?.key === slot.key) ?? source[index] ?? {};
    const speed = normalizeGhostSpeed((item as Partial<GhostSetting>).averageSpeedKmh, slot.averageSpeedKmh);

    return {
      ...slot,
      name: normalizeGhostName((item as Partial<GhostSetting>).name),
      averageSpeedKmh: speed,
    };
  });
}

export function readGhostSettings(userId: string): GhostSetting[] {
  if (!canUseLocalStorage()) return defaultGhostSettings();

  try {
    return normalizeGhostSettings(JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]'));
  } catch {
    return defaultGhostSettings();
  }
}

export function writeGhostSettings(userId: string, settings: GhostSetting[]) {
  const normalized = normalizeGhostSettings(settings);
  if (!canUseLocalStorage()) return normalized;

  window.localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  return normalized;
}

export function ghostDisplayName(key: string, settings: GhostSetting[] = defaultGhostSettings()) {
  const slot = normalizeGhostSettings(settings).find((item) => item.key === key);
  if (!slot) return String(key);
  return slot.name || slot.defaultName;
}

export function applyGhostSettingsToRunners({
  runners = [],
  settings = defaultGhostSettings(),
  targetDistanceKm = null,
}: {
  runners?: GhostRunnerLike[];
  settings?: GhostSetting[];
  targetDistanceKm?: number | null;
}): GhostRunnerLike[] {
  const normalizedSettings = normalizeGhostSettings(settings);
  const runnersByKey = new Map(runners.map((runner) => [runner.key, runner]));

  return normalizedSettings
    .map<GhostRunnerLike | null>((slot) => {
      const runner = runnersByKey.get(slot.key);
      const totalDistanceMeters = resolveGhostDistanceMeters(runner, targetDistanceKm);

      if (!runner && !slot.averageSpeedKmh) return null;

      const base = runner ?? {
        key: slot.key,
        totalDistanceMeters,
        totalElapsedSeconds: speedToElapsedSeconds(totalDistanceMeters, slot.averageSpeedKmh),
        checkpoints: [],
      };

      if (!slot.averageSpeedKmh) {
        return {
          ...base,
          label: ghostDisplayName(slot.key, normalizedSettings),
        };
      }

      return {
        ...base,
        label: ghostDisplayName(slot.key, normalizedSettings),
        totalDistanceMeters,
        totalElapsedSeconds: speedToElapsedSeconds(totalDistanceMeters, slot.averageSpeedKmh),
        checkpoints: scaleGhostCheckpoints(base, totalDistanceMeters, speedToElapsedSeconds(totalDistanceMeters, slot.averageSpeedKmh)),
        averageSpeedKmh: slot.averageSpeedKmh,
      };
    })
    .filter((runner): runner is GhostRunnerLike => Boolean(runner));
}

function resolveGhostDistanceMeters(runner: GhostRunnerLike | undefined, targetDistanceKm: number | null) {
  const targetDistanceMeters = Number(targetDistanceKm) > 0 ? Number(targetDistanceKm) * 1000 : 0;
  const runnerDistanceMeters = Number(runner?.totalDistanceMeters);
  if (targetDistanceMeters > 0) return targetDistanceMeters;
  if (Number.isFinite(runnerDistanceMeters) && runnerDistanceMeters > 0) return runnerDistanceMeters;
  return 10000;
}

function speedToElapsedSeconds(distanceMeters: number, averageSpeedKmh: number | null) {
  if (!averageSpeedKmh) return 0;
  return Math.round((distanceMeters / 1000 / averageSpeedKmh) * 3600);
}

function scaleGhostCheckpoints(runner: GhostRunnerLike, targetDistanceMeters: number, targetElapsedSeconds: number) {
  const checkpoints = Array.isArray(runner.checkpoints) ? runner.checkpoints : [];
  if (checkpoints.length === 0 || targetDistanceMeters <= 0 || targetElapsedSeconds <= 0) return [];

  const sourceDistanceMeters = Math.max(1, Number(runner.totalDistanceMeters) || targetDistanceMeters);
  const sourceElapsedSeconds = Math.max(1, Number(runner.totalElapsedSeconds) || targetElapsedSeconds);

  return checkpoints
    .map((checkpoint: any) => ({
      elapsedSeconds: Math.max(0, Math.round((Number(checkpoint.elapsedSeconds) / sourceElapsedSeconds) * targetElapsedSeconds)),
      distanceMeters: Number(((Math.max(0, Number(checkpoint.distanceMeters) || 0) / sourceDistanceMeters) * targetDistanceMeters).toFixed(3)),
    }))
    .filter((checkpoint) => Number.isFinite(checkpoint.elapsedSeconds) && Number.isFinite(checkpoint.distanceMeters));
}

function normalizeGhostName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 16) : '';
}

function normalizeGhostSpeed(value: unknown, fallback: number) {
  if (value == null || value === '') return fallback;
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed <= 0) return fallback;
  return Math.min(MAX_GHOST_SPEED_KMH, Math.max(MIN_GHOST_SPEED_KMH, Number(speed.toFixed(1))));
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId || 'anonymous'}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
