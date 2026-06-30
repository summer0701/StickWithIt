package com.stickwithit.endure

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.YuvImage
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.util.TypedValue
import android.view.Gravity
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

class SquatPoseActivity : ComponentActivity() {
    private lateinit var previewView: PreviewView
    private lateinit var overlayView: SquatSkeletonOverlayView
    private lateinit var feedbackView: TextView
    private lateinit var finishButton: TextView
    private lateinit var countView: TextView
    private lateinit var rankingCard: LinearLayout
    private lateinit var metaView: LinearLayout
    private lateinit var timerView: TextView
    private lateinit var progressView: ProgressBar
    private lateinit var cameraProviderFuture: ListenableFuture<ProcessCameraProvider>
    private val rankRowViews = mutableListOf<TextView>()
    private val analyzerExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val evaluator = SquatPoseEvaluator()
    private val ttsEngine by lazy { NativeTtsEngine(this) }
    private var poseLandmarker: PoseLandmarker? = null
    private var modelTier: ModelTier = ModelTier.FULL
    private var startedAt = 0L
    private var reps = 0
    private var targetDurationSeconds = 60
    private var baseAverageReps = SquatGhostTargets.DEFAULT_BASE_AVERAGE_REPS
    private var durationFinished = false
    private var lastFrameAt = 0L
    private var lastNarrationAt = 0L
    private val recentSquatNarrations = ArrayDeque<String>()
    private val fpsSamples = ArrayDeque<Float>()
    private val switchingModel = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        targetDurationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 60).coerceIn(30, 600)
        baseAverageReps = intent.getDoubleExtra(EXTRA_BASE_AVERAGE_REPS, SquatGhostTargets.DEFAULT_BASE_AVERAGE_REPS)
            .takeIf { it.isFinite() && it > 0.0 }
            ?: SquatGhostTargets.DEFAULT_BASE_AVERAGE_REPS
        startedAt = SystemClock.elapsedRealtime()
        lastNarrationAt = startedAt
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

        previewView = PreviewView(this).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        overlayView = SquatSkeletonOverlayView(this)
        finishButton = hudTextView(20f).apply {
            text = "종료하기"
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            compoundDrawablePadding = dp(10)
            setCompoundDrawablesWithIntrinsicBounds(FinishIconDrawable(Color.rgb(255, 78, 86), dp(28)), null, null, null)
            background = roundedHudBackground(Color.argb(246, 3, 5, 8), dp(20).toFloat())
            setOnClickListener { finishWithoutCompletion() }
        }
        countView = hudTextView(20f).apply {
            text = buildCountText(0)
            gravity = Gravity.CENTER
            background = roundedHudBackground(Color.argb(236, 3, 5, 8), dp(20).toFloat())
        }
        feedbackView = hudTextView(15f).apply {
            text = "좋음 · 자세를 확인하는 중"
            gravity = Gravity.CENTER
            visibility = View.GONE
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
        root.addView(countView)
        root.addView(feedbackView)
        root.addView(rankingCard)
        root.addView(metaView)
        setContentView(root)
        root.post { applyReferenceHudLayout(root) }
    }

    private fun applyReferenceHudLayout(root: FrameLayout) {
        val sx = root.width / REF_WIDTH
        val sy = root.height / REF_HEIGHT
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
        finishButton.setPadding(px(18f, sx), 0, px(18f, sx), 0)
        countView.setTextPx(28f, scale)
        rankingCard.findViewWithTag<TextView>("rankingTitle")?.setTextPx(26f, scale)
        timerView.setTextPx(88f, scale)
        updateRankingCardLayout(sx, sy, scale)

        finishButton.background = roundedHudBackground(Color.argb(246, 3, 5, 8), px(22f, scale).toFloat())
        countView.background = roundedHudBackground(Color.argb(238, 3, 5, 8), px(22f, scale).toFloat())
        rankingCard.background = roundedHudBackground(Color.argb(235, 3, 5, 8), px(22f, scale).toFloat())
        metaView.background = roundedHudBackground(Color.argb(238, 3, 5, 8), px(34f, scale).toFloat())

        place(finishButton, 190f, 84f, left = 30f, top = 96f)
        place(countView, 240f, 234f, right = 26f, top = 192f)
        place(feedbackView, 220f, 54f, left = 316f, top = 54f)
        place(rankingCard, 312f, 454f, right = 36f, top = 916f)
        place(metaView, 780f, 304f, left = 36f, bottom = 138f)

        metaView.setPadding(px(28f, sx), px(24f, sy), px(28f, sx), px(24f, sy))
        (progressView.layoutParams as LinearLayout.LayoutParams).apply {
            height = px(12f, sy)
            topMargin = px(22f, sy)
            leftMargin = px(70f, sx)
            rightMargin = px(70f, sx)
        }
        metaView.requestLayout()
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
            tag = "rankRow"
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
        rankingCard.findViewWithTag<TextView>("rankingTitle")?.let { title ->
            (title.layoutParams as? LinearLayout.LayoutParams)?.bottomMargin = px(12f, sy)
        }
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
        val rows = ghostCounts(elapsedSeconds)
            .map { RankEntry(it.first, it.second, false) }
            .plus(RankEntry("나", reps, true))
            .sortedWith(compareByDescending<RankEntry> { it.count }.thenBy { if (it.current) 1 else 0 })

        rows.forEachIndexed { index, row ->
            rankRowViews.getOrNull(index)?.apply {
                text = "${index + 1}   ${row.name}        ${row.count}회"
                applyRankRowStyle(row.current)
            }
        }
    }

    private fun ghostCounts(elapsedSeconds: Int): List<Pair<String, Int>> {
        val progress = (elapsedSeconds.toFloat() / targetDurationSeconds.toFloat()).coerceIn(0f, 1f)
        val eased = progress * progress * (3f - 2f * progress)
        val targets = SquatGhostTargets.forDuration(targetDurationSeconds, baseAverageReps)
        return targets.mapIndexed { index, target ->
            val warmupDelay = index * 0.015f
            val adjusted = ((eased - warmupDelay) / (1f - warmupDelay)).coerceIn(0f, 1f)
            target.first to floor(target.second * adjusted).toInt()
        }
    }

    private fun startPoseCamera() {
        createLandmarker(ModelTier.FULL)
        cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            val analysis = ImageAnalysis.Builder()
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
        val baseOptions = BaseOptions.builder()
            .setModelAssetPath(tier.assetName)
            .build()
        val options = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
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
        val bitmap = runCatching { imageProxy.toBitmapSafely() }.getOrNull()
        imageProxy.close()

        if (maybeSwitchToLite()) return
        val landmarker = poseLandmarker ?: return
        if (bitmap == null) return

        runCatching {
            val rotated = rotateBitmap(bitmap, rotationDegrees)
            landmarker.detectAsync(BitmapImageBuilder(rotated).build(), now)
        }.onFailure { error ->
            runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 분석 프레임을 처리하지 못했습니다."}" }
        }
    }

    private fun updateHud(frame: SquatPoseFrame) {
        overlayView.render(frame)
        feedbackView.text = "${frame.feedback.label} · ${frame.feedback.detail}"
        feedbackView.setTextColor(
            when (frame.feedback.level) {
                PoseFeedbackLevel.GOOD -> Color.rgb(136, 255, 150)
                PoseFeedbackLevel.WARNING -> Color.rgb(255, 222, 95)
                PoseFeedbackLevel.BAD -> Color.rgb(255, 100, 100)
            }
        )
        countView.text = buildCountText(reps)
        val elapsedSeconds = ((SystemClock.elapsedRealtime() - startedAt) / 1000L).toInt()
        val displayElapsedSeconds = elapsedSeconds.coerceIn(0, targetDurationSeconds)
        timerView.text = "${formatClock(displayElapsedSeconds)} / ${formatClock(targetDurationSeconds)}"
        progressView.progress = displayElapsedSeconds
        updateRankingRows(displayElapsedSeconds)
        if (elapsedSeconds >= targetDurationSeconds) {
            finishAfterDuration()
            return
        }
        speakPoseSummaryIfNeeded(frame, displayElapsedSeconds, currentRank())
    }

    private fun finishAfterDuration() {
        if (durationFinished) return
        durationFinished = true
        broadcastSquatFinished(completed = true)
        finish()
    }

    private fun finishWithoutCompletion() {
        if (!durationFinished) broadcastSquatFinished(completed = false)
        finish()
    }

    private fun broadcastSquatFinished(completed: Boolean) {
        sendBroadcast(Intent(ACTION_SQUAT_FINISHED).apply {
            setPackage(packageName)
            putExtra(EXTRA_COMPLETED, completed)
            putExtra(EXTRA_DURATION_SECONDS, targetDurationSeconds)
            putExtra(EXTRA_REPS, reps)
        })
    }

    private fun currentRank(): Int {
        return rankRowViews.indexOfFirst { it.text.contains("나") }.let { if (it >= 0) it + 1 else 6 }
    }

    private fun buildCountText(count: Int): SpannableString {
        val countText = count.toString()
        val text = "SQUATS\n${countText}    회"
        return SpannableString(text).apply {
            val start = text.indexOf(countText)
            setSpan(RelativeSizeSpan(2f), start, start + countText.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }

    private fun speakPoseSummaryIfNeeded(frame: SquatPoseFrame, elapsedSeconds: Int, rank: Int) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastNarrationAt < NARRATION_INTERVAL_MS) return
        if (ttsEngine.isSpeaking()) return

        lastNarrationAt = now
        val postureText = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> "자세 좋음. ${frame.feedback.detail}"
            PoseFeedbackLevel.WARNING -> "주의. ${frame.feedback.detail}"
            PoseFeedbackLevel.BAD -> "교정 필요. ${frame.feedback.detail}"
        }
        val text = SquatCoachNarration.build(
            reps = reps,
            rank = rank,
            postureText = postureText,
            ghosts = ghostCounts(elapsedSeconds),
            recentTexts = recentSquatNarrations,
            variantSeed = reps + elapsedSeconds + rank
        )
        rememberSquatNarration(text)
        val profile = GhostTtsCatalog.profileFor("encouragement")
        ttsEngine.speak(
            NativeTtsCue(
                category = "squat_pose",
                text = text,
                priority = 36,
                speechRate = profile.speechRate,
                pitch = profile.pitch,
                immediate = false
            )
        )
    }

    private fun rememberSquatNarration(text: String) {
        recentSquatNarrations.addLast(text)
        while (recentSquatNarrations.size > 6) recentSquatNarrations.removeFirst()
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

    private data class RankEntry(val name: String, val count: Int, val current: Boolean)

    private enum class ModelTier(val assetName: String, val label: String) {
        FULL("pose_landmarker_full.task", "Full"),
        LITE("pose_landmarker_lite.task", "Lite")
    }

    companion object {
        const val ACTION_SQUAT_FINISHED = "com.stickwithit.endure.SQUAT_FINISHED"
        const val EXTRA_DURATION_SECONDS = "durationSeconds"
        const val EXTRA_BASE_AVERAGE_REPS = "baseAverageReps"
        const val EXTRA_REPS = "reps"
        const val EXTRA_COMPLETED = "completed"
        private const val REQUEST_CAMERA = 5201
        private const val NARRATION_INTERVAL_MS = 15_000L
        private const val REF_WIDTH = 852f
        private const val REF_HEIGHT = 1844f
    }
}

