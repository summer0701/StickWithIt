import { RunningPlugin } from '../plugins/runningPlugin';
import { getExerciseDurationSeconds } from '../lib/exerciseDurationSettings';
import { readLungeBaseReps, updateLungeGhostBaseline } from '../lib/lungeGhosts';
import { saveExerciseRecord } from '../lib/exerciseRecords';
import lungeNeon from '../assets/lunge-neon.png';
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
      targetLabel="좌우 반복"
      guide="런지를 좌우 번갈아 수행하세요. 허리를 곧게 유지하고, 앞무릎은 발끝을 넘지 않게 천천히 자세를 유지하며 올라옵니다."
      ghostCaption="2분 기준 좌우 반복 횟수로 고스트가 만들어집니다."
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
