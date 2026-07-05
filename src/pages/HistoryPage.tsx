import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Footprints,
  ListFilter,
  Medal,
  PersonStanding,
  Play,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import historyNeonBg from '../assets/history-neon-bg.jpg';
import {
  AppCard,
  EmptyState,
  GlassContainer,
  GradientButton,
  ListTile,
  SecondaryButton,
  SectionHeader,
  StatCard as DSStatCard,
} from '../components/designSystem';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { readLocalRuns } from '../lib/localRuns';
import {
  buildHistoryDashboard,
  dateKey,
  filterHistoryWorkouts,
  formatHistoryDuration,
  type ChartPoint,
  type ExerciseHistoryStat,
  type HistoryDashboard,
  type HistoryWorkout,
} from '../lib/historyDashboard';

type HistoryPageProps = {
  user: { id: string };
  onStart: () => void;
  onRanking: () => void;
};

type HistoryTab = 'summary' | 'detail';

const filterTabs = [
  { id: 'all', label: '전체' },
  { id: 'running', label: '러닝' },
  { id: 'squat', label: '스쿼트' },
  { id: 'jumping-jack', label: '점핑잭' },
  { id: 'push-up', label: '푸쉬업' },
  { id: 'lunge', label: '런지' },
];

export default function HistoryPage({ user, onStart, onRanking }: HistoryPageProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('summary');
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [selectedWorkout, setSelectedWorkout] = useState<HistoryWorkout | null>(null);

  const dashboard = useMemo(() => buildHistoryDashboard({
    exerciseRecords: readExerciseRecords(user.id),
    runs: readLocalRuns(user.id),
  }), [user.id]);

  const filteredWorkouts = useMemo(() => (
    filterHistoryWorkouts(dashboard.workouts, { type: filter, sort: 'latest' })
      .filter((workout) => workout.completedAt.slice(0, 10) === selectedDate)
  ), [dashboard.workouts, filter, selectedDate]);

  const selectedDaySummary = useMemo(() => summarizeWorkouts(filteredWorkouts), [filteredWorkouts]);
  const recentWorkouts = dashboard.workouts.slice(0, 5);
  const maxWeek = Math.max(1, ...dashboard.weeklyBars.map((point) => point.value));
  const maxTrend = Math.max(1, ...dashboard.monthlyTrend.map((point) => point.value));

  function shiftDate(days: number) {
    const nextDate = new Date(`${selectedDate}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    setSelectedDate(dateKey(nextDate));
  }

  return (
    <GlassContainer
      as="main"
      className="history-screen history-records-screen"
      style={{
        '--history-bg-image': `url(${historyNeonBg})`,
      } as CSSProperties}
    >
      <HistoryHeader
        activeTab={activeTab}
        onBack={() => setActiveTab('summary')}
        onCalendar={() => setSelectedDate(dateKey(new Date()))}
      />

      <HistoryTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'summary' ? (
        <SummaryTab
          dashboard={dashboard}
          maxWeek={maxWeek}
          onRanking={onRanking}
          onSelectWorkout={setSelectedWorkout}
          onStart={onStart}
          recentWorkouts={recentWorkouts}
        />
      ) : (
        <DetailTab
          dashboard={dashboard}
          filter={filter}
          filteredWorkouts={filteredWorkouts}
          maxTrend={maxTrend}
          onFilterChange={setFilter}
          onSelectWorkout={setSelectedWorkout}
          onShiftDate={shiftDate}
          selectedDate={selectedDate}
          summary={selectedDaySummary}
        />
      )}

      {selectedWorkout && (
        <WorkoutDetailSheet workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      )}
    </GlassContainer>
  );
}

function HistoryHeader({
  activeTab,
  onBack,
  onCalendar,
}: {
  activeTab: HistoryTab;
  onBack: () => void;
  onCalendar: () => void;
}) {
  return (
    <header className="history-app-header">
      {activeTab === 'detail' ? (
        <SecondaryButton className="history-icon-button" onClick={onBack} aria-label="요약으로 돌아가기">
          <ArrowLeft size={24} />
        </SecondaryButton>
      ) : (
        <span aria-hidden="true" />
      )}
      <h1>내 기록</h1>
      <SecondaryButton className="history-icon-button" onClick={onCalendar} aria-label="오늘 날짜로 이동">
        <CalendarDays size={24} />
      </SecondaryButton>
    </header>
  );
}

function HistoryTabs({
  activeTab,
  onChange,
}: {
  activeTab: HistoryTab;
  onChange: (tab: HistoryTab) => void;
}) {
  return (
    <nav className="history-tab-switch" aria-label="내 기록 탭">
      <button className={activeTab === 'summary' ? 'active' : ''} type="button" onClick={() => onChange('summary')}>
        요약
      </button>
      <button className={activeTab === 'detail' ? 'active' : ''} type="button" onClick={() => onChange('detail')}>
        상세
      </button>
    </nav>
  );
}

function SummaryTab({
  dashboard,
  maxWeek,
  onRanking,
  onSelectWorkout,
  onStart,
  recentWorkouts,
}: {
  dashboard: HistoryDashboard;
  maxWeek: number;
  onRanking: () => void;
  onSelectWorkout: (workout: HistoryWorkout) => void;
  onStart: () => void;
  recentWorkouts: HistoryWorkout[];
}) {
  const todaySeconds = dashboard.today.minutes * 60;
  const progress = Math.min(100, Math.round((dashboard.today.minutes / 60) * 100));

  return (
    <div className="history-tab-panel">
      <AppCard className="history-card history-today-card">
        <SectionHeader className="history-card-heading" title="오늘의 운동 요약" action={<span>{formatDateLabel(dateKey(new Date()))}</span>} />
        <div className="history-today-layout">
          <ProgressRing value={progress} label="총 운동시간" valueText={formatTimer(todaySeconds)} unit="분" />
          <div className="history-today-stats">
            <StatLine icon={Flame} label="칼로리" value={`${dashboard.today.calories.toLocaleString()} kcal`} />
            <StatLine icon={Dumbbell} label="운동 완료" value={`${dashboard.today.count}회`} />
            <StatLine icon={CalendarDays} label="연속 기록" value={`${dashboard.totals.streakDays}일`} />
          </div>
        </div>
      </AppCard>

      <WeeklyChart bars={dashboard.weeklyBars} maxValue={maxWeek} totalLabel={formatHistoryDuration(sum(dashboard.weeklyBars.map((point) => point.value * 60)))} />

      <AppCard className="history-card history-exercise-summary">
        <SectionHeader
          className="history-card-heading"
          title="운동 종류별 기록"
          action={(
            <SecondaryButton onClick={onRanking}>
              더보기
              <ChevronRight size={18} />
            </SecondaryButton>
          )}
        />
        <div className="history-exercise-summary-grid">
          {dashboard.exerciseStats.slice(0, 5).map((stat) => (
            <ExerciseTypeCard stat={stat} key={stat.type} />
          ))}
        </div>
      </AppCard>

      <AppCard className="history-card history-recent-card">
        <SectionHeader className="history-card-heading" title="최근 기록" action={dashboard.workouts.length > 0 ? <span>{dashboard.workouts.length}개 기록</span> : null} />
        {recentWorkouts.length > 0 ? (
          <div className="history-record-list compact">
            {recentWorkouts.map((workout) => (
              <ExerciseRecordRow key={workout.id} workout={workout} onSelect={onSelectWorkout} />
            ))}
          </div>
        ) : (
          <EmptyRecords onStart={onStart} />
        )}
      </AppCard>
    </div>
  );
}

function DetailTab({
  dashboard,
  filter,
  filteredWorkouts,
  maxTrend,
  onFilterChange,
  onSelectWorkout,
  onShiftDate,
  selectedDate,
  summary,
}: {
  dashboard: HistoryDashboard;
  filter: string;
  filteredWorkouts: HistoryWorkout[];
  maxTrend: number;
  onFilterChange: (filter: string) => void;
  onSelectWorkout: (workout: HistoryWorkout) => void;
  onShiftDate: (days: number) => void;
  selectedDate: string;
  summary: DaySummary;
}) {
  const bestRecord = Math.max(0, ...filteredWorkouts.map((workout) => workoutVolume(workout)));

  return (
    <div className="history-tab-panel">
      <nav className="history-filter-tabs" aria-label="운동 필터">
        {filterTabs.map((tab) => (
          <button
            className={filter === tab.id ? 'active' : ''}
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="history-date-picker">
        <button type="button" onClick={() => onShiftDate(-1)} aria-label="이전 날짜">
          <ChevronLeft size={22} />
        </button>
        <button className="history-date-value" type="button" aria-label="날짜 선택">
          {formatDateLabel(selectedDate)}
          <ArrowDown size={17} />
        </button>
        <button type="button" onClick={() => onShiftDate(1)} aria-label="다음 날짜">
          <ChevronRight size={22} />
        </button>
      </div>

      <AppCard className="history-card history-detail-stats">
        <StatCard label="총 운동시간" value={formatTimer(summary.durationSeconds)} unit="분" />
        <StatCard label="총 운동수" value={`${summary.count}`} unit="회" />
        <StatCard label="총 칼로리" value={`${summary.calories}`} unit="kcal" />
        <StatCard label="최고 기록" value={`${Math.round(bestRecord)}`} unit={filter === 'running' ? 'km' : '회'} />
      </AppCard>

      <AppCard className="history-card history-workout-list-card">
        <SectionHeader className="history-card-heading" title="운동 목록" action={<span>{filteredWorkouts.length}개</span>} />
        {filteredWorkouts.length > 0 ? (
          <div className="history-record-list">
            {filteredWorkouts.map((workout) => (
              <ExerciseRecordRow key={workout.id} workout={workout} onSelect={onSelectWorkout} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="history-no-day-record"
            icon={<ListFilter size={28} />}
            title="선택한 날짜의 기록이 없습니다."
            body="필터나 날짜를 바꿔 확인해보세요."
          />
        )}
      </AppCard>

      <TrendChart points={dashboard.monthlyTrend} maxValue={maxTrend} />
    </div>
  );
}

function ProgressRing({
  value,
  label,
  valueText,
  unit,
}: {
  value: number;
  label: string;
  valueText: string;
  unit: string;
}) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div className="history-progress-ring" style={{ '--ring-value': bounded } as CSSProperties}>
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="track" cx="80" cy="80" r="68" />
        <circle className="value" cx="80" cy="80" r="68" />
      </svg>
      <div>
        <span>{label}</span>
        <strong>{valueText}</strong>
        <small>{unit}</small>
      </div>
    </div>
  );
}

function StatLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="history-stat-line">
      <span>
        <Icon size={22} fill="currentColor" />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <DSStatCard className="history-stat-card" label={label} value={value} detail={unit} />
  );
}

function WeeklyChart({ bars, maxValue, totalLabel }: { bars: ChartPoint[]; maxValue: number; totalLabel: string }) {
  return (
    <AppCard className="history-card history-weekly-card">
      <SectionHeader className="history-card-heading" title="주간 활동" />
      <div className="history-weekly-layout">
        <div>
          <span>이번 주 운동 시간</span>
          <strong>{totalLabel}</strong>
        </div>
        <div className="history-week-bars">
          {bars.map((point) => (
            <div key={point.label}>
              <span>{point.value > 0 ? `${point.value}분` : ''}</span>
              <i style={{ height: `${Math.max(8, (point.value / maxValue) * 100)}%` }} />
              <b>{point.label}</b>
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  );
}

function TrendChart({ points, maxValue }: { points: ChartPoint[]; maxValue: number }) {
  const chartPoints = buildPolyline(points, maxValue);
  const areaPoints = chartPoints ? `0,140 ${chartPoints} 320,140` : '';

  return (
    <AppCard className="history-card history-trend-card">
      <SectionHeader className="history-card-heading" title="시간대별 운동 추이" action={<span>단위: 건</span>} />
      <div className="history-line-chart">
        <svg viewBox="0 0 320 150" role="img" aria-label="운동 추이 차트">
          <defs>
            <linearGradient id="historyTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ds-green)" stopOpacity="0.44" />
              <stop offset="100%" stopColor="var(--ds-green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline className="grid" points="0,140 320,140" />
          {areaPoints && <polygon className="area" points={areaPoints} />}
          {chartPoints && <polyline className="line" points={chartPoints} />}
          {points.map((point, index) => {
            const x = points.length <= 1 ? 160 : (index / (points.length - 1)) * 320;
            return <text key={point.label} x={x} y="149">{index % 3 === 0 ? point.label : ''}</text>;
          })}
        </svg>
      </div>
    </AppCard>
  );
}

function ExerciseTypeCard({ stat }: { stat: ExerciseHistoryStat }) {
  const Icon = exerciseIcon(stat.type);
  return (
    <AppCard as="article" className="history-exercise-type-card">
      <span>
        <Icon size={28} />
      </span>
      <strong>{koreanExerciseLabel(stat.type, stat.label)}</strong>
      <b>{stat.bestLabel}</b>
    </AppCard>
  );
}

function ExerciseRecordRow({
  workout,
  onSelect,
}: {
  workout: HistoryWorkout;
  onSelect: (workout: HistoryWorkout) => void;
}) {
  const Icon = exerciseIcon(workout.type);
  return (
    <ListTile as="button" className="history-record-row" type="button" onClick={() => onSelect(workout)}>
      <span>
        <Icon size={26} />
      </span>
      <div>
        <strong>{koreanExerciseLabel(workout.type, workout.label)}</strong>
        <small>{formatWorkoutTime(workout.completedAt)}</small>
      </div>
      <div>
        <b>{workoutMetric(workout)}</b>
        <small>
          <Clock3 size={12} />
          {formatClock(workout.durationSeconds)}
        </small>
      </div>
      <ChevronRight size={20} />
    </ListTile>
  );
}

function EmptyRecords({ onStart }: { onStart: () => void }) {
  return (
    <EmptyState
      className="history-empty-inline"
      icon={<Trophy size={34} />}
      title="아직 운동 기록이 없습니다."
      body="오늘 첫 운동을 시작해보세요."
      action={(
        <GradientButton onClick={onStart}>
          <Play size={18} fill="currentColor" />
          운동 시작
        </GradientButton>
      )}
    />
  );
}

function WorkoutDetailSheet({ workout, onClose }: { workout: HistoryWorkout; onClose: () => void }) {
  return (
    <section className="history-detail-sheet" role="dialog" aria-label="운동 상세">
      <AppCard>
        <SecondaryButton onClick={onClose}>닫기</SecondaryButton>
        <span>{workoutIconText(workout.type)}</span>
        <h2>{koreanExerciseLabel(workout.type, workout.label)}</h2>
        <strong>{workoutMetric(workout)}</strong>
        <dl>
          <dt>운동시간</dt><dd>{formatClock(workout.durationSeconds)}</dd>
          <dt>평균속도</dt><dd>{paceLabel(workout)}</dd>
          <dt>칼로리</dt><dd>{workout.calories} kcal</dd>
          <dt>체력 변화</dt><dd>+{Math.max(1, Math.round(workout.contribution / 3))}</dd>
          <dt>동네 기여</dt><dd>+{workout.contribution}점</dd>
        </dl>
      </AppCard>
    </section>
  );
}

type DaySummary = {
  count: number;
  durationSeconds: number;
  calories: number;
};

function summarizeWorkouts(workouts: HistoryWorkout[]): DaySummary {
  return {
    count: workouts.length,
    durationSeconds: sum(workouts.map((workout) => workout.durationSeconds)),
    calories: sum(workouts.map((workout) => workout.calories)),
  };
}

function buildPolyline(points: ChartPoint[], maxValue: number) {
  if (points.length === 0) return '';
  return points.map((point, index) => {
    const x = points.length <= 1 ? 160 : (index / (points.length - 1)) * 320;
    const y = 130 - ((point.value / maxValue) * 108);
    return `${x.toFixed(1)},${Math.max(16, y).toFixed(1)}`;
  }).join(' ');
}

function exerciseIcon(type: string): LucideIcon {
  if (type === 'running') return Footprints;
  if (type === 'push-up') return Dumbbell;
  if (type === 'squat') return PersonStanding;
  if (type === 'lunge') return Medal;
  if (type === 'jumping-jack') return Zap;
  return Dumbbell;
}

function koreanExerciseLabel(type: string, fallback: string) {
  if (type === 'running') return '런닝';
  if (type === 'push-up') return '푸쉬업';
  if (type === 'squat') return '스쿼트';
  if (type === 'lunge') return '런지';
  if (type === 'jumping-jack') return '점핑잭';
  return fallback;
}

function workoutIconText(type: string) {
  if (type === 'running') return 'RUN';
  if (type === 'push-up') return 'PUSH';
  if (type === 'squat') return 'SQ';
  if (type === 'lunge') return 'LG';
  if (type === 'jumping-jack') return 'JJ';
  return 'FIT';
}

function workoutMetric(workout: HistoryWorkout) {
  if (workout.distanceKm > 0) return `${workout.distanceKm.toFixed(1)}km`;
  if (workout.reps > 0) return `${Math.round(workout.reps)}회`;
  return formatHistoryDuration(workout.durationSeconds);
}

function workoutVolume(workout: HistoryWorkout) {
  if (workout.distanceKm > 0) return workout.distanceKm;
  if (workout.reps > 0) return workout.reps;
  return Math.round(workout.durationSeconds / 60);
}

function formatTimer(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function formatClock(seconds: number) {
  return formatTimer(seconds);
}

function formatWorkoutTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  const day = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()];
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')} (${day})`;
}

function paceLabel(workout: HistoryWorkout) {
  const minutes = Math.max(1 / 60, workout.durationSeconds / 60);
  if (workout.distanceKm > 0) return `${(minutes / workout.distanceKm).toFixed(1)}분/km`;
  if (workout.reps > 0) return `${Math.round(workout.reps / minutes)}회/분`;
  return '-';
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
