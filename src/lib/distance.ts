const EARTH_RADIUS_M = 6371000;
const MAX_ACCURACY_M = 30;
const MIN_DISTANCE_M = 5;
const MAX_REASONABLE_SPEED_MPS = 8.5;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function normalizePosition(position) {
  const coords = position.coords ?? position;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? Infinity,
    timestamp: position.timestamp ?? Date.now(),
  };
}

export function shouldAcceptPoint(previousPoint, nextPoint) {
  if (!nextPoint || nextPoint.accuracy > MAX_ACCURACY_M) {
    return { accepted: false, reason: 'low_accuracy', distanceMeters: 0 };
  }

  if (!previousPoint) {
    return { accepted: true, reason: 'first_point', distanceMeters: 0 };
  }

  const distanceMeters = haversineMeters(previousPoint, nextPoint);

  if (distanceMeters < MIN_DISTANCE_M) {
    return { accepted: false, reason: 'too_short', distanceMeters };
  }

  const elapsedSeconds = Math.max(0.001, (nextPoint.timestamp - previousPoint.timestamp) / 1000);
  const speedMps = distanceMeters / elapsedSeconds;

  if (speedMps > MAX_REASONABLE_SPEED_MPS) {
    return { accepted: false, reason: 'too_fast', distanceMeters };
  }

  return { accepted: true, reason: 'accepted', distanceMeters };
}

export function calculateNextDistance(previousPoint, nextPoint, currentDistanceKm = 0) {
  const decision = shouldAcceptPoint(previousPoint, nextPoint);

  return {
    ...decision,
    totalDistanceKm: currentDistanceKm + (decision.accepted ? decision.distanceMeters / 1000 : 0),
  };
}
