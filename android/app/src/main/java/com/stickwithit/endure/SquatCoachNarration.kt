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
            front != null -> frontGuide(front.first, front.second - reps, variantSeed)
            back != null -> backGuide(back.first, reps - back.second, variantSeed)
            else -> steadyGuide(variantSeed)
        }
        val rankGuide = rankGuide(rank, variantSeed)
        val candidates = listOf(
            "$postureText. 현재 ${reps}회, ${rankGuide} $ghostGuide",
            "$postureText. $ghostGuide 현재 ${reps}회입니다.",
            "현재 ${reps}회, ${rankGuide} $ghostGuide $postureText."
        )
        return pick(candidates, recentTexts, variantSeed)
    }

    private fun frontGuide(ghostName: String, gap: Int, variantSeed: Int): String {
        val safeGap = gap.coerceAtLeast(1)
        val candidates = when {
            safeGap == 1 -> listOf(
                "${ghostName}까지 1개 차이입니다. 한 번만 더 하면 따라잡습니다.",
                "바로 앞은 ${ghostName}입니다. 1개만 더 하면 나란히 갑니다.",
                "${ghostName}가 바로 앞입니다. 다음 동작으로 추월해 봅시다."
            )
            safeGap <= 3 -> listOf(
                "${ghostName}까지 ${safeGap}개 차이입니다. ${safeGap}개만 더 하면 따라잡을 수 있어요.",
                "${safeGap}개만 더 하면 ${ghostName}와 나란히 갑니다.",
                "${ghostName}가 ${safeGap}개 앞입니다. 지금 리듬이면 곧 추월합니다."
            )
            else -> listOf(
                "${ghostName}가 ${safeGap}개 앞입니다. 먼저 ${safeGap - 2}개까지 줄여봅시다.",
                "다음 목표는 ${ghostName}입니다. 차이는 ${safeGap}개입니다.",
                "${ghostName}까지 ${safeGap}개 남았습니다. 호흡 유지하고 하나씩 좁혀요."
            )
        }
        return pick(candidates, emptyList(), variantSeed)
    }

    private fun backGuide(ghostName: String, gap: Int, variantSeed: Int): String {
        val safeGap = gap.coerceAtLeast(0)
        val candidates = when {
            safeGap == 0 -> listOf(
                "${ghostName}와 같은 기록입니다. 한 개만 더 하면 앞섭니다.",
                "${ghostName}와 나란히 가고 있습니다. 다음 하나가 추월입니다.",
                "${ghostName}와 동률입니다. 리듬을 끊지 마세요."
            )
            safeGap <= 2 -> listOf(
                "${ghostName}보다 ${safeGap}개 앞서고 있습니다. 이 차이를 지켜요.",
                "뒤 ${ghostName}와 ${safeGap}개 차이입니다. 자세 유지합니다.",
                "${ghostName}가 가까이 있습니다. ${safeGap}개 앞, 계속 밀어붙여요."
            )
            else -> listOf(
                "${ghostName}보다 ${safeGap}개 앞서고 있습니다. 안정적으로 유지해요.",
                "뒤 ${ghostName}와 ${safeGap}개 차이입니다. 좋은 페이스입니다.",
                "${ghostName}를 ${safeGap}개 차이로 앞서고 있습니다. 흐름 좋습니다."
            )
        }
        return pick(candidates, emptyList(), variantSeed)
    }

    private fun steadyGuide(variantSeed: Int): String =
        pick(
            listOf(
                "고스트 기록을 읽는 중입니다. 지금 페이스를 만들어 봅시다.",
                "첫 목표 고스트를 향해 출발했습니다. 정확한 자세로 쌓아가요.",
                "초반 리듬을 잡고 있습니다. 한 개씩 차분히 갑니다."
            ),
            emptyList(),
            variantSeed
        )

    private fun rankGuide(rank: Int, variantSeed: Int): String =
        pick(
            listOf(
                "현재 ${rank}위입니다.",
                "지금 순위는 ${rank}위입니다.",
                "${rank}위로 따라가고 있습니다."
            ),
            emptyList(),
            variantSeed
        )

    private fun pick(candidates: List<String>, recentTexts: Collection<String>, variantSeed: Int): String {
        val eligible = candidates.filterNot { recentTexts.contains(it) }.ifEmpty { candidates }
        return eligible[abs(variantSeed).mod(eligible.size)]
    }
}
