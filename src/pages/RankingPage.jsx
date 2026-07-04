import { Geolocation } from '@capacitor/geolocation';
import { MapPin, Search, Trophy } from 'lucide-react';
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
  const records = useMemo(() => readExerciseRecords(user?.id ?? 'anonymous'), [user?.id]);
  const ranking = useMemo(() => buildRankingView(profile, records, period), [period, profile, records]);
  const effectiveTab = activeTab === 'neighborhood' && !profile ? 'personal' : activeTab;
  const currentTab = tabs.find((tab) => tab.id === effectiveTab) ?? tabs[1];

  useEffect(() => {
    const userId = user?.id ?? 'anonymous';
    setProfile(readNeighborhoodProfile(userId));
    if (!user?.id || user?.app_metadata?.provider === 'local-test') return;

    let active = true;
    supabase
      .from('profiles')
      .select('neighborhood_name,neighborhood_code,neighborhood_verified_at')
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

  const rival = effectiveTab === 'personal' ? ranking.personalRival : ranking.neighborhoodRival;
  const prediction = effectiveTab === 'personal' ? ranking.personalPrediction : ranking.neighborhoodPrediction;

  return (
    <main className="ranking-league-screen simple-ranking-screen">
      <header className="ranking-league-header simple-ranking-header">
        <div>
          <span>랭킹</span>
          <h1>오늘 운동하면 우리 동네가 올라갑니다.</h1>
          <p>내 운동이 우리 동네 점수에 바로 더해집니다.</p>
        </div>
        <button className="ranking-close-button" type="button" onClick={onBack}>
          닫기
        </button>
      </header>

      <section className={`neighborhood-auth-card ${profile ? 'verified' : ''}`}>
        <div>
          <MapPin size={22} />
          <strong>{profile ? `📍 ${profile.districtName} 인증됨` : '동네 인증하면 랭킹에 참여할 수 있어요'}</strong>
          <span>{profile ? '오늘 내 기여가 우리 동네 순위에 반영됨' : 'GPS 권한이 필요합니다. 수동 입력은 사용할 수 없습니다.'}</span>
        </div>
        {!profile && (
          <button type="button" onClick={handleVerify}>
            GPS로 인증하기
          </button>
        )}
        {authMessage && <p>{authMessage}</p>}
      </section>

      <section className="ranking-contribution-card">
        <Trophy size={24} />
        <div>
          <strong>오늘 내 기여 +{ranking.contribution}점</strong>
          <span>우리 동네 순위에 반영됨</span>
        </div>
      </section>

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

      <div className="ranking-period-filter" aria-label="기간 필터">
        {periods.map((item) => (
          <button className={period === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setPeriod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="ranking-search-card">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={currentTab.searchLabel}
        />
      </section>

      {effectiveTab !== 'country' && (
        <section className="ranking-rival-card">
          <span>{rival.title}</span>
          <strong>{rival.name}</strong>
          <p>{rival.gapText}</p>
          <b>{rival.actionText}</b>
        </section>
      )}

      <section className="ranking-prediction-card">
        {effectiveTab === 'country' ? '국가 순위는 준비중입니다.' : prediction}
      </section>

      <section className="ranking-table-card simple-ranking-table">
        {effectiveTab === 'country' ? (
          <div className="ranking-preparing-card">
            <strong>🇰🇷 국가 순위</strong>
            <span>준비중</span>
          </div>
        ) : (
          <RankingRows rows={rows} />
        )}
      </section>
    </main>
  );
}

function RankingRows({ rows }) {
  const firstMineIndex = rows.findIndex((entry) => entry.isMine && entry.rank > 20);
  return (
    <ol className="simple-ranking-list">
      {rows.map((entry, index) => (
        <li key={entry.id} className={entry.isMine ? 'current-user' : ''}>
          {firstMineIndex === index && <div className="ranking-separator" aria-hidden="true" />}
          <div className="simple-ranking-row-content">
            <strong>{entry.rank}위</strong>
            <span>{entry.isMine ? `내 ${entry.name}` : entry.name}</span>
            <b>{movementText(entry.movement)}</b>
          </div>
        </li>
      ))}
    </ol>
  );
}
