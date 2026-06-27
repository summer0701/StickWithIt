import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { calculateNextDistance, normalizePosition } from '../lib/distance';

const ForegroundLocation = registerPlugin('ForegroundLocation');
const MAX_REASONABLE_SPEED_KMH = 31;

export async function createLocationTracker({ onAcceptedPoint, onRejectedPoint, onError } = {}) {
  let previousPoint = null;
  let distanceKm = 0;
  let watchId = null;
  let nativeListener = null;
  let stopped = false;

  function handlePosition(position) {
    const nextPoint = normalizePosition(position);
    const nextDistance = calculateNextDistance(previousPoint, nextPoint, distanceKm);
    const elapsedSeconds = previousPoint ? Math.max(1, (nextPoint.timestamp - previousPoint.timestamp) / 1000) : 0;
    const speedKmh = elapsedSeconds > 0 ? (nextDistance.distanceMeters / 1000 / (elapsedSeconds / 3600)) : 0;

    if (speedKmh > MAX_REASONABLE_SPEED_KMH) {
      onRejectedPoint?.({ point: nextPoint, reason: 'too_fast', speedKmh });
      console.debug('[locationTracker] Rejected abnormal speed.', { speedKmh });
      return;
    }

    if (!nextDistance.accepted) {
      onRejectedPoint?.({ point: nextPoint, reason: nextDistance.reason });
      console.debug('[locationTracker] Rejected GPS point.', nextDistance.reason);
      return;
    }

    previousPoint = nextPoint;
    distanceKm = nextDistance.totalDistanceKm;
    onAcceptedPoint?.({
      point: nextPoint,
      distanceMeters: distanceKm * 1000,
      segmentMeters: nextDistance.distanceMeters,
      speedKmh,
    });
  }

  async function start() {
    let permissions = null;
    try {
      permissions = await Geolocation.requestPermissions();
      if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
        throw new Error('위치 권한이 필요합니다.');
      }
    } catch (error) {
      onError?.(error);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await ForegroundLocation.start({ notificationTitle: '끝까지 버텨라', notificationText: '러닝 기록을 추적하는 중입니다.' });
        nativeListener = await ForegroundLocation.addListener('locationUpdate', handlePosition);
        console.debug('[locationTracker] Native foreground location service started.');
        return;
      } catch (error) {
        console.debug('[locationTracker] Native foreground service unavailable, falling back to Capacitor Geolocation.', error);
      }
    }

    try {
      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
        (position, error) => {
          if (stopped) return;
          if (error) {
            onError?.(error);
            return;
          }
          if (position) handlePosition(position);
        },
      );
    } catch (error) {
      onError?.(error);
    }
  }

  async function stop() {
    stopped = true;
    nativeListener?.remove?.();
    if (Capacitor.isNativePlatform()) {
      try {
        await ForegroundLocation.stop();
      } catch (error) {
        console.debug('[locationTracker] Native foreground service stop failed.', error);
      }
    }
    if (watchId) await Geolocation.clearWatch({ id: watchId });
  }

  return { start, stop, getDistanceMeters: () => distanceKm * 1000 };
}

export function buildCheckpoint({ runId, userId, elapsedSeconds, distanceMeters, point }) {
  const distanceKm = distanceMeters / 1000;
  const elapsedHours = elapsedSeconds / 3600;
  return {
    run_id: runId,
    user_id: userId,
    elapsed_seconds: elapsedSeconds,
    distance_meters: distanceMeters,
    pace_seconds_per_km: distanceKm > 0 ? Math.round(elapsedSeconds / distanceKm) : null,
    speed_kmh: elapsedHours > 0 ? distanceKm / elapsedHours : 0,
    latitude: point.latitude,
    longitude: point.longitude,
    created_at: new Date().toISOString(),
  };
}
