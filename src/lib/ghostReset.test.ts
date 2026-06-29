import { beforeEach, describe, expect, it } from 'vitest';
import { clearGhostReset, isAfterGhostReset, readGhostResetAt, resetGhostHistory } from './ghostReset';

describe('ghostReset', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores a reset timestamp per user', () => {
    const resetAt = resetGhostHistory('user-1', new Date('2026-06-29T10:00:00.000Z'));

    expect(resetAt).toBe('2026-06-29T10:00:00.000Z');
    expect(readGhostResetAt('user-1')).toBe(resetAt);
    expect(readGhostResetAt('user-2')).toBeNull();
  });

  it('filters dates before the reset timestamp', () => {
    const resetAt = '2026-06-29T10:00:00.000Z';

    expect(isAfterGhostReset('2026-06-29T09:59:59.000Z', resetAt)).toBe(false);
    expect(isAfterGhostReset('2026-06-29T10:00:00.000Z', resetAt)).toBe(true);
    expect(isAfterGhostReset('2026-06-29T10:00:01.000Z', resetAt)).toBe(true);
  });

  it('can clear a reset timestamp', () => {
    resetGhostHistory('user-1', new Date('2026-06-29T10:00:00.000Z'));
    clearGhostReset('user-1');

    expect(readGhostResetAt('user-1')).toBeNull();
  });
});
