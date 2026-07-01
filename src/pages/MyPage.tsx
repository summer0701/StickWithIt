import { Activity, Edit3, Ghost, LogOut, RotateCcw, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  defaultGhostSettings,
  ghostDifficultyTargetKm,
  ghostDisplayName,
  normalizeGhostSettings,
  readGhostDifficulty,
  readGhostSettings,
  writeGhostDifficulty,
  writeGhostSettings,
  type GhostDifficulty,
  type GhostDifficultySetting,
  type GhostSetting,
} from '../lib/ghostSettings';
import { readGhostResetAt, resetGhostHistory } from '../lib/ghostReset';
import {
  formatExerciseDuration,
  getExerciseDurationSeconds,
  setExerciseDurationSeconds,
  type ExerciseDurationType,
} from '../lib/exerciseDurationSettings';
import { loadRecentRunHistory } from '../services/runComparison';
import { buildGhostRunners } from '../services/ruleBasedCoach';
import ghostMascot from '../assets/ghost-settings-mascot.webp';

type MyPageProps = {
  user: { id: string; email?: string };
  onSignOut?: () => void;
  onDifficultyTargetChange?: (targetDistanceKm: number) => void;
};

const ghostAccents = ['green', 'purple', 'blue', 'orange', 'gray'];
const difficultyOptions: Array<{ value: GhostDifficulty; label: string; distanceLabel: string }> = [
  { value: 'beginner', label: '입문', distanceLabel: '2.0 km' },
  { value: 'novice', label: '초급', distanceLabel: '3.0 km' },
  { value: 'standard', label: '표준', distanceLabel: '5.0 km' },
  { value: 'custom', label: '커스텀', distanceLabel: '직접 지정' },
];

