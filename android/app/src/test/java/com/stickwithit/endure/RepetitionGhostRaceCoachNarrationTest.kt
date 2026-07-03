package com.stickwithit.endure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RepetitionGhostRaceCoachNarrationTest {
    @Test
    fun startsWithGhostRaceContextForJumpingJackAndPushup() {
        val jumping = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.JUMPING_JACK)
            .nextCue(snapshot(RepetitionRaceExercise.JUMPING_JACK, reps = 0, rank = 6, ghosts = listOf("G1 Starter" to 5)), 0L)
        val pushup = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
            .nextCue(snapshot(RepetitionRaceExercise.PUSHUP, reps = 0, rank = 6, ghosts = listOf("G1 Starter" to 5)), 0L)

        assertNotNull(jumping)
        assertNotNull(pushup)
        assertTrue(jumping!!.text.contains("점핑잭") || jumping.text.contains("고스트") || jumping.text.contains("G1 Starter"))
        assertTrue(pushup!!.text.contains("푸쉬업") || pushup.text.contains("고스트") || pushup.text.contains("G1 Starter"))
        assertNoPressureLanguage(jumping.text)
        assertNoPressureLanguage(pushup.text)
    }

    @Test
    fun generalCueDoesNotRepeatInsideFortyFiveSeconds() {
        val session = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
        session.nextCue(snapshot(reps = 0, rank = 6, ghosts = listOf("G3 Rival" to 20)), 0L)

        val cue = session.nextCue(snapshot(reps = 1, rank = 6, ghosts = listOf("G3 Rival" to 16)), 10_000L)

        assertNull(cue)
    }

    @Test
    fun sameCategoryDoesNotRepeatInsideSixtySeconds() {
        val session = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
        session.nextCue(snapshot(reps = 0, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 0L)
        val first = session.nextCue(snapshot(reps = 10, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 60_000L)
        val second = session.nextCue(snapshot(reps = 25, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 110_000L)

        assertEquals("front_reps", first?.category)
        assertNull(second)
    }

    @Test
    fun closeFrontUsesShorterCooldown() {
        val session = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.JUMPING_JACK)
        session.nextCue(snapshot(reps = 0, rank = 6, ghosts = listOf("G2 Rookie" to 12)), 0L)
        val firstClose = session.nextCue(snapshot(reps = 9, rank = 6, ghosts = listOf("G2 Rookie" to 12)), 1_000L)
        val blockedClose = session.nextCue(snapshot(reps = 10, rank = 6, ghosts = listOf("G2 Rookie" to 12)), 10_000L)
        val nextClose = session.nextCue(snapshot(reps = 11, rank = 6, ghosts = listOf("G2 Rookie" to 12)), 22_000L)

        assertEquals("close_front", firstClose?.category)
        assertNull(blockedClose)
        assertEquals("close_front", nextClose?.category)
    }

    @Test
    fun rankChangesBypassGeneralCooldown() {
        val session = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
        session.nextCue(snapshot(reps = 0, rank = 5, ghosts = listOf("G1 Starter" to 0, "G2 Rookie" to 10)), 0L)

        val cue = session.nextCue(snapshot(reps = 12, rank = 4, ghosts = listOf("G1 Starter" to 0, "G2 Rookie" to 10)), 1_000L)

        assertEquals("overtake", cue?.category)
    }

    @Test
    fun frontBucketMustChangeBeforeFrontRepsCanRepeat() {
        val session = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.JUMPING_JACK)
        session.nextCue(snapshot(reps = 0, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 0L)
        val sameBucket = session.nextCue(snapshot(reps = 2, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 60_000L)
        val changedBucket = session.nextCue(snapshot(reps = 10, rank = 6, ghosts = listOf("G3 Rival" to 40, "G5 Legend" to 80)), 120_000L)

        assertFalse(sameBucket?.category == "front_reps")
        assertEquals("front_reps", changedBucket?.category)
    }

    @Test
    fun completedSpeaksOnlyOnceAndCancelBlocksCompletion() {
        val completed = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
        assertNotNull(completed.completedCue(rank = 3, nowMillis = 0L))
        assertNull(completed.completedCue(rank = 3, nowMillis = 1_000L))

        val canceled = RepetitionGhostRaceCoachNarration.Session(RepetitionRaceExercise.PUSHUP)
        canceled.cancel()
        assertNull(canceled.completedCue(rank = 3, nowMillis = 0L))
    }

    @Test
    fun repBucketsMatchRequestedRanges() {
        assertEquals(0, RepetitionGhostRaceCoachNarration.repBucket(3))
        assertEquals(1, RepetitionGhostRaceCoachNarration.repBucket(7))
        assertEquals(2, RepetitionGhostRaceCoachNarration.repBucket(15))
        assertEquals(3, RepetitionGhostRaceCoachNarration.repBucket(30))
        assertEquals(4, RepetitionGhostRaceCoachNarration.repBucket(31))
    }

    private fun snapshot(
        exercise: RepetitionRaceExercise = RepetitionRaceExercise.PUSHUP,
        reps: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>,
        elapsedSeconds: Int = 20,
        durationSeconds: Int = 120
    ) = RepetitionRaceSnapshot(
        exercise = exercise,
        reps = reps,
        rank = rank,
        elapsedSeconds = elapsedSeconds,
        durationSeconds = durationSeconds,
        ghosts = ghosts.map { RepetitionGhostState(it.first, it.second) }
    )

    private fun assertNoPressureLanguage(text: String) {
        assertFalse(text.contains("뒤처졌"))
        assertFalse(text.contains("반드시"))
        assertFalse(text.contains("무조건"))
        assertFalse(text.contains("실패"))
        assertFalse(text.contains("따라잡아야"))
    }
}

