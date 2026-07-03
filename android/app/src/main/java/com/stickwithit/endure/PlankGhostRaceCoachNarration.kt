package com.stickwithit.endure

import kotlin.math.abs

data class PlankGhostState(val name: String, val seconds: Int)

data class PlankRaceSnapshot(
    val seconds: Int,
    val rank: Int,
    val elapsedSeconds: Int,
    val durationSeconds: Int,
    val ghosts: List<PlankGhostState>
)

object PlankGhostRaceCoachNarration {
    private const val GENERAL_COOLDOWN_MS = 45_000L
    private const val CATEGORY_COOLDOWN_MS = 60_000L
    private const val CLOSE_COOLDOWN_MS = 20_000L
    private val immediateCategories = setOf("rank_up", "rank_down", "overtake", "overtaken", "completed")

    data class Cue(
        val category: String,
        val templateId: String,
        val text: String,
        val priority: Int = 38,
        val immediate: Boolean = false
    )

    class Session {
        private var lastSpokenAt: Long? = null
        private val lastCategorySpokenAt = mutableMapOf<String, Long>()
        private val spokenTemplateIds = mutableSetOf<String>()
        private var lastRank: Int? = null
        private var lastFrontGhostId: String? = null
        private var lastBackGhostId: String? = null
        private var lastFrontTimeBucket: Int? = null
        private var lastBackTimeBucket: Int? = null
        private var lastFrontGap: Int? = null
        private var completedSpoken = false
        private var canceled = false

        fun nextCue(snapshot: PlankRaceSnapshot, nowMillis: Long): Cue? {
            if (canceled) return null
            val front = snapshot.ghosts.filter { it.seconds > snapshot.seconds }.minByOrNull { it.seconds - snapshot.seconds }
            val back = snapshot.ghosts.filter { it.seconds <= snapshot.seconds }.maxByOrNull { it.seconds }
            val frontGap = front?.let { it.seconds - snapshot.seconds }
            val backGap = back?.let { snapshot.seconds - it.seconds }
            val previousRank = lastRank
            val category = when {
                previousRank == null -> "start"
                previousRank > snapshot.rank && back != null -> "overtake"
                previousRank > snapshot.rank -> "rank_up"
                previousRank < snapshot.rank && front != null -> "overtaken"
                previousRank < snapshot.rank -> "rank_down"
                front != null && frontGap != null && frontGap <= 5 -> "close_front"
                back != null && backGap != null && backGap <= 5 -> "close_back"
                snapshot.durationSeconds - snapshot.elapsedSeconds <= 30 -> "finish_push"
                snapshot.durationSeconds - snapshot.elapsedSeconds <= 60 -> "one_minute_left"
                front != null && isLastGhost(snapshot, front) -> "last_ghost"
                front != null && isPersonalBestGhost(front) -> "personal_best"
                front != null && shouldSpeakFront(front.name, frontGap ?: 0) -> "front_time"
                back != null && shouldSpeakBack(back.name, backGap ?: 0) -> "back_time"
                front != null && hasPaceChanged(frontGap) -> "pace_change"
                front != null -> "next_target"
                else -> "gap_time"
            }
            val cue = buildCue(category, snapshot, front?.name ?: back?.name, frontGap ?: backGap)
            rememberState(snapshot.rank, front?.name, frontGap, back?.name, backGap)
            return cue?.takeIf { canSpeak(it, nowMillis) }?.also { rememberCue(it, nowMillis) }
        }

        fun completedCue(rank: Int, nowMillis: Long): Cue? {
            if (canceled || completedSpoken) return null
            completedSpoken = true
            val cue = pickCue(
                "completed",
                listOf(
                    "completed_final_rank" to "플랭크 종료. 수고하셨습니다. 최종 순위는 ${rank}위입니다.",
                    "completed_done" to "운동 완료. 오늘도 끝까지 버텨냈습니다.",
                    "completed_saved" to "오늘의 기록이 저장되었습니다. 중요한 건 끝까지 자세를 유지했다는 것입니다."
                ),
                rank
            ).copy(priority = 70, immediate = true)
            rememberCue(cue, nowMillis)
            return cue
        }

        fun cancel() {
            canceled = true
            lastRank = null
            lastFrontGhostId = null
            lastBackGhostId = null
            lastFrontTimeBucket = null
            lastBackTimeBucket = null
            lastFrontGap = null
        }

        private fun shouldSpeakFront(ghostName: String, gap: Int): Boolean =
            lastFrontGhostId != ghostName || lastFrontTimeBucket != timeBucket(gap)

        private fun shouldSpeakBack(ghostName: String, gap: Int): Boolean =
            lastBackGhostId != ghostName || lastBackTimeBucket != timeBucket(gap)

        private fun hasPaceChanged(frontGap: Int?): Boolean {
            val previous = lastFrontGap ?: return false
            val current = frontGap ?: return false
            return abs(previous - current) >= 5
        }

