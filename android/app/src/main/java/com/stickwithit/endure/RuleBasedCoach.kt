package com.stickwithit.endure

import kotlin.math.abs
import kotlin.math.roundToInt

class RuleBasedCoach {
    private var lastSpokenAtMillis = 0L
    private val lastCategorySpokenAtMillis = mutableMapOf<String, Long>()
    private val spokenTemplateIds = mutableSetOf<String>()
    private var previousRank: Int? = null
    private var previousSpeedKmh: Double? = null
    private val previousGhostDeltas = mutableMapOf<String, Double>()
    private var lastFrontGhostId: String? = null
    private var lastBackGhostId: String? = null
    private var lastFrontDistanceBucket: DistanceBucket? = null
    private var lastBackDistanceBucket: DistanceBucket? = null
    private var completedSpoken = false

    fun resetGhostState() {
        previousGhostDeltas.clear()
        previousRank = null
        previousSpeedKmh = null
        lastFrontGhostId = null
        lastBackGhostId = null
        lastFrontDistanceBucket = null
        lastBackDistanceBucket = null
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
        val context = buildRaceContext(elapsedSeconds, distanceMeters, paceSecondsPerKm, speedKmh, targetDistanceMeters, ghostRunners)
        val decision = decideCategory(context) ?: return null
        rememberContext(context)

        if (!canSpeak(decision, nowMillis)) return null

        val cue = GhostTtsCatalog.buildCue(
            category = decision.category,
            priority = priorityFor(decision.category),
            immediate = decision.immediate,
            spokenTemplateIds = spokenTemplateIds,
            ghostName = decision.ghostName,
            distance = decision.distanceText,
            seconds = decision.seconds,
            rank = decision.rank
        ) ?: return null

        rememberSpoken(cue, nowMillis, context)
        return cue
    }

    fun startCue(ghostRunners: List<GhostRunner> = emptyList(), nowMillis: Long = System.currentTimeMillis()): NativeTtsCue? {
        val target = ghostRunners.firstOrNull()
        val cue = GhostTtsCatalog.buildCue(
            category = "start",
            priority = priorityFor("start"),
            immediate = true,
            spokenTemplateIds = spokenTemplateIds,
            ghostName = target?.label,
            distance = target?.totalDistanceMeters?.let { formatDistance(it) },
            rank = previousRank ?: (ghostRunners.size + 1).coerceAtLeast(1)
        ) ?: return null

        rememberSpoken(cue, nowMillis, null)
        return cue
    }

    fun completedCue(
        elapsedSeconds: Int = 0,
        distanceMeters: Double = 0.0,
        ghostRunners: List<GhostRunner> = emptyList(),
        nowMillis: Long = System.currentTimeMillis()
    ): NativeTtsCue? {
        if (completedSpoken) return null
        val comparisons = compareGhosts(elapsedSeconds, distanceMeters, ghostRunners)
        val rank = comparisons.takeIf { it.isNotEmpty() }?.let { rankFromComparisons(it) } ?: previousRank
        val cue = GhostTtsCatalog.buildCue(
            category = "completed",
            priority = priorityFor("completed"),
            immediate = true,
            spokenTemplateIds = spokenTemplateIds,
            rank = rank
        ) ?: return null

        completedSpoken = true
        rememberSpoken(cue, nowMillis, null)
        return cue
    }

    private fun decideCategory(context: RaceContext): CueDecision? {
        val transition = transitionDecision(context.comparisons, context.rank)
        val rankChange = rankChangeDecision(context.rank, transition)
        val paceDecision = paceDecision(context)

        return when {
            transition != null -> transition
            rankChange != null -> rankChange
            context.front != null && abs(context.front.deltaMeters) <= CLOSE_GHOST_METERS ->
                decisionFor("close_front", context.front, context.rank, immediate = true)
            context.back != null && context.back.deltaMeters <= CLOSE_GHOST_METERS ->
                decisionFor("close_back", context.back, context.rank, immediate = true)
            context.front?.ghost?.key == PERSONAL_BEST_GHOST_KEY ->
                decisionFor("personal_best", context.front, context.rank)
            context.rank == 2 && context.front != null ->
                decisionFor("last_ghost", context.front, context.rank)
            context.targetDistanceMeters > 0.0 && context.remainingMeters in 0.0..300.0 ->
                decisionFor("finish_push", context.front ?: context.target, context.rank, immediate = true, fallbackDistanceMeters = context.remainingMeters)
            context.targetDistanceMeters > 0.0 && context.remainingMeters in 0.0..1000.0 ->
                decisionFor("one_km_left", context.front ?: context.target, context.rank, immediate = true, fallbackDistanceMeters = context.remainingMeters)
            context.front != null && hasDistanceBucketChanged(context.front, isFront = true) ->
                decisionFor("front_distance", context.front, context.rank)
            context.back != null && hasDistanceBucketChanged(context.back, isFront = false) ->
                decisionFor("back_distance", context.back, context.rank)
            context.front != null ->
                decisionFor("gap_time", context.front, context.rank)
            paceDecision != null -> paceDecision
            context.target != null ->
                decisionFor("current_rank", context.target, context.rank, fallbackDistanceMeters = abs(context.target.deltaMeters))
            else ->
                CueDecision("fallback")
        }
    }

