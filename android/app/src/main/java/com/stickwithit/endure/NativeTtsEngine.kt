package com.stickwithit.endure

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

class NativeTtsEngine(private val context: Context) {
    private val pendingMessages = ConcurrentLinkedQueue<NativeTtsCue>()
    private val finalUtteranceIds = ConcurrentHashMap.newKeySet<String>()
    private val audioFocusManager = AudioFocusManager(context)
    private var textToSpeech: TextToSpeech? = null
    @Volatile private var ready = false
    @Volatile private var enabled = true
    @Volatile private var speaking = false
    @Volatile private var activePriority = 0

    fun init() {
        if (textToSpeech != null) return
        textToSpeech = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) {
                setLanguage(Locale.KOREA)
                setSpeechRate(1.1f)
                setPitch(1.0f)
                textToSpeech?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        speaking = true
                    }
                    override fun onDone(utteranceId: String?) {
                        completeUtterance(utteranceId)
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        completeUtterance(utteranceId)
                    }

                    override fun onError(utteranceId: String?, errorCode: Int) {
                        completeUtterance(utteranceId)
                    }

                    private fun completeUtterance(utteranceId: String?) {
                        if (utteranceId != null && !finalUtteranceIds.remove(utteranceId)) return
                        speaking = false
                        activePriority = 0
                        audioFocusManager.abandonFocus()
                    }
                })
                drainQueue()
            }
        }
    }

    fun speak(text: String) {
        val profile = GhostTtsCatalog.profileFor("encouragement")
        speak(
            NativeTtsCue(
                category = "encouragement",
                text = text,
                priority = 35,
                speechRate = profile.speechRate,
                pitch = profile.pitch,
                immediate = false
            )
        )
    }

    fun speak(cue: NativeTtsCue) {
        if (!enabled) return
        if (cue.text.isBlank()) return
        if (isSpeaking() && !cue.immediate && cue.priority <= activePriority) return
        if (!ready) {
            offerPending(cue)
            init()
            return
        }

        if (!audioFocusManager.requestFocus()) {
            offerPending(cue)
            return
        }

        setSpeechRate(cue.speechRate)
        setPitch(cue.pitch)
        val speechParts = buildSpeechParts(cue.text)
        if (speechParts.isEmpty()) return
        val utteranceGroupId = UUID.randomUUID().toString()
        val finalUtteranceId = "$utteranceGroupId:${speechParts.lastIndex}"
        finalUtteranceIds.add(finalUtteranceId)
        activePriority = cue.priority
        speaking = true
        speechParts.forEachIndexed { index, speechPart ->
            val utteranceId = "$utteranceGroupId:$index"
            val queueMode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            textToSpeech?.speak(speechPart, queueMode, Bundle(), utteranceId)
            if (index < speechParts.lastIndex) {
                textToSpeech?.playSilentUtterance(SENTENCE_PAUSE_MS, TextToSpeech.QUEUE_ADD, "$utteranceGroupId:pause:$index")
            }
        }
    }

    fun stop() {
        pendingMessages.clear()
        finalUtteranceIds.clear()
        textToSpeech?.stop()
        speaking = false
        activePriority = 0
        audioFocusManager.abandonFocus()
    }

    fun setEnabled(nextEnabled: Boolean) {
        enabled = nextEnabled
        if (enabled) {
            init()
        } else {
            stop()
        }
    }

    fun shutdown() {
        stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        ready = false
    }

    fun isReady(): Boolean = ready

    fun isSpeaking(): Boolean = speaking || textToSpeech?.isSpeaking == true

    fun setLanguage(locale: Locale) {
        val result = textToSpeech?.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            textToSpeech?.setLanguage(Locale.KOREAN)
        }
    }

    fun setSpeechRate(rate: Float) {
        textToSpeech?.setSpeechRate(rate)
    }

    fun setPitch(pitch: Float) {
        textToSpeech?.setPitch(pitch)
    }

    private fun drainQueue() {
        while (true) {
            val text = pendingMessages.poll() ?: break
            speak(text)
        }
    }

    private fun offerPending(cue: NativeTtsCue) {
        if (pendingMessages.any { it.templateId == cue.templateId }) return
        pendingMessages.offer(cue)
    }

    private fun buildSpeechParts(text: String): List<String> {
        return splitSentences(text)
            .map { ensureSpeechPunctuation(it.trim()) }
            .filter { it.isNotBlank() }
    }

    private fun splitSentences(text: String): List<String> {
        val sentences = mutableListOf<String>()
        val current = StringBuilder()
        text.forEach { char ->
            current.append(char)
            if (isSentenceBoundary(char)) {
                val sentence = current.toString().trim()
                if (sentence.isNotBlank()) sentences.add(sentence)
                current.clear()
            }
        }
        val tail = current.toString().trim()
        if (tail.isNotBlank()) sentences.add(tail)
        return sentences
    }

    private fun ensureSpeechPunctuation(text: String): String {
        if (text.isBlank() || isSentenceBoundary(text.last())) return text
        return "$text."
    }

    private fun isSentenceBoundary(char: Char): Boolean {
        return char == '.'
    }

    companion object {
        private const val SENTENCE_PAUSE_MS = 300L
    }
}
