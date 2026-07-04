import { memo, useEffect, useMemo, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  RiArrowRightSLine,
  RiBarChartGroupedLine,
  RiFireFill,
  RiHome5Fill,
  RiMapPin2Fill,
  RiPulseLine,
  RiRunFill,
  RiStarFill,
  RiTimerFlashFill,
} from 'react-icons/ri';
import { FaDumbbell } from 'react-icons/fa6';
import { GiJumpAcross, GiLeg, GiMuscleUp, GiWeightLiftingUp } from 'react-icons/gi';
import { supabase } from '../lib/supabaseClient';
import { readLocalRuns } from '../lib/localRuns';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { buildDailyExerciseProgress, formatExerciseValue, type ExerciseProgressValues } from '../lib/homeExerciseProgress';
import { getHomeWorkoutSummary, type HomeWorkoutSummary } from '../lib/homeWorkoutSummary';
import { isTestUserId } from '../lib/testAuth';
import { achievementRate } from '../lib/runningProgress';
import {
  buildHomeRankingSummary,
  neighborhoodProfileFromRow,
  neighborhoodProfileToRow,
  readLastNeighborhoodContribution,
  readNeighborhoodProfile,
  resolveNeighborhoodFromGps,
  saveNeighborhoodProfile,
  type NeighborhoodProfile,
  type LastNeighborhoodContribution,
} from '../lib/neighborhoodRanking';
import dashboardBg from '../assets/home-dashboard-bg.webp';
import heroImage from '../assets/iron-five-hero.webp';

type HomePageProps = {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
  targetDistanceKm: number;
  onTargetChange: (value: number) => void;
  onStart: () => void;
  onSquatStart: () => void;
  onJumpingJackStart: () => void;
  onPushupStart: () => void;
  onLungeStart: () => void;
  onRanking: () => void;
  onNavigate: (page: string) => void;
};

