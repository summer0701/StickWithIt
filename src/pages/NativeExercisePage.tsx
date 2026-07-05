import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Headphones, Info, Play, Settings } from 'lucide-react';
import { RunningPlugin } from '../plugins/runningPlugin';
import { buildYouTubeMusicSearchUrl } from '../lib/runningMusic';

type NativeExercisePageProps = {
  userId: string;
  title: string;
  targetLabel: string;
  guide: string;
  ghostCaption: string;
  musicQuery?: string;
  screenClassName?: string;
  poseImageSrc?: string;
  durationSeconds: number;
  baseAverageValue: number;
  countdownStartSeconds?: number;
  countdownLaunchMessage?: string;
  completionEventName: 'jumpingJackFinished' | 'pushupFinished' | 'lungeFinished';
  onOpenNative: (options: { durationSeconds: number; baseAverageValue: number }) => Promise<void>;
  onCompleted: (payload: any) => void;
  onBack: () => void;
  onComplete?: () => void;
};

const COUNTDOWN_START = 10;
const TARGET_PROGRESS_UNITS = 50;
const ghostDistance = [
  { id: 'G5', status: 'Legend', tone: 'best' },
  { id: 'G4', status: 'Elite', tone: 'average' },
  { id: '나', status: '', tone: 'current' },
  { id: 'G2', status: 'Rookie', tone: 'yesterday' },
];

export default function NativeExercisePage({
  title,
  targetLabel,
  guide,
  ghostCaption,
  musicQuery,
  screenClassName = '',
  poseImageSrc,
  durationSeconds,
  baseAverageValue,
  countdownStartSeconds = COUNTDOWN_START,
  countdownLaunchMessage = '카메라 화면으로 이동합니다',
  completionEventName,
  onOpenNative,
  onCompleted,
  onBack,
  onComplete = onBack,
}: NativeExercisePageProps) {
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'launching'>('ready');
  const [countdown, setCountdown] = useState(countdownStartSeconds);
  const [progressUnits, setProgressUnits] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let cleanup: (() => void) | undefined;
    RunningPlugin.addListener(completionEventName as any, (payload: any) => {
      if (!active) return;
      if (payload.completed) onCompleted(payload);
      setPhase('ready');
      onComplete();
    }).then((listener) => {
      cleanup = () => {
        listener.remove();
      };
    }).catch((error) => {
      console.debug(`[${title}] Failed to listen for completion.`, error);
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [completionEventName, onComplete, onCompleted, title]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown <= 0) {
      openNativeCamera();
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, phase]);

  const remainingSeconds = useMemo(() => {
    const elapsed = Math.min(durationSeconds, Math.round((progressUnits / TARGET_PROGRESS_UNITS) * durationSeconds));
    return Math.max(0, durationSeconds - elapsed);
  }, [durationSeconds, progressUnits]);

  function startCountdown() {
    if (countdownStartSeconds <= 0) {
      setProgressUnits(0);
      openNativeCamera();
      return;
    }
    setCountdown(countdownStartSeconds);
    setProgressUnits(0);
    setPhase('countdown');
  }

  function openNativeCamera() {
    setPhase('launching');
    if (!Capacitor.isNativePlatform()) {
      setPhase('ready');
      return;
    }

    onOpenNative({ durationSeconds, baseAverageValue }).catch((error) => {
      console.debug(`[${title}] Failed to open native pose screen.`, error);
      setPhase('ready');
    });
  }

  function openMusic() {
    const query = musicQuery ?? `${title} 운동할 때 듣기 좋은 음악`;
    if (Capacitor.isNativePlatform()) {
      RunningPlugin.openRunningMusic({ query }).catch((error) => {
        console.debug(`[${title}] Failed to open music app.`, error);
      });
      return;
    }
    window.open(buildYouTubeMusicSearchUrl(query), '_blank', 'noopener,noreferrer');
  }

  if (phase === 'launching') {
    return <main className={`squat-screen squat-ready-screen ${screenClassName}`} aria-label={`${title} 카메라 실행 중`} />;
  }

  return (
    <main className={`squat-screen squat-ready-screen ${screenClassName}`}>
      <header className="squat-ready-top">
        <button className="squat-icon-button" type="button" onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={30} />
        </button>
        <span aria-hidden="true" />
        <button className="squat-icon-button" type="button" aria-label="설정">
          <Settings size={28} />
        </button>
      </header>

      <section className="squat-timer-ring" aria-label={`${title} 남은 시간`}>
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <linearGradient id="squat-progress-gradient" x1="20" y1="185" x2="194" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#75ee83" />
              <stop offset="1" stopColor="#45dce6" />
            </linearGradient>
          </defs>
          <circle className="track" cx="110" cy="110" r="93" />
          <circle className="progress" cx="110" cy="110" r="93" />
        </svg>
        <div>
          <span>{title}</span>
          <strong>{formatClock(remainingSeconds)}</strong>
          <small>{targetLabel} · {formatClock(durationSeconds)}</small>
        </div>
      </section>

      {poseImageSrc && (
        <div className="exercise-pose-hero" aria-hidden="true">
          <img src={poseImageSrc} alt="" />
        </div>
      )}

      <section className={`squat-coach-card squat-panel ${poseImageSrc ? 'with-pose-art' : ''}`}>
        {poseImageSrc && (
          <div className="squat-coach-badge" aria-hidden="true">
            <img src={poseImageSrc} alt="" />
          </div>
        )}
        <div className="squat-coach-copy">
          <h2>{title} 자세 안내</h2>
          <p>{guide}</p>
        </div>
        <button className="squat-icon-button" type="button" onClick={openMusic} aria-label="음성 안내">
          <Headphones size={24} />
        </button>
      </section>

      <GhostDistancePanel caption={ghostCaption} />

      <footer className="squat-start-footer">
        <button className="squat-main-action" type="button" onClick={startCountdown}>
          {phase === 'countdown' ? (
            <>
              <span>{countdown}</span>
              <small>초 후 시작</small>
            </>
          ) : (
            <>
              <Play size={44} fill="currentColor" />
              <strong>시작하기</strong>
              <small>전신이 보이도록 카메라 앞에 서 주세요</small>
            </>
          )}
        </button>
      </footer>

      {phase === 'countdown' && (
        <div className="squat-countdown-overlay" role="status" aria-live="polite">
          <div className="squat-countdown-content">
            <strong>{countdown}</strong>
            <span>{countdownLaunchMessage}</span>
          </div>
        </div>
      )}
    </main>
  );
}

function GhostDistancePanel({ caption }: { caption: string }) {
  return (
    <section className="squat-ghost-distance squat-panel">
      <h2>
        나와 경쟁할 고스트
        <Info size={18} aria-hidden="true" />
      </h2>
      <p>{caption}</p>
      <div className="ghost-card-list">
        {ghostDistance.map((ghost) => (
          <div key={ghost.id} className={`ghost-card ${ghost.tone}`}>
            <span>{ghost.id}</span>
            <i aria-hidden="true" />
            {ghost.status && <small>{ghost.status}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
