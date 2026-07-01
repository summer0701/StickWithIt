package com.stickwithit.endure

import kotlin.math.acos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

enum class PoseExerciseMetric {
    REPETITION,
    HOLD
}

interface PoseExerciseEvaluator {
    val metric: PoseExerciseMetric
    fun update(rawLandmarks: Map<Int, PosePoint>, nowMs: Long, onRep: () -> Unit): SquatPoseFrame
}

abstract class SmoothedPoseEvaluator : PoseExerciseEvaluator {
    private var smoothed: MutableMap<Int, PosePoint> = mutableMapOf()

    protected fun smooth(raw: Map<Int, PosePoint>): Map<Int, PosePoint> {
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

    protected fun waitingFeedback(detail: String = "전신이 보이도록 위치를 맞춰 주세요") =
        SquatPoseFeedback(PoseFeedbackLevel.WARNING, "주의", detail)

    protected fun requiredVisible(landmarks: Map<Int, PosePoint>, indexes: List<Int>, minVisibility: Float = 0.45f): Boolean =
        indexes.all { index -> (landmarks[index]?.visibility ?: 0f) >= minVisibility }
}

internal fun poseMidpoint(a: PosePoint, b: PosePoint) = PosePoint((a.x + b.x) / 2f, (a.y + b.y) / 2f)

internal fun poseDistance(a: PosePoint, b: PosePoint): Float = hypot(a.x - b.x, a.y - b.y)

internal fun poseAngle(a: PosePoint, b: PosePoint, c: PosePoint): Float {
    val abx = a.x - b.x
    val aby = a.y - b.y
    val cbx = c.x - b.x
    val cby = c.y - b.y
    val dot = abx * cbx + aby * cby
    val magnitude = max(0.0001f, hypot(abx, aby) * hypot(cbx, cby))
    return (acos(min(1f, max(-1f, dot / magnitude))) * (180.0 / Math.PI)).toFloat()
}
