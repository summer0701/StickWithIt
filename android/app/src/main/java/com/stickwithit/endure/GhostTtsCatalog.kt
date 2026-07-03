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
    val immediate: Boolean,
    val templateId: String = category
) {
    val type: String = category
    val message: String = text
}

object GhostTtsCatalog {
    private const val DEFAULT_GHOST_NAME = "G1"
    private const val DEFAULT_DISTANCE = "바로"
    private const val DEFAULT_SECONDS = "3"
    private const val DEFAULT_RANK = 6
    private const val TTS_SPEECH_RATE = 1.10f

    private val phrases = mapOf(
        "gap_time" to listOf(
            "{ghostName}와 약 {seconds}초 차이입니다. 리듬은 안정적입니다.",
            "{ghostName}까지 시간 차이는 약 {seconds}초입니다. 조금씩 줄여봅시다.",
            "{ghostName}와의 간격은 {distance}, 약 {seconds}초입니다."
        ),
        "pace_change" to listOf(
            "{ghostName}와의 간격이 줄고 있습니다. 이 페이스를 유지하세요.",
            "간격이 조금 벌어졌습니다. 괜찮습니다. 호흡부터 다시 정리합니다.",
            "지금 페이스가 안정적입니다. 고스트와의 간격을 계속 확인합니다."
        ),
        "start" to listOf(
            "레이스가 시작됐습니다. 오늘의 고스트들이 앞에서 기다리고 있습니다.",
            "첫 목표는 {ghostName}. 차이는 {distance}입니다. 서두르지 말고 붙어봅시다.",
            "현재 {rank}위입니다. 앞 고스트부터 차분하게 좁혀갑니다."
        ),
        "current_rank" to listOf(
            "현재 {rank}위입니다. 앞 고스트와의 간격을 차분히 봅니다.",
            "현재 {rank}위입니다. 리듬을 유지하며 다음 고스트를 확인합니다.",
            "지금 {rank}위입니다. 호흡을 정리하고 흐름을 이어갑니다."
        ),
        "rank_up" to listOf(
            "순위가 올랐습니다. 현재 {rank}위입니다. 리듬이 살아났습니다.",
            "현재 {rank}위입니다. 지금 몸이 잘 반응하고 있습니다.",
            "한 계단 올라섰습니다. 이 리듬 그대로 가져갑니다."
        ),
        "rank_down" to listOf(
            "현재 {rank}위입니다. 괜찮습니다. 호흡부터 다시 맞춥니다.",
            "한 계단 내려왔습니다. 아직 충분합니다. 다시 차분하게 붙어봅시다.",
            "현재 {rank}위입니다. 흐름은 다시 만들 수 있습니다."
        ),
        "front_distance" to listOf(
            "{ghostName}까지 {distance}. 지금 리듬이면 충분히 붙을 수 있습니다.",
            "{ghostName}가 앞에 있습니다. 차이는 {distance}. 호흡을 유지하며 좁혀갑니다.",
            "앞에는 {ghostName}, 차이는 {distance}. 지금 페이스를 믿어도 좋습니다."
        ),
        "back_distance" to listOf(
            "뒤 {ghostName}와 {distance}. 이 리듬이면 순위를 지킬 수 있습니다.",
            "{ghostName}가 뒤에서 따라옵니다. 차이는 {distance}. 페이스를 안정적으로 유지하세요.",
            "뒤쪽 간격은 {distance}. 호흡을 정리하고 현재 순위를 지켜봅시다."
        ),
        "close_front" to listOf(
            "거의 붙었습니다. {ghostName}까지 {distance}. 무리하지 말고 자연스럽게 넘어갑니다.",
            "{ghostName}와 거의 나란합니다. 호흡만 유지하세요.",
            "{distance}만 더 좁히면 {ghostName}입니다. 지금 리듬 좋습니다."
        ),
        "close_back" to listOf(
            "뒤 {ghostName}가 {distance}까지 왔습니다. 호흡을 정리하고 순위를 지켜봅시다.",
            "{ghostName}가 가까워졌습니다. 차이는 {distance}. 페이스를 잃지 마세요.",
            "뒤가 가까워졌습니다. {ghostName}와 {distance}. 자세를 세우고 갑니다."
        ),
        "overtake" to listOf(
            "좋습니다. {ghostName}를 지나쳤습니다. 이 흐름을 유지하세요.",
            "{ghostName}를 넘었습니다. 다음 고스트까지 차분하게 갑니다.",
            "순위가 올라갑니다. 방금 {ghostName}를 지나쳤습니다."
        ),
        "overtaken" to listOf(
            "{ghostName}가 앞서갑니다. 괜찮습니다. 다시 천천히 붙어봅시다.",
            "{ghostName}가 지나갔습니다. 페이스를 무너뜨리지 않는 게 중요합니다.",
            "현재 흐름을 정리하면 됩니다. {ghostName}를 다시 시야에 둡니다."
        ),
        "next_target" to listOf(
            "다음 목표는 {ghostName}입니다. 차분하게 간격을 줄여봅시다.",
            "이제 {ghostName}를 봅니다. 리듬을 유지하며 붙어갑니다.",
            "앞의 고스트는 {ghostName}. 지금 페이스를 안정적으로 가져갑니다."
        ),
        "last_ghost" to listOf(
            "마지막 고스트는 {ghostName}. 차이는 {distance}입니다.",
            "{ghostName}만 넘으면 선두입니다. 무리하지 말고 좁혀갑니다.",
            "마지막 상대는 {ghostName}. 지금 리듬이면 기회가 있습니다."
        ),
        "personal_best" to listOf(
            "{ghostName}를 넘으면 오늘 최고 흐름입니다. 차이는 {distance}.",
            "개인 최고 기록 고스트는 {ghostName}. 지금부터 차분하게 좁혀갑니다.",
            "최고 기록까지 {distance}. 호흡을 유지하면 충분히 도전할 수 있습니다."
        ),
        "one_km_left" to listOf(
            "마지막 1킬로미터입니다. 앞 고스트와의 차이를 끝까지 좁혀봅시다.",
            "1킬로미터 남았습니다. 현재 {rank}위입니다. 지금까지 잘 왔습니다.",
            "마지막 1킬로미터입니다. 고스트를 보면서 리듬을 끝까지 가져갑니다."
        ),
        "finish_push" to listOf(
            "결승선이 가까워졌습니다. 앞 고스트와의 차이를 끝까지 봅니다.",
            "마지막 구간입니다. 자세를 세우고 현재 순위를 지켜봅시다.",
            "끝이 보입니다. 고스트와의 간격을 보며 마지막 리듬을 유지하세요."
        ),
        "completed" to listOf(
            "레이스 종료. 수고하셨습니다. 최종 순위는 {rank}위입니다.",
            "러닝 완료. 오늘도 끝까지 해냈습니다.",
            "오늘의 기록이 저장되었습니다. 중요한 건 끝까지 달렸다는 겁니다."
        ),
        "fallback" to listOf(
            "고스트 정보를 확인하고 있습니다. 지금은 편안하게 리듬을 만듭니다.",
            "고스트 간격을 계산 중입니다. 호흡을 정리하며 계속 갑니다."
        )
    )

