package com.stickwithit.endure

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class RunningForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var database: RunDatabase
    private lateinit var ttsEngine: NativeTtsEngine
    private lateinit var coachAudioPlayer: CachedCoachAudioPlayer
    private lateinit var coach: RuleBasedCoach
    private var locationTracker: LocationTracker? = null
    private var checkpointManager: CheckpointManager? = null
    private var checkpointTickerJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var sessionId: String = ""
    private var targetDistanceMeters: Double = 0.0
    private var ghostRunners: List<GhostRunner> = emptyList()
    private var startedAtMillis: Long = 0L
    private var paused = false
    private var lastSample: LocationSample? = null
    private var lastElapsedCoachSeconds = 0

    override fun onCreate() {
        super.onCreate()
        database = RunDatabase.get(this)
        ttsEngine = NativeTtsEngine(this)
        coachAudioPlayer = CachedCoachAudioPlayer(this, ttsEngine)
        coach = RuleBasedCoach()
        ttsEngine.init()
        coachAudioPlayer.preload()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startRun(intent)
            ACTION_STOP -> stopRun()
            ACTION_PAUSE -> paused = true
            ACTION_RESUME -> paused = false
            ACTION_SPEAK -> intent.getStringExtra(EXTRA_TEXT)?.let { ttsEngine.speak(it) }
            ACTION_PLAY_COACH_AUDIO -> {
                val file = intent.getStringExtra(EXTRA_FILE)
                val fallbackText = intent.getStringExtra(EXTRA_TEXT)
                if (file.isNullOrBlank()) {
                    fallbackText?.let { ttsEngine.speak(it) }
                } else {
                    coachAudioPlayer.playFile(file, fallbackText)
                }
            }
            ACTION_UPDATE_TARGET_DISTANCE -> {
                targetDistanceMeters = intent.getDoubleExtra(EXTRA_TARGET_DISTANCE_METERS, targetDistanceMeters)
                broadcastDebug("target_distance_updated:$targetDistanceMeters")
            }
            ACTION_TTS_ENABLED -> ttsEngine.setEnabled(intent.getBooleanExtra(EXTRA_TTS_ENABLED, true))
            null -> {
                broadcastDebug("service_restart_ignored")
                stopSelf(startId)
                return START_NOT_STICKY
            }
            else -> broadcastDebug("unknown_action_ignored:${intent.action}")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        checkpointTickerJob?.cancel()
        locationTracker?.stop()
        coachAudioPlayer.release()
        ttsEngine.shutdown()
        wakeLock?.takeIf { it.isHeld }?.release()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startRun(intent: Intent?) {
        sessionId = intent?.getStringExtra(EXTRA_SESSION_ID).orEmpty().ifBlank { "native-${System.currentTimeMillis()}" }
        targetDistanceMeters = intent?.getDoubleExtra(EXTRA_TARGET_DISTANCE_METERS, 0.0) ?: 0.0
        ghostRunners = GhostRunnerParser.parse(intent?.getStringExtra(EXTRA_GHOST_RUNNERS_JSON))
        startedAtMillis = System.currentTimeMillis()
        paused = false
        lastElapsedCoachSeconds = 0

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        checkpointManager = CheckpointManager(
            dao = database.checkpointDao(),
            scope = scope,
            coach = coach,
            ttsEngine = ttsEngine,
            coachAudioPlayer = coachAudioPlayer,
            ghostRunnersProvider = { ghostRunners },
            onCheckpoint = { broadcastCheckpoint(it) }
        )
        locationTracker?.stop()
        locationTracker = LocationTracker(
            context = this,
            onSample = { sample ->
                if (paused) return@LocationTracker
                lastSample = sample
                val elapsedSeconds = elapsedSeconds()
                checkpointManager?.maybeCreateCheckpoint(sessionId, elapsedSeconds, sample, targetDistanceMeters)
                broadcastState(sample, elapsedSeconds)
            },
            onRejected = { reason -> broadcastDebug("location_rejected:$reason") }
        ).also { it.start() }
        startCheckpointTicker()

        coachAudioPlayer.playCategory("start", "고스트 런 시작. 오늘의 상대는 어제의 나다.")
        broadcastDebug("coach_start_audio_requested")
        broadcastDebug("run_started:$sessionId")
    }

    private fun stopRun() {
        checkpointTickerJob?.cancel()
        val sample = lastSample
        if (sample != null && sessionId.isNotBlank()) {
            checkpointManager?.maybeCreateCheckpoint(sessionId, elapsedSeconds(), sample, targetDistanceMeters, force = true)
        }
        locationTracker?.stop()
        coachAudioPlayer.playCategory("completed", "러닝 완료. 오늘도 과거의 나를 이겼다.")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startCheckpointTicker() {
        checkpointTickerJob?.cancel()
        checkpointTickerJob = scope.launch {
            while (isActive) {
                delay(5_000L)
                if (paused) continue
                val elapsedSeconds = elapsedSeconds()
                val sample = lastSample
                if (sample == null) {
                    maybePlayElapsedCoachCue(elapsedSeconds)
                    continue
                }
                checkpointManager?.maybeCreateCheckpoint(sessionId, elapsedSeconds, sample, targetDistanceMeters)
            }
        }
    }

    private suspend fun maybePlayElapsedCoachCue(elapsedSeconds: Int) {
        if (elapsedSeconds - lastElapsedCoachSeconds < CheckpointManager.CHECKPOINT_INTERVAL_SECONDS) return

        val cue = coach.createCue(
            elapsedSeconds = elapsedSeconds,
            distanceMeters = 0.0,
            paceSecondsPerKm = null,
            speedKmh = 0.0,
            targetDistanceMeters = targetDistanceMeters,
            ghostRunners = ghostRunners
        ) ?: return

        lastElapsedCoachSeconds = elapsedSeconds
        withContext(Dispatchers.Main) {
            coachAudioPlayer.playCategory(cue.category, cue.fallbackText)
        }
        broadcastDebug("coach_elapsed_audio_requested:${cue.category}")
    }

    private fun elapsedSeconds(): Int =
        ((System.currentTimeMillis() - startedAtMillis).coerceAtLeast(0L) / 1000L).toInt()

    private fun broadcastCheckpoint(checkpoint: RunCheckpointEntity) {
        val intent = Intent(ACTION_CHECKPOINT).apply {
            setPackage(packageName)
            putExtra("id", checkpoint.id)
            putExtra("sessionId", checkpoint.sessionId)
            putExtra("elapsedSeconds", checkpoint.elapsedSeconds)
            putExtra("distanceMeters", checkpoint.distanceMeters)
            putExtra("paceSecondsPerKm", checkpoint.paceSecondsPerKm ?: -1)
            putExtra("speedKmh", checkpoint.speedKmh)
            putExtra("latitude", checkpoint.latitude)
            putExtra("longitude", checkpoint.longitude)
            putExtra("spokenText", checkpoint.spokenText)
            putExtra("createdAt", checkpoint.createdAt)
        }
        sendBroadcast(intent)
    }

    private fun broadcastState(sample: LocationSample, elapsedSeconds: Int) {
        val intent = Intent(ACTION_STATE).apply {
            setPackage(packageName)
            putExtra("sessionId", sessionId)
            putExtra("elapsedSeconds", elapsedSeconds)
            putExtra("distanceMeters", sample.distanceMeters)
            putExtra("speedKmh", sample.speedKmh)
            putExtra("latitude", sample.point.latitude)
            putExtra("longitude", sample.point.longitude)
        }
        sendBroadcast(intent)
    }

    private fun broadcastDebug(message: String) {
        sendBroadcast(Intent(ACTION_DEBUG).apply {
            setPackage(packageName)
            putExtra("message", message)
        })
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("끝까지 버텨라 실행 중")
            .setContentText("GPS 추적과 음성 코칭이 활성화되어 있습니다.")
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL_ID, "Running coach", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "StickWithIt:RunningWakeLock").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    companion object {
        const val CHANNEL_ID = "running_coach"
        const val NOTIFICATION_ID = 8801
        const val ACTION_START = "com.stickwithit.endure.RUN_START"
        const val ACTION_STOP = "com.stickwithit.endure.RUN_STOP"
        const val ACTION_PAUSE = "com.stickwithit.endure.RUN_PAUSE"
        const val ACTION_RESUME = "com.stickwithit.endure.RUN_RESUME"
        const val ACTION_SPEAK = "com.stickwithit.endure.RUN_SPEAK"
        const val ACTION_PLAY_COACH_AUDIO = "com.stickwithit.endure.RUN_PLAY_COACH_AUDIO"
        const val ACTION_UPDATE_TARGET_DISTANCE = "com.stickwithit.endure.RUN_UPDATE_TARGET_DISTANCE"
        const val ACTION_TTS_ENABLED = "com.stickwithit.endure.RUN_TTS_ENABLED"
        const val ACTION_STATE = "com.stickwithit.endure.RUN_STATE"
        const val ACTION_CHECKPOINT = "com.stickwithit.endure.RUN_CHECKPOINT"
        const val ACTION_DEBUG = "com.stickwithit.endure.RUN_DEBUG"
        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_TARGET_DISTANCE_METERS = "targetDistanceMeters"
        const val EXTRA_GHOST_RUNNERS_JSON = "ghostRunnersJson"
        const val EXTRA_FILE = "file"
        const val EXTRA_TEXT = "text"
        const val EXTRA_TTS_ENABLED = "ttsEnabled"
    }
}
