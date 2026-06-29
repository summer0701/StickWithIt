package com.stickwithit.endure

import kotlin.math.abs
import kotlin.math.roundToInt

class RuleBasedCoach {
    private var lastSpokenAtMillis = 0L
    private var previousRank: Int? = null
    private var previousSpeedKmh: Double? = null
    private val recentTexts = ArrayDeque<String>()
    private val previousGhostDeltas = mutableMapOf<String, Double>()
    private val minimumSpeakGapMillis = 45_000L

    fun resetGhostState() {
        previousGhostDeltas.clear()
        previousRank = null
        previousSpeedKmh = null
    }

    fun createCue(
        elapsedSeconds: Int,
        distanceMeters: Double,
        paceSecondsPerKm: Int?,
        speedKmh: Double,
        targetDistanceMeters: Double,
        ghostRunners: List<GhostRunner>,
        nowMillis: Long = System.currentTimeMillis()
    ): NativeTtsCue? {
        val decision = decideCategory(
            elapsedSeconds = elapsedSeconds,
            distanceMeters = distanceMeters,
            paceSecondsPerKm = paceSecondsPerKm,
            speedKmh = speedKmh,
            targetDistanceMeters = targetDistanceMeters,
            ghostRunners = ghostRunners
        )

        if (!decision.immediate && nowMillis - lastSpokenAtMillis < minimumSpeakGapMillis) return null

        lastSpokenAtMillis = nowMillis
        val cue = GhostTtsCatalog.buildCue(
            category = decision.category,
            priority = priorityFor(decision.category),
            immediate = decision.immediate,
            recentTexts = recentTexts,
            ghostName = decision.ghostName,
            distance = decision.distanceText,
            seconds = decision.seconds,
            rank = decision.rank
        )
        remember(cue.text)
        return cue
    }

    fun startCue(ghostRunners: List<GhostRunner> = emptyList()): NativeTtsCue {
        val target = ghostRunners.firstOrNull()
        return rememberAndBuild(
            category = "start",
            immediate = true,
            ghostName = target?.label,
            distanceText = target?.totalDistanceMeters?.let { formatDistance(it) },
            rank = previousRank ?: 6
        )
    }

    fun completedCue(): NativeTtsCue =
        rememberAndBuild("completed", immediate = true, rank = previousRank ?: 6)

    private fun decideCategory(
        elapsedSeconds: Int,
        distanceMeters: Double,
        paceSecondsPerKm: Int?,
        speedKmh: Double,
        targetDistanceMeters: Double,
        ghostRunners: List<GhostRunner>
    ): CueDecision {
        val comparisons = compareGhosts(elapsedSeconds, distanceMeters, ghostRunners)
        val rank = rankFromComparisons(comparisons)
        val front = comparisons.filter { it.deltaMeters < 0.0 }.maxByOrNull { it.deltaMeters }
        val back = comparisons.filter { it.deltaMeters >= 0.0 }.minByOrNull { it.deltaMeters }
        val target = front ?: back
        val remainingMeters = targetDistanceMeters - distanceMeters

        val transition = transitionDecision(comparisons, rank)
        rememberGhostDeltas(comparisons)
        val rankChange = rankChangeDecision(rank, transition)
        previousRank = rank

        val paceDecision = paceDecision(speedKmh, front, back, rank)
        previousSpeedKmh = speedKmh.takeIf { it > 0.0 } ?: previousSpeedKmh

        return when {
            transition != null -> transition
            rankChange != null -> rankChange
            targetDistanceMeters > 0.0 && remainingMeters in 0.0..500.0 ->
                decisionFor("finish_push", target, rank, immediate = true, fallbackDistanceMeters = remainingMeters)
            targetDistanceMeters > 0.0 && remainingMeters in 0.0..1000.0 ->
                decisionFor("one_km_left", front ?: target, rank, immediate = true, fallbackDistanceMeters = remainingMeters)
            front != null && abs(front.deltaMeters) <= CLOSE_GHOST_METERS ->
                decisionFor("close_front", front, rank, immediate = true)
            back != null && back.deltaMeters <= CLOSE_GHOST_METERS ->
                decisionFor("close_back", back, rank, immediate = true)
            front?.ghost?.key == "bestGhost" ->
                decisionFor("personal_best", front, rank)
            rank == 2 && front != null ->
                decisionFor("last_ghost", front, rank)
            paceDecision != null -> paceDecision
            front != null && elapsedSeconds % 90 < 45 ->
                decisionFor("front_distance", front, rank)
            back != null && elapsedSeconds % 135 < 45 ->
                decisionFor("back_distance", back, rank)
            front != null && elapsedSeconds % 180 < 45 ->
                decisionFor("gap_time", front, rank)
            else ->
                decisionFor("current_rank", target, rank, fallbackDistanceMeters = abs(target?.deltaMeters ?: 0.0))
        }
    }

    private fun compareGhosts(
        elapsedSeconds: Int,
        currentDistanceMeters: Double,
        ghostRunners: List<GhostRunner>
    ): List<GhostComparison> =
        ghostRunners.mapNotNull { ghost ->
            val ghostDistance = distanceAtElapsed(ghost, elapsedSeconds) ?: return@mapNotNull null
            GhostComparison(ghost, ghostDistance, currentDistanceMeters - ghostDistance)
        }

