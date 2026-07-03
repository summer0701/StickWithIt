package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Test

class LungePoseEvaluatorTest {
    @Test
    fun countsAlternatingLeftAndRightLunges() {
        val evaluator = LungePoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, leftLungeLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, rightLungeLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }

        assertEquals(2, reps)
    }

    @Test
    fun doesNotCountSameSideTwiceInARow() {
        val evaluator = LungePoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, leftLungeLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, leftLungeLandmarks(), now) { reps += 1 }
        now += 1_000L
        repeatFrame(evaluator, standingLandmarks(), now) { reps += 1 }

        assertEquals(1, reps)
    }

    private fun repeatFrame(
        evaluator: LungePoseEvaluator,
        landmarks: Map<Int, PosePoint>,
        startMs: Long,
        onRep: () -> Unit
    ) {
        repeat(18) { index ->
            evaluator.update(landmarks, startMs + index * 40L, onRep)
        }
    }

    private fun standingLandmarks(): Map<Int, PosePoint> =
        baseLandmarks(
            leftHip = PosePoint(0.40f, 0.40f),
            rightHip = PosePoint(0.60f, 0.40f),
            leftKnee = PosePoint(0.40f, 0.65f),
            rightKnee = PosePoint(0.60f, 0.65f),
            leftAnkle = PosePoint(0.40f, 0.90f),
            rightAnkle = PosePoint(0.60f, 0.90f)
        )

    private fun leftLungeLandmarks(): Map<Int, PosePoint> =
        baseLandmarks(
            leftHip = PosePoint(0.40f, 0.40f),
            rightHip = PosePoint(0.60f, 0.40f),
            leftKnee = PosePoint(0.40f, 0.65f),
            rightKnee = PosePoint(0.60f, 0.65f),
            leftAnkle = PosePoint(0.62f, 0.65f),
            rightAnkle = PosePoint(0.60f, 0.92f)
        )

    private fun rightLungeLandmarks(): Map<Int, PosePoint> =
        baseLandmarks(
            leftHip = PosePoint(0.40f, 0.40f),
            rightHip = PosePoint(0.60f, 0.40f),
            leftKnee = PosePoint(0.40f, 0.65f),
            rightKnee = PosePoint(0.60f, 0.65f),
            leftAnkle = PosePoint(0.40f, 0.92f),
            rightAnkle = PosePoint(0.38f, 0.65f)
        )

    private fun baseLandmarks(
        leftHip: PosePoint,
        rightHip: PosePoint,
        leftKnee: PosePoint,
        rightKnee: PosePoint,
        leftAnkle: PosePoint,
        rightAnkle: PosePoint
    ): Map<Int, PosePoint> =
        mapOf(
            11 to PosePoint(0.42f, 0.22f),
            12 to PosePoint(0.58f, 0.22f),
            23 to leftHip,
            24 to rightHip,
            25 to leftKnee,
            26 to rightKnee,
            27 to leftAnkle,
            28 to rightAnkle
        )
}
