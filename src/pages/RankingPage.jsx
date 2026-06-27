import { useEffect, useMemo, useState } from 'react';
import RankingTabs from '../components/RankingTabs';
import { supabase } from '../lib/supabaseClient';
import { formatDuration, formatPace } from '../lib/pace';

export default function RankingPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('distance');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const viewName =
      activeTab === 'distance'
        ? 'daily_distance_rankings_view'
        : activeTab === 'pace'
          ? 'daily_pace_rankings_view'
          : 'daily_growth_rankings_view';

    supabase
      .from(viewName)
      .select('*')
      .limit(50)
      .then(({ data }) => setRows(data ?? []));
  }, [activeTab]);

  const title = useMemo(() => {
    if (activeTab === 'distance') return '절대 거리 랭킹';
    if (activeTab === 'pace') return '절대 시간/페이스 랭킹';
    return '성장 랭킹';
  }, [activeTab]);

  return (
    <main className="screen ranking-screen">
      <section className="panel">
        <div className="section-header">
          <h1>{title}</h1>
          <button className="ghost-button" type="button" onClick={onBack}>
            닫기
          </button>
        </div>
        <RankingTabs activeTab={activeTab} onChange={setActiveTab} />
        <ol className="ranking-list">
          {rows.length === 0 && <li className="muted">랭킹 데이터가 아직 없습니다.</li>}
          {rows.map((row, index) => (
            <li key={`${activeTab}-${index}`}>
              <strong>{index + 1}</strong>
              <span>{row.nickname ?? '러너'}</span>
              <RankingValue tab={activeTab} row={row} />
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function RankingValue({ tab, row }) {
  if (tab === 'distance') {
    return <span>{Number(row.total_distance_km ?? 0).toFixed(2)} km</span>;
  }

  if (tab === 'pace') {
    return (
      <span>
        {Number(row.target_distance_km).toFixed(1)}km · {formatDuration(row.best_time_seconds)} ·{' '}
        {formatPace(row.best_pace_seconds_per_km)}
      </span>
    );
  }

  return (
    <span>
      시간 {Math.max(0, row.yesterday_improvement_seconds ?? 0)}초 단축 · 거리{' '}
      {Number(row.distance_growth_km ?? 0).toFixed(2)} km 성장 · PB {row.personal_best_improvement_seconds ?? 0}초
    </span>
  );
}
