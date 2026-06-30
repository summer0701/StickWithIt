package com.stickwithit.endure

import kotlin.math.roundToInt

object SquatGhostTargets {
    private const val BASE_DURATION_SECONDS = 120
    private const val BASE_AVERAGE_REPS = 25.0

    private val profiles = listOf(
        SquatGhostProfile("G1 Starter", 0.80),
        SquatGhostProfile("G2 Rookie", 0.92),
        SquatGhostProfile("G3 Rival", 1.00),
        SquatGhostProfile("G4 Elite", 1.12),
        SquatGhostProfile("G5 Legend", 1.24)
    )

    fun forDuration(durationSeconds: Int): List<Pair<String, Int>> {
        val durationScale = durationSeconds.coerceAtLeast(1).toDouble() / BASE_DURATION_SECONDS
        return profiles.map { profile ->
            profile.label to (BASE_AVERAGE_REPS * profile.averageFactor * durationScale).roundToInt().coerceAtLeast(1)
        }
    }

    private data class SquatGhostProfile(
        val label: String,
        val averageFactor: Double
    )
}
