package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlankGhostRaceCoachNarrationTest {
    @Test
    fun startsWithGhostRaceContext() {
        val cue = PlankGhostRaceCoachNarration.Session()
            .nextCue(snapshot(seconds = 0, rank = 6, ghosts = listOf("G1 Starter" to 12)), 0L)

        assertNotNull(cue)
        assertEquals("start", cue?.category)
        assertTrue(cue!!.text.contains("플랭크") || cue.text.contains("고스트") || cue.text.contains("G1 Starter"))
        assertNoPressureLanguage(cue.text)
    }

    @Test
    fun generalCueDoesNotRepeatInsideFortyFiveSeconds() {
        val session = PlankGhostRaceCoachNarration.Session()
        session.nextCue(snapshot(seconds = 0, rank = 6, ghosts = listOf("G3 Rival" to 90)), 0L)

        val cue = session.nextCue(snapshot(seconds = 10, rank = 6, ghosts = listOf("G3 Rival" to 85)), 10_000L)

        assertNull(cue)
    }

    @Test
    fun sameCategoryDoesNotRepeatInsideSixtySeconds() {
        val session = PlankGhostRaceCoachNarration.Session()
        session.nextCue(snapshot(seconds = 0, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 0L)
        val first = session.nextCue(snapshot(seconds = 30, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 60_000L)
        val second = session.nextCue(snapshot(seconds = 65, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 110_000L)

        assertEquals("front_time", first?.category)
        assertNull(second)
    }

    @Test
    fun closeFrontUsesShorterCooldownAtFiveSeconds() {
        val session = PlankGhostRaceCoachNarration.Session()
        session.nextCue(snapshot(seconds = 0, rank = 6, ghosts = listOf("G2 Rookie" to 30)), 0L)
        val firstClose = session.nextCue(snapshot(seconds = 25, rank = 6, ghosts = listOf("G2 Rookie" to 30)), 1_000L)
        val blockedClose = session.nextCue(snapshot(seconds = 26, rank = 6, ghosts = listOf("G2 Rookie" to 30)), 10_000L)
        val nextClose = session.nextCue(snapshot(seconds = 27, rank = 6, ghosts = listOf("G2 Rookie" to 30)), 22_000L)

        assertEquals("close_front", firstClose?.category)
        assertNull(blockedClose)
        assertEquals("close_front", nextClose?.category)
    }

    @Test
    fun rankChangesBypassGeneralCooldown() {
        val session = PlankGhostRaceCoachNarration.Session()
        session.nextCue(snapshot(seconds = 0, rank = 5, ghosts = listOf("G1 Starter" to 0, "G2 Rookie" to 20)), 0L)

        val cue = session.nextCue(snapshot(seconds = 25, rank = 4, ghosts = listOf("G1 Starter" to 0, "G2 Rookie" to 20)), 1_000L)

        assertEquals("overtake", cue?.category)
    }

    @Test
    fun frontTimeBucketMustChangeBeforeFrontTimeCanRepeat() {
        val session = PlankGhostRaceCoachNarration.Session()
        session.nextCue(snapshot(seconds = 0, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 0L)
        val sameBucket = session.nextCue(snapshot(seconds = 10, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 60_000L)
        val changedBucket = session.nextCue(snapshot(seconds = 30, rank = 6, ghosts = listOf("G3 Rival" to 90, "G5 Legend" to 180)), 120_000L)

        assertFalse(sameBucket?.category == "front_time")
        assertEquals("front_time", changedBucket?.category)
    }

    @Test
    fun completedSpeaksOnlyOnceAndCancelBlocksCompletion() {
        val completed = PlankGhostRaceCoachNarration.Session()
        assertNotNull(completed.completedCue(rank = 3, nowMillis = 0L))
        assertNull(completed.completedCue(rank = 3, nowMillis = 1_000L))

        val canceled = PlankGhostRaceCoachNarration.Session()
        canceled.cancel()
        assertNull(canceled.completedCue(rank = 3, nowMillis = 0L))
    }

    @Test
    fun timeBucketsMatchRequestedRanges() {
        assertEquals(0, PlankGhostRaceCoachNarration.timeBucket(5))
        assertEquals(1, PlankGhostRaceCoachNarration.timeBucket(15))
        assertEquals(2, PlankGhostRaceCoachNarration.timeBucket(30))
        assertEquals(3, PlankGhostRaceCoachNarration.timeBucket(60))
        assertEquals(4, PlankGhostRaceCoachNarration.timeBucket(61))
    }

    private fun snapshot(
        seconds: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>,
        elapsedSeconds: Int = 20,
        durationSeconds: Int = 120
    ) = PlankRaceSnapshot(
        seconds = seconds,
        rank = rank,
        elapsedSeconds = elapsedSeconds,
        durationSeconds = durationSeconds,
        ghosts = ghosts.map { PlankGhostState(it.first, it.second) }
    )

    private fun assertNoPressureLanguage(text: String) {
        assertFalse(text.contains("버티지 못"))
        assertFalse(text.contains("반드시"))
        assertFalse(text.contains("포기하지"))
        assertFalse(text.contains("실패"))
    }
}
