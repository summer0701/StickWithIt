# Google Play Data Safety Draft

Use this as the working draft for Play Console > App content > Data safety.

This draft is based on the current app code, Supabase usage, and Android manifest. Review it before submission.

## Data Collection Summary

The app collects or processes the following user data:

- Account information: email address, user id, nickname.
- Profile information: nickname, avatar/profile image.
- Fitness activity: exercise type, reps, duration, running distance, completion time, ranking points.
- Location: approximate and precise location for neighborhood verification and running tracking.
- Photos or images: avatar image selected by the user.
- App activity: workout records, ranking contribution records, local running checkpoints.

## Data Sharing

Recommended Play Console answer:

- Data is not sold.
- Data is sent to service providers needed to operate the app, including Supabase for authentication, database, storage, and Edge Functions.
- Password reset email delivery may use an email delivery provider through Supabase Edge Functions.
- Data may be shown to other users only in limited ranking form, such as masked nickname, personal ranking score, neighborhood name, and neighborhood ranking score.

## Security Practices

Recommended Play Console answers:

- Data is encrypted in transit: Yes.
- Users can request data deletion: Yes.
- Account deletion is available in the app.
- The app uses authentication to protect user-specific data.

## Data Type Details

### Personal Info

Email address:

- Collected: Yes.
- Purpose: account management, authentication, password reset, app functionality.
- Shared: No, except service providers required to operate authentication/email delivery.
- Required: Required for email account login.

User IDs:

- Collected: Yes.
- Purpose: account management, app functionality, ranking records.
- Shared: No, except service providers required to operate the app.
- Required: Required for logged-in features.

Name or nickname:

- Collected: Yes.
- Purpose: profile display, ranking display.
- Shared: Yes, partially. Ranking views may show masked nickname or "나" for the current user.
- Required: Optional or user-provided.

### Photos And Videos

User profile image/avatar:

- Collected: Yes, when the user selects an avatar image.
- Purpose: profile personalization.
- Shared: No, except storage/service provider required to host the image.
- Required: Optional.

Camera frames for pose detection:

- Collected by app process: Camera is used for real-time exercise pose detection.
- Stored or uploaded: No persistent camera video upload is intended for pose workouts.
- Purpose: app functionality.

### Location

Approximate location:

- Collected: Yes.
- Purpose: neighborhood verification, local ranking participation.
- Required: Optional unless the user wants neighborhood ranking.

Precise location:

- Collected: Yes.
- Purpose: GPS neighborhood verification and running tracking.
- Required: Optional unless the user uses GPS-based features.

Background location:

- Used: Yes, for active running tracking when the session continues outside the foreground.
- Purpose: app functionality.
- Required: Optional, only for running tracking.

### Health And Fitness

Fitness activity:

- Collected: Yes.
- Data examples: exercise type, reps, workout duration, running distance, completion status, completion time, ranking points.
- Purpose: app functionality, analytics for user progress, rankings.
- Shared: Limited ranking data may be visible to other users.
- Required: Required for workout history and ranking features.

### App Activity

App interactions:

- Collected: Yes, as workout records and ranking contribution records.
- Purpose: app functionality, ranking, progress display.
- Shared: Limited ranking data may be visible to other users.

## Permission Declarations

Camera:

- Used for squat, jumping jack, push-up, and lunge pose detection.
- Camera frames are processed for exercise feedback.

Location:

- Used for neighborhood verification and running tracking.
- Background location is used only during an active running session.

Notifications:

- Used for active running foreground service status.

Battery optimization:

- Used to reduce the chance of active running tracking being stopped by the device.

## Items To Confirm Before Submission

- TODO: Confirm whether avatar images are publicly readable by URL or protected by signed URL.
- TODO: Confirm final privacy policy URL.
- TODO: Confirm support/contact email.
- TODO: Confirm whether any analytics SDK is added before release. If yes, update this form.
- TODO: Confirm whether ads are added before release. Current draft assumes no ads.