export default function MyPage({ user, onSignOut, onDifficultyTargetChange }: MyPageProps) {
  const [settings, setSettings] = useState<GhostSetting[]>(() => readGhostSettings(user.id));
  const [difficulty, setDifficulty] = useState<GhostDifficultySetting>(() => readGhostDifficulty(user.id));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ghostResetAt, setGhostResetAt] = useState<string | null>(() => readGhostResetAt(user.id));
  const [ghostRunners, setGhostRunners] = useState<any[]>([]);
  const [ghostSyncStatus, setGhostSyncStatus] = useState<'loading' | 'synced' | 'empty'>('loading');
  const selectedGhost = settings[selectedIndex] ?? settings[0];
  const selectedRunner = ghostRunners.find((runner) => runner.key === selectedGhost?.key);
  const selectedSpeedKmh = runnerSpeedKmh(selectedRunner) ?? selectedGhost?.averageSpeedKmh ?? null;
  const preview = useMemo(() => settings.map((item) => ghostDisplayName(item.key, settings)).join(' · '), [settings]);
  const targetDistanceLabel = `${ghostDifficultyTargetKm(difficulty).toFixed(1)} km`;

  useEffect(() => {
    let active = true;
    const targetKm = ghostDifficultyTargetKm(difficulty);
    setGhostSyncStatus('loading');

    loadRecentRunHistory(user.id, 10, targetKm)
      .then(({ recentRuns, recentCheckpoints }) => {
        if (!active) return;
        const runners = buildGhostRunners(recentRuns, recentCheckpoints, new Date(), settings, targetKm, difficulty);
        setGhostRunners(runners);
        setGhostSyncStatus(recentRuns.length > 0 ? 'synced' : 'empty');
      })
      .catch((error) => {
        console.debug('[MyPage] Failed to sync ghost runners.', error);
        if (!active) return;
        setGhostRunners(buildGhostRunners([], [], new Date(), settings, targetKm, difficulty));
        setGhostSyncStatus('empty');
      });

    return () => {
      active = false;
    };
  }, [difficulty, settings, user.id]);

  function updateSetting(index: number, nextValue: Partial<GhostSetting>) {
    setSettings((current) => {
      const next = normalizeGhostSettings(current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...nextValue } : item
      )));
      return writeGhostSettings(user.id, next);
    });
  }

  function resetSettings() {
    const next = writeGhostSettings(user.id, defaultGhostSettings());
    const nextDifficulty = writeGhostDifficulty(user.id, { difficulty: 'beginner', customDistanceKm: 2 });
    setSettings(next);
    setDifficulty(nextDifficulty);
    onDifficultyTargetChange?.(ghostDifficultyTargetKm(nextDifficulty));
    setSelectedIndex(0);
  }

  function updateDifficulty(nextValue: Partial<GhostDifficultySetting>) {
    setDifficulty((current) => {
      const next = writeGhostDifficulty(user.id, { ...current, ...nextValue });
      onDifficultyTargetChange?.(ghostDifficultyTargetKm(next));
      return next;
    });
  }

  function resetGhostData() {
    setGhostResetAt(resetGhostHistory(user.id));
  }

  return (
    <main className="my-page">
      <header className="my-page-header">
        <div>
          <span>SKT&nbsp;&nbsp;6:57</span>
          <h1>마이페이지</h1>
        </div>
        <button className="my-logout-button" type="button" onClick={onSignOut}>
          <LogOut size={19} />
          로그아웃
        </button>
      </header>

      <section className="my-hero-card">
        <div className="my-hero-copy">
          <span><Ghost size={22} /> 마이페이지</span>
          <h2>고스트 런 설정</h2>
          <p>{user.email ?? '러너'}님의 러닝 기록과 고스트를 동기화합니다.</p>
        </div>
        <img src={ghostMascot} alt="" className="my-ghost-mascot" />
        <button className="my-hero-settings" type="button" aria-label="설정">
          <Settings size={25} />
        </button>
      </section>

      <section className="ghost-settings-panel" aria-label="고스트 설정">
        <div className="ghost-settings-heading">
          <div>
            <span><Ghost size={21} /> 고스트 난이도</span>
            <p>처음 설치한 사용자는 입문 2km로 시작합니다.</p>
          </div>
          <button type="button" onClick={resetSettings}>
            <RotateCcw size={18} />
            초기화
          </button>
        </div>

        <div className="ghost-difficulty-control" aria-label="고스트 난이도 선택">
          {difficultyOptions.map((option) => (
            <button
              className={difficulty.difficulty === option.value ? 'active' : ''}
              key={option.value}
              type="button"
              onClick={() => updateDifficulty({ difficulty: option.value })}
            >
              <strong>{option.label}</strong>
              <span>{option.distanceLabel}</span>
            </button>
          ))}
        </div>

        {difficulty.difficulty === 'custom' && (
          <label className="ghost-custom-distance">
            커스텀 거리
            <div className="speed-input-shell">
              <Activity size={28} aria-hidden="true" />
              <input
                inputMode="decimal"
                min="0.1"
                max="100"
                step="0.1"
                type="number"
                value={difficulty.customDistanceKm}
                onChange={(event) => updateDifficulty({ customDistanceKm: Number(event.target.value) })}
              />
              <small>km</small>
            </div>
          </label>
        )}

        <div className="ghost-settings-heading compact">
          <div>
            <span><Ghost size={21} /> 고스트 슬롯</span>
            <p>이름이 비어 있으면 G1, G2, G3, G4, G5로 표시됩니다.</p>
          </div>
        </div>

        <div className="ghost-slot-tabs" aria-label="고스트 선택">
          {settings.map((ghost, index) => (
            <button
              className={`ghost-slot-tab ${ghostAccents[index]} ${selectedIndex === index ? 'active' : ''}`}
              key={ghost.key}
              type="button"
              onClick={() => setSelectedIndex(index)}
            >
              <Ghost size={34} />
              <strong>{ghostDisplayName(ghost.key, settings)}</strong>
            </button>
          ))}
        </div>

        <div className="ghost-settings-list">
          {selectedGhost && (
            <article className={`ghost-setting-card expanded ${ghostAccents[selectedIndex]}`} key={selectedGhost.key}>
              <div className="ghost-setting-card-title">
                <div>
                  <b>{selectedGhost.defaultName}</b>
                  <strong>{ghostDisplayName(selectedGhost.key, settings)}</strong>
                  <span>{selectedGhost.description}</span>
                </div>
                <button type="button" aria-label={`${ghostDisplayName(selectedGhost.key, settings)} 이름 수정`}>
                  <Edit3 size={23} />
                </button>
              </div>

              <label>
                이름
                <input
                  maxLength={16}
                  type="text"
                  value={selectedGhost.name}
                  placeholder={selectedGhost.defaultName}
                  onChange={(event) => updateSetting(selectedIndex, { name: event.target.value })}
                />
              </label>

              <label>
                동기화 평균속도
                <div className="speed-input-shell">
                  <Activity size={28} aria-hidden="true" />
                  <input
                    inputMode="decimal"
                    min="1"
                    max="30"
                    step="0.1"
                    type="number"
                    value={selectedSpeedKmh == null ? '' : selectedSpeedKmh.toFixed(1)}
                    placeholder={ghostSyncStatus === 'loading' ? '동기화 중' : '기록 없음'}
                    readOnly
                  />
                  <small>km/h</small>
                </div>
              </label>

              <SpeedGraph speedKmh={selectedSpeedKmh ?? 0} seed={selectedGhost.key} />
            </article>
          )}
        </div>
      </section>

      <ExerciseDurationCard
        title="스쿼트 목표 시간"
        exerciseType="squat"
        userId={user.id}
        presets={[60, 120, 180, 300]}
        description="스쿼트 운동 시간을 설정합니다."
      />

      <ExerciseDurationCard
        title="점핑잭 목표 시간"
        exerciseType="jumpingJack"
        userId={user.id}
        presets={[60, 120, 180, 300]}
        description="점핑잭 운동 시간을 설정합니다."
      />

      <ExerciseDurationCard
        title="푸쉬업 목표 시간"
        exerciseType="pushup"
        userId={user.id}
        presets={[60, 120, 180, 300]}
        description="푸쉬업 운동 시간을 설정합니다."
      />

      <ExerciseDurationCard
        title="플랭크 목표 시간"
        exerciseType="plank"
        userId={user.id}
        presets={[30, 60, 120, 180]}
        description="플랭크 운동 시간을 설정합니다."
      />

      <section className="ghost-settings-summary">
        <span>현재 난이도 · 목표 거리</span>
        <strong>{difficultyOptions.find((option) => option.value === difficulty.difficulty)?.label ?? '입문'} · {targetDistanceLabel}</strong>
        <span>현재 표시 이름</span>
        <strong>{preview}</strong>
        <span>고스트 동기화</span>
        <strong>{ghostSyncStatus === 'synced' ? '내 기록 기준' : ghostSyncStatus === 'loading' ? '동기화 중' : '기본 고스트 기준'}</strong>
        <button className="ghost-data-reset-button" type="button" onClick={resetGhostData}>
          고스트 초기화
        </button>
        {ghostResetAt && <small>초기화 이후 새 러닝부터 고스트가 다시 만들어집니다.</small>}
      </section>
    </main>
  );
}