    private fun canSpeak(decision: CueDecision, nowMillis: Long): Boolean {
        val policy = policyFor(decision.category)
        val elapsedSinceLast = nowMillis - lastSpokenAtMillis
        val lastCategoryAt = lastCategorySpokenAtMillis[decision.category]
        val elapsedSinceCategory = lastCategoryAt?.let { nowMillis - it } ?: Long.MAX_VALUE

        if (!policy.ignoresGlobalCooldown && elapsedSinceLast < policy.globalCooldownMillis) return false
        if (elapsedSinceCategory < policy.categoryCooldownMillis) return false
        return true
    }

    private fun policyFor(category: String): SpeakPolicy =
        when (category) {
            "completed", "overtake", "overtaken", "rank_up", "rank_down" ->
                SpeakPolicy(globalCooldownMillis = 0L, categoryCooldownMillis = 0L, ignoresGlobalCooldown = true)
            "close_front", "close_back" ->
                SpeakPolicy(globalCooldownMillis = 20_000L, categoryCooldownMillis = 20_000L)
            "finish_push" ->
                SpeakPolicy(globalCooldownMillis = 15_000L, categoryCooldownMillis = 15_000L)
            "one_km_left" ->
                SpeakPolicy(globalCooldownMillis = 30_000L, categoryCooldownMillis = 30_000L)
            else ->
                SpeakPolicy(globalCooldownMillis = 45_000L, categoryCooldownMillis = 60_000L)
        }

    private fun rememberSpoken(cue: NativeTtsCue, nowMillis: Long, context: RaceContext?) {
        lastSpokenAtMillis = nowMillis
        lastCategorySpokenAtMillis[cue.category] = nowMillis
        spokenTemplateIds.add(cue.templateId)
        context?.let { rememberDistanceBuckets(it) }
    }

    private fun rememberContext(context: RaceContext) {
        previousRank = context.rank
        previousSpeedKmh = context.speedKmh.takeIf { it > 0.0 } ?: previousSpeedKmh
        previousGhostDeltas.clear()
        context.comparisons.forEach { previousGhostDeltas[it.ghost.key] = it.deltaMeters }
    }

    private fun rememberDistanceBuckets(context: RaceContext) {
        context.front?.let {
            lastFrontGhostId = it.ghost.key
            lastFrontDistanceBucket = DistanceBucket.from(abs(it.deltaMeters))
        }
        context.back?.let {
            lastBackGhostId = it.ghost.key
            lastBackDistanceBucket = DistanceBucket.from(abs(it.deltaMeters))
        }
    }

    private fun hasDistanceBucketChanged(comparison: GhostComparison, isFront: Boolean): Boolean {
        val nextBucket = DistanceBucket.from(abs(comparison.deltaMeters))
        val lastGhostId = if (isFront) lastFrontGhostId else lastBackGhostId
        val lastBucket = if (isFront) lastFrontDistanceBucket else lastBackDistanceBucket
        return lastGhostId != comparison.ghost.key || lastBucket != nextBucket
    }

