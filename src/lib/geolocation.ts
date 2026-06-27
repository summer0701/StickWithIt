import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export async function watchRunPosition(onPosition, onError) {
  if (Capacitor.isNativePlatform()) {
    await Geolocation.requestPermissions();
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
