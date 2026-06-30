package com.stickwithit.endure

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

class SquatSkeletonOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = 6f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private var frame: SquatPoseFrame? = null

    fun render(nextFrame: SquatPoseFrame) {
        frame = nextFrame
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val current = frame ?: return
        connections.forEach { connection ->
            val start = current.landmarks[connection.from] ?: return@forEach
            val end = current.landmarks[connection.to] ?: return@forEach
            if (start.visibility < 0.45f || end.visibility < 0.45f) return@forEach
            linePaint.color = colorFor(current.feedback.segmentLevels[connection.segment] ?: current.feedback.level, 150)
            linePaint.strokeWidth = if (current.feedback.segmentLevels[connection.segment] == PoseFeedbackLevel.BAD) 8f else 6f
            canvas.drawLine(
                mirrorX(start.x) * width,
                start.y * height,
                mirrorX(end.x) * width,
                end.y * height,
                linePaint
            )
        }

        visibleLandmarks.forEach { index ->
            val point = current.landmarks[index] ?: return@forEach
            if (point.visibility < 0.45f) return@forEach
            pointPaint.color = colorFor(current.feedback.level, 210)
            canvas.drawCircle(mirrorX(point.x) * width, point.y * height, 7.2f, pointPaint)
        }
    }

    private fun mirrorX(x: Float): Float = 1f - x

    private fun colorFor(level: PoseFeedbackLevel, alpha: Int): Int =
        when (level) {
            PoseFeedbackLevel.GOOD -> Color.argb(alpha, 103, 255, 134)
            PoseFeedbackLevel.WARNING -> Color.argb(alpha, 255, 213, 76)
            PoseFeedbackLevel.BAD -> Color.argb(alpha, 255, 76, 76)
        }

    private data class Connection(val from: Int, val to: Int, val segment: PoseSegment)

    companion object {
        private val visibleLandmarks = listOf(11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
        private val connections = listOf(
            Connection(11, 13, PoseSegment.LEFT_ARM),
            Connection(13, 15, PoseSegment.LEFT_ARM),
            Connection(12, 14, PoseSegment.RIGHT_ARM),
            Connection(14, 16, PoseSegment.RIGHT_ARM),
            Connection(11, 23, PoseSegment.LEFT_TORSO),
            Connection(12, 24, PoseSegment.RIGHT_TORSO),
            Connection(23, 25, PoseSegment.LEFT_THIGH),
            Connection(24, 26, PoseSegment.RIGHT_THIGH),
            Connection(25, 27, PoseSegment.LEFT_SHIN),
            Connection(26, 28, PoseSegment.RIGHT_SHIN)
        )
    }
}
