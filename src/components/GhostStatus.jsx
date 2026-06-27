import { formatSignedSeconds } from '../lib/pace';

const ghostSourceLabel = {
  yesterday: '어제의 나',
  recent_best: '최근 7일 최고 기록',
  personal_best: '개인 최고 기록',
};

export default function GhostStatus({ ghostRun, diffSeconds }) {
  if (!ghostRun) {
    return <div className="ghost-status muted">비교할 과거 기록이 아직 없습니다.</div>;
  }

  return (
    <div className={`ghost-status ${diffSeconds <= 0 ? 'ahead' : 'behind'}`}>
      <span>{ghostSourceLabel[ghostRun.ghost_source] ?? '과거의 나'}와 경쟁 중</span>
      <strong>{formatSignedSeconds(diffSeconds)}</strong>
    </div>
  );
}
