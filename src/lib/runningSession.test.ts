import { beforeEach, describe, expect, it } from 'vitest';
import { clearStoredSession, persistRunningSession, restoreRunningSession, RUNNING_SESSION_STORAGE_KEY } from './runningSession';

describe('runningSession', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores a matching running session with elapsed time compensation', () => {
    persistRunningSession(
      {
        userId: 'user-1',
        targetDistanceKm: 3,
        status: 'running',
        distanceKm: 1.25,
        elapsedSeconds: 120,
        splits: [{ distance_km: 1, elapsed_seconds: 100 }],
        routePoints: [{ latitude: 37, longitude: 127 }],
        startedAt: '2026-06-27T10:00:00.000Z',
        lastSplitDistance: 1,
      },
      1000,
    );

    const restored = restoreRunningSession('user-1', 3, 11_000);

    expect(restored).toMatchObject({
      userId: 'user-1',
      targetDistanceKm: 3,
      status: 'running',
      distanceKm: 1.25,
      elapsedSeconds: 130,
      lastSplitDistance: 1,
    });
    expect(restored.splits).toHaveLength(1);
    expect(restored.routePoints).toHaveLength(1);
  });

  it('does not restore a session for a different user or target distance', () => {
    persistRunningSession({ userId: 'user-1', targetDistanceKm: 3, status: 'paused', elapsedSeconds: 10 }, 1000);

    expect(restoreRunningSession('user-2', 3, 1000)).toBeNull();
    expect(restoreRunningSession('user-1', 5, 1000)).toBeNull();
  });

  it('clears corrupt session data', () => {
    window.localStorage.setItem(RUNNING_SESSION_STORAGE_KEY, '{broken');

    expect(restoreRunningSession('user-1', 3, 1000)).toBeNull();
    expect(window.localStorage.getItem(RUNNING_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears the stored session', () => {
    persistRunningSession({ userId: 'user-1', targetDistanceKm: 3 }, 1000);

    clearStoredSession();

    expect(window.localStorage.getItem(RUNNING_SESSION_STORAGE_KEY)).toBeNull();
  });
});
