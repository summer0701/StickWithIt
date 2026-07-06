# Google Play Permission Notes

This file maps Android permissions to user-facing explanations for Google Play review.

Source file: `android/app/src/main/AndroidManifest.xml`

## INTERNET

Reason:

The app connects to Supabase for login, account management, profile sync, avatar storage, ranking data, password reset, and account deletion.

User-facing explanation:

인터넷 연결은 로그인, 운동 기록 동기화, 프로필, 랭킹, 비밀번호 재설정 기능을 제공하기 위해 필요합니다.

## CAMERA

Reason:

The app uses camera input for real-time pose detection in squat, jumping jack, push-up, and lunge workouts.

User-facing explanation:

카메라는 자세 인식 운동 화면에서 사용자의 운동 자세를 분석하고 피드백을 제공하기 위해 사용됩니다.

## ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION

Reason:

The app uses location for neighborhood verification and GPS running tracking.

User-facing explanation:

위치 정보는 동네 인증, 동네 랭킹 참여, 러닝 기록 측정을 위해 사용됩니다.

## ACCESS_BACKGROUND_LOCATION

Reason:

The app can continue tracking an active running session when the user leaves the app or the screen turns off.

User-facing explanation:

백그라운드 위치는 사용자가 러닝을 시작한 동안 앱이 백그라운드에 있어도 러닝 기록을 이어가기 위해 사용됩니다.

## FOREGROUND_SERVICE / FOREGROUND_SERVICE_LOCATION

Reason:

The running tracker uses a foreground service for an active running session.

User-facing explanation:

러닝 중 위치 추적이 안정적으로 계속되도록 foreground service를 사용합니다.

## POST_NOTIFICATIONS

Reason:

The app may show an active running session notification.

User-facing explanation:

러닝 세션이 진행 중임을 알리고 추적 상태를 표시하기 위해 알림 권한을 사용할 수 있습니다.

## WAKE_LOCK

Reason:

The app keeps active exercise/running sessions stable.

User-facing explanation:

운동 또는 러닝 측정 중 기록이 중단되지 않도록 기기 절전 상태의 영향을 줄이기 위해 사용됩니다.

## REQUEST_IGNORE_BATTERY_OPTIMIZATIONS

Reason:

The app may ask users to exclude it from aggressive battery optimization for reliable running tracking.

User-facing explanation:

러닝 기록이 배터리 최적화로 중단되지 않도록 사용자가 허용한 경우 배터리 최적화 예외를 요청합니다.
