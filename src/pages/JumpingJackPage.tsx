import { RunningPlugin } from '../plugins/runningPlugin';
import { getExerciseDurationSeconds } from '../lib/exerciseDurationSettings';
import { readJumpingJackBaseAverageReps, updateJumpingJackGhostBaseline } from '../lib/jumpingJackGhosts';
import { saveExerciseRecord } from '../lib/exerciseRecords';
import jumpingJackNeon from '../assets/jumping-jack-neon.webp';
import NativeExercisePage from './NativeExercisePage';

type ExercisePageProps = {
  onBack: () => void;
  onComplete?: () => void;
  userId?: string;
};

export default function JumpingJackPage({ onBack, onComplete = onBack, userId = 'anonymous' }: ExercisePageProps) {
  return (
    <NativeExercisePage
      userId={userId}
      title="점핑잭"
      targetLabel="횟수 목표"
      guide="전신이 화면에 보이게 서고, 팔은 머리 위까지 올리고 다리는 어깨보다 넓게 벌려 주세요."
      ghostCaption="2분 기준 점핑잭 기록으로 고스트가 만들어집니다."
      screenClassName="jumping-jack-ready-screen"
      poseImageSrc={jumpingJackNeon}
      durationSeconds={getExerciseDurationSeconds(userId, 'jumpingJack')}
      baseAverageValue={readJumpingJackBaseAverageReps(userId)}
      completionEventName="jumpingJackFinished"
      onOpenNative={({ durationSeconds, baseAverageValue }) =>
        RunningPlugin.openJumpingJackPose({ durationSeconds, baseAverageReps: baseAverageValue })}
      onCompleted={(payload) => {
        saveExerciseRecord({ userId, type: 'jumping-jack', completed: true, durationSeconds: payload.durationSeconds, reps: payload.reps });
        updateJumpingJackGhostBaseline(userId, payload);
      }}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
