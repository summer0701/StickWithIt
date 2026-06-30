package com.stickwithit.endure

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class SquatPoseEvaluator {
    private var smoothed: MutableMap<Int, PosePoint> = mutableMapOf()
    private val highlightUntil = mutableMapOf<PoseSegment, Long>()
    private var ankleCenter: PosePoint? = null
    private var squatPhase = SquatPhase.UP
    private var lastRepAt = 0L

    fun update(
        rawLandmarks: Map<Int, PosePoint>,
        nowMs: Long,
        onRep: () -> Unit
    ): SquatPoseFrame {
        val landmarks = smooth(rawLandmarks)
        val feedback = evaluate(landmarks, nowMs)
        updateRepCounter(landmarks, nowMs, onRep)
        return SquatPoseFrame(
            landmarks = landmarks,
            feedback = feedback,
            modelTier = "",
            fps = 0f
        )
    }

    private fun smooth(raw: Map<Int, PosePoint>): Map<Int, PosePoint> {
        val eased = 0.19f
        raw.forEach { (index, point) ->
            val previous = smoothed[index]
            smoothed[index] = if (previous == null) {
                point
            } else {
                PosePoint(
                    x = previous.x + (point.x - previous.x) * eased,
                    y = previous.y + (point.y - previous.y) * eased,
                    visibility = point.visibility
                )
            }
        }
        return smoothed.toMap()
    }

    private fun evaluate(landmarks: Map<Int, PosePoint>, nowMs: Long): SquatPoseFeedback {
        val leftHip = landmarks[23] ?: return waitingFeedback()
        val rightHip = landmarks[24] ?: return waitingFeedback()
        val leftKnee = landmarks[25] ?: return waitingFeedback()
        val rightKnee = landmarks[26] ?: return waitingFeedback()
        val leftAnkle = landmarks[27] ?: return waitingFeedback()
        val rightAnkle = landmarks[28] ?: return waitingFeedback()
        val leftShoulder = landmarks[11] ?: return waitingFeedback()
        val rightShoulder = landmarks[12] ?: return waitingFeedback()

        val kneeAngle = (angle(leftHip, leftKnee, leftAnkle) + angle(rightHip, rightKnee, rightAnkle)) / 2f
        val shoulderMid = midpoint(leftShoulder, rightShoulder)
        val hipMid = midpoint(leftHip, rightHip)
        val kneeMid = midpoint(leftKnee, rightKnee)
        val ankleMid = midpoint(leftAnkle, rightAnkle)
        val torsoLean = abs(shoulderMid.x - hipMid.x)
        val waistTilt = abs(leftShoulder.y - rightShoulder.y) + abs(leftHip.y - rightHip.y)
        val kneeWidth = distance(leftKnee, rightKnee)
        val ankleWidth = max(0.01f, distance(leftAnkle, rightAnkle))
        val depthGap = hipMid.y - kneeMid.y
        val ankleDrift = ankleCenter?.let { distance(ankleMid, it) } ?: 0f
        ankleCenter = ankleCenter?.let {
            PosePoint(
                x = it.x + (ankleMid.x - it.x) * 0.08f,
                y = it.y + (ankleMid.y - it.y) * 0.08f
            )
        } ?: ankleMid

        val segmentLevels = mutableMapOf<PoseSegment, PoseFeedbackLevel>()
        val warnings = mutableListOf<String>()
        val errors = mutableListOf<String>()

        if (kneeWidth < ankleWidth * 0.62f) {
            errors += "무릎이 안쪽으로 모이고 있어요"
            hold(nowMs, PoseSegment.LEFT_SHIN, PoseSegment.RIGHT_SHIN)
        }
        if (torsoLean > 0.14f) {
            errors += "허리를 세워 주세요"
            hold(nowMs, PoseSegment.LEFT_TORSO, PoseSegment.RIGHT_TORSO)
        }
        if (depthGap > 0.12f || kneeAngle < 55f) {
            warnings += "스쿼트 깊이를 높여요"
            segmentLevels[PoseSegment.LEFT_THIGH] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_THIGH] = PoseFeedbackLevel.WARNING
        }
        if (depthGap < -0.035f && kneeAngle > 112f) {
            warnings += "스쿼트 깊이를 조금 더 낮춰요"
            segmentLevels[PoseSegment.LEFT_THIGH] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_THIGH] = PoseFeedbackLevel.WARNING
        }
        if (waistTilt > 0.07f) {
            warnings += "좌우 균형을 맞춰요"
            segmentLevels[PoseSegment.LEFT_TORSO] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_TORSO] = PoseFeedbackLevel.WARNING
        }
        if (ankleDrift > 0.05f) {
            warnings += "발 위치를 고정해요"
            segmentLevels[PoseSegment.LEFT_SHIN] = PoseFeedbackLevel.WARNING
            segmentLevels[PoseSegment.RIGHT_SHIN] = PoseFeedbackLevel.WARNING
        }

        highlightUntil.entries.removeAll { it.value <= nowMs }
        highlightUntil.keys.forEach { segmentLevels[it] = PoseFeedbackLevel.BAD }

        return when {
            errors.isNotEmpty() -> SquatPoseFeedback(PoseFeedbackLevel.BAD, "교정 필요", errors.first(), segmentLevels)
            warnings.isNotEmpty() -> SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", warnings.first(), segmentLevels)
            else -> SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", "자세가 안정적이에요", segmentLevels)
        }
    }

    private fun updateRepCounter(landmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit) {
        val hipMid = midpoint(landmarks[23] ?: return, landmarks[24] ?: return)
        val kneeMid = midpoint(landmarks[25] ?: return, landmarks[26] ?: return)
        val kneeAngle = (
            angle(landmarks[23] ?: return, landmarks[25] ?: return, landmarks[27] ?: return) +
                angle(landmarks[24] ?: return, landmarks[26] ?: return, landmarks[28] ?: return)
            ) / 2f

        val isDown = hipMid.y > kneeMid.y - 0.02f || kneeAngle < 105f
        val isUp = kneeAngle > 150f
        if (squatPhase == SquatPhase.UP && isDown) squatPhase = SquatPhase.DOWN
        if (squatPhase == SquatPhase.DOWN && isUp && nowMs - lastRepAt > 900L) {
            squatPhase = SquatPhase.UP
            lastRepAt = nowMs
            onRep()
        }
    }

    private fun hold(nowMs: Long, vararg segments: PoseSegment) {
        segments.forEach { highlightUntil[it] = nowMs + 1500L }
    }

    private fun waitingFeedback() = SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", "전신이 보이도록 서 주세요")

    private enum class SquatPhase {
        UP,
        DOWN
    }
}

private fun midpoint(a: PosePoint, b: PosePoint) = PosePoint((a.x + b.x) / 2f, (a.y + b.y) / 2f)

private fun distance(a: PosePoint, b: PosePoint): Float = hypot(a.x - b.x, a.y - b.y)

private fun angle(a: PosePoint, b: PosePoint, c: PosePoint): Float {
    val abx = a.x - b.x
    val aby = a.y - b.y
    val cbx = c.x - b.x
    val cby = c.y - b.y
    val dot = abx * cbx + aby * cby
    val magnitude = max(0.0001f, hypot(abx, aby) * hypot(cbx, cby))
    return (acos(min(1f, max(-1f, dot / magnitude))) * (180.0 / Math.PI)).toFloat()
}
