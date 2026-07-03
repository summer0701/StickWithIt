package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RuleBasedCoachTest {
    @Test
    fun frontDistanceCueIncludesGhostGapAndCoaching() {
        val coach = RuleBasedCoach()
        val cue = coach.createCue(
            elapsedSeconds = 90,
            distanceMeters = 260.0,
            paceSecondsPerKm = 333,
            speedKmh = 10.8,
            targetDistanceMeters = 2000.0,
            ghostRunners = listOf(ghost("stableGhost", "G3 Rival", 2000.0, 600.0)),
            nowMillis = 45_000L
        )

        requireNotNull(cue)
        assertEquals("last_ghost", cue.category)
        assertTrue(cue.text.contains("G3 Rival"))
        assertTrue(cue.text.contains("리듬") || cue.text.contains("기회"))
    }

    @Test
    fun categoryDoesNotRepeatInsideSixtySeconds() {
        val coach = RuleBasedCoach()
        val runner = ghost("front", "G2", 2000.0, 600.0)

        val first = coach.createCue(90, 220.0, 360, 10.0, 2000.0, listOf(runner), nowMillis = 45_000L)
        val second = coach.createCue(100, 230.0, 360, 10.0, 2000.0, listOf(runner), nowMillis = 89_000L)

        assertNotNull(first)
        assertNull(second)
    }

    @Test
    fun templateDoesNotRepeatWithinSession() {
        val coach = RuleBasedCoach()
        val first = coach.completedCue(elapsedSeconds = 1, distanceMeters = 100.0, ghostRunners = emptyList(), nowMillis = 1_000L)
        val second = coach.startCue(emptyList(), nowMillis = 2_000L)
        val third = coach.startCue(emptyList(), nowMillis = 3_000L)

        assertNotNull(first)
        assertNotNull(second)
        assertNotNull(third)
        assertNotEquals(second?.templateId, third?.templateId)
    }

    @Test
    fun overtakeBypassesGeneralCooldown() {
        val coach = RuleBasedCoach()
        val runner = ghost("rival", "G2", 1000.0, 100.0)

        val first = coach.createCue(10, 80.0, 125, 28.8, 1000.0, listOf(runner), nowMillis = 45_000L)
        val overtake = coach.createCue(10, 120.0, 83, 43.2, 1000.0, listOf(runner), nowMillis = 46_000L)

        assertNotNull(first)
        requireNotNull(overtake)
        assertEquals("overtake", overtake.category)
    }

    @Test
    fun rankUpBypassesGeneralCooldown() {
        val coach = RuleBasedCoach()
        val twoAhead = listOf(
            ghost("front", "G2", 1000.0, 100.0),
            ghost("farFront", "G3", 1500.0, 100.0)
        )

        val first = coach.createCue(10, 50.0, 200, 18.0, 1000.0, twoAhead, nowMillis = 45_000L)
        val rankUp = coach.createCue(10, 50.0, 200, 18.0, 1000.0, listOf(twoAhead[0]), nowMillis = 46_000L)

        assertNotNull(first)
        requireNotNull(rankUp)
        assertEquals("rank_up", rankUp.category)
    }

    @Test
    fun rankDownBypassesGeneralCooldown() {
        val coach = RuleBasedCoach()
        val oneAhead = ghost("front", "G2", 1000.0, 100.0)
        val twoAhead = listOf(oneAhead, ghost("farFront", "G3", 1500.0, 100.0))

        val first = coach.createCue(10, 50.0, 200, 18.0, 1000.0, listOf(oneAhead), nowMillis = 45_000L)
        val rankDown = coach.createCue(10, 50.0, 200, 18.0, 1000.0, twoAhead, nowMillis = 46_000L)

        assertNotNull(first)
        requireNotNull(rankDown)
        assertEquals("rank_down", rankDown.category)
    }

    @Test
    fun generalCueDoesNotRepeatInsideFortyFiveSeconds() {
        val coach = RuleBasedCoach()
        val first = coach.createCue(60, 0.0, null, 0.0, 2000.0, emptyList(), nowMillis = 45_000L)
        val second = coach.createCue(90, 0.0, null, 0.0, 2000.0, emptyList(), nowMillis = 89_000L)

        assertNotNull(first)
        assertNull(second)
    }

    @Test
    fun closeFrontUsesShorterCooldown() {
        val coach = RuleBasedCoach()
        val runner = ghost("front", "G2", 1000.0, 100.0)

        val first = coach.createCue(10, 92.0, 109, 33.1, 2000.0, listOf(runner), nowMillis = 20_000L)
        val tooSoon = coach.createCue(10, 93.0, 108, 33.5, 2000.0, listOf(runner), nowMillis = 39_000L)
        val afterCooldown = coach.createCue(10, 94.0, 106, 33.8, 2000.0, listOf(runner), nowMillis = 41_000L)

        requireNotNull(first)
        assertEquals("close_front", first.category)
        assertNull(tooSoon)
        requireNotNull(afterCooldown)
        assertEquals("close_front", afterCooldown.category)
    }

    @Test
    fun completedSpeaksOnlyOnce() {
        val coach = RuleBasedCoach()

        val first = coach.completedCue(elapsedSeconds = 300, distanceMeters = 1000.0, ghostRunners = emptyList(), nowMillis = 1_000L)
        val second = coach.completedCue(elapsedSeconds = 301, distanceMeters = 1001.0, ghostRunners = emptyList(), nowMillis = 2_000L)

        requireNotNull(first)
        assertEquals("completed", first.category)
        assertNull(second)
    }

    @Test
    fun unchangedDistanceBucketDoesNotRepeatFrontDistance() {
        val coach = RuleBasedCoach()
        val runners = listOf(
            ghost("front", "G2", 1000.0, 100.0),
            ghost("farFront", "G3", 1500.0, 100.0)
        )

        val first = coach.createCue(10, 50.0, 200, 18.0, 2000.0, runners, nowMillis = 45_000L)
        val second = coach.createCue(10, 55.0, 182, 19.8, 2000.0, runners, nowMillis = 106_000L)

        requireNotNull(first)
        assertEquals("front_distance", first.category)
        assertTrue(second == null || second.category != "front_distance")
    }

    @Test
    fun changedDistanceBucketAllowsFrontDistanceAgain() {
        val coach = RuleBasedCoach()
        val runners = listOf(
            ghost("front", "G2", 1000.0, 100.0),
            ghost("farFront", "G3", 1500.0, 100.0)
        )

        val first = coach.createCue(10, 50.0, 200, 18.0, 2000.0, runners, nowMillis = 45_000L)
        val second = coach.createCue(10, 20.0, 500, 7.2, 2000.0, runners, nowMillis = 106_000L)

        requireNotNull(first)
        assertEquals("front_distance", first.category)
        requireNotNull(second)
        assertEquals("front_distance", second.category)
    }

    @Test
    fun ghostCueWinsOverFallbackWhenGhostExists() {
        val coach = RuleBasedCoach()
        val runners = listOf(
            ghost("front", "G2", 1000.0, 100.0),
            ghost("farFront", "G3", 1500.0, 100.0)
        )

        val cue = coach.createCue(10, 50.0, 200, 18.0, 2000.0, runners, nowMillis = 45_000L)

        requireNotNull(cue)
        assertNotEquals("fallback", cue.category)
        assertTrue(cue.text.contains("G2"))
    }

    private fun ghost(key: String, label: String, distanceMeters: Double, elapsedSeconds: Double) =
        GhostRunner(
            key = key,
            label = label,
            totalDistanceMeters = distanceMeters,
            totalElapsedSeconds = elapsedSeconds,
            checkpoints = emptyList()
        )
}
