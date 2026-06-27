export function formatDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function secondsPerKm(distanceKm, durationSeconds) {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) {
    return null;
  }

  return Math.round(durationSeconds / distanceKm);
}

export function formatPace(paceSeconds) {
  if (!paceSeconds || paceSeconds <= 0 || !Number.isFinite(paceSeconds)) {
    return '--';
  }

  return `${formatDuration(paceSeconds)}/km`;
}

export function formatSignedSeconds(diffSeconds) {
  if (diffSeconds == null || !Number.isFinite(diffSeconds)) {
    return '비교 기록 없음';
  }

  if (diffSeconds === 0) {
    return '동률';
  }

  const abs = Math.abs(Math.round(diffSeconds));
  return diffSeconds < 0 ? `+${abs}초 앞섬` : `-${abs}초 뒤처짐`;
}
