import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    getCurrentPosition: mocks.getCurrentPosition,
  },
}));

import { LOCATION_PERMISSION_MESSAGE, LocationPermissionError, requestCurrentPosition } from './locationPermission';

describe('requestCurrentPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the permission request step when permission is denied', async () => {
    mocks.checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    mocks.requestPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    await expect(requestCurrentPosition()).rejects.toMatchObject({
      step: 'request-permission',
      message: LOCATION_PERMISSION_MESSAGE,
    });
  });

  it('reports the permission check step when checking permission fails', async () => {
    mocks.checkPermissions.mockRejectedValue(new Error('check failed'));

    await expect(requestCurrentPosition()).rejects.toMatchObject({
      step: 'check-permission',
      message: '위치 권한 상태를 확인하지 못했어요.',
    });
  });

  it('reports the get-position step when GPS lookup fails', async () => {
    mocks.checkPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'denied' });
    mocks.getCurrentPosition.mockRejectedValue(new Error('gps timeout'));

    await expect(requestCurrentPosition()).rejects.toBeInstanceOf(LocationPermissionError);
    await expect(requestCurrentPosition()).rejects.toMatchObject({
      step: 'get-position',
      message: '현재 위치를 가져오지 못했어요.',
    });
  });
});
