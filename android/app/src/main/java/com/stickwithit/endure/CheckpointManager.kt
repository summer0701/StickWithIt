package com.stickwithit.endure

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class CheckpointManager(
    private val dao: RunCheckpointDao,
    private val scope: CoroutineScope,
    private val coach: RuleBasedCoach,
    private val ttsEngine: NativeTtsEngine,
    private val coachAudioPlayer: CachedCoachAudioPlayer,
    private val ghostRunnersProvider: () -> List<GhostRunner>,
    private val onCheckpoint: (RunCheckpointEntity) -> Unit
) {
    companion object {
        const val CHECKPOINT_INTERVAL_SECONDS = 60
    }

    private var lastCheckpointElapsedSeconds = 0

    fun maybeCreateCheckpoint(
        sessionId: String,
        elapsedSeconds: Int,
        sample: LocationSample,
        targetDistanceMeters: Double,
        force: Boolean = false
    ) {
        val distanceKm = sample.distanceMeters / 1000.0
        val paceSecondsPerKm = if (distanceKm > 0.0) (elapsedSeconds / distanceKm).roundToInt() else null
        val elapsedHours = elapsedSeconds / 3600.0
        val averageSpeedKmh = if (elapsedHours > 0.0) distanceKm / elapsedHours else 0.0
        val cue = coach.createCue(
            elapsedSeconds = elapsedSeconds,
            distanceMeters = sample.distanceMeters,
            paceSecondsPerKm = paceSecondsPerKm,
            speedKmh = averageSpeedKmh,
            targetDistanceMeters = targetDistanceMeters,
            ghostRunners = ghostRunnersProvider()
        )

        if (!force && elapsedSeconds - lastCheckpointElapsedSeconds < CHECKPOINT_INTERVAL_SECONDS) {
            cue?.let {
                scope.launch {
                    withContext(Dispatchers.Main) {
                        coachAudioPlayer.playCategory(it.category, it.fallbackText)
                    }
                }
            }
            return
        }

        val checkpoint = RunCheckpointEntity(
            sessionId = sessionId,
            elapsedSeconds = elapsedSeconds,
            distanceMeters = sample.distanceMeters,
            paceSecondsPerKm = paceSecondsPerKm,
            speedKmh = averageSpeedKmh,
            latitude = sample.point.latitude,
            longitude = sample.point.longitude,
            spokenText = cue?.message,
            createdAt = System.currentTimeMillis(),
            synced = false
        )

        lastCheckpointElapsedSeconds = elapsedSeconds
        scope.launch {
            withContext(Dispatchers.Main) {
                cue?.let { coachAudioPlayer.playCategory(it.category, it.fallbackText) }
            }
            val id = dao.insert(checkpoint)
            val saved = checkpoint.copy(id = id)
            withContext(Dispatchers.Main) {
                onCheckpoint(saved)
            }
        }
    }
}
