import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, MapPin, Music, Pause, Play, Settings, Unlock } from 'lucide-react';
import { calculateNextDistance, normalizePosition } from '../lib/distance';
import { compareWithGhost, estimateGhostElapsed, sameTargetDistance } from '../lib/ghostRun';
import { secondsPerKm } from '../lib/pace';
import { calculateCalories, formatGhostDelta, formatHudClock, formatHudPace } from '../lib/runningHud';
import { clearStoredSession, persistRunningSession, restoreRunningSession } from '../lib/runningSession';
import { watchRunPosition } from '../lib/geolocation';
import { supabase } from '../lib/supabaseClient';
import runningHudBg from '../assets/running-hud-bg.jpg';

const EMPTY_SENSOR = '--';

export default function RunPage({ user, targetDistanceKm, onCancel, onComplete }) {
  const [status, setStatus] = useState('running');
  const [locked, setLocked] = useState(false);
  const [routeFocused, setRouteFocused] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentPaceSeconds, setCurrentPaceSeconds] = useState(null);
  const [splits, setSplits] = useState([]);
  const [ghostRun, setGhostRun] = useState(null);
  const [ghostSplits, setGhostSplits] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [gpsMessage, setGpsMessage] = useState('GPS 권한 확인 중');
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(new Date());
  const previousPointRef = useRef(null);
  const cleanupWatchRef = useRef(null);
  const lastSplitDistanceRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const statusRef = useRef(status);
  const distanceRef = useRef(distanceKm);
  const elapsedRef = useRef(elapsedSeconds);

  const ghostDiffSeconds = useMemo(
    () => compareWithGhost({ currentDistanceKm: distanceKm, elapsedSeconds, ghostRun, ghostSplits }),
    [distanceKm, elapsedSeconds, ghostRun, ghostSplits],
  );

  const averagePace = useMemo(() => secondsPerKm(distanceKm, elapsedSeconds), [distanceKm, elapsedSeconds]);
  const currentPace = currentPaceSeconds ?? averagePace;
  const ghostPace = useMemo(
    () => secondsPerKm(Number(ghostRun?.actual_distance_km ?? ghostRun?.target_distance_km ?? 0), ghostRun?.duration_seconds),
    [ghostRun],
  );
  const progress = Math.min(100, Math.max(0, (distanceKm / targetDistanceKm) * 100));
  const calories = calculateCalories(distanceKm);
  const ghostElapsed = estimateGhostElapsed({ currentDistanceKm: distanceKm, ghostRun, ghostSplits });
  const ghostStatusText =
    ghostDiffSeconds == null
      ? '어제 기록 없음'
      : ghostDiffSeconds <= 0
        ? `${formatGhostDelta(ghostDiffSeconds)} 앞서고 있어요!`
        : `${formatGhostDelta(ghostDiffSeconds)} 뒤처졌어요`;

  const handlePosition = useCallback((position) => {
    if (statusRef.current !== 'running') return;

    const nextPoint = normalizePosition(position);
    const previousPoint = previousPointRef.current;
    const nextDistance = calculateNextDistance(previousPoint, nextPoint, distanceRef.current);

    if (!nextDistance.accepted && nextDistance.reason === 'low_accuracy') {
      setGpsMessage('GPS 정확도가 낮아 잠시 무시했습니다.');
      return;
    }

    if (!nextDistance.accepted && nextDistance.reason !== 'too_short') {
      setGpsMessage('GPS 신호를 안정화하는 중');
      return;
    }

    if (nextDistance.accepted) {
      if (previousPoint) {
        const movementSeconds = Math.max(1, (nextPoint.timestamp - previousPoint.timestamp) / 1000);
        setCurrentPaceSeconds(secondsPerKm(nextDistance.distanceMeters / 1000, movementSeconds));
      }

      previousPointRef.current = nextPoint;
      setDistanceKm(nextDistance.totalDistanceKm);
      setRoutePoints((current) => [...current.slice(-39), nextPoint]);
      setGpsMessage(`GPS 추적 중 · ±${Math.round(nextPoint.accuracy)}m`);
      maybeAddSplit(nextDistance.totalDistanceKm);
    }
  }, []);

  const handlePositionError = useCallback((error) => {
    setGpsMessage(error.message ?? 'GPS 신호를 확인해 주세요.');
  }, []);

  useEffect(() => {
    const savedSession = restoreRunningSession(user.id, targetDistanceKm);
    if (!savedSession) return;

    startedAtRef.current = new Date(savedSession.startedAt ?? Date.now());
    setDistanceKm(savedSession.distanceKm);
    setElapsedSeconds(savedSession.elapsedSeconds);
    setSplits(savedSession.splits);
    setRoutePoints(savedSession.routePoints);
    setStatus(savedSession.status);
    lastSplitDistanceRef.current = savedSession.lastSplitDistance;
  }, [targetDistanceKm, user.id]);

  useEffect(() => {
    async function loadYesterdayGhost() {
      const { data: runs } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(80);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      const yesterdayRuns = (runs ?? [])
        .filter((run) => sameTargetDistance(run.target_distance_km, targetDistanceKm))
        .filter((run) => (run.started_at ?? run.created_at ?? '').slice(0, 10) === yesterdayKey)
        .sort((a, b) => a.duration_seconds - b.duration_seconds);
      const selected = yesterdayRuns[0] ?? null;

      setGhostRun(selected);

      if (!selected) {
        setGhostSplits([]);
        return;
      }

      const { data } = await supabase
        .from('run_splits')
        .select('*')
        .eq('run_id', selected.id)
        .order('distance_km', { ascending: true });
      setGhostSplits(data ?? []);
    }

    loadYesterdayGhost();
  }, [targetDistanceKm, user.id]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    distanceRef.current = distanceKm;
  }, [distanceKm]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    if (status !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') {
      cleanupWatchRef.current?.();
      cleanupWatchRef.current = null;
      return undefined;
    }

    let cancelled = false;

    async function startWatch() {
      setGpsMessage('GPS 권한 확인 중');
      const cleanup = await watchRunPosition(handlePosition, handlePositionError);
      if (cancelled) {
        cleanup?.();
        return;
      }

      cleanupWatchRef.current = cleanup;
    }

    startWatch();

    return () => {
      cancelled = true;
      cleanupWatchRef.current?.();
      cleanupWatchRef.current = null;
    };
  }, [handlePosition, handlePositionError, status]);

  useEffect(() => {
    if (sessionEndedRef.current) return;

    persistRunningSession({
      userId: user.id,
      targetDistanceKm,
      status,
      distanceKm,
      elapsedSeconds,
      splits,
      routePoints,
      startedAt: startedAtRef.current.toISOString(),
      lastSplitDistance: lastSplitDistanceRef.current,
    });
  }, [distanceKm, elapsedSeconds, routePoints, splits, status, targetDistanceKm, user.id]);

  function maybeAddSplit(nextDistanceKm) {
    const nextSplitDistance = Math.floor(nextDistanceKm * 2) / 2;
    if (nextSplitDistance > 0 && nextSplitDistance > lastSplitDistanceRef.current) {
      lastSplitDistanceRef.current = nextSplitDistance;
      setSplits((current) => [
        ...current,
        {
          distance_km: nextSplitDistance,
          elapsed_seconds: elapsedRef.current,
          pace_seconds_per_km: secondsPerKm(nextSplitDistance, elapsedRef.current),
        },
      ]);
    }
  }

  async function finishRun() {
    sessionEndedRef.current = true;
    setStatus('finished');
    setSaving(true);
    cleanupWatchRef.current?.();
    cleanupWatchRef.current = null;

    const endedAt = new Date();
    const durationSeconds = Math.max(1, elapsedSeconds);
    const avgPace = secondsPerKm(distanceKm, durationSeconds);
    const finalSplits =
      splits.length === 0 || splits[splits.length - 1].distance_km < distanceKm
        ? [
            ...splits,
            {
              distance_km: Number(distanceKm.toFixed(3)),
              elapsed_seconds: durationSeconds,
              pace_seconds_per_km: avgPace,
            },
          ]
        : splits;

    const runPayload = {
      user_id: user.id,
      target_distance_km: targetDistanceKm,
      actual_distance_km: Number(distanceKm.toFixed(3)),
      duration_seconds: durationSeconds,
      avg_pace_seconds_per_km: avgPace,
      started_at: startedAtRef.current?.toISOString() ?? endedAt.toISOString(),
      ended_at: endedAt.toISOString(),
    };

    const { data: savedRun, error } = await supabase.from('runs').insert(runPayload).select().single();

    if (!error && savedRun) {
      const splitPayload = finalSplits.map((split) => ({
        run_id: savedRun.id,
        user_id: user.id,
        distance_km: split.distance_km,
        elapsed_seconds: split.elapsed_seconds,
        pace_seconds_per_km: split.pace_seconds_per_km,
      }));

      if (splitPayload.length > 0) {
        await supabase.from('run_splits').insert(splitPayload);
      }
    }

    clearStoredSession();
    setSaving(false);
    onComplete({
      run: savedRun ?? runPayload,
      splits: finalSplits,
      ghostRun,
      ghostDiffSeconds,
      saveError: error?.message,
    });
  }

  function togglePause() {
    setStatus((current) => (current === 'running' ? 'paused' : 'running'));
  }

  return (
    <main className="run-screen running-hud" style={{ '--running-bg': `url(${runningHudBg})` }}>
      <header className="run-hud-top">
        <button className="hud-icon-button" type="button" onClick={() => {}} aria-label="음악">
          <Music size={24} />
        </button>
        <strong className="run-hud-logo">끝까지 <span>달려라</span></strong>
        <button className="hud-icon-button" type="button" onClick={() => {}} aria-label="설정">
          <Settings size={24} />
        </button>
      </header>

      <section className="ghost-race-card" aria-label="고스트 비교">
        <h1>어제의 나를 추월하자!</h1>
        <div className="ghost-pace-row">
          <div>
            <span>고스트 (어제의 나)</span>
            <strong className="blue">{formatHudPace(ghostPace)}</strong>
          </div>
          <b>VS</b>
          <div>
            <span>현재 페이스</span>
            <strong className="green">{formatHudPace(currentPace)}</strong>
          </div>
        </div>
        <div className="ghost-track">
          <span className="ghost-runner ghost-left" />
          <span className="ghost-track-fill" style={{ width: `${Math.min(100, Math.max(8, progress))}%` }} />
          <span className="ghost-runner ghost-right" />
        </div>
        <p className={ghostDiffSeconds == null ? 'muted' : ghostDiffSeconds <= 0 ? 'green' : 'orange'}>
          {ghostStatusText}
        </p>
        {ghostElapsed != null && <small>어제 예상 시간 {formatHudClock(ghostElapsed)}</small>}
      </section>

      <section className={`route-card ${routeFocused ? 'focused' : ''}`} aria-label="경로 미니맵">
        <MiniMap points={routePoints} distanceKm={distanceKm} />
        <span className="gps-pill">{gpsMessage}</span>
      </section>

      <section className="hud-stats-card">
        <HudStat label="거리" value={distanceKm.toFixed(2)} unit="km" highlight />
        <HudStat label="시간" value={formatHudClock(elapsedSeconds)} />
        <HudStat label="평균 페이스" value={formatHudPace(averagePace)} accent="green" />
        <HudStat label="칼로리" value={calories} unit="kcal" />
        <HudStat label="심박수" value={EMPTY_SENSOR} unit="bpm" accent="orange" />
        <HudStat label="케이던스" value={EMPTY_SENSOR} unit="spm" />
      </section>

      <section className="next-goal-card">
        <div>
          <span>다음 목표</span>
          <strong>{Number(targetDistanceKm).toFixed(1)} km 도달하기</strong>
        </div>
        <div className="goal-progress-row">
          <div className="goal-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <b>
            {distanceKm.toFixed(2)} <span>/ {Number(targetDistanceKm).toFixed(2)} km</span>
          </b>
        </div>
      </section>

      {status === 'paused' && (
        <div className="paused-session-card">
          <strong>일시정지됨</strong>
          <span>GPS와 타이머가 멈췄습니다.</span>
          <button type="button" onClick={finishRun} disabled={saving || locked || elapsedSeconds === 0}>
            {saving ? '저장 중...' : '러닝 종료'}
          </button>
        </div>
      )}

      <div className="run-hud-controls">
        <button className={`hud-action-button ${locked ? 'active' : ''}`} type="button" onClick={() => setLocked((value) => !value)}>
          {locked ? <Lock size={24} /> : <Unlock size={24} />}
          <span>잠금</span>
        </button>
        <button className="hud-pause-button" type="button" onClick={togglePause} disabled={saving || locked}>
          {status === 'running' ? <Pause size={34} /> : <Play size={34} />}
          <span>{status === 'running' ? '일시정지' : '재개'}</span>
        </button>
        <button
          className={`hud-action-button ${routeFocused ? 'active' : ''}`}
          type="button"
          onClick={() => setRouteFocused((value) => !value)}
          disabled={locked}
        >
          <MapPin size={28} />
          <span>경로</span>
        </button>
      </div>
    </main>
  );
}

function HudStat({ label, value, unit, accent, highlight }) {
  return (
    <div className="hud-stat">
      <span>{label}</span>
      <strong className={`${accent ?? ''} ${highlight ? 'highlight' : ''}`}>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
    </div>
  );
}

function MiniMap({ points, distanceKm }) {
  const path = useMemo(() => buildRoutePath(points), [points]);

  return (
    <div className="mini-map">
      <svg viewBox="0 0 120 120" role="img" aria-label="현재 경로">
        <circle cx="60" cy="60" r="52" />
        <path className="map-grid" d="M24 24 96 96M96 24 24 96M60 8v104M8 60h104" />
        <path className="route-line" d={path} />
        <circle className="route-dot" cx="60" cy="60" r="5" />
      </svg>
      <b>{distanceKm.toFixed(1)} km</b>
    </div>
  );
}

function buildRoutePath(points) {
  if (points.length < 2) return 'M60 96 C52 78 70 68 60 50 C52 38 72 28 64 16';

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lonSpan = Math.max(0.00001, maxLon - minLon);

  return points
    .map((point, index) => {
      const x = 16 + ((point.longitude - minLon) / lonSpan) * 88;
      const y = 104 - ((point.latitude - minLat) / latSpan) * 88;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}