type Exercise = {
  id: string;
  name: string;
  english: string;
  color: string;
  goalLabel: string;
  goalTitle?: string;
  recordLabel: string;
  targetValue: number;
  currentValue: number;
  achievementLabel?: string;
  unit: string;
  buttonLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const exercises: Exercise[] = [
  {
    id: 'running',
    name: '러닝',
    english: 'Running',
    color: '#2F80FF',
    goalLabel: '10km',
    recordLabel: '5.23km',
    targetValue: 10,
    currentValue: 5.23,
    unit: 'km',
    buttonLabel: '러닝 시작',
    icon: RiRunFill,
  },
  {
    id: 'squat',
    name: '스쿼트',
    english: 'Squat',
    color: '#A855F7',
    goalLabel: '200회',
    recordLabel: '126회',
    targetValue: 200,
    currentValue: 126,
    unit: '회',
    buttonLabel: '스쿼트 시작',
    icon: GiWeightLiftingUp,
  },
  {
    id: 'jumping-jack',
    name: '점핑잭',
    english: 'Jumping Jack',
    color: '#F5B400',
    goalLabel: '300회',
    recordLabel: '198회',
    targetValue: 300,
    currentValue: 198,
    unit: '회',
    buttonLabel: '점핑잭 시작',
    icon: GiJumpAcross,
  },
  {
    id: 'push-up',
    name: '푸쉬업',
    english: 'Push-up',
    color: '#28D99A',
    goalLabel: '100회',
    recordLabel: '54회',
    targetValue: 100,
    currentValue: 54,
    unit: '회',
    buttonLabel: '푸쉬업 시작',
    icon: GiMuscleUp,
  },
  {
    id: 'lunge',
    name: '런지',
    english: 'Lunge',
    color: '#FF4D4F',
    goalLabel: '20회',
    recordLabel: '0회',
    targetValue: 20,
    currentValue: 0,
    unit: '회',
    buttonLabel: '런지 시작',

    icon: GiLeg,
  },
];

const chartPoints = [34, 36, 52, 46, 28, 55, 72];

export default function HomePage({
  user,
  targetDistanceKm,
  onTargetChange,
  onStart,
  onSquatStart,
  onJumpingJackStart,
  onPushupStart,
  onLungeStart,
  onRanking,
  onNavigate,
}: HomePageProps) {
  const [toast, setToast] = useState('');
  const [recentRunsCount, setRecentRunsCount] = useState(0);
  const [yesterdayBestRunningKm, setYesterdayBestRunningKm] = useState(0);
  const [neighborhoodProfile, setNeighborhoodProfile] = useState<NeighborhoodProfile | null>(() => readNeighborhoodProfile(user.id));
  const [neighborhoodMessage, setNeighborhoodMessage] = useState('');
  const [lastContribution, setLastContribution] = useState<LastNeighborhoodContribution | null>(() => readLastNeighborhoodContribution(user.id));
  const [dailyProgress, setDailyProgress] = useState<ExerciseProgressValues>(() =>
    buildDailyExerciseProgress({ runs: [], exerciseRecords: readExerciseRecords(user.id) }),
  );
  const [workoutSummary, setWorkoutSummary] = useState<HomeWorkoutSummary>(() =>
    getHomeWorkoutSummary({ userId: user.id, runs: [], exerciseRecords: readExerciseRecords(user.id) }),
  );
  const exerciseItems = useMemo(
    () => exercises.map((exercise) => {
      if (exercise.id === 'running') {
        return {
          ...exercise,
          goalTitle: '어제 최고 기록',
          goalLabel: yesterdayBestRunningKm > 0 ? `${yesterdayBestRunningKm.toFixed(2)}km` : '기록 없음',
          recordLabel: `${dailyProgress.runningKm.toFixed(2)}km`,
          targetValue: yesterdayBestRunningKm,
          currentValue: dailyProgress.runningKm,
          achievementLabel: getRunningAchievementLabel(dailyProgress.runningKm, yesterdayBestRunningKm),
        };
      }

      const currentValue = currentExerciseValue(exercise.id, dailyProgress);
      return {
        ...exercise,
        recordLabel: formatExerciseValue(currentValue, exercise.unit as 'km' | '회' | '초'),
        currentValue,
        achievementLabel: `${getProgress({ ...exercise, currentValue })}%`,
      };
    }),
    [dailyProgress, yesterdayBestRunningKm],
  );
  const totalProgress = Math.round(
    exerciseItems.reduce((sum, exercise) => sum + getProgress(exercise), 0) / exerciseItems.length,
  );
  const rankingSummary = useMemo(
    () => buildHomeRankingSummary(neighborhoodProfile, readExerciseRecords(user.id)),
    [neighborhoodProfile, user.id],
  );

  useEffect(() => {
    const localRuns = readLocalRuns(user.id);
    const localExerciseRecords = readExerciseRecords(user.id);
    const localDailyProgress = buildDailyExerciseProgress({ runs: localRuns, exerciseRecords: localExerciseRecords });
    setDailyProgress(localDailyProgress);
    setWorkoutSummary(getHomeWorkoutSummary({ userId: user.id, runs: localRuns, exerciseRecords: localExerciseRecords }));
    setRecentRunsCount(localRuns.length);
    setYesterdayBestRunningKm(bestRunningKmOnDate(localRuns, yesterdayDateKey()));
    setNeighborhoodProfile(readNeighborhoodProfile(user.id));
    setLastContribution(readLastNeighborhoodContribution(user.id));
    if (isTestUserId(user.id)) return;

    async function loadNeighborhoodProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('neighborhood_name,neighborhood_code,district_name,district_code,region_name,region_code,neighborhood_lat,neighborhood_lng,neighborhood_verified_at')
        .eq('id', user.id)
        .maybeSingle();
      const remoteProfile = neighborhoodProfileFromRow(data);
      if (!remoteProfile) return;
      saveNeighborhoodProfile(user.id, remoteProfile);
      setNeighborhoodProfile(remoteProfile);
    }

    async function loadRunCount() {
      try {
        const [recentResult, todayResult, yesterdayResult] = await Promise.all([
          supabase
            .from('runs')
            .select('id,user_id,status,ended_at,started_at,created_at,actual_distance_km,total_distance_meters,total_elapsed_seconds,duration_seconds')
            .eq('user_id', user.id)
            .limit(30),
          supabase
            .from('runs')
            .select('id,status,ended_at,started_at,created_at,actual_distance_km,total_distance_meters')
            .eq('user_id', user.id)
            .gte('started_at', startOfTodayIso())
            .limit(100),
          supabase
            .from('runs')
            .select('id,status,ended_at,started_at,created_at,actual_distance_km,total_distance_meters')
            .eq('user_id', user.id)
            .gte('started_at', startOfYesterdayIso())
            .lt('started_at', startOfTodayIso())
            .limit(100),
        ]);
        const recentRuns = [...(recentResult.data ?? []), ...localRuns];
        const runningDailyProgress = buildDailyExerciseProgress({
          runs: [...(todayResult.data ?? []), ...localRuns],
          exerciseRecords: localExerciseRecords,
        });
        setDailyProgress(runningDailyProgress);
        setRecentRunsCount(Math.max(localRuns.length, recentResult.data?.length ?? 0));
        setWorkoutSummary(getHomeWorkoutSummary({ userId: user.id, runs: recentRuns, exerciseRecords: localExerciseRecords }));
        setYesterdayBestRunningKm(bestRunningKmOnDate([...(yesterdayResult.data ?? []), ...localRuns], yesterdayDateKey()));
      } catch {
        setRecentRunsCount(localRuns.length);
        setDailyProgress(localDailyProgress);
        setWorkoutSummary(getHomeWorkoutSummary({ userId: user.id, runs: localRuns, exerciseRecords: localExerciseRecords }));
        setYesterdayBestRunningKm(bestRunningKmOnDate(localRuns, yesterdayDateKey()));
      }
    }

    loadNeighborhoodProfile();
    loadRunCount();
  }, [user.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const displayName = useMemo(() => {
    const metaName = user.user_metadata?.name;
    if (typeof metaName === 'string' && metaName.trim()) return metaName;
    return user.email?.split('@')[0] ?? '챌린저';
  }, [user.email, user.user_metadata]);

  function handleExerciseStart(exercise: Exercise) {
    if (exercise.id === 'running') {
      onTargetChange(targetDistanceKm || 10);
      onStart();
      return;
    }
    if (exercise.id === 'squat') {
      onSquatStart();
      return;
    }
    if (exercise.id === 'jumping-jack') {
      onJumpingJackStart();
      return;
    }
    if (exercise.id === 'push-up') {
      onPushupStart();
      return;
    }
    if (exercise.id === 'lunge') {
      onLungeStart();
      return;
    }
    setToast(`${exercise.name} 운동 화면은 다음 단계에서 연결됩니다.`);
  }

  async function handleNeighborhoodCertification() {
    setNeighborhoodMessage('GPS 확인 중');
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        setNeighborhoodMessage('인증 필요');
        return;
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
      const profile = await resolveNeighborhoodFromGps(position.coords.latitude, position.coords.longitude);
      const saved = saveNeighborhoodProfile(user.id, profile);
      if (!isTestUserId(user.id)) {
        await supabase.from('profiles').upsert({
          id: user.id,
          nickname: user.email?.split('@')[0] ?? '러너',
          ...neighborhoodProfileToRow(saved),
        });
      }
      setNeighborhoodProfile(saved);
      setNeighborhoodMessage(`${saved.neighborhoodName} 인증 완료`);
    } catch {
      setNeighborhoodMessage('동네를 확인하지 못했어요. GPS 권한을 확인하거나 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <motion.main
      className="home-premium home-dashboard"
      style={{ '--home-dashboard-bg': `url(${dashboardBg})` } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <HeroSection displayName={displayName} exercises={exerciseItems} onExerciseStart={handleExerciseStart} />
      <DashboardHeader displayName={displayName} />

      <motion.section className="dashboard-progress-card glass-panel" variants={cardVariant} initial="hidden" animate="visible">
        <div className="dashboard-progress-main">
          <CircularProgress value={totalProgress} />
        </div>
        <div className="dashboard-progress-list">
          {exerciseItems.map((exercise) => (
            <ProgressRow
              key={exercise.id}
              label={exercise.english}
              value={getProgress(exercise)}
              color={exercise.color}
              icon={exercise.icon}
            />
          ))}
        </div>
      </motion.section>

      <HomeRankingCards
        summary={rankingSummary}
        profile={neighborhoodProfile}
        message={neighborhoodMessage}
        lastContribution={lastContribution}
        onVerify={handleNeighborhoodCertification}
        onRanking={onRanking}
      />

      <SummaryCard summary={workoutSummary} recentRunsCount={recentRunsCount} />

      {toast && <motion.div className="home-toast" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{toast}</motion.div>}
      <button className="floating-home-button" type="button" onClick={() => onNavigate('home')} aria-label="홈">
        <RiHome5Fill />
      </button>
    </motion.main>
  );
}

function HeroSection({
  displayName,
  exercises,
  onExerciseStart,
}: {
  displayName: string;
  exercises: Exercise[];
  onExerciseStart: (exercise: Exercise) => void;
}) {
  return (
    <section className="premium-hero dashboard-hero">
      <div className="hero-logo">
        <strong>끝까지 버텨라</strong>
        <span>철인 5종 챌린지</span>
      </div>
      <div className="hero-image-wrapper">
        <motion.img
          className="hero-image"
          src={heroImage}
          alt="러닝, 스쿼트, 점핑잭, 푸쉬업, 런지 선수"
          loading="eager"
          initial={{ scale: 1.02, opacity: 0 }}
          animate={{ scale: [1, 1.03, 1], opacity: 1 }}
          transition={{ scale: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.5 } }}
        />
        <HeroParticleOverlay />
      </div>
      <GhostChallengeButtons exercises={exercises} onExerciseStart={onExerciseStart} />
      <div className="hero-copy">
        <span>{displayName}님의 오늘 챌린지</span>
        <h1>과거의 나와 경쟁하라.</h1>
      </div>
    </section>
  );
}

function GhostChallengeButtons({
  exercises,
  onExerciseStart,
}: {
  exercises: Exercise[];
  onExerciseStart: (exercise: Exercise) => void;
}) {
  return (
    <div className="ghost-challenge-buttons" aria-label="챌린지 바로가기">
      {exercises.map((exercise) => (
        <button
          key={exercise.id}
          className="ghost-challenge-button"
          style={{ '--accent': exercise.color } as React.CSSProperties}
          type="button"
          onClick={() => onExerciseStart(exercise)}
        >
          <span>{exercise.name}</span>
          <RiArrowRightSLine />
        </button>
      ))}
    </div>
  );
}

function HeroParticleOverlay() {
  return (
    <div className="hero-particles" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, index) => (
        <i
          key={index}
          style={
            {
              '--particle-x': `${(index * 17 + 8) % 100}%`,
              '--particle-delay': `${index * -0.16}s`,
              '--particle-duration': `${2.4 + (index % 5) * 0.24}s`,
              '--particle-size': `${3 + (index % 4)}px`,
              '--particle-drift': `${(index % 2 === 0 ? 1 : -1) * (8 + (index % 5) * 3)}px`,
              '--particle-opacity': `${0.42 + (index % 3) * 0.16}`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function DashboardHeader({ displayName }: { displayName: string }) {
  return (
    <header className="dashboard-header">
      <div>
        <span>{displayName}님의 오늘</span>
        <h1>5종목 진행률</h1>
      </div>
      <button className="detail-pill" type="button">
        상세 보기
        <RiArrowRightSLine />
      </button>
    </header>
  );
}

const ExerciseCard = memo(function ExerciseCard({
  exercise,
  index,
  onStart,
}: {
  exercise: Exercise;
  index: number;
  onStart: (exercise: Exercise) => void;
}) {
  const Icon = exercise.icon;
  const progress = getProgress(exercise);

  return (
    <motion.article
      className="exercise-card"
      role="button"
      tabIndex={0}
      style={{ '--accent': exercise.color } as React.CSSProperties}
      onClick={() => onStart(exercise)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onStart(exercise);
        }
      }}
      initial={{ opacity: 0, x: 34 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ delay: index * 0.06, duration: 0.38 }}
    >
      <div className="exercise-glow" />
      <Icon size={44} className="exercise-icon" />
      <h3>{exercise.name}</h3>
      <div className="exercise-metrics">
        <span>{exercise.goalTitle ?? '목표'}</span>
        <strong>{exercise.goalLabel}</strong>
        <span>오늘 기록</span>
        <strong>{exercise.recordLabel}</strong>
      </div>
      <ProgressBar value={progress} color={exercise.color} />
      <div className="achievement">
        <span>달성률</span>
        <b>{exercise.achievementLabel ?? `${progress}%`}</b>
      </div>
      <button
        className="ripple-button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onStart(exercise);
        }}
      >
        {exercise.buttonLabel}
      </button>
    </motion.article>
  );
});

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="premium-progress">
      <motion.span initial={{ width: 0 }} whileInView={{ width: `${value}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} style={{ background: color }} />
    </div>
  );
}

function ProgressRow({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="progress-row" style={{ '--accent': color } as React.CSSProperties}>
      {Icon && <Icon className="progress-row-icon" />}
      <span>{label}</span>
      <ProgressBar value={value} color={color} />
      <b>{value}%</b>
    </div>
  );
}

function CircularProgress({ value }: { value: number }) {
  const progress = useMotionValue(0);
  const smooth = useSpring(progress, { stiffness: 80, damping: 18 });
  const rounded = useTransform(smooth, (latest) => Math.round(latest));

  useEffect(() => {
    progress.set(value);
  }, [progress, value]);

  return (
    <div className="circle-progress" style={{ '--value': value } as React.CSSProperties}>
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id="home-progress-gradient" x1="8" y1="88" x2="112" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f46ed9" />
            <stop offset="52%" stopColor="#8d6cff" />
            <stop offset="100%" stopColor="#35c6ff" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="48" />
        <motion.circle
          cx="60"
          cy="60"
          r="48"
          pathLength="100"
          strokeDasharray="100"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 100 - value }}
          transition={{ duration: 1 }}
        />
      </svg>
      <div>
        <span>오늘 진행률</span>
        <motion.strong>{rounded}</motion.strong>
        <b>%</b>
      </div>
    </div>
  );
}

function HomeRankingCards({
  summary,
  profile,
  message,
  lastContribution,
  onVerify,
  onRanking,
}: {
  summary: ReturnType<typeof buildHomeRankingSummary>;
  profile: NeighborhoodProfile | null;
  message: string;
  lastContribution: LastNeighborhoodContribution | null;
  onVerify: () => void;
  onRanking: () => void;
}) {
  return (
    <section className="ranking-card neighborhood-ranking-card glass-panel">
      <strong className="neighborhood-core-message">{summary.coreMessage}</strong>
      <div className="neighborhood-auth-row">
        <span>{profile ? `📍 ${profile.neighborhoodName} 인증됨` : '동네 인증하면 랭킹에 참여할 수 있어요'}</span>
        {!profile && (
          <button className="neighborhood-verify-button" type="button" onClick={onVerify}>
            GPS로 인증하기
          </button>
        )}
      </div>
      {message && <p className="neighborhood-auth-message">{message}</p>}
      {lastContribution && (
        <p className="neighborhood-contribution-message">
          내 운동으로 우리 동네가 +{lastContribution.points}점 강해졌습니다.
        </p>
      )}
      <div className="neighborhood-rank-grid">
        <SimpleRankingCard title={summary.country.title} main={summary.country.status} detail="전국 랭킹은 준비중" />
        <SimpleRankingCard title={summary.neighborhood.title} main={summary.neighborhood.rankText} detail={summary.neighborhood.detail} highlight={Boolean(profile)} />
        <SimpleRankingCard title={summary.personal.title} main={summary.personal.rankText} detail={summary.personal.detail} highlight />
      </div>
      <button className="premium-button subtle" type="button" onClick={onRanking}>
        랭킹 보기
        <RiArrowRightSLine />
      </button>
    </section>
  );
}

function SimpleRankingCard({
  title,
  main,
  detail,
  highlight = false,
}: {
  title: string;
  main: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <article className={`simple-rank-card ${highlight ? 'highlight' : ''}`}>
      <span>{title}</span>
      <strong>{main}</strong>
      <p>{detail}</p>
    </article>
  );
}

function SummaryCard({ summary, recentRunsCount }: { summary: HomeWorkoutSummary; recentRunsCount: number }) {
  const metricIcons = [RiMapPin2Fill, RiTimerFlashFill, RiFireFill, RiRunFill];
  return (
    <section className="summary-card glass-panel">
      <div className="card-heading">
        <div>
          <RiPulseLine />
          <strong>내 기록 요약</strong>
        </div>
        <RiBarChartGroupedLine />
      </div>
      <div className="summary-metrics">
        {summary.metrics.map((metric, index) => (
          <MetricTile
            key={metric.label}
            icon={metricIcons[index] ?? RiPulseLine}
            tone={metric.tone}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>
      <p>{summary.insight}</p>
      <small>최근 기록 {summary.recordCount}개 분석 · 러닝 기록 {recentRunsCount}개</small>
    </section>
  );
}

function MetricTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`metric-tile ${tone}`}>
      <Icon />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function LineChart() {
  const points = chartPoints.map((value, index) => `${index * 38 + 6},${86 - value}`).join(' ');
  return (
    <svg className="line-chart" viewBox="0 0 240 96" role="img" aria-label="이번 주 운동량 차트">
      <polyline points={points} />
      {chartPoints.map((value, index) => (
        <circle key={index} cx={index * 38 + 6} cy={86 - value} r="4" />
      ))}
    </svg>
  );
}

function AICoachCard() {
  return (
    <section className="coach-card glass-panel">
      <div className="card-heading">
        <strong>오늘의 AI 코치</strong>
        <FaDumbbell />
      </div>
      <p>어제보다 러닝 속도가 0.8km/h 빨라졌습니다.</p>
      <p>좋습니다. 오늘은 스쿼트를 조금 더 하면 상위 10%에 진입합니다.</p>
      <small>현재 MVP에서는 룰베이스 데이터로 안내합니다.</small>
    </section>
  );
}

function BadgeSection() {
  return (
    <section className="badge-card glass-panel">
      <div className="card-heading">
        <strong>오늘의 배지</strong>
        <RiStarFill />
      </div>
      <div className="badge-list">
        {['🔥 7일 연속', '🏃 러닝 10km', '💪 푸쉬업100', '⭐ TOP10%'].map((badge) => (
          <button key={badge} type="button" onClick={() => undefined}>{badge}</button>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{caption}</p>
    </div>
  );
}

function getProgress(exercise: Exercise) {
  if (exercise.targetValue <= 0) return 0;
  return Math.min(100, achievementRate(exercise.currentValue, exercise.targetValue));
}

function currentExerciseValue(exerciseId: string, progress: ExerciseProgressValues) {
  if (exerciseId === 'squat') return progress.squatReps;
  if (exerciseId === 'jumping-jack') return progress.jumpingJackReps;
  if (exerciseId === 'push-up') return progress.pushupReps;
  if (exerciseId === 'lunge') return progress.lungeReps;
  return 0;
}

function getRunningAchievementLabel(todayKm: number, yesterdayBestKm: number) {
  if (yesterdayBestKm <= 0) return '기록 없음';
  if (todayKm > yesterdayBestKm) return '어제 대비 신기록';
  return `${Math.min(100, Math.round((todayKm / yesterdayBestKm) * 100))}%`;
}

function bestRunningKmOnDate(runs: Array<Record<string, any>>, dateKey: string) {
  const uniqueRuns = new Map<string, Record<string, any>>();

  runs.forEach((run, index) => {
    uniqueRuns.set(String(run.id ?? `run-${index}`), run);
  });

  return Array.from(uniqueRuns.values())
    .filter((run) => isCompletedOnDate(run, dateKey))
    .reduce((best, run) => Math.max(best, runDistanceKm(run)), 0);
}

function isCompletedOnDate(run: Record<string, any>, targetDateKey: string) {
  const runDateKey = String(run.ended_at ?? run.started_at ?? run.created_at ?? '').slice(0, 10);
  if (runDateKey !== targetDateKey) return false;
  if (run.status === 'completed') return true;
  return run.status == null && Boolean(run.ended_at);
}

function runDistanceKm(run: Record<string, any>) {
  const meters = Number(run.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const km = Number(run.actual_distance_km);
  return Number.isFinite(km) && km > 0 ? km : 0;
}

function startOfTodayIso() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

function startOfYesterdayIso() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

function yesterdayDateKey() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42 } },
};
