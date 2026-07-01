package com.stickwithit.endure

class PushupPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "푸쉬업"
    override val evaluator = PushupPoseEvaluator()
    override val completionAction = ACTION_PUSHUP_FINISHED
    override val defaultBaseAverageValue = 25.0
    override val musicQuery = "푸쉬업 운동할 때 듣기 좋은 음악"

    companion object {
        const val ACTION_PUSHUP_FINISHED = "com.stickwithit.endure.PUSHUP_FINISHED"
    }
}
