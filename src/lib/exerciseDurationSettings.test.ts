import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatExerciseDuration,
  getExerciseDurationSeconds,
  setExerciseDurationSeconds,
} from './exerciseDurationSettings';

describe('exerciseDurationSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores each exercise duration independently with the shared key format', () => {
    setExerciseDurationSeconds('user-1', 'jumpingJack', 120);
    setExerciseDurationSeconds('user-1', 'pushup', 180);
    setExerciseDurationSeconds('user-1', 'plank', 30);

    expect(getExerciseDurationSeconds('user-1', 'jumpingJack')).toBe(120);
    expect(getExerciseDurationSeconds('user-1', 'pushup')).toBe(180);
    expect(getExerciseDurationSeconds('user-1', 'plank')).toBe(30);
    expect(window.localStorage.getItem('stickWithIt:jumpingJack-duration-seconds:user-1')).toBe('120');
  });

  it('keeps existing squat duration from the legacy key and mirrors new writes', () => {
    window.localStorage.setItem('stickWithit:squat-duration-seconds:user-1', '180');

    expect(getExerciseDurationSeconds('user-1', 'squat')).toBe(180);
    expect(window.localStorage.getItem('stickWithIt:squat-duration-seconds:user-1')).toBe('180');

    setExerciseDurationSeconds('user-1', 'squat', 240);
    expect(window.localStorage.getItem('stickWithit:squat-duration-seconds:user-1')).toBe('240');
  });

  it('returns legacy squat duration when migration storage write is blocked', () => {
    window.localStorage.setItem('stickWithit:squat-duration-seconds:user-1', '180');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(getExerciseDurationSeconds('user-1', 'squat')).toBe(180);

    setItem.mockRestore();
  });

  it('normalizes duration and formats seconds for cards', () => {
    expect(setExerciseDurationSeconds('user-1', 'pushup', 12)).toBe(30);
    expect(setExerciseDurationSeconds('user-1', 'pushup', 900)).toBe(600);
    expect(formatExerciseDuration(30)).toBe('30초');
    expect(formatExerciseDuration(60)).toBe('1분');
    expect(formatExerciseDuration(150)).toBe('2분 30초');
  });
});
