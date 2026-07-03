package com.stickwithit.endure

import android.content.Context
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

class PoseSkeletonOverlayView @JvmOverloads constructor(
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
    private val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        color = Color.argb(150, 135, 235, 26)
        pathEffect = DashPathEffect(floatArrayOf(22f, 14f), 0f)
    }
    private val guideGlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 9f
        color = Color.argb(92, 158, 255, 58)
        pathEffect = DashPathEffect(floatArrayOf(22f, 14f), 0f)
    }
    private val guideFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(24, 135, 235, 26)
    }
    private var frame: SquatPoseFrame? = null
    var guideBounds = GuideBounds()
        set(value) {
            field = value
            invalidate()
        }
    var guideEnabled: Boolean = false
        set(value) {
            field = value
            invalidate()
        }

    fun render(nextFrame: SquatPoseFrame) {
        frame = nextFrame
        invalidate()
    }

    override fun onDraw(canvas: android.graphics.Canvas) {
        super.onDraw(canvas)
        if (guideEnabled) drawGuide(canvas)
        val current = frame ?: return
        connections.forEach { connection ->
            val start = current.landmarks[connection.from] ?: return@forEach
            val end = current.landmarks[connection.to] ?: return@forEach
            if (start.visibility < 0.45f || end.visibility < 0.45f) return@forEach
            linePaint.color = colorFor(current.feedback.segmentLevels[connection.segment] ?: current.feedback.level, 150)
            linePaint.strokeWidth = if (current.feedback.segmentLevels[connection.segment] == PoseFeedbackLevel.BAD) 8f else 6f
            canvas.drawLine(mirrorX(start.x) * width, start.y * height, mirrorX(end.x) * width, end.y * height, linePaint)
        }

        visibleLandmarks.forEach { index ->
            val point = current.landmarks[index] ?: return@forEach
            if (point.visibility < 0.45f) return@forEach
            pointPaint.color = colorFor(current.feedback.level, 210)
            canvas.drawCircle(mirrorX(point.x) * width, point.y * height, 7.2f, pointPaint)
        }
    }

    private fun mirrorX(x: Float): Float = 1f - x

    private fun drawGuide(canvas: android.graphics.Canvas) {
        val left = width * guideBounds.left
        val top = height * guideBounds.top
        val right = width * guideBounds.right
        val bottom = height * guideBounds.bottom
        val rect = RectF(left, top, right, bottom)
        val radius = width * 0.035f
        val current = frame
        val ready = current?.feedback?.level == PoseFeedbackLevel.GOOD
        if (ready) {
            canvas.drawRoundRect(rect, radius, radius, guideGlowPaint)
        }
        canvas.drawRoundRect(rect, radius, radius, guideFillPaint)
        canvas.drawRoundRect(rect, radius, radius, guidePaint)
        canvas.drawLine(width * 0.5f, top, width * 0.5f, bottom, guidePaint)
    }

    private fun colorFor(level: PoseFeedbackLevel, alpha: Int): Int =
        when (level) {
            PoseFeedbackLevel.GOOD -> Color.argb(alpha, 103, 255, 134)
            PoseFeedbackLevel.WARNING -> Color.argb(alpha, 255, 213, 76)
            PoseFeedbackLevel.BAD -> Color.argb(alpha, 255, 76, 76)
        }

    private data class Connection(val from: Int, val to: Int, val segment: PoseSegment)

    data class GuideBounds(
        val left: Float = 0.15f,
        val top: Float = 0.08f,
        val right: Float = 0.85f,
        val bottom: Float = 0.92f
    )

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