    private fun buildRaceContext(
        elapsedSeconds: Int,
        distanceMeters: Double,
        paceSecondsPerKm: Int?,
        speedKmh: Double,
        targetDistanceMeters: Double,
        ghostRunners: List<GhostRunner>
    ): RaceContext {
        val comparisons = compareGhosts(elapsedSeconds, distanceMeters, ghostRunners)
        val rank = rankFromComparisons(comparisons)
        val front = comparisons.filter { it.deltaMeters < 0.0 }.maxByOrNull { it.deltaMeters }
        val back = comparisons.filter { it.deltaMeters >= 0.0 }.minByOrNull { it.deltaMeters }
        return RaceContext(
            elapsedSeconds = elapsedSeconds,
            distanceMeters = distanceMeters,
            paceSecondsPerKm = paceSecondsPerKm,
            speedKmh = speedKmh,
            targetDistanceMeters = targetDistanceMeters,
            remainingMeters = targetDistanceMeters - distanceMeters,
            comparisons = comparisons,
            rank = rank,
            front = front,
            back = back,
            target = front ?: back
        )
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

    private fun paceDecision(context: RaceContext): CueDecision? {
        val previousSpeed = previousSpeedKmh ?: return null
        if (context.speedKmh <= 0.0 || context.target == null) return null
        return when {
            abs(context.speedKmh - previousSpeed) >= 0.6 -> decisionFor("pace_change", context.target, context.rank)
            context.front != null && abs(context.front.deltaMeters) <= 80.0 -> decisionFor("pace_change", context.front, context.rank)
            context.back != null && context.back.deltaMeters <= 80.0 -> decisionFor("pace_change", context.back, context.rank)
            else -> null
        }
    }

    private fun distanceAtElapsed(ghost: GhostRunner, elapsedSeconds: Int): Double? {
        if (ghost.checkpoints.isNotEmpty()) {
            return distanceAtInterpolatedElapsed(ghost.checkpoints, elapsedSeconds)
        }
        if (ghost.totalElapsedSeconds <= 0.0 || ghost.totalDistanceMeters <= 0.0) return null
        return minOf(ghost.totalDistanceMeters, ghost.totalDistanceMeters / ghost.totalElapsedSeconds * elapsedSeconds)
    }

    private fun distanceAtInterpolatedElapsed(checkpoints: List<GhostCheckpoint>, elapsedSeconds: Int): Double {
        val sorted = checkpoints.sortedBy { it.elapsedSeconds }
        val after = sorted.firstOrNull { it.elapsedSeconds >= elapsedSeconds }
        if (after == null) return sorted.lastOrNull()?.distanceMeters ?: 0.0
        if (after.elapsedSeconds == elapsedSeconds) return after.distanceMeters

        val before = sorted.lastOrNull { it.elapsedSeconds < elapsedSeconds }
            ?: return when {
                elapsedSeconds <= 0 -> 0.0
                after.elapsedSeconds <= 0 -> after.distanceMeters
                else -> after.distanceMeters * (elapsedSeconds.toDouble() / after.elapsedSeconds.toDouble())
            }
        val span = (after.elapsedSeconds - before.elapsedSeconds).toDouble()
        if (span <= 0.0) return before.distanceMeters

        val ratio = (elapsedSeconds - before.elapsedSeconds) / span
        return before.distanceMeters + (after.distanceMeters - before.distanceMeters) * ratio
    }

    private fun priorityFor(category: String): Int =
        when (category) {
            "completed" -> 110
            "overtake", "overtaken" -> 100
            "rank_up", "rank_down" -> 92
            "close_front", "close_back" -> 84
            "last_ghost", "next_target", "personal_best" -> 78
            "front_distance", "back_distance", "gap_time" -> 70
            "pace_change" -> 60
            "one_km_left" -> 58
            "finish_push" -> 56
            "current_rank" -> 45
            else -> 20
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
            distanceText = distanceMeters.takeIf { it >= 1.0 }?.let {
                if (comparison == null) formatDistance(it) else formatGhostGap(it, seconds)
            },
            seconds = seconds,
            rank = rank
        )
    }

    private fun formatGhostGap(distanceMeters: Double, seconds: Int): String =
        "${formatDistance(distanceMeters)}, 약 ${seconds}초"

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
        private const val PERSONAL_BEST_GHOST_KEY = "bestGhost"
    }
}

private data class SpeakPolicy(
    val globalCooldownMillis: Long,
    val categoryCooldownMillis: Long,
    val ignoresGlobalCooldown: Boolean = false
)

private data class RaceContext(
    val elapsedSeconds: Int,
    val distanceMeters: Double,
    val paceSecondsPerKm: Int?,
    val speedKmh: Double,
    val targetDistanceMeters: Double,
    val remainingMeters: Double,
    val comparisons: List<GhostComparison>,
    val rank: Int,
    val front: GhostComparison?,
    val back: GhostComparison?,
    val target: GhostComparison?
)

private data class CueDecision(
    val category: String,
    val immediate: Boolean = false,
    val ghostName: String? = null,
    val distanceText: String? = null,
    val seconds: Int? = null,
    val rank: Int? = null
)

private enum class DistanceBucket {
    TEN,
    THIRTY,
    FIFTY,
    HUNDRED,
    FAR;

    companion object {
        fun from(distanceMeters: Double): DistanceBucket =
            when {
                distanceMeters <= 10.0 -> TEN
                distanceMeters <= 30.0 -> THIRTY
                distanceMeters <= 50.0 -> FIFTY
                distanceMeters <= 100.0 -> HUNDRED
                else -> FAR
            }
    }
}
