import {
  AVATAR_MAX_SOURCE_BYTES,
  avatarExtensionForMimeType,
  buildAvatarStoragePath,
  calculateAvatarSourceCrop,
  normalizeAvatarCrop,
  normalizeAvatarQuality,
  normalizeAvatarSize,
  validateAvatarImageFile,
} from './avatarImages';

describe('avatarImages', () => {
  it('accepts supported image files under the source size limit', () => {
    expect(validateAvatarImageFile({ type: 'image/png', size: 120_000 })).toEqual({ ok: true });
    expect(validateAvatarImageFile({ type: 'image/webp', size: AVATAR_MAX_SOURCE_BYTES })).toEqual({ ok: true });
  });

  it('rejects missing, unsupported, or oversized avatar files with Korean messages', () => {
    expect(validateAvatarImageFile(null)).toMatchObject({ ok: false, message: '업로드할 이미지를 선택해 주세요.' });
    expect(validateAvatarImageFile({ type: 'image/svg+xml', size: 10 })).toMatchObject({
      ok: false,
      message: 'JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.',
    });
    expect(validateAvatarImageFile({ type: 'image/jpeg', size: AVATAR_MAX_SOURCE_BYTES + 1 })).toMatchObject({
      ok: false,
      message: '이미지는 12MB 이하만 업로드할 수 있습니다.',
    });
  });

  it('builds deterministic avatar paths and removes unsafe path characters', () => {
    expect(buildAvatarStoragePath('user/../abc', new Date('2026-07-06T07:08:09.123Z'))).toBe(
      'userabc/avatar-20260706070809.webp',
    );
    expect(buildAvatarStoragePath('user-1', new Date('2026-07-06T07:08:09.123Z'), 'image/jpeg')).toBe(
      'user-1/avatar-20260706070809.jpg',
    );
  });

  it('bounds compression size and quality options', () => {
    expect(normalizeAvatarSize(64)).toBe(128);
    expect(normalizeAvatarSize(2048)).toBe(1024);
    expect(normalizeAvatarSize(Number.NaN)).toBe(128);
    expect(normalizeAvatarQuality(0.2)).toBe(0.5);
    expect(normalizeAvatarQuality(1)).toBe(0.95);
    expect(normalizeAvatarQuality(Number.NaN)).toBe(0.82);
  });

  it('maps output MIME types to avatar file extensions', () => {
    expect(avatarExtensionForMimeType('image/webp')).toBe('webp');
    expect(avatarExtensionForMimeType('image/jpeg')).toBe('jpg');
    expect(avatarExtensionForMimeType('image/png')).toBe('png');
  });

  it('calculates selected square crop area from crop position and zoom', () => {
    expect(calculateAvatarSourceCrop(1200, 800, { xPercent: 50, yPercent: 50, zoom: 1 })).toEqual({
      sourceX: 200,
      sourceY: 0,
      sourceSize: 800,
    });
    expect(calculateAvatarSourceCrop(1200, 800, { xPercent: 100, yPercent: 100, zoom: 2 })).toEqual({
      sourceX: 800,
      sourceY: 400,
      sourceSize: 400,
    });
  });

  it('normalizes crop controls to safe UI bounds', () => {
    expect(normalizeAvatarCrop({ xPercent: -10, yPercent: 120, zoom: 9 })).toEqual({
      xPercent: 0,
      yPercent: 100,
      zoom: 3,
    });
    expect(normalizeAvatarCrop({ xPercent: Number.NaN, yPercent: Number.NaN, zoom: Number.NaN })).toEqual({
      xPercent: 50,
      yPercent: 50,
      zoom: 1,
    });
  });
});
