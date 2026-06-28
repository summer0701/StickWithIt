package com.stickwithit.endure

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "RunningPlugin")
class RunningPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var database: RunDatabase
    private var receiver: BroadcastReceiver? = null

    override fun load() {
        database = RunDatabase.get(context)
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    RunningForegroundService.ACTION_STATE -> notifyListeners("runState", JSObject().apply {
                        put("sessionId", intent.getStringExtra("sessionId"))
                        put("elapsedSeconds", intent.getIntExtra("elapsedSeconds", 0))
                        put("distanceMeters", intent.getDoubleExtra("distanceMeters", 0.0))
                        put("speedKmh", intent.getDoubleExtra("speedKmh", 0.0))
                        put("latitude", intent.getDoubleExtra("latitude", 0.0))
                        put("longitude", intent.getDoubleExtra("longitude", 0.0))
                    }, true)
                    RunningForegroundService.ACTION_CHECKPOINT -> notifyListeners("checkpoint", JSObject().apply {
                        put("id", intent.getLongExtra("id", 0L))
                        put("session_id", intent.getStringExtra("sessionId"))
                        put("elapsed_seconds", intent.getIntExtra("elapsedSeconds", 0))
                        put("distance_meters", intent.getDoubleExtra("distanceMeters", 0.0))
                        val pace = intent.getIntExtra("paceSecondsPerKm", -1)
                        put("pace_seconds_per_km", if (pace >= 0) pace else null)
                        put("speed_kmh", intent.getDoubleExtra("speedKmh", 0.0))
                        put("latitude", intent.getDoubleExtra("latitude", 0.0))
                        put("longitude", intent.getDoubleExtra("longitude", 0.0))
                        put("spoken_text", intent.getStringExtra("spokenText"))
                        put("created_at", intent.getLongExtra("createdAt", System.currentTimeMillis()))
                    }, true)
                    RunningForegroundService.ACTION_DEBUG -> notifyListeners("debug", JSObject().apply {
                        put("message", intent.getStringExtra("message"))
                    }, true)
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(RunningForegroundService.ACTION_STATE)
            addAction(RunningForegroundService.ACTION_CHECKPOINT)
            addAction(RunningForegroundService.ACTION_DEBUG)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
    }

    override fun handleOnDestroy() {
        receiver?.let { context.unregisterReceiver(it) }
        receiver = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun startRun(call: PluginCall) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("ACCESS_FINE_LOCATION permission is required.")
            return
        }

        val options = call.data
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_START
            putExtra(RunningForegroundService.EXTRA_SESSION_ID, options.getString("sessionId", "native-${System.currentTimeMillis()}"))
            putExtra(RunningForegroundService.EXTRA_TARGET_DISTANCE_METERS, options.optDouble("targetDistanceMeters", 0.0))
            putExtra(RunningForegroundService.EXTRA_GHOST_RUNNERS_JSON, options.optString("ghostRunnersJson", "[]"))
            putExtra(RunningForegroundService.EXTRA_VOICE_TYPE, options.optString("voiceType", "type2"))
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun stopRun(call: PluginCall) {
        sendAction(RunningForegroundService.ACTION_STOP)
        call.resolve()
    }

    @PluginMethod
    fun pauseRun(call: PluginCall) {
        sendAction(RunningForegroundService.ACTION_PAUSE)
        call.resolve()
    }

    @PluginMethod
    fun resumeRun(call: PluginCall) {
        sendAction(RunningForegroundService.ACTION_RESUME)
        call.resolve()
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text", "")
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_SPEAK
            putExtra(RunningForegroundService.EXTRA_TEXT, text)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun playCoachAudio(call: PluginCall) {
        val file = call.getString("file", "")
        val fallbackText = call.getString("fallbackText", "")
        val voiceType = call.getString("voiceType", "type2")
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_PLAY_COACH_AUDIO
            putExtra(RunningForegroundService.EXTRA_FILE, file)
            putExtra(RunningForegroundService.EXTRA_TEXT, fallbackText)
            putExtra(RunningForegroundService.EXTRA_VOICE_TYPE, voiceType)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun setCoachVoiceType(call: PluginCall) {
        val voiceType = call.getString("voiceType", "type2")
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_COACH_VOICE_TYPE
            putExtra(RunningForegroundService.EXTRA_VOICE_TYPE, voiceType)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun updateTargetDistance(call: PluginCall) {
        val targetDistanceMeters = call.data.optDouble("targetDistanceMeters", 0.0)
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_UPDATE_TARGET_DISTANCE
            putExtra(RunningForegroundService.EXTRA_TARGET_DISTANCE_METERS, targetDistanceMeters)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = context.packageName
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !powerManager.isIgnoringBatteryOptimizations(packageName)) {
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            } else {
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (error: Exception) {
            try {
                val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
                call.resolve()
            } catch (fallbackError: Exception) {
                call.reject("배터리 최적화 설정 화면을 열지 못했습니다.", fallbackError)
            }
        }
    }

    @PluginMethod
    fun setTtsEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true)
        val intent = Intent(context, RunningForegroundService::class.java).apply {
            action = RunningForegroundService.ACTION_TTS_ENABLED
            putExtra(RunningForegroundService.EXTRA_TTS_ENABLED, enabled)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun getRunState(call: PluginCall) {
        scope.launch {
            val checkpoints = database.checkpointDao().listUnsynced()
            val payload = JSObject()
            payload.put("unsyncedCount", database.checkpointDao().countUnsynced())
            payload.put("unsyncedCheckpoints", JSArray(checkpoints.map { checkpoint ->
                JSObject().apply {
                    put("id", checkpoint.id)
                    put("session_id", checkpoint.sessionId)
                    put("elapsed_seconds", checkpoint.elapsedSeconds)
                    put("distance_meters", checkpoint.distanceMeters)
                    put("pace_seconds_per_km", checkpoint.paceSecondsPerKm)
                    put("speed_kmh", checkpoint.speedKmh)
                    put("latitude", checkpoint.latitude)
                    put("longitude", checkpoint.longitude)
                    put("spoken_text", checkpoint.spokenText)
                    put("created_at", checkpoint.createdAt)
                    put("synced", checkpoint.synced)
                }
            }))
            call.resolve(payload)
        }
    }

    @PluginMethod
    fun markCheckpointsSynced(call: PluginCall) {
        val ids = call.getArray("ids")?.toList<Long>() ?: emptyList()
        scope.launch {
            database.checkpointDao().markSynced(ids)
            call.resolve()
        }
    }

    private fun sendAction(action: String) {
        context.startService(Intent(context, RunningForegroundService::class.java).apply { this.action = action })
    }
}
