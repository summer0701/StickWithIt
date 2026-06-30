package com.stickwithit.endure

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Typeface
import android.graphics.YuvImage
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
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
import kotlin.math.roundToInt

class SquatPoseActivity : ComponentActivity() {
    private lateinit var previewView: PreviewView
    private lateinit var overlayView: SquatSkeletonOverlayView
    private lateinit var feedbackView: TextView
    private lateinit var countView: TextView
    private lateinit var metaView: LinearLayout
    private lateinit var timerView: TextView
    private lateinit var progressView: ProgressBar
    private lateinit var currentRankCountView: TextView
    private lateinit var cameraProviderFuture: ListenableFuture<ProcessCameraProvider>
    private val analyzerExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val evaluator = SquatPoseEvaluator()
    private val ttsEngine by lazy { NativeTtsEngine(this) }
    private var poseLandmarker: PoseLandmarker? = null
    private var modelTier: ModelTier = ModelTier.FULL
    private var startedAt = 0L
    private var reps = 0
    private var lastFrameAt = 0L
    private var lastNarrationAt = 0L
    private val fpsSamples = ArrayDeque<Float>()
    private val switchingModel = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
            feedbackView.text = "주의\n카메라 권한을 허용해 주세요"
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
        val finishButton = hudTextView(20f).apply {
            text = "▯  종료하기"
            setTextColor(Color.WHITE)
            setPadding(dp(17), 0, dp(18), 0)
            background = roundedHudBackground(Color.argb(235, 3, 5, 8), dp(16).toFloat())
            setOnClickListener { finish() }
        }

        countView = hudTextView(20f).apply {
            text = "SQUATS\n0    회"
            gravity = Gravity.CENTER
            setPadding(dp(18), dp(14), dp(18), dp(14))
            background = roundedHudBackground(Color.argb(232, 3, 5, 8), dp(20).toFloat())
        }
        feedbackView = hudTextView(15f).apply {
            text = "좋음 · 자세를 확인하는 중"
            setTextColor(Color.argb(210, 255, 255, 255))
            gravity = Gravity.CENTER
            setPadding(dp(14), dp(8), dp(14), dp(8))
            background = roundedHudBackground(Color.argb(120, 3, 5, 8), dp(16).toFloat())
            visibility = android.view.View.GONE
        }
        val rankingCard = buildRankingCard()

