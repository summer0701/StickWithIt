package com.stickwithit.endure

import kotlin.math.abs

data class RepetitionGhostState(val name: String, val reps: Int)

enum class RepetitionRaceExercise(
    val displayName: String,
    val steadyCue: String,
    val closeBackCue: String,
    val completedAction: String
) {
    JUMPING_JACK("점핑잭", "팔과 발 리듬을 일정하게 가져갑니다.", "팔과 발을 가볍게 맞춰갑니다.", "끝까지 움직였다는 겁니다."),
    PUSHUP("푸쉬업", "동작을 일정하게 이어갑니다.", "가슴을 안정적으로 내렸다 올립니다.", "끝까지 밀어 올렸다는 겁니다."),
    LUNGE("런지", "왼쪽 다리, 오른쪽 다리를 번갈아 수행하세요.", "자세를 유지하세요. 천천히 올라오세요.", "좋습니다. 끝까지 버터봅시다.")
}

data class RepetitionRaceSnapshot(
    val exercise: RepetitionRaceExercise,
    val reps: Int,
    val rank: Int,
    val elapsedSeconds: Int,
    val durationSeconds: Int,
    val ghosts: List<RepetitionGhostState>
)

object RepetitionGhostRaceCoachNarration {
    private const val GENERAL_COOLDOWN_MS = 45_000L
    private const val CATEGORY_COOLDOWN_MS = 60_000L
    private const val CLOSE_COOLDOWN_MS = 20_000L
    private const val LAST_SET_RATIO = 0.80f
    private val immediateCategories = setOf("rank_up", "rank_down", "overtake", "overtaken", "completed")

    data class Cue(
        val category: String,
        val templateId: String,
        val text: String,
        val priority: Int = 38,
        val immediate: Boolean = false
    )

    class Session(private val exercise: RepetitionRaceExercise) {
        private var lastSpokenAt: Long? = null
        private val lastCategorySpokenAt = mutableMapOf<String, Long>()
        private val spokenTemplateIds = mutableSetOf<String>()
        private var lastRank: Int? = null
        private var lastFrontGhostId: String? = null
        private var lastBackGhostId: String? = null
        private var lastFrontRepBucket: Int? = null
        private var lastBackRepBucket: Int? = null
        private var lastFrontGap: Int? = null
        private var completedSpoken = false
        private var canceled = false

        fun nextCue(snapshot: RepetitionRaceSnapshot, nowMillis: Long): Cue? {
            if (canceled) return null
            val front = snapshot.ghosts.filter { it.reps > snapshot.reps }.minByOrNull { it.reps - snapshot.reps }
            val back = snapshot.ghosts.filter { it.reps <= snapshot.reps }.maxByOrNull { it.reps }
            val frontGap = front?.let { it.reps - snapshot.reps }
            val backGap = back?.let { snapshot.reps - it.reps }
            val previousRank = lastRank
            val category = when {
                previousRank == null -> "start"
                previousRank > snapshot.rank && back != null -> "overtake"
                previousRank > snapshot.rank -> "rank_up"
                previousRank < snapshot.rank && front != null -> "overtaken"
                previousRank < snapshot.rank -> "rank_down"
                front != null && frontGap != null && frontGap <= 3 -> "close_front"
                back != null && backGap != null && backGap <= 3 -> "close_back"
                isFinishPush(snapshot, frontGap) -> "finish_push"
                isLastSet(snapshot) -> "last_set"
                front != null && isLastGhost(snapshot, front) -> "last_ghost"
                front != null && isPersonalBestGhost(front) -> "personal_best"
                front != null && shouldSpeakFront(front.name, frontGap ?: 0) -> "front_reps"
                back != null && shouldSpeakBack(back.name, backGap ?: 0) -> "back_reps"
                front != null && hasPaceChanged(frontGap) -> "pace_change"
                front != null -> "next_target"
                else -> "gap_reps"
            }
            val cue = buildCue(category, snapshot, front?.name ?: back?.name, frontGap ?: backGap)
            val acceptedCue = cue?.takeIf { canSpeak(it, nowMillis) }
            lastRank = snapshot.rank
            if (acceptedCue != null) {
                rememberState(snapshot.rank, front?.name, frontGap, back?.name, backGap)
                rememberCue(acceptedCue, nowMillis)
            }
            return acceptedCue
        }

