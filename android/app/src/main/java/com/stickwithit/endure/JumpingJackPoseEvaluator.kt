package com.stickwithit.endure

import kotlin.math.abs

class JumpingJackPoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.REPETITION
    private var phase = JumpingJackPhase.CLOSED
    private var opened = false
    private var lastRepAt = 0L
    private var closedAnkleWidth: Float? = null

    override fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks)
        updateRepCounter(landmarks, nowMs, onRep)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>): SquatPoseFeedback {
        if (!requiredVisible(landmarks, requiredLandmarks)) return waitingFeedback("머리, 양손, 양발이 보이게 서 주세요")
        val head = landmarks[0]!!
        val leftWrist = landmarks[15]!!
        val rightWrist = landmarks[16]!!
        val leftAnkle = landmarks[27]!!
        val rightAnkle = landmarks[28]!!
        val leftShoulder = landmarks[11]
        val rightShoulder = landmarks[12]
        val leftHip = landmarks[23]
        val rightHip = landmarks[24]

        val shoulderWidth = if (leftShoulder != null && rightShoulder != null) {
            poseDistance(leftShoulder, rightShoulder).coerceAtLeast(0.01f)
        } else {
            closedAnkleWidth?.times(1.4f) ?: 0.16f
        }
        val ankleWidth = poseDistance(leftAnkle, rightAnkle)
        val wristsAboveShoulders = if (leftShoulder != null && rightShoulder != null) {
            leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y
        } else {
            leftWrist.y < head.y + 0.06f && rightWrist.y < head.y + 0.06f
        }
        val legsOpen = ankleWidth > shoulderWidth * 1.35f
        val bodyTilt = if (leftShoulder != null && rightShoulder != null && leftHip != null && rightHip != null) {
            abs(leftShoulder.y - rightShoulder.y) + abs(leftHip.y - rightHip.y)
        } else {
            0f
        }
        val fastUnstable = requiredLandmarks.any { (landmarks[it]?.visibility ?: 1f) < 0.62f }

        val segmentLevels = mutableMapOf<PoseSegment, PoseFeedbackLevel>()
        val warnings = mutableListOf<String>()
        if (!wristsAboveShoulders) {
            warnings += "팔을 머리 위까지 올려주세요"
            segmentLevels[PoseSegment.LEFT_ARM] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_ARM] = PoseFeedbackLevel.WARNING
        }
        if (!legsOpen && phase == JumpingJackPhase.OPEN) {
            warnings += "다리를 조금 더 넓게 벌려주세요"
            segmentLevels[PoseSegment.LEFT_SHIN] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_SHIN] = PoseFeedbackLevel.WARNING
        }
        if (bodyTilt > 0.08f) warnings += "좌우 균형을 맞춰주세요"
        if (fastUnstable) warnings += "동작을 조금 안정적으로 이어가 주세요"

        return if (warnings.isEmpty()) {
            SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", "리듬이 안정적이에요", segmentLevels)
        } else {
            SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", warnings.first(), segmentLevels)
        }
    }

    private fun updateRepCounter(landmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit) {
        val head = landmarks[0] ?: return
        val leftWrist = landmarks[15] ?: return
        val rightWrist = landmarks[16] ?: return
        val leftAnkle = landmarks[27] ?: return
        val rightAnkle = landmarks[28] ?: return
        val ankleWidth = poseDistance(leftAnkle, rightAnkle)
        if (phase == JumpingJackPhase.CLOSED || ankleWidth < (closedAnkleWidth ?: Float.MAX_VALUE)) {
            closedAnkleWidth = closedAnkleWidth?.let { it * 0.9f + ankleWidth * 0.1f } ?: ankleWidth
        }
        val baseline = closedAnkleWidth?.coerceAtLeast(0.06f) ?: 0.10f
        val wristsUp = leftWrist.y < head.y + 0.06f && rightWrist.y < head.y + 0.06f
        val wristsDown = leftWrist.y > head.y + 0.16f && rightWrist.y > head.y + 0.16f
        val isOpen = ankleWidth > baseline * 1.45f && wristsUp
        val isClosed = ankleWidth < baseline * 1.18f && wristsDown

        if (phase == JumpingJackPhase.CLOSED && isOpen) {
            phase = JumpingJackPhase.OPEN
            opened = true
        }
        if (phase == JumpingJackPhase.OPEN && opened && isClosed && nowMs - lastRepAt > 600L) {
            phase = JumpingJackPhase.CLOSED
            opened = false
            lastRepAt = nowMs
            onRep()
        }
    }

    private enum class JumpingJackPhase {
        CLOSED,
        OPEN
    }

    companion object {
        private val requiredLandmarks = listOf(0, 15, 16, 27, 28)
    }
}
