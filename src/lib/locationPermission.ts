import { Geolocation } from '@capacitor/geolocation';

export const LOCATION_PERMISSION_MESSAGE = '위치 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';

type LocationPermissionState = Awaited<ReturnType<typeof Geolocation.requestPermissions>>;
export type LocationPermissionStep = 'check-permission' | 'request-permission' | 'get-position';

export class LocationPermissionError extends Error {
  step: LocationPermissionStep;
  cause?: unknown;

  constructor(step: LocationPermissionStep, message: string, cause?: unknown) {
    super(message);
    this.name = 'LocationPermissionError';
    this.step = step;
    this.cause = cause;
  }
}

export function hasLocationPermission(permission: LocationPermissionState | null | undefined) {
  return permission?.location === 'granted' || permission?.coarseLocation === 'granted';
}

export async function requestCurrentPosition() {
  let permission: LocationPermissionState;
  try {
    permission = await Geolocation.checkPermissions();
  } catch (error) {
    throw new LocationPermissionError('check-permission', '위치 권한 상태를 확인하지 못했어요.', error);
  }

  if (!hasLocationPermission(permission)) {
    try {
      permission = await Geolocation.requestPermissions();
    } catch (error) {
      throw new LocationPermissionError('request-permission', '위치 권한 요청을 열지 못했어요.', error);
    }
  }

  if (!hasLocationPermission(permission)) {
    throw new LocationPermissionError('request-permission', LOCATION_PERMISSION_MESSAGE);
  }

  try {
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  } catch (error) {
    throw new LocationPermissionError('get-position', '현재 위치를 가져오지 못했어요.', error);
  }
}
