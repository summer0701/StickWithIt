package com.stickwithit.endure

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SquatCoachNarrationTest {
    @Test
    fun leadsWithFrontGhostGapAndShortCoaching() {
        val text = SquatCoachNarration.build(
            reps = 8,
            rank = 4,
            postureText = "자세 좋음. 자세가 안정적이에요",
            ghosts = listOf("G1 Starter" to 5, "G2 Rookie" to 10, "G3 Rival" to 13),
            recentTexts = emptyList(),
            variantSeed = 0
        )

        assertTrue(text.startsWith("G2 Rookie") || text.startsWith("앞") || text.startsWith("현재"))
        assertTrue(text.contains("G2 Rookie"))
        assertTrue(text.contains("2개"))
        assertTrue(text.contains("자세") || text.contains("리듬"))
        assertNoPressureLanguage(text)
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
        assertTrue(text.contains("뒤") || text.contains("앞에") || text.contains("가까이"))
        assertTrue(text.contains("스쿼트 깊이를 높여요"))
        assertNoPressureLanguage(text)
    }

    @Test
    fun describesTieAsGhostRaceSituation() {
        val text = SquatCoachNarration.build(
            reps = 10,
            rank = 3,
            postureText = "자세 좋음. 자세가 안정적이에요",
            ghosts = listOf("G2 Rookie" to 10),
            recentTexts = emptyList(),
            variantSeed = 0
        )

        assertTrue(text.contains("G2 Rookie"))
        assertTrue(text.contains("같은 기록") || text.contains("나란") || text.contains("동률"))
        assertNoPressureLanguage(text)
    }

    @Test
    fun usesGhostFallbackWhenNoComparableGhostExists() {
        val text = SquatCoachNarration.build(
            reps = 0,
            rank = 6,
            postureText = "주의. 무릎 정렬을 맞춰요",
            ghosts = emptyList(),
            recentTexts = emptyList(),
            variantSeed = 0
        )

        assertTrue(text.contains("고스트"))
        assertTrue(text.contains("0회") || text.contains("6위"))
        assertNoPressureLanguage(text)
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

    private fun assertNoPressureLanguage(text: String) {
        assertFalse(text.contains("반드시"))
        assertFalse(text.contains("무조건"))
        assertFalse(text.contains("실패"))
        assertFalse(text.contains("밀리면"))
        assertFalse(text.contains("따라잡"))
    }
}
