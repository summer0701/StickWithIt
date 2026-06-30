package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Test

class SquatGhostTargetsTest {
    @Test
    fun twoMinuteDefaultsMatchRequestedDifficulty() {
        assertEquals(
            listOf(
                "G1 Starter" to 20,
                "G2 Rookie" to 23,
                "G3 Rival" to 25,
                "G4 Elite" to 28,
                "G5 Legend" to 31
            ),
            SquatGhostTargets.forDuration(120)
        )
    }

    @Test
    fun otherDurationsScaleByTimeRatio() {
        assertEquals(
            listOf(
                "G1 Starter" to 10,
                "G2 Rookie" to 12,
                "G3 Rival" to 13,
                "G4 Elite" to 14,
                "G5 Legend" to 16
            ),
            SquatGhostTargets.forDuration(60)
        )

        assertEquals(
            listOf(
                "G1 Starter" to 30,
                "G2 Rookie" to 35,
                "G3 Rival" to 38,
                "G4 Elite" to 42,
                "G5 Legend" to 47
            ),
            SquatGhostTargets.forDuration(180)
        )
    }
}
