import { RunningPlugin } from '../plugins/runningPlugin';
import { getExerciseDurationSeconds } from '../lib/exerciseDurationSettings';
import { readLungeBaseReps, updateLungeGhostBaseline } from '../lib/lungeGhosts';
import { saveExerciseRecord } from '../lib/exerciseRecords';
import lungeNeon from '../assets/lunge-neon.webp';
import NativeExercisePage from './NativeExercisePage';

type ExercisePageProps = {
  onBack: () => void;
  onComplete?: () => void;
  userId?: string;
};

export default function LungePage({ onBack, onComplete = onBack, userId = 'anonymous' }: ExercisePageProps) {
  return (
    <NativeExercisePage
      userId={userId}
      title="런지"
      targetLabel="횟수 목표"
      guide="한쪽 다리를 앞으로 내리고, 앞 무릎은 90도로 굽혀 주세요. 뒷 무릎은 바닥 가까이 내렸다가 다시 일어나 반대쪽 다리로 반복합니다."
      ghostCaption="2분 기준 런지 기록으로 고스트가 만들어집니다."
      screenClassName="lunge-ready-screen"
      poseImageSrc={lungeNeon}
      durationSeconds={getExerciseDurationSeconds(userId, 'lunge')}
      baseAverageValue={readLungeBaseReps(userId)}
      completionEventName="lungeFinished"
      onOpenNative={({ durationSeconds, baseAverageValue }) =>
        RunningPlugin.openLungePose({ durationSeconds, baseAverageReps: baseAverageValue })}
      onCompleted={(payload) => {
        saveExerciseRecord({
          userId,
          type: 'lunge',
          completed: true,
          durationSeconds: payload.durationSeconds,
          reps: payload.reps,
        });
        updateLungeGhostBaseline(userId, payload);
      }}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
