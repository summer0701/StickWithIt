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
    private val previousGhostDeltas = mutableMapOf<String, Double>()
    private val minimumSpeakGapMillis = 15_000L

    fun resetGhostState() {
        previousGhostDeltas.clear()
        recentCategories.clear()
    }

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
            targetDistanceMeters > 0.0 && remainingMeters in 0.0..500.0 -> "finish_push"
            targetDistanceMeters > 0.0 && remainingMeters in 0.0..1000.0 -> "one_km_left"
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
            GhostComparison(ghost, ghostDistance, currentDistanceMeters - ghostDistance)
        }
        if (comparisons.isEmpty()) return "warmup"

        val selected = pickPriorityGhost(comparisons) ?: return "warmup"
        val transition = ghostTransitionFor(selected)
        if (transition != null) {
            rememberGhostDeltas(comparisons)
            return transition
        }

        rememberGhostDeltas(comparisons)
        val status = when {
            abs(selected.deltaMeters) <= 30.0 -> "close"
            selected.ghost.key == "bestGhost" && selected.deltaMeters > 30.0 -> "personal_record"
            selected.deltaMeters > 0.0 -> "ahead"
            else -> "behind"
        }
        return status
    }

    private fun distanceAtElapsed(ghost: GhostRunner, elapsedSeconds: Int): Double? {
        if (ghost.checkpoints.isNotEmpty()) {
            return ghost.checkpoints.minByOrNull { abs(it.elapsedSeconds - elapsedSeconds) }?.distanceMeters
        }
        if (ghost.totalElapsedSeconds <= 0.0 || ghost.totalDistanceMeters <= 0.0) return null
        return minOf(ghost.totalDistanceMeters, ghost.totalDistanceMeters / ghost.totalElapsedSeconds * elapsedSeconds)
    }

    private fun pickPriorityGhost(comparisons: List<GhostComparison>): GhostComparison? {
        val closest = comparisons.minByOrNull { abs(it.deltaMeters) }
        if (closest != null && abs(closest.deltaMeters) <= 30.0) return closest

        for (priority in ghostPriority) {
            comparisons.firstOrNull { it.ghost.key == priority }?.let { return it }
        }

        return closest
    }

    private fun ghostTransitionFor(selected: GhostComparison): String? {
        val previousDelta = previousGhostDeltas[selected.ghost.key] ?: return null
        return when {
            previousDelta < -10.0 && selected.deltaMeters >= 10.0 -> "overtake"
            previousDelta > 10.0 && selected.deltaMeters <= -10.0 -> "overtaken"
            else -> null
        }
    }

    private fun rememberGhostDeltas(comparisons: List<GhostComparison>) {
        previousGhostDeltas.clear()
        comparisons.forEach { previousGhostDeltas[it.ghost.key] = it.deltaMeters }
    }

    private fun fallbackTextFor(category: String): String =
        when (category) {
            "start" -> "고스트 런 시작. 오늘의 상대는 어제의 나다."
            "warmup" -> "아직 몸을 푸는 구간이다. 서두르지 마."
            "ahead" -> "좋아. 고스트보다 3초 앞서고 있다."
            "behind" -> "고스트보다 3초 뒤다. 금방 따라간다."
            "close" -> "3초 차이다. 거의 붙었다."
            "overtake" -> "좋아! 방금 고스트를 추월했다."
            "overtaken" -> "고스트에게 다시 추월당했다."
            "halfway" -> "절반을 넘었다."
            "one_km_left" -> "1킬로미터 남았다."
            "finish_push" -> "500미터 남았다."
            "personal_record" -> "개인 최고 기록보다 5초 빠르다."
            "tired" -> "힘든 건 정상이다."
            "slow_down" -> "호흡이 거칠다. 조금만 늦추자."
            "encouragement" -> "좋아. 지금 리듬이 정말 좋다."
            "completed" -> "러닝 완료. 오늘도 과거의 나를 이겼다."
            else -> "좋아. 지금 리듬이 정말 좋다."
        }

    private fun priorityFor(category: String): Int =
        when (category) {
            "completed" -> 110
            "finish_push" -> 100
            "one_km_left" -> 95
            "personal_record" -> 90
            "overtake" -> 88
            "overtaken" -> 86
            "close" -> 80
            "ahead", "behind" -> 70
            "halfway" -> 60
            "tired" -> 50
            "slow_down" -> 45
            "encouragement" -> 35
            "warmup" -> 30
            else -> 20
        }

    private fun remember(category: String) {
        recentCategories.addLast(category)
        while (recentCategories.size > 12) recentCategories.removeFirst()
    }

    companion object {
        private val ghostPriority = listOf(
            "bestGhost",
            "yesterdayGhost",
            "averageGhost",
            "recentGhost",
            "slowGhost"
        )

    }
}
