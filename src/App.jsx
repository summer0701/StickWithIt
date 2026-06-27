import { useEffect, useMemo, useState } from 'react';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import RunPage from './pages/RunPage';
import ResultPage from './pages/ResultPage';
import RankingPage from './pages/RankingPage';
import { supabase } from './lib/supabaseClient';

const routes = ['home', 'run', 'result', 'ranking'];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [targetDistanceKm, setTargetDistanceKm] = useState(3);
  const [latestResult, setLatestResult] = useState(null);

  useEffect(() => {
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
  const canShowShell = Boolean(user);

  useEffect(() => {
    if (!user) return;

    supabase.from('profiles').upsert({
      id: user.id,
      nickname: user.email?.split('@')[0] ?? '러너',
    });
  }, [user]);

  const pageTitle = useMemo(() => {
    if (page === 'run') return '러닝';
    if (page === 'result') return '결과';
    if (page === 'ranking') return '랭킹';
    return '끝까지 버텨라';
  }, [page]);

  if (loading) {
    return <main className="screen center">불러오는 중...</main>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      {canShowShell && page !== 'run' && (
        <header className="topbar">
          <button className="ghost-button" type="button" onClick={() => setPage('home')}>
            {pageTitle}
          </button>
          <button className="ghost-button" type="button" onClick={() => supabase.auth.signOut()}>
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

      {page !== 'run' && (
        <nav className="bottom-nav">
          {routes
            .filter((route) => route !== 'run' && route !== 'result')
            .map((route) => (
              <button key={route} className={page === route ? 'active' : ''} onClick={() => setPage(route)} type="button">
                {route === 'home' ? '홈' : '랭킹'}
              </button>
            ))}
        </nav>
      )}
    </div>
  );
}
