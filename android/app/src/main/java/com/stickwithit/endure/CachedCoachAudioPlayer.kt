package com.stickwithit.endure

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import org.json.JSONObject
import kotlin.random.Random

data class CachedCoachAudioItem(
    val key: String,
    val category: String,
    val text: String,
    val file: String
)

class CachedCoachAudioPlayer(
    private val context: Context,
    private val fallbackTts: NativeTtsEngine
) {
    private val audioFocusManager = AudioFocusManager(context)
    private val recentKeys = ArrayDeque<String>()
    private var manifestItems: List<CachedCoachAudioItem> = emptyList()
    private var mediaPlayer: MediaPlayer? = null
    private var voiceType: String = DEFAULT_VOICE_TYPE

    fun preload() {
        if (manifestItems.isNotEmpty()) return
        manifestItems = runCatching { readManifestItems() }.getOrDefault(emptyList())
    }

    fun setVoiceType(nextVoiceType: String?) {
        voiceType = sanitizeVoiceType(nextVoiceType)
        recentKeys.clear()
    }

    fun playCategory(category: String, fallbackText: String?) {
        preload()
        val candidates = manifestItems.filter { it.category == category }
        val item = candidates.firstOrNull { !recentKeys.contains(it.key) } ?: candidates.randomOrNull()
        if (item == null) {
            fallbackText?.let { fallbackTts.speak(it) }
            return
        }
        playFile(item.file, fallbackText ?: item.text, item.key)
    }

    fun playFile(file: String, fallbackText: String?) {
        playFile(file, fallbackText, file)
    }

    fun release() {
        mediaPlayer?.release()
        mediaPlayer = null
        audioFocusManager.abandonFocus()
    }

    private fun playFile(file: String, fallbackText: String?, recentKey: String) {
        runCatching {
            val assetPath = selectedVoiceFile(file).removePrefix("/").let {
                if (it.startsWith("public/")) it else "public/$it"
            }
            val descriptor = context.assets.openFd(assetPath)
            mediaPlayer?.release()
            if (!audioFocusManager.requestFocus()) error("Audio focus was not granted.")
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
                setOnCompletionListener {
                    it.release()
                    if (mediaPlayer === it) mediaPlayer = null
                    audioFocusManager.abandonFocus()
                }
                setOnErrorListener { player, _, _ ->
                    player.release()
                    if (mediaPlayer === player) mediaPlayer = null
                    audioFocusManager.abandonFocus()
                    fallbackText?.let { fallbackTts.speak(it) }
                    true
                }
                prepare()
                start()
            }
            remember(recentKey)
        }.onFailure {
            audioFocusManager.abandonFocus()
            fallbackText?.let { text -> fallbackTts.speak(text) }
        }
    }

    private fun readManifestItems(): List<CachedCoachAudioItem> {
        val json = context.assets.open("public/tts-cache/manifest.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
        val items = JSONObject(json).getJSONObject("items")
        return items.keys().asSequence().map { key ->
            val item = items.getJSONObject(key)
            CachedCoachAudioItem(
                key = key,
                category = item.getString("category"),
                text = item.getString("text"),
                file = item.getString("file")
            )
        }.toList()
    }

    private fun remember(key: String) {
        recentKeys.addLast(key)
        while (recentKeys.size > 8) recentKeys.removeFirst()
    }

    private fun <T> List<T>.randomOrNull(): T? =
        if (isEmpty()) null else this[Random.nextInt(size)]

    private fun selectedVoiceFile(file: String): String {
        val normalized = file.removePrefix("/")
        if (normalized.startsWith("tts-cache/type1/") || normalized.startsWith("tts-cache/type2/")) {
            return "/$normalized"
        }
        val fileName = normalized.substringAfterLast("/")
        return "/tts-cache/$voiceType/$fileName"
    }

    private fun sanitizeVoiceType(value: String?): String =
        if (value == "type1" || value == "type2") value else DEFAULT_VOICE_TYPE

    companion object {
        private const val DEFAULT_VOICE_TYPE = "type2"
    }
}
