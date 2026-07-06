# Google Play Release Checklist

App: 끝까지 버텨라
Package name: com.stickwithit.endure
Current Android version: versionCode 1, versionName 1.0
SDK: minSdk 24, compileSdk 36, targetSdk 36

## Build

- [ ] Run `npm run cap:sync` before the Android release build.
- [ ] Build an Android App Bundle with Android Studio or Gradle: `cd android && .\gradlew bundleRelease`.
- [ ] Confirm output exists: `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Enroll in Play App Signing in Play Console.
- [ ] Upload the signed `.aab` to an internal testing track first.
- [ ] Confirm native library alignment if needed: `cd android && .\gradlew checkReleaseBundleElfAlignment`.

## Store Listing

- [ ] App name: `끝까지 버텨라`
- [ ] Short description: use `doc/google-play-store-listing.md`.
- [ ] Full description: use `doc/google-play-store-listing.md`.
- [ ] App icon: verify current launcher icon is final.
- [ ] Feature graphic: prepare 1024 x 500 image.
- [ ] Phone screenshots: prepare at least 2 screenshots.
- [ ] Category: Health & Fitness.
- [ ] Contact email: TODO.
- [ ] Privacy policy URL: TODO, publish `doc/google-play-privacy-policy.md` as a web page and use that URL.

## App Content

- [ ] Complete Privacy Policy section with the published privacy policy URL.
- [ ] Complete Data Safety using `doc/google-play-data-safety.md`.
- [ ] Complete App Access. If no special reviewer login is required, mark all features available without special access.
- [ ] Complete Ads section. Current app does not show ads.
- [ ] Complete Content Rating questionnaire.
- [ ] Complete Target Audience and Content section.
- [ ] Complete News Apps section as not a news app.
- [ ] Complete Government Apps section as not a government app.
- [ ] Complete Financial Features section as no financial features.
- [ ] Complete Health Apps declaration carefully because the app records exercise and fitness activity.

## Permissions To Explain

Declared in `android/app/src/main/AndroidManifest.xml`:

- `INTERNET`: Supabase auth, profile, ranking, password reset, account deletion, and cloud sync.
- `CAMERA`: pose detection for squat, jumping jack, push-up, and lunge workouts.
- `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`: neighborhood verification and running location tracking.
- `ACCESS_BACKGROUND_LOCATION`: running tracking can continue while the app is not foregrounded.
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`: active running session tracking.
- `POST_NOTIFICATIONS`: foreground running session notification.
- `WAKE_LOCK`: keep running/pose sessions stable while active.
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: prevent active running tracking from being stopped by aggressive battery optimization.

## Before Production

- [ ] Test sign-up, login, password reset, account deletion.
- [ ] Test avatar upload and profile display.
- [ ] Test GPS neighborhood verification.
- [ ] Test running foreground service and notification.
- [ ] Test squat, jumping jack, push-up, and lunge camera flow.
- [ ] Test ranking display for neighborhood and personal tabs.
- [ ] Confirm app does not crash on Android 15 or newer.
- [ ] Confirm privacy policy URL is public and accessible without login.
