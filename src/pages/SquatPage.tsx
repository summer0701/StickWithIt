import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Info, Play, Settings } from 'lucide-react';
import { RunningPlugin } from '../plugins/runningPlugin';
import { readSquatDurationSeconds } from '../lib/squatSettings';

type SquatPageProps = {
  onBack: () => void;
  userId?: string;
};

const COUNTDOWN_START = 10;
const TARGET_REPS = 50;

const ghostDistance = [
  { id: '베스트', status: '빠름 ↑', tone: 'best' },
  { id: '평균', status: '약간 빠름 ↑', tone: 'average' },
  { id: '나', status: '', tone: 'current' },
  { id: '어제', status: '약간 느림 ↓', tone: 'yesterday' },
  { id: '워스트', status: '느림 ↓', tone: 'worst' },
];

export default function SquatPage({ onBack, userId = 'anonymous' }: SquatPageProps) {
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'launching'>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [reps, setReps] = useState(0);
  const durationSeconds = readSquatDurationSeconds(userId);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown <= 0) {
      openNativeSquatCamera();
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, phase]);

  const remainingSeconds = useMemo(() => {
    const total = durationSeconds;
    const elapsed = Math.min(total, Math.round((reps / TARGET_REPS) * total));
    return Math.max(0, total - elapsed);
  }, [durationSeconds, reps]);

  function startCountdown() {
    setCountdown(COUNTDOWN_START);
    setReps(0);
    setPhase('countdown');
  }

  function openNativeSquatCamera() {
    setPhase('launching');
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    RunningPlugin.openSquatPose({ durationSeconds }).catch((error) => {
      console.debug('[SquatPage] Failed to open native squat pose screen.', error);
      setPhase('ready');
    });
  }

  if (phase === 'launching') {
    return <main className="squat-screen squat-ready-screen" aria-label="카메라 실행 중" />;
  }

  return (
    <main className="squat-screen squat-ready-screen">
      <header className="squat-ready-top">
        <button className="squat-icon-button" type="button" onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={30} />
        </button>
        <span aria-hidden="true" />
        <button className="squat-icon-button" type="button" aria-label="설정">
          <Settings size={28} />
        </button>
      </header>

      <section className="squat-timer-ring" aria-label="스쿼트 남은 시간">
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
          <span>남은 시간</span>
          <strong>{formatClock(remainingSeconds)}</strong>
          <small>목표 {formatClock(durationSeconds)}</small>
        </div>
      </section>

      <GhostDistancePanel />

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
              <small>고스트와 스쿼트 시작!</small>
            </>
          )}
        </button>
      </footer>

      {phase === 'countdown' && (
        <div className="squat-countdown-overlay" role="status" aria-live="polite">
          <strong>{countdown}</strong>
          <span>카메라 화면으로 이동합니다</span>
        </div>
      )}
    </main>
  );
}

function GhostDistancePanel() {
  return (
    <section className="squat-ghost-distance squat-panel">
      <h2>
        나와 경쟁할 고스트
        <Info size={18} aria-hidden="true" />
      </h2>
      <p>오늘의 나와 경쟁할 스쿼터들이야!</p>
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
