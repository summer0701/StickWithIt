import { describe, expect, it } from 'vitest';
import { RUNNING_MUSIC_SEARCH_QUERY, buildYouTubeMusicSearchUrl } from './runningMusic';

describe('runningMusic', () => {
  it('builds a YouTube Music search URL for running music', () => {
    expect(buildYouTubeMusicSearchUrl()).toBe(
      `https://music.youtube.com/search?q=${encodeURIComponent(RUNNING_MUSIC_SEARCH_QUERY)}`,
    );
  });
});
