package com.stickwithit.endure

import kotlin.math.abs

class LungePoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.REPETITION
    private var phase = LungePhase.STANDING
    private var activeSide: LungeSide? = null
    private var lastCountedSide: LungeSide? = null
    private var lastRepAt = 0L

    override fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks)
        updateRepCounter(landmarks, nowMs, onRep)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>): SquatPoseFeedback {
        if (!requiredVisible(landmarks, requiredLandmarks)) {
            return waitingFeedback("전신이 보이도록 카메라 앞에 서 주세요.")
        }

        val leftKneeAngle = kneeAngle(landmarks, LungeSide.LEFT)
        val rightKneeAngle = kneeAngle(landmarks, LungeSide.RIGHT)
        val torsoTilt = abs((landmarks[11]!!.y - landmarks[12]!!.y) + (landmarks[23]!!.y - landmarks[24]!!.y))
        val side = detectLungeSide(leftKneeAngle, rightKneeAngle)
        val segmentLevels = mutableMapOf<PoseSegment, PoseFeedbackLevel>()
        val warnings = mutableListOf<String>()

        if (torsoTilt > 0.12f) warnings += "허리를 곧게 유지하세요."
        if (side == null && phase == LungePhase.STANDING) warnings += "왼쪽, 오른쪽을 번갈아 천천히 내려가세요."
        if (side != null && side == lastCountedSide) warnings += "${side.opposite().label} 다리로 번갈아 수행하세요."
        if (side != null && frontKneePastToe(landmarks, side)) {
            warnings += "앞무릎은 발끝을 넘지 않습니다."
            segmentLevels[side.shinSegment] = PoseFeedbackLevel.WARNING
        }
        if (phase == LungePhase.DOWN && side != null) warnings += "자세를 유지하세요. 천천히 올라오세요."

        return if (warnings.isEmpty()) {
            val detail = side?.let { "${it.label} 다리! 좋습니다." } ?: "런지를 시작합니다."
            SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", detail, segmentLevels)
        } else {
            SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", warnings.first(), segmentLevels)
        }
    }

    private fun updateRepCounter(landmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit) {
        if (!requiredVisible(landmarks, requiredLandmarks)) return

        val leftKneeAngle = kneeAngle(landmarks, LungeSide.LEFT)
        val rightKneeAngle = kneeAngle(landmarks, LungeSide.RIGHT)
        val side = detectLungeSide(leftKneeAngle, rightKneeAngle)
        val standing = leftKneeAngle > 152f && rightKneeAngle > 152f

        if (phase == LungePhase.STANDING && side != null && side != lastCountedSide) {
            phase = LungePhase.DOWN
            activeSide = side
        }

        if (phase == LungePhase.DOWN && standing && nowMs - lastRepAt > 650L) {
            val completedSide = activeSide
            phase = LungePhase.STANDING
            activeSide = null
            if (completedSide != null) {
                lastCountedSide = completedSide
                lastRepAt = nowMs
                onRep()
            }
        }
    }

    private fun detectLungeSide(leftKneeAngle: Float, rightKneeAngle: Float): LungeSide? {
        val leftDown = leftKneeAngle in 70f..122f && rightKneeAngle > 128f
        val rightDown = rightKneeAngle in 70f..122f && leftKneeAngle > 128f
        return when {
            leftDown && !rightDown -> LungeSide.LEFT
            rightDown && !leftDown -> LungeSide.RIGHT
            else -> null
        }
    }

    private fun kneeAngle(landmarks: Map<Int, PosePoint>, side: LungeSide): Float =
        poseAngle(landmarks[side.hip]!!, landmarks[side.knee]!!, landmarks[side.ankle]!!)

    private fun frontKneePastToe(landmarks: Map<Int, PosePoint>, side: LungeSide): Boolean {
        val hip = landmarks[side.hip]!!
        val knee = landmarks[side.knee]!!
        val ankle = landmarks[side.ankle]!!
        val forward = if (ankle.x >= hip.x) 1 else -1
        return (knee.x - ankle.x) * forward > 0.06f
    }

    private enum class LungePhase {
        STANDING,
        DOWN
    }

    private enum class LungeSide(
        val label: String,
        val hip: Int,
        val knee: Int,
        val ankle: Int,
        val shinSegment: PoseSegment
    ) {
        LEFT("왼쪽", 23, 25, 27, PoseSegment.LEFT_SHIN),
        RIGHT("오른쪽", 24, 26, 28, PoseSegment.RIGHT_SHIN);

        fun opposite(): LungeSide = if (this == LEFT) RIGHT else LEFT
    }

    companion object {
        private val requiredLandmarks = listOf(11, 12, 23, 24, 25, 26, 27, 28)
    }
}
