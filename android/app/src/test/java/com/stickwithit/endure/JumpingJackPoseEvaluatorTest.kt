package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Test

class JumpingJackPoseEvaluatorTest {
    @Test
    fun countsJumpingJackWithRelaxedMobileThresholds() {
        val evaluator = JumpingJackPoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }
        repeat(12) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.21f, wristY = 0.30f), now) { reps += 1 }
            now += 120L
        }
        repeat(12) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }

        assertEquals(1, reps)
    }

    @Test
    fun ignoresLowVisibilityAnklesWhenLearningClosedBaseline() {
        val evaluator = JumpingJackPoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeat(6) {
            evaluator.update(
                jumpingJackLandmarks(ankleWidth = 0.30f, wristY = 0.56f, ankleVisibility = 0.20f),
                now
            ) { reps += 1 }
            now += 120L
        }
        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }
        repeat(12) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.21f, wristY = 0.30f), now) { reps += 1 }
            now += 120L
        }
        repeat(12) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }

        assertEquals(1, reps)
    }

    @Test
    fun countsWhenArmsMoveSlightlyBeforeFeet() {
        val evaluator = JumpingJackPoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }
        repeat(2) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.30f), now) { reps += 1 }
            now += 120L
        }
        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.22f, wristY = 0.38f), now) { reps += 1 }
            now += 120L
        }
        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }

        assertEquals(1, reps)
    }

    @Test
    fun countsWithMissingWristsWhenFeetClearlyOpenAndClose() {
        val evaluator = JumpingJackPoseEvaluator()
        var reps = 0
        var now = 1_000L

        repeat(8) {
            evaluator.update(jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f), now) { reps += 1 }
            now += 120L
        }
        repeat(8) {
            evaluator.update(
                jumpingJackLandmarks(ankleWidth = 0.22f, wristY = 0.30f, wristVisibility = 0.10f),
                now
            ) { reps += 1 }
            now += 120L
        }
        repeat(12) {
            evaluator.update(
                jumpingJackLandmarks(ankleWidth = 0.12f, wristY = 0.56f, wristVisibility = 0.10f),
                now
            ) { reps += 1 }
            now += 120L
        }

        assertEquals(1, reps)
    }

    private fun jumpingJackLandmarks(
        ankleWidth: Float,
        wristY: Float,
        ankleVisibility: Float = 1f,
        wristVisibility: Float = 1f
    ): Map<Int, PosePoint> {
        val centerX = 0.50f
        val halfAnkleWidth = ankleWidth / 2f
        return mapOf(
            0 to PosePoint(0.50f, 0.20f),
            15 to PosePoint(0.38f, wristY, wristVisibility),
            16 to PosePoint(0.62f, wristY, wristVisibility),
            27 to PosePoint(centerX - halfAnkleWidth, 0.88f, ankleVisibility),
            28 to PosePoint(centerX + halfAnkleWidth, 0.88f, ankleVisibility)
        )
    }
}
