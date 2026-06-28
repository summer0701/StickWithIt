package com.stickwithit.endure

import kotlin.math.abs

data class CoachCue(
    val category: String,
    val fallbackText: String,
    val priority: Int
) {
    val type: String = category
    val message: String = fallbackText
}

class RuleBasedCoach {
    private var lastSpokenAtMillis = 0L
    private val recentCategories = ArrayDeque<String>()
    private val minimumSpeakGapMillis = 55_000L

    fun createCue(
        elapsedSeconds: Int,
        distanceMeters: Double,
        paceSecondsPerKm: Int?,
        speedKmh: Double,
        targetDistanceMeters: Double,
        ghostRunners: List<GhostRunner>,
        nowMillis: Long = System.currentTimeMillis()
    ): CoachCue? {
        if (nowMillis - lastSpokenAtMillis < minimumSpeakGapMillis) return null

        val remainingMeters = targetDistanceMeters - distanceMeters
        val category = when {
            targetDistanceMeters > 0.0 && remainingMeters in 0.0..1000.0 -> "one_km_left"
            targetDistanceMeters > 0.0 && distanceMeters >= targetDistanceMeters * 0.9 -> "finish_push"
            targetDistanceMeters > 0.0 && distanceMeters >= targetDistanceMeters * 0.5 && distanceMeters < targetDistanceMeters * 0.55 -> "halfway"
            ghostRunners.isNotEmpty() -> ghostCategory(elapsedSeconds, distanceMeters, ghostRunners)
            speedKmh > 0.0 && speedKmh < 5.0 -> "tired"
            paceSecondsPerKm != null -> "warmup"
            else -> "warmup"
        }

        lastSpokenAtMillis = nowMillis
        remember(category)
        return CoachCue(category, fallbackTextFor(category), priorityFor(category))
    }

    private fun ghostCategory(
        elapsedSeconds: Int,
        currentDistanceMeters: Double,
        ghostRunners: List<GhostRunner>
    ): String {
        val comparisons = ghostRunners.mapNotNull { ghost ->
            val ghostDistance = distanceAtElapsed(ghost, elapsedSeconds) ?: return@mapNotNull null
            currentDistanceMeters - ghostDistance
        }
        if (comparisons.isEmpty()) return "warmup"

        val closest = comparisons.minByOrNull { abs(it) } ?: return "warmup"
        return when {
            abs(closest) <= 30.0 -> "close"
            closest > 0.0 -> "ahead"
            else -> "behind"
        }
    }

    private fun distanceAtElapsed(ghost: GhostRunner, elapsedSeconds: Int): Double? {
        if (ghost.checkpoints.isNotEmpty()) {
            return ghost.checkpoints.minByOrNull { abs(it.elapsedSeconds - elapsedSeconds) }?.distanceMeters
        }
        if (ghost.totalElapsedSeconds <= 0.0 || ghost.totalDistanceMeters <= 0.0) return null
        return minOf(ghost.totalDistanceMeters, ghost.totalDistanceMeters / ghost.totalElapsedSeconds * elapsedSeconds)
    }

    private fun fallbackTextFor(category: String): String =
        when (category) {
            "start" -> "달리기 시작. 오늘도 과거의 너와 경쟁한다."
            "ahead" -> "어제의 너보다 앞서고 있어. 이 페이스 유지해."
            "behind" -> "조금 뒤처졌어. 호흡부터 다시 잡자."
            "close" -> "거의 따라잡았어. 지금부터 집중하자."
            "halfway" -> "절반을 넘었어. 지금부터 버티는 사람이 이긴다."
            "one_km_left" -> "마지막 1킬로미터야. 지금부터가 진짜 승부다."
            "finish_push" -> "끝이 보인다. 마지막까지 밀어붙여."
            "personal_record" -> "개인 기록이 보인다. 이 페이스면 충분해."
            "tired" -> "힘든 구간이야. 어깨 힘 빼고 호흡을 길게 가져가."
            "slow_down" -> "호흡이 거칠면 살짝 늦춰도 괜찮아."
            "completed" -> "러닝 완료. 오늘도 끝까지 버텼다."
            else -> "좋아. 지금 리듬 괜찮아."
        }

    private fun priorityFor(category: String): Int =
        when (category) {
            "completed" -> 110
            "finish_push" -> 100
            "one_km_left" -> 95
            "personal_record" -> 90
            "close" -> 80
            "ahead", "behind" -> 70
            "halfway" -> 60
            "tired" -> 50
            "slow_down" -> 45
            "warmup" -> 30
            else -> 20
        }

    private fun remember(category: String) {
        recentCategories.addLast(category)
        while (recentCategories.size > 12) recentCategories.removeFirst()
    }
}