        fun completedCue(rank: Int, nowMillis: Long): Cue? {
            if (canceled || completedSpoken) return null
            completedSpoken = true
            val cue = pickCue(
                "completed",
                listOf(
                    "completed_final_rank_${exercise.name}" to "${exercise.displayName} 종료. 수고하셨습니다. 최종 순위는 ${rank}위입니다.",
                    "completed_done_${exercise.name}" to "운동 완료. 오늘도 끝까지 해냈습니다.",
                    "completed_saved_${exercise.name}" to "오늘의 기록이 저장되었습니다. 중요한 건 ${exercise.completedAction}"
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
            lastFrontRepBucket = null
            lastBackRepBucket = null
            lastFrontGap = null
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
                lastFrontRepBucket = repBucket(frontGap)
                lastFrontGap = frontGap
            }
            if (backName != null && backGap != null) {
                lastBackGhostId = backName
                lastBackRepBucket = repBucket(backGap)
            }
        }

        private fun shouldSpeakFront(ghostName: String, gap: Int): Boolean =
            lastFrontGhostId != ghostName || lastFrontRepBucket != repBucket(gap)

        private fun shouldSpeakBack(ghostName: String, gap: Int): Boolean =
            lastBackGhostId != ghostName || lastBackRepBucket != repBucket(gap)

        private fun hasPaceChanged(frontGap: Int?): Boolean {
            val previous = lastFrontGap ?: return false
            val current = frontGap ?: return false
            return abs(previous - current) >= 2
        }
    }