private fun ImageProxy.toBitmapSafely(): Bitmap? {
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

private fun rotateBitmap(bitmap: Bitmap, rotationDegrees: Int): Bitmap {
    if (rotationDegrees == 0) return bitmap
    val matrix = android.graphics.Matrix().apply { postRotate(rotationDegrees.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}

private class FinishIconDrawable(
    private val iconColor: Int,
    private val iconSize: Int
) : Drawable() {
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = iconColor
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = iconColor
        style = Paint.Style.FILL
    }

    override fun draw(canvas: Canvas) {
        val size = bounds.width().coerceAtMost(bounds.height()).toFloat()
        val left = bounds.left + size * 0.18f
        val top = bounds.top + size * 0.12f
        val right = bounds.left + size * 0.78f
        val bottom = bounds.top + size * 0.88f
        strokePaint.strokeWidth = size * 0.09f
        canvas.drawRoundRect(RectF(left, top, right, bottom), size * 0.08f, size * 0.08f, strokePaint)
        canvas.drawCircle(bounds.left + size * 0.55f, bounds.top + size * 0.5f, size * 0.045f, fillPaint)
        canvas.drawLine(bounds.left + size * 0.28f, bounds.top + size * 0.2f, bounds.left + size * 0.28f, bounds.top + size * 0.8f, strokePaint)
    }

    override fun setAlpha(alpha: Int) {
        strokePaint.alpha = alpha
        fillPaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
        strokePaint.colorFilter = colorFilter
        fillPaint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT

    override fun getIntrinsicWidth(): Int = iconSize

    override fun getIntrinsicHeight(): Int = iconSize
}

private fun formatClock(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d".format(minutes, seconds)
}
