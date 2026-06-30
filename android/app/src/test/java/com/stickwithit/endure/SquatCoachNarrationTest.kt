package com.stickwithit.endure

import org.junit.Assert.assertTrue
import org.junit.Test

class SquatCoachNarrationTest {
    @Test
    fun tellsHowManyRepsAreNeededToCatchFrontGhost() {
        val text = SquatCoachNarration.build(
            reps = 8,
            rank = 4,
            postureText = "자세 좋음. 자세가 안정적이에요",
            ghosts = listOf("G1 Starter" to 5, "G2 Rookie" to 10, "G3 Rival" to 13),
            recentTexts = emptyList(),
            variantSeed = 0
        )

        assertTrue(text.contains("G2 Rookie"))
        assertTrue(text.contains("2개"))
        assertTrue(text.contains("따라잡"))
    }

    @Test
    fun tellsGapFromBehindGhostWhenAhead() {
        val text = SquatCoachNarration.build(
            reps = 12,
            rank = 2,
            postureText = "주의. 스쿼트 깊이를 높여요",
            ghosts = listOf("G1 Starter" to 8, "G2 Rookie" to 10),
            recentTexts = emptyList(),
            variantSeed = 1
        )

        assertTrue(text.contains("G2 Rookie"))
        assertTrue(text.contains("2개"))
        assertTrue(text.contains("앞") || text.contains("차이"))
    }

    @Test
    fun avoidsRecentlySpokenFullSentenceWhenPossible() {
        val first = SquatCoachNarration.build(
            reps = 8,
            rank = 4,
            postureText = "자세 좋음. 자세가 안정적이에요",
            ghosts = listOf("G2 Rookie" to 10),
            recentTexts = emptyList(),
            variantSeed = 0
        )
        val second = SquatCoachNarration.build(
            reps = 8,
            rank = 4,
            postureText = "자세 좋음. 자세가 안정적이에요",
            ghosts = listOf("G2 Rookie" to 10),
            recentTexts = listOf(first),
            variantSeed = 0
        )

        assertTrue(first != second)
    }
}
