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

    fun preload() {
        if (manifestItems.isNotEmpty()) return
        manifestItems = runCatching { readManifestItems() }.getOrDefault(emptyList())
    }

    fun playCategory(category: String, fallbackText: String?) {
        preload()
        val manifestCandidates = manifestItems.filter { it.category == category }
        val candidates = manifestCandidates.ifEmpty { syntheticCategoryItems(category) }
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
            val assetPath = audioFile(file).removePrefix("/").let {
                if (it.startsWith("public/")) it else "public/$it"
            }
            mediaPlayer?.release()
            mediaPlayer = null
            if (!audioFocusManager.requestFocus()) error("Audio focus was not granted.")
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                context.assets.openFd(assetPath).use { descriptor ->
                    setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
                }
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

    private fun syntheticCategoryItems(category: String): List<CachedCoachAudioItem> =
        (1..10).map { index ->
            val key = "${category}_${index.toString().padStart(3, '0')}"
            CachedCoachAudioItem(
                key = key,
                category = category,
                text = "",
                file = "/tts-cache/$key.mp3"
            )
        }

    private fun remember(key: String) {
        recentKeys.addLast(key)
        while (recentKeys.size > 8) recentKeys.removeFirst()
    }

    private fun <T> List<T>.randomOrNull(): T? =
        if (isEmpty()) null else this[Random.nextInt(size)]

    private fun audioFile(file: String): String {
        val normalized = file.removePrefix("/")
        val fileName = normalized.substringAfterLast("/")
        return "/tts-cache/$fileName"
    }
}
