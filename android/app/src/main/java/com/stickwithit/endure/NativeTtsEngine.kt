package com.stickwithit.endure

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

class NativeTtsEngine(private val context: Context) {
    private val pendingMessages = ConcurrentLinkedQueue<NativeTtsCue>()
    private val audioFocusManager = AudioFocusManager(context)
    private var textToSpeech: TextToSpeech? = null
    @Volatile private var ready = false
    @Volatile private var enabled = true
    @Volatile private var speaking = false

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
                        speaking = false
                        audioFocusManager.abandonFocus()
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        speaking = false
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
        if (!ready) {
            pendingMessages.offer(cue)
            init()
            return
        }

        if (!audioFocusManager.requestFocus()) {
            pendingMessages.offer(cue)
            return
        }

        setSpeechRate(cue.speechRate)
        setPitch(cue.pitch)
        val utteranceId = UUID.randomUUID().toString()
        textToSpeech?.speak(cue.text, if (cue.immediate) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, Bundle(), utteranceId)
    }

    fun stop() {
        pendingMessages.clear()
        textToSpeech?.stop()
        speaking = false
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
}
