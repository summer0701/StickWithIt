package com.stickwithit.endure

import kotlin.math.abs
import kotlin.math.roundToInt

data class CoachCue(
    val type: String,
    val message: String,
    val priority: Int
)

class RuleBasedCoach {
    private var lastSpokenAtMillis = 0L
    private val recentMessages = ArrayDeque<String>()
    private val previousGhostDeltas = mutableMapOf<String, Double>()
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

        val elapsedMinutes = (elapsedSeconds / 60).coerceAtLeast(1)
        val roundedDistance = distanceMeters.roundToInt()
        val remainingMeters = targetDistanceMeters - distanceMeters
        val paceText = paceSecondsPerKm?.let { formatPace(it) }
        val type = when {
            targetDistanceMeters > 0 && remainingMeters in 0.0..1000.0 -> "finish_push"
            targetDistanceMeters > 0 && distanceMeters >= targetDistanceMeters * 0.8 -> "milestone"
            ghostRunners.isNotEmpty() -> "ghost"
            paceSecondsPerKm != null && speedKmh > 0 -> "checkpoint"
            else -> "neutral"
        }

        val candidates = when (type) {
            "finish_push" -> listOf(
                "1킬로미터 남았어. 지금 포기하면 어제의 너한테 진다.",
                "마지막 1킬로미터야. 다리는 무거워도 리듬은 아직 살아 있어.",
                "끝이 보인다. 호흡 하나만 더 붙잡고 밀어붙이자.",
                "이제 남은 건 버티는 힘이야. 오늘의 너를 증명할 시간이다."
            )
            "milestone" -> listOf(
                "목표의 80퍼센트를 넘었어. 여기서부터 진짜 승부야.",
                "거의 다 왔어. 지금부터는 몸보다 마음이 먼저 달린다.",
                "마지막 구간에 들어왔어. 자세 낮추고 리듬 유지하자.",
                "여기까지 온 것만으로도 강해졌어. 이제 마무리하자."
            )
            "ghost" -> listOf(createGhostMessage(elapsedSeconds, distanceMeters, ghostRunners))
            "checkpoint" -> listOf(
                "좋아, ${elapsedMinutes}분 지났어. 지금 ${roundedDistance}미터 달렸어.",
                "${elapsedMinutes}분 통과. 현재 거리 ${roundedDistance}미터, 계속 일정하게 가자.",
                "지금 ${roundedDistance}미터야. 호흡이 흔들리면 팔 리듬부터 맞춰.",
                "${elapsedMinutes}분째야. 오늘의 기록은 지금 이 1분에서 만들어지고 있어.",
                paceText?.let { "${elapsedMinutes}분 지났어. 평균 페이스는 ${it}야. 지금 흐름을 기억해." }
                    ?: "${elapsedMinutes}분 지났어. 지금 흐름을 기억해."
            )
            else -> listOf(
                "지금 너는 5명의 과거의 너와 달리고 있다.",
                "좋아. 지금처럼 호흡을 일정하게 유지하자.",
                "어깨 힘 빼고 시선은 앞으로. 리듬만 잃지 마.",
                "잘하고 있어. 다음 1분도 지금처럼 차분하게 가자.",
                "지금은 꾸준함이 이기는 구간이야. 계속 가자.",
                "발은 가볍게, 호흡은 길게. 끝까지 버티자."
            )
        }