        private fun canSpeak(cue: Cue, nowMillis: Long): Boolean {
            if (cue.templateId in spokenTemplateIds) return false
            if (cue.category == "close_front" || cue.category == "close_back") {
                return hasElapsed(lastCategorySpokenAt[cue.category], nowMillis, CLOSE_COOLDOWN_MS)
            }
            if (cue.category in immediateCategories) return true
            if (!hasElapsed(lastSpokenAt, nowMillis, GENERAL_COOLDOWN_MS)) return false
            return hasElapsed(lastCategorySpokenAt[cue.category], nowMillis, CATEGORY_COOLDOWN_MS)
        }

        private fun rememberCue(cue: Cue, nowMillis: Long) {
            lastSpokenAt = nowMillis
            lastCategorySpokenAt[cue.category] = nowMillis
            spokenTemplateIds += cue.templateId
        }

        private fun rememberState(rank: Int, frontName: String?, frontGap: Int?, backName: String?, backGap: Int?) {
            lastRank = rank
            if (frontName != null && frontGap != null) {
                lastFrontGhostId = frontName
                lastFrontTimeBucket = timeBucket(frontGap)
                lastFrontGap = frontGap
            }
            if (backName != null && backGap != null) {
                lastBackGhostId = backName
                lastBackTimeBucket = timeBucket(backGap)
            }
        }
    }

