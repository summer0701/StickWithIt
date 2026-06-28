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

  return (
    <main className="screen result-screen">
      <section className="victory">
        <Medal size={48} />
        <p className="eyebrow">끝까지 버텼다</p>
        <h1>{isPersonalBest ? '개인 최고 기록 갱신' : '기록 저장 완료'}</h1>
        {result.saveError && <p className="message error">{result.saveError}</p>}
      </section>

      <section className="panel result-grid">
        <div>
          <span>총 거리</span>
          <strong>{Number(run.actual_distance_km).toFixed(2)} km</strong>
        </div>
        <div>
          <span>총 시간</span>
          <strong>{formatDuration(run.duration_seconds)}</strong>
        </div>
        <div>
          <span>평균 페이스</span>
          <strong>{formatPace(run.avg_pace_seconds_per_km)}</strong>
        </div>
        <div>
          <span>어제 기록 대비</span>
          <strong>{formatSignedSeconds(result.ghostDiffSeconds)}</strong>
        </div>
      </section>

      <div className="action-row">
        <button className="secondary-button xl" type="button" onClick={onHome}>
          <Home size={22} />
          홈
        </button>
        <button className="primary-button xl" type="button" onClick={onRanking}>
          <BarChart3 size={22} />
          랭킹
        </button>
      </div>
    </main>
  );
}
