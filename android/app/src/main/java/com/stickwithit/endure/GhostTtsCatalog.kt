package com.stickwithit.endure

import kotlin.random.Random

data class TtsVoiceProfile(
    val speechRate: Float,
    val pitch: Float
)

data class NativeTtsCue(
    val category: String,
    val text: String,
    val priority: Int,
    val speechRate: Float,
    val pitch: Float,
    val immediate: Boolean
) {
    val type: String = category
    val message: String = text
}

object GhostTtsCatalog {
    private const val DEFAULT_GHOST_NAME = "고스트"
    private const val DEFAULT_DISTANCE = "바로"
    private const val DEFAULT_SECONDS = "3"
    private const val DEFAULT_RANK = 6
    private const val TTS_SPEECH_RATE = 1.10f

    private val phrases = mapOf(
        "gap_time" to listOf(
            "{ghostName}보다 {seconds}초 앞서 있습니다.",
            "{ghostName}보다 {seconds}초 뒤처져 있습니다.",
            "{ghostName}와 {seconds}초 차이입니다."
        ),
        "pace_change" to listOf(
            "현재 페이스가 빨라지고 있습니다.",
            "현재 페이스가 느려지고 있습니다.",
            "지금 페이스를 유지하면 추월 가능합니다.",
            "지금 페이스를 유지하면 순위를 지킬 수 있습니다."
        ),
        "start" to listOf(
            "고스트 경쟁을 시작합니다.",
            "오늘의 고스트와 달려봅시다.",
            "현재 6명 중 {rank}위입니다.",
            "첫 번째 목표는 {ghostName}입니다.",
            "{ghostName}까지 {distance} 남았습니다."
        ),
        "current_rank" to listOf(
            "현재 {rank}위입니다.",
            "지금 {rank}위로 달리고 있습니다.",
            "현재 순위는 {rank}위입니다.",
            "현재 {rank}위를 유지하고 있습니다.",
            "지금 {rank}위입니다."
        ),
        "rank_up" to listOf(
            "순위가 올랐습니다. 현재 {rank}위입니다.",
            "현재 {rank}위로 올라섰습니다.",
            "한 계단 올라 현재 {rank}위입니다.",
            "좋습니다. 현재 {rank}위입니다."
        ),
        "rank_down" to listOf(
            "순위가 내려갔습니다. 현재 {rank}위입니다.",
            "현재 {rank}위입니다. 다시 따라잡아야 합니다.",
            "한 계단 내려 현재 {rank}위입니다.",
            "{ghostName}가 앞서갔습니다. 현재 {rank}위입니다."
        ),
        "front_distance" to listOf(
            "{ghostName}까지 {distance} 남았습니다.",
            "다음은 {ghostName}입니다. {distance} 앞에 있습니다.",
            "{ghostName}와의 거리는 {distance}입니다.",
            "{ghostName}가 {distance} 앞에 있습니다.",
            "{distance}만 더 가면 {ghostName}입니다."
        ),
        "back_distance" to listOf(
            "뒤 {ghostName}와 {distance} 차이입니다.",
            "{ghostName}가 {distance} 뒤에 있습니다.",
            "뒤 {ghostName}가 따라오고 있습니다.",
            "{ghostName}와의 간격은 {distance}입니다."
        ),
        "close_front" to listOf(
            "{ghostName}가 바로 앞입니다.",
            "{ghostName}까지 {distance}입니다.",
            "거의 따라왔습니다. {ghostName}까지 {distance}입니다.",
            "곧 {ghostName}를 추월합니다.",
            "{ghostName}와 거의 나란히 달리고 있습니다."
        ),
        "close_back" to listOf(
            "뒤 {ghostName}가 가까워졌습니다.",
            "{ghostName}가 거의 따라왔습니다.",
            "뒤 {ghostName}와 {distance} 차이입니다.",
            "{ghostName}를 따돌려야 합니다."
        ),
        "overtake" to listOf(
            "{ghostName}를 추월했습니다.",
            "방금 {ghostName}를 앞질렀습니다.",
            "{ghostName}를 넘어섰습니다.",
            "{ghostName}를 따라잡았습니다.",
            "좋습니다. {ghostName}를 추월했습니다."
        ),
        "overtaken" to listOf(
            "{ghostName}에게 추월당했습니다.",
            "{ghostName}가 다시 앞서갑니다.",
            "{ghostName}가 앞질러 갔습니다.",
            "{ghostName}를 다시 따라가야 합니다.",
            "{ghostName}가 앞에 있습니다."
        ),
        "next_target" to listOf(
            "다음은 {ghostName}입니다.",
            "다음 목표는 {ghostName}입니다.",
            "이제 {ghostName}를 따라갑니다.",
            "다음 고스트는 {ghostName}입니다.",
            "{ghostName}가 다음 목표입니다."
        ),
        "last_ghost" to listOf(
            "이제 {ghostName}만 남았습니다.",
            "마지막 상대는 {ghostName}입니다.",
            "{ghostName}를 넘으면 선두입니다.",
            "마지막 고스트는 {ghostName}입니다."
        ),
        "personal_best" to listOf(
            "{ghostName}를 넘으면 개인 최고 기록입니다.",
            "개인 최고 기록 고스트는 {ghostName}입니다.",
            "최고 기록까지 {distance} 남았습니다.",
            "최고의 나가 앞에 있습니다."
        ),
        "one_km_left" to listOf(
            "1킬로미터 남았습니다.",
            "1킬로미터 남았습니다. 현재 {rank}위입니다.",
            "남은 거리 1킬로미터. {ghostName}까지 {distance}입니다.",
            "마지막 1킬로미터입니다."
        ),
        "finish_push" to listOf(
            "결승선이 얼마 남지 않았습니다.",
            "현재 {rank}위입니다. 끝까지 유지하세요.",
            "{ghostName}까지 {distance}입니다.",
            "마지막까지 페이스를 유지하세요.",
            "이제 결승선입니다."
        ),
        "completed" to listOf(
            "러닝을 완료했습니다.",
            "최종 순위는 {rank}위입니다.",
            "모든 고스트를 추월했습니다.",
            "현재 1위로 완주했습니다.",
            "오늘의 러닝이 종료되었습니다.",
            "최고 기록을 달성했습니다.",
            "수고하셨습니다."
        )
    )

