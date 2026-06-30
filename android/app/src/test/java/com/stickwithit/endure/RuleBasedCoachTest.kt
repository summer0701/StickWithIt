package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RuleBasedCoachTest {
    @Test
    fun frontDistanceCueIncludesConcreteMetersAndSeconds() {
        val coach = RuleBasedCoach()
        val cue = coach.createCue(
            elapsedSeconds = 90,
            distanceMeters = 260.0,
            paceSecondsPerKm = 333,
            speedKmh = 10.8,
            targetDistanceMeters = 2000.0,
            ghostRunners = listOf(
                GhostRunner(
                    key = "stableGhost",
                    label = "G3 Rival",
                    totalDistanceMeters = 2000.0,
                    totalElapsedSeconds = 600.0,
                    checkpoints = emptyList()
                )
            ),
            nowMillis = 20_000L
        )

        requireNotNull(cue)
        assertEquals("last_ghost", cue.category)
        assertTrue(cue.text.contains("G3 Rival"))
        assertTrue(cue.text.contains("40미터"))
        assertTrue(cue.text.contains("약 12초"))
    }

    @Test
    fun closeBackCueIncludesConcreteGap() {
        val coach = RuleBasedCoach()
        val cue = coach.createCue(
            elapsedSeconds = 100,
            distanceMeters = 350.0,
            paceSecondsPerKm = 286,
            speedKmh = 12.6,
            targetDistanceMeters = 2000.0,
            ghostRunners = listOf(
                GhostRunner(
                    key = "averageGhost",
                    label = "G2 Rookie",
                    totalDistanceMeters = 2000.0,
                    totalElapsedSeconds = 600.0,
                    checkpoints = emptyList()
                )
            ),
            nowMillis = 20_000L
        )

        requireNotNull(cue)
        assertEquals("close_back", cue.category)
        assertTrue(cue.text.contains("G2 Rookie"))
        assertTrue(cue.text.contains("17미터"))
        assertTrue(cue.text.contains("약 5초"))
    }
}
