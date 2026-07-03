package com.stickwithit.endure

import android.content.pm.ActivityInfo
import androidx.camera.core.AspectRatio
import androidx.camera.view.PreviewView

class PushupPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "푸쉬업"
    override val evaluator = PushupPoseEvaluator()
    override val completionAction = ACTION_PUSHUP_FINISHED
    override val defaultBaseAverageValue = 25.0
    override val musicQuery = "푸쉬업 운동할 때 듣기 좋은 음악"
    override val previewScaleType = PreviewView.ScaleType.FIT_CENTER
    override val cameraAspectRatio = AspectRatio.RATIO_16_9
    override val requireStableFullBodyBeforeStart = true
    override val startCountdownSeconds = 5
    override val screenOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    override val readinessLandmarks = listOf(11, 12, 13, 14, 15, 16, 23, 24)
    override val readinessMissingDetail = "상체와 허리까지 보이게 카메라를 맞춰주세요."
    override val readinessAcceptedDetail = "좋습니다. 5초 뒤 푸쉬업을 시작합니다."
    override val readinessHoldingDetail = "좋습니다. 자세를 유지하세요."

    private val coachSession = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)

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

    override fun readinessDistanceDetail(minX: Float, maxX: Float, minY: Float, maxY: Float): String? {
        val bodyWidth = maxX - minX
        val bodyHeight = maxY - minY
        val centerX = (minX + maxX) / 2f
        val centerY = (minY + maxY) / 2f
        val nearEdge = minX < 0.06f || maxX > 0.94f || minY < 0.06f || maxY > 0.94f
        return when {
            nearEdge || bodyWidth > 0.86f || bodyHeight > 0.70f ->
                "카메라에서 너무 가깝습니다. 조금 뒤로 이동해주세요."
            bodyWidth < 0.34f && bodyHeight < 0.28f ->
                "카메라에서 너무 멉니다. 조금 앞으로 와주세요."
            centerX < 0.30f ->
                "몸이 화면 왼쪽에 있습니다. 중앙으로 이동해주세요."
            centerX > 0.70f ->
                "몸이 화면 오른쪽에 있습니다. 중앙으로 이동해주세요."
            centerY < 0.18f || centerY > 0.82f ->
                "상체와 허리가 화면 중앙에 오게 카메라 각도를 맞춰주세요."
            else -> null
        }
    }

    private fun buildRaceNarrationCue(elapsedSeconds: Int, rank: Int, ghosts: List<Pair<String, Int>>): NativeTtsCue? =
        coachSession.nextCue(
            RepetitionRaceSnapshot(
                exercise = RepetitionRaceExercise.PUSHUP,
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
        const val ACTION_PUSHUP_FINISHED = "com.stickwithit.endure.PUSHUP_FINISHED"
    }
}
