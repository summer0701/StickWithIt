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
    private val pendingMessages = ConcurrentLinkedQueue<String>()
    private val audioFocusManager = AudioFocusManager(context)
    private var textToSpeech: TextToSpeech? = null
    @Volatile private var ready = false
    @Volatile private var enabled = true

    fun init() {
        if (textToSpeech != null) return
        textToSpeech = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) {
                setLanguage(Locale.KOREAN)
                setSpeechRate(1.0f)
                setPitch(1.0f)
                textToSpeech?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = Unit
                    override fun onDone(utteranceId: String?) {
                        audioFocusManager.abandonFocus()
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        audioFocusManager.abandonFocus()
                    }
                })
                drainQueue()
            }
        }
    }

    fun speak(text: String) {
        if (!enabled) return
        if (text.isBlank()) return
        if (!ready) {
            pendingMessages.offer(text)
            init()
            return
        }

        if (!audioFocusManager.requestFocus()) {
            pendingMessages.offer(text)
            return
        }

        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, UUID.randomUUID().toString())
        }
        textToSpeech?.speak(text, TextToSpeech.QUEUE_ADD, params, UUID.randomUUID().toString())
    }

    fun stop() {
        pendingMessages.clear()
        textToSpeech?.stop()
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

    fun setLanguage(locale: Locale) {
        textToSpeech?.language = locale
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
