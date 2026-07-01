package com.stickwithit.endure

class JumpingJackPoseActivity : PoseExerciseActivity() {
    override val exerciseName = "점핑잭"
    override val evaluator = JumpingJackPoseEvaluator()
    override val completionAction = ACTION_JUMPING_JACK_FINISHED
    override val defaultBaseAverageValue = 60.0
    override val musicQuery = "점핑잭 운동할 때 듣기 좋은 음악"

    companion object {
        const val ACTION_JUMPING_JACK_FINISHED = "com.stickwithit.endure.JUMPING_JACK_FINISHED"
    }
}
