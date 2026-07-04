import { Geolocation } from '@capacitor/geolocation';
import { MapPin, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { readExerciseRecords } from '../lib/exerciseRecords';
import {
  buildRankingView,
  movementText,
  neighborhoodProfileFromRow,
  neighborhoodProfileToRow,
  readNeighborhoodProfile,
  resolveNeighborhoodFromGps,
  saveNeighborhoodProfile,
} from '../lib/neighborhoodRanking';
import { supabase } from '../lib/supabaseClient';

const tabs = [
  { id: 'country', label: '국가별', searchLabel: '국가명 검색' },
  { id: 'neighborhood', label: '시/도별', searchLabel: '시/도명 검색' },
  { id: 'personal', label: '개인별', searchLabel: '닉네임 검색' },
];

const periods = [
  { id: 'today', label: '오늘' },
  { id: 'week', label: '이번 주' },
  { id: 'month', label: '이번 달' },
];

export default function RankingPage({ user, onBack }) {
  const [activeTab, setActiveTab] = useState('neighborhood');
  const [period, setPeriod] = useState('today');
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState(() => readNeighborhoodProfile(user?.id ?? 'anonymous'));
  const [authMessage, setAuthMessage] = useState('');
  const [remoteRanking, setRemoteRanking] = useState(null);
  const [rankingStatus, setRankingStatus] = useState('local');
  const records = useMemo(() => readExerciseRecords(user?.id ?? 'anonymous'), [user?.id]);
  const localRanking = useMemo(() => buildRankingView(profile, records, period), [period, profile, records]);
  const ranking = remoteRanking ?? localRanking;
  const effectiveTab = activeTab === 'neighborhood' && !profile ? 'personal' : activeTab;
  const currentTab = tabs.find((tab) => tab.id === effectiveTab) ?? tabs[1];

  useEffect(() => {
    const userId = user?.id ?? 'anonymous';
    setProfile(readNeighborhoodProfile(userId));
    if (!user?.id || user?.app_metadata?.provider === 'local-test') return;

    let active = true;
    supabase
      .from('profiles')
        .select('neighborhood_name,neighborhood_code,region_name,region_code,neighborhood_verified_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const remoteProfile = neighborhoodProfileFromRow(data);
        if (!remoteProfile) return;
        saveNeighborhoodProfile(user.id, remoteProfile);
        setProfile(remoteProfile);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || user?.app_metadata?.provider === 'local-test') {
      setRemoteRanking(null);
      setRankingStatus('local');
      return undefined;
    }

    let active = true;
    setRankingStatus('loading');

    loadRemoteRankingView({ userId: user.id, profile, period, localRanking })
      .then((nextRanking) => {
        if (!active) return;
        setRemoteRanking(nextRanking);
        setRankingStatus('remote');
      })
      .catch((error) => {
        console.debug('[RankingPage] Failed to load remote rankings.', error);
        if (!active) return;
        setRemoteRanking(null);
        setRankingStatus('local');
      });

    return () => {
      active = false;
    };
  }, [localRanking, period, profile, user?.app_metadata?.provider, user?.id]);

  async function handleVerify() {
    setAuthMessage('GPS 확인 중');
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        setAuthMessage('인증 필요');
        return;
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
      const nextProfile = resolveNeighborhoodFromGps(position.coords.latitude, position.coords.longitude);
      const saved = saveNeighborhoodProfile(user?.id ?? 'anonymous', nextProfile);
      if (user?.id && user?.app_metadata?.provider !== 'local-test') {
        await supabase.from('profiles').upsert({
          id: user.id,
          nickname: user.email?.split('@')[0] ?? '러너',
          ...neighborhoodProfileToRow(saved),
        });
      }
      setProfile(saved);
      setAuthMessage(`${saved.districtName} 인증 완료`);
    } catch {
      setAuthMessage('인증 필요');
    }
  }

  const rows = useMemo(() => {
    if (effectiveTab === 'country') return [];
    const source = effectiveTab === 'personal' ? ranking.personalEntries : ranking.neighborhoodEntries;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return source;
    return source.filter((entry) => entry.name.toLowerCase().includes(normalized));
  }, [effectiveTab, query, ranking.neighborhoodEntries, ranking.personalEntries]);

  const mine = effectiveTab === 'personal'
    ? ranking.personalEntries.find((entry) => entry.isMine)
    : ranking.neighborhoodEntries.find((entry) => entry.isMine);
  const isPersonal = effectiveTab === 'personal';
  const displayedContribution = mine?.score ?? ranking.contribution;
  const scopeName = isPersonal ? '나' : profile?.regionName ?? '시/도 미인증';
  const neighborhoodName = profile?.districtName ?? '동네 미인증';
  const locationTitle = isPersonal ? scopeName : neighborhoodName;
  const locationDetail = isPersonal
    ? '개인 기록 기준'
    : 'GPS 인증 후 현재 시/도와 동네가 표시됩니다';
  const rankTitle = isPersonal ? '개인 순위' : '시/도 순위';
  const progressPercent = Math.min(100, Math.round((displayedContribution / 300) * 100));

  return (
    <main className="ranking-league-screen simple-ranking-screen">
      <nav className="ranking-tab-bar simple-ranking-tabs" aria-label="랭킹 탭">
        {tabs.map((tab) => (
          <button
            className={effectiveTab === tab.id ? 'active' : ''}
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setQuery('');
            }}
            disabled={tab.id === 'neighborhood' && !profile}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {effectiveTab !== 'country' && (
        <section className="ranking-location-card">
          <div className="ranking-location-icon">
            {isPersonal ? <UserRound size={30} /> : <MapPin size={32} />}
          </div>
          <div className="ranking-location-copy">
            <div>
              <strong>{locationTitle}</strong>
              <span>{isPersonal ? '개인 랭킹' : profile ? '인증 완료' : '인증 필요'}</span>
            </div>
            {(isPersonal || !profile) && <p className="ranking-location-status">{locationDetail}</p>}
            {isPersonal && <small className="ranking-location-note">오늘 내 운동 기록이 개인 순위에 반영돼요.</small>}
          </div>
          {!profile && !isPersonal && (
            <button className="ranking-inline-verify" type="button" onClick={handleVerify}>
              GPS로 시/도 인증하기
            </button>
          )}
        </section>
      )}

      {!isPersonal && authMessage && <p className="ranking-auth-status">{authMessage}</p>}

      <section className="ranking-period-card">
        <div className="ranking-period-filter" aria-label="기간 필터">
          {periods.map((item) => (
            <button className={period === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {effectiveTab !== 'country' && (
        <>
          <section className="ranking-score-card">
            <strong>+{displayedContribution.toLocaleString()}점</strong>
            <div className="ranking-progress-track" aria-label={`오늘 목표 ${progressPercent}%`}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="ranking-progress-caption">
              <span>오늘 목표 300점</span>
              <span>{progressPercent}%</span>
            </div>
          </section>

          <section className="ranking-rank-status-card">
            {mine ? (
              <div className="ranking-rank-content">
                <span>오늘 순위</span>
                <strong>{formatRankingHeroRank(mine.rank)}</strong>
                <p>지난 순위 대비</p>
                <b>{movementText(mine.movement)}</b>
              </div>
            ) : (
              <div className="ranking-rank-empty">
                <strong>아직 순위가 없습니다.</strong>
                <p>오늘 첫 운동을 하면<br />개인 랭킹에 등록됩니다.</p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="ranking-search-card">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={currentTab.searchLabel}
        />
      </section>

      <section className="ranking-table-card simple-ranking-table">
        <div className="simple-ranking-table-heading">
          <strong>{effectiveTab === 'country' ? '국가별 순위' : `TOP 20 ${rankTitle}`}</strong>
          <span>{rankingStatus === 'loading' ? '불러오는 중' : currentTab.searchLabel}</span>
        </div>
        {effectiveTab === 'country' ? (
          <div className="ranking-preparing-card">
            <strong>🇰🇷 국가 순위</strong>
            <span>준비중</span>
          </div>
        ) : (
          <RankingRows rows={rows} isPersonal={isPersonal} />
        )}
      </section>
    </main>
  );
}

function RankingRows({ rows, isPersonal }) {
  const firstMineIndex = rows.findIndex((entry) => entry.isMine && entry.rank > 20);
  if (rows.length === 0) {
    return (
      <div className="ranking-preparing-card">
        <strong>아직 실제 랭킹 데이터가 없습니다</strong>
        <span>운동을 완료하면 랭킹에 반영됩니다.</span>
      </div>
    );
  }

  return (
    <ol className="simple-ranking-list">
      {rows.map((entry, index) => (
        <li key={entry.id} className={entry.isMine ? 'current-user' : ''}>
          {firstMineIndex === index && <div className="ranking-separator" aria-hidden="true" />}
          <div className="simple-ranking-row-content">
            <strong>{rankBadge(entry.rank)}</strong>
            <span>{entry.isMine ? `내 ${entry.name}` : entry.name}</span>
            <b>{movementText(entry.movement)}</b>
          </div>
        </li>
      ))}
    </ol>
  );
}

async function loadRemoteRankingView({ userId, profile, period, localRanking }) {
  const periodConfig = rankingPeriodConfig(period);
  const [neighborhoodResult, personalResult] = await Promise.all([
    fetchRankingRows({
      table: periodConfig.neighborhoodView,
      dateColumn: periodConfig.dateColumn,
      dateValue: periodConfig.dateValue,
      kind: 'neighborhood',
      profile,
      userId,
    }),
    fetchRankingRows({
      table: periodConfig.personalView,
      dateColumn: periodConfig.dateColumn,
      dateValue: periodConfig.dateValue,
      kind: 'personal',
      profile,
      userId,
    }),
  ]);

  const neighborhoodEntries = neighborhoodResult.entries.length > 0
    ? neighborhoodResult.entries
    : localRanking.neighborhoodEntries;
  const personalEntries = personalResult.entries.length > 0
    ? personalResult.entries
    : localRanking.personalEntries;

  const myNeighborhood = neighborhoodEntries.find((entry) => entry.isMine);
  const myPersonal = personalEntries.find((entry) => entry.isMine);
  const contribution = Math.max(localRanking.contribution, myPersonal?.score ?? 0, myNeighborhood?.score ?? 0);

  return {
    ...localRanking,
    contribution,
    neighborhoodEntries,
    personalEntries,
    neighborhoodRival: buildRemoteRival('neighborhood', neighborhoodResult.allEntries, myNeighborhood),
    personalRival: buildRemoteRival('personal', personalResult.allEntries, myPersonal),
    neighborhoodPrediction: myNeighborhood
      ? `${myNeighborhood.name} ${myNeighborhood.rank}위 · ${myNeighborhood.score.toLocaleString()}점`
      : localRanking.neighborhoodPrediction,
    personalPrediction: myPersonal
      ? `내 순위 ${myPersonal.rank}위 · ${myPersonal.score.toLocaleString()}점`
      : localRanking.personalPrediction,
  };
}

async function fetchRankingRows({ table, dateColumn, dateValue, kind, profile, userId }) {
  const columns = kind === 'personal'
    ? `${dateColumn},user_id,masked_name,total_points,rank`
    : `${dateColumn},neighborhood_code,neighborhood_name,total_points,rank`;
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq(dateColumn, dateValue)
    .order('rank', { ascending: true })
    .limit(200);

  if (error) throw error;

  const allEntries = (data ?? [])
    .map((row) => remoteRowToEntry(row, kind, profile, userId))
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  return {
    allEntries,
    entries: topTwentyWithMine(allEntries),
  };
}

function remoteRowToEntry(row, kind, profile, userId) {
  const rank = Number(row.rank);
  const score = Number(row.total_points);
  if (!Number.isFinite(rank) || !Number.isFinite(score)) return null;

  if (kind === 'personal') {
    const id = String(row.user_id ?? '');
    return {
      id,
      rank,
      name: id === userId ? '나' : String(row.masked_name ?? '사용자'),
      score,
      movement: 0,
      isMine: id === userId,
    };
  }

  const code = String(row.neighborhood_code ?? '');
  return {
    id: code,
    rank,
    name: String(row.neighborhood_name ?? '동네'),
    score,
    movement: 0,
    isMine: Boolean(profile?.regionCode && code.toLowerCase() === profile.regionCode.toLowerCase()),
  };
}

function topTwentyWithMine(entries) {
  const topTwenty = entries.filter((entry) => entry.rank <= 20);
  const mine = entries.find((entry) => entry.isMine);
  if (mine && !topTwenty.some((entry) => entry.id === mine.id)) return [...topTwenty, mine];
  return topTwenty;
}

function buildRemoteRival(kind, entries, mine) {
  const rival = mine
    ? [...entries].reverse().find((entry) => !entry.isMine && entry.rank < mine.rank)
    : null;
  const gap = Math.max(0, (rival?.score ?? 0) - (mine?.score ?? 0));
  const subject = kind === 'personal' ? '사용자' : '동네';
  const action = kind === 'personal' ? '운동 점수' : '동네 점수';
  return {
    title: `바로 위 ${subject}`,
    name: rival?.name ?? '아직 비교 대상 없음',
    gapText: rival ? `차이 ${gap.toLocaleString()}점` : '실제 랭킹 데이터 대기 중',
    actionText: rival ? `${action} ${gap.toLocaleString()}점이면 역전` : '운동 기록을 저장하면 반영됩니다',
  };
}

function rankingPeriodConfig(period) {
  if (period === 'week') {
    return {
      neighborhoodView: 'neighborhood_rankings_weekly',
      personalView: 'personal_rankings_weekly',
      dateColumn: 'period_start',
      dateValue: periodStartKey('week'),
    };
  }
  if (period === 'month') {
    return {
      neighborhoodView: 'neighborhood_rankings_monthly',
      personalView: 'personal_rankings_monthly',
      dateColumn: 'period_start',
      dateValue: periodStartKey('month'),
    };
  }
  return {
    neighborhoodView: 'neighborhood_rankings_daily',
    personalView: 'personal_rankings_daily',
    dateColumn: 'contributed_on',
    dateValue: localDateKey(new Date()),
  };
}

function periodStartKey(period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }
  if (period === 'month') {
    start.setDate(1);
  }
  return localDateKey(start);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function rankBadge(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

function formatRankingHeroRank(rank) {
  if (!rank) return '-';
  return `#${rank}`;
}
