import { useEffect, useState } from 'react';
import { Medal, Home, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatDuration, formatPace, formatSignedSeconds } from '../lib/pace';
import { readLocalRuns } from '../lib/localRuns';
import { isTestUserId } from '../lib/testAuth';

export default function ResultPage({ user, result, onHome, onRanking }) {
  const [isPersonalBest, setIsPersonalBest] = useState(false);

  useEffect(() => {
    async function checkBest() {
      if (!result?.run) return;

      if (isTestUserId(user.id)) {
        const bestRun = readLocalRuns(user.id)
          .filter((run) => Number(run.target_distance_km) === Number(result.run.target_distance_km))
          .sort((a, b) => a.duration_seconds - b.duration_seconds)[0];
        setIsPersonalBest(bestRun?.id === result.run.id);
        return;
      }

      const { data } = await supabase
        .from('runs')
        .select('duration_seconds')
        .eq('user_id', user.id)
        .eq('target_distance_km', result.run.target_distance_km)
        .order('duration_seconds', { ascending: true })
        .limit(1);

      setIsPersonalBest(data?.[0]?.duration_seconds === result.run.duration_seconds);
    }

    checkBest();
  }, [result, user.id]);

  if (!result?.run) {
    return (
      <main className="screen center">
        <p>결과가 없습니다.</p>
        <button className="primary-button" type="button" onClick={onHome}>
          홈으로
        </button>
      </main>
    );
  }

  const run = result.run;
  const summary = buildResultSummary(run, result);
  const saveStatus = result.saveError ? '서버 저장 대기 중' : '서버 저장 완료';

  return (
    <main className="screen result-screen">
      <section className="victory">
        <Medal size={48} />
        <p className="eyebrow">끝까지 버텼다</p>
        <h1>{isPersonalBest ? '개인 최고 기록 갱신' : '기록 저장 완료'}</h1>
        <p className={`message ${result.saveError ? 'error' : 'success'}`}>{saveStatus}</p>
        {result.saveError && <p className="message error">{result.saveError}</p>}
      </section>

      <section className="panel result-grid">
        <div>
          <span>총 거리</span>
          <strong>{summary.distanceKm}</strong>
        </div>
        <div>
          <span>총 시간</span>
          <strong>{summary.duration}</strong>
        </div>
        <div>
          <span>평균 페이스</span>
          <strong>{summary.pace}</strong>
        </div>
        <div>
          <span>어제 기록 대비</span>
          <strong>{summary.ghostDiff}</strong>
        </div>
        <div>
          <span>목표 거리</span>
          <strong>{summary.targetDistanceKm}</strong>
        </div>
        <div>
          <span>운동 시간대</span>
          <strong>{summary.period}</strong>
        </div>
      </section>

      <div className="action-row">
        <button className="secondary-button xl" type="button" onClick={onHome}>
          <Home size={22} />
          홈으로
        </button>
        <button className="primary-button xl" type="button" onClick={onRanking}>
          <BarChart3 size={22} />
          랭킹 보기
        </button>
      </div>
    </main>
  );
}

function buildResultSummary(run, result) {
  const distanceKm = getRunDistanceKm(run);
  const durationSeconds = getRunDurationSeconds(run);

  return {
    distanceKm: `${distanceKm.toFixed(2)} km`,
    duration: formatDuration(durationSeconds),
    pace: formatPace(run.avg_pace_seconds_per_km),
    ghostDiff: formatSignedSeconds(result.ghostDiffSeconds),
    targetDistanceKm: `${Number(run.target_distance_km ?? distanceKm).toFixed(1)} km`,
    period: formatRunPeriod(run.started_at, run.ended_at),
  };
}

function getRunDistanceKm(run) {
  const actualDistanceKm = Number(run.actual_distance_km);
  if (Number.isFinite(actualDistanceKm) && actualDistanceKm > 0) return actualDistanceKm;

  const totalDistanceMeters = Number(run.total_distance_meters);
  if (Number.isFinite(totalDistanceMeters) && totalDistanceMeters > 0) return totalDistanceMeters / 1000;

  return 0;
}

function getRunDurationSeconds(run) {
  const durationSeconds = Number(run.duration_seconds);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) return durationSeconds;

  const totalElapsedSeconds = Number(run.total_elapsed_seconds);
  if (Number.isFinite(totalElapsedSeconds) && totalElapsedSeconds > 0) return totalElapsedSeconds;

  return 0;
}

function formatRunPeriod(startedAt, endedAt) {
  const startLabel = formatTime(startedAt);
  const endLabel = formatTime(endedAt);

  if (!startLabel && !endLabel) return '-';
  if (!endLabel) return `${startLabel} 시작`;
  if (!startLabel) return `${endLabel} 종료`;
  return `${startLabel} - ${endLabel}`;
}

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
