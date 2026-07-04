package com.stickwithit.endure

import android.util.Log
import kotlin.math.abs

class JumpingJackPoseEvaluator : SmoothedPoseEvaluator() {
    override val metric = PoseExerciseMetric.REPETITION
    private var phase = JumpingJackPhase.CLOSED
    private var opened = false
    private var lastRepAt = 0L
    private var closedAnkleWidth: Float? = null
    private val closedAnkleSamples = ArrayDeque<Float>()
    private var lastWristsUpAt = 0L
    private var lastWristsDownAt = 0L
    private var openFrameCount = 0
    private var closedFrameCount = 0

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
        val baseline = stableClosedAnkleWidth()
        val ankleVisibilityReliable = leftAnkle.visibility >= BASELINE_VISIBILITY &&
            rightAnkle.visibility >= BASELINE_VISIBILITY
        if (!ankleVisibilityReliable) {
            openFrameCount = 0
            closedFrameCount = 0
            debugCounterState(
                ankleWidth = ankleWidth,
                baseline = baseline,
                openThreshold = baseline * OPEN_ANKLE_MULTIPLIER,
                closeThreshold = baseline * CLOSE_ANKLE_MULTIPLIER,
                wristsVisible = false,
                recentWristsUp = nowMs - lastWristsUpAt <= ARM_GRACE_MS,
                recentWristsDown = nowMs - lastWristsDownAt <= ARM_GRACE_MS,
                stableOpen = false,
                stableClosed = false
            )
            return
        }
        if (phase == JumpingJackPhase.CLOSED &&
            ankleVisibilityReliable &&
            shouldLearnClosedBaseline(ankleWidth, baseline)
        ) {
            updateClosedAnkleBaseline(ankleWidth)
        }

        val wristsVisible = leftWrist.visibility >= WRIST_VISIBILITY &&
            rightWrist.visibility >= WRIST_VISIBILITY
        val wristsUp = wristsVisible &&
            leftWrist.y < head.y + WRIST_UP_HEAD_OFFSET &&
            rightWrist.y < head.y + WRIST_UP_HEAD_OFFSET
        val wristsDown = wristsVisible &&
            leftWrist.y > head.y + WRIST_DOWN_HEAD_OFFSET &&
            rightWrist.y > head.y + WRIST_DOWN_HEAD_OFFSET
        if (wristsUp) lastWristsUpAt = nowMs
        if (wristsDown) lastWristsDownAt = nowMs

        val recentWristsUp = nowMs - lastWristsUpAt <= ARM_GRACE_MS
        val recentWristsDown = nowMs - lastWristsDownAt <= ARM_GRACE_MS
        val handMissing = !wristsVisible
        val openThreshold = baseline * if (handMissing) OPEN_ANKLE_HAND_MISSING_MULTIPLIER else OPEN_ANKLE_MULTIPLIER
        val closeThreshold = baseline * if (handMissing) CLOSE_ANKLE_HAND_MISSING_MULTIPLIER else CLOSE_ANKLE_MULTIPLIER
        val feetClearlyOpen = ankleWidth > baseline * FEET_CLEARLY_OPEN_MULTIPLIER
        val feetOpen = ankleWidth > openThreshold
        val feetClearlyClosed = ankleWidth < baseline * FEET_CLEARLY_CLOSED_MULTIPLIER
        val feetClosed = ankleWidth < closeThreshold
        val isOpen = feetClearlyOpen || (feetOpen && (handMissing || recentWristsUp || wristsUp))
        val isClosed = feetClearlyClosed || (feetClosed && (handMissing || recentWristsDown || wristsDown))

        openFrameCount = if (isOpen) openFrameCount + 1 else 0
        closedFrameCount = if (isClosed) closedFrameCount + 1 else 0
        val stableOpen = openFrameCount >= REQUIRED_STABLE_FRAMES
        val stableClosed = closedFrameCount >= REQUIRED_STABLE_FRAMES

        debugCounterState(
            ankleWidth = ankleWidth,
            baseline = baseline,
            openThreshold = openThreshold,
            closeThreshold = closeThreshold,
            wristsVisible = wristsVisible,
            recentWristsUp = recentWristsUp,
            recentWristsDown = recentWristsDown,
            stableOpen = stableOpen,
            stableClosed = stableClosed
        )

