# Native TTS Running Engine

## 구조

Android Native 러닝 엔진은 WebView timer와 `speechSynthesis`에 의존하지 않는다.

```text
RunningForegroundService
 ├─ LocationTracker
 ├─ CheckpointManager
 ├─ RuleBasedCoach
 └─ NativeTtsEngine
```

React는 `RunningPlugin.startRun({ sessionId, targetDistanceMeters, useNativeTts: true })`를 호출한다. Android에서는 `RunningForegroundService`가 GPS 추적, 1분 체크포인트 저장, 룰베이스 문장 생성, Native `TextToSpeech` 발화를 담당한다.

## 화면 꺼짐 테스트 방법

1. Android Studio에서 앱을 설치한다.
2. 위치 권한, 알림 권한, 백그라운드 위치 권한을 허용한다.
3. 앱 설정에서 배터리 최적화 제외를 적용한다.
4. 앱에서 러닝을 시작한다.
5. 상태바에 “끝까지 버텨라 실행 중” 알림이 유지되는지 확인한다.
6. 전원 버튼으로 화면을 끈다.
7. 1분 이상 실제 이동하거나 GPS mock provider로 이동 좌표를 넣는다.
8. 화면이 꺼진 상태에서 “좋아, 1분 지났어...” 계열의 음성이 나오는지 확인한다.
9. 다시 앱을 열고 체크포인트가 Supabase 또는 로컬 큐에 반영되는지 확인한다.

## 실패 케이스별 대응

- 위치 권한 없음: `RunningPlugin.startRun`이 reject되고 React 권한 안내 모달에서 다시 안내한다.
- 알림 권한 없음: Android 13 이상에서는 사용자에게 알림 권한을 허용하도록 안내한다. Foreground Service 자체는 권한 상태에 따라 시스템 정책을 따른다.
- GPS accuracy 30m 초과: `LocationTracker`가 `low_accuracy`로 버리고 거리와 체크포인트에 반영하지 않는다.
- 비정상 속도: 31km/h 초과 구간은 `too_fast`로 버린다.
- TTS 초기화 지연: `NativeTtsEngine`이 문장을 큐에 넣고 초기화 완료 후 재생한다.
- 다른 앱 음악 재생 중: `AudioFocusManager`가 `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`과 `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`, `CONTENT_TYPE_SPEECH`로 충돌을 줄인다.
- 네트워크 없음: Native Room DB에 `synced = false`로 저장하고, 앱 복귀 또는 온라인 이벤트에서 JS가 Supabase 업로드 후 `markCheckpointsSynced`를 호출한다.
- 앱이 백그라운드/화면 꺼짐: `RunningForegroundService`와 partial wake lock이 GPS/TTS를 유지한다.

## React 사용 예시

```ts
import { RunningPlugin } from '../plugins/runningPlugin';

await RunningPlugin.startRun({
  sessionId,
  targetDistanceMeters,
  useNativeTts: true,
  recentAverageSpeedKmh,
  recentBestSpeedKmh,
});

await RunningPlugin.pauseRun();
await RunningPlugin.resumeRun();
await RunningPlugin.speak({ text: '1킬로미터 남았어. 지금 포기하면 어제의 너한테 진다.' });
await RunningPlugin.stopRun();
```