    fun buildCue(
        category: String,
        priority: Int,
        immediate: Boolean,
        spokenTemplateIds: Collection<String>,
        ghostName: String? = null,
        distance: String? = null,
        seconds: Int? = null,
        rank: Int? = null
    ): NativeTtsCue? {
        val source = phrases[category] ?: phrases.getValue("fallback")
        val eligible = source.withIndex()
            .filter { (_, template) -> hasRequiredVariables(template, ghostName, distance, seconds, rank) }
            .ifEmpty { phrases.getValue("fallback").withIndex().toList() }
            .map { (index, template) -> TemplateChoice("$category:$index", template) }
            .filterNot { spokenTemplateIds.contains(it.id) }

        val selected = eligible.randomOrNull() ?: return null
        val profile = profileFor(category)

        return NativeTtsCue(
            category = category,
            text = render(selected.template, ghostName, distance, seconds, rank),
            priority = priority,
            speechRate = profile.speechRate,
            pitch = profile.pitch,
            immediate = immediate,
            templateId = selected.id
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

    private fun hasRequiredVariables(template: String, ghostName: String?, distance: String?, seconds: Int?, rank: Int?): Boolean {
        if (template.contains("{ghostName}") && ghostName.isNullOrBlank()) return false
        if (template.contains("{distance}") && distance.isNullOrBlank()) return false
        if (template.contains("{seconds}") && seconds == null) return false
        if (template.contains("{rank}") && rank == null) return false
        return true
    }

    private data class TemplateChoice(val id: String, val template: String)

    private fun <T> List<T>.randomOrNull(): T? =
        if (isEmpty()) null else this[Random.nextInt(size)]
}
