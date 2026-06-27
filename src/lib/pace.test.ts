import { describe, expect, it } from 'vitest';
import { formatDuration, formatPace, formatSignedSeconds, secondsPerKm } from './pace';

describe('pace', () => {
  it('formats duration and pace', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(secondsPerKm(2, 600)).toBe(300);
    expect(formatPace(300)).toBe('5:00/km');
  });

  it('formats ghost difference from current minus ghost elapsed', () => {
    expect(formatSignedSeconds(-12)).toBe('+12초 앞섬');
    expect(formatSignedSeconds(8)).toBe('-8초 뒤처짐');
    expect(formatSignedSeconds(null)).toBe('비교 기록 없음');
  });
});