    private fun buildCue(category: String, snapshot: RepetitionRaceSnapshot, ghostName: String?, gap: Int?): Cue? {
        val name = ghostName ?: "앞 고스트"
        val reps = gap?.coerceAtLeast(0) ?: 0
        val exercise = snapshot.exercise
        val options = when (category) {
            "start" -> listOf(
                "start_waiting_${exercise.name}" to "${exercise.displayName} 레이스가 시작됐습니다. 오늘의 고스트들이 앞에서 기다리고 있습니다.",
                "start_first_target_${exercise.name}" to "첫 목표는 ${name}. 차이는 ${reps}개입니다. 서두르지 말고 리듬을 맞춰봅시다.",
                "start_rank_${exercise.name}" to "현재 ${snapshot.rank}위입니다. 앞 고스트부터 차분하게 좁혀갑니다."
            )
            "front_reps" -> listOf(
                "front_reps_maintain_${exercise.name}" to "${name}까지 ${reps}개입니다. 지금 리듬이면 충분히 붙을 수 있습니다.",
                "front_reps_tempo_${exercise.name}" to "${name}가 앞에 있습니다. 차이는 ${reps}개. 같은 템포를 유지해봅시다.",
                "front_reps_form_${exercise.name}" to "앞에는 ${name}, 차이는 ${reps}개입니다. ${exercise.steadyCue}"
            )
            "back_reps" -> listOf(
                "back_reps_hold_${exercise.name}" to "뒤 ${name}와 ${reps}개 차이입니다. 이 리듬이면 순위를 지킬 수 있습니다.",
                "back_reps_breathe_${exercise.name}" to "${name}가 뒤에서 따라옵니다. 차이는 ${reps}개. 호흡을 안정적으로 유지하세요.",
                "back_reps_form_${exercise.name}" to "뒤쪽 간격은 ${reps}개입니다. 리듬을 정리하고 현재 순위를 지켜봅시다."
            )
            "close_front" -> listOf(
                "close_front_easy_${exercise.name}" to "거의 붙었습니다. ${name}까지 ${reps}개입니다. 무리하지 말고 자연스럽게 넘어갑니다.",
                "close_front_breathe_${exercise.name}" to "${name}와 거의 나란합니다. 호흡만 유지하세요.",
                "close_front_flow_${exercise.name}" to "${reps}개만 더 줄이면 ${name}입니다. 지금 흐름 좋습니다."
            )
            "close_back" -> listOf(
                "close_back_defend_${exercise.name}" to "뒤 ${name}가 ${reps}개 차이까지 왔습니다. 리듬을 유지하며 순위를 지켜봅시다.",
                "close_back_steady_${exercise.name}" to "${name}가 가까워졌습니다. 차이는 ${reps}개입니다. 동작을 끝까지 일정하게 가져갑니다.",
                "close_back_form_${exercise.name}" to "뒤가 가까워졌습니다. ${name}와 ${reps}개 차이입니다. ${exercise.closeBackCue}"
            )
            "overtake" -> listOf(
                "overtake_flow_${exercise.name}" to "좋습니다. ${name}를 지나쳤습니다. 이 흐름을 유지하세요.",
                "overtake_next_${exercise.name}" to "${name}를 넘었습니다. 다음 고스트까지 차분하게 갑니다.",
                "overtake_rank_${exercise.name}" to "순위가 올라갑니다. 방금 ${name}를 지나쳤습니다."
            )
            "overtaken" -> listOf(
                "overtaken_ok_${exercise.name}" to "${name}가 앞서갑니다. 괜찮습니다. 다시 천천히 붙어봅시다.",
                "overtaken_form_${exercise.name}" to "${name}가 지나갔습니다. 리듬을 무너뜨리지 않는 것이 중요합니다.",
                "overtaken_sight_${exercise.name}" to "현재 흐름을 정리하면 됩니다. ${name}를 다시 시야에 둡니다."
            )
            "rank_up" -> listOf(
                "rank_up_current_${exercise.name}" to "순위가 올랐습니다. 현재 ${snapshot.rank}위입니다. 리듬이 살아났습니다.",
                "rank_up_body_${exercise.name}" to "현재 ${snapshot.rank}위입니다. 몸이 잘 반응하고 있습니다.",
                "rank_up_step_${exercise.name}" to "한 계단 올라섰습니다. 이 템포 그대로 가져갑니다."
            )
            "rank_down" -> listOf(
                "rank_down_breathe_${exercise.name}" to "현재 ${snapshot.rank}위입니다. 괜찮습니다. 호흡부터 다시 맞춥니다.",
                "rank_down_enough_${exercise.name}" to "한 계단 내려왔습니다. 아직 충분합니다. 다시 차분하게 붙어봅시다.",
                "rank_down_flow_${exercise.name}" to "현재 ${snapshot.rank}위입니다. 흐름은 다시 만들 수 있습니다."
            )
            "next_target" -> listOf(
                "next_target_gap_${exercise.name}" to "다음 목표는 ${name}입니다. 차분하게 개수 차이를 줄여봅시다.",
                "next_target_rhythm_${exercise.name}" to "이제 ${name}를 봅니다. 리듬을 유지하며 붙어갑니다.",
                "next_target_tempo_${exercise.name}" to "앞의 고스트는 ${name}. 지금 템포를 안정적으로 가져갑니다."
            )
            "last_ghost" -> listOf(
                "last_ghost_gap_${exercise.name}" to "마지막 고스트는 ${name}. 차이는 ${reps}개입니다.",
                "last_ghost_lead_${exercise.name}" to "${name}만 넘으면 선두입니다. 무리하지 말고 좁혀갑니다.",
                "last_ghost_chance_${exercise.name}" to "마지막 상대는 ${name}. 지금 리듬이면 기회가 있습니다."
            )
            "personal_best" -> listOf(
                "personal_best_flow_${exercise.name}" to "${name}를 넘으면 오늘 최고 흐름입니다. 차이는 ${reps}개입니다.",
                "personal_best_ghost_${exercise.name}" to "개인 최고 기록 고스트는 ${name}. 지금부터 차분하게 좁혀갑니다.",
                "personal_best_breathe_${exercise.name}" to "최고 기록까지 ${reps}개입니다. 호흡을 유지하면 충분히 도전할 수 있습니다."
            )
            "gap_reps" -> listOf(
                "gap_reps_stable_${exercise.name}" to "${name}와 ${reps}개 차이입니다. 리듬은 안정적입니다.",
                "gap_reps_reduce_${exercise.name}" to "${name}까지 차이는 ${reps}개입니다. 조금씩 줄여봅시다.",
                "gap_reps_body_${exercise.name}" to "${name}와의 간격은 ${reps}개입니다. 몸은 잘 움직이고 있습니다."
            )
            "pace_change" -> listOf(
                "pace_change_closing_${exercise.name}" to "${name}와의 간격이 줄고 있습니다. 이 리듬을 유지하세요.",
                "pace_change_opening_${exercise.name}" to "간격이 조금 벌어졌습니다. 괜찮습니다. 호흡부터 다시 정리합니다.",
                "pace_change_stable_${exercise.name}" to "지금 반복 속도가 안정적입니다. 고스트와의 차이를 계속 확인합니다."
            )
            "last_set" -> listOf(
                "last_set_front_${exercise.name}" to "마지막 구간입니다. 앞 고스트와의 차이를 끝까지 좁혀봅시다.",
                "last_set_rank_${exercise.name}" to "마지막 구간에 들어왔습니다. 현재 ${snapshot.rank}위입니다. 지금까지 잘 왔습니다.",
                "last_set_tempo_${exercise.name}" to "마지막 구간입니다. 고스트를 보면서 리듬을 끝까지 가져갑니다."
            )
            "finish_push" -> listOf(
                "finish_push_front_${exercise.name}" to "마지막 10개입니다. 앞 고스트와의 차이를 끝까지 봅니다.",
                "finish_push_rank_${exercise.name}" to "마지막 구간입니다. 몸을 가볍게 세우고 현재 순위를 지켜봅시다.",
                "finish_push_gap_${exercise.name}" to "끝이 보입니다. 고스트와의 간격을 보며 마지막 리듬을 유지하세요."
            )
            else -> emptyList()
        }
        if (options.isEmpty()) return null
        return pickCue(category, options, snapshot.reps + snapshot.rank + snapshot.elapsedSeconds)
    }

