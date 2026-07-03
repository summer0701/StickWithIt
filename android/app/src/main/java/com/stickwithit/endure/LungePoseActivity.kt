package com.stickwithit.endure

class LungePoseActivity : PoseExerciseActivity() {
    override val exerciseName = "런지"
    override val evaluator = LungePoseEvaluator()
    override val completionAction = ACTION_LUNGE_FINISHED
    override val defaultBaseAverageValue = 30.0
    override val musicQuery = "런지 운동할 때 듣기 좋은 음악"
    override val requireStableFullBodyBeforeStart = true
    override val startCountdownSeconds = 5
    override val readinessMissingDetail = "전신이 보이도록 카메라 앞에 서 주세요."
    override val readinessAcceptedDetail = "좋습니다. 5초 뒤 런지를 시작합니다."
    override val readinessHoldingDetail = "좋습니다. 자세를 유지하세요."

    private val coachSession = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.LUNGE)

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
                exercise = RepetitionRaceExercise.LUNGE,
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
        const val ACTION_LUNGE_FINISHED = "com.stickwithit.endure.LUNGE_FINISHED"
    }
}