        timerView = hudTextView(57f).apply {
            text = "00:00 / 01:00"
            gravity = Gravity.CENTER
            includeFontPadding = false
        }
        progressView = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 60
            progress = 0
            progressDrawable = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Color.rgb(135, 235, 26), Color.rgb(182, 220, 26))).apply {
                cornerRadius = dp(12).toFloat()
            }
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.argb(120, 180, 185, 190))
        }
        metaView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(28), dp(22), dp(30))
            background = roundedHudBackground(Color.argb(236, 3, 5, 8), dp(24).toFloat())
            addView(timerView, LinearLayout.LayoutParams(-1, -2))
            addView(progressView, LinearLayout.LayoutParams(-1, dp(12)).apply {
                topMargin = dp(18)
                leftMargin = dp(22)
                rightMargin = dp(22)
            })
        }

        root.addView(previewView, FrameLayout.LayoutParams(-1, -1))
        root.addView(overlayView, FrameLayout.LayoutParams(-1, -1))
        root.addView(finishButton, FrameLayout.LayoutParams(dp(190), dp(84), Gravity.START or Gravity.TOP).apply {
            topMargin = dp(96)
            leftMargin = dp(30)
        })
        root.addView(countView, FrameLayout.LayoutParams(dp(240), dp(234), Gravity.END or Gravity.TOP).apply {
            topMargin = dp(192)
            rightMargin = dp(26)
        })
        root.addView(feedbackView, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER_HORIZONTAL or Gravity.TOP).apply {
            topMargin = dp(54)
        })
        root.addView(rankingCard, FrameLayout.LayoutParams(dp(312), dp(424), Gravity.END or Gravity.BOTTOM).apply {
            rightMargin = dp(36)
            bottomMargin = dp(508)
        })
        root.addView(metaView, FrameLayout.LayoutParams(-1, dp(304), Gravity.BOTTOM).apply {
            leftMargin = dp(36)
            rightMargin = dp(36)
            bottomMargin = dp(138)
        })
        setContentView(root)
    }

    private fun buildRankingCard(): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(22))
            background = roundedHudBackground(Color.argb(232, 3, 5, 8), dp(18).toFloat())
            addView(hudTextView(26f).apply {
                text = "RANKING"
                gravity = Gravity.CENTER
                includeFontPadding = false
            }, LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(18)
            })
            listOf(
                Triple("1", "고스트 1", "124회"),
                Triple("2", "고스트 2", "98회"),
                Triple("3", "고스트 3", "76회"),
                Triple("4", "고스트 4", "54회"),
                Triple("5", "고스트 5", "32회")
            ).forEachIndexed { index, row ->
                addView(buildRankRow(row.first, row.second, row.third, index == 0), LinearLayout.LayoutParams(-1, dp(44)))
            }
            val currentRow = buildRankRow("6", "나", "0회", false).apply {
                background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Color.rgb(139, 242, 24), Color.rgb(25, 216, 212))).apply {
                    cornerRadius = dp(8).toFloat()
                }
                setTextColor(Color.rgb(2, 18, 16))
            }
            currentRankCountView = currentRow
            addView(currentRow, LinearLayout.LayoutParams(-1, dp(52)).apply {
                topMargin = dp(12)
            })
        }

    private fun buildRankRow(rank: String, name: String, count: String, gold: Boolean): TextView =
        hudTextView(20f).apply {
            text = "$rank   $name        $count"
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), 0, dp(10), 0)
            setTextColor(if (gold) Color.rgb(255, 216, 40) else Color.WHITE)
            includeFontPadding = false
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
            cameraProvider.bindToLifecycle(
                this,
                CameraSelector.DEFAULT_FRONT_CAMERA,
                preview,
                analysis
            )
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
                    runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 결과를 처리하지 못했습니다"}" }
                }
            }
            .setErrorListener { error -> runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 분석을 시작하지 못했습니다"}" } }
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
            runOnUiThread { feedbackView.text = "주의\n${error.message ?: "포즈 분석 프레임을 처리하지 못했습니다"}" }
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
        countView.text = "SQUATS\n${reps}    회"
        val elapsedSeconds = ((SystemClock.elapsedRealtime() - startedAt) / 1000L).toInt()
        timerView.text = "${formatClock(elapsedSeconds)} / 01:00"
        progressView.progress = elapsedSeconds.coerceIn(0, 60)
        val rank = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> 2
            PoseFeedbackLevel.WARNING -> 3
            PoseFeedbackLevel.BAD -> 4
        }
        val ghostStatus = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> "고스트보다 안정적"
            PoseFeedbackLevel.WARNING -> "고스트와 접전 중"
            PoseFeedbackLevel.BAD -> "고스트가 앞서고 있어요"
        }
        currentRankCountView.text = "6   나        ${reps}회"
        speakPoseSummaryIfNeeded(frame, rank)
    }

    private fun speakPoseSummaryIfNeeded(frame: SquatPoseFrame, rank: Int) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastNarrationAt < NARRATION_INTERVAL_MS) return
        if (ttsEngine.isSpeaking()) return

        lastNarrationAt = now
        val postureText = when (frame.feedback.level) {
            PoseFeedbackLevel.GOOD -> "자세 좋음. ${frame.feedback.detail}"
            PoseFeedbackLevel.WARNING -> "주의. ${frame.feedback.detail}"
            PoseFeedbackLevel.BAD -> "교정 필요. ${frame.feedback.detail}"
        }
        val profile = GhostTtsCatalog.profileFor("encouragement")
        ttsEngine.speak(
            NativeTtsCue(
                category = "squat_pose",
                text = "$postureText. 현재 ${reps}회, 순위는 ${rank}위입니다.",
                priority = 36,
                speechRate = profile.speechRate,
                pitch = profile.pitch,
                immediate = false
            )
        )
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
            runOnUiThread { feedbackView.text = "주의\n${error.message ?: "Lite 모델로 전환하지 못했습니다"}" }
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

    private fun roundedHudBackground(color: Int, radius: Float = 24f) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius
            setStroke(1, Color.argb(70, 255, 255, 255))
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private enum class ModelTier(val assetName: String, val label: String) {
        FULL("pose_landmarker_full.task", "Full"),
        LITE("pose_landmarker_lite.task", "Lite")
    }

    companion object {
        private const val REQUEST_CAMERA = 5201
        private const val NARRATION_INTERVAL_MS = 30_000L
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

private fun formatClock(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d".format(minutes, seconds)
}
