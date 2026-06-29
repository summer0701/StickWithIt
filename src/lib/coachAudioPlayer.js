import { Capacitor } from '@capacitor/core';
import { RunningPlugin } from '../plugins/runningPlugin';
import { speakCoachMessage } from '../services/ttsAdapter';

const MANIFEST_URL = '/tts-cache/manifest.json';
const PRELOAD_CATEGORIES = ['start', 'warmup', 'ahead', 'behind', 'close', 'overtake', 'overtaken', 'finish_push', 'one_km_left'];
const PRELOAD_LIMIT = 24;
const RECENT_LIMIT = 8;
const SYNTHETIC_CATEGORY_ITEM_COUNT = 10;

let manifestPromise = null;
let manifest = null;
const audioByKey = new Map();
const recentKeys = [];

export function preloadCoachAudio(categories = PRELOAD_CATEGORIES) {
  return loadCoachManifest()
    .then((loadedManifest) => {
      const items = selectItemsByCategories(loadedManifest, categories).slice(0, PRELOAD_LIMIT);
      items.forEach((item) => ensureAudio(audioCacheKey(item), audioFile(item.file)));
      return true;
    })
    .catch((error) => {
      console.debug('[coachAudioPlayer] Failed to preload coach audio.', error);
      return false;
    });
}

export async function playCoachCue(category, fallbackText) {
  if (!category) return speakFallback(fallbackText);

  try {
    const loadedManifest = await loadCoachManifest();
    const item = pickManifestItem(loadedManifest, category);
    if (!item) return speakFallback(fallbackText);

    if (Capacitor.isNativePlatform()) {
      try {
        await RunningPlugin.playCoachAudio({
          key: item.key,
          category: item.category,
          file: audioFile(item.file),
          fallbackText: fallbackText || item.text,
        });
        rememberKey(item.key);
        return true;
      } catch (error) {
        console.debug('[coachAudioPlayer] Native cached audio failed, using web audio.', error);
      }
    }

    const played = await playWebAudio(item);
    if (played) return true;
  } catch (error) {
    console.debug('[coachAudioPlayer] Cached coach cue failed.', error);
  }

  return speakFallback(fallbackText);
}

export async function loadCoachManifest() {
  if (manifest) return manifest;
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${MANIFEST_URL}: ${response.status}`);
        return response.json();
      })
      .then((json) => {
        manifest = {
          ...json,
          items: Object.fromEntries(
            Object.entries(json.items ?? {}).map(([key, item]) => [key, { key, ...item }]),
          ),
        };
        return manifest;
      });
  }
  return manifestPromise;
}

function selectItemsByCategories(loadedManifest, categories) {
  const categorySet = new Set(categories);
  return Object.values(loadedManifest.items ?? {}).filter((item) => categorySet.has(item.category));
}

function pickManifestItem(loadedManifest, category) {
  const items = selectItemsByCategories(loadedManifest, [category]);
  const candidates = items.length > 0 ? items : synthesizeCategoryItems(category);

  const fresh = candidates.find((item) => !recentKeys.includes(item.key));
  return fresh ?? candidates[Math.floor(Math.random() * candidates.length)];
}

function synthesizeCategoryItems(category) {
  return Array.from({ length: SYNTHETIC_CATEGORY_ITEM_COUNT }, (_, index) => {
    const key = `${category}_${String(index + 1).padStart(3, '0')}`;
    return {
      key,
      category,
      text: '',
      file: `/tts-cache/${key}.mp3`,
    };
  });
}

function ensureAudio(key, file) {
  if (typeof Audio === 'undefined' || audioByKey.has(key)) return null;
  const audio = new Audio(file);
  audio.preload = 'auto';
  audioByKey.set(key, audio);
  return audio;
}

function playWebAudio(item) {
  if (typeof Audio === 'undefined') return Promise.resolve(false);

  const key = audioCacheKey(item);
  const audio = ensureAudio(key, audioFile(item.file)) ?? audioByKey.get(key);
  if (!audio) return Promise.resolve(false);

  audio.currentTime = 0;
  return audio
    .play()
    .then(() => {
      rememberKey(item.key);
      return true;
    })
    .catch((error) => {
      console.debug('[coachAudioPlayer] Web audio playback failed.', error);
      return false;
    });
}

function audioCacheKey(item) {
  return item.key;
}

function audioFile(file) {
  const fileName = String(file ?? '').split('/').filter(Boolean).pop();
  if (!fileName) return file;
  return `/tts-cache/${fileName}`;
}

function rememberKey(key) {
  recentKeys.push(key);
  while (recentKeys.length > RECENT_LIMIT) recentKeys.shift();
}

function speakFallback(text) {
  if (!text) return false;
  return speakCoachMessage(text, { preferNative: true, useCache: false });
}
