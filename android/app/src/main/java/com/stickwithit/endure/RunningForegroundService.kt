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

class RunningForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var database: RunDatabase
    private lateinit var ttsEngine: NativeTtsEngine
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

    override fun onCreate() {
        super.onCreate()
        database = RunDatabase.get(this)
        ttsEngine = NativeTtsEngine(this)
        coach = RuleBasedCoach()
        ttsEngine.init()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopRun()
            ACTION_PAUSE -> paused = true
            ACTION_RESUME -> paused = false
            ACTION_SPEAK -> intent.getStringExtra(EXTRA_TEXT)?.let { ttsEngine.speak(it) }
            ACTION_TTS_ENABLED -> ttsEngine.setEnabled(intent.getBooleanExtra(EXTRA_TTS_ENABLED, true))
            else -> startRun(intent)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        checkpointTickerJob?.cancel()
        locationTracker?.stop()
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

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        checkpointManager = CheckpointManager(
            dao = database.checkpointDao(),
            scope = scope,
            coach = coach,
            ttsEngine = ttsEngine,
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

        ttsEngine.speak("좋아. 러닝을 시작했어. 화면이 꺼져도 음성 코칭을 계속할게.")
        broadcastDebug("run_started:$sessionId")
    }

    private fun stopRun() {
        checkpointTickerJob?.cancel()
        val sample = lastSample
        if (sample != null && sessionId.isNotBlank()) {
            checkpointManager?.maybeCreateCheckpoint(sessionId, elapsedSeconds(), sample, targetDistanceMeters, force = true)
        }
        locationTracker?.stop()
        ttsEngine.speak("러닝을 종료했어. 오늘도 끝까지 버텼다.")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startCheckpointTicker() {
        checkpointTickerJob?.cancel()
        checkpointTickerJob = scope.launch {
            while (isActive) {
                delay(5_000L)
                if (paused) continue
                val sample = lastSample ?: continue
                checkpointManager?.maybeCreateCheckpoint(sessionId, elapsedSeconds(), sample, targetDistanceMeters)
            }
        }
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
        const val ACTION_TTS_ENABLED = "com.stickwithit.endure.RUN_TTS_ENABLED"
        const val ACTION_STATE = "com.stickwithit.endure.RUN_STATE"
        const val ACTION_CHECKPOINT = "com.stickwithit.endure.RUN_CHECKPOINT"
        const val ACTION_DEBUG = "com.stickwithit.endure.RUN_DEBUG"
        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_TARGET_DISTANCE_METERS = "targetDistanceMeters"
        const val EXTRA_GHOST_RUNNERS_JSON = "ghostRunnersJson"
        const val EXTRA_TEXT = "text"
        const val EXTRA_TTS_ENABLED = "ttsEnabled"
    }
}
