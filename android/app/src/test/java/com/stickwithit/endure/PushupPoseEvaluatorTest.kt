package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Test

class PushupPoseEvaluatorTest {
    @Test
    fun countsPushupUsingUpperBodyAndWaistOnly() {
        val evaluator = PushupPoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeatFrame(evaluator, pushupLandmarks(torsoY = 0.53f), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, pushupLandmarks(torsoY = 0.69f), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, pushupLandmarks(torsoY = 0.53f), now) { reps += 1 }

        assertEquals(1, reps)
    }

    private fun repeatFrame(
        evaluator: PushupPoseEvaluator,
        landmarks: Map<Int, PosePoint>,
        startMs: Long,
        onRep: () -> Unit
    ) {
        repeat(20) { index ->
            evaluator.update(landmarks, startMs + index * 40L, onRep)
        }
    }

    private fun pushupLandmarks(torsoY: Float): Map<Int, PosePoint> =
        mapOf(
            11 to PosePoint(0.43f, torsoY - 0.04f),
            12 to PosePoint(0.57f, torsoY - 0.04f),
            13 to PosePoint(0.42f, 0.67f),
            14 to PosePoint(0.58f, 0.67f),
            15 to PosePoint(0.40f, 0.76f),
            16 to PosePoint(0.60f, 0.76f),
            23 to PosePoint(0.44f, torsoY + 0.05f),
            24 to PosePoint(0.56f, torsoY + 0.05f)
        )
}
