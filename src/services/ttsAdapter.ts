import { Capacitor, registerPlugin } from '@capacitor/core';
import { RunningPlugin } from '../plugins/runningPlugin';

const NativeTextToSpeech = registerPlugin('NativeTextToSpeech');

export async function speakCoachMessage(message, _options = {}) {
  if (!message) return false;
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await RunningPlugin.speak({ text: message });
    return true;
  } catch (error) {
    console.debug('[ttsAdapter] RunningPlugin TTS is not ready yet, trying NativeTextToSpeech.', error);
    try {
      await NativeTextToSpeech.speak({ text: message, language: 'ko-KR' });
      return true;
    } catch (nativeTextToSpeechError) {
      console.debug('[ttsAdapter] Native TTS is unavailable.', nativeTextToSpeechError);
      return false;
    }
  }
}

export function speakWithWebSpeech(message) {
  if (message) console.debug('[ttsAdapter] Web Speech is disabled; Native TTS only.');
  return false;
}
