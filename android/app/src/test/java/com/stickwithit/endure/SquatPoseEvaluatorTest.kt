package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SquatPoseEvaluatorTest {
    @Test
    fun warnsWhenSquatIsTooDeep() {
        val frame = SquatPoseEvaluator().update(
            rawLandmarks = squatLandmarks(
                leftHip = PosePoint(0.42f, 0.75f),
                rightHip = PosePoint(0.58f, 0.75f),
                leftKnee = PosePoint(0.38f, 0.58f),
                rightKnee = PosePoint(0.62f, 0.58f),
                leftAnkle = PosePoint(0.36f, 0.88f),
                rightAnkle = PosePoint(0.64f, 0.88f)
            ),
            nowMs = 1_000L,
            onRep = {}
        )

        assertEquals(PoseFeedbackLevel.WARNING, frame.feedback.level)
        assertEquals("스쿼트 깊이를 높여요", frame.feedback.detail)
        assertEquals(PoseFeedbackLevel.WARNING, frame.feedback.segmentLevels[PoseSegment.LEFT_THIGH])
        assertEquals(PoseFeedbackLevel.WARNING, frame.feedback.segmentLevels[PoseSegment.RIGHT_THIGH])
    }

    @Test
    fun warnsWhenSquatIsTooShallow() {
        val frame = SquatPoseEvaluator().update(
            rawLandmarks = squatLandmarks(
                leftHip = PosePoint(0.42f, 0.44f),
                rightHip = PosePoint(0.58f, 0.44f),
                leftKnee = PosePoint(0.38f, 0.58f),
                rightKnee = PosePoint(0.62f, 0.58f),
                leftAnkle = PosePoint(0.36f, 0.88f),
                rightAnkle = PosePoint(0.64f, 0.88f)
            ),
            nowMs = 1_000L,
            onRep = {}
        )

        assertEquals(PoseFeedbackLevel.WARNING, frame.feedback.level)
        assertEquals("스쿼트 깊이를 조금 더 낮춰요", frame.feedback.detail)
    }

    private fun squatLandmarks(
        leftHip: PosePoint,
        rightHip: PosePoint,
        leftKnee: PosePoint,
        rightKnee: PosePoint,
        leftAnkle: PosePoint,
        rightAnkle: PosePoint
    ): Map<Int, PosePoint> =
        mapOf(
            11 to PosePoint(0.42f, 0.25f),
            12 to PosePoint(0.58f, 0.25f),
            23 to leftHip,
            24 to rightHip,
            25 to leftKnee,
            26 to rightKnee,
            27 to leftAnkle,
            28 to rightAnkle
        )
}
