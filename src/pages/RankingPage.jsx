import { Award, ChevronUp, Clock, Ghost, Medal, Trophy, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EXERCISE_LABELS, RANKING_TAB_LABELS } from '../lib/endureRankingConstants';
import {
  buildLeagueRanking,
  buildLeagueRankingFromRatings,
  calculateEndureRating,
  endureRatingFromStoredRow,
  endureRatingToRow,
} from '../lib/endureRanking';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { readLocalRuns } from '../lib/localRuns';
import { supabase } from '../lib/supabaseClient';

const tabs = ['league', 'overall', 'friends', 'ghosts'];
const exerciseOrder = ['running', 'squat', 'lunge', 'pushup', 'extra'];

export default function RankingPage({ user, onBack }) {
  const [activeTab, setActiveTab] = useState('league');
  const [storedRatings, setStoredRatings] = useState([]);
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '챌린저';
  const currentUserInput = useMemo(() => ({
    userId: user?.id ?? 'anonymous',
    displayName,
    runs: readLocalRuns(user?.id),
    exerciseRecords: readExerciseRecords(user?.id),
    isCurrentUser: true,
  }), [displayName, user?.id]);
  const localRating = useMemo(() => calculateEndureRating(currentUserInput), [currentUserInput]);
  const league = useMemo(() => {
    const peers = storedRatings
      .map((row) => endureRatingFromStoredRow(row))
      .filter((rating) => rating.userId);

    if (peers.length > 0) {
      return buildLeagueRankingFromRatings({
        currentRating: {
          ...localRating,
          displayName,
          isCurrentUser: true,
        },
        peerRatings: peers,
      });
    }

    return buildLeagueRanking({
      currentUser: currentUserInput,
    });
  }, [currentUserInput, displayName, localRating, storedRatings]);
  const entries = useMemo(() => filterEntriesByTab(league.entries, activeTab), [activeTab, league.entries]);
  const userEntry = league.entries.find((entry) => entry.userId === user?.id) ?? league.entries.find((entry) => entry.isCurrentUser);
  const seasonEnd = new Date(league.season.endsAt);

  useEffect(() => {
    let active = true;
    supabase
      .from('user_endure_ratings')
      .select('user_id,running_score,squat_score,lunge_score,pushup_score,extra_score,base_er,bonus_er,total_er,level,updated_at')
      .order('total_er', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStoredRatings([]);
          return;
        }
        setStoredRatings(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_endure_ratings').upsert(endureRatingToRow(localRating)).then(() => undefined);
  }, [localRating, user?.id]);

  return (
    <main className="ranking-league-screen">
      <header className="ranking-league-header">
        <div>
          <span>5종목 통합 랭킹</span>
          <h1>{league.leagueName}</h1>
          <p>비슷한 실력의 사용자와 고스트가 함께 경쟁하는 리그입니다.</p>
        </div>
        <button className="ranking-close-button" type="button" onClick={onBack}>
          닫기
        </button>
      </header>

      <section className="ranking-my-card">
        <div className="ranking-my-rank">
          <Trophy size={28} />
          <span>내 리그</span>
          <strong>{league.level} 리그 {league.userRank}위 / {league.maxMembers}명</strong>
        </div>
        <div className="ranking-er-score">
          <span>내 ER 점수</span>
          <strong>{league.userRating.totalEr.toLocaleString()}</strong>
          <small>base {league.userRating.baseEr} + bonus {league.userRating.bonusEr}</small>
        </div>
        <div className="ranking-season-box">
          <Clock size={18} />
          <span>이번 시즌 종료까지 남은 시간</span>
          <strong>{formatRemaining(seasonEnd)}</strong>
        </div>
      </section>

      <section className="ranking-guide-card">
        <p>상위 20%는 다음 리그로 승급합니다.</p>
        <p>5종목을 모두 완료하면 균형 보너스를 받을 수 있습니다.</p>
      </section>

      <nav className="ranking-tab-bar" aria-label="랭킹 탭">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab ? 'active' : ''}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {RANKING_TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <section className="ranking-table-card">
        <div className="ranking-table-heading">
          <div>
            <span>{RANKING_TAB_LABELS[activeTab]}</span>
            <strong>상위 {entries.length}명 랭킹</strong>
          </div>
          <small>USER {league.realUserCount} · GHOST {league.ghostCount}</small>
        </div>

        <ol className="endure-ranking-list">
          {entries.map((entry) => (
            <li className={entry.isCurrentUser ? 'current-user' : ''} key={entry.id}>
              <div className={`rank-medal rank-${entry.rank}`}>
                {entry.rank <= 3 ? <Medal size={18} /> : <span>{entry.rank}</span>}
              </div>
              <div className="ranking-entry-main">
                <div className="ranking-entry-name">
                  {entry.entryType === 'ghost' ? <Ghost size={17} /> : <UserRound size={17} />}
                  <strong>{entry.displayName}</strong>
                  <b className={entry.entryType}>{entry.entryType === 'ghost' ? 'GHOST' : 'USER'}</b>
                  {entry.ghostType && <small>{entry.ghostType}</small>}
                </div>
                <div className="ranking-score-strip">
                  {exerciseOrder.map((exercise) => (
                    <span key={exercise}>
                      {EXERCISE_LABELS[exercise]}
                      <b>{entry.scores[exercise]}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="ranking-entry-er">
                <span>ER</span>
                <strong>{entry.totalEr.toLocaleString()}</strong>
                <Movement entry={entry} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {userEntry && (
        <section className="ranking-reward-card">
          <Award size={22} />
          <div>
            <strong>{seasonRewardText(userEntry.rank, league.maxMembers)}</strong>
            <span>시즌 종료 후 순위에 따라 Champion, Elite, Promotion, Balanced Endurer Badge가 지급됩니다.</span>
          </div>
        </section>
      )}
    </main>
  );
}

function filterEntriesByTab(entries, tab) {
  if (tab === 'ghosts') return entries.filter((entry) => entry.entryType === 'ghost').slice(0, 50);
  if (tab === 'friends') return entries.filter((entry) => entry.isCurrentUser || entry.entryType === 'ghost').slice(0, 20);
  return entries.slice(0, 50);
}

function Movement({ entry }) {
  if (entry.movement === 'new') return <small className="movement new">NEW</small>;
  if (entry.movement === 'up') {
    return (
      <small className="movement up">
        <ChevronUp size={13} />
        +{entry.movementDelta}
      </small>
    );
  }
  if (entry.movement === 'down') return <small className="movement down">-{Math.abs(entry.movementDelta)}</small>;
  return <small className="movement same">-</small>;
}

function formatRemaining(endDate) {
  const diff = Math.max(0, endDate.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}일 ${hours}시간`;
}

function seasonRewardText(rank, memberCount) {
  if (rank === 1) return '현재 Champion Badge 후보입니다.';
  if (rank <= 10) return '현재 Elite Badge 후보입니다.';
  if (rank / Math.max(1, memberCount) <= 0.2) return '현재 승급권입니다.';
  return '중간 60%는 현재 리그를 유지합니다.';
}
