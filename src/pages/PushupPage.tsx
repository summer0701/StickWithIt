import { RunningPlugin } from '../plugins/runningPlugin';
import { getExerciseDurationSeconds } from '../lib/exerciseDurationSettings';
import { readPushupBaseAverageReps, updatePushupGhostBaseline } from '../lib/pushupGhosts';
import { saveExerciseRecord } from '../lib/exerciseRecords';
import { saveLastNeighborhoodContribution } from '../lib/neighborhoodRanking';
import { syncNeighborhoodContribution } from '../lib/neighborhoodContributionSync';
import pushupNeon from '../assets/pushup-neon.webp';
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
      screenClassName="pushup-ready-screen"
      poseImageSrc={pushupNeon}
      durationSeconds={getExerciseDurationSeconds(userId, 'pushup')}
      baseAverageValue={readPushupBaseAverageReps(userId)}
      countdownStartSeconds={0}
      countdownLaunchMessage="스마트폰을 가로로 눞혀주세요"
      completionEventName="pushupFinished"
      onOpenNative={({ durationSeconds, baseAverageValue }) =>
        RunningPlugin.openPushupPose({ durationSeconds, baseAverageReps: baseAverageValue })}
      onCompleted={(payload) => {
        const record = saveExerciseRecord({ userId, type: 'push-up', completed: true, durationSeconds: payload.durationSeconds, reps: payload.reps });
        saveLastNeighborhoodContribution(userId, record);
        void syncNeighborhoodContribution({ userId, record });
        updatePushupGhostBaseline(userId, payload);
      }}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
