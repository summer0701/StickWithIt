import { describe, expect, it } from 'vitest';
import {
  calculateCalories,
  formatGhostGoalScaleLabel,
  formatGhostDelta,
  formatGhostScaleKm,
  formatHudClock,
  formatHudPace,
  getNextRunHudPanel,
  shouldConfirmTargetDistanceChange,
  shouldShowBatteryOptimizationMenu,
} from './runningHud';

describe('runningHud', () => {
  it('formats elapsed time for the HUD', () => {
    expect(formatHudClock(0)).toBe('0:00');
    expect(formatHudClock(768)).toBe('12:48');
  });

  it('formats pace as min/km and hides empty pace', () => {
    expect(formatHudPace(null)).toBe("--'--\"");
    expect(formatHudPace(0)).toBe("--'--\"");
    expect(formatHudPace(358)).toBe('5\'58"/km');
  });

  it('formats ghost delta with sign and minute seconds', () => {
    expect(formatGhostDelta(-16)).toBe('+0:16');
    expect(formatGhostDelta(75)).toBe('-1:15');
  });

  it('calculates temporary calories from distance', () => {
    expect(calculateCalories(2.14)).toBe(158);
    expect(calculateCalories(-1)).toBe(0);
  });

  it('hides the battery optimization menu after native exemption is applied', () => {
    expect(shouldShowBatteryOptimizationMenu({ isNative: true, isIgnoringBatteryOptimizations: true })).toBe(false);
    expect(shouldShowBatteryOptimizationMenu({ isNative: true, isIgnoringBatteryOptimizations: false })).toBe(true);
    expect(shouldShowBatteryOptimizationMenu({ isNative: true, isIgnoringBatteryOptimizations: null })).toBe(false);
    expect(shouldShowBatteryOptimizationMenu({ isNative: false, isIgnoringBatteryOptimizations: null })).toBe(true);
  });

  it('toggles the running HUD panel between ghost visualization and stats', () => {
    expect(getNextRunHudPanel('ghost')).toBe('stats');
    expect(getNextRunHudPanel('stats')).toBe('ghost');
    expect(getNextRunHudPanel(undefined)).toBe('stats');
  });

  it('requires confirmation when changing target distance during an active ghost run', () => {
    expect(
      shouldConfirmTargetDistanceChange({
        status: 'running',
        currentTargetDistanceKm: 10,
        nextTargetDistanceKm: 5,
        ghostRunnerCount: 2,
      }),
    ).toBe(true);
    expect(
      shouldConfirmTargetDistanceChange({
        status: 'paused',
        currentTargetDistanceKm: 10,
        nextTargetDistanceKm: 5,
        ghostRunnerCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldConfirmTargetDistanceChange({
        status: 'preparing',
        currentTargetDistanceKm: 10,
        nextTargetDistanceKm: 5,
        ghostRunnerCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldConfirmTargetDistanceChange({
        status: 'running',
        currentTargetDistanceKm: 10,
        nextTargetDistanceKm: 10,
        ghostRunnerCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldConfirmTargetDistanceChange({
        status: 'running',
        currentTargetDistanceKm: 10,
        nextTargetDistanceKm: 5,
        ghostRunnerCount: 0,
      }),
    ).toBe(false);
  });

  it('formats ghost race scale labels with the target distance marker', () => {
    expect(formatGhostScaleKm(5)).toBe('5.0 km');
    expect(formatGhostScaleKm(10)).toBe('10 km');
    expect(formatGhostGoalScaleLabel(10)).toBe('목표 10 km');
    expect(formatGhostGoalScaleLabel(7.5)).toBe('목표 7.5 km');
  });
});
