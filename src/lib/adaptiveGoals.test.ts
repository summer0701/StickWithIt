import { describe, expect, it } from 'vitest';
import { calculateAdaptiveGoal } from './adaptiveGoals';

describe('calculateAdaptiveGoal', () => {
  it('increases the next goal by 15% when completion is at least 130%', () => {
    const goal = calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [40],
      previousGoal: 40,
      yesterdayValue: 60,
    });

    expect(goal.value).toBe(46);
    expect(goal.trend).toBe('up');
  });

  it('increases the next goal by 5% when completion is 100-129%', () => {
    const goal = calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [40],
      previousGoal: 40,
      yesterdayValue: 48,
    });

    expect(goal.value).toBe(42);
    expect(goal.trend).toBe('up');
  });

  it('keeps the goal when completion is 70-99%', () => {
    const goal = calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [40],
      previousGoal: 40,
      yesterdayValue: 32,
    });

    expect(goal.value).toBe(40);
    expect(goal.trend).toBe('same');
  });

  it('decreases the next goal by 10% when completion is below 70%', () => {
    const goal = calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [40],
      previousGoal: 40,
      yesterdayValue: 20,
    });

    expect(goal.value).toBe(36);
    expect(goal.trend).toBe('down');
  });

  it('clamps repetition goals to the minimum and maximum limits', () => {
    expect(calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [5],
      previousGoal: 10,
      yesterdayValue: 5,
    }).value).toBe(10);

    expect(calculateAdaptiveGoal({
      type: 'squat',
      recentValues: [600],
      previousGoal: 500,
      yesterdayValue: 700,
    }).value).toBe(500);
  });
});
