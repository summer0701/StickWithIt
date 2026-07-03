import { beforeEach, describe, expect, it, vi } from 'vitest';

const ttsMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  nativeTextToSpeechSpeak: vi.fn(),
  runningPluginSpeak: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: ttsMocks.isNativePlatform,
  },
  registerPlugin: vi.fn(() => ({
    speak: ttsMocks.nativeTextToSpeechSpeak,
  })),
}));

vi.mock('../plugins/runningPlugin', () => ({
  RunningPlugin: {
    speak: ttsMocks.runningPluginSpeak,
  },
}));

import { speakCoachMessage, speakWithWebSpeech } from './ttsAdapter';

describe('ttsAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttsMocks.isNativePlatform.mockReturnValue(false);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(),
      },
    });
  });

  it('does not fall back to Web Speech outside the native app', async () => {
    await expect(speakCoachMessage('테스트 문구')).resolves.toBe(false);

    expect(ttsMocks.runningPluginSpeak).not.toHaveBeenCalled();
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('uses the native text-to-speech plugin if the running plugin is not ready', async () => {
    ttsMocks.isNativePlatform.mockReturnValue(true);
    ttsMocks.runningPluginSpeak.mockRejectedValueOnce(new Error('service not ready'));
    ttsMocks.nativeTextToSpeechSpeak.mockResolvedValueOnce(undefined);

    await expect(speakCoachMessage('테스트 문구')).resolves.toBe(true);

    expect(ttsMocks.runningPluginSpeak).toHaveBeenCalledWith({ text: '테스트 문구' });
    expect(ttsMocks.nativeTextToSpeechSpeak).toHaveBeenCalledWith({ text: '테스트 문구', language: 'ko-KR' });
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('keeps the Web Speech helper disabled', () => {
    expect(speakWithWebSpeech('테스트 문구')).toBe(false);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });
});
