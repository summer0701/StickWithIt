package com.stickwithit.endure

import kotlin.math.abs

class PushupPoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.REPETITION
    private var phase = PushupPhase.UP
    private var lastRepAt = 0L
    private var downStartedAt = 0L

    override fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks)
        updateRepCounter(landmarks, nowMs, onRep)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>): SquatPoseFeedback {
        if (!requiredVisible(landmarks, upperBodyLandmarks)) return waitingFeedback("상체와 손목, 발목이 모두 보이게 카메라를 옆에 둬 주세요")
        val shoulder = poseMidpoint(landmarks[11]!!, landmarks[12]!!)
        val elbow = poseMidpoint(landmarks[13]!!, landmarks[14]!!)
        val wrist = poseMidpoint(landmarks[15]!!, landmarks[16]!!)
        val hasBodyLine = requiredVisible(landmarks, kneeBodyLandmarks)
        val hip = if (hasBodyLine) poseMidpoint(landmarks[23]!!, landmarks[24]!!) else shoulder
        val lowerBody = if (hasBodyLine) poseMidpoint(landmarks[25]!!, landmarks[26]!!) else wrist
        val elbowAngle = averageElbowAngle(landmarks)
        val bodyLine = if (hasBodyLine) abs(hip.y - lineYAtX(shoulder, lowerBody, hip.x)) else 0f
        val hipTooLow = hasBodyLine && hip.y - lineYAtX(shoulder, lowerBody, hip.x) > 0.08f
        val hipTooHigh = hasBodyLine && lineYAtX(shoulder, lowerBody, hip.x) - hip.y > 0.08f
        val shoulderNearElbow = abs(shoulder.y - elbow.y) < 0.08f

        val segmentLevels = mutableMapOf<PoseSegment, PoseFeedbackLevel>()
        val warnings = mutableListOf<String>()
        if (hipTooLow) {
            warnings += "허리가 처지지 않게 몸을 일자로 유지하세요"
            segmentLevels[PoseSegment.LEFT_TORSO] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_TORSO] = PoseFeedbackLevel.WARNING
        }
        if (hipTooHigh) warnings += "엉덩이를 조금 낮춰 몸통 라인을 맞춰주세요"
        if (phase == PushupPhase.UP && elbowAngle < 145f) warnings += "팔을 끝까지 펴 주세요"
        if (phase == PushupPhase.DOWN && elbowAngle > 105f && !shoulderNearElbow) warnings += "팔꿈치를 조금 더 굽혀주세요"
        if (bodyLine > 0.11f) warnings += "어깨부터 발목까지 한 줄을 유지하세요"
        if (poseDistance(shoulder, wrist) < 0.08f) warnings += "손목이 화면에서 잘리지 않게 거리를 조정하세요"

        return if (warnings.isEmpty()) {
            SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", "몸통 라인이 안정적이에요", segmentLevels)
        } else {
            SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", warnings.first(), segmentLevels)
        }
    }

    private fun updateRepCounter(landmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit) {
        if (!requiredVisible(landmarks, upperBodyLandmarks)) return
        val shoulder = poseMidpoint(landmarks[11] ?: return, landmarks[12] ?: return)
        val elbow = poseMidpoint(landmarks[13] ?: return, landmarks[14] ?: return)
        val elbowAngle = averageElbowAngle(landmarks)
        val downByHeight = abs(shoulder.y - elbow.y) < 0.08f
        val isDown = elbowAngle <= 115f || downByHeight
        val isUp = elbowAngle >= 150f
        if (phase == PushupPhase.UP && isDown) {
            phase = PushupPhase.DOWN
            downStartedAt = nowMs
        }
        if (phase == PushupPhase.DOWN && isUp && nowMs - downStartedAt > 180L && nowMs - lastRepAt > 900L) {
            phase = PushupPhase.UP
            lastRepAt = nowMs
            onRep()
        }
    }

    private fun averageElbowAngle(landmarks: Map<Int, PosePoint>): Float {
        val left = poseAngle(landmarks[11]!!, landmarks[13]!!, landmarks[15]!!)
        val right = poseAngle(landmarks[12]!!, landmarks[14]!!, landmarks[16]!!)
        return (left + right) / 2f
    }

    private fun lineYAtX(a: PosePoint, b: PosePoint, x: Float): Float {
        val span = b.x - a.x
        if (abs(span) < 0.0001f) return (a.y + b.y) / 2f
        val ratio = ((x - a.x) / span).coerceIn(0f, 1f)
        return a.y + (b.y - a.y) * ratio
    }

    private enum class PushupPhase {
        UP,
        DOWN
    }

    companion object {
        private val upperBodyLandmarks = listOf(11, 12, 13, 14, 15, 16)
        private val kneeBodyLandmarks = listOf(11, 12, 13, 14, 15, 16, 23, 24, 25, 26)
    }
}
