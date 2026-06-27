package com.stickwithit.endure

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface RunCheckpointDao {
    @Insert
    suspend fun insert(checkpoint: RunCheckpointEntity): Long

    @Query("SELECT * FROM run_checkpoints WHERE session_id = :sessionId ORDER BY created_at ASC")
    suspend fun listForSession(sessionId: String): List<RunCheckpointEntity>

    @Query("SELECT * FROM run_checkpoints WHERE synced = 0 ORDER BY created_at ASC LIMIT :limit")
    suspend fun listUnsynced(limit: Int = 200): List<RunCheckpointEntity>

    @Query("UPDATE run_checkpoints SET synced = 1 WHERE id IN (:ids)")
    suspend fun markSynced(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM run_checkpoints WHERE synced = 0")
    suspend fun countUnsynced(): Int
}
