export const RUNNING_MUSIC_SEARCH_QUERY = '러닝하기 좋은 음악';

export function buildYouTubeMusicSearchUrl(query = RUNNING_MUSIC_SEARCH_QUERY) {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}
