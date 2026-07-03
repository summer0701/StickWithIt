package com.stickwithit.endure

import kotlin.math.abs

object SquatCoachNarration {
    fun build(
        reps: Int,
        rank: Int,
        postureText: String,
        ghosts: List<Pair<String, Int>>,
        recentTexts: Collection<String>,
        variantSeed: Int
    ): String {
        val front = ghosts
            .filter { it.second > reps }
            .minByOrNull { it.second - reps }
        val back = ghosts
            .filter { it.second <= reps }
            .maxByOrNull { it.second }

        val ghostGuide = when {
            front != null -> frontGuide(rank, front.first, front.second - reps, variantSeed)
            back != null -> backGuide(rank, back.first, reps - back.second, variantSeed)
            else -> steadyGuide(reps, rank, variantSeed)
        }
        val postureGuide = postureGuide(postureText)
        val candidates = listOf(
            "$ghostGuide $postureGuide",
            "$ghostGuide 현재 ${reps}회입니다. $postureGuide",
            "현재 ${rank}위, ${ghostGuide.replaceFirstChar { it.lowercase() }} $postureGuide"
        )
        return pick(candidates, recentTexts, variantSeed)
    }

    private fun frontGuide(rank: Int, ghostName: String, gap: Int, variantSeed: Int): String {
        val safeGap = gap.coerceAtLeast(1)
        val candidates = when {
            safeGap == 1 -> listOf(
                "앞의 고스트는 ${ghostName}, 1개 차이입니다.",
                "${ghostName}와 거의 나란합니다. 차이는 1개입니다.",
                "현재 ${rank}위, ${ghostName}가 바로 앞에 있습니다."
            )
            safeGap <= 3 -> listOf(
                "${ghostName}까지 ${safeGap}개 차이입니다.",
                "앞에는 ${ghostName}, 차이는 ${safeGap}개입니다.",
                "현재 ${rank}위, ${ghostName}와 ${safeGap}개 차이입니다."
            )
            else -> listOf(
                "다음 목표는 ${ghostName}입니다. 차이는 ${safeGap}개입니다.",
                "${ghostName}가 앞에 있습니다. ${safeGap}개씩 차분히 좁혀갑니다.",
                "현재 ${rank}위, 앞 고스트 ${ghostName}까지 ${safeGap}개입니다."
            )
        }
        return pick(candidates, emptyList(), variantSeed)
    }

    private fun backGuide(rank: Int, ghostName: String, gap: Int, variantSeed: Int): String {
        val safeGap = gap.coerceAtLeast(0)
        val candidates = when {
            safeGap == 0 -> listOf(
                "${ghostName}와 같은 기록입니다. 다음 1개가 순위를 바꿉니다.",
                "${ghostName}와 나란히 가고 있습니다. 동작을 정확하게 쌓아갑니다.",
                "현재 ${rank}위, ${ghostName}와 동률입니다."
            )
            safeGap <= 2 -> listOf(
                "뒤 ${ghostName}와 ${safeGap}개 차이입니다.",
                "${ghostName}가 가까이 있습니다. 차이는 ${safeGap}개입니다.",
                "현재 ${rank}위, 뒤 ${ghostName}와 ${safeGap}개 차이입니다."
            )
            else -> listOf(
                "뒤 ${ghostName}와 ${safeGap}개 차이입니다. 현재 순위를 지켜봅니다.",
                "${ghostName}보다 ${safeGap}개 앞에 있습니다. 리듬은 안정적입니다.",
                "현재 ${rank}위, 뒤쪽 간격은 ${safeGap}개입니다."
            )
        }
        return pick(candidates, emptyList(), variantSeed)
    }

    private fun steadyGuide(reps: Int, rank: Int, variantSeed: Int): String =
        pick(
            listOf(
                "고스트 기록을 읽는 중입니다. 현재 ${reps}회, ${rank}위입니다.",
                "첫 고스트 간격을 계산하고 있습니다. 현재 ${reps}회입니다.",
                "고스트 레이스가 시작됐습니다. 현재 ${rank}위 흐름을 만듭니다."
            ),
            emptyList(),
            variantSeed
        )

    private fun postureGuide(postureText: String): String {
        val detail = postureText.substringAfter(". ", postureText).trim()
        return when {
            postureText.contains("좋") -> "자세는 안정적입니다. 이 리듬을 유지하세요."
            postureText.contains("주의") -> "${detail.ifBlank { "자세를 확인합니다." }} 리듬은 그대로 가져갑니다."
            postureText.contains("교정") -> "${detail.ifBlank { "자세를 먼저 정리합니다." }} 정확한 1개부터 다시 갑니다."
            else -> "${detail.ifBlank { "자세를 안정적으로 유지합니다." }} 고스트 간격을 계속 봅니다."
        }
    }

    private fun pick(candidates: List<String>, recentTexts: Collection<String>, variantSeed: Int): String {
        val eligible = candidates.filterNot { recentTexts.contains(it) }.ifEmpty { candidates }
        return eligible[abs(variantSeed).mod(eligible.size)]
    }
}