    private fun buildCue(category: String, snapshot: PlankRaceSnapshot, ghostName: String?, gap: Int?): Cue? {
        val name = ghostName ?: "앞 고스트"
        val seconds = gap?.coerceAtLeast(0) ?: 0
        val options = when (category) {
            "start" -> listOf(
                "start_waiting" to "플랭크 레이스가 시작됐습니다. 오늘의 고스트들이 앞에서 기다리고 있습니다.",
                "start_first_target" to "첫 목표는 ${name}. 차이는 ${seconds}초입니다. 편안한 호흡으로 시작해봅시다.",
                "start_rank" to "현재 ${snapshot.rank}위입니다. 앞 고스트부터 차분하게 좁혀갑니다."
            )
            "front_time" -> listOf(
                "front_time_rhythm" to "${name}까지 ${seconds}초입니다. 지금 리듬이면 충분히 붙을 수 있습니다.",
                "front_time_breathe" to "${name}가 앞에 있습니다. 차이는 ${seconds}초. 호흡을 유지하며 좁혀갑니다.",
                "front_time_line" to "앞에는 ${name}, 차이는 ${seconds}초입니다. 몸을 곧게 유지해봅시다."
            )
            "back_time" -> listOf(
                "back_time_hold" to "뒤 ${name}와 ${seconds}초 차이입니다. 이 리듬이면 순위를 지킬 수 있습니다.",
                "back_time_stable" to "${name}가 뒤에서 따라옵니다. 차이는 ${seconds}초. 자세를 안정적으로 유지하세요.",
                "back_time_rank" to "뒤쪽 간격은 ${seconds}초입니다. 호흡을 정리하고 현재 순위를 지켜봅시다."
            )
            "close_front" -> listOf(
                "close_front_easy" to "거의 붙었습니다. ${name}까지 ${seconds}초입니다. 무리하지 말고 그대로 갑니다.",
                "close_front_breathe" to "${name}와 거의 나란합니다. 호흡만 유지하세요.",
                "close_front_flow" to "${seconds}초만 더 버티면 ${name}입니다. 지금 흐름 좋습니다."
            )
            "close_back" -> listOf(
                "close_back_defend" to "뒤 ${name}가 ${seconds}초 차이까지 왔습니다. 자세를 유지하며 순위를 지켜봅시다.",
                "close_back_center" to "${name}가 가까워졌습니다. 차이는 ${seconds}초입니다. 몸의 중심을 유지하세요.",
                "close_back_core" to "뒤가 가까워졌습니다. ${name}와 ${seconds}초 차이입니다. 복부에 힘을 유지합니다."
            )
            "overtake" -> listOf(
                "overtake_flow" to "좋습니다. ${name}를 넘어섰습니다. 이 흐름을 유지하세요.",
                "overtake_next" to "${name}를 앞질렀습니다. 다음 고스트까지 차분하게 갑니다.",
                "overtake_rank" to "순위가 올라갑니다. 방금 ${name}를 넘어섰습니다."
            )
            "overtaken" -> listOf(
                "overtaken_ok" to "${name}가 앞서갑니다. 괜찮습니다. 다시 천천히 붙어봅시다.",
                "overtaken_breathe" to "${name}가 앞질러 갔습니다. 호흡을 무너뜨리지 않는 것이 중요합니다.",
                "overtaken_sight" to "현재 흐름을 정리하면 됩니다. ${name}를 다시 시야에 둡니다."
            )
            "rank_up" -> listOf(
                "rank_up_current" to "순위가 올랐습니다. 현재 ${snapshot.rank}위입니다. 리듬이 살아났습니다.",
                "rank_up_body" to "현재 ${snapshot.rank}위입니다. 몸이 안정적으로 버티고 있습니다.",
                "rank_up_step" to "한 계단 올라섰습니다. 이 자세 그대로 가져갑니다."
            )
            "rank_down" -> listOf(
                "rank_down_breathe" to "현재 ${snapshot.rank}위입니다. 괜찮습니다. 호흡부터 다시 맞춥니다.",
                "rank_down_enough" to "한 계단 내려왔습니다. 아직 충분합니다. 다시 차분하게 붙어봅시다.",
                "rank_down_flow" to "현재 ${snapshot.rank}위입니다. 흐름은 다시 만들 수 있습니다."
            )
            "next_target" -> listOf(
                "next_target_gap" to "다음 목표는 ${name}입니다. 차분하게 시간 차이를 줄여봅시다.",
                "next_target_breathe" to "이제 ${name}를 봅니다. 호흡을 유지하며 붙어갑니다.",
                "next_target_posture" to "앞의 고스트는 ${name}. 지금 자세를 안정적으로 가져갑니다."
            )
            "last_ghost" -> listOf(
                "last_ghost_gap" to "마지막 고스트는 ${name}. 차이는 ${seconds}초입니다.",
                "last_ghost_lead" to "${name}만 넘으면 선두입니다. 무리하지 말고 좁혀갑니다.",
                "last_ghost_chance" to "마지막 상대는 ${name}. 지금 리듬이면 기회가 있습니다."
            )
            "personal_best" -> listOf(
                "personal_best_flow" to "${name}를 넘으면 오늘 최고 흐름입니다. 차이는 ${seconds}초입니다.",
                "personal_best_ghost" to "개인 최고 기록 고스트는 ${name}. 지금부터 차분하게 좁혀갑니다.",
                "personal_best_breathe" to "최고 기록까지 ${seconds}초입니다. 호흡을 유지하면 충분히 도전할 수 있습니다."
            )
            "gap_time" -> listOf(
                "gap_time_stable" to "${name}와 ${seconds}초 차이입니다. 자세는 안정적입니다.",
                "gap_time_reduce" to "${name}까지 시간 차이는 ${seconds}초입니다. 조금씩 줄여봅시다.",
                "gap_time_flow" to "${name}와의 간격은 ${seconds}초입니다. 지금 흐름 좋습니다."
            )
            "pace_change" -> listOf(
                "pace_change_closing" to "${name}와의 간격이 줄고 있습니다. 이 리듬을 유지하세요.",
                "pace_change_opening" to "간격이 조금 벌어졌습니다. 괜찮습니다. 호흡부터 다시 정리합니다.",
                "pace_change_stable" to "지금 자세가 안정적입니다. 고스트와의 차이를 계속 확인합니다."
            )
            "one_minute_left" -> listOf(
                "one_minute_front" to "마지막 1분입니다. 앞 고스트와의 차이를 끝까지 좁혀봅시다.",
                "one_minute_rank" to "1분 남았습니다. 현재 ${snapshot.rank}위입니다. 지금까지 잘 버텼습니다.",
                "one_minute_rhythm" to "마지막 1분입니다. 고스트를 보며 리듬을 끝까지 가져갑니다."
            )
            "finish_push" -> listOf(
                "finish_push_front" to "마지막 30초입니다. 앞 고스트와의 차이를 끝까지 봅니다.",
                "finish_push_rank" to "마지막 구간입니다. 몸을 곧게 유지하며 현재 순위를 지켜봅시다.",
                "finish_push_gap" to "끝이 보입니다. 고스트와의 간격을 보며 마지막 호흡을 이어갑니다."
            )
            else -> emptyList()
        }
        if (options.isEmpty()) return null
        return pickCue(category, options, snapshot.seconds + snapshot.rank + snapshot.elapsedSeconds)
    }

    private fun pickCue(category: String, options: List<Pair<String, String>>, seed: Int): Cue {
        val (templateId, text) = options[abs(seed).mod(options.size)]
        return Cue(category, templateId, text)
    }

    private fun isLastGhost(snapshot: PlankRaceSnapshot, front: PlankGhostState): Boolean =
        snapshot.ghosts.count { it.seconds > snapshot.seconds } == 1 && front.seconds > snapshot.seconds

    private fun isPersonalBestGhost(ghost: PlankGhostState): Boolean =
        ghost.name.contains("Legend", ignoreCase = true) || ghost.name.contains("G5", ignoreCase = true)

    private fun hasElapsed(previous: Long?, nowMillis: Long, cooldownMillis: Long): Boolean =
        previous == null || nowMillis - previous >= cooldownMillis

    fun timeBucket(seconds: Int): Int = when (seconds) {
        in Int.MIN_VALUE..5 -> 0
        in 6..15 -> 1
        in 16..30 -> 2
        in 31..60 -> 3
        else -> 4
    }
}
