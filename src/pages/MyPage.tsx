import { Activity, Edit3, Ghost, LogOut, RotateCcw, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  defaultGhostSettings,
  ghostDisplayName,
  normalizeGhostSettings,
  readGhostSettings,
  writeGhostSettings,
  type GhostSetting,
} from '../lib/ghostSettings';
import ghostMascot from '../assets/ghost-settings-mascot.webp';

type MyPageProps = {
  user: { id: string; email?: string };
  onSignOut?: () => void;
};

const ghostAccents = ['green', 'purple', 'blue', 'orange', 'gray'];

export default function MyPage({ user, onSignOut }: MyPageProps) {
  const [settings, setSettings] = useState<GhostSetting[]>(() => readGhostSettings(user.id));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedGhost = settings[selectedIndex] ?? settings[0];
  const preview = useMemo(() => settings.map((item) => ghostDisplayName(item.key, settings)).join(' · '), [settings]);

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
    setSettings(next);
    setSelectedIndex(0);
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
            <span><Ghost size={21} /> 고스트 슬롯</span>
            <p>이름이 비어 있으면 G1, G2, G3, G4, G5로 표시됩니다.</p>
          </div>
          <button type="button" onClick={resetSettings}>
            <RotateCcw size={18} />
            초기화
          </button>
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
                    value={selectedGhost.averageSpeedKmh ?? ''}
                    placeholder="10.5"
                    onChange={(event) => updateSetting(selectedIndex, { averageSpeedKmh: event.target.value === '' ? null : Number(event.target.value) })}
                  />
                  <small>km/h</small>
                </div>
              </label>

              <SpeedGraph speedKmh={selectedGhost.averageSpeedKmh ?? 10.5} seed={selectedGhost.key} />
            </article>
          )}
        </div>
      </section>

      <section className="ghost-settings-summary">
        <span>현재 표시 이름</span>
        <strong>{preview}</strong>
      </section>
    </main>
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
