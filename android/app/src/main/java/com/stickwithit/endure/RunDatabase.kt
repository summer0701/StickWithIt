package com.stickwithit.endure

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [RunCheckpointEntity::class], version = 1, exportSchema = false)
abstract class RunDatabase : RoomDatabase() {
    abstract fun checkpointDao(): RunCheckpointDao

    companion object {
        @Volatile private var instance: RunDatabase? = null

        fun get(context: Context): RunDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    RunDatabase::class.java,
                    "stickwithit-running.db"
                ).build().also { instance = it }
            }
    }
}
