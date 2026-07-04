import { Bell, BicepsFlexed, CalendarDays, ChevronRight, Flame, Footprints, Home, PersonStanding, RefreshCw, Trophy, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import challengeDailyBg from '../assets/challenge-daily-bg.webp';
import challengeHeroBg from '../assets/challenge-hero-bg.webp';
import challengeNeighborhoodBg from '../assets/challenge-neighborhood-bg.webp';
import {
  buildChallengeAchievementDisplay,
  buildChallengeDashboard,
  buildChallengeDisplayModel,
  type DailyChallenge,
} from '../lib/challengeDashboard';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { readLocalRuns } from '../lib/localRuns';

type ChallengePageProps = {
  user: { id: string };
  onStartExercise: (type: DailyChallenge['type']) => void;
  onHistory: () => void;
};

export default function ChallengePage({ user, onStartExercise, onHistory }: ChallengePageProps) {
  const [notice, setNotice] = useState('');
  const dashboard = useMemo(
    () => buildChallengeDashboard({
      userId: user.id,
      exerciseRecords: readExerciseRecords(user.id),
      runs: readLocalRuns(user.id),
    }),
    [user.id],
  );
  const display = useMemo(() => buildChallengeDisplayModel(dashboard), [dashboard]);
  const achievementDisplay = useMemo(() => buildChallengeAchievementDisplay(dashboard.achievements), [dashboard.achievements]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <main className="challenge-screen">
      <section className="challenge-hero" style={{ '--challenge-hero-bg': `url(${challengeHeroBg})` } as CSSProperties}>
        <button className="challenge-notify-button" type="button" aria-label="알림" onClick={() => setNotice('오늘의 챌린지가 준비되었습니다.')}>
          <Bell size={32} />
          <span />
        </button>
        <div className="challenge-hero-copy">
          <strong>끝까지 버텨라</strong>
          <b>CHALLENGE</b>
          <p>작은 액션으로, 큰 변화를 만든다</p>
        </div>
      </section>

      <p className="challenge-core-line">
        <Zap size={34} fill="currentColor" />
        <span>오늘 <b>5분이 우리 동네를</b> 올립니다.</span>
      </p>

      <section className="challenge-card daily-challenge-card">
        <div className="challenge-card-bg" style={{ backgroundImage: `url(${challengeDailyBg})` }} aria-hidden="true" />
        <CardHeading
          icon={<Flame fill="currentColor" />}
          title="오늘의 작은 도전"
          badge="매일 새로 갱신"
          badgeIcon={<RefreshCw size={16} />}
          onBadgeClick={() => setNotice('챌린지는 매일 자동으로 새로 갱신됩니다.')}
        />
        <div className="daily-challenge-body">
          <div>
            <h1>{dashboard.challenge.label} {dashboard.challenge.target}{dashboard.challenge.unit}</h1>
            <p>{dashboard.challenge.estimate}</p>
            <strong>
              {display.progress}
              <span> / {dashboard.challenge.target}</span>
            </strong>
          </div>
        </div>
        <ProgressBar value={display.progressPercent} />
        <button className="challenge-primary-button" type="button" onClick={() => onStartExercise(dashboard.challenge.type)}>
          운동 시작하기
          <ChevronRight size={34} />
        </button>
        {dashboard.completed && <p className="challenge-complete-message">완료! 오늘의 작은 운동이 우리 동네를 올렸습니다.</p>}
      </section>

      <section className="challenge-card neighborhood-impact-card">
        <div className="challenge-card-bg" style={{ backgroundImage: `url(${challengeNeighborhoodBg})` }} aria-hidden="true" />
        <CardHeading icon={<Home fill="currentColor" />} title="우리 동네 변화" badge="이번 주 목표" />
        <div className="impact-layout">
          <div>
            <p>당신의 운동이</p>
            <h2>우리 동네를 올리고 있어요</h2>
            <div className="rank-row">
              <div>
                <span>현재 순위</span>
                <strong>{dashboard.neighborhood.currentRank}위</strong>
              </div>
              <b>→</b>
              <div>
                <span>목표 순위</span>
                <strong>{dashboard.neighborhood.targetRank}위</strong>
              </div>
            </div>
          </div>
          <div className="impact-ring" style={{ '--value': display.progressPercent } as CSSProperties}>
            <span>목표까지</span>
            <strong>{dashboard.neighborhood.pointsToTarget.toLocaleString()}점</strong>
            <small>남았어요!</small>
          </div>
        </div>
        <div className="impact-contribution">
          <span>당신의 오늘 기여 예상</span>
          <strong>+{display.contribution}점</strong>
        </div>
      </section>

      <section className="challenge-card weekly-progress-card">
        <CardHeading icon={<CalendarDays />} title="이번 주 진행률" badge={`${dashboard.weeklyTargetDays}일 중 ${display.weeklyCompletedDays}일 완료`} />
        <div className="weekly-layout">
          <div>
            <strong>이번 주 {dashboard.weeklyTargetDays}일 운동하기</strong>
            <div className="week-dots">
              {dashboard.weekDays.map((day, index) => {
                const done = day.completed || (dashboard.weeklyCompletedDays === 0 && index < display.weeklyCompletedDays);
                return (
                  <span className={done ? 'done' : ''} key={`${day.label}-${index}`}>
                    <b>{done ? '✓' : '-'}</b>
                    <small>{day.label}</small>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="weekly-count">
            <strong>{display.weeklyCompletedDays}</strong>
            <span>/ {dashboard.weeklyTargetDays}일</span>
            <p>{display.remainingWeekDays}일만 더 하면 완료!</p>
          </div>
        </div>
      </section>

      <div className="challenge-bottom-grid">
        <section className="challenge-card streak-card">
          <CardHeading icon={<Flame fill="currentColor" />} title="연속 운동" />
          <div className="streak-layout">
            <div className="streak-ring">
              <strong>{display.streak}</strong>
              <span>일 연속</span>
            </div>
            <div>
              <b>오늘 운동하면<br />{display.streak + 1}일 연속!</b>
              <span>최고 기록</span>
              <strong>{display.bestStreak}일</strong>
            </div>
          </div>
          <p>멈추지 않는 당신, 멋져요</p>
        </section>

        <section className="challenge-card achievements-card">
          <CardHeading icon={<Trophy fill="currentColor" />} title="업적" badge="더보기" onBadgeClick={onHistory} />
          <div className="achievement-list">
            {achievementDisplay.map((achievement) => {
              return (
                <div className={achievement.complete ? 'complete' : ''} key={achievement.label}>
                  <span>{achievementIcon(achievement.label, achievement.iconText)}</span>
                  <strong>{achievement.label}</strong>
                  <small>{achievement.statusText}</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {notice && <p className="challenge-toast" role="status">{notice}</p>}
    </main>
  );
}

function achievementIcon(label: string, fallback: string) {
  if (label === '첫 운동') return <Footprints size={25} />;
  if (label === '푸시업 100회') return <PersonStanding size={24} />;
  if (label === '러닝 10km') return <BicepsFlexed size={25} />;
  return fallback;
}

function CardHeading({
  icon,
  title,
  badge,
  badgeIcon,
  onBadgeClick,
}: {
  icon?: ReactNode;
  title: string;
  badge?: string;
  badgeIcon?: ReactNode;
  onBadgeClick?: () => void;
}) {
  return (
    <header className="challenge-card-heading">
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      {badge && onBadgeClick ? (
        <button type="button" onClick={onBadgeClick}>
          {badge}
          {badgeIcon ?? <ChevronRight size={18} />}
        </button>
      ) : badge ? (
        <span className="challenge-heading-badge">{badge}</span>
      ) : null}
    </header>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="challenge-progress" aria-label={`진행률 ${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
