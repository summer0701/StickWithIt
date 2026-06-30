export const COACH_INTERVAL_SECONDS = 45;

export function shouldPlayCoachCue(elapsedSeconds: number, lastCoachElapsedSeconds: number, force = false) {
  if (force) return true;

  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const lastCoachElapsed = Math.max(0, Number(lastCoachElapsedSeconds) || 0);
  return elapsed - lastCoachElapsed >= COACH_INTERVAL_SECONDS;
}
