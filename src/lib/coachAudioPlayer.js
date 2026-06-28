import { Capacitor } from '@capacitor/core';
import { RunningPlugin } from '../plugins/runningPlugin';
import { speakCoachMessage } from '../services/ttsAdapter';

const MANIFEST_URL = '/tts-cache/manifest.json';
const PRELOAD_CATEGORIES = ['start', 'ahead', 'behind', 'finish_push', 'one_km_left'];
const PRELOAD_LIMIT = 10;
const RECENT_LIMIT = 8;
export const COACH_VOICE_TYPES = ['type2', 'type1'];
export const COACH_VOICE_STORAGE_KEY = 'stickwithit:coach-voice-type';

let manifestPromise = null;
let manifest = null;
const audioByKey = new Map();
const recentKeys = [];

export function getCoachVoiceType() {
  if (typeof window === 'undefined') return COACH_VOICE_TYPES[0];
  const stored = window.localStorage.getItem(COACH_VOICE_STORAGE_KEY);
  return COACH_VOICE_TYPES.includes(stored) ? stored : COACH_VOICE_TYPES[0];
}

export function setCoachVoiceType(voiceType) {
  const nextVoiceType = COACH_VOICE_TYPES.includes(voiceType) ? voiceType : COACH_VOICE_TYPES[0];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COACH_VOICE_STORAGE_KEY, nextVoiceType);
  }
  audioByKey.clear();
  return nextVoiceType;
}

export function preloadCoachAudio(categories = PRELOAD_CATEGORIES) {
  return loadCoachManifest()
    .then((loadedManifest) => {
      const items = selectItemsByCategories(loadedManifest, categories).slice(0, PRELOAD_LIMIT);
      items.forEach((item) => ensureAudio(audioCacheKey(item), selectedVoiceFile(item.file)));
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
          file: selectedVoiceFile(item.file),
          voiceType: getCoachVoiceType(),
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
  if (items.length === 0) return null;

  const fresh = items.find((item) => !recentKeys.includes(item.key));
  return fresh ?? items[Math.floor(Math.random() * items.length)];
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
  const audio = ensureAudio(key, selectedVoiceFile(item.file)) ?? audioByKey.get(key);
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
  return `${getCoachVoiceType()}:${item.key}`;
}

function selectedVoiceFile(file) {
  const voiceType = getCoachVoiceType();
  const fileName = String(file ?? '').split('/').filter(Boolean).pop();
  if (!fileName) return file;
  return `/tts-cache/${voiceType}/${fileName}`;
}

function rememberKey(key) {
  recentKeys.push(key);
  while (recentKeys.length > RECENT_LIMIT) recentKeys.shift();
}

function speakFallback(text) {
  if (!text) return false;
  return speakCoachMessage(text, { preferNative: true, useCache: false });
}
