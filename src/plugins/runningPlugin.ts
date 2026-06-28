import { registerPlugin } from '@capacitor/core';

export type NativeRunState = {
  sessionId?: string;
  elapsedSeconds: number;
  distanceMeters: number;
  speedKmh: number;
  latitude?: number;
  longitude?: number;
};

export type NativeCheckpoint = {
  id: number;
  session_id: string;
  elapsed_seconds: number;
  distance_meters: number;
  pace_seconds_per_km: number | null;
  speed_kmh: number;
  latitude: number;
  longitude: number;
  spoken_text?: string | null;
  created_at: number;
  synced?: boolean;
};

export type RunningPluginApi = {
  startRun(options: {
    sessionId: string;
    targetDistanceMeters: number;
    useNativeTts: boolean;
    ghostRunnersJson?: string;
  }): Promise<void>;
  stopRun(): Promise<void>;
  pauseRun(): Promise<void>;
  resumeRun(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  setTtsEnabled(options: { enabled: boolean }): Promise<void>;
  getRunState(): Promise<{ unsyncedCount: number; unsyncedCheckpoints: NativeCheckpoint[] }>;
  markCheckpointsSynced(options: { ids: number[] }): Promise<void>;
  addListener(eventName: 'runState', listenerFunc: (state: NativeRunState) => void): Promise<{ remove: () => Promise<void> }>;
  addListener(eventName: 'checkpoint', listenerFunc: (checkpoint: NativeCheckpoint) => void): Promise<{ remove: () => Promise<void> }>;
  addListener(eventName: 'debug', listenerFunc: (payload: { message?: string }) => void): Promise<{ remove: () => Promise<void> }>;
};

export const RunningPlugin = registerPlugin<RunningPluginApi>('RunningPlugin');
