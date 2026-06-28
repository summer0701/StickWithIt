import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Dumbbell, History, Home, Trophy, User } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage.tsx';
import RunPage from './pages/RunPage';
import ResultPage from './pages/ResultPage';
import RankingPage from './pages/RankingPage';
import { supabase } from './lib/supabaseClient';
import { clearTestSession, readTestSession } from './lib/testAuth';

const bottomRoutes = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'challenge', label: 'Challenge', icon: Dumbbell },
  { id: 'history', label: 'History', icon: History },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'my', label: 'My', icon: User },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [targetDistanceKm, setTargetDistanceKm] = useState(10);
  const [latestResult, setLatestResult] = useState(null);

  useEffect(() => {
    const testSession = readTestSession();
    if (testSession) {
      setSession(testSession);
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const isTestUser = user?.app_metadata?.provider === 'local-test';

  useEffect(() => {
    if (!user || isTestUser) return;

    supabase.from('profiles').upsert({
      id: user.id,
      nickname: user.email?.split('@')[0] ?? '러너',
    });
  }, [isTestUser, user]);

  function handleSignOut() {
    clearTestSession();
    supabase.auth.signOut();
    setSession(null);
  }

  const pageTitle = useMemo(() => {
    if (page === 'ranking') return '오늘의 랭킹';
    if (page === 'challenge') return '철인 5종 챌린지';
    if (page === 'history') return '기록';
    if (page === 'my') return '마이페이지';
    if (page === 'result') return '결과';
    return '끝까지 버텨라';
  }, [page]);

  if (loading) {
    return <main className="screen center">불러오는 중...</main>;
  }

  if (!user) {
    return <LoginPage onTestLogin={setSession} />;
  }

  return (
    <div className="app-shell fitness-shell">
      {page !== 'run' && page !== 'home' && (
        <header className="topbar fitness-topbar">
          <button className="ghost-button" type="button" onClick={() => setPage('home')}>
            {pageTitle}
          </button>
          <button className="ghost-button" type="button" onClick={handleSignOut}>
            로그아웃
          </button>
        </header>
      )}

      {page === 'home' && (
        <HomePage
          user={user}
          targetDistanceKm={targetDistanceKm}
          onTargetChange={setTargetDistanceKm}
          onStart={() => setPage('run')}
          onRanking={() => setPage('ranking')}
          onNavigate={setPage}
        />
      )}
      {page === 'run' && (
        <RunPage
          user={user}
          targetDistanceKm={targetDistanceKm}
          onCancel={() => setPage('home')}
          onComplete={(result) => {
            setLatestResult(result);
            setPage('result');
          }}
        />
      )}
      {page === 'result' && (
        <ResultPage
          user={user}
          result={latestResult}
          onHome={() => setPage('home')}
          onRanking={() => setPage('ranking')}
        />
      )}
      {page === 'ranking' && <RankingPage onBack={() => setPage('home')} />}
      {['challenge', 'history', 'my'].includes(page) && (
        <PlaceholderPage title={pageTitle} onHome={() => setPage('home')} />
      )}

      {page !== 'run' && (
        <nav className="bottom-nav fitness-bottom-nav" aria-label="하단 내비게이션">
          {bottomRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <button
                key={route.id}
                className={page === route.id ? 'active' : ''}
                onClick={() => setPage(route.id)}
                type="button"
              >
                <Icon size={22} />
                <span>{route.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function PlaceholderPage({ title, onHome }) {
  return (
    <main className="screen premium-placeholder">
      <section className="glass-panel">
        <BarChart3 size={32} />
        <p>곧 열릴 화면</p>
        <h1>{title}</h1>
        <button className="premium-button" type="button" onClick={onHome}>
          홈으로 돌아가기
        </button>
      </section>
    </main>
  );
}
