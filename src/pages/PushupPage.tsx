import { RunningPlugin } from '../plugins/runningPlugin';
import { readPushupDurationSeconds } from '../lib/pushupSettings';
import { readPushupBaseAverageReps, updatePushupGhostBaseline } from '../lib/pushupGhosts';
import NativeExercisePage from './NativeExercisePage';

type ExercisePageProps = {
  onBack: () => void;
  onComplete?: () => void;
  userId?: string;
};

export default function PushupPage({ onBack, onComplete = onBack, userId = 'anonymous' }: ExercisePageProps) {
  return (
    <NativeExercisePage
      userId={userId}
      title="푸쉬업"
      targetLabel="횟수 목표"
      guide="카메라는 옆모습 또는 약간 대각선 측면에 두고, 어깨부터 발목까지 한 줄로 유지해 주세요."
      ghostCaption="2분 기준 푸쉬업 기록으로 고스트가 만들어집니다."
      durationSeconds={readPushupDurationSeconds(userId)}
      baseAverageValue={readPushupBaseAverageReps(userId)}
      completionEventName="pushupFinished"
      onOpenNative={({ durationSeconds, baseAverageValue }) =>
        RunningPlugin.openPushupPose({ durationSeconds, baseAverageReps: baseAverageValue })}
      onCompleted={(payload) => updatePushupGhostBaseline(userId, payload)}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
