import {
  Activity,
  AlertTriangle,
  BarChart3,
  Dumbbell,
  Edit3,
  Footprints,
  Ghost,
  ImagePlus,
  LogOut,
  RotateCcw,
  Upload,
  X,
  Settings,
  SlidersHorizontal,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
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
import {
  exerciseGhostDisplayName,
  normalizeExerciseGhostSettings,
  readExerciseGhostDifficulty,
  readExerciseGhostSettings,
  writeExerciseGhostDifficulty,
  writeExerciseGhostSettings,
  type ExerciseGhostSetting,
  type ExerciseGhostType,
} from '../lib/exerciseGhostSettings';
import { readGhostResetAt, resetGhostHistory } from '../lib/ghostReset';
import {
  formatExerciseDuration,
  getExerciseDurationSeconds,
  setExerciseDurationSeconds,
  type ExerciseDurationType,
} from '../lib/exerciseDurationSettings';
import { deleteCurrentAccount } from '../lib/accountDeletion';
import { AVATAR_BUCKET, buildAvatarStoragePath, compressAvatarImage, type AvatarCrop, validateAvatarImageFile } from '../lib/avatarImages';
import { readExerciseRecords, type ExerciseRecord } from '../lib/exerciseRecords';
import { readLocalRuns } from '../lib/localRuns';
import { loadRecentRunHistory } from '../services/runComparison';
import { buildGhostRunners } from '../services/ruleBasedCoach';
import { supabase } from '../lib/supabaseClient';
import ghostMascot from '../assets/ghost-settings-mascot.webp';
import { AppCard, GlassContainer, ListTile, SecondaryButton, SectionHeader } from '../components/designSystem';

type MyPageProps = {
  user: { id: string; email?: string; app_metadata?: { provider?: string }; user_metadata?: Record<string, any> };
  onSignOut?: () => void;
  onAccountDeleted?: (message?: string) => void;
  onAvatarUpdated?: (user: unknown) => void;
  onDifficultyTargetChange?: (targetDistanceKm: number) => void;
};

type ExerciseId = 'running' | ExerciseGhostType;
type PageGhostSetting = (GhostSetting | ExerciseGhostSetting) & { averageValue?: number | null };

type ExerciseConfig = {
  id: ExerciseId;
  label: string;
  heroLabel: string;
  metricLabel: string;
  summaryMetricLabel: string;
  graphTitle: string;
  unit: string;
  recordBasis: string;
  recordType?: string;
  metricKind: 'speed' | 'reps' | 'seconds';
  difficultyTargets: Record<Exclude<GhostDifficulty, 'custom'>, number>;
  customUnit: string;
  durationType?: ExerciseDurationType;
  icon: typeof Activity;
};

const ghostAccents = ['green', 'purple', 'blue', 'orange', 'gray'];
const difficultyOptions: Array<{ value: GhostDifficulty; label: string }> = [
  { value: 'beginner', label: '입문' },
  { value: 'novice', label: '초급' },
  { value: 'standard', label: '표준' },
  { value: 'custom', label: '커스텀' },
];
const DEFAULT_AVATAR_CROP: Required<AvatarCrop> = { xPercent: 50, yPercent: 50, zoom: 1 };

const exercises: ExerciseConfig[] = [
  {
    id: 'running',
    label: '러닝',
    heroLabel: '러닝',
    metricLabel: '평균 속도',
    summaryMetricLabel: '평균 속도',
    graphTitle: '1분 평균속도 그래프',
    unit: 'km/h',
    recordBasis: '평균 속도 km/h',
    metricKind: 'speed',
    difficultyTargets: { beginner: 2, novice: 3, standard: 5 },
    customUnit: 'km',
    icon: Activity,
  },
  {
    id: 'squat',
    label: '스쿼트',
    heroLabel: '스쿼트',
    metricLabel: '평균 횟수',
    summaryMetricLabel: '평균 횟수',
    graphTitle: '분당 반복 횟수 그래프',
    unit: 'reps/min',
    recordBasis: '분당 반복 횟수',
    recordType: 'squat',
    metricKind: 'reps',
    difficultyTargets: { beginner: 30, novice: 60, standard: 100 },
    customUnit: 'reps',
    durationType: 'squat',
    icon: Dumbbell,
  },
  {
    id: 'jumpingJack',
    label: '점핑잭',
    heroLabel: '점핑잭',
    metricLabel: '평균 횟수',
    summaryMetricLabel: '평균 횟수',
    graphTitle: '분당 반복 횟수 그래프',
    unit: 'reps/min',
    recordBasis: '분당 반복 횟수',
    recordType: 'jumping-jack',
    metricKind: 'reps',
    difficultyTargets: { beginner: 40, novice: 80, standard: 120 },
    customUnit: 'reps',
    durationType: 'jumpingJack',
    icon: Zap,
  },
  {
    id: 'pushup',
    label: '푸쉬업',
    heroLabel: '푸쉬업',
    metricLabel: '평균 횟수',
    summaryMetricLabel: '평균 횟수',
    graphTitle: '분당 반복 횟수 그래프',
    unit: 'reps/min',
    recordBasis: '분당 반복 횟수',
    recordType: 'push-up',
    metricKind: 'reps',
    difficultyTargets: { beginner: 20, novice: 40, standard: 70 },
    customUnit: 'reps',
    durationType: 'pushup',
    icon: Dumbbell,
  },
  {
    id: 'lunge',
    label: '런지',
    heroLabel: '런지',
    metricLabel: '평균 횟수',
    summaryMetricLabel: '평균 횟수',
    graphTitle: '분당 반복 횟수 그래프',
    unit: 'reps/min',
    recordBasis: '분당 반복 횟수',
    recordType: 'lunge',
    metricKind: 'reps',
    difficultyTargets: { beginner: 30, novice: 60, standard: 100 },
    customUnit: 'reps',
    icon: Footprints,
  },
];

export default function MyPage({ user, onSignOut, onAccountDeleted, onAvatarUpdated, onDifficultyTargetChange }: MyPageProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId>('running');
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0];
  const [settings, setSettings] = useState<PageGhostSetting[]>(() => readSettingsForExercise(user.id, selectedExerciseId));
  const [difficulty, setDifficulty] = useState<GhostDifficultySetting>(() => readDifficultyForExercise(user.id, selectedExerciseId));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ghostResetAt, setGhostResetAt] = useState<string | null>(() => readGhostResetAt(user.id));
  const [ghostRunners, setGhostRunners] = useState<any[]>([]);
  const [ghostSyncStatus, setGhostSyncStatus] = useState<'loading' | 'synced' | 'empty'>('loading');
  const [recordPeriod, setRecordPeriod] = useState('30');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeletionMessage, setAccountDeletionMessage] = useState('');
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [avatarUploadMessage, setAvatarUploadMessage] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarCrop, setAvatarCrop] = useState<Required<AvatarCrop>>(DEFAULT_AVATAR_CROP);
  const selectedGhost = settings[selectedIndex] ?? settings[0];
  const selectedRunner = ghostRunners.find((runner) => runner.key === selectedGhost?.key);
  const records = useMemo(() => readExerciseRecords(user.id, selectedExercise.recordType ? [selectedExercise.recordType] : undefined), [selectedExercise.recordType, user.id]);
  const localRuns = useMemo(() => readLocalRuns(user.id), [user.id]);
  const stats = useMemo(
    () => buildExerciseStats(selectedExercise, records, localRuns, ghostRunners, recordPeriod),
    [ghostRunners, localRuns, recordPeriod, records, selectedExercise],
  );
  const selectedMetric = metricForGhost(selectedExercise, selectedGhost, selectedRunner, stats.average);
  const difficultyLabel = `${difficultyOptions.find((option) => option.value === difficulty.difficulty)?.label ?? '입문'} (${formatDifficultyTarget(selectedExercise, difficulty)})`;
  const graphPoints = useMemo(
    () => buildMetricGraphPoints(selectedMetric, selectedExercise.metricKind, `${selectedExercise.id}:${selectedGhost?.key ?? 'ghost'}`),
    [selectedExercise.id, selectedExercise.metricKind, selectedGhost?.key, selectedMetric],
  );

  useEffect(() => {
    setSettings(readSettingsForExercise(user.id, selectedExerciseId));
    setDifficulty(readDifficultyForExercise(user.id, selectedExerciseId));
    setSelectedIndex(0);
  }, [selectedExerciseId, user.id]);

  useEffect(() => {
    let active = true;

    if (selectedExerciseId !== 'running') {
      setGhostRunners([]);
      setGhostSyncStatus(records.length > 0 ? 'synced' : 'empty');
      return undefined;
    }

    const targetKm = ghostDifficultyTargetKm(difficulty);
    setGhostSyncStatus('loading');

    loadRecentRunHistory(user.id, 10, targetKm)
      .then(({ recentRuns, recentCheckpoints }) => {
        if (!active) return;
        const runners = buildGhostRunners(recentRuns, recentCheckpoints, new Date(), settings as GhostSetting[], targetKm, difficulty);
        setGhostRunners(runners);
        setGhostSyncStatus(recentRuns.length > 0 ? 'synced' : 'empty');
      })
      .catch((error) => {
        console.debug('[MyPage] Failed to sync ghost runners.', error);
        if (!active) return;
        setGhostRunners(buildGhostRunners([], [], new Date(), settings as GhostSetting[], targetKm, difficulty));
        setGhostSyncStatus('empty');
      });

    return () => {
      active = false;
    };
  }, [difficulty, records.length, selectedExerciseId, settings, user.id]);

  useEffect(() => (
    () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    }
  ), [avatarPreviewUrl]);

  function updateSetting(index: number, nextValue: Partial<PageGhostSetting>) {
    setSettings((current) => {
      if (selectedExerciseId === 'running') {
        const next = normalizeGhostSettings(current.map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...nextValue } : item
        )));
        return writeGhostSettings(user.id, next);
      }

      const next = normalizeExerciseGhostSettings(current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...nextValue } : item
      )));
      return writeExerciseGhostSettings(user.id, selectedExerciseId, next);
    });
  }

  function resetSettings() {
    if (selectedExerciseId === 'running') {
      const next = writeGhostSettings(user.id, defaultGhostSettings());
      const nextDifficulty = writeGhostDifficulty(user.id, { difficulty: 'beginner', customDistanceKm: 2 });
      setSettings(next);
      setDifficulty(nextDifficulty);
      onDifficultyTargetChange?.(ghostDifficultyTargetKm(nextDifficulty));
    } else {
      const next = writeExerciseGhostSettings(user.id, selectedExerciseId, normalizeExerciseGhostSettings([]));
      const nextDifficulty = writeExerciseGhostDifficulty(user.id, selectedExerciseId, { difficulty: 'beginner', customDistanceKm: selectedExercise.difficultyTargets.beginner });
      setSettings(next);
      setDifficulty(nextDifficulty);
    }
    setSelectedIndex(0);
  }

  function updateDifficulty(nextValue: Partial<GhostDifficultySetting>) {
    setDifficulty((current) => {
      const next = { ...current, ...nextValue };
      if (selectedExerciseId === 'running') {
        const saved = writeGhostDifficulty(user.id, next);
        onDifficultyTargetChange?.(ghostDifficultyTargetKm(saved));
        return saved;
      }
      return writeExerciseGhostDifficulty(user.id, selectedExerciseId, next);
    });
  }

  function resetGhostData() {
    setGhostResetAt(resetGhostHistory(user.id));
  }

  async function handleDeleteAccount() {
    if (deletingAccount) return;

    const confirmed = window.confirm('정말 회원탈퇴하시겠습니까? 계정과 운동 기록이 삭제되며 되돌릴 수 없습니다.');
    if (!confirmed) return;

    setDeletingAccount(true);
    setAccountDeletionMessage('');

    try {
      const response = await deleteCurrentAccount(supabase);
      onAccountDeleted?.(response.message ?? '회원탈퇴가 완료되었습니다.');
    } catch (error) {
      setAccountDeletionMessage(error instanceof Error ? error.message : '회원탈퇴 처리에 실패했습니다.');
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    const validation = validateAvatarImageFile(file);
    if (!validation.ok || !file) {
      setAvatarUploadStatus('error');
      setAvatarUploadMessage(validation.message ?? '업로드할 이미지를 선택해 주세요.');
      return;
    }

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setAvatarCrop(DEFAULT_AVATAR_CROP);
    setAvatarUploadStatus('idle');
    setAvatarUploadMessage('업로드할 영역을 선택해 주세요.');
  }

  function cancelAvatarCrop() {
    clearSelectedAvatarFile();
    setAvatarUploadStatus('idle');
    setAvatarUploadMessage('');
  }

  function clearSelectedAvatarFile() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl('');
    setAvatarCrop(DEFAULT_AVATAR_CROP);
  }

  async function uploadSelectedAvatarCrop() {
    if (!selectedAvatarFile) return;

    setAvatarUploadStatus('uploading');
    setAvatarUploadMessage('선택한 영역을 압축하고 업로드하는 중입니다.');

    try {
      const compressedAvatar = await compressAvatarImage(selectedAvatarFile, { crop: avatarCrop });
      const avatarPath = buildAvatarStoragePath(user.id, new Date(), compressedAvatar.type);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(avatarPath, compressedAvatar, {
          contentType: compressedAvatar.type || 'image/webp',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
      const avatarUrl = publicUrlData.publicUrl;
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      if (authError) throw authError;

      await supabase.from('profiles').upsert({
        id: user.id,
        nickname: getUserProfileName(user),
        avatar_url: avatarUrl,
      });

      if (authData.user) onAvatarUpdated?.(authData.user);
      setAvatarUploadStatus('uploaded');
      setAvatarUploadMessage(`선택 영역 업로드 완료 (${formatBytes(selectedAvatarFile.size)} -> ${formatBytes(compressedAvatar.size)})`);
      clearSelectedAvatarFile();
    } catch (error) {
      setAvatarUploadStatus('error');
      setAvatarUploadMessage(avatarUploadErrorMessage(error));
    }
  }

  return (
    <GlassContainer as="main" className="my-page">
      <header className="my-page-header">
        <div>
          <h1>설정</h1>
        </div>
        <SecondaryButton className="my-logout-button" onClick={onSignOut}>
          <LogOut size={19} />
          로그아웃
        </SecondaryButton>
      </header>

      <AppCard className="my-hero-card">
        <div className="my-hero-copy">
          <span><Ghost size={22} /> 설정</span>
          <h2>고스트 런</h2>
          <p>내 운동 기록과 고스트 설정을 관리합니다.</p>
        </div>
        <img src={ghostMascot} alt="" className="my-ghost-mascot" />
        <SecondaryButton className="my-hero-settings" aria-label="설정">
          <Settings size={25} />
        </SecondaryButton>
      </AppCard>

      <AppCard className="avatar-upload-panel" aria-label="아바타 이미지 업로드">
        <SectionHeader
          className="summary-title"
          icon={<ImagePlus size={21} />}
          title="아바타 이미지"
          action={(
            <label className={`avatar-upload-button ${avatarUploadStatus === 'uploading' ? 'disabled' : ''}`}>
              <ImagePlus size={18} />
              {avatarUploadStatus === 'uploading' ? '업로드 중...' : '이미지 선택'}
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={avatarUploadStatus === 'uploading'}
                onChange={handleAvatarFileChange}
                type="file"
              />
            </label>
          )}
        />
        <div className="avatar-upload-body">
          <span className="avatar-upload-preview" aria-hidden="true">
            <span>{getUserProfileName(user).slice(0, 1).toUpperCase() || 'U'}</span>
            {user.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" />}
          </span>
          <div>
            <strong>{getUserProfileName(user)}</strong>
            <p>잠시만요. 사진을 준비하고 있습니다.</p>
            {avatarUploadMessage && <small className={`avatar-upload-message ${avatarUploadStatus}`}>{avatarUploadMessage}</small>}
          </div>
        </div>
        {selectedAvatarFile && avatarPreviewUrl && (
          <div className="avatar-crop-editor" aria-label="아바타 업로드 영역 선택">
            <div
              className="avatar-crop-frame"
              style={{
                '--avatar-crop-x': `${avatarCrop.xPercent}%`,
                '--avatar-crop-y': `${avatarCrop.yPercent}%`,
                '--avatar-crop-zoom': avatarCrop.zoom,
              } as CSSProperties}
            >
              <img src={avatarPreviewUrl} alt="" />
            </div>
            <div className="avatar-crop-controls">
              <label>
                가로 위치
                <input
                  max="100"
                  min="0"
                  type="range"
                  value={avatarCrop.xPercent}
                  onChange={(event) => setAvatarCrop((current) => ({ ...current, xPercent: Number(event.target.value) }))}
                />
              </label>
              <label>
                세로 위치
                <input
                  max="100"
                  min="0"
                  type="range"
                  value={avatarCrop.yPercent}
                  onChange={(event) => setAvatarCrop((current) => ({ ...current, yPercent: Number(event.target.value) }))}
                />
              </label>
              <label>
                확대
                <input
                  max="3"
                  min="1"
                  step="0.05"
                  type="range"
                  value={avatarCrop.zoom}
                  onChange={(event) => setAvatarCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
                />
              </label>
            </div>
            <div className="avatar-crop-actions">
              <SecondaryButton onClick={cancelAvatarCrop}>
                <X size={17} />
                취소
              </SecondaryButton>
              <SecondaryButton disabled={avatarUploadStatus === 'uploading'} onClick={uploadSelectedAvatarCrop}>
                <Upload size={17} />
                {avatarUploadStatus === 'uploading' ? '업로드 중...' : '선택 영역 업로드'}
              </SecondaryButton>
            </div>
          </div>
        )}
      </AppCard>

      <AppCard className="my-exercise-selector" aria-label="운동 선택">
        <SectionHeader
          className="my-exercise-selector-title"
          title="운동 선택"
          action={<span>{selectedExercise.heroLabel} 고스트 설정 중</span>}
        />
        <nav className="exercise-ghost-tabs" aria-label="운동별 고스트 설정">
          {exercises.map((exercise) => {
            const Icon = exercise.icon;
            return (
              <button
                className={selectedExercise.id === exercise.id ? 'active' : ''}
                key={exercise.id}
                type="button"
                onClick={() => setSelectedExerciseId(exercise.id)}
              >
                <Icon size={26} />
                <span>{exercise.label}</span>
              </button>
            );
          })}
        </nav>
      </AppCard>

      <section className="my-settings-grid">
        <AppCard className="ghost-settings-panel compact-panel" aria-label={`${selectedExercise.heroLabel} 난이도`}>
          <SectionHeader
            className="ghost-settings-heading"
            icon={<Ghost size={21} />}
            title={`${selectedExercise.heroLabel} 운동 난이도`}
          />
          <p className="ghost-settings-description">사용자의 기록에 맞는 난이도를 설정하세요.</p>

          <div className="ghost-difficulty-control" aria-label={`${selectedExercise.heroLabel} 난이도 선택`}>
            {difficultyOptions.map((option) => (
              <button
                className={difficulty.difficulty === option.value ? 'active' : ''}
                key={option.value}
                type="button"
                onClick={() => updateDifficulty({ difficulty: option.value })}
              >
                <strong>{option.label}</strong>
                <span>{formatDifficultyOption(selectedExercise, option.value, difficulty)}</span>
              </button>
            ))}
          </div>

          {difficulty.difficulty === 'custom' && (
            <label className="ghost-custom-distance">
              커스텀 기준
              <div className="speed-input-shell">
                <Target size={28} aria-hidden="true" />
                <input
                  inputMode="decimal"
                  min="0.1"
                  max="100"
                  step="0.1"
                  type="number"
                  value={difficulty.customDistanceKm}
                  onChange={(event) => updateDifficulty({ customDistanceKm: Number(event.target.value) })}
                />
                <small>{selectedExercise.customUnit}</small>
              </div>
            </label>
          )}
        </AppCard>

        <AppCard className="ghost-settings-summary current-summary" aria-label="현재 설정 요약">
          <SectionHeader className="summary-title" icon={<Target size={21} />} title="현재 설정 요약" />
          <SummaryRow label="선택 운동" value={selectedExercise.heroLabel} />
          <SummaryRow label="운동 난이도" value={difficultyLabel} />
          <SummaryRow label="선택 고스트" value={displayNameForGhost(selectedGhost, settings, selectedExerciseId)} />
          <SummaryRow label={selectedExercise.summaryMetricLabel} value={formatMetric(selectedMetric, selectedExercise)} />
          <SummaryRow label="기록 기준" value={stats.recordBasis} />
          <SecondaryButton className="ghost-data-reset-button" onClick={resetGhostData}>
            <RotateCcw size={17} />
            고스트 초기화
          </SecondaryButton>
          {ghostResetAt && <small>초기화 이후 새 운동 기록부터 고스트가 다시 만들어집니다.</small>}
        </AppCard>
      </section>

      <AppCard className="ghost-settings-panel ghost-management-panel" aria-label={`${selectedExercise.heroLabel} 고스트 관리`}>
        <SectionHeader
          className="ghost-settings-heading"
          icon={<Ghost size={21} />}
          title={`고스트 관리 (${selectedExercise.heroLabel})`}
          action={(
            <SecondaryButton onClick={resetSettings}>
              <SlidersHorizontal size={18} />
              초기화
            </SecondaryButton>
          )}
        />
        <p className="ghost-settings-description">5명의 고스트를 관리하고 기록 그래프를 확인하세요.</p>

        <div className="ghost-slot-tabs" aria-label="고스트 선택">
          {settings.map((ghost, index) => {
            const metric = metricForGhost(selectedExercise, ghost, ghostRunners.find((runner) => runner.key === ghost.key), stats.average);
            return (
              <button
                className={`ghost-slot-tab ${ghostAccents[index]} ${selectedIndex === index ? 'active' : ''}`}
                key={ghost.key}
                type="button"
                onClick={() => setSelectedIndex(index)}
              >
                <Ghost size={34} />
                <strong>{displayNameForGhost(ghost, settings, selectedExerciseId)}</strong>
                <span>{ghost.description}</span>
                <b>{formatMetric(metric, selectedExercise)}</b>
              </button>
            );
          })}
        </div>

        {selectedGhost && (
          <AppCard as="article" className={`ghost-setting-card expanded ${ghostAccents[selectedIndex]}`} key={`${selectedExerciseId}-${selectedGhost.key}`}>
            <div className="ghost-setting-card-title">
              <div>
                <b>{selectedGhost.defaultName}</b>
                <strong>{displayNameForGhost(selectedGhost, settings, selectedExerciseId)}</strong>
                <span>{selectedGhost.description}</span>
              </div>
              <SecondaryButton className="ghost-card-edit-button" aria-label={`${displayNameForGhost(selectedGhost, settings, selectedExerciseId)} 이름 수정`}>
                <Edit3 size={23} />
              </SecondaryButton>
            </div>

            <div className="ghost-detail-grid">
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
                동기화 {selectedExercise.metricLabel}
                <div className="speed-input-shell">
                  <Activity size={28} aria-hidden="true" />
                  <input
                    inputMode="decimal"
                    min="0.1"
                    max="999"
                    step="0.1"
                    type="number"
                    value={selectedMetric > 0 ? selectedMetric.toFixed(1) : ''}
                    placeholder={ghostSyncStatus === 'loading' ? '동기화 중' : '기록 없음'}
                    readOnly
                  />
                  <small>{selectedExercise.unit}</small>
                </div>
              </label>
            </div>

            <MetricGraph
              exercise={selectedExercise}
              metric={selectedMetric}
              points={graphPoints}
              seed={`${selectedExerciseId}-${selectedGhost.key}`}
            />
          </AppCard>
        )}

        <div className="ghost-bottom-settings">
          <AppCard className="ghost-settings-summary">
            <SectionHeader className="summary-title" icon={<BarChart3 size={20} />} title="그래프 기준" />
            <p>선택한 운동의 {selectedExercise.recordBasis} 기준으로 고스트와 경쟁합니다.</p>
            <div className="basis-toggle" aria-label="그래프 기준">
              <button className="active" type="button">내 기록 기준</button>
              <button type="button">전체 유저 평균 기준</button>
            </div>
            <label className="record-period-control">
              기록 기간
              <select value={recordPeriod} onChange={(event) => setRecordPeriod(event.target.value)}>
                <option value="7">최근 7일</option>
                <option value="30">최근 30일</option>
                <option value="90">최근 90일</option>
              </select>
            </label>
            {selectedExercise.durationType && (
              <ExerciseDurationControl
                exerciseType={selectedExercise.durationType}
                userId={user.id}
                title={`${selectedExercise.heroLabel} 목표 시간`}
              />
            )}
          </AppCard>

          <AppCard className="ghost-settings-summary">
            <SectionHeader className="summary-title" icon={<Timer size={20} />} title={`기록 통계 (최근 ${recordPeriod}일)`} />
            <SummaryRow label={selectedExercise.summaryMetricLabel} value={formatMetric(stats.average, selectedExercise)} />
            <SummaryRow label="최고 기록" value={formatMetric(stats.best, selectedExercise)} />
            <SummaryRow label="최저 기록" value={formatMetric(stats.worst, selectedExercise)} />
            <SummaryRow label="운동 횟수" value={`${stats.count} 회`} />
            <SummaryRow label={selectedExercise.id === 'running' ? '총 거리' : '총 운동량'} value={stats.totalLabel} />
          </AppCard>

          <AppCard className="account-danger-panel" aria-label="계정 관리">
            <SectionHeader className="summary-title" icon={<AlertTriangle size={20} />} title="계정 관리" />
            <p>회원탈퇴를 하면 계정과 서버에 저장된 운동 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            <SecondaryButton
              className="account-delete-button"
              disabled={deletingAccount || user.app_metadata?.provider === 'local-test'}
              onClick={handleDeleteAccount}
            >
              {deletingAccount ? '탈퇴 처리 중...' : '회원탈퇴'}
            </SecondaryButton>
            {user.app_metadata?.provider === 'local-test' && <small>테스트 계정은 실제 Supabase 계정이 아니어서 탈퇴할 수 없습니다.</small>}
            {accountDeletionMessage && <small className="account-delete-error">{accountDeletionMessage}</small>}
          </AppCard>
        </div>
      </AppCard>
    </GlassContainer>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <ListTile className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </ListTile>
  );
}

function ExerciseDurationControl({
  exerciseType,
  userId,
  title,
}: {
  exerciseType: ExerciseDurationType;
  userId?: string;
  title: string;
}) {
  const [durationSeconds, setDurationSeconds] = useState(() => getExerciseDurationSeconds(userId, exerciseType));
  const presets = [60, 120, 180, 300];

  useEffect(() => {
    setDurationSeconds(getExerciseDurationSeconds(userId, exerciseType));
  }, [exerciseType, userId]);

  function updateDuration(nextSeconds: number) {
    setDurationSeconds(setExerciseDurationSeconds(userId, exerciseType, nextSeconds));
  }

  return (
    <div className="duration-inline-settings">
      <span>{title}</span>
      <strong>{formatExerciseDuration(durationSeconds)}</strong>
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
    </div>
  );
}

function MetricGraph({
  exercise,
  metric,
  points,
  seed,
}: {
  exercise: ExerciseConfig;
  metric: number;
  points: number[];
  seed: string;
}) {
  const max = Math.max(...points, metric + 1);
  const min = Math.min(...points, Math.max(0, metric - 1));
  const spread = Math.max(1, max - min);
  const svgPoints = points
    .map((value, index) => {
      const x = 18 + index * 28;
      const y = 82 - ((value - min) / spread) * 54;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="speed-graph" aria-label={exercise.graphTitle}>
      <div>
        <span>{exercise.graphTitle}</span>
        <strong>{formatMetric(metric, exercise)}</strong>
      </div>
      <svg viewBox="0 0 288 100" role="img" aria-label={`${exercise.graphTitle} 점 그래프`}>
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

function readSettingsForExercise(userId: string, exerciseId: ExerciseId): PageGhostSetting[] {
  if (exerciseId === 'running') return readGhostSettings(userId);
  return readExerciseGhostSettings(userId, exerciseId);
}

function readDifficultyForExercise(userId: string, exerciseId: ExerciseId) {
  if (exerciseId === 'running') return readGhostDifficulty(userId);
  return readExerciseGhostDifficulty(userId, exerciseId);
}

function displayNameForGhost(ghost: PageGhostSetting | undefined, settings: PageGhostSetting[], exerciseId: ExerciseId) {
  if (!ghost) return 'G1';
  if (exerciseId === 'running') return ghostDisplayName(ghost.key, settings as GhostSetting[]);
  return exerciseGhostDisplayName(ghost.key, settings as ExerciseGhostSetting[]);
}

function formatDifficultyOption(exercise: ExerciseConfig, difficulty: GhostDifficulty, setting: GhostDifficultySetting) {
  if (difficulty === 'custom') return '직접 설정';
  return formatTarget(exercise.difficultyTargets[difficulty], exercise.customUnit);
}

function formatDifficultyTarget(exercise: ExerciseConfig, setting: GhostDifficultySetting) {
  if (exercise.id === 'running') return `${ghostDifficultyTargetKm(setting).toFixed(1)} km`;
  const value = setting.difficulty === 'custom' ? setting.customDistanceKm : exercise.difficultyTargets[setting.difficulty];
  return formatTarget(value, exercise.customUnit);
}

function formatTarget(value: number, unit: string) {
  const rounded = Number(value.toFixed(unit === 'km' ? 1 : 0));
  return `${rounded} ${unit}`;
}

function metricForGhost(exercise: ExerciseConfig, ghost: PageGhostSetting | undefined, runner: any, fallbackAverage: number) {
  if (exercise.id === 'running') {
    return runnerSpeedKmh(runner) ?? (ghost as GhostSetting | undefined)?.averageSpeedKmh ?? fallbackAverage;
  }
  return (ghost as ExerciseGhostSetting | undefined)?.averageValue ?? fallbackAverage;
}

function formatMetric(value: number, exercise: ExerciseConfig) {
  if (!Number.isFinite(value) || value <= 0) return `0 ${exercise.unit}`;
  const fractionDigits = exercise.metricKind === 'seconds' ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${exercise.unit}`;
}

function buildExerciseStats(
  exercise: ExerciseConfig,
  records: ExerciseRecord[],
  localRuns: any[],
  runners: any[],
  periodDays: string,
) {
  if (exercise.id === 'running') {
    const speeds = [
      ...runners.map((runner) => runnerSpeedKmh(runner)).filter((value): value is number => value != null),
      ...localRuns.map(runSpeedKmh).filter((value): value is number => value != null),
    ];
    const distances = localRuns.map(runDistanceKm).filter((value) => value > 0);
    return buildStatsFromValues({
      values: speeds,
      fallback: 5.8,
      count: Math.max(localRuns.length, runners.length),
      totalLabel: `${sum(distances).toFixed(1)} km`,
      recordBasis: speeds.length > 0 ? '내 기록 기준' : '기본 고스트 기준',
    });
  }

  const filteredRecords = filterRecordsByPeriod(records, Number(periodDays));
  const values = filteredRecords.map((record) => exerciseRecordMetric(record, exercise)).filter((value) => value > 0);
  const fallback = exercise.difficultyTargets.beginner;
  const total = exercise.metricKind === 'seconds'
    ? sum(filteredRecords.map((record) => Number(record.goodSeconds ?? record.durationSeconds ?? 0)))
    : sum(filteredRecords.map((record) => Number(record.reps ?? 0)));

  return buildStatsFromValues({
    values,
    fallback,
    count: filteredRecords.length,
    totalLabel: exercise.metricKind === 'seconds' ? `${Math.round(total)} sec` : `${Math.round(total)} reps`,
    recordBasis: filteredRecords.length > 0 ? '내 기록 기준' : '기본 고스트 기준',
  });
}

function buildStatsFromValues({
  values,
  fallback,
  count,
  totalLabel,
  recordBasis,
}: {
  values: number[];
  fallback: number;
  count: number;
  totalLabel: string;
  recordBasis: string;
}) {
  const average = values.length > 0 ? sum(values) / values.length : fallback;
  return {
    average: Number(average.toFixed(1)),
    best: Number(Math.max(...values, average).toFixed(1)),
    worst: Number(Math.min(...values, average).toFixed(1)),
    count,
    totalLabel,
    recordBasis,
  };
}

function exerciseRecordMetric(record: ExerciseRecord, exercise: ExerciseConfig) {
  if (exercise.metricKind === 'seconds') return Number(record.goodSeconds ?? record.durationSeconds ?? 0);

  const reps = Number(record.reps ?? 0);
  const durationMinutes = Math.max(1 / 60, Number(record.durationSeconds ?? 60) / 60);
  return reps > 0 ? Number((reps / durationMinutes).toFixed(1)) : 0;
}

function filterRecordsByPeriod(records: ExerciseRecord[], periodDays: number) {
  const cutoff = Date.now() - Math.max(1, periodDays) * 24 * 60 * 60 * 1000;
  return records.filter((record) => new Date(record.completedAt ?? 0).getTime() >= cutoff);
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

function runSpeedKmh(run: any) {
  const distanceKm = runDistanceKm(run);
  const elapsedSeconds = Number(run?.total_elapsed_seconds ?? run?.duration_seconds);
  if (distanceKm <= 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;
  return Number((distanceKm / (elapsedSeconds / 3600)).toFixed(1));
}

function runDistanceKm(run: any) {
  const meters = Number(run?.total_distance_meters);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const km = Number(run?.actual_distance_km ?? run?.distanceKm);
  return Number.isFinite(km) && km > 0 ? km : 0;
}

function buildMetricGraphPoints(metric: number, kind: ExerciseConfig['metricKind'], seed: string) {
  let state = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 97);
  const fallback = kind === 'speed' ? 5.8 : kind === 'seconds' ? 30 : 20;
  const base = Math.max(0.1, Number(metric) || fallback);
  return Array.from({ length: 10 }, (_, index) => {
    state = (state * 1103515245 + 12345) % 2147483647;
    const wave = Math.sin(index * 0.82 + state / 100000000) * base * 0.06;
    const jitter = ((state % 1000) / 1000 - 0.5) * base * 0.08;
    return Number(Math.max(0.1, base + wave + jitter).toFixed(2));
  });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getUserProfileName(user: MyPageProps['user']) {
  return user.user_metadata?.nickname
    ?? user.user_metadata?.name
    ?? user.user_metadata?.full_name
    ?? user.email?.split('@')[0]
    ?? '러너';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function avatarUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/bucket not found/i.test(message)) {
    return '아바타 저장소가 아직 생성되지 않았습니다. Supabase DB push 후 다시 시도해 주세요.';
  }
  return message || '아바타 업로드에 실패했습니다.';
}
