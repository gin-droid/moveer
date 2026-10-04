package com.moveerai.depthscanner

import android.Manifest
import android.graphics.PixelFormat
import android.media.Image
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.JSObject
import com.getcapacitor.JSArray
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.tasks.Tasks
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import java.util.concurrent.TimeUnit
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * DepthScannerPlugin (Android)
 *
 * Usa ARCore Depth API per ottenere una mappa di profondità reale (ToF o
 * depth-from-motion) e ML Kit Pose Detection per le giunzioni 2D, che vengono
 * fuse con la depth map per ricostruire giunzioni 3D.
 *
 * NOTA: richiede ARCore 1.32+ e un dispositivo con depth supportato.
 * Va compilato in Android Studio.
 */
@CapacitorPlugin(
    name = "DepthScanner",
    permissions = [Permission(alias = "camera", strings = [Manifest.permission.CAMERA])]
)
class DepthScannerPlugin : Plugin() {

    private var session: Session? = null
    private var poseDetector: PoseDetector? = null
    private var glView: GLSurfaceView? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var cameraTextureId = 0
    @Volatile private var lastSampleMs = 0L
    @Volatile private var recording = false
    private var maxDurationSec = 30.0
    private var startTimeMs = 0L
    private val frames = mutableListOf<JSObject>()
    private val frameUrls = mutableListOf<String>()

