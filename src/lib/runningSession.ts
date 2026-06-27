import { sameTargetDistance } from './ghostRun';

export const RUNNING_SESSION_STORAGE_KEY = 'stickwithit:active-running-session';

export function restoreRunningSession(userId, targetDistanceKm, nowMs = Date.now()) {
  try {
    const rawSession = window.localStorage.getItem(RUNNING_SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    const session = JSON.parse(rawSession);
    if (session.userId !== userId || !sameTargetDistance(session.targetDistanceKm, targetDistanceKm)) return null;

    const savedElapsed = Number(session.elapsedSeconds ?? 0);
    const lastSavedAt = Number(session.lastSavedAt ?? nowMs);
    const restoredElapsed =
      session.status === 'running' ? savedElapsed + Math.floor((nowMs - lastSavedAt) / 1000) : savedElapsed;

    return {
      ...session,
      elapsedSeconds: Math.max(0, restoredElapsed),
      distanceKm: Number(session.distanceKm ?? 0),
      splits: session.splits ?? [],
      routePoints: session.routePoints ?? [],
      status: session.status === 'paused' ? 'paused' : 'running',
      lastSplitDistance: Number(session.lastSplitDistance ?? 0),
    };
  } catch {
    clearStoredSession();
    return null;
  }
}

export function persistRunningSession(session, nowMs = Date.now()) {
  try {
    window.localStorage.setItem(
      RUNNING_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session,
        lastSavedAt: nowMs,
      }),
    );
  } catch {
    // localStorage 저장 실패 시 현재 세션 복구만 건너뜁니다.
  }
}

export function clearStoredSession() {
  window.localStorage.removeItem(RUNNING_SESSION_STORAGE_KEY);
}