    fun buildCue(
        category: String,
        priority: Int,
        immediate: Boolean,
        recentTexts: Collection<String>,
        ghostName: String? = null,
        distance: String? = null,
        seconds: Int? = null,
        rank: Int? = null
    ): NativeTtsCue {
        val source = phrases[category] ?: phrases.getValue("current_rank")
        val selected = source.filterNot { recentTexts.contains(render(it, ghostName, distance, seconds, rank)) }
            .ifEmpty { source }
            .random()
        val profile = profileFor(category)

        return NativeTtsCue(
            category = category,
            text = render(selected, ghostName, distance, seconds, rank),
            priority = priority,
            speechRate = profile.speechRate,
            pitch = profile.pitch,
            immediate = immediate
        )
    }

    fun profileFor(category: String): TtsVoiceProfile =
        TtsVoiceProfile(speechRate = TTS_SPEECH_RATE, pitch = if (category == "finish_push") 1.04f else 1.0f)

    private fun render(template: String, ghostName: String?, distance: String?, seconds: Int?, rank: Int?): String =
        template
            .replace("{ghostName}", ghostName?.takeIf { it.isNotBlank() } ?: DEFAULT_GHOST_NAME)
            .replace("{distance}", distance?.takeIf { it.isNotBlank() } ?: DEFAULT_DISTANCE)
            .replace("{seconds}", (seconds ?: DEFAULT_SECONDS).toString())
            .replace("{rank}", (rank ?: DEFAULT_RANK).toString())

    private fun <T> List<T>.random(): T = this[Random.nextInt(size)]
}
