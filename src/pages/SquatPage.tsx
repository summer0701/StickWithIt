import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Info, Play, Settings } from 'lucide-react';
import { RunningPlugin } from '../plugins/runningPlugin';
import squatCameraBg from '../assets/squat-camera-bg.png';

type SquatPageProps = {
  onBack: () => void;
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

export default function SquatPage({ onBack }: SquatPageProps) {
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'camera'>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [reps, setReps] = useState(0);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown <= 0) {
      setPhase('camera');
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, phase]);

  const remainingSeconds = useMemo(() => {
    const total = 120;
    const elapsed = Math.min(total, Math.round((reps / TARGET_REPS) * total));
    return Math.max(0, total - elapsed);
  }, [reps]);

  function startCountdown() {
    setCountdown(COUNTDOWN_START);
    setReps(0);
    setPhase('countdown');
  }

  function stopSquat() {
    setPhase('ready');
    setCountdown(COUNTDOWN_START);
    setReps(0);
  }

  if (phase === 'camera') {
    return <SquatCameraScreen reps={reps} onBack={stopSquat} />;
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
          <small>목표 2:00</small>
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

function SquatCameraScreen({ reps, onBack }: { reps: number; onBack: () => void }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    RunningPlugin.openSquatPose().catch((error) => {
      console.debug('[SquatPage] Failed to open native squat pose screen.', error);
    });
    return undefined;
  }, []);

  return (
    <main className="squat-camera-screen" style={{ '--squat-camera-bg': `url(${squatCameraBg})` } as React.CSSProperties}>
      <div className="squat-camera-overlay" />
      <button className="squat-camera-back squat-icon-button" type="button" onClick={onBack} aria-label="뒤로가기">
        <ArrowLeft size={34} />
      </button>

      <section className="squat-camera-score">
        <span>SQUATS</span>
        <strong>{reps}</strong>
        <small>회</small>
        <hr />
        <b>Android Pose</b>
      </section>

      <section className="squat-live-feedback good">
        <span>자세 피드백</span>
        <strong>좋음</strong>
        <small>Android MediaPipe 화면에서 분석 중</small>
      </section>

      <section className="squat-floating-ranking">
        <h2>RANKING</h2>
        <div className="active">
          <span>3</span>
          <b>나</b>
          <em>{reps}회</em>
        </div>
        <p>고스트와 접전 중</p>
        <small>Native MediaPipe</small>
      </section>

      <GhostDistancePanel camera />
    </main>
  );
}

function GhostDistancePanel({ camera = false }: { camera?: boolean }) {
  return (
    <section className={camera ? 'squat-ghost-distance camera squat-panel' : 'squat-ghost-distance squat-panel'}>
      <h2>
        {camera ? '고스트와의 차이' : '나와 경쟁할 고스트'}
        {!camera && <Info size={18} aria-hidden="true" />}
      </h2>
      {!camera && <p>오늘의 나와 경쟁할 스쿼터들이야!</p>}
      <div className={camera ? 'ghost-line' : 'ghost-card-list'}>
        {ghostDistance.map((ghost) => (
          <div key={ghost.id} className={camera ? `ghost-dot ${ghost.tone}` : `ghost-card ${ghost.tone}`}>
            <span>{ghost.id}</span>
            <i aria-hidden="true" />
            {!camera && ghost.status && <small>{ghost.status}</small>}
            {camera && <small>{ghost.status}</small>}
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
