import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Dumbbell, History, Home, Trophy, User } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage.tsx';
import RunPage from './pages/RunPage';
import SquatPage from './pages/SquatPage';
import JumpingJackPage from './pages/JumpingJackPage';
import PushupPage from './pages/PushupPage';
import PlankPage from './pages/PlankPage';
import ResultPage from './pages/ResultPage';
import RankingPage from './pages/RankingPage';
import MyPage from './pages/MyPage';
import appIcon from './assets/icon_si.png';
import { supabase } from './lib/supabaseClient';
import { ghostDifficultyTargetKm, readGhostDifficulty } from './lib/ghostSettings';
import { clearTestSession, readTestSession, TEST_ACCOUNT } from './lib/testAuth';

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
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        clearTestSession();
        setSession(data.session);
      } else {
        const testSession = readTestSession();
        if (testSession) {
          const response = await signInTestAccount();
          if (response.data?.session) {
            clearTestSession();
            setSession(response.data.session);
          } else {
            setSession(testSession);
          }
        } else {
          setSession(null);
        }
      }
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) clearTestSession();
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const isTestUser = user?.app_metadata?.provider === 'local-test';
  const fullScreenExercisePages = ['run', 'squat', 'jumping-jack', 'push-up', 'plank'];

  useEffect(() => {
    if (!user) return;
    setTargetDistanceKm(ghostDifficultyTargetKm(readGhostDifficulty(user.id)));
  }, [user]);

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
    return (
      <main className="app-loading" aria-label="앱 로딩">
        <img src={appIcon} alt="" />
      </main>
    );
  }

  if (!user) {
    return <LoginPage onTestLogin={setSession} />;
  }

  return (
    <div className="app-shell fitness-shell">
      {!fullScreenExercisePages.includes(page) && page !== 'home' && page !== 'my' && (
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
          onSquatStart={() => setPage('squat')}
          onJumpingJackStart={() => setPage('jumping-jack')}
          onPushupStart={() => setPage('push-up')}
          onPlankStart={() => setPage('plank')}
          onRanking={() => setPage('ranking')}
          onNavigate={setPage}
        />
      )}
      {page === 'squat' && <SquatPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'jumping-jack' && <JumpingJackPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'push-up' && <PushupPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'plank' && <PlankPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'run' && (
        <RunPage
          user={user}
          targetDistanceKm={targetDistanceKm}
          onTargetChange={setTargetDistanceKm}
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
      {page === 'ranking' && <RankingPage user={user} onBack={() => setPage('home')} />}
      {page === 'my' && <MyPage user={user} onSignOut={handleSignOut} onDifficultyTargetChange={setTargetDistanceKm} />}
      {['challenge', 'history'].includes(page) && (
        <PlaceholderPage title={pageTitle} onHome={() => setPage('home')} />
      )}

      {!fullScreenExercisePages.includes(page) && (
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

async function signInTestAccount() {
  const signIn = await supabase.auth.signInWithPassword({
    email: TEST_ACCOUNT.email,
    password: TEST_ACCOUNT.password,
  });
  if (!signIn.error) return signIn;

  return supabase.auth.signUp({
    email: TEST_ACCOUNT.email,
    password: TEST_ACCOUNT.password,
    options: { data: { nickname: TEST_ACCOUNT.login } },
  });
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
