package com.stickwithit.endure

import org.json.JSONArray

data class GhostCheckpoint(
    val elapsedSeconds: Int,
    val distanceMeters: Double
)

data class GhostRunner(
    val key: String,
    val label: String,
    val totalDistanceMeters: Double,
    val totalElapsedSeconds: Double,
    val checkpoints: List<GhostCheckpoint>
)

data class GhostComparison(
    val ghost: GhostRunner,
    val ghostDistanceMeters: Double,
    val deltaMeters: Double
)

object GhostRunnerParser {
    fun parse(json: String?): List<GhostRunner> {
        if (json.isNullOrBlank()) return emptyList()
        return runCatching {
            val items = JSONArray(json)
            (0 until items.length()).mapNotNull { index ->
                val item = items.optJSONObject(index) ?: return@mapNotNull null
                val key = item.optString("key").ifBlank { return@mapNotNull null }
                val label = item.optString("label").ifBlank { key }
                val totalDistanceMeters = item.optDouble("totalDistanceMeters", 0.0)
                val totalElapsedSeconds = item.optDouble("totalElapsedSeconds", 0.0)
                val checkpoints = item.optJSONArray("checkpoints")?.let { checkpointItems ->
                    (0 until checkpointItems.length()).mapNotNull { checkpointIndex ->
                        val checkpoint = checkpointItems.optJSONObject(checkpointIndex) ?: return@mapNotNull null
                        val elapsedSeconds = checkpoint.optDouble("elapsedSeconds", 0.0).toInt()
                        val distanceMeters = checkpoint.optDouble("distanceMeters", 0.0)
                        if (elapsedSeconds <= 0 || distanceMeters < 0.0) return@mapNotNull null
                        GhostCheckpoint(elapsedSeconds, distanceMeters)
                    }.sortedBy { it.elapsedSeconds }
                } ?: emptyList()

                if (totalDistanceMeters <= 0.0 || totalElapsedSeconds <= 0.0) return@mapNotNull null
                GhostRunner(key, label, totalDistanceMeters, totalElapsedSeconds, checkpoints)
            }
        }.getOrDefault(emptyList())
    }
}
