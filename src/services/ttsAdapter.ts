import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeTextToSpeech = registerPlugin('NativeTextToSpeech');

export async function speakCoachMessage(message, options = {}) {
  if (!message) return false;

  if (Capacitor.isNativePlatform() && options.preferNative) {
    try {
      await NativeTextToSpeech.speak({ text: message, language: 'ko-KR' });
      return true;
    } catch (error) {
      console.debug('[ttsAdapter] Native TTS is not ready yet, falling back to Web Speech.', error);
    }
  }

  return speakWithWebSpeech(message);
}

export function speakWithWebSpeech(message) {
  if (!message || typeof window === 'undefined' || !window.speechSynthesis) {
    console.debug('[ttsAdapter] SpeechSynthesis is unavailable.');
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'ko-KR';
  utterance.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
