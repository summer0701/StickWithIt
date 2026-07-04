package com.stickwithit.endure

import android.content.pm.ActivityInfo

class JumpingJackPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "점핑잭"
    override val evaluator = JumpingJackPoseEvaluator()
    override val completionAction = ACTION_JUMPING_JACK_FINISHED
    override val defaultBaseAverageValue = 60.0
    override val musicQuery = "점핑잭 운동할 때 듣기 좋은 음악"
    override val requireStableFullBodyBeforeStart = true
    override val startCountdownSeconds = 5
    override val screenOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    override val useGameHud = true
    override val gameHudLabel = "JUMPING JACK"
    override val readinessLandmarks = listOf(0, 15, 16, 27, 28)
    override val topInstructionText = "준비 · 머리, 양손, 양발이 보이면 시작합니다."
    override val readinessMissingDetail = "머리, 양손, 양발이 보이게 서 주세요."
    override val readinessAcceptedDetail = "좋습니다. 5초 뒤 점핑잭을 시작합니다."
    override val readinessHoldingDetail = "좋습니다. 자세를 유지하세요."
    override val goodFeedbackLines = listOf("✔ 팔 높이 OK", "✔ 리듬 GOOD", "🔥 Excellent")
    override val warningFeedbackLines = listOf("▲ 팔을 끝까지 올려주세요", "✔ 리듬 GOOD")
    override val badFeedbackLines = listOf("▲ 팔과 발을 크게 움직여주세요", "▲ 리듬을 다시 맞춰주세요")
    override val guideBounds = PoseSkeletonOverlayView.GuideBounds(
        left = 0.09f,
        top = 0.11f,
        right = 0.91f,
        bottom = 0.87f
    )

    private val coachSession = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.JUMPING_JACK)

    override fun buildNarrationCue(
        frame: SquatPoseFrame,
        elapsedSeconds: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>
    ): NativeTtsCue? = buildRaceNarrationCue(elapsedSeconds, rank, ghosts)

    override fun buildCompletionNarrationCue(rank: Int, nowMillis: Long): NativeTtsCue? =
        coachSession.completedCue(rank, nowMillis)?.toNativeCue()

    override fun cancelWorkout() {
        coachSession.cancel()
    }

    private fun buildRaceNarrationCue(elapsedSeconds: Int, rank: Int, ghosts: List<Pair<String, Int>>): NativeTtsCue? =
        coachSession.nextCue(
            RepetitionRaceSnapshot(
                exercise = RepetitionRaceExercise.JUMPING_JACK,
                reps = currentMetricValue(),
                rank = rank,
                elapsedSeconds = elapsedSeconds,
                durationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 60).coerceIn(30, 600),
                ghosts = ghosts.map { RepetitionGhostState(it.first, it.second) }
            ),
            nowMillis = android.os.SystemClock.elapsedRealtime()
        )?.toNativeCue()

    private fun RepetitionGhostRaceCoachNarration.Cue.toNativeCue(): NativeTtsCue {
        val profile = GhostTtsCatalog.profileFor(category)
        return NativeTtsCue(category, text, priority, profile.speechRate, profile.pitch, immediate, templateId)
    }

    companion object {
        const val ACTION_JUMPING_JACK_FINISHED = "com.stickwithit.endure.JUMPING_JACK_FINISHED"
    }
}
