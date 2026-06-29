export function formatHudClock(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatHudPace(paceSeconds) {
  if (!paceSeconds || paceSeconds <= 0 || !Number.isFinite(paceSeconds)) return "--'--\"";

  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}'${String(seconds).padStart(2, '0')}"/km`;
}

export function formatGhostDelta(diffSeconds) {
  const abs = Math.abs(Math.round(diffSeconds));
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  return `${diffSeconds <= 0 ? '+' : '-'}${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function calculateCalories(distanceKm) {
  return Math.round(Math.max(0, Number(distanceKm) || 0) * 74);
}

export function shouldShowBatteryOptimizationMenu({ isNative, isIgnoringBatteryOptimizations }) {
  if (!isNative) return true;
  return isIgnoringBatteryOptimizations === false;
}

export function shouldConfirmTargetDistanceChange({
  status,
  currentTargetDistanceKm,
  nextTargetDistanceKm,
  ghostRunnerCount = 0,
}) {
  const currentDistance = Number(currentTargetDistanceKm);
  const nextDistance = Number(nextTargetDistanceKm);
  const isActiveRun = status === 'running' || status === 'paused';
  const hasDistanceChanged =
    Number.isFinite(currentDistance) &&
    Number.isFinite(nextDistance) &&
    Math.abs(currentDistance - nextDistance) >= 0.001;

  return isActiveRun && hasDistanceChanged && ghostRunnerCount > 0;
}

export function getNextRunHudPanel(currentPanel) {
  return currentPanel === 'stats' ? 'ghost' : 'stats';
}

export function formatGhostScaleKm(distanceKm) {
  const safeDistanceKm = Math.max(0, Number(distanceKm) || 0);
  return `${safeDistanceKm.toFixed(safeDistanceKm >= 10 ? 0 : 1)} km`;
}

export function formatGhostGoalScaleLabel(targetDistanceKm) {
  return `목표 ${formatGhostScaleKm(targetDistanceKm)}`;
}
