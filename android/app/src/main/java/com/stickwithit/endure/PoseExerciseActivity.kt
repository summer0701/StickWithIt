package com.stickwithit.endure

import android.Manifest
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.YuvImage
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.common.util.concurrent.ListenableFuture
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.floor
import kotlin.math.roundToInt

abstract class PoseExerciseActivity : ComponentActivity() {
    protected abstract val exerciseName: String
    protected abstract val evaluator: PoseExerciseEvaluator
    protected abstract val completionAction: String
    protected abstract val defaultBaseAverageValue: Double
    protected abstract val musicQuery: String
    protected open val baseAverageExtraName: String = EXTRA_BASE_AVERAGE_REPS
    protected open val previewScaleType: PreviewView.ScaleType = PreviewView.ScaleType.FILL_CENTER
    protected open val cameraAspectRatio: Int? = null
    protected open val requireStableFullBodyBeforeStart: Boolean = false
    protected open val startCountdownSeconds: Int = 0
    protected open val screenOrientation: Int = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    protected open val readinessLandmarks: List<Int> = fullBodyStartLandmarks
    protected open val readinessMissingDetail: String = "전신이 보이도록 카메라 앞에 서 주세요."
    protected open val readinessAcceptedDetail: String = "좋습니다!"
    protected open val readinessHoldingDetail: String = "좋습니다! 자세를 유지하세요."

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: PoseSkeletonOverlayView
    private lateinit var finishButton: TextView
    private lateinit var musicButton: TextView
    private lateinit var countView: TextView
    private lateinit var feedbackView: TextView
    private lateinit var rankingCard: LinearLayout
    private lateinit var metaView: LinearLayout
    private lateinit var timerView: TextView
    private lateinit var progressView: ProgressBar
    private lateinit var cameraProviderFuture: ListenableFuture<ProcessCameraProvider>
    private val rankRowViews = mutableListOf<TextView>()
    private val analyzerExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val ttsEngine by lazy { NativeTtsEngine(this) }
    private val recentNarrations = ArrayDeque<String>()
    private val fpsSamples = ArrayDeque<Float>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val switchingModel = AtomicBoolean(false)
    private var poseLandmarker: PoseLandmarker? = null
    private var modelTier: ModelTier = ModelTier.FULL
    private var startedAt = 0L
    private var reps = 0
    private var targetDurationSeconds = 60
    private var baseAverageValue = defaultBaseAverageValue
    private var durationFinished = false
    private var lastFrameAt = 0L
    private var lastNarrationAt = 0L
    private var lastQualityAt = 0L
    private var workoutStarted = true
    private var readyForStartCountdown = false
    private var stablePoseStartedAt = 0L
    private var countdownStartedAt = 0L
    private var lastReadinessTtsAt = 0L
    private var lastReadinessTtsText = ""
    private var goodMs = 0L
    private var warningMs = 0L
    private var badMs = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = screenOrientation
        targetDurationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 60).coerceIn(30, 600)
        baseAverageValue = intent.getDoubleExtra(baseAverageExtraName, defaultBaseAverageValue)
            .takeIf { it.isFinite() && it > 0.0 }
            ?: defaultBaseAverageValue
        startedAt = SystemClock.elapsedRealtime()
        readyForStartCountdown = !requireStableFullBodyBeforeStart
        workoutStarted = startCountdownSeconds <= 0 && readyForStartCountdown
        lastNarrationAt = startedAt
        lastQualityAt = startedAt
        ttsEngine.init()
        buildUi()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startPoseCamera()
        } else {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA)
        }
    }

    @Suppress("DEPRECATION")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startPoseCamera()
        } else {
            feedbackView.text = "주의\n카메라 권한을 허용해 주세요."
        }
    }

    override fun onDestroy() {
        if (!durationFinished) cancelWorkout()
        mainHandler.removeCallbacksAndMessages(null)
        poseLandmarker?.close()
        ttsEngine.shutdown()
        analyzerExecutor.shutdown()
        super.onDestroy()
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        previewView = PreviewView(this).apply { scaleType = previewScaleType }
        overlayView = PoseSkeletonOverlayView(this).apply { guideEnabled = requireStableFullBodyBeforeStart }
        finishButton = hudTextView(20f).apply {
            text = "종료하기"
            gravity = Gravity.CENTER
            background = roundedHudBackground(Color.argb(246, 3, 5, 8), dp(20).toFloat())
            setOnClickListener { finishWithoutCompletion() }
        }
        musicButton = hudTextView(30f).apply {
            text = "♪"
            gravity = Gravity.CENTER
            background = roundedHudBackground(Color.argb(246, 3, 5, 8), dp(24).toFloat())
            setOnClickListener { openMusic() }
        }
        countView = hudTextView(20f).apply {
            text = buildCountText(0)
            gravity = Gravity.CENTER
            background = roundedHudBackground(Color.argb(236, 3, 5, 8), dp(20).toFloat())
        }
        feedbackView = hudTextView(15f).apply {
            text = "자세를 확인하고 있습니다"
            gravity = Gravity.CENTER
        }
        rankingCard = buildRankingCard()
        timerView = hudTextView(57f).apply {
            text = "00:00 / ${formatClock(targetDurationSeconds)}"
            gravity = Gravity.CENTER
            includeFontPadding = false
        }
        progressView = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = targetDurationSeconds
            progress = 0
            progressDrawable = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.rgb(135, 235, 26), Color.rgb(182, 220, 26))
            ).apply { cornerRadius = dp(12).toFloat() }
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.argb(120, 180, 185, 190))
        }
        metaView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = roundedHudBackground(Color.argb(238, 3, 5, 8), dp(24).toFloat())
            addView(timerView, LinearLayout.LayoutParams(-1, -2))
            addView(progressView, LinearLayout.LayoutParams(-1, dp(12)).apply {
                topMargin = dp(18)
                leftMargin = dp(22)
                rightMargin = dp(22)
            })
        }

        root.addView(previewView, FrameLayout.LayoutParams(-1, -1))
        root.addView(overlayView, FrameLayout.LayoutParams(-1, -1))
        root.addView(finishButton)
        root.addView(musicButton)
        root.addView(countView)
        root.addView(feedbackView)
        root.addView(rankingCard)
        root.addView(metaView)
        setContentView(root)
        var lastRootWidth = 0
        var lastRootHeight = 0
        root.addOnLayoutChangeListener { view, left, top, right, bottom, _, _, _, _ ->
            val width = right - left
            val height = bottom - top
            if (width > 0 && height > 0 && (width != lastRootWidth || height != lastRootHeight)) {
                lastRootWidth = width
                lastRootHeight = height
                applyHudLayout(view as FrameLayout)
            }
        }
        root.post { applyHudLayout(root) }
    }

    private fun applyHudLayout(root: FrameLayout) {
        val landscape = root.width > root.height
        val refWidth = if (landscape) REF_HEIGHT else REF_WIDTH
        val refHeight = if (landscape) REF_WIDTH else REF_HEIGHT
        val sx = root.width / refWidth
        val sy = root.height / refHeight
        val scale = minOf(sx, sy)

        fun place(view: View, width: Float, height: Float, left: Float? = null, top: Float? = null, right: Float? = null, bottom: Float? = null) {
            view.layoutParams = FrameLayout.LayoutParams(px(width, sx), px(height, sy)).apply {
                gravity = ((if (left == null && right != null) Gravity.END else Gravity.START) or
                    (if (top == null && bottom != null) Gravity.BOTTOM else Gravity.TOP))
                left?.let { leftMargin = px(it, sx) }
                right?.let { rightMargin = px(it, sx) }
                top?.let { topMargin = px(it, sy) }
                bottom?.let { bottomMargin = px(it, sy) }
            }
        }

        finishButton.setTextPx(21f, scale)
        musicButton.setTextPx(42f, scale)
        countView.setTextPx(28f, scale)
        timerView.setTextPx(if (landscape) 70f else 88f, scale)
        rankingCard.findViewWithTag<TextView>("rankingTitle")?.setTextPx(26f, scale)
        updateRankingCardLayout(sx, sy, scale)
        if (landscape) {
            place(finishButton, 176f, 66f, left = 30f, top = 30f)
            place(countView, 220f, 146f, right = 118f, top = 34f)
            place(feedbackView, 880f, 82f, left = 482f, top = 58f)
            place(rankingCard, 292f, 360f, right = 118f, top = 204f)
            place(musicButton, 74f, 74f, left = 30f, bottom = 34f)
            place(metaView, 560f, 116f, left = 642f, bottom = 18f)
            metaView.setPadding(px(20f, sx), px(12f, sy), px(20f, sx), px(12f, sy))
        } else {
            place(finishButton, 190f, 84f, left = 30f, top = 96f)
            place(countView, 240f, 234f, right = 26f, top = 192f)
            place(feedbackView, 300f, 62f, left = 276f, top = 54f)
            place(rankingCard, 312f, 454f, right = 36f, top = 916f)
            place(musicButton, 88f, 88f, left = 38f, bottom = 470f)
            place(metaView, 780f, 304f, left = 36f, bottom = 138f)
            metaView.setPadding(px(28f, sx), px(24f, sy), px(28f, sx), px(24f, sy))
        }
    }

    private fun buildRankingCard(): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            background = roundedHudBackground(Color.argb(235, 3, 5, 8), dp(18).toFloat())
            addView(hudTextView(24f).apply {
                tag = "rankingTitle"
                text = "RANKING"
                gravity = Gravity.CENTER
                includeFontPadding = false
            }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
            repeat(6) {
                val row = buildRankRow("", false)
                rankRowViews.add(row)
                addView(row, LinearLayout.LayoutParams(-1, dp(43)).apply {
                    if (it > 0) topMargin = dp(4)
                })
            }
            updateRankingRows(0)
        }

    private fun buildRankRow(textValue: String, current: Boolean): TextView =
        hudTextView(20f).apply {
            text = textValue
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), 0, dp(10), 0)
            includeFontPadding = false
            applyRankRowStyle(current)
        }

    private fun TextView.applyRankRowStyle(current: Boolean) {
        if (current) {
            setTextColor(Color.rgb(2, 18, 16))
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.rgb(139, 242, 24), Color.rgb(25, 216, 212))
            ).apply { cornerRadius = dp(8).toFloat() }
        } else {
            setTextColor(Color.WHITE)
            background = null
        }
    }

    private fun updateRankingCardLayout(sx: Float, sy: Float, scale: Float) {
        rankingCard.setPadding(px(18f, sx), px(18f, sy), px(18f, sx), px(18f, sy))
        rankRowViews.forEachIndexed { index, row ->
            row.setTextPx(20f, scale)
            row.setPadding(px(10f, sx), 0, px(10f, sx), 0)
            (row.layoutParams as? LinearLayout.LayoutParams)?.apply {
                height = px(43f, sy)
                topMargin = if (index > 0) px(4f, sy) else 0
            }
        }
    }

    private fun updateRankingRows(elapsedSeconds: Int) {
        val currentValue = currentMetricValue()
        val rows = ghostCounts(elapsedSeconds)
            .map { RankEntry(it.first, it.second, false) }
            .plus(RankEntry("나", currentValue, true))
            .sortedWith(compareByDescending<RankEntry> { it.count }.thenBy { if (it.current) 1 else 0 })

        rows.forEachIndexed { index, row ->
            rankRowViews.getOrNull(index)?.apply {
                text = "${index + 1}   ${row.name}        ${row.count}${metricUnit()}"
                applyRankRowStyle(row.current)
            }
        }
    }

    private fun ghostCounts(elapsedSeconds: Int): List<Pair<String, Int>> {
        val progress = (elapsedSeconds.toFloat() / targetDurationSeconds.toFloat()).coerceIn(0f, 1f)
        val eased = progress * progress * (3f - 2f * progress)
        val durationScale = targetDurationSeconds.coerceAtLeast(1).toDouble() / BASE_DURATION_SECONDS
        return ghostProfiles.mapIndexed { index, profile ->
            val warmupDelay = index * 0.015f
            val adjusted = ((eased - warmupDelay) / (1f - warmupDelay)).coerceIn(0f, 1f)
            profile.first to floor(baseAverageValue * profile.second * durationScale * adjusted).toInt().coerceAtLeast(0)
        }
    }

    private fun startPoseCamera() {
        createLandmarker(ModelTier.FULL)
        cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val targetRotation = previewView.display?.rotation ?: Surface.ROTATION_0
            val preview = Preview.Builder()
                .apply {
                    setTargetRotation(targetRotation)
                    cameraAspectRatio?.let { setTargetAspectRatio(it) }
                }
                .build()
                .also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            val analysis = ImageAnalysis.Builder()
                .apply {
                    setTargetRotation(targetRotation)
                    cameraAspectRatio?.let { setTargetAspectRatio(it) }
                }
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()
                .also { it.setAnalyzer(analyzerExecutor, ::analyzeFrame) }

            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, preview, analysis)
        }, ContextCompat.getMainExecutor(this))
    }

    private fun createLandmarker(tier: ModelTier) {
        poseLandmarker?.close()
        modelTier = tier
        val options = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath(tier.assetName).build())
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setNumPoses(1)
            .setMinPoseDetectionConfidence(0.55f)
            .setMinPosePresenceConfidence(0.55f)
            .setMinTrackingConfidence(0.55f)
            .setResultListener { result, _ ->
                runCatching {
                    val now = SystemClock.elapsedRealtime()
                    val points = result.landmarks().firstOrNull()?.mapIndexed { index, landmark ->
                        index to PosePoint(landmark.x(), landmark.y(), landmark.visibility().orElse(1f))
                    }?.toMap().orEmpty()
                    if (points.isEmpty()) return@setResultListener
                    if (requireStableFullBodyBeforeStart && !readyForStartCountdown) {
                        val frame = buildReadinessFrame(points, now).copy(modelTier = modelTier.label, fps = averageFps())
                        runOnUiThread { updateReadinessHud(frame) }
                        return@setResultListener
                    }
                    if (startCountdownSeconds > 0 && !workoutStarted && shouldHoldForStartCountdown(now)) return@setResultListener
                    val evaluated = evaluator.update(points, now) { reps += 1 }
                    val frame = evaluated.copy(modelTier = modelTier.label, fps = averageFps())
                    runOnUiThread { updateHud(frame) }
                }.onFailure { error ->
                    runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 결과를 처리하지 못했습니다."}" }
                }
            }
            .setErrorListener { error -> runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 분석을 시작하지 못했습니다."}" } }
            .build()
        poseLandmarker = PoseLandmarker.createFromOptions(this, options)
    }

    private fun analyzeFrame(imageProxy: ImageProxy) {
        if (switchingModel.get()) {
            imageProxy.close()
            return
        }
        val now = SystemClock.elapsedRealtime()
        collectFps(now)
        val rotationDegrees = imageProxy.imageInfo.rotationDegrees
        val bitmap = runCatching { imageProxy.toExerciseBitmap() }.getOrNull()
        imageProxy.close()
        if (maybeSwitchToLite()) return
        val landmarker = poseLandmarker ?: return
        if (bitmap == null) return
        runCatching {
            val rotated = rotateExerciseBitmap(bitmap, rotationDegrees)
            landmarker.detectAsync(BitmapImageBuilder(rotated).build(), now)
        }.onFailure { error ->
            runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 분석 프레임을 처리하지 못했습니다."}" }
        }
    }

    private fun updateHud(frame: SquatPoseFrame) {
        accumulateQuality(frame.feedback.level)
        overlayView.render(frame)
        feedbackView.text = "${frame.feedback.label} · ${frame.feedback.detail}"
        feedbackView.setTextColor(
            when (frame.feedback.level) {
                PoseFeedbackLevel.GOOD -> Color.rgb(136, 255, 150)
                PoseFeedbackLevel.WARNING -> Color.rgb(255, 222, 95)
                PoseFeedbackLevel.BAD -> Color.rgb(255, 100, 100)
            }
        )
        countView.text = buildCountText(currentMetricValue())
        val elapsedSeconds = ((SystemClock.elapsedRealtime() - startedAt) / 1000L).toInt()
        val displayElapsedSeconds = elapsedSeconds.coerceIn(0, targetDurationSeconds)
        timerView.text = "${formatClock(displayElapsedSeconds)} / ${formatClock(targetDurationSeconds)}"
        progressView.progress = displayElapsedSeconds
        updateRankingRows(displayElapsedSeconds)
        if (elapsedSeconds >= targetDurationSeconds) {
            finishAfterDuration()
            return
        }
        speakSummaryIfNeeded(frame, displayElapsedSeconds, currentRank())
    }

    private fun updateReadinessHud(frame: SquatPoseFrame) {
        overlayView.render(frame)
        feedbackView.text = "${frame.feedback.label} · ${frame.feedback.detail}"
        feedbackView.setTextColor(
            when (frame.feedback.level) {
                PoseFeedbackLevel.GOOD -> Color.rgb(136, 255, 150)
                PoseFeedbackLevel.WARNING -> Color.rgb(255, 222, 95)
                PoseFeedbackLevel.BAD -> Color.rgb(255, 100, 100)
            }
        )
        countView.text = buildCountText(0)
        timerView.text = "00:00 / ${formatClock(targetDurationSeconds)}"
        progressView.progress = 0
        speakReadinessGuideIfNeeded(frame.feedback)
    }

    private fun shouldHoldForStartCountdown(now: Long): Boolean {
        if (countdownStartedAt == 0L) countdownStartedAt = now
        val durationMs = startCountdownSeconds * 1000L
        val elapsedMs = now - countdownStartedAt
        if (elapsedMs >= durationMs) {
            workoutStarted = true
            startedAt = now
            lastNarrationAt = now
            lastQualityAt = now
            ttsEngine.stop()
            return false
        }

        val remaining = ((durationMs - elapsedMs + 999L) / 1000L).toInt().coerceIn(1, startCountdownSeconds)
        runOnUiThread { updateCountdownHud(remaining) }
        return true
    }

    private fun updateCountdownHud(remainingSeconds: Int) {
        feedbackView.text = "준비 · ${remainingSeconds}초 후 시작합니다."
        feedbackView.setTextColor(Color.rgb(255, 222, 95))
        countView.text = buildCountdownText(remainingSeconds)
        timerView.text = "00:00 / ${formatClock(targetDurationSeconds)}"
        progressView.progress = 0
    }

    private fun buildReadinessFrame(landmarks: Map<Int, PosePoint>, now: Long): SquatPoseFrame {
        val feedback = fullBodyReadinessFeedback(landmarks, now)
        return SquatPoseFrame(landmarks = landmarks, feedback = feedback, modelTier = "", fps = 0f)
    }

    private fun fullBodyReadinessFeedback(landmarks: Map<Int, PosePoint>, now: Long): SquatPoseFeedback {
        val visible = readinessLandmarks.all { index -> (landmarks[index]?.visibility ?: 0f) >= START_VISIBILITY }
        if (!visible) {
            stablePoseStartedAt = 0L
            return SquatPoseFeedback(PoseFeedbackLevel.WARNING, "준비", readinessMissingDetail)
        }

        val points = readinessLandmarks.mapNotNull { landmarks[it] }
        val minX = points.minOf { it.x }
        val maxX = points.maxOf { it.x }
        val minY = points.minOf { it.y }
        val maxY = points.maxOf { it.y }
        val detail = readinessDistanceDetail(minX, maxX, minY, maxY)

        if (detail != null) {
            stablePoseStartedAt = 0L
            return SquatPoseFeedback(PoseFeedbackLevel.WARNING, "준비", detail)
        }

        if (stablePoseStartedAt == 0L) stablePoseStartedAt = now
        val stableEnough = now - stablePoseStartedAt >= STABLE_POSE_START_MS
        if (stableEnough) {
            readyForStartCountdown = true
            countdownStartedAt = 0L
            if (startCountdownSeconds <= 0) {
                workoutStarted = true
                startedAt = now
                lastNarrationAt = now
                lastQualityAt = now
            }
            return SquatPoseFeedback(PoseFeedbackLevel.GOOD, "좋음", readinessAcceptedDetail)
        }
        return SquatPoseFeedback(PoseFeedbackLevel.GOOD, "준비", readinessHoldingDetail)
    }

    protected open fun readinessDistanceDetail(minX: Float, maxX: Float, minY: Float, maxY: Float): String? {
        val bodyWidth = maxX - minX
        val bodyHeight = maxY - minY
        val centerX = (minX + maxX) / 2f
        val nearEdge = minX < 0.07f || maxX > 0.93f || minY < 0.04f || maxY > 0.96f
        return when {
            nearEdge || bodyHeight > 0.88f || bodyWidth > 0.82f -> "카메라에서 너무 가깝습니다. 조금 뒤로 이동해주세요."
            bodyHeight < 0.48f -> "조금 앞으로 와주세요."
            centerX < 0.35f || centerX > 0.65f -> "중앙으로 이동해주세요."
            else -> null
        }
    }

    private fun speakReadinessGuideIfNeeded(feedback: SquatPoseFeedback) {
        val now = SystemClock.elapsedRealtime()
        val text = feedback.detail
        if (text.isBlank()) return
        if (text == lastReadinessTtsText && now - lastReadinessTtsAt < READINESS_TTS_INTERVAL_MS) return
        if (text != lastReadinessTtsText && now - lastReadinessTtsAt < 1200L) return
        if (ttsEngine.isSpeaking() && text == lastReadinessTtsText) return
        val profile = GhostTtsCatalog.profileFor("encouragement")
        lastReadinessTtsAt = now
        lastReadinessTtsText = text
        ttsEngine.speak(
            NativeTtsCue(
                category = "pose_readiness",
                text = text,
                priority = 48,
                speechRate = profile.speechRate,
                pitch = profile.pitch,
                immediate = false,
                templateId = "pose_readiness_$text"
            )
        )
    }

    private fun accumulateQuality(level: PoseFeedbackLevel) {
        if (evaluator.metric != PoseExerciseMetric.HOLD) return
        val now = SystemClock.elapsedRealtime()
        val delta = (now - lastQualityAt).coerceIn(0L, 1000L)
        lastQualityAt = now
        when (level) {
            PoseFeedbackLevel.GOOD -> goodMs += delta
            PoseFeedbackLevel.WARNING -> warningMs += delta
            PoseFeedbackLevel.BAD -> badMs += delta
        }
    }

    private fun finishAfterDuration() {
        if (durationFinished) return
        durationFinished = true
        completeWorkout()
    }

    private fun completeWorkout() {
        val completedCue = buildCompletionNarrationCue(currentRank(), SystemClock.elapsedRealtime())
        if (completedCue == null) {
            broadcastFinished(completed = true)
            finish()
            return
        }
        ttsEngine.speak(completedCue)
        mainHandler.postDelayed({
            broadcastFinished(completed = true)
            finish()
        }, COMPLETION_NARRATION_DELAY_MS)
    }

    private fun finishWithoutCompletion() {
        cancelWorkout()
        if (!durationFinished) broadcastFinished(completed = false)
        finish()
    }

    protected open fun cancelWorkout() = Unit

    private fun broadcastFinished(completed: Boolean) {
        val goodSeconds = (goodMs / 1000L).toInt().coerceAtMost(targetDurationSeconds)
        val warningSeconds = (warningMs / 1000L).toInt().coerceAtMost(targetDurationSeconds)
        val badSeconds = (badMs / 1000L).toInt().coerceAtMost(targetDurationSeconds)
        val qualityScore = ((goodSeconds + warningSeconds * 0.5f) / targetDurationSeconds.coerceAtLeast(1) * 100f)
            .roundToInt()
            .coerceIn(0, 100)
        sendBroadcast(Intent(completionAction).apply {
            setPackage(packageName)
            putExtra(EXTRA_COMPLETED, completed)
            putExtra(EXTRA_DURATION_SECONDS, targetDurationSeconds)
            putExtra(EXTRA_REPS, reps)
            putExtra(EXTRA_GOOD_SECONDS, goodSeconds)
            putExtra(EXTRA_WARNING_SECONDS, warningSeconds)
            putExtra(EXTRA_BAD_SECONDS, badSeconds)
            putExtra(EXTRA_QUALITY_SCORE, qualityScore)
        })
    }

    private fun speakSummaryIfNeeded(frame: SquatPoseFrame, elapsedSeconds: Int, rank: Int) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastNarrationAt < NARRATION_INTERVAL_MS) return
        if (ttsEngine.isSpeaking()) return
        lastNarrationAt = now
        val cue = buildNarrationCue(frame, elapsedSeconds, rank, ghostCounts(elapsedSeconds)) ?: return
        rememberNarration(cue.text)
        ttsEngine.speak(cue)
    }

    protected open fun buildCompletionNarrationCue(rank: Int, nowMillis: Long): NativeTtsCue? = null

    protected open fun buildNarrationCue(
        frame: SquatPoseFrame,
        elapsedSeconds: Int,
        rank: Int,
        ghosts: List<Pair<String, Int>>
    ): NativeTtsCue? {
        val postureText = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> "${exerciseName} 좋아요. ${frame.feedback.detail}"
            PoseFeedbackLevel.WARNING -> "주의. ${frame.feedback.detail}"
            PoseFeedbackLevel.BAD -> "교정 필요. ${frame.feedback.detail}"
        }
        val front = ghosts.filter { it.second > currentMetricValue() }.minByOrNull { it.second - currentMetricValue() }
        val ghostText = front?.let { "${it.first}까지 ${it.second - currentMetricValue()}${metricUnit()} 남았습니다." }
            ?: "현재 ${rank}위입니다. 흐름을 유지하세요."
        val candidates = listOf(
            "$postureText 현재 ${currentMetricValue()}${metricUnit()}, $ghostText",
            "$ghostText $postureText",
            "현재 ${currentMetricValue()}${metricUnit()}입니다. $postureText"
        )
        val text = candidates.filterNot { recentNarrations.contains(it) }.ifEmpty { candidates }[(currentMetricValue() + elapsedSeconds + rank).mod(candidates.size)]
        val profile = GhostTtsCatalog.profileFor("encouragement")
        return NativeTtsCue("exercise_pose", text, 36, profile.speechRate, profile.pitch, false)
    }

    protected fun rememberNarration(text: String) {
        recentNarrations.addLast(text)
        while (recentNarrations.size > 6) recentNarrations.removeFirst()
    }

    protected fun currentMetricValue(): Int =
        if (evaluator.metric == PoseExerciseMetric.HOLD) (goodMs / 1000L).toInt() else reps

    private fun metricUnit(): String =
        if (evaluator.metric == PoseExerciseMetric.HOLD) "초" else "회"

    private fun currentRank(): Int =
        rankRowViews.indexOfFirst { it.text.contains("나") }.let { if (it >= 0) it + 1 else 6 }

    private fun buildCountText(count: Int): SpannableString {
        val countText = count.toString()
        val text = "${exerciseName.uppercase()}\n${countText}    ${metricUnit()}"
        return SpannableString(text).apply {
            val start = text.indexOf(countText)
            setSpan(RelativeSizeSpan(2f), start, start + countText.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }

    private fun openMusic() {
        val searchUri = Uri.parse("https://music.youtube.com/search?q=${Uri.encode(musicQuery)}")
        val opened = listOf(
            Intent(Intent.ACTION_VIEW, searchUri).apply {
                setPackage("com.google.android.apps.youtube.music")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
            Intent(Intent.ACTION_VIEW, searchUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        ).any { runCatching { startActivity(it); true }.getOrDefault(false) }
        if (!opened) feedbackView.text = "주의\n음악 검색 화면을 열지 못했습니다."
    }

    private fun collectFps(now: Long) {
        val previous = lastFrameAt
        lastFrameAt = now
        if (previous == 0L) return
        fpsSamples.addLast(1000f / (now - previous).coerceAtLeast(1L))
        while (fpsSamples.size > 90) fpsSamples.removeFirst()
    }

    private fun maybeSwitchToLite(): Boolean {
        if (modelTier != ModelTier.FULL || fpsSamples.size < 90) return false
        if (averageFps() >= 24f) return false
        if (!switchingModel.compareAndSet(false, true)) return true
        runCatching {
            createLandmarker(ModelTier.LITE)
            fpsSamples.clear()
            lastFrameAt = 0L
        }.onFailure { error ->
            runOnUiThread { feedbackView.text = "주의\n${error.message ?: "Lite 모델로 전환하지 못했습니다."}" }
        }
        switchingModel.set(false)
        return true
    }

    private fun averageFps(): Float =
        if (fpsSamples.isEmpty()) 0f else fpsSamples.sum() / fpsSamples.size

    private fun hudTextView(sizeSp: Float) = TextView(this).apply {
        setTextColor(Color.WHITE)
        textSize = sizeSp
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        includeFontPadding = true
    }

    private fun TextView.setTextPx(referencePx: Float, scale: Float) {
        setTextSize(TypedValue.COMPLEX_UNIT_PX, px(referencePx, scale).toFloat())
    }

    private fun roundedHudBackground(color: Int, radius: Float = 24f) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius
            setStroke(1, Color.argb(70, 255, 255, 255))
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private fun px(value: Float, scale: Float): Int = (value * scale).roundToInt()

    private fun formatClock(totalSeconds: Int): String {
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}"
    }

    private data class RankEntry(val name: String, val count: Int, val current: Boolean)

    private enum class ModelTier(val assetName: String, val label: String) {
        FULL("pose_landmarker_full.task", "Full"),
        LITE("pose_landmarker_lite.task", "Lite")
    }

    companion object {
        const val EXTRA_DURATION_SECONDS = "durationSeconds"
        const val EXTRA_BASE_AVERAGE_REPS = "baseAverageReps"
        const val EXTRA_BASE_AVERAGE_GOOD_SECONDS = "baseAverageGoodSeconds"
        const val EXTRA_REPS = "reps"
        const val EXTRA_COMPLETED = "completed"
        const val EXTRA_GOOD_SECONDS = "goodSeconds"
        const val EXTRA_WARNING_SECONDS = "warningSeconds"
        const val EXTRA_BAD_SECONDS = "badSeconds"
        const val EXTRA_QUALITY_SCORE = "qualityScore"
        private const val REQUEST_CAMERA = 6201
        private const val NARRATION_INTERVAL_MS = 15_000L
        private const val COMPLETION_NARRATION_DELAY_MS = 2_500L
        private const val STABLE_POSE_START_MS = 1_500L
        private const val READINESS_TTS_INTERVAL_MS = 3_500L
        private const val START_VISIBILITY = 0.50f
        private const val REF_WIDTH = 852f
        private const val REF_HEIGHT = 1844f
        private const val BASE_DURATION_SECONDS = 120.0
        private val ghostProfiles = listOf(
            "G1 Starter" to 0.80,
            "G2 Rookie" to 0.92,
            "G3 Rival" to 1.00,
            "G4 Elite" to 1.12,
            "G5 Legend" to 1.24
        )
        private val fullBodyStartLandmarks = listOf(0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
    }

    private fun buildCountdownText(seconds: Int): SpannableString {
        val countText = seconds.toString()
        val text = "COUNTDOWN  ${countText}"
        return SpannableString(text).apply {
            val start = text.indexOf(countText)
            setSpan(RelativeSizeSpan(1.7f), start, start + countText.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }
}

private fun ImageProxy.toExerciseBitmap(): Bitmap? {
    val image = image ?: return null
    if (format != ImageFormat.YUV_420_888) return null
    val yBuffer = image.planes[0].buffer
    val uBuffer = image.planes[1].buffer
    val vBuffer = image.planes[2].buffer
    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()
    val nv21 = ByteArray(ySize + uSize + vSize)
    yBuffer.get(nv21, 0, ySize)
    vBuffer.get(nv21, ySize, vSize)
    uBuffer.get(nv21, ySize + vSize, uSize)
    val yuvImage = YuvImage(nv21, ImageFormat.NV21, width, height, null)
    val output = ByteArrayOutputStream()
    yuvImage.compressToJpeg(android.graphics.Rect(0, 0, width, height), 78, output)
    return BitmapFactory.decodeByteArray(output.toByteArray(), 0, output.size())
}

private fun rotateExerciseBitmap(bitmap: Bitmap, rotationDegrees: Int): Bitmap {
    if (rotationDegrees == 0) return bitmap
    val matrix = android.graphics.Matrix().apply { postRotate(rotationDegrees.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}

