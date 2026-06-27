import { describe, expect, it } from 'vitest';
import { getVoiceCue } from './voiceCoach';

describe('voiceCoach', () => {
  it('speaks every 500m and changes message by ghost status', () => {
    expect(
      getVoiceCue({ distanceKm: 0.5, targetDistanceKm: 3, ghostDiffSeconds: -12, lastCueDistanceKm: 0 }),
    ).toContain('앞서고 있어');
    expect(getVoiceCue({ distanceKm: 1, targetDistanceKm: 3, ghostDiffSeconds: 8, lastCueDistanceKm: 0.5 })).toContain(
      '따라잡을 수 있어',
    );
  });

  it('uses final 500m message', () => {
    expect(getVoiceCue({ distanceKm: 2.6, targetDistanceKm: 3, ghostDiffSeconds: -1, lastCueDistanceKm: 2 })).toContain(
      '이제 마지막이야',
    );
  });
});
