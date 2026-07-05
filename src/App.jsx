import { useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Flag, History, Home, Settings, Trophy } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage.tsx';
import RunPage from './pages/RunPage';
import SquatPage from './pages/SquatPage';
import JumpingJackPage from './pages/JumpingJackPage';
import PushupPage from './pages/PushupPage';
import LungePage from './pages/LungePage';
import ResultPage from './pages/ResultPage';
import RankingPage from './pages/RankingPage';
import MyPage from './pages/MyPage';
import HistoryPage from './pages/HistoryPage';
import ChallengePage from './pages/ChallengePage';
import appIcon from './assets/icon_si.png';
import { supabase } from './lib/supabaseClient';
import { ghostDifficultyTargetKm, readGhostDifficulty } from './lib/ghostSettings';
import { clearTestSession, readTestSession, TEST_ACCOUNT } from './lib/testAuth';
import { readLocalRuns, saveLocalRun } from './lib/localRuns';
import { readExerciseRecords } from './lib/exerciseRecords';
import { calculateEndureRating } from './lib/endureRanking';

const bottomRoutes = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'challenge', label: '챌린지', icon: Flag },
  { id: 'ranking', label: '랭킹', icon: Trophy },
  { id: 'history', label: '내 기록', icon: History },
  { id: 'my', label: '마이', icon: Settings },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [targetDistanceKm, setTargetDistanceKm] = useState(10);
  const [latestResult, setLatestResult] = useState(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let subscription;

    CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith('com.stickwithit.endure://auth/callback')) return;

      const params = readAuthCallbackParams(url);
      const code = params.get('code');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        if (data.session) {
          clearTestSession();
          setSession(data.session);
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (data.session) {
          clearTestSession();
          setSession(data.session);
        }
      }
    }).then((listener) => {
      subscription = listener;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const user = session?.user ?? null;
  const isTestUser = user?.app_metadata?.provider === 'local-test';
  const fullScreenExercisePages = ['run', 'squat', 'jumping-jack', 'push-up', 'lunge'];
  const userNavigator = useMemo(() => buildUserNavigator(user), [latestResult, page, user]);
  const avatarImageUrl =
    userNavigator?.avatarUrl && failedAvatarUrl !== userNavigator.avatarUrl ? userNavigator.avatarUrl : null;

  useEffect(() => {
    setFailedAvatarUrl(null);
  }, [userNavigator?.avatarUrl]);

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
    if (page === 'my') return '설정';
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
      {!fullScreenExercisePages.includes(page) && !['home', 'my', 'challenge', 'ranking', 'history'].includes(page) && (
        <header className="topbar fitness-topbar">
          <button className="ghost-button" type="button" onClick={() => setPage('home')}>
            {pageTitle}
          </button>
          <button className="ghost-button" type="button" onClick={handleSignOut}>
            로그아웃
          </button>
        </header>
      )}

      {!fullScreenExercisePages.includes(page) && userNavigator && (
        <button className="app-user-navigator" type="button" onClick={() => setPage('my')} aria-label="내 정보">
          <span className="app-user-xp">
            <small>내 ER</small>
            <strong>{userNavigator.xp.toLocaleString()}</strong>
          </span>
          <span className="app-user-avatar" aria-hidden="true">
            <span className="app-user-avatar-initial">{userNavigator.initial}</span>
            {avatarImageUrl && <img src={avatarImageUrl} alt="" onError={() => setFailedAvatarUrl(avatarImageUrl)} />}
          </span>
        </button>
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
          onLungeStart={() => setPage('lunge')}
          onRanking={() => setPage('ranking')}
          onNavigate={setPage}
        />
      )}
      {page === 'squat' && <SquatPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'jumping-jack' && <JumpingJackPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'push-up' && <PushupPage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'lunge' && <LungePage userId={user.id} onBack={() => setPage('home')} onComplete={() => setPage('home')} />}
      {page === 'run' && (
        <RunPage
          user={user}
          targetDistanceKm={targetDistanceKm}
          onTargetChange={setTargetDistanceKm}
          onCancel={() => setPage('home')}
          onComplete={(result) => {
            const savedRun = result?.run ? saveLocalRun(user.id, result.run) : null;
            setLatestResult(savedRun ? { ...result, run: savedRun } : result);
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
      {page === 'history' && <HistoryPage user={user} onStart={() => setPage('challenge')} onRanking={() => setPage('ranking')} />}
      {page === 'my' && <MyPage user={user} onSignOut={handleSignOut} onDifficultyTargetChange={setTargetDistanceKm} />}
      {page === 'challenge' && (
        <ChallengePage
          user={user}
          onHistory={() => setPage('history')}
          onStartExercise={(type) => {
            if (type === 'running') setTargetDistanceKm(0.8);
            setPage(type);
          }}
        />
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

function readAuthCallbackParams(url) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);
  const hash = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

function buildUserNavigator(user) {
  if (!user?.id) return null;

  const displayName = user.user_metadata?.nickname
    ?? user.user_metadata?.name
    ?? user.user_metadata?.full_name
    ?? user.email?.split('@')[0]
    ?? 'U';
  const runs = readLocalRuns(user.id);
  const exerciseRecords = readExerciseRecords(user.id);
  const rating = calculateEndureRating({
    userId: user.id,
    displayName,
    runs,
    exerciseRecords,
  });

  return {
    xp: rating.totalEr,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    initial: String(displayName).trim().slice(0, 1).toUpperCase() || 'U',
  };
}
