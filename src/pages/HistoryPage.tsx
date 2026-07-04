import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  Clock3,
  Flame,
  MapPin,
  Medal,
  Search,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { readLocalRuns } from '../lib/localRuns';
import {
  buildHistoryDashboard,
  filterHistoryWorkouts,
  formatHistoryDuration,
  type HistoryWorkout,
} from '../lib/historyDashboard';

type HistoryPageProps = {
  user: { id: string };
  onStart: () => void;
  onRanking: () => void;
};

const filterTabs = [
  { id: 'all', label: '전체' },
  { id: 'running', label: 'Running' },
  { id: 'push-up', label: 'Push-up' },
  { id: 'squat', label: 'Squat' },
  { id: 'lunge', label: 'Lunge' },
  { id: 'jumping-jack', label: 'Jumping Jack' },
];

const sortOptions = [
  { id: 'latest', label: '최신순' },
  { id: 'oldest', label: '오래된순' },
  { id: 'duration', label: '운동시간' },
  { id: 'volume', label: '운동량' },
  { id: 'calories', label: '칼로리' },
];

export default function HistoryPage({ user, onStart, onRanking }: HistoryPageProps) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'oldest' | 'duration' | 'volume' | 'calories'>('latest');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState<HistoryWorkout | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const dashboard = useMemo(() => buildHistoryDashboard({
    exerciseRecords: readExerciseRecords(user.id),
    runs: readLocalRuns(user.id),
  }), [user.id]);

  const filteredWorkouts = useMemo(() => {
    const byControls = filterHistoryWorkouts(dashboard.workouts, { type: filter, query, sort });
    if (!selectedDate) return byControls;
    return byControls.filter((workout) => workout.completedAt.slice(0, 10) === selectedDate);
  }, [dashboard.workouts, filter, query, selectedDate, sort]);

  const timeline = useMemo(() => {
    const limited = filteredWorkouts.slice(0, visibleCount);
    const groups = new Map<string, HistoryWorkout[]>();
    limited.forEach((workout) => {
      const key = workout.completedAt.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), workout]);
    });
    return [...groups.entries()].map(([dateKey, workouts]) => ({
      dateKey,
      label: dateKey === new Date().toISOString().slice(0, 10) ? '오늘' : dateKey,
      workouts,
    }));
  }, [filteredWorkouts, visibleCount]);

  if (dashboard.workouts.length === 0) {
    return (
      <main className="history-screen history-empty">
        <section className="history-empty-card">
          <Flame size={42} />
          <h1>아직 운동 기록이 없습니다.</h1>
          <p>오늘 첫 운동을 시작해보세요.</p>
          <button type="button" onClick={onStart}>운동 시작</button>
        </section>
      </main>
    );
  }

  const maxWeek = Math.max(1, ...dashboard.weeklyBars.map((point) => point.value));
  const maxMonth = Math.max(1, ...dashboard.monthlyTrend.map((point) => point.value));

  return (
    <main className="history-screen">
      <header className="history-sticky-header">
        <div>
          <span>운동 기록</span>
          <strong>나의 운동 일지</strong>
        </div>
        <button type="button" onClick={() => setSelectedDate('')}>전체 보기</button>
      </header>

      <section className={`history-hero-card ${dashboard.today.completed ? 'done' : 'waiting'}`}>
        <div>
          <span>{dashboard.today.completed ? '오늘의 운동 완료!' : '오늘 아직 운동하지 않았습니다'}</span>
          <h1>{dashboard.today.completed ? '오늘 운동' : '목표까지'}</h1>
          <strong>{dashboard.today.completed ? `${dashboard.today.minutes}분` : `${dashboard.today.remainingGoal} 운동 남음`}</strong>
        </div>
        <div className="history-hero-metrics">
          <MetricPill label="kcal" value={dashboard.today.calories.toLocaleString()} />
          <MetricPill label="운동 완료" value={`${dashboard.today.count}`} />
          <MetricPill label="연속" value={`${dashboard.totals.streakDays}일`} />
        </div>
      </section>

      <section className="history-stat-grid">
        <SummaryCard icon={Trophy} label="총 운동수" value={`${dashboard.totals.workoutCount}회`} />
        <SummaryCard icon={Clock3} label="총 운동시간" value={formatHistoryDuration(dashboard.totals.durationSeconds)} />
        <SummaryCard icon={Flame} label="연속 운동" value={`${dashboard.totals.streakDays}일`} />
        <SummaryCard icon={Medal} label="최고 기록" value={dashboard.personalRecords[0]?.valueLabel ?? '기록 없음'} />
      </section>

      <section className="history-two-column">
        <article className="history-card history-streak-card">
          <span>현재</span>
          <strong>{dashboard.totals.streakDays}일 연속 운동</strong>
          <p>최고 기록 {dashboard.totals.bestStreakDays}일</p>
        </article>
        <article className="history-card history-goal-card">
          <div>
            <Target size={24} />
            <span>이번주 목표</span>
          </div>
          <strong>{dashboard.weeklyGoal.completedDays} / {dashboard.weeklyGoal.targetDays} 운동</strong>
          <ProgressBar value={dashboard.weeklyGoal.percent} />
          <p>{dashboard.weeklyGoal.percent}%</p>
        </article>
      </section>

      <section className="history-pr-card history-card">
        <div className="history-section-title">
          <Trophy size={22} />
          <strong>Personal Records</strong>
        </div>
        <div className="history-pr-grid">
          {dashboard.personalRecords.map((record) => (
            <div key={record.type}>
              <span>{record.label}</span>
              <strong>{record.valueLabel}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="history-capsules">
        {dashboard.capsules.map((workout) => (
          <button key={workout.id} type="button" onClick={() => setSelectedWorkout(workout)}>
            <span>{workout.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10) ? '오늘' : workout.completedAt.slice(5, 10)}</span>
            <strong>{workout.label}</strong>
            <b>{workoutMetric(workout)}</b>
          </button>
        ))}
      </section>

      <section className="history-card">
        <div className="history-section-title">
          <CalendarDays size={22} />
          <strong>월별 활동</strong>
        </div>
        <div className="history-heatmap">
          {dashboard.heatmap.map((day) => (
            <button
              aria-label={`${day.dateKey} 운동 ${day.count}개`}
              className={`heat-${day.intensity} ${selectedDate === day.dateKey ? 'selected' : ''}`}
              key={day.dateKey}
              type="button"
              onClick={() => setSelectedDate(selectedDate === day.dateKey ? '' : day.dateKey)}
            >
              {day.day}
            </button>
          ))}
        </div>
      </section>

      <section className="history-chart-grid">
        <article className="history-card">
          <div className="history-section-title">
            <BarChart3 size={22} />
            <strong>최근 7일</strong>
          </div>
          <div className="history-week-chart">
            {dashboard.weeklyBars.map((point) => (
              <div key={point.label}>
                <span>{point.label}</span>
                <i style={{ height: `${Math.max(6, (point.value / maxWeek) * 100)}%` }} />
                <b>{point.value}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="history-card">
          <div className="history-section-title">
            <BarChart3 size={22} />
            <strong>최근 12개월</strong>
          </div>
          <div className="history-month-chart">
            {dashboard.monthlyTrend.map((point) => (
              <div key={point.label}>
                <i style={{ height: `${Math.max(6, (point.value / maxMonth) * 100)}%` }} />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="history-comparison-grid">
        <CompareCard label="운동시간" value={dashboard.comparison.durationPercent} suffix="%" />
        <CompareCard label="칼로리" value={dashboard.comparison.caloriesPercent} suffix="%" />
        <CompareCard label="운동횟수" value={dashboard.comparison.workoutDelta} suffix="회" />
        <article className="history-card history-neighborhood-card" onClick={onRanking}>
          <MapPin size={24} />
          <span>우리 동네 기여</span>
          <strong>+{dashboard.neighborhood.contribution.toLocaleString()}점</strong>
          <p>전체 기여 순위 {dashboard.neighborhood.rank}위</p>
        </article>
      </section>

      <section className="history-exercise-grid">
        {dashboard.exerciseStats.map((stat) => (
          <article className="history-card history-exercise-card" key={stat.type}>
            <div>
              <span>{stat.icon}</span>
              <strong>{stat.label}</strong>
            </div>
            <dl>
              <dt>총 운동</dt><dd>{stat.count}회</dd>
              <dt>최고</dt><dd>{stat.bestLabel}</dd>
              <dt>평균</dt><dd>{stat.averageLabel}</dd>
              <dt>최근</dt><dd>{stat.recentLabel}</dd>
            </dl>
          </article>
        ))}
      </section>

      <section className="history-card history-badge-card">
        <div className="history-section-title">
          <Award size={22} />
          <strong>배지</strong>
        </div>
        <div className="history-badges">
          {dashboard.badges.map((badge) => (
            <span className={badge.achieved ? 'achieved' : ''} key={badge.label}>{badge.label}</span>
          ))}
        </div>
      </section>

      <section className="history-controls">
        <div className="history-filter-chips">
          {filterTabs.map((item) => (
            <button className={filter === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setFilter(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="history-search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="날짜, 운동명, 거리, 횟수 검색" />
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          {sortOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </section>

      <section className="history-timeline">
        <div className="history-section-title">
          <Timer size={22} />
          <strong>운동 히스토리</strong>
        </div>
        {timeline.map((group) => (
          <article className="history-timeline-day" key={group.dateKey}>
            <time>{group.label}</time>
            <div>
              {group.workouts.map((workout) => (
                <button key={workout.id} type="button" onClick={() => setSelectedWorkout(workout)}>
                  <span>{workoutIcon(workout.type)}</span>
                  <strong>{workout.label}</strong>
                  <b>{workoutMetric(workout)}</b>
                  <em>{formatHistoryDuration(workout.durationSeconds)}</em>
                  <small>{workout.calories} kcal</small>
                </button>
              ))}
            </div>
          </article>
        ))}
        {visibleCount < filteredWorkouts.length && (
          <button className="history-load-more" type="button" onClick={() => setVisibleCount((count) => count + 20)}>
            더 보기
          </button>
        )}
      </section>

      {selectedWorkout && (
        <section className="history-detail-sheet" role="dialog" aria-label="운동 상세">
          <div>
            <button type="button" onClick={() => setSelectedWorkout(null)}>닫기</button>
            <span>{workoutIcon(selectedWorkout.type)}</span>
            <h2>{selectedWorkout.label}</h2>
            <strong>{workoutMetric(selectedWorkout)}</strong>
            <dl>
              <dt>운동시간</dt><dd>{formatClock(selectedWorkout.durationSeconds)}</dd>
              <dt>평균속도</dt><dd>{paceLabel(selectedWorkout)}</dd>
              <dt>칼로리</dt><dd>{selectedWorkout.calories} kcal</dd>
              <dt>체력 변화</dt><dd>+{Math.max(1, Math.round(selectedWorkout.contribution / 3))}</dd>
              <dt>동네 기여</dt><dd>+{selectedWorkout.contribution}점</dd>
            </dl>
          </div>
        </section>
      )}
    </main>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <article className="history-card history-summary-card">
      <Icon size={24} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="history-progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function CompareCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const positive = value >= 0;
  return (
    <article className={`history-card history-compare-card ${positive ? 'up' : 'down'}`}>
      <span>{positive ? '상승' : '하락'} {label}</span>
      <strong>{positive ? '+' : ''}{value}{suffix}</strong>
    </article>
  );
}

function workoutIcon(type: string) {
  if (type === 'running') return '🏃';
  if (type === 'push-up') return '💪';
  if (type === 'squat') return '🏋️';
  if (type === 'lunge') return '🦵';
  if (type === 'jumping-jack') return '⚡';
  return '🏁';
}

function workoutMetric(workout: HistoryWorkout) {
  if (workout.distanceKm > 0) return `${workout.distanceKm.toFixed(1)}km`;
  if (workout.reps > 0) return `${Math.round(workout.reps)}회`;
  return formatHistoryDuration(workout.durationSeconds);
}

function formatClock(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function paceLabel(workout: HistoryWorkout) {
  const minutes = Math.max(1 / 60, workout.durationSeconds / 60);
  if (workout.distanceKm > 0) return `${(minutes / workout.distanceKm).toFixed(1)}분/km`;
  if (workout.reps > 0) return `${Math.round(workout.reps / minutes)}회/분`;
  return '-';
}