    private data class JointPoint(val x: Float, val y: Float, val z: Float, val confidence: Float)

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val available = ArCoreApk.getInstance().checkAvailability(context) == ArCoreApk.Availability.SUPPORTED_INSTALLED
        val sensorType = if (available) "tof" else "none"
        val ret = JSObject()
        ret.put("available", available)
        ret.put("sensorType", sensorType)
        call.resolve(ret)
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (!hasPermission("camera")) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }

        try {
            val arSession = Session(context)
            val config = Config(arSession)
            config.depthMode = Config.DepthMode.AUTOMATIC
            config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
            arSession.configure(config)
            session = arSession
            poseDetector = PoseDetection.getClient(
                PoseDetectorOptions.Builder()
                    .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
                    .build()
            )

            maxDurationSec = call.getDouble("maxDurationSec", 30.0)
            synchronized(frames) {
                frames.clear()
                frameUrls.clear()
            }
            recording = true
            startTimeMs = System.currentTimeMillis()
            lastSampleMs = 0L
            attachCameraSurface(arSession) { error ->
                if (error != null) {
                    recording = false
                    releaseCameraResources()
                    call.reject("Impossibile avviare il flusso ARCore: ${error.message}")
                } else {
                    call.resolve()
                }
            }
        } catch (e: Exception) {
            recording = false
            releaseCameraResources()
            call.reject("Impossibile avviare ARCore: ${e.message}")
        }
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (hasPermission("camera")) startRecording(call)
        else call.reject("Permesso fotocamera necessario per rilevare le giunzioni")
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        recording = false
        val depthFrames = synchronized(frames) { toJSArray(frames) }
        val urls = synchronized(frames) { toJSArray(frameUrls) }
        releaseCameraResources {
            val depthData = JSObject()
            depthData.put("sensorType", "tof")
            depthData.put("coordinateSystem", "right_handed_y_up_meters")
            depthData.put("frames", depthFrames)

            val result = JSObject()
            result.put("frameUrls", urls)
            result.put("depthData", depthData)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun cancelRecording(call: PluginCall) {
        recording = false
        synchronized(frames) {
            frames.clear()
            frameUrls.clear()
        }
        releaseCameraResources { call.resolve() }
    }

    private fun attachCameraSurface(arSession: Session, completion: (Exception?) -> Unit) {
        bridge.activity.runOnUiThread {
            try {
                val view = GLSurfaceView(context).apply {
                    setEGLContextClientVersion(2)
                    setEGLConfigChooser(8, 8, 8, 8, 16, 0)
                    holder.setFormat(PixelFormat.TRANSLUCENT)
                    setZOrderOnTop(true)
                    alpha = 0f
                    preserveEGLContextOnPause = true
                    setRenderer(object : GLSurfaceView.Renderer {
                        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
                            val texture = IntArray(1)
                            GLES20.glGenTextures(1, texture, 0)
                            cameraTextureId = texture[0]
                            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
                            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                            arSession.setCameraTextureNames(intArrayOf(cameraTextureId))
                        }

                        override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
                            GLES20.glViewport(0, 0, width, height)
                        }

                        override fun onDrawFrame(gl: GL10?) {
                            GLES20.glClearColor(0f, 0f, 0f, 0f)
                            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
                            if (!recording) return
                            try {
                                onArFrame(arSession.update())
                            } catch (e: Exception) {
                                Log.w("DepthScanner", "ARCore frame non disponibile", e)
                            }
                        }
                    })
                    renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
                }
                bridge.activity.addContentView(view, FrameLayout.LayoutParams(1, 1))
                glView = view
                view.onResume()
                arSession.resume()
                completion(null)
            } catch (e: Exception) {
                completion(e)
            }
        }
    }

    private fun releaseCameraResources(afterRelease: () -> Unit = {}) {
        bridge.activity.runOnUiThread {
            val view = glView
            glView = null
            view?.onPause()
            (view?.parent as? ViewGroup)?.removeView(view)
            try { session?.pause() } catch (_: Exception) { }
            session?.close()
            session = null
            poseDetector?.close()
            poseDetector = null
            cameraTextureId = 0
            afterRelease()
        }
    }

    private fun onArFrame(frame: Frame) {
        if (!recording) return
        val now = System.currentTimeMillis()
        val elapsed = (now - startTimeMs) / 1000.0
        if (elapsed >= maxDurationSec) {
            recording = false
            mainHandler.post { releaseCameraResources() }
            return
        }
        if (now - lastSampleMs < 200 || synchronized(frames) { frames.size >= 180 }) return
        lastSampleMs = now

        var depthImage: Image? = null
        var cameraImage: Image? = null
        try {
            depthImage = frame.acquireDepthImage16()
            cameraImage = frame.acquireCameraImage()
            val joints3D = detectPoseAndFuseDepth(frame, cameraImage, depthImage)
            if (joints3D.size < 6) return
            val entry = JSObject()
            entry.put("timestamp", elapsed)
            entry.put("joints3D", joints3D.toJSArray())
            entry.put("depthRangeMm", computeDepthStats(depthImage))
            synchronized(frames) { frames.add(entry) }
        } catch (e: Exception) {
            Log.d("DepthScanner", "Frame depth/pose saltato", e)
        } finally {
            cameraImage?.close()
            depthImage?.close()
        }
    }

    private fun computeDepthStats(depth: Image?): JSObject {
        if (depth == null) return JSObject()
        // Depth16: ogni pixel è uint16 in mm. Calcola min/max/mediana su un campione.
        val plane = depth.planes[0]
        val buffer = plane.buffer
        var min = Short.MAX_VALUE.toInt()
        var max = 0
        val samples = mutableListOf<Int>()
        val sampleStep = 8
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        for (y in 0 until depth.height step sampleStep) {
            for (x in 0 until depth.width step sampleStep) {
                val idx = y * rowStride + x * pixelStride
                if (idx + 1 >= buffer.capacity()) continue
                val mm = (buffer.get(idx).toInt() and 0xFF) or ((buffer.get(idx + 1).toInt() and 0xFF) shl 8)
                if (mm <= 0) continue
                min = min.coerceAtMost(mm)
                max = max.coerceAtLeast(mm)
                samples.add(mm)
            }
        }
        if (samples.isEmpty()) return JSObject()
        samples.sort()
        val median = if (samples.size % 2 == 0) {
            (samples[samples.size / 2 - 1] + samples[samples.size / 2]) / 2
        } else samples[samples.size / 2]
        val ret = JSObject()
        ret.put("min", min)
        ret.put("max", max)
        ret.put("median", median)
        return ret
    }

    private fun detectPoseAndFuseDepth(frame: Frame, cameraImage: Image, depth: Image?): List<JSObject> {
        if (depth == null) return emptyList()
        val rotation = when (bridge.activity.windowManager.defaultDisplay.rotation) {
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }
        val input = InputImage.fromMediaImage(cameraImage, rotation)
        val pose = Tasks.await(poseDetector!!.process(input), 250, TimeUnit.MILLISECONDS)
        val points = linkedMapOf<String, JointPoint>()
        val landmarks = listOf(
            PoseLandmark.NOSE to "head",
            PoseLandmark.LEFT_SHOULDER to "shoulder_l",
            PoseLandmark.RIGHT_SHOULDER to "shoulder_r",
            PoseLandmark.LEFT_ELBOW to "elbow_l",
            PoseLandmark.RIGHT_ELBOW to "elbow_r",
            PoseLandmark.LEFT_WRIST to "wrist_l",
            PoseLandmark.RIGHT_WRIST to "wrist_r",
            PoseLandmark.LEFT_HIP to "hip_l",
            PoseLandmark.RIGHT_HIP to "hip_r",
            PoseLandmark.LEFT_KNEE to "knee_l",
            PoseLandmark.RIGHT_KNEE to "knee_r",
            PoseLandmark.LEFT_ANKLE to "ankle_l",
            PoseLandmark.RIGHT_ANKLE to "ankle_r",
        )

        for ((landmarkType, id) in landmarks) {
            val landmark = pose.getPoseLandmark(landmarkType) ?: continue
            val likelihood = landmark.inFrameLikelihood
            if (likelihood < 0.35f) continue
            val pixel = toSensorPixel(landmark.position.x, landmark.position.y, cameraImage.width, cameraImage.height, rotation)
            val point = unprojectDepthPoint(frame, depth, cameraImage, pixel.first, pixel.second, likelihood) ?: continue
            points[id] = point
        }

        midpoint(points["shoulder_l"], points["shoulder_r"])?.let { points["spine_chest"] = it }
        midpoint(points["hip_l"], points["hip_r"])?.let { points["spine_base"] = it }
        return points.map { (id, point) ->
            JSObject().apply {
                put("id", id)
                put("x", point.x.toDouble())
                put("y", point.y.toDouble())
                put("z", point.z.toDouble())
                put("confidence", point.confidence.toDouble())
            }
        }
    }

    private fun toSensorPixel(x: Float, y: Float, width: Int, height: Int, rotation: Int): Pair<Float, Float> {
        val rotatedWidth = if (rotation == 90 || rotation == 270) height.toFloat() else width.toFloat()
        val rotatedHeight = if (rotation == 90 || rotation == 270) width.toFloat() else height.toFloat()
        val u = (x / rotatedWidth).coerceIn(0f, 1f)
        val v = (y / rotatedHeight).coerceIn(0f, 1f)
        val raw = when (rotation) {
            90 -> v to (1f - u)
            180 -> (1f - u) to (1f - v)
            270 -> (1f - v) to u
            else -> u to v
        }
        return raw.first * width to raw.second * height
    }

    private fun unprojectDepthPoint(
        frame: Frame,
        depth: Image,
        cameraImage: Image,
        pixelX: Float,
        pixelY: Float,
        confidence: Float,
    ): JointPoint? {
        val depthX = (pixelX * depth.width / cameraImage.width).toInt().coerceIn(0, depth.width - 1)
        val depthY = (pixelY * depth.height / cameraImage.height).toInt().coerceIn(0, depth.height - 1)
        val plane = depth.planes[0]
        val buffer = plane.buffer.duplicate()
        val offset = depthY * plane.rowStride + depthX * plane.pixelStride
        if (offset + 1 >= buffer.limit()) return null
        val millimeters = (buffer.get(offset).toInt() and 0xFF) or ((buffer.get(offset + 1).toInt() and 0xFF) shl 8)
        if (millimeters !in 100..6000) return null

        val intrinsics = frame.camera.imageIntrinsics
        val focal = intrinsics.focalLength
        val principal = intrinsics.principalPoint
        if (focal[0] <= 0f || focal[1] <= 0f) return null
        val z = millimeters / 1000f
        val cameraPoint = floatArrayOf(
            (pixelX - principal[0]) * z / focal[0],
            -(pixelY - principal[1]) * z / focal[1],
            -z,
        )
        val worldPoint = frame.camera.pose.transformPoint(cameraPoint)
        return JointPoint(worldPoint[0], worldPoint[1], worldPoint[2], confidence)
    }

    private fun midpoint(a: JointPoint?, b: JointPoint?): JointPoint? {
        if (a == null) return b
        if (b == null) return a
        return JointPoint(
            (a.x + b.x) / 2f,
            (a.y + b.y) / 2f,
            (a.z + b.z) / 2f,
            (a.confidence + b.confidence) / 2f,
        )
    }

    private fun toJSArray(values: Iterable<*>): JSArray {
        val array = JSArray()
        values.forEach { array.put(it) }
        return array
    }
}