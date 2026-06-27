package com.stickwithit.endure

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class CheckpointManager(
    private val dao: RunCheckpointDao,
    private val scope: CoroutineScope,
    private val coach: RuleBasedCoach,
    private val ttsEngine: NativeTtsEngine,
    private val recentAverageSpeedKmhProvider: () -> Double?,
    private val recentBestSpeedKmhProvider: () -> Double?,
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
        if (!force && elapsedSeconds - lastCheckpointElapsedSeconds < CHECKPOINT_INTERVAL_SECONDS) return
        if (sample.distanceMeters <= 0.0) return

        val distanceKm = sample.distanceMeters / 1000.0
        val paceSecondsPerKm = if (distanceKm > 0.0) (elapsedSeconds / distanceKm).roundToInt() else null
        val elapsedHours = elapsedSeconds / 3600.0
        val averageSpeedKmh = if (elapsedHours > 0.0) distanceKm / elapsedHours else 0.0
        val recentAverageDistanceMeters = recentAverageSpeedKmhProvider()?.takeIf { it > 0.0 }?.let {
            it * elapsedHours * 1000.0
        }
        val recentBestDeltaSeconds = recentBestSpeedKmhProvider()?.takeIf { it > 0.0 && sample.distanceMeters > 0.0 }?.let {
            val bestElapsedAtDistance = (sample.distanceMeters / 1000.0) / it * 3600.0
            (bestElapsedAtDistance - elapsedSeconds).toInt()
        }
        val cue = coach.createCue(
            elapsedSeconds = elapsedSeconds,
            distanceMeters = sample.distanceMeters,
            paceSecondsPerKm = paceSecondsPerKm,
            speedKmh = averageSpeedKmh,
            targetDistanceMeters = targetDistanceMeters,
            recentAverageDistanceMeters = recentAverageDistanceMeters,
            recentBestDeltaSeconds = recentBestDeltaSeconds
        )

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
            val id = dao.insert(checkpoint)
            val saved = checkpoint.copy(id = id)
            cue?.message?.let { ttsEngine.speak(it) }
            onCheckpoint(saved)
        }
    }
}