    private fun pickCue(category: String, options: List<Pair<String, String>>, seed: Int): Cue {
        val (templateId, text) = options[abs(seed).mod(options.size)]
        return Cue(category = category, templateId = templateId, text = text)
    }

    private fun isLastSet(snapshot: RepetitionRaceSnapshot): Boolean =
        snapshot.elapsedSeconds >= (snapshot.durationSeconds * LAST_SET_RATIO).toInt()

    private fun isFinishPush(snapshot: RepetitionRaceSnapshot, frontGap: Int?): Boolean =
        snapshot.durationSeconds - snapshot.elapsedSeconds <= 10 || (frontGap != null && frontGap in 1..10)

    private fun isLastGhost(snapshot: RepetitionRaceSnapshot, front: RepetitionGhostState): Boolean =
        snapshot.ghosts.count { it.reps > snapshot.reps } == 1 && front.reps > snapshot.reps

    private fun isPersonalBestGhost(ghost: RepetitionGhostState): Boolean =
        ghost.name.contains("Legend", ignoreCase = true) || ghost.name.contains("G5", ignoreCase = true)

    private fun hasElapsed(previous: Long?, nowMillis: Long, cooldownMillis: Long): Boolean =
        previous == null || nowMillis - previous >= cooldownMillis

    fun repBucket(gap: Int): Int = when (gap) {
        in Int.MIN_VALUE..3 -> 0
        in 4..7 -> 1
        in 8..15 -> 2
        in 16..30 -> 3
        else -> 4
    }
}


