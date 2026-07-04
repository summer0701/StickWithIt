package com.stickwithit.endure

import android.content.pm.ActivityInfo

class SquatPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "스쿼트"
    override val evaluator = SquatPoseEvaluator()
    override val completionAction = ACTION_SQUAT_FINISHED
    override val defaultBaseAverageValue = SquatGhostTargets.DEFAULT_BASE_AVERAGE_REPS
    override val musicQuery = "스쿼트 운동할 때 듣기 좋은 음악"
    override val requireStableFullBodyBeforeStart = true
    override val startCountdownSeconds = 5
    override val screenOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    override val useGameHud = true
    override val gameHudLabel = "SQUATS"
    override val readinessLandmarks = listOf(0, 11, 12, 23, 24, 25, 26, 27, 28)
    override val topInstructionText = "준비 · 머리와 하체 핵심 관절이 보이면 시작합니다."
    override val readinessMissingDetail = "머리, 어깨, 엉덩이, 무릎, 발목이 보이게 서 주세요."
    override val readinessAcceptedDetail = "좋습니다. 5초 뒤 스쿼트를 시작합니다."
    override val readinessHoldingDetail = "좋습니다. 자세를 유지하세요."
    override val goodFeedbackLines = listOf("✔ 무릎 OK", "✔ 허리 OK", "✔ Good Squat")
    override val warningFeedbackLines = listOf("✔ 무릎 OK", "✔ 허리 OK", "▲ 조금 더 내려가세요")
    override val badFeedbackLines = listOf("▲ 무릎과 허리를 다시 맞춰주세요", "▲ 천천히 다시 내려가세요")
    override val guideBounds = PoseSkeletonOverlayView.GuideBounds(
        left = 0.18f,
        top = 0.12f,
        right = 0.82f,
        bottom = 0.86f
    )

    override fun buildNarrationCue(
        frame: SquatPoseFrame,
        elapsedSeconds: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>
    ): NativeTtsCue? {
        val postureText = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> "자세 좋음. ${frame.feedback.detail}"
            PoseFeedbackLevel.WARNING -> "주의. ${frame.feedback.detail}"
            PoseFeedbackLevel.BAD -> "교정 필요. ${frame.feedback.detail}"
        }
        val text = SquatCoachNarration.build(
            reps = currentMetricValue(),
            rank = rank,
            postureText = postureText,
            ghosts = ghosts,
            recentTexts = recentTexts,
            variantSeed = currentMetricValue() + elapsedSeconds + rank
        )
        recentTexts.addLast(text)
        while (recentTexts.size > 6) recentTexts.removeFirst()
        val profile = GhostTtsCatalog.profileFor("encouragement")
        return NativeTtsCue(
            category = "squat_pose",
            text = text,
            priority = 36,
            speechRate = profile.speechRate,
            pitch = profile.pitch,
            immediate = false
        )
    }

    private val recentTexts = ArrayDeque<String>()

    override fun readinessDistanceDetail(minX: Float, maxX: Float, minY: Float, maxY: Float): String? {
        val bodyWidth = maxX - minX
        val bodyHeight = maxY - minY
        val centerX = (minX + maxX) / 2f
        val nearEdge = minX < 0.07f || maxX > 0.93f || minY < 0.04f || maxY > 0.96f
        return when {
            nearEdge || bodyHeight > 0.88f || bodyWidth > 0.82f -> "카메라에서 너무 가깝습니다. 조금 뒤로 이동해주세요."
            bodyHeight < 0.48f -> "조금 앞으로 와주세요."
            centerX < 0.35f || centerX > 0.65f -> "중앙으로 이동해주세요."
            else -> null
        }
    }

    companion object {
        const val ACTION_SQUAT_FINISHED = "com.stickwithit.endure.SQUAT_FINISHED"
        const val EXTRA_DURATION_SECONDS = PoseExerciseActivity.EXTRA_DURATION_SECONDS
        const val EXTRA_BASE_AVERAGE_REPS = PoseExerciseActivity.EXTRA_BASE_AVERAGE_REPS
        const val EXTRA_REPS = PoseExerciseActivity.EXTRA_REPS
        const val EXTRA_COMPLETED = PoseExerciseActivity.EXTRA_COMPLETED
    }
}
