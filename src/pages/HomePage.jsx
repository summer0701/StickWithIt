import { useEffect, useMemo, useState } from 'react';
import { Trophy, Play, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatDuration, formatPace } from '../lib/pace';

const quickTargets = [1, 3, 5, 10];

export default function HomePage({ user, targetDistanceKm, onTargetChange, onStart, onRanking }) {
  const [runs, setRuns] = useState([]);
  const [customTarget, setCustomTarget] = useState('');

  useEffect(() => {
    supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRuns(data ?? []));
  }, [user.id]);

  const yesterdayAvailable = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().slice(0, 10);
    return runs.some((run) => (run.started_at ?? run.created_at ?? '').slice(0, 10) === key);
  }, [runs]);

  function applyCustomTarget(value) {
    setCustomTarget(value);
    const parsed = Number(value);
    if (parsed > 0) onTargetChange(parsed);
  }

  return (
    <main className="screen home-screen">
      <section className="hero-band">
        <p className="eyebrow">오늘의 러닝</p>
        <h1>끝까지 버텨라</h1>
        <p>{yesterdayAvailable ? '어제의 나와 경쟁 가능' : '첫 기록을 남기면 다음 러닝부터 Ghost Run이 시작됩니다.'}</p>
      </section>

      <section className="panel">
        <h2>목표 거리 선택</h2>
        <div className="target-grid">
          {quickTargets.map((target) => (
            <button
              key={target}
              className={targetDistanceKm === target ? 'selected' : ''}
              type="button"
              onClick={() => onTargetChange(target)}
            >
              {target}km
            </button>
          ))}
        </div>
        <label className="custom-target">
          직접 입력
          <input
            inputMode="decimal"
            min="0.1"
            step="0.1"
            type="number"
            value={customTarget}
            placeholder="예: 2.5"
            onChange={(event) => applyCustomTarget(event.target.value)}
          />
        </label>
      </section>

      <div className="action-row">
        <button className="primary-button xl" type="button" onClick={onStart}>
          <Play size={24} />
          오늘 달리기 시작
        </button>
        <button className="secondary-button icon-button" type="button" onClick={onRanking} aria-label="랭킹 보기">
          <BarChart3 size={24} />
        </button>
      </div>

      <section className="panel">
        <h2>최근 기록 요약</h2>
        {runs.length === 0 ? (
          <p className="muted">아직 저장된 러닝 기록이 없습니다.</p>
        ) : (
          <ul className="run-list">
            {runs.map((run) => (
              <li key={run.id}>
                <Trophy size={18} />
                <span>{Number(run.actual_distance_km).toFixed(2)} km</span>
                <span>{formatDuration(run.duration_seconds)}</span>
                <span>{formatPace(run.avg_pace_seconds_per_km)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
