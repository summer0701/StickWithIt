import { describe, expect, it } from 'vitest';
import { RUNNING_MUSIC_SEARCH_QUERY, buildYouTubeMusicSearchUrl } from './runningMusic';

describe('runningMusic', () => {
  it('builds a YouTube Music search URL for running music', () => {
    expect(buildYouTubeMusicSearchUrl()).toBe(
      `https://music.youtube.com/search?q=${encodeURIComponent(RUNNING_MUSIC_SEARCH_QUERY)}`,
    );
  });

  it('builds a YouTube Music search URL for a custom exercise query', () => {
    const query = '스쿼트 운동할 때 듣기 좋은 음악';

    expect(buildYouTubeMusicSearchUrl(query)).toBe(
      `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
    );
  });
});
