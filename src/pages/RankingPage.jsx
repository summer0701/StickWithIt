import { MapPin, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppCard, EmptyState, GlassContainer, GradientButton, ProgressCard } from '../components/designSystem';
import { readExerciseRecords } from '../lib/exerciseRecords';
import { LOCATION_PERMISSION_MESSAGE, LocationPermissionError, requestCurrentPosition } from '../lib/locationPermission';
import {
  buildRankingView,
  neighborhoodProfileFromRow,
  neighborhoodProfileToRow,
  readNeighborhoodProfile,
  resolveNeighborhoodFromGps,
  saveNeighborhoodProfile,
} from '../lib/neighborhoodRanking';
import { supabase } from '../lib/supabaseClient';

const tabs = [
  { id: 'country', label: '국가별', searchLabel: '국가명 검색' },
  { id: 'neighborhood', label: '동네별', searchLabel: '동네명 검색' },
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
  const [errorDialog, setErrorDialog] = useState('');
  const [remoteRanking, setRemoteRanking] = useState(null);
  const [rankingStatus, setRankingStatus] = useState('local');
  const records = useMemo(() => readExerciseRecords(user?.id ?? 'anonymous'), [user?.id]);
  const localRanking = useMemo(() => buildRankingView(profile, records, period), [period, profile, records]);
  const ranking = remoteRanking ?? localRanking;
  const effectiveTab = activeTab;
  const currentTab = tabs.find((tab) => tab.id === effectiveTab) ?? tabs[1];
  const userNickname = displayNickname(user);

  useEffect(() => {
    const userId = user?.id ?? 'anonymous';
    setProfile(readNeighborhoodProfile(userId));
    if (!user?.id || user?.app_metadata?.provider === 'local-test') return;

    let active = true;
    supabase
      .from('profiles')
        .select('neighborhood_name,neighborhood_code,district_name,district_code,region_name,region_code,neighborhood_lat,neighborhood_lng,neighborhood_verified_at')
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
    setErrorDialog('');
    let step = '위치 권한 확인';
    try {
      setAuthMessage('위치 권한 확인 중');
      const position = await requestCurrentPosition();

      step = '동네 조회';
      setAuthMessage('현재 위치로 동네 조회 중');
      const nextProfile = await resolveNeighborhoodFromGps(position.coords.latitude, position.coords.longitude);

      step = '기기 저장';
      const saved = saveNeighborhoodProfile(user?.id ?? 'anonymous', nextProfile);

      if (user?.id && user?.app_metadata?.provider !== 'local-test') {
        step = '서버 프로필 저장';
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          nickname: user.email?.split('@')[0] ?? '러너',
          ...neighborhoodProfileToRow(saved),
        });
        if (profileError) throw profileError;
      }
      setProfile(saved);
      setAuthMessage(`${saved.neighborhoodName} 인증 완료`);
    } catch (error) {
      const message = gpsAuthErrorMessage(error, step);
      setAuthMessage(message);
      setErrorDialog(message);
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
  const visibleMine = rows.find((entry) => entry.isMine);
  const displayedContribution = visibleMine?.score ?? mine?.score ?? 0;
  const scopeName = isPersonal ? '나' : profile?.regionName ?? '동네 미인증';
  const neighborhoodName = profile?.neighborhoodName ?? '동네 미인증';
  const locationTitle = isPersonal ? scopeName : neighborhoodName;
  const locationDetail = isPersonal
    ? '개인 기록 기준'
    : 'GPS 인증 후 현재 동네가 표시됩니다';
  const rankTitle = isPersonal ? '개인 순위' : '동네 순위';
  const progressPercent = Math.min(100, Math.round((displayedContribution / 300) * 100));

  return (
    <GlassContainer as="main" className="ranking-league-screen simple-ranking-screen">
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
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <AppCard className="ranking-search-card">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={currentTab.searchLabel}
        />
      </AppCard>

      <AppCard className="ranking-period-card">
        <div className="ranking-period-filter" aria-label="기간 필터">
          {periods.map((item) => (
            <button className={period === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </AppCard>

      {effectiveTab !== 'country' && (
        <AppCard className={`ranking-location-card ${!profile && !isPersonal ? 'gps-verify-card' : ''}`}>
          {!profile && !isPersonal ? (
            <GradientButton className="ranking-inline-verify" onClick={handleVerify}>
              GPS로 동네 인증하기
            </GradientButton>
          ) : (
            <>
              <div className="ranking-location-icon">
                {isPersonal ? <UserRound size={30} /> : <MapPin size={32} />}
              </div>
              <div className="ranking-location-copy">
                <div>
                  <strong>{locationTitle}</strong>
                  <span>{isPersonal ? '개인 랭킹' : '인증 완료'}</span>
                </div>
                {!isPersonal && profile && <p className="ranking-location-status">{profile.districtName}</p>}
                {isPersonal && <p className="ranking-location-status">{locationDetail}</p>}
              </div>
            </>
          )}
        </AppCard>
      )}

      {!isPersonal && authMessage && <p className="ranking-auth-status">{authMessage}</p>}

      {effectiveTab !== 'country' && (
        <ProgressCard
          className="ranking-score-card"
          value={`${displayedContribution.toLocaleString()} XP`}
          percent={progressPercent}
          caption={(
            <div className="ranking-progress-caption">
            <span>오늘 목표 300 XP</span>
            <span>{progressPercent}%</span>
            </div>
          )}
        />
      )}

      <AppCard className="ranking-table-card simple-ranking-table">
        <div className="simple-ranking-table-heading">
          <strong>{effectiveTab === 'country' ? '국가별 순위' : `TOP 20 ${rankTitle}`}</strong>
          <span>{rankingStatus === 'loading' ? '불러오는 중' : currentTab.searchLabel}</span>
        </div>
        <div className="ranking-table-body">
          {effectiveTab === 'country' ? (
            <div className="ranking-preparing-card">
              <strong>🇰🇷 국가 순위</strong>
              <span>준비중</span>
            </div>
          ) : (
            <RankingRows rows={rows} isPersonal={isPersonal} userNickname={userNickname} />
          )}
        </div>
      </AppCard>

      {errorDialog && (
        <div className="ranking-error-dialog-backdrop" role="presentation">
          <section className="ranking-error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ranking-error-title">
            <strong id="ranking-error-title">동네 인증 오류</strong>
            <p>{errorDialog}</p>
            <button type="button" onClick={() => setErrorDialog('')}>
              확인
            </button>
          </section>
        </div>
      )}
    </GlassContainer>
  );
}

function displayNickname(user) {
  const metadata = user?.user_metadata ?? {};
  const nickname = metadata.nickname ?? metadata.name ?? metadata.full_name;
  if (typeof nickname === 'string' && nickname.trim()) return nickname.trim();
  const emailName = user?.email?.split('@')?.[0];
  if (emailName) return emailName;
  return '러너';
}

function RankingRows({ rows, isPersonal, userNickname }) {
  const firstMineIndex = rows.findIndex((entry) => entry.isMine && entry.rank > 20);
  if (rows.length === 0) {
    return (
      <EmptyState
        className="ranking-empty-state"
        title="아직 순위가 없습니다."
        body="운동을 완료하면 순위가 반영됩니다."
      />
    );
  }

  return (
    <ol className="simple-ranking-list">
      {rows.map((entry, index) => (
        <li key={entry.id} className={`${entry.isMine ? 'current-user' : ''} ${entry.isMine && isPersonal ? 'personal-current-user' : ''}`}>
          {firstMineIndex === index && <div className="ranking-separator" aria-hidden="true" />}
          <div className="simple-ranking-row-content">
            <strong>{rankBadge(entry.rank)}</strong>
            {entry.isMine && isPersonal && <span className="personal-ranking-name">{`나 (${userNickname})`}</span>}
            <span>{entry.isMine ? `내 ${entry.name}` : entry.name}</span>
            <div className="simple-ranking-row-meta">
              <b>{entry.score.toLocaleString()} XP</b>
              <small>{entry.rank}위</small>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function gpsAuthErrorMessage(error, fallbackStep) {
  const failedStep = error instanceof LocationPermissionError
    ? locationPermissionStepLabel(error.step)
    : fallbackStep;
  const reason = error instanceof Error && error.message
    ? error.message
    : '알 수 없는 오류가 발생했어요.';
  const guide = reason === LOCATION_PERMISSION_MESSAGE
    ? '앱 또는 브라우저 위치 권한을 허용한 뒤 다시 시도해 주세요.'
    : '잠시 후 다시 시도해 주세요. 같은 단계에서 반복되면 네트워크와 GPS 상태를 확인해 주세요.';

  return `걸린 단계: ${failedStep}\n원인: ${reason}\n다음 조치: ${guide}`;
}

function locationPermissionStepLabel(step) {
  if (step === 'check-permission') return '위치 권한 상태 확인';
  if (step === 'request-permission') return '위치 권한 요청';
  if (step === 'get-position') return '현재 위치 가져오기';
  return '위치 확인';
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
    isMine: Boolean(profile?.neighborhoodCode && code.toLowerCase() === profile.neighborhoodCode.toLowerCase()),
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
