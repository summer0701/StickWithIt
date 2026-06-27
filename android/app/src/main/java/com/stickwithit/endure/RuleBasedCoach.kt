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
    private val minimumSpeakGapMillis = 55_000L

    fun createCue(
        elapsedSeconds: Int,
        distanceMeters: Double,
        paceSecondsPerKm: Int?,
        speedKmh: Double,
        targetDistanceMeters: Double,
        recentAverageDistanceMeters: Double?,
        recentBestDeltaSeconds: Int?,
        nowMillis: Long = System.currentTimeMillis()
    ): CoachCue? {
        if (nowMillis - lastSpokenAtMillis < minimumSpeakGapMillis) return null

        val elapsedMinutes = (elapsedSeconds / 60).coerceAtLeast(1)
        val roundedDistance = distanceMeters.roundToInt()
        val remainingMeters = targetDistanceMeters - distanceMeters
        val paceText = paceSecondsPerKm?.let { formatPace(it) }
        val type = when {
            targetDistanceMeters > 0 && remainingMeters in 0.0..1000.0 -> "finish_push"
            recentBestDeltaSeconds != null && recentBestDeltaSeconds > 5 -> "ahead"
            recentBestDeltaSeconds != null && recentBestDeltaSeconds < -5 -> "behind"
            targetDistanceMeters > 0 && distanceMeters >= targetDistanceMeters * 0.8 -> "milestone"
            recentAverageDistanceMeters != null && distanceMeters >= recentAverageDistanceMeters -> "ahead"
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
            "ahead" -> listOf(
                "어제의 너보다 ${recentBestDeltaSeconds ?: 0}초 빠르다. 계속 밀어붙여.",
                "좋아, 지금 최근 기록 평균보다 앞서고 있어. 이 페이스 유지해!",
                "지금 흐름 좋다. 무리하지 말고 이 리듬 그대로 가져가자.",
                "방금 과거의 너를 넘어서는 페이스야. 오늘 진짜 잘하고 있어.",
                "앞서고 있어. 욕심내지 말고 정확하게 한 걸음씩 가자."
            )
            "behind" -> listOf(
                "괜찮아. 아직 충분히 따라잡을 수 있어. 호흡만 유지하자.",
                "조금 늦어도 끝난 건 아니야. 어깨 힘 빼고 다시 리듬 잡자.",
                "지금은 회복 구간이야. 보폭보다 호흡을 먼저 안정시키자.",
                "흔들려도 괜찮아. 다음 1분만 다시 집중하자.",
                "뒤처진 만큼 급하게 뛰지 마. 리듬을 되찾으면 충분히 따라간다."
            )
            "milestone" -> listOf(
                "목표의 80퍼센트를 넘었어. 여기서부터 진짜 승부야.",
                "거의 다 왔어. 지금부터는 몸보다 마음이 먼저 달린다.",
                "마지막 구간에 들어왔어. 자세 낮추고 리듬 유지하자.",
                "여기까지 온 것만으로도 강해졌어. 이제 마무리하자."
            )
            "checkpoint" -> listOf(
                "좋아, ${elapsedMinutes}분 지났어. 지금 ${roundedDistance}미터 달렸어.",
                "${elapsedMinutes}분 통과. 현재 거리 ${roundedDistance}미터, 계속 일정하게 가자.",
                "지금 ${roundedDistance}미터야. 호흡이 흔들리면 팔 리듬부터 맞춰.",
                "${elapsedMinutes}분째야. 오늘의 기록은 지금 이 1분에서 만들어지고 있어.",
                paceText?.let { "${elapsedMinutes}분 지났어. 평균 페이스는 ${it}야. 지금 흐름을 기억해." }
                    ?: "${elapsedMinutes}분 지났어. 지금 흐름을 기억해."
            )
            else -> listOf(
                "좋아. 지금처럼 호흡을 일정하게 유지하자.",
                "어깨 힘 빼고 시선은 앞으로. 리듬만 잃지 마.",
                "잘하고 있어. 다음 1분도 지금처럼 차분하게 가자.",
                "지금은 꾸준함이 이기는 구간이야. 계속 가자.",
                "발은 가볍게, 호흡은 길게. 끝까지 버티자."
            )
        }.filterNotNull()

        val message = pickMessage(candidates, elapsedMinutes, roundedDistance)
        lastSpokenAtMillis = nowMillis
        remember(message)
        return CoachCue(type, message, priorityFor(type))
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
            "ahead" -> 80
            "behind" -> 70
            "checkpoint" -> 40
            else -> 20
        }
}
