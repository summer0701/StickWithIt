package com.stickwithit.endure

import kotlin.math.abs

class PlankPoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.HOLD

    override fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>): SquatPoseFeedback {
        if (!requiredVisible(landmarks, requiredLandmarks)) return waitingFeedback("몸 전체가 화면에 들어오도록 옆으로 위치를 맞춰 주세요")
        val shoulder = poseMidpoint(landmarks[11]!!, landmarks[12]!!)
        val elbow = poseMidpoint(landmarks[13]!!, landmarks[14]!!)
        val wrist = poseMidpoint(landmarks[15]!!, landmarks[16]!!)
        val hip = poseMidpoint(landmarks[23]!!, landmarks[24]!!)
        val knee = poseMidpoint(landmarks[25]!!, landmarks[26]!!)
        val ankle = poseMidpoint(landmarks[27]!!, landmarks[28]!!)
        val bodyLineOffset = hip.y - lineYAtX(shoulder, ankle, hip.x)
        val kneeLineOffset = knee.y - lineYAtX(shoulder, ankle, knee.x)
        val elbowUnderShoulder = abs(elbow.x - shoulder.x) < 0.13f || abs(elbow.y - shoulder.y) < 0.18f
        val segmentLevels = mutableMapOf<PoseSegment, PoseFeedbackLevel>()
        val warnings = mutableListOf<String>()
        val errors = mutableListOf<String>()

        if (bodyLineOffset > 0.08f) {
            errors += "허리가 내려가지 않게 복부에 힘을 주세요"
            segmentLevels[PoseSegment.LEFT_TORSO] = PoseFeedbackLevel.BAD
            segmentLevels[PoseSegment.RIGHT_TORSO] = PoseFeedbackLevel.BAD
        }
        if (bodyLineOffset < -0.08f) {
            warnings += "엉덩이를 조금 낮춰주세요"
            segmentLevels[PoseSegment.LEFT_TORSO] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_TORSO] = PoseFeedbackLevel.WARNING
        }
        if (abs(bodyLineOffset) > 0.12f) errors += "어깨-엉덩이-발목 라인이 무너지고 있어요"
        if (!elbowUnderShoulder || poseDistance(elbow, wrist) < 0.03f) warnings += "팔꿈치를 어깨 아래에 두세요"
        if (kneeLineOffset > 0.09f) warnings += "무릎이 내려가지 않게 다리를 펴 주세요"

        return when {
            errors.isNotEmpty() -> SquatPoseFeedback(PoseFeedbackLevel.BAD, "교정 필요", errors.first(), segmentLevels)
            warnings.isNotEmpty() -> SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", warnings.first(), segmentLevels)
            else -> SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", "플랭크 라인이 안정적이에요", segmentLevels)
        }
    }

    private fun lineYAtX(a: PosePoint, b: PosePoint, x: Float): Float {
        val span = b.x - a.x
        if (abs(span) < 0.0001f) return (a.y + b.y) / 2f
        val ratio = ((x - a.x) / span).coerceIn(0f, 1f)
        return a.y + (b.y - a.y) * ratio
    }

    companion object {
        private val requiredLandmarks = listOf(11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
    }
}
