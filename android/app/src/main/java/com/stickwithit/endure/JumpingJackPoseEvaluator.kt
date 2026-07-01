package com.stickwithit.endure

import kotlin.math.abs

class JumpingJackPoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.REPETITION
    private var phase = JumpingJackPhase.CLOSED
    private var opened = false
    private var lastRepAt = 0L

    override fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks)
        updateRepCounter(landmarks, nowMs, onRep)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>): SquatPoseFeedback {
        if (!requiredVisible(landmarks, requiredLandmarks)) return waitingFeedback("머리부터 발끝까지 화면에 들어오게 서 주세요")
        val leftShoulder = landmarks[11]!!
        val rightShoulder = landmarks[12]!!
        val leftWrist = landmarks[15]!!
        val rightWrist = landmarks[16]!!
        val leftHip = landmarks[23]!!
        val rightHip = landmarks[24]!!
        val leftAnkle = landmarks[27]!!
        val rightAnkle = landmarks[28]!!

        val shoulderWidth = poseDistance(leftShoulder, rightShoulder).coerceAtLeast(0.01f)
        val ankleWidth = poseDistance(leftAnkle, rightAnkle)
        val wristsAboveShoulders = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y
        val legsOpen = ankleWidth > shoulderWidth * 1.35f
        val bodyTilt = abs(leftShoulder.y - rightShoulder.y) + abs(leftHip.y - rightHip.y)
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
        val leftShoulder = landmarks[11] ?: return
        val rightShoulder = landmarks[12] ?: return
        val leftWrist = landmarks[15] ?: return
        val rightWrist = landmarks[16] ?: return
        val leftAnkle = landmarks[27] ?: return
        val rightAnkle = landmarks[28] ?: return
        val shoulderWidth = poseDistance(leftShoulder, rightShoulder).coerceAtLeast(0.01f)
        val ankleWidth = poseDistance(leftAnkle, rightAnkle)
        val wristsUp = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y
        val wristsDown = leftWrist.y > leftShoulder.y - 0.04f && rightWrist.y > rightShoulder.y - 0.04f
        val isOpen = ankleWidth > shoulderWidth * 1.35f && wristsUp
        val isClosed = ankleWidth < shoulderWidth * 1.05f && wristsDown

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
        private val requiredLandmarks = listOf(11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
    }
}
