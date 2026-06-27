import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export async function watchRunPosition(onPosition, onError) {
  if (Capacitor.isNativePlatform()) {
    try {
      const permissions = await Geolocation.requestPermissions();
      if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
        onError?.(new Error('위치 권한이 필요합니다.'));
        return () => {};
      }

      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        },
        (position, error) => {
          if (error) {
            onError?.(error);
            return;
          }
          if (position) onPosition(position);
        },
      );

      return () => Geolocation.clearWatch({ id });
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('GPS를 시작할 수 없습니다.'));
      return () => {};
    }
  }

  if (!navigator.geolocation) {
    onError?.(new Error('이 기기에서 GPS를 사용할 수 없습니다.'));
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000,
  });

  return () => navigator.geolocation.clearWatch(id);
}
