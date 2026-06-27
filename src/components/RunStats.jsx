import { formatDuration, formatPace, secondsPerKm } from '../lib/pace';

export default function RunStats({ distanceKm, elapsedSeconds, targetDistanceKm }) {
  const remainingKm = Math.max(0, targetDistanceKm - distanceKm);
  const pace = secondsPerKm(distanceKm, elapsedSeconds);

  return (
    <section className="run-stats" aria-label="러닝 기록">
      <div className="stat stat-hero">
        <span>현재 거리</span>
        <strong>{distanceKm.toFixed(2)} km</strong>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span>경과 시간</span>
          <strong>{formatDuration(elapsedSeconds)}</strong>
        </div>
        <div className="stat">
          <span>현재 페이스</span>
          <strong>{formatPace(pace)}</strong>
        </div>
        <div className="stat">
          <span>남은 거리</span>
          <strong>{remainingKm.toFixed(2)} km</strong>
        </div>
      </div>
    </section>
  );
}
