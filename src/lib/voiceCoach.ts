const FIVE_HUNDRED_M = 0.5;

export function getVoiceCue({ distanceKm, targetDistanceKm, ghostDiffSeconds, lastCueDistanceKm = 0 }) {
  if (!distanceKm || distanceKm <= 0) {
    return null;
  }

  const remainingKm = Math.max(0, targetDistanceKm - distanceKm);
  const crossedCue = Math.floor(distanceKm / FIVE_HUNDRED_M) > Math.floor(lastCueDistanceKm / FIVE_HUNDRED_M);

  if (!crossedCue && remainingKm > FIVE_HUNDRED_M) {
    return null;
  }

  if (remainingKm <= FIVE_HUNDRED_M) {
    return '이제 마지막이야. 여기서 포기하지 마. 끝까지 버텨.';
  }

  if (ghostDiffSeconds != null && ghostDiffSeconds <= 0) {
    return '좋아, 어제의 너보다 앞서고 있어. 이 페이스 유지하자.';
  }

  if (ghostDiffSeconds != null && ghostDiffSeconds > 0) {
    return '괜찮아, 아직 따라잡을 수 있어. 호흡 유지하고 끝까지 버텨.';
  }

  if (Math.floor(distanceKm) > Math.floor(lastCueDistanceKm)) {
    return `${Math.floor(distanceKm)}킬로미터 통과. 지금 페이스 좋아.`;
  }

  return '조금만 버텨, 지금 페이스 좋아.';
}

export function speak(_text) {
  return false;
}
