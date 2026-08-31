package com.moveerai.depthscanner

import android.media.Image
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ar.core.ArCoreApk
import com.google.ar.core.CameraConfig
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session

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
@CapacitorPlugin(name = "DepthScanner")
class DepthScannerPlugin : Plugin() {

    private var session: Session? = null
    private var recording = false
    private var maxDurationSec = 30.0
    private var startTimeMs = 0L
    private val frames = mutableListOf<JSObject>()
    private val frameUrls = mutableListOf<String>()

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
        try {
            session = Session(context)
            val config = Config(session)
            config.depthMode = Config.DepthMode.AUTOMATIC
            config.updateMode = Config.UpdateMode.LATEST_CAMERA_FRAME
            session!!.configure(config)
            session!!.resume()

            maxDurationSec = call.getDouble("maxDurationSec", 30.0)
            frames.clear()
            frameUrls.clear()
            recording = true
            startTimeMs = System.currentTimeMillis()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Impossibile avviare ARCore: ${e.message}")
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        recording = false
        session?.pause()

        val depthData = JSObject()
        depthData.put("sensorType", "tof")
        depthData.put("frames", frames.toJSArray())

        val ret = JSObject()
        ret.put("frameUrls", frameUrls.toJSArray())
        ret.put("depthData", depthData)
        call.resolve(ret)
    }

    @PluginMethod
    fun cancelRecording(call: PluginCall) {
        recording = false
        session?.pause()
        frames.clear()
        frameUrls.clear()
        call.resolve()
    }

    /**
     * Chiamato dal ciclo di rendering ARCore (in app reale collegato al
     * SurfaceView/GLSurfaceView). Per ogni frame:
     *  1. Acquisisce depth map (Depth16, mm per pixel)
     *  2. Acquisisce RGB
     *  3. Rileva pose 2D (ML Kit) e fonde con depth → joints 3D
     */
    private fun onArFrame(frame: Frame) {
        if (!recording) return
        val elapsed = (System.currentTimeMillis() - startTimeMs) / 1000.0
        if (elapsed >= maxDurationSec) {
            recording = false
            session?.pause()
            return
        }

        val depthImage = try { frame.acquireDepthImage16() } catch (e: Exception) { null }
        val depthStats = computeDepthStats(depthImage)
        val joints3D = detectPoseAndFuseDepth(frame, depthImage)

        val entry = JSObject()
        entry.put("timestamp", frame.timestamp)
        entry.put("joints3D", joints3D.toJSArray())
        entry.put("depthRangeMm", depthStats)
        frames.add(entry)
    }

    private fun computeDepthStats(depth: Image?): JSObject {
        if (depth == null) return JSObject()
        // Depth16: ogni pixel è uint16 in mm. Calcola min/max/mediana su un campione.
        val plane = depth.planes[0]
        val buffer = plane.buffer
        var min = Short.MAX_VALUE.toInt()
        var max = 0
        var sum = 0L
        var count = 0
        val sampleStep = 10 // campiona per performance
        buffer.rewind()
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        for (y in 0 until depth.height step sampleStep) {
            for (x in 0 until depth.width step sampleStep) {
                val idx = y * rowStride + x * pixelStride
                if (idx + 1 >= buffer.capacity()) continue
                val mm = (buffer.get(idx).toInt() and 0xFF) or (buffer.get(idx + 1).toInt() shl 8)
                if (mm <= 0) continue
                min = min.coerceAtMost(mm)
                max = max.coerceAtLeast(mm)
                sum += mm
                count++
            }
        }
        val ret = JSObject()
        ret.put("min", min)
        ret.put("max", max)
        ret.put("median", if (count > 0) sum / count else 0)
        return ret
    }

    /**
     * Fuse pose 2D (ML Kit) con depth map → joints 3D.
     * In un'implementazione reale qui si integra com.google.mlkit:pose-detection
     * e si proietta ogni giunzione 2D sulla depth map per ottenere Z.
     */
    private fun detectPoseAndFuseDepth(frame: Frame, depth: Image?): List<JSObject> {
        // Placeholder: restituisce lista vuota se ML Kit non è integrato.
        // Implementazione reale: vedi docs/NATIVE_DEPTH_GUIDE.md sezione Android.
        return emptyList()
    }
}