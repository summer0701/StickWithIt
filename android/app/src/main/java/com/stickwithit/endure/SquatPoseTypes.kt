package com.stickwithit.endure

data class PosePoint(
    val x: Float,
    val y: Float,
    val visibility: Float = 1f
)

enum class PoseFeedbackLevel {
    GOOD,
    WARNING,
    BAD
}

enum class PoseSegment {
    LEFT_ARM,
    RIGHT_ARM,
    LEFT_TORSO,
    RIGHT_TORSO,
    LEFT_THIGH,
    RIGHT_THIGH,
    LEFT_SHIN,
    RIGHT_SHIN
}

data class SquatPoseFeedback(
    val level: PoseFeedbackLevel,
    val label: String,
    val detail: String,
    val segmentLevels: Map<PoseSegment, PoseFeedbackLevel> = emptyMap()
)

data class SquatPoseFrame(
    val landmarks: Map<Int, PosePoint>,
    val feedback: SquatPoseFeedback,
    val modelTier: String,
    val fps: Float
)
