import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  requestPermissions: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    requestPermissions: mocks.requestPermissions,
    watchPosition: mocks.watchPosition,
    clearWatch: mocks.clearWatch,
  },
}));

import { watchRunPosition } from './geolocation';

describe('watchRunPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(true);
  });

  it('returns a safe cleanup when native location permission is denied', async () => {
    const onError = vi.fn();
    mocks.requestPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const cleanup = await watchRunPosition(vi.fn(), onError);
    cleanup();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: '위치 권한이 필요합니다.' }));
    expect(mocks.watchPosition).not.toHaveBeenCalled();
    expect(mocks.clearWatch).not.toHaveBeenCalled();
  });

  it('clears the native watch when cleanup runs', async () => {
    mocks.requestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'denied' });
    mocks.watchPosition.mockResolvedValue('watch-1');

    const cleanup = await watchRunPosition(vi.fn(), vi.fn());
    cleanup();

    expect(mocks.watchPosition).toHaveBeenCalledWith(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
      expect.any(Function),
    );
    expect(mocks.clearWatch).toHaveBeenCalledWith({ id: 'watch-1' });
  });

  it('reports native startup failures without throwing', async () => {
    const onError = vi.fn();
    const failure = new Error('permission prompt failed');
    mocks.requestPermissions.mockRejectedValue(failure);

    const cleanup = await watchRunPosition(vi.fn(), onError);
    cleanup();

    expect(onError).toHaveBeenCalledWith(failure);
    expect(mocks.clearWatch).not.toHaveBeenCalled();
  });
});
