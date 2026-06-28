import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Lock, MapPin, Pause, Play, Settings, Unlock } from 'lucide-react';
import { formatHudClock, formatHudPace } from '../lib/runningHud';
import { buildCheckpoint, createLocationTracker } from '../services/locationTracker';
import { loadRecentRunHistory } from '../services/runComparison';
import {
  completeRunRecord,
  createRunRecord,
  flushCheckpointQueue,
  readCheckpointQueue,
  saveRunCheckpoint,
  isValidUuid,
} from '../services/runRecorder';
import { buildGhostRunners, rememberSpokenMessage, ruleBasedCoach } from '../services/ruleBasedCoach';
import { COACH_VOICE_TYPES, getCoachVoiceType, playCoachCue, preloadCoachAudio, setCoachVoiceType } from '../lib/coachAudioPlayer';
import { RunningPlugin } from '../plugins/runningPlugin';
import runningHudBg from '../assets/running-hud-bg.jpg';

const CHECKPOINT_INTERVAL_SECONDS = 60;
const FINISH_HOLD_MS = 3000;
const HOLD_RING_CIRCUMFERENCE = 264;
const START_COACH_TEXT = '달리기 시작. 오늘도 과거의 너와 경쟁한다.';

export default function RunPage({ user, targetDistanceKm, onTargetChange, onCancel, onComplete }) {
  const normalizedTargetDistanceKm = Math.max(0.1, Number(targetDistanceKm) || 10);
  const targetDistanceMeters = normalizedTargetDistanceKm * 1000;
  const [status, setStatus] = useState('preparing');
  const [locked, setLocked] = useState(false);
  const [routeFocused, setRouteFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [batteryGuideOpen, setBatteryGuideOpen] = useState(false);
  const [coachVoiceType, setCoachVoiceTypeState] = useState(() => getCoachVoiceType());
  const [targetDistanceInput, setTargetDistanceInput] = useState(() => normalizedTargetDistanceKm.toFixed(1));
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [routePoints, setRoutePoints] = useState([]);
  const [gpsMessage, setGpsMessage] = useState('GPS 준비 중');
  const [coachMessage, setCoachMessage] = useState('러닝 시작 전 위치 권한 안내를 확인해 주세요.');
  const [saving, setSaving] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [recentRuns, setRecentRuns] = useState([]);
  const [recentCheckpoints, setRecentCheckpoints] = useState([]);

  const runRef = useRef(null);
  const trackerRef = useRef(null);
  const startedAtRef = useRef(new Date());
  const lastPointRef = useRef(null);
  const lastCheckpointAtRef = useRef(0);
  const spokenMessagesRef = useRef([]);
  const statusRef = useRef(status);
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const longPressTimeoutRef = useRef(null);
  const longPressFrameRef = useRef(null);
  const longPressStartedAtRef = useRef(0);
  const longPressTriggeredRef = useRef(false);
  const nativeListenerCleanupRef = useRef([]);
  const usingNativeRunRef = useRef(false);
  const autoStartRequestedRef = useRef(false);

  const distanceKm = distanceMeters / 1000;
  const averagePace = useMemo(() => {
    if (distanceKm <= 0 || elapsedSeconds <= 0) return null;
    return Math.round(elapsedSeconds / distanceKm);
  }, [distanceKm, elapsedSeconds]);
  const speedKmh = useMemo(() => {
    if (distanceKm <= 0 || elapsedSeconds <= 0) return 0;
    return distanceKm / (elapsedSeconds / 3600);
  }, [distanceKm, elapsedSeconds]);
  const progress = Math.min(100, Math.max(0, (distanceMeters / targetDistanceMeters) * 100));

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    distanceRef.current = distanceMeters;
  }, [distanceMeters]);

  useEffect(() => {
    setTargetDistanceInput(normalizedTargetDistanceKm.toFixed(1));
  }, [normalizedTargetDistanceKm]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    setQueuedCount(readCheckpointQueue().length);
    preloadCoachAudio();
    loadRecentRunHistory(user.id).then(({ recentRuns: runs, recentCheckpoints: checkpoints }) => {
      setRecentRuns(runs);
      setRecentCheckpoints(checkpoints);
    });
  }, [user.id]);

  useEffect(() => {
    if (autoStartRequestedRef.current) return;
    autoStartRequestedRef.current = true;
    startRun();
  }, []);

  useEffect(() => {
    function handleOnline() {
      flushCheckpointQueue().then((result) => setQueuedCount(result.remaining ?? 0));
      syncNativeCheckpoints();
    }

    function handleVisible() {
      if (document.visibilityState === 'visible') syncNativeCheckpoints();
    }

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      trackerRef.current?.stop?.();
      nativeListenerCleanupRef.current.forEach((cleanup) => cleanup?.());
      cancelFinishHold(false);
    };
  }, []);

  async function selectCoachVoiceType(nextVoiceType) {
    const selectedVoiceType = setCoachVoiceType(nextVoiceType);
    setCoachVoiceTypeState(selectedVoiceType);
    await preloadCoachAudio(['start', 'ahead', 'behind', 'finish_push', 'one_km_left']);
    if (Capacitor.isNativePlatform()) {
      RunningPlugin.setCoachVoiceType({ voiceType: selectedVoiceType }).catch((error) => {
        console.debug('[RunPage] Native coach voice type update failed.', error);
      });
    }
  }

  function applyTargetDistance() {
    const nextTargetDistanceKm = Math.max(0.1, Math.min(100, Number(targetDistanceInput) || normalizedTargetDistanceKm));
    onTargetChange?.(nextTargetDistanceKm);
    setTargetDistanceInput(nextTargetDistanceKm.toFixed(1));
    if (Capacitor.isNativePlatform()) {
      RunningPlugin.updateTargetDistance({ targetDistanceMeters: nextTargetDistanceKm * 1000 }).catch((error) => {
        console.debug('[RunPage] Native target distance update failed.', error);
      });
    }
  }

  function openBatteryOptimizationSettings() {
    setSettingsOpen(false);
    if (!Capacitor.isNativePlatform()) {
      setBatteryGuideOpen(true);
      return;
    }
    RunningPlugin.openBatteryOptimizationSettings().catch((error) => {
      console.debug('[RunPage] Battery optimization settings failed.', error);
      setBatteryGuideOpen(true);
    });
  }

  async function syncNativeCheckpoints() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const state = await RunningPlugin.getRunState();
      const syncedIds = [];
      for (const checkpoint of state.unsyncedCheckpoints ?? []) {
        const runId = isValidUuid(runRef.current?.id) ? runRef.current.id : checkpoint.session_id;
        if (!isValidUuid(runId) || !isValidUuid(user.id)) {
          console.debug('[RunPage] Dropping native checkpoint with invalid ids.', checkpoint);
          if (checkpoint.id) syncedIds.push(checkpoint.id);
          continue;
        }

        const result = await saveRunCheckpoint({
          run_id: runId,
          user_id: user.id,
          elapsed_seconds: checkpoint.elapsed_seconds,
          distance_meters: checkpoint.distance_meters,
          pace_seconds_per_km: checkpoint.pace_seconds_per_km,
          speed_kmh: checkpoint.speed_kmh,
          latitude: checkpoint.latitude,
          longitude: checkpoint.longitude,
          created_at: new Date(checkpoint.created_at).toISOString(),
        });
        if (!result.queued && !result.error) syncedIds.push(checkpoint.id);
      }
      if (syncedIds.length > 0) await RunningPlugin.markCheckpointsSynced({ ids: syncedIds });
      setQueuedCount(readCheckpointQueue().length + Math.max(0, (state.unsyncedCount ?? 0) - syncedIds.length));
    } catch (error) {
      console.debug('[RunPage] Native checkpoint sync failed.', error);
    }
  }

  const saveCheckpointAndCoach = useCallback(async (point, force = false) => {
    if (!runRef.current || !point) return;
    const elapsed = Math.max(1, elapsedRef.current);
    if (!force && elapsed - lastCheckpointAtRef.current < CHECKPOINT_INTERVAL_SECONDS) return;

    const checkpoint = buildCheckpoint({
      runId: runRef.current.id,
      userId: user.id,
      elapsedSeconds: elapsed,
      distanceMeters: distanceRef.current,
      point,
    });

    console.debug('[RunPage] Saving checkpoint.', checkpoint);
    const result = await saveRunCheckpoint(checkpoint);
    lastCheckpointAtRef.current = elapsed;
    setQueuedCount(readCheckpointQueue().length);

    const cue = ruleBasedCoach({
      currentCheckpoint: checkpoint,
      recentRuns,
      recentCheckpoints,
      targetDistanceMeters,
      spokenMessages: spokenMessagesRef.current,
    });

    const cueText = cue.fallbackText ?? cue.message;
    setCoachMessage(cueText);
    if (cue.priority > 1) {
      const spoken = await playCoachCue(cue.category, cueText);
      if (spoken) spokenMessagesRef.current = rememberSpokenMessage(spokenMessagesRef.current, cueText);
    }

    if (result.queued) {
      setGpsMessage('네트워크 장애로 체크포인트를 로컬 큐에 저장했습니다.');
    }
  }, [recentCheckpoints, recentRuns, targetDistanceMeters, user.id]);

  useEffect(() => {
    if (status !== 'running' || usingNativeRunRef.current) return undefined;
    const timer = window.setInterval(() => {
      if (lastPointRef.current) saveCheckpointAndCoach(lastPointRef.current);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [saveCheckpointAndCoach, status]);

  async function startRun() {
    setSaving(true);
    try {
      startedAtRef.current = new Date();
      const run = await createRunRecord({ userId: user.id, startedAt: startedAtRef.current, targetDistanceMeters });
      runRef.current = run;
      await preloadCoachAudio(['start', 'ahead', 'behind', 'finish_push', 'one_km_left']);

      if (Capacitor.isNativePlatform()) {
        usingNativeRunRef.current = true;
        const stateListener = await RunningPlugin.addListener('runState', (state) => {
          setElapsedSeconds(state.elapsedSeconds);
          setDistanceMeters(state.distanceMeters);
          setRoutePoints((current) => [
            ...current.slice(-79),
            {
              latitude: state.latitude,
              longitude: state.longitude,
              accuracy: 0,
              timestamp: Date.now(),
            },
          ]);
          setGpsMessage('Native GPS 추적과 음성 코칭 실행 중');
        });
        const checkpointListener = await RunningPlugin.addListener('checkpoint', (checkpoint) => {
          setCoachMessage(checkpoint.spoken_text ?? 'Native 체크포인트를 저장했습니다.');
          const runId = isValidUuid(runRef.current?.id) ? runRef.current.id : checkpoint.session_id;
          if (!isValidUuid(runId) || !isValidUuid(user.id)) {
            console.debug('[RunPage] Ignoring native checkpoint with invalid ids.', checkpoint);
            return;
          }
          saveRunCheckpoint({
            run_id: runId,
            user_id: user.id,
            elapsed_seconds: checkpoint.elapsed_seconds,
            distance_meters: checkpoint.distance_meters,
            pace_seconds_per_km: checkpoint.pace_seconds_per_km,
            speed_kmh: checkpoint.speed_kmh,
            latitude: checkpoint.latitude,
            longitude: checkpoint.longitude,
            created_at: new Date(checkpoint.created_at).toISOString(),
          }).then(() => syncNativeCheckpoints());
        });
        const debugListener = await RunningPlugin.addListener('debug', (payload) => {
          console.debug('[RunningPlugin]', payload.message);
        });
        nativeListenerCleanupRef.current = [
          () => stateListener.remove(),
          () => checkpointListener.remove(),
          () => debugListener.remove(),
        ];
        await RunningPlugin.startRun({
          sessionId: run.id,
          targetDistanceMeters,
          useNativeTts: true,
          voiceType: coachVoiceType,
          ghostRunnersJson: JSON.stringify(buildGhostRunners(recentRuns, recentCheckpoints)),
        });
        setStatus('running');
        setCoachMessage(START_COACH_TEXT);
        return;
      }

      const tracker = await createLocationTracker({
        onAcceptedPoint: ({ point, distanceMeters: nextDistanceMeters }) => {
          lastPointRef.current = point;
          setDistanceMeters(nextDistanceMeters);
          setRoutePoints((current) => [...current.slice(-79), point]);
          setGpsMessage(`GPS 추적 중 · ±${Math.round(point.accuracy)}m`);
          saveCheckpointAndCoach(point);
        },
        onRejectedPoint: ({ reason }) => {
          const message = reason === 'low_accuracy' ? 'GPS 정확도가 낮아 기록에 반영하지 않았습니다.' : '비정상 GPS 값을 무시했습니다.';
          console.debug('[RunPage] Rejected point.', reason);
          setGpsMessage(message);
        },
        onError: (error) => {
          console.debug('[RunPage] Location error.', error);
          setGpsMessage(error?.message ?? 'GPS를 시작하지 못했습니다.');
        },
      });

      trackerRef.current = tracker;
      await tracker.start();
      setStatus('running');
      setCoachMessage(START_COACH_TEXT);
      await playCoachCue('start', START_COACH_TEXT);
    } catch (error) {
      console.debug('[RunPage] Failed to start run.', error);
      setGpsMessage(error?.message ?? '러닝을 시작하지 못했습니다.');
      setStatus('error');
    } finally {
      setSaving(false);
      setPermissionModalOpen(false);
    }
  }

  async function finishRun() {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSaving(true);
    setStatus('finished');
    if (usingNativeRunRef.current) {
      await RunningPlugin.stopRun();
      nativeListenerCleanupRef.current.forEach((cleanup) => cleanup?.());
      nativeListenerCleanupRef.current = [];
      await syncNativeCheckpoints();
    } else {
      await trackerRef.current?.stop?.();
    }

    if (!usingNativeRunRef.current && lastPointRef.current) {
      await saveCheckpointAndCoach(lastPointRef.current, true);
    }

    const endedAt = new Date();
    const totalElapsedSeconds = Math.max(1, elapsedRef.current);
    const totalDistanceMeters = Math.max(0, distanceRef.current);
    const { data: completedRun, error } = await completeRunRecord({
      runId: runRef.current?.id,
      userId: user.id,
      startedAt: startedAtRef.current,
      endedAt,
      totalDistanceMeters,
      totalElapsedSeconds,
      targetDistanceKm: normalizedTargetDistanceKm,
    });

    setSaving(false);
    onComplete({
      run: completedRun ?? {
        id: runRef.current?.id,
        user_id: user.id,
        started_at: startedAtRef.current.toISOString(),
        ended_at: endedAt.toISOString(),
        total_distance_meters: totalDistanceMeters,
        total_elapsed_seconds: totalElapsedSeconds,
        avg_pace_seconds_per_km: averagePace,
        status: 'completed',
      },
      splits: [],
      saveError: error?.message,
    });
  }

  function togglePause() {
    if (usingNativeRunRef.current) {
      if (status === 'running') RunningPlugin.pauseRun();
      if (status === 'paused') RunningPlugin.resumeRun();
    }
    setStatus((current) => (current === 'running' ? 'paused' : 'running'));
  }

  function startFinishHold(event) {
    if (saving || locked || sessionEndedRef.current || status === 'preparing') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressTriggeredRef.current = false;
    longPressStartedAtRef.current = performance.now();
    setHoldProgress(0);

    function updateProgress() {
      const elapsedMs = performance.now() - longPressStartedAtRef.current;
      setHoldProgress(Math.min(1, elapsedMs / FINISH_HOLD_MS));
      if (elapsedMs < FINISH_HOLD_MS && !longPressTriggeredRef.current) {
        longPressFrameRef.current = window.requestAnimationFrame(updateProgress);
      }
    }

    longPressFrameRef.current = window.requestAnimationFrame(updateProgress);
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setHoldProgress(1);
      finishRun();
    }, FINISH_HOLD_MS);
  }

  function endFinishHold() {
    const triggered = longPressTriggeredRef.current;
    cancelFinishHold();
    if (!triggered && !saving && !locked && status !== 'preparing') {
      togglePause();
    }
  }

  function cancelFinishHold(resetProgress = true) {
    if (longPressTimeoutRef.current) window.clearTimeout(longPressTimeoutRef.current);
    if (longPressFrameRef.current) window.cancelAnimationFrame(longPressFrameRef.current);
    longPressTimeoutRef.current = null;
    longPressFrameRef.current = null;
    if (resetProgress) setHoldProgress(0);
  }

  return (
    <main className="run-screen running-hud" style={{ '--running-bg': `url(${runningHudBg})` }}>
      <header className="run-hud-top">
        <span className="hud-top-spacer" aria-hidden="true" />
        <strong className="run-hud-logo">끝까지 <span>버텨라</span></strong>
        <div className="hud-settings">
          <button
            className="hud-icon-button"
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-label="설정"
          >
            <Settings size={24} />
          </button>
          {settingsOpen && (
            <div className="hud-settings-menu">
              <div className="hud-settings-section" role="group" aria-label="음성 가이드">
                <span>음성 가이드</span>
                <div className="hud-settings-choice">
                  {COACH_VOICE_TYPES.map((voiceType) => (
                    <button
                      key={voiceType}
                      type="button"
                      className={coachVoiceType === voiceType ? 'active' : ''}
                      onClick={() => selectCoachVoiceType(voiceType)}
                      aria-pressed={coachVoiceType === voiceType}
                    >
                      {voiceType}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hud-settings-section" role="group" aria-label="목표 거리">
                <span>목표 거리</span>
                <div className="hud-target-control">
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={targetDistanceInput}
                    onChange={(event) => setTargetDistanceInput(event.target.value)}
                    onBlur={applyTargetDistance}
                    aria-label="목표 거리 km"
                  />
                  <button type="button" onClick={applyTargetDistance}>km 적용</button>
                </div>
              </div>
              <button type="button" onClick={openBatteryOptimizationSettings}>
                <span>배터리 최적화</span>
                <strong>설정</strong>
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="ghost-race-card" aria-label="러닝 코치">
        <h1>어제의 나를 추월하자</h1>
        <div className="ghost-pace-row">
          <div>
            <span>현재 페이스</span>
            <strong className="green">{formatHudPace(averagePace)}</strong>
          </div>
          <b>VS</b>
          <div>
            <span>최근 기록</span>
            <strong className="blue">{recentRuns.length}개</strong>
          </div>
        </div>
        <p className="green">{coachMessage}</p>
        {queuedCount > 0 && <small>오프라인 체크포인트 {queuedCount}개 동기화 대기 중</small>}
      </section>

      <section className={`route-card ${routeFocused ? 'focused' : ''}`} aria-label="경로 미니맵">
        <MiniMap points={routePoints} distanceKm={distanceKm} />
        <div className="gps-status-stack">
          <span className="gps-pill">{gpsMessage}</span>
          <small>{speedKmh.toFixed(1)} km/h</small>
        </div>
      </section>

      <section className="hud-stats-card">
        <HudStat label="거리" value={distanceKm.toFixed(2)} unit="km" highlight />
        <HudStat label="시간" value={formatHudClock(elapsedSeconds)} />
        <HudStat label="평균 페이스" value={formatHudPace(averagePace)} accent="green" />
      </section>

      <section className="next-goal-card">
        <div>
          <span>목표 거리</span>
          <strong>{normalizedTargetDistanceKm.toFixed(1)} km 완주</strong>
        </div>
        <div className="goal-progress-row">
          <div className="goal-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <b>
            {distanceKm.toFixed(2)} <span>/ {normalizedTargetDistanceKm.toFixed(2)} km</span>
          </b>
        </div>
      </section>

      {status === 'paused' && (
        <div className="paused-session-card">
          <strong>일시정지</strong>
          <span>다시 누르면 기록을 이어갑니다.</span>
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
        <button
          className={`hud-pause-button ${holdProgress > 0 ? 'holding' : ''}`}
          type="button"
          onPointerDown={startFinishHold}
          onPointerUp={endFinishHold}
          onPointerLeave={cancelFinishHold}
          onPointerCancel={cancelFinishHold}
          disabled={saving || locked}
          aria-label="짧게 누르면 일시정지, 3초간 길게 누르면 러닝 종료"
        >
          <svg className="hold-progress-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" style={{ strokeDashoffset: HOLD_RING_CIRCUMFERENCE * (1 - holdProgress) }} />
          </svg>
          {status === 'running' ? <Pause size={34} /> : <Play size={34} />}
          <span>{status === 'preparing' ? '대기' : holdProgress > 0 ? '길게 종료' : status === 'running' ? '일시정지' : '재개'}</span>
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

      {permissionModalOpen && (
        <div className="run-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="location-permission-title">
          <div className="run-modal">
            <h2 id="location-permission-title">백그라운드 위치 안내</h2>
            <p>
              화면이 꺼져도 러닝 기록을 유지하기 위해 위치 권한과 백그라운드 위치 권한을 사용합니다. Android에서는 지속 알림이 표시됩니다.
            </p>
            <div className="action-row">
              <button className="danger-button" type="button" onClick={onCancel}>
                취소
              </button>
              <button className="primary-button" type="button" onClick={startRun} disabled={saving}>
                {saving ? '시작 중...' : '동의하고 시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      {batteryGuideOpen && (
        <div className="run-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="battery-guide-title">
          <div className="run-modal">
            <h2 id="battery-guide-title">배터리 최적화 제외 안내</h2>
            <p>
              Android 설정에서 이 앱을 배터리 최적화 제외 대상으로 설정하면 화면 꺼짐 상태의 GPS 추적 안정성이 좋아집니다.
            </p>
            <button className="secondary-button" type="button" onClick={() => setBatteryGuideOpen(false)}>
              확인
            </button>
          </div>
        </div>
      )}
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