function ExerciseDurationCard({
  title,
  exerciseType,
  userId,
  presets,
  description,
}: {
  title: string;
  exerciseType: ExerciseDurationType;
  userId?: string;
  presets: number[];
  description: string;
}) {
  const [durationSeconds, setDurationSeconds] = useState(() => getExerciseDurationSeconds(userId, exerciseType));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDurationSeconds(getExerciseDurationSeconds(userId, exerciseType));
  }, [exerciseType, userId]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(false), 1400);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function updateDuration(nextSeconds: number) {
    setDurationSeconds(setExerciseDurationSeconds(userId, exerciseType, nextSeconds));
    setSaved(true);
  }

  return (
    <section className="ghost-settings-summary squat-duration-settings" aria-label={title}>
      <span>{title}</span>
      <strong>{formatExerciseDuration(durationSeconds)}</strong>
      <small>{description}</small>
      <div className="squat-duration-presets" aria-label={`${title} 빠른 선택`}>
        {presets.map((seconds) => (
          <button
            className={durationSeconds === seconds ? 'active' : ''}
            key={seconds}
            type="button"
            onClick={() => updateDuration(seconds)}
          >
            {formatExerciseDuration(seconds)}
          </button>
        ))}
      </div>
      <label>
        커스텀 설정
        <div className="speed-input-shell">
          <Activity size={28} aria-hidden="true" />
          <input
            inputMode="decimal"
            min="0.5"
            max="10"
            step="0.5"
            type="number"
            value={Number((durationSeconds / 60).toFixed(1))}
            onChange={(event) => updateDuration(Number(event.target.value) * 60)}
          />
          <small>분</small>
        </div>
      </label>
      {saved && <small>저장 완료</small>}
    </section>
  );
}

function SpeedGraph({ speedKmh, seed }: { speedKmh: number; seed: string }) {
  const points = useMemo(() => buildMinuteSpeedPoints(speedKmh, seed), [speedKmh, seed]);
  const max = Math.max(...points, speedKmh + 1);
  const min = Math.min(...points, Math.max(0, speedKmh - 1));
  const spread = Math.max(1, max - min);
  const svgPoints = points
    .map((value, index) => {
      const x = 18 + index * 28;
      const y = 82 - ((value - min) / spread) * 54;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="speed-graph" aria-label="1분 단위 평균속도 그래프">
      <div>
        <span>1분 평균속도 그래프</span>
        <strong>{speedKmh.toFixed(1)} km/h</strong>
      </div>
      <svg viewBox="0 0 288 100" role="img" aria-label="1분마다 생성된 평균속도 점 그래프">
        <polyline points={svgPoints} />
        {points.map((value, index) => {
          const x = 18 + index * 28;
          const y = 82 - ((value - min) / spread) * 54;
          return <circle key={`${seed}-${index}`} cx={x} cy={y} r="3.8" />;
        })}
      </svg>
      <div className="speed-graph-minutes">
        {points.map((_, index) => <span key={index}>{index + 1}</span>)}
      </div>
    </div>
  );
}

function runnerSpeedKmh(runner: any) {
  const directSpeed = Number(runner?.avgSpeedKmh ?? runner?.averageSpeedKmh);
  if (Number.isFinite(directSpeed) && directSpeed > 0) return Number(directSpeed.toFixed(1));

  const distanceMeters = Number(runner?.totalDistanceMeters);
  const elapsedSeconds = Number(runner?.totalElapsedSeconds);
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds) || distanceMeters <= 0 || elapsedSeconds <= 0) {
    return null;
  }
  return Number(((distanceMeters / 1000) / (elapsedSeconds / 3600)).toFixed(1));
}

function buildMinuteSpeedPoints(speedKmh: number, seed: string) {
  let state = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 97);
  const base = Math.max(1, Number(speedKmh) || 10.5);
  return Array.from({ length: 10 }, (_, index) => {
    state = (state * 1103515245 + 12345) % 2147483647;
    const wave = Math.sin(index * 0.82 + state / 100000000) * 0.35;
    const jitter = ((state % 1000) / 1000 - 0.5) * 0.42;
    return Math.max(1, Number((base + wave + jitter).toFixed(2)));
  });
}