        val message = pickMessage(candidates, elapsedMinutes, roundedDistance)
        lastSpokenAtMillis = nowMillis
        remember(message)
        return CoachCue(type, message, priorityFor(type))
    }

    private fun createGhostMessage(
        elapsedSeconds: Int,
        currentDistanceMeters: Double,
        ghostRunners: List<GhostRunner>
    ): String {
        val comparisons = ghostRunners.mapNotNull { ghost ->
            val ghostDistance = distanceAtElapsed(ghost, elapsedSeconds) ?: return@mapNotNull null
            GhostComparison(
                ghost = ghost,
                ghostDistanceMeters = ghostDistance,
                deltaMeters = currentDistanceMeters - ghostDistance
            )
        }
        if (comparisons.isEmpty()) return "지금 너는 5명의 과거의 너와 달리고 있다. 오늘의 너를 계속 밀고 가자."

        val passed = comparisons
            .filter { comparison ->
                val previous = previousGhostDeltas[comparison.ghost.key]
                (previous != null && previous < 0.0 && comparison.deltaMeters >= 0.0) ||
                    comparison.deltaMeters in 0.0..15.0
            }
            .minByOrNull { abs(it.deltaMeters) }
        if (passed != null) {
            rememberGhostDeltas(comparisons)
            return "${passed.ghost.label}를 방금 잡았다. 오늘의 너가 과거의 너들을 하나씩 넘어서고 있다."
        }

        val passedBy = comparisons
            .filter { comparison ->
                val previous = previousGhostDeltas[comparison.ghost.key]
                (previous != null && previous >= 0.0 && comparison.deltaMeters < 0.0) ||
                    comparison.deltaMeters in -15.0..0.0
            }
            .minByOrNull { abs(it.deltaMeters) }
        if (passedBy != null) {
            rememberGhostDeltas(comparisons)
            return "${passedBy.ghost.label}가 바로 앞 ${abs(passedBy.deltaMeters).roundToInt()}미터다. 다음 1분 안에 잡을 수 있어."
        }

        val closest = comparisons.minByOrNull { abs(it.deltaMeters) }
        val selected = closest
            ?: comparisons.firstOrNull { it.ghost.key == "bestGhost" }
            ?: comparisons.firstOrNull { it.ghost.key == "yesterdayGhost" }
            ?: comparisons.firstOrNull { it.ghost.key == "averageGhost" }
            ?: comparisons.first()

        rememberGhostDeltas(comparisons)
        return buildGhostLine(selected)
    }

    private fun buildGhostLine(comparison: GhostComparison): String {
        val meters = abs(comparison.deltaMeters).roundToInt()
        if (comparison.deltaMeters >= 0.0) {
            return when (comparison.ghost.key) {
                "slowGhost" -> "끝까지 버틴 나는 ${meters}미터 뒤에 있어. 오늘 컨디션 좋다."
                "averageGhost" -> "평균 페이스의 너는 ${meters}미터 뒤에 있다. 오늘의 네가 앞선다."
                else -> "${comparison.ghost.label}는 ${meters}미터 뒤에 있어. 오늘의 네가 앞선다."
            }
        }

        return when {
            comparison.ghost.key == "bestGhost" -> "최고기록의 너는 아직 ${meters}미터 앞에 있어. 하지만 격차가 줄고 있다."
            meters <= 30 -> "${comparison.ghost.label}가 바로 앞 ${meters}미터다. 다음 1분 안에 잡을 수 있어."
            else -> "${comparison.ghost.label}는 아직 ${meters}미터 앞에 있어. 리듬을 지키면 따라간다."
        }
    }

    private fun distanceAtElapsed(ghost: GhostRunner, elapsedSeconds: Int): Double? {
        if (ghost.checkpoints.isNotEmpty()) {
            return ghost.checkpoints.minByOrNull { abs(it.elapsedSeconds - elapsedSeconds) }?.distanceMeters
        }
        if (ghost.totalElapsedSeconds <= 0.0 || ghost.totalDistanceMeters <= 0.0) return null
        return minOf(ghost.totalDistanceMeters, ghost.totalDistanceMeters / ghost.totalElapsedSeconds * elapsedSeconds)
    }

    private fun rememberGhostDeltas(comparisons: List<GhostComparison>) {
        comparisons.forEach { previousGhostDeltas[it.ghost.key] = it.deltaMeters }
    }

    private fun pickMessage(candidates: List<String>, elapsedMinutes: Int, roundedDistance: Int): String {
        val fresh = candidates.firstOrNull { !recentMessages.contains(it) }
        if (fresh != null) return fresh
        return candidates[(elapsedMinutes + abs(roundedDistance)) % candidates.size]
    }

    private fun remember(message: String) {
        recentMessages.addLast(message)
        while (recentMessages.size > 12) recentMessages.removeFirst()
    }

    private fun formatPace(totalSeconds: Int): String {
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return "${minutes}분 ${seconds.toString().padStart(2, '0')}초"
    }

    private fun priorityFor(type: String): Int =
        when (type) {
            "finish_push" -> 100
            "milestone" -> 90
            "ghost" -> 80
            "checkpoint" -> 40
            else -> 20
        }
}
