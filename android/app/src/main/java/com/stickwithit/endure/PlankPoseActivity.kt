package com.stickwithit.endure

class PlankPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "플랭크"
    override val evaluator = PlankPoseEvaluator()
    override val completionAction = ACTION_PLANK_FINISHED
    override val defaultBaseAverageValue = 90.0
    override val musicQuery = "플랭크 운동할 때 듣기 좋은 음악"
    override val baseAverageExtraName = EXTRA_BASE_AVERAGE_GOOD_SECONDS

    private val coachSession = PlankGhostRaceCoachNarration.Session()

    override fun buildNarrationCue(
        frame: SquatPoseFrame,
        elapsedSeconds: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>
    ): NativeTtsCue? =
        coachSession.nextCue(
            PlankRaceSnapshot(
                seconds = currentMetricValue(),
                rank = rank,
                elapsedSeconds = elapsedSeconds,
                durationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 60).coerceIn(30, 600),
                ghosts = ghosts.map { PlankGhostState(it.first, it.second) }
            ),
            nowMillis = android.os.SystemClock.elapsedRealtime()
        )?.toNativeCue()

    override fun buildCompletionNarrationCue(rank: Int, nowMillis: Long): NativeTtsCue? =
        coachSession.completedCue(rank, nowMillis)?.toNativeCue()

    override fun cancelWorkout() {
        coachSession.cancel()
    }

    private fun PlankGhostRaceCoachNarration.Cue.toNativeCue(): NativeTtsCue {
        val profile = GhostTtsCatalog.profileFor(category)
        return NativeTtsCue(category, text, priority, profile.speechRate, profile.pitch, immediate, templateId)
    }

    companion object {
        const val ACTION_PLANK_FINISHED = "com.stickwithit.endure.PLANK_FINISHED"
    }
}
