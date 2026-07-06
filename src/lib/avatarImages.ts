export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const DEFAULT_AVATAR_SIZE = 128;
export const DEFAULT_AVATAR_QUALITY = 0.82;
export const DEFAULT_AVATAR_MIME_TYPE = 'image/webp';
export const FALLBACK_AVATAR_MIME_TYPE = 'image/jpeg';

const SUPPORTED_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type AvatarCompressionOptions = {
  size?: number;
  quality?: number;
  mimeType?: string;
  crop?: AvatarCrop;
};

export type AvatarValidationResult = {
  ok: boolean;
  message?: string;
};

export type AvatarCrop = {
  xPercent?: number;
  yPercent?: number;
  zoom?: number;
};

export type AvatarSourceCrop = {
  sourceX: number;
  sourceY: number;
  sourceSize: number;
};

export function validateAvatarImageFile(file: Pick<File, 'size' | 'type'> | null | undefined): AvatarValidationResult {
  if (!file) return { ok: false, message: '업로드할 이미지를 선택해 주세요.' };
  if (!SUPPORTED_SOURCE_TYPES.has(file.type)) {
    return { ok: false, message: 'JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.' };
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    return { ok: false, message: '이미지는 12MB 이하만 업로드할 수 있습니다.' };
  }
  return { ok: true };
}

export function buildAvatarStoragePath(userId: string, now: Date = new Date(), mimeType = DEFAULT_AVATAR_MIME_TYPE) {
  const safeUserId = String(userId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${safeUserId || 'user'}/avatar-${timestamp}.${avatarExtensionForMimeType(mimeType)}`;
}

export async function compressAvatarImage(file: File, options: AvatarCompressionOptions = {}) {
  const validation = validateAvatarImageFile(file);
  if (!validation.ok) throw new Error(validation.message);

  const size = normalizeAvatarSize(options.size);
  const quality = normalizeAvatarQuality(options.quality);
  const mimeType = options.mimeType || DEFAULT_AVATAR_MIME_TYPE;
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 압축할 수 없습니다.');

  const { sourceX, sourceY, sourceSize } = calculateAvatarSourceCrop(image.width, image.height, options.crop);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  return canvasToBlob(canvas, mimeType, quality);
}

export function normalizeAvatarSize(size = DEFAULT_AVATAR_SIZE) {
  const rounded = Math.round(Number(size));
  if (!Number.isFinite(rounded)) return DEFAULT_AVATAR_SIZE;
  return Math.min(1024, Math.max(128, rounded));
}

export function normalizeAvatarQuality(quality = DEFAULT_AVATAR_QUALITY) {
  const value = Number(quality);
  if (!Number.isFinite(value)) return DEFAULT_AVATAR_QUALITY;
  return Math.min(0.95, Math.max(0.5, value));
}

export function normalizeAvatarCrop(crop: AvatarCrop = {}): Required<AvatarCrop> {
  return {
    xPercent: clampNumber(crop.xPercent, 0, 100, 50),
    yPercent: clampNumber(crop.yPercent, 0, 100, 50),
    zoom: clampNumber(crop.zoom, 1, 3, 1),
  };
}

export function calculateAvatarSourceCrop(width: number, height: number, crop: AvatarCrop = {}): AvatarSourceCrop {
  const imageWidth = Math.max(1, Number(width) || 1);
  const imageHeight = Math.max(1, Number(height) || 1);
  const normalized = normalizeAvatarCrop(crop);
  const sourceSize = Math.min(imageWidth, imageHeight) / normalized.zoom;
  const maxX = Math.max(0, imageWidth - sourceSize);
  const maxY = Math.max(0, imageHeight - sourceSize);

  return {
    sourceX: Number(((normalized.xPercent / 100) * maxX).toFixed(3)),
    sourceY: Number(((normalized.yPercent / 100) * maxY).toFixed(3)),
    sourceSize: Number(sourceSize.toFixed(3)),
  };
}

export function avatarExtensionForMimeType(mimeType: string) {
  if (mimeType === FALLBACK_AVATAR_MIME_TYPE) return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === mimeType) {
        resolve(blob);
        return;
      }

      canvas.toBlob((fallbackBlob) => {
        if (fallbackBlob) {
          resolve(fallbackBlob);
          return;
        }
        reject(new Error('이미지를 압축할 수 없습니다.'));
      }, FALLBACK_AVATAR_MIME_TYPE, quality);
    }, mimeType, quality);
  });
}
