package com.stickwithit.endure

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "run_checkpoints")
data class RunCheckpointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "session_id") val sessionId: String,
    @ColumnInfo(name = "elapsed_seconds") val elapsedSeconds: Int,
    @ColumnInfo(name = "distance_meters") val distanceMeters: Double,
    @ColumnInfo(name = "pace_seconds_per_km") val paceSecondsPerKm: Int?,
    @ColumnInfo(name = "speed_kmh") val speedKmh: Double,
    val latitude: Double,
    val longitude: Double,
    @ColumnInfo(name = "spoken_text") val spokenText: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    val synced: Boolean = false
)
