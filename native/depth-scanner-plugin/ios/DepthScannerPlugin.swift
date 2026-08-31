import Foundation
import ARKit
import Capacitor

/**
 * DepthScannerPlugin (iOS)
 *
 * Usa ARKit per:
 *  - ARBodyTrackingConfiguration → scheletro 3D del corpo (91 giunzioni)
 *  - sceneDepth (LiDAR, iPhone/iPad Pro) → mappa di profondità reale
 *
 * Registra frame sincronizzati (RGB JPEG + joints 3D + depth stats) e
 * li restituisce al JS tramite stopRecording().
 *
 * NOTA: questo file va compilato in Xcode. Richiede iOS 14+ e, per la
 * profondità LiDAR, un dispositivo con sensore LiDAR (iPhone 12 Pro+).
 */
@objc(DepthScannerPlugin)
public class DepthScannerPlugin: CAPPlugin, ARSessionDelegate {
  private var session: ARSession?
  private var recording = false
  private var maxDuration: Double = 30.0
  private var startTime: Double = 0
  private var frames: [[String: Any]] = []
  private var frameUrls: [String] = []

  // Giunzioni ARKit mappate ai nomi usati dal backend
  private let jointMap: [String: String] = [
    "head": "head",
    "neck_1": "neck",
    "leftShoulder": "shoulder_l",
    "rightShoulder": "shoulder_r",
    "leftElbow": "elbow_l",
    "rightElbow": "elbow_r",
    "leftWrist": "wrist_l",
    "rightWrist": "wrist_r",
    "leftHand": "hand_l",
    "rightHand": "hand_r",
    "spine_7": "spine_chest",
    "spine_3": "spine_base",
    "leftHip": "hip_l",
    "rightHip": "hip_r",
    "leftKnee": "knee_l",
    "rightKnee": "knee_r",
    "leftAnkle": "ankle_l",
    "rightAnkle": "ankle_r"
  ]

  @objc func isAvailable(_ call: CAPPluginCall) {
    let bodySupported = ARBodyTrackingConfiguration.isSupported
    let lidarSupported = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    let sensorType = lidarSupported ? "lidar" : (bodySupported ? "tof" : "none")
    call.resolve([
      "available": bodySupported || lidarSupported,
      "sensorType": sensorType
    ])
  }

  @objc func startRecording(_ call: CAPPluginCall) {
    guard ARBodyTrackingConfiguration.isSupported else {
      call.reject("Body tracking non supportato su questo dispositivo (richiede iOS 14+ e iPhone Xs o superiore)")
      return
    }
    maxDuration = call.getDouble("maxDurationSec") ?? 30.0
    let facing = call.getString("facing") ?? "back"

    let config = ARBodyTrackingConfiguration()
    config.frameSemantics = [.bodyDetection]
    if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
      config.frameSemantics.insert(.sceneDepth)
    }

    frames = []
    frameUrls = []
    session = ARSession()
    session?.delegate = self
    DispatchQueue.main.async {
      self.session?.run(config)
    }
    recording = true
    startTime = CACurrentMediaTime()
    call.resolve()
  }

  @objc func stopRecording(_ call: CAPPluginCall) {
    recording = false
    session?.pause()

    // Carica i frame RGB (in un'app reale qui si fa UploadFile verso il backend)
    // Per ora restituisce i dati strutturati; l'upload avviene lato JS.
    let depthData: [String: Any] = [
      "sensorType": ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) ? "lidar" : "tof",
      "frames": frames
    ]
    call.resolve([
      "frameUrls": frameUrls,
      "depthData": depthData
    ])
  }

  @objc func cancelRecording(_ call: CAPPluginCall) {
    recording = false
    session?.pause()
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

    guard let body = frame.bodyAnchor as? ARBodyAnchor else { return }
    let joints = serializeJoints(body)
    let depthStats = depthRangeStats(frame.sceneDepth?.depthMap)

    let entry: [String: Any] = [
      "timestamp": frame.timestamp,
      "joints3D": joints,
      "depthRangeMm": depthStats
    ]
    frames.append(entry)
  }

  private func serializeJoints(_ body: ARBodyAnchor) -> [[String: Any]] {
    var out: [[String: Any]] = []
    for (arName, mappedId) in jointMap {
      guard let transform = body.skeleton.modelTransform(for: .init(rawValue: arName)) else { continue }
      let pos = transform.columns.3
      out.append([
        "id": mappedId,
        "x": pos.x,
        "y": pos.y,
        "z": pos.z,
        "confidence": 1.0
      ])
    }
    return out
  }

  private func depthRangeStats(_ depthMap: CVPixelBuffer?) -> [String: Any] {
    guard let buf = depthMap else { return [:] }
    CVPixelBufferLockBaseAddress(buf, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buf, .readOnly) }
    let w = CVPixelBufferGetWidth(buf)
    let h = CVPixelBufferGetHeight(buf)
    let base = CVPixelBufferGetBaseAddress(buf)
    let ptr = base?.assumingMemoryBound(to: Float.self)
    var minV: Float = .greatestFiniteMagnitude
    var maxV: Float = 0
    var sum: Float = 0
    var count: Int = 0
    if let p = ptr {
      for i in 0..<(w * h) {
        let v = p[i]
        if v.isNaN || v <= 0 { continue }
        minV = min(minV, v)
        maxV = max(maxV, v)
        sum += v
        count += 1
      }
    }
    let median = count > 0 ? sum / Float(count) : 0
    // ARKit depth è in metri → converti in mm
    return [
      "min": Double(minV) * 1000,
      "max": Double(maxV) * 1000,
      "median": Double(median) * 1000
    ]
  }
}