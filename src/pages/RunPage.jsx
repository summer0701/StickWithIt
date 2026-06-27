import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Square, X } from 'lucide-react';
import RunStats from '../components/RunStats';
import GhostStatus from '../components/GhostStatus';
import { calculateNextDistance, normalizePosition } from '../lib/distance';
import { compareWithGhost, pickGhostRun } from '../lib/ghostRun';
import { secondsPerKm } from '../lib/pace';
import { getVoiceCue, speak } from '../lib/voiceCoach';
import { watchRunPosition } from '../lib/geolocation';
import { supabase } from '../lib/supabaseClient';

export default function RunPage({ user, targetDistanceKm, onCancel, onComplete }) {
  const [status, setStatus] = useState('idle');
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [splits, setSplits] = useState([]);
  const [ghostRun, setGhostRun] = useState(null);
  const [ghostSplits, setGhostSplits] = useState([]);
  const [gpsMessage, setGpsMessage] = useState('GPS 대기 중');
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(null);
  const previousPointRef = useRef(null);
  const cleanupWatchRef = useRef(null);
  const statusRef = useRef(status);
  const distanceRef = useRef(distanceKm);
  const elapsedRef = useRef(elapsedSeconds);
  const ghostDiffRef = useRef(ghostDiffSeconds);
  const lastSplitDistanceRef = useRef(0);
  const lastCueDistanceRef = useRef(0);

  const ghostDiffSeconds = useMemo(
    () => compareWithGhost({ currentDistanceKm: distanceKm, elapsedSeconds, ghostSplits }),
    [distanceKm, elapsedSeconds, ghostSplits],
  );

  useEffect(() => {
    async function loadGhost() {
      const { data: runs } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50);

      const selected = pickGhostRun(runs ?? [], targetDistanceKm);
      setGhostRun(selected);

      if (selected) {
        const { data } = await supabase
          .from('run_splits')
          .select('*')
          .eq('run_id', selected.id)
          .order('distance_km', { ascending: true });
        setGhostSplits(data ?? []);
      }
    }

    loadGhost();
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
    ghostDiffRef.current = ghostDiffSeconds;
  }, [ghostDiffSeconds]);

  useEffect(() => {
    if (status !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      cleanupWatchRef.current?.();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  async function startRun() {
    startedAtRef.current = startedAtRef.current ?? new Date();
    setStatus('running');
    setGpsMessage('GPS 추적 중');

    if (!cleanupWatchRef.current) {
      cleanupWatchRef.current = await watchRunPosition(handlePosition, (error) => {
        setGpsMessage(error.message ?? 'GPS 신호를 확인해 주세요.');
      });
    }
  }

  function handlePosition(position) {
    if (statusRef.current !== 'running') return;

    const nextPoint = normalizePosition(position);
    const previousPoint = previousPointRef.current;
    const nextDistance = calculateNextDistance(previousPoint, nextPoint, distanceRef.current);

    if (!nextDistance.accepted && nextDistance.reason === 'low_accuracy') {
      setGpsMessage('GPS 정확도가 낮아 잠시 무시했습니다.');
      return;
    }

    if (nextDistance.accepted) {
      previousPointRef.current = nextPoint;
      setDistanceKm(nextDistance.totalDistanceKm);
      setGpsMessage('GPS 추적 중');
      maybeAddSplit(nextDistance.totalDistanceKm);
      maybeSpeak(nextDistance.totalDistanceKm);
    }
  }

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

  function maybeSpeak(nextDistanceKm) {
    const cue = getVoiceCue({
      distanceKm: nextDistanceKm,
      targetDistanceKm,
      ghostDiffSeconds: ghostDiffRef.current,
      lastCueDistanceKm: lastCueDistanceRef.current,
    });

    if (cue) {
      lastCueDistanceRef.current = nextDistanceKm;
      speak(cue);
    }
  }

  async function finishRun() {
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

    setSaving(false);
    onComplete({
      run: savedRun ?? runPayload,
      splits: finalSplits,
      ghostRun,
      ghostDiffSeconds,
      saveError: error?.message,
    });
  }

  return (
    <main className="run-screen">
      <header className="run-header">
        <button className="round-button" type="button" onClick={onCancel} aria-label="나가기">
          <X size={22} />
        </button>
        <span>{targetDistanceKm}km 도전</span>
        <span className="gps-pill">{gpsMessage}</span>
      </header>

      <RunStats distanceKm={distanceKm} elapsedSeconds={elapsedSeconds} targetDistanceKm={targetDistanceKm} />
      <GhostStatus ghostRun={ghostRun} diffSeconds={ghostDiffSeconds} />

      <div className="run-controls">
        {status !== 'running' ? (
          <button className="primary-button xl" type="button" onClick={startRun} disabled={saving}>
            <Play size={24} />
            시작
          </button>
        ) : (
          <button className="secondary-button xl" type="button" onClick={() => setStatus('paused')}>
            <Pause size={24} />
            일시정지
          </button>
        )}
        <button className="danger-button xl" type="button" onClick={finishRun} disabled={saving || elapsedSeconds === 0}>
          <Square size={22} />
          {saving ? '저장 중...' : '종료'}
        </button>
      </div>
    </main>
  );
}
