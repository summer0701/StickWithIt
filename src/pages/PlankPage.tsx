import { RunningPlugin } from '../plugins/runningPlugin';
import { getExerciseDurationSeconds } from '../lib/exerciseDurationSettings';
import { readPlankBaseGoodSeconds, updatePlankGhostBaseline } from '../lib/plankGhosts';
import { saveExerciseRecord } from '../lib/exerciseRecords';
import NativeExercisePage from './NativeExercisePage';

type ExercisePageProps = {
  onBack: () => void;
  onComplete?: () => void;
  userId?: string;
};

export default function PlankPage({ onBack, onComplete = onBack, userId = 'anonymous' }: ExercisePageProps) {
  return (
    <NativeExercisePage
      userId={userId}
      title="플랭크"
      targetLabel="GOOD 유지"
      guide="카메라는 옆모습에 두고, 어깨-엉덩이-발목 라인이 무너지지 않게 버텨 주세요."
      ghostCaption="2분 기준 GOOD 자세 유지 시간으로 고스트가 만들어집니다."
      durationSeconds={getExerciseDurationSeconds(userId, 'plank')}
      baseAverageValue={readPlankBaseGoodSeconds(userId)}
      completionEventName="plankFinished"
      onOpenNative={({ durationSeconds, baseAverageValue }) =>
        RunningPlugin.openPlankPose({ durationSeconds, baseAverageGoodSeconds: baseAverageValue })}
      onCompleted={(payload) => {
        saveExerciseRecord({
          userId,
          type: 'plank',
          completed: true,
          durationSeconds: payload.durationSeconds,
          goodSeconds: payload.goodSeconds,
          warningSeconds: payload.warningSeconds,
          badSeconds: payload.badSeconds,
          qualityScore: payload.qualityScore,
        });
        updatePlankGhostBaseline(userId, payload);
      }}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