    private fun rankFromComparisons(comparisons: List<GhostComparison>): Int =
        (comparisons.count { it.deltaMeters < 0.0 } + 1).coerceIn(1, comparisons.size + 1)

    private fun transitionDecision(comparisons: List<GhostComparison>, rank: Int): CueDecision? {
        val transition = comparisons.firstNotNullOfOrNull { comparison ->
            val previousDelta = previousGhostDeltas[comparison.ghost.key] ?: return@firstNotNullOfOrNull null
            when {
                previousDelta < -GHOST_EVENT_METERS && comparison.deltaMeters >= GHOST_EVENT_METERS ->
                    "overtake" to comparison
                previousDelta > GHOST_EVENT_METERS && comparison.deltaMeters <= -GHOST_EVENT_METERS ->
                    "overtaken" to comparison
                else -> null
            }
        } ?: return null

        return decisionFor(transition.first, transition.second, rank, immediate = true)
    }

    private fun rankChangeDecision(rank: Int, alreadyHandled: CueDecision?): CueDecision? {
        if (alreadyHandled != null) return null
        val previous = previousRank ?: return null
        return when {
            rank < previous -> CueDecision("rank_up", immediate = true, rank = rank)
            rank > previous -> CueDecision("rank_down", immediate = true, rank = rank)
            else -> null
        }
    }

    private fun paceDecision(speedKmh: Double, front: GhostComparison?, back: GhostComparison?, rank: Int): CueDecision? {
        val previousSpeed = previousSpeedKmh ?: return null
        if (speedKmh <= 0.0) return null
        return when {
            speedKmh - previousSpeed >= 0.6 -> decisionFor("pace_change", front ?: back, rank)
            previousSpeed - speedKmh >= 0.6 -> decisionFor("pace_change", front ?: back, rank)
            front != null && abs(front.deltaMeters) <= 80.0 -> decisionFor("pace_change", front, rank)
            back != null && back.deltaMeters <= 80.0 -> decisionFor("pace_change", back, rank)
            else -> null
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
        previousGhostDeltas.clear()
        comparisons.forEach { previousGhostDeltas[it.ghost.key] = it.deltaMeters }
    }

    private fun priorityFor(category: String): Int =
        when (category) {
            "completed" -> 110
            "finish_push" -> 100
            "one_km_left" -> 95
            "rank_up", "rank_down" -> 92
            "personal_best" -> 90
            "overtake" -> 88
            "overtaken" -> 86
            "close_front", "close_back" -> 80
            "last_ghost" -> 78
            "next_target" -> 76
            "front_distance", "back_distance", "gap_time" -> 70
            "pace_change" -> 60
            "current_rank" -> 45
            else -> 20
        }

    private fun remember(text: String) {
        recentTexts.addLast(text)
        while (recentTexts.size > 12) recentTexts.removeFirst()
    }

    private fun rememberAndBuild(
        category: String,
        immediate: Boolean,
        ghostName: String? = null,
        distanceText: String? = null,
        seconds: Int? = null,
        rank: Int? = null
    ): NativeTtsCue {
        val cue = GhostTtsCatalog.buildCue(
            category = category,
            priority = priorityFor(category),
            immediate = immediate,
            recentTexts = recentTexts,
            ghostName = ghostName,
            distance = distanceText,
            seconds = seconds,
            rank = rank
        )
        remember(cue.text)
        return cue
    }

    private fun decisionFor(
        category: String,
        comparison: GhostComparison?,
        rank: Int,
        immediate: Boolean = false,
        fallbackDistanceMeters: Double = 0.0
    ): CueDecision {
        val distanceMeters = abs(comparison?.deltaMeters ?: fallbackDistanceMeters)
        val ghostSpeedMetersPerSecond = comparison?.ghost?.let { it.totalDistanceMeters / it.totalElapsedSeconds } ?: 0.0
        val seconds = if (ghostSpeedMetersPerSecond > 0.0) {
            maxOf(1, (distanceMeters / ghostSpeedMetersPerSecond).roundToInt())
        } else {
            3
        }

        return CueDecision(
            category = category,
            immediate = immediate,
            ghostName = comparison?.ghost?.label,
            distanceText = distanceMeters.takeIf { it >= 1.0 }?.let { formatDistance(it) },
            seconds = seconds,
            rank = rank
        )
    }

    private fun formatDistance(distanceMeters: Double): String {
        val meters = distanceMeters.coerceAtLeast(0.0)
        return if (meters >= 1000.0) {
            val km = meters / 1000.0
            if (abs(km - km.roundToInt()) < 0.05) "${km.roundToInt()}킬로미터" else String.format("%.1f킬로미터", km)
        } else {
            "${meters.roundToInt()}미터"
        }
    }

    companion object {
        private const val CLOSE_GHOST_METERS = 30.0
        private const val GHOST_EVENT_METERS = 10.0
    }
}

private data class CueDecision(
    val category: String,
    val immediate: Boolean = false,
    val ghostName: String? = null,
    val distanceText: String? = null,
    val seconds: Int? = null,
    val rank: Int? = null
)
