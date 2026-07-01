package com.stickwithit.endure

class PlankPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "플랭크"
    override val evaluator = PlankPoseEvaluator()
    override val completionAction = ACTION_PLANK_FINISHED
    override val defaultBaseAverageValue = 90.0
    override val musicQuery = "플랭크 운동할 때 듣기 좋은 음악"
    override val baseAverageExtraName = EXTRA_BASE_AVERAGE_GOOD_SECONDS

    companion object {
        const val ACTION_PLANK_FINISHED = "com.stickwithit.endure.PLANK_FINISHED"
    }
}
