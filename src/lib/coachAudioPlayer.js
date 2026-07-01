import { Capacitor } from '@capacitor/core';
import { speakCoachMessage } from '../services/ttsAdapter';

export function preloadCoachAudio() {
  return Promise.resolve(Capacitor.isNativePlatform());
}

export async function playCoachCue(_category, fallbackText) {
  if (!fallbackText) return false;
  return speakCoachMessage(fallbackText, { preferNative: true });
}
