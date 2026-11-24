import Foundation
import ARKit
import Capacitor
import ImageIO
import Vision

/**
 * DepthScannerPlugin (iOS)
 *
 * Usa ARKit sceneDepth per la profondità LiDAR e Vision per stimare le
 * giunzioni corporee, proiettandole nello spazio 3D con la depth map.
 *
 * Registra frame sincronizzati (RGB JPEG + joints 3D + depth stats) e
 * li restituisce al JS tramite stopRecording().
 *
 * NOTA: questo file va compilato in Xcode. Richiede iOS 15+ e, per la
 * profondità LiDAR, un dispositivo con sensore LiDAR (iPhone 12 Pro+).
 */
@objc(DepthScannerPlugin)
public class DepthScannerPlugin: CAPPlugin, CAPBridgedPlugin, ARSessionDelegate {
  public let identifier = "DepthScannerPlugin"
  public let jsName = "DepthScanner"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "recordVideo", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "cancelRecording", returnType: CAPPluginReturnPromise)
  ]

  private var session: ARSession?
  private var recording = false
  private var maxDuration: Double = 30.0
  private var startTime: Double = 0
  private var lastSampleTime: Double = 0
  private var frames: [[String: Any]] = []
  private var frameUrls: [String] = []

  private let jointMap: [(VNHumanBodyPoseObservation.JointName, String)] = [
    (.nose, "head"),
    (.neck, "neck"),
    (.leftShoulder, "shoulder_l"),
    (.rightShoulder, "shoulder_r"),
    (.leftElbow, "elbow_l"),
    (.rightElbow, "elbow_r"),
    (.leftWrist, "wrist_l"),
    (.rightWrist, "wrist_r"),
    (.root, "spine_base"),
    (.leftHip, "hip_l"),
    (.rightHip, "hip_r"),
    (.leftKnee, "knee_l"),
    (.rightKnee, "knee_r"),
    (.leftAnkle, "ankle_l"),
    (.rightAnkle, "ankle_r")
  ]

  @objc public func isAvailable(_ call: CAPPluginCall) {
    let lidarSupported = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    let sensorType = lidarSupported ? "lidar" : "none"
    call.resolve([
      "available": ARWorldTrackingConfiguration.isSupported && lidarSupported,
      "sensorType": sensorType
    ])
  }

  @objc public func recordVideo(_ call: CAPPluginCall) {
    guard ARWorldTrackingConfiguration.isSupported,
          ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
      call.reject("Registrazione LiDAR non supportata su questo dispositivo.")
      return
    }
    DispatchQueue.main.async {
      let recorder = NativeDepthRecorderViewController()
      recorder.modalPresentationStyle = .fullScreen
      recorder.onFinish = { url, frames in
        call.resolve([
          "videoPath": url.path,
          "depthData": [
            "sensorType": "lidar",
            "coordinateSystem": "right_handed_y_up_meters",
            "frames": frames
          ]
        ])
      }
      recorder.onCancel = { call.reject("Registrazione annullata.") }
      guard let bridge = self.bridge, let presenter = bridge.viewController else {
        call.reject("Impossibile aprire il registratore nativo.")
        return
      }
      presenter.present(recorder, animated: true)
    }
  }

  @objc public func startRecording(_ call: CAPPluginCall) {
    guard ARWorldTrackingConfiguration.isSupported,
          ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
      call.reject("LiDAR sceneDepth non supportato su questo dispositivo.")
      return
    }
    maxDuration = call.getDouble("maxDurationSec") ?? 30.0

    let config = ARWorldTrackingConfiguration()
    config.frameSemantics.insert(.sceneDepth)

    frames = []
    frameUrls = []
    session = ARSession()
    session?.delegate = self
    DispatchQueue.main.async {
      self.session?.run(config, options: [.resetTracking, .removeExistingAnchors])
    }
    recording = true
    startTime = CACurrentMediaTime()
    lastSampleTime = 0
    call.resolve()
  }

  @objc public func stopRecording(_ call: CAPPluginCall) {
    recording = false
    session?.pause()
    session?.delegate = nil
    session = nil

    // Carica i frame RGB (in un'app reale qui si fa UploadFile verso il backend)
    // Per ora restituisce i dati strutturati; l'upload avviene lato JS.
    let depthData: [String: Any] = [
      "sensorType": "lidar",
      "coordinateSystem": "right_handed_y_up_meters",
      "frames": frames
    ]
    call.resolve([
      "frameUrls": frameUrls,
      "depthData": depthData
    ])
  }

  @objc public func cancelRecording(_ call: CAPPluginCall) {
    recording = false
    session?.pause()
    session?.delegate = nil
    session = nil
    frames = []
    frameUrls = []
    call.resolve()
  }

  public func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard recording else { return }
    let elapsed = CACurrentMediaTime() - startTime
    if elapsed >= maxDuration {
      recording = false
      session.pause()
      return
    }
    guard elapsed - lastSampleTime >= 0.2, frames.count < 180 else { return }
    lastSampleTime = elapsed

    guard let depthMap = frame.sceneDepth?.depthMap else { return }
    let joints = serializeJoints(frame, depthMap: depthMap)
    let depthStats = depthRangeStats(depthMap)

    let entry: [String: Any] = [
      "timestamp": elapsed,
      "joints3D": joints,
      "depthRangeMm": depthStats
    ]
    frames.append(entry)
  }

  private func serializeJoints(_ frame: ARFrame, depthMap: CVPixelBuffer) -> [[String: Any]] {
    var out: [[String: Any]] = []
    let request = VNDetectHumanBodyPoseRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: frame.capturedImage, orientation: .right)
    guard (try? handler.perform([request])) != nil,
          let observation = request.results?.first,
          let points = try? observation.recognizedPoints(.all) else { return out }

    let imageWidth = CVPixelBufferGetWidth(frame.capturedImage)
    let imageHeight = CVPixelBufferGetHeight(frame.capturedImage)
    let depthWidth = CVPixelBufferGetWidth(depthMap)
    let depthHeight = CVPixelBufferGetHeight(depthMap)
    let intrinsics = frame.camera.intrinsics
    let fx = intrinsics.columns.0.x
    let fy = intrinsics.columns.1.y
    let cx = intrinsics.columns.2.x
    let cy = intrinsics.columns.2.y

    for (jointName, mappedId) in jointMap {
      guard let point = points[jointName], point.confidence >= 0.25 else { continue }
      let imageX = (1 - Float(point.location.y)) * Float(imageWidth)
      let imageY = (1 - Float(point.location.x)) * Float(imageHeight)
      let normalizedX = imageX / Float(imageWidth)
      let normalizedY = imageY / Float(imageHeight)
      let depthX = min(max(Int(normalizedX * Float(depthWidth)), 0), depthWidth - 1)
      let depthY = min(max(Int(normalizedY * Float(depthHeight)), 0), depthHeight - 1)
      guard let depth = depthMeters(depthMap, x: depthX, y: depthY), fx > 0, fy > 0 else { continue }

      let cameraX = (imageX - cx) * depth / fx
      let cameraY = (cy - imageY) * depth / fy
      let world = frame.camera.transform * SIMD4<Float>(cameraX, cameraY, -depth, 1)
      out.append([
        "id": mappedId,
        "x": world.x,
        "y": world.y,
        "z": world.z,
        "confidence": Double(point.confidence)
      ])
    }
    return out
  }

  private func depthMeters(_ depthMap: CVPixelBuffer, x: Int, y: Int) -> Float? {
    CVPixelBufferLockBaseAddress(depthMap, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(depthMap) else { return nil }
    let width = CVPixelBufferGetWidth(depthMap)
    let height = CVPixelBufferGetHeight(depthMap)
    let rowStride = CVPixelBufferGetBytesPerRow(depthMap) / MemoryLayout<Float>.size
    let pointer = base.assumingMemoryBound(to: Float.self)
    var values: [Float] = []
    for offsetY in -2...2 {
      for offsetX in -2...2 {
        let sampleX = x + offsetX
        let sampleY = y + offsetY
        guard sampleX >= 0, sampleX < width, sampleY >= 0, sampleY < height else { continue }
        let value = pointer[sampleY * rowStride + sampleX]
        if value.isFinite && value > 0 { values.append(value) }
      }
    }
    guard !values.isEmpty else { return nil }
    values.sort()
    return values[values.count / 2]
  }

  private func depthRangeStats(_ depthMap: CVPixelBuffer?) -> [String: Any] {
    guard let buf = depthMap else { return [:] }
    CVPixelBufferLockBaseAddress(buf, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buf, .readOnly) }
    let w = CVPixelBufferGetWidth(buf)
    let h = CVPixelBufferGetHeight(buf)
    let base = CVPixelBufferGetBaseAddress(buf)
    let ptr = base?.assumingMemoryBound(to: Float.self)
    let rowStride = CVPixelBufferGetBytesPerRow(buf) / MemoryLayout<Float>.size
    var minV: Float = .greatestFiniteMagnitude
    var maxV: Float = 0
    var samples: [Float] = []
    if let p = ptr {
      for y in stride(from: 0, to: h, by: 8) {
        for x in stride(from: 0, to: w, by: 8) {
          let v = p[y * rowStride + x]
          if !v.isFinite || v <= 0 { continue }
          minV = min(minV, v)
          maxV = max(maxV, v)
          samples.append(v)
        }
      }
    }
    guard !samples.isEmpty else { return [:] }
    samples.sort()
    let median: Float
    if samples.isEmpty {
      median = 0
    } else if samples.count.isMultiple(of: 2) {
      median = (samples[samples.count / 2 - 1] + samples[samples.count / 2]) / 2
    } else {
      median = samples[samples.count / 2]
    }
    // ARKit depth è in metri → converti in mm
    return [
      "min": Double(minV) * 1000,
      "max": Double(maxV) * 1000,
      "median": Double(median) * 1000
    ]
  }
}