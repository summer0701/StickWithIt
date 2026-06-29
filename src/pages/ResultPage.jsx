import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Flag,
  MapPin,
  Share2,
  Timer,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatDuration, formatSignedSeconds } from '../lib/pace';
import { readLocalRuns } from '../lib/localRuns';
import { isTestUserId } from '../lib/testAuth';
import personalBestMedal from '../assets/personal-best-medal.webp';

export default function ResultPage({ user, result, onHome, onRanking }) {
  const [isPersonalBest, setIsPersonalBest] = useState(false);

  useEffect(() => {
    async function checkBest() {
      if (!result?.run) return;

      if (isTestUserId(user.id)) {
        const bestRun = readLocalRuns(user.id)
          .filter((run) => isSameTargetRun(run, result.run) && reachedTargetDistance(run))
          .sort((a, b) => getRunDurationSeconds(a) - getRunDurationSeconds(b))[0];
        setIsPersonalBest(bestRun?.id === result.run.id);
        return;
      }

      const { data } = await supabase
        .from('runs')
        .select('id,duration_seconds,total_elapsed_seconds,actual_distance_km,total_distance_meters,target_distance_km')
        .eq('user_id', user.id)
        .eq('target_distance_km', result.run.target_distance_km)
        .eq('status', 'completed')
        .order('duration_seconds', { ascending: true })
        .limit(20);

      const bestRun = (data ?? [])
        .filter((run) => reachedTargetDistance(run))
        .sort((a, b) => getRunDurationSeconds(a) - getRunDurationSeconds(b))[0];
      setIsPersonalBest(bestRun?.id === result.run.id);
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
  const achievementTitle = isPersonalBest ? '개인 최고 기록 갱신!' : '러닝 기록 저장!';

  return (
    <main className="screen result-screen">
      <section className="personal-best-hero" aria-label="러닝 결과 요약">
        <div className="result-medal-wrap">
          <img className="result-medal-art" src={personalBestMedal} alt="" />
        </div>
        <div className="result-hero-copy">
          <p className="eyebrow">끝까지 버텼다</p>
          <h1>{achievementTitle}</h1>
          <p className={`save-status ${result.saveError ? 'error' : 'success'}`}>
            {saveStatus}
            {!result.saveError && <CheckCircle2 size={20} aria-hidden="true" />}
          </p>
        </div>
        {result.saveError && <p className="message error">{result.saveError}</p>}
      </section>

      <section className="result-summary-panel">
        <ResultMetricCard
          accent="orange"
          icon={MapPin}
          label="총 거리"
          value={summary.distanceValue}
          unit="km"
          sparkline="distance"
        />
        <ResultMetricCard accent="green" icon={Clock3} label="총 시간" value={summary.duration} />
        <ResultMetricCard
          accent="blue"
          icon={Timer}
          label="평균 페이스"
          value={summary.paceValue}
          unit="/km"
          sparkline="pace"
        />
        <ResultMetricCard
          accent="purple"
          icon={BarChart3}
          label="어제 기록 대비"
          value={summary.ghostDiff}
          description={summary.ghostDiffDescription}
        />
        <ResultMetricCard
          accent="yellow"
          icon={Flag}
          label="목표 거리"
          value={summary.targetDistanceValue}
          unit="km"
          progress={summary.targetProgressPercent}
          description={summary.targetProgressLabel}
        />
        <ResultMetricCard
          accent="pink"
          icon={Flame}
          label="운동 시간대"
          value={summary.periodLabel}
          description={summary.periodRange}
        />

        <button className="result-share-button" type="button" onClick={() => shareResult(summary, achievementTitle)}>
          <Share2 size={24} />
          <span>결과 공유하기</span>
          <ChevronRight size={24} />
        </button>
      </section>
    </main>
  );
}

function ResultMetricCard({ accent, icon: Icon, label, value, unit, description, sparkline, progress }) {
  return (
    <article className={`result-metric-card ${accent}`}>
      <div className="result-metric-head">
        <Icon size={30} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="result-metric-value">
        <strong>{value}</strong>
        {unit && <em>{unit}</em>}
      </p>
      {sparkline && <MiniSparkline type={sparkline} />}
      {typeof progress === 'number' && (
        <div className="result-progress" aria-label={`${Math.round(progress)}% 달성`}>
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {description && <p className="result-metric-description">{description}</p>}
    </article>
  );
}

function MiniSparkline({ type }) {
  const line =
    type === 'pace'
      ? 'M3 36 C12 28 20 34 27 27 S44 26 52 34 S68 42 76 27 S94 15 104 23 S121 44 135 30 S153 22 166 26'
      : 'M3 37 C22 42 38 42 53 34 S89 36 105 35 S136 46 154 31 S161 18 166 20';

  return (
    <svg className={`result-sparkline ${type}`} viewBox="0 0 170 48" role="img" aria-label="기록 그래프">
      <path d={line} />
      {type === 'distance' && <circle cx="166" cy="20" r="4" />}
    </svg>
  );
}

function buildResultSummary(run, result) {
  const distanceKm = getRunDistanceKm(run);
  const durationSeconds = getRunDurationSeconds(run);
  const targetDistanceKm = getTargetDistanceKm(run, distanceKm);
  const targetProgressPercent = targetDistanceKm > 0 ? Math.round((distanceKm / targetDistanceKm) * 100) : 0;
  const paceLabel = formatCompactPace(run.avg_pace_seconds_per_km);
  const ghostDiffSeconds = Number(result.ghostDiffSeconds);
  const hasGhostDiff = Number.isFinite(ghostDiffSeconds);

  return {
    distanceValue: distanceKm.toFixed(2),
    duration: formatDuration(durationSeconds),
    paceValue: paceLabel.replace('/km', ''),
    ghostDiff: hasGhostDiff ? formatKoreanSignedMinutes(ghostDiffSeconds) : formatSignedSeconds(result.ghostDiffSeconds),
    ghostDiffDescription: getGhostDiffDescription(ghostDiffSeconds),
    targetDistanceValue: targetDistanceKm.toFixed(2),
    targetProgressPercent,
    targetProgressLabel: `${targetProgressPercent}% 달성!`,
    periodLabel: formatRunPeriodLabel(run.started_at),
    periodRange: formatRunPeriod(run.started_at, run.ended_at),
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

function getTargetDistanceKm(run, fallbackDistanceKm) {
  const targetDistanceKm = Number(run.target_distance_km);
  if (Number.isFinite(targetDistanceKm) && targetDistanceKm > 0) return targetDistanceKm;
  return fallbackDistanceKm;
}

function isSameTargetRun(run, currentRun) {
  return Number(run.target_distance_km) === Number(currentRun.target_distance_km);
}

function reachedTargetDistance(run) {
  const targetDistanceKm = Number(run.target_distance_km);
  if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0) return false;
  return getRunDistanceKm(run) >= targetDistanceKm * 0.99;
}

function formatKoreanSignedMinutes(diffSeconds) {
  const roundedSeconds = Math.round(Math.abs(diffSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  const sign = diffSeconds < 0 ? '+' : '-';

  if (minutes <= 0) return `${sign}${seconds}초`;
  return `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCompactPace(paceSeconds) {
  const safeSeconds = Number(paceSeconds);
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) return '--';

  const rounded = Math.round(safeSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

function getGhostDiffDescription(diffSeconds) {
  if (!Number.isFinite(diffSeconds)) return '비교 기록 없음';
  if (diffSeconds < 0) return '더 빨라졌어요!';
  if (diffSeconds > 0) return '다시 도전해요!';
  return '어제와 같아요!';
}

function formatRunPeriodLabel(startedAt) {
  if (!startedAt) return '-';

  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return '-';

  const hour = date.getHours();
  if (hour < 12) return '오전';
  if (hour < 18) return '오후';
  return '저녁';
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

async function shareResult(summary, title) {
  const text = `${title} 총 거리 ${summary.distanceValue}km, 총 시간 ${summary.duration}, 평균 페이스 ${summary.paceValue}/km`;

  if (navigator.share) {
    try {
      await navigator.share({ title: '러닝 결과', text });
      return;
    } catch {
      // 공유를 취소한 경우에는 클립보드 복사를 시도합니다.
    }
  }

  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}