        when (phase) {
            JumpingJackPhase.CLOSED -> {
                if (stableOpen) {
                    phase = JumpingJackPhase.OPEN
                    opened = true
                    openFrameCount = 0
                    closedFrameCount = 0
                }
            }
            JumpingJackPhase.OPEN -> {
                if (opened && stableClosed && nowMs - lastRepAt > REP_COOLDOWN_MS) {
                    onRep()
                    lastRepAt = nowMs
                    phase = JumpingJackPhase.CLOSED
                    opened = false
                    openFrameCount = 0
                    closedFrameCount = 0
                }
            }
        }
    }

    private fun stableClosedAnkleWidth(): Float {
        return (closedAnkleWidth ?: DEFAULT_CLOSED_ANKLE_WIDTH)
            .coerceIn(MIN_CLOSED_ANKLE_WIDTH, MAX_CLOSED_ANKLE_WIDTH)
    }

    private fun updateClosedAnkleBaseline(ankleWidth: Float) {
        val safeWidth = ankleWidth.coerceIn(MIN_CLOSED_ANKLE_WIDTH, MAX_CLOSED_ANKLE_WIDTH)
        closedAnkleSamples.addLast(safeWidth)
        while (closedAnkleSamples.size > CLOSED_SAMPLE_LIMIT) {
            closedAnkleSamples.removeFirst()
        }
        val median = closedAnkleSamples.sorted()[closedAnkleSamples.size / 2]
        closedAnkleWidth = closedAnkleWidth?.let { previous ->
            previous * BASELINE_SMOOTHING_KEEP + median * (1f - BASELINE_SMOOTHING_KEEP)
        } ?: median
    }

    private fun shouldLearnClosedBaseline(ankleWidth: Float, baseline: Float): Boolean {
        if (closedAnkleWidth == null) {
            return ankleWidth in MIN_CLOSED_ANKLE_WIDTH..MAX_CLOSED_ANKLE_WIDTH
        }
        return ankleWidth < baseline * BASELINE_SAMPLE_MAX_MULTIPLIER
    }

    private fun debugCounterState(
        ankleWidth: Float,
        baseline: Float,
        openThreshold: Float,
        closeThreshold: Float,
        wristsVisible: Boolean,
        recentWristsUp: Boolean,
        recentWristsDown: Boolean,
        stableOpen: Boolean,
        stableClosed: Boolean
    ) {
        if (!runCatching { Log.isLoggable(TAG, Log.DEBUG) }.getOrDefault(false)) return
        Log.d(
            TAG,
            "ankleWidth=$ankleWidth baseline=$baseline openThreshold=$openThreshold " +
                "closeThreshold=$closeThreshold wristsVisible=$wristsVisible " +
                "recentWristsUp=$recentWristsUp recentWristsDown=$recentWristsDown " +
                "phase=$phase stableOpen=$stableOpen stableClosed=$stableClosed"
        )
    }

    private enum class JumpingJackPhase {
        CLOSED,
        OPEN
    }

    companion object {
        private const val TAG = "JumpingJackCounter"
        private val requiredLandmarks = listOf(0, 15, 16, 27, 28)
        private const val CLOSED_SAMPLE_LIMIT = 12
        private const val BASELINE_VISIBILITY = 0.45f
        private const val WRIST_VISIBILITY = 0.35f
        private const val DEFAULT_CLOSED_ANKLE_WIDTH = 0.12f
        private const val MIN_CLOSED_ANKLE_WIDTH = 0.055f
        private const val MAX_CLOSED_ANKLE_WIDTH = 0.18f
        private const val BASELINE_SAMPLE_MAX_MULTIPLIER = 1.20f
        private const val BASELINE_SMOOTHING_KEEP = 0.86f
        private const val OPEN_ANKLE_MULTIPLIER = 1.28f
        private const val OPEN_ANKLE_HAND_MISSING_MULTIPLIER = 1.35f
        private const val CLOSE_ANKLE_MULTIPLIER = 1.18f
        private const val CLOSE_ANKLE_HAND_MISSING_MULTIPLIER = 1.12f
        private const val FEET_CLEARLY_OPEN_MULTIPLIER = 1.35f
        private const val FEET_CLEARLY_CLOSED_MULTIPLIER = 1.10f
        private const val WRIST_UP_HEAD_OFFSET = 0.18f
        private const val WRIST_DOWN_HEAD_OFFSET = 0.20f
        private const val ARM_GRACE_MS = 450L
        private const val REQUIRED_STABLE_FRAMES = 2
        private const val REP_COOLDOWN_MS = 600L
    }
}
