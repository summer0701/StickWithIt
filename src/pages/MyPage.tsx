import { Activity, Edit3, Ghost, LogOut, RotateCcw, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { readSquatDurationSeconds, writeSquatDurationSeconds } from '../lib/squatSettings';
import ghostMascot from '../assets/ghost-settings-mascot.webp';

type MyPageProps = {
  user: { id: string; email?: string };
  onSignOut?: () => void;
  onDifficultyTargetChange?: (targetDistanceKm: number) => void;
};

const ghostAccents = ['green', 'purple', 'blue', 'orange', 'gray'];
const squatDurationPresets = [1, 2, 3, 5];
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
  const [squatDurationSeconds, setSquatDurationSeconds] = useState(() => readSquatDurationSeconds(user.id));
  const selectedGhost = settings[selectedIndex] ?? settings[0];
  const preview = useMemo(() => settings.map((item) => ghostDisplayName(item.key, settings)).join(' · '), [settings]);
  const targetDistanceLabel = `${ghostDifficultyTargetKm(difficulty).toFixed(1)} km`;

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

  function updateSquatDuration(minutes: number) {
    setSquatDurationSeconds(writeSquatDurationSeconds(user.id, minutes * 60));
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
          <p>{user.email ?? '러너'}님의 고스트 이름과 평균속도를 설정합니다.</p>
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
                평균속도
                <div className="speed-input-shell">
                  <Activity size={28} aria-hidden="true" />
                  <input
                    inputMode="decimal"
                    min="1"
                    max="30"
                    step="0.1"
                    type="number"
                    required
                    value={selectedGhost.averageSpeedKmh ?? 10.5}
                    placeholder="10.5"
                    onChange={(event) => {
                      if (event.target.value === '') return;
                      updateSetting(selectedIndex, { averageSpeedKmh: Number(event.target.value) });
                    }}
                  />
                  <small>km/h</small>
                </div>
              </label>

              <SpeedGraph speedKmh={selectedGhost.averageSpeedKmh ?? 10.5} seed={selectedGhost.key} />
            </article>
          )}
        </div>
      </section>

      <section className="ghost-settings-summary squat-duration-settings" aria-label="스쿼트 시간 설정">
        <span>스쿼트 목표 시간</span>
        <strong>{formatSquatDuration(squatDurationSeconds)}</strong>
        <div className="squat-duration-presets" aria-label="스쿼트 목표 시간 빠른 선택">
          {squatDurationPresets.map((minutes) => (
            <button
              className={squatDurationSeconds === minutes * 60 ? 'active' : ''}
              key={minutes}
              type="button"
              onClick={() => updateSquatDuration(minutes)}
            >
              {minutes}분
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
              value={Number((squatDurationSeconds / 60).toFixed(1))}
              onChange={(event) => updateSquatDuration(Number(event.target.value))}
            />
            <small>분</small>
          </div>
        </label>
      </section>

      <section className="ghost-settings-summary">
        <span>현재 난이도 · 목표 거리</span>
        <strong>{difficultyOptions.find((option) => option.value === difficulty.difficulty)?.label ?? '입문'} · {targetDistanceLabel}</strong>
        <span>현재 표시 이름</span>
        <strong>{preview}</strong>
        <button className="ghost-data-reset-button" type="button" onClick={resetGhostData}>
          고스트 초기화
        </button>
        {ghostResetAt && <small>초기화 이후 새 러닝부터 고스트가 다시 만들어집니다.</small>}
      </section>
    </main>
  );
}

function formatSquatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
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
