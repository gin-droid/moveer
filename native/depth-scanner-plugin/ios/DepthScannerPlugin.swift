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
  public let identifier = "DepthScannerPlugin"
  public let jsName = "DepthScanner"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "cancelRecording", returnType: CAPPluginReturnPromise)
  ]

@objc(DepthScannerPlugin)
public class DepthScannerPlugin: CAPPlugin, CAPBridgedPlugin, ARSessionDelegate {
  public let identifier = "DepthScannerPlugin"
  public let jsName = "DepthScanner"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
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

  // Giunzioni ARKit mappate ai nomi usati dal backend
  private let jointMap: [String: String] = [
    "head_joint": "head",
    "neck_1_joint": "neck",
    "left_shoulder_1_joint": "shoulder_l",
    "right_shoulder_1_joint": "shoulder_r",
    "left_forearm_joint": "elbow_l",
    "right_forearm_joint": "elbow_r",
    "left_hand_joint": "wrist_l",
    "right_hand_joint": "wrist_r",
    "spine_7_joint": "spine_chest",
    "spine_3_joint": "spine_base",
    "left_upLeg_joint": "hip_l",
    "right_upLeg_joint": "hip_r",
    "left_leg_joint": "knee_l",
    "right_leg_joint": "knee_r",
    "left_foot_joint": "ankle_l",
    "right_foot_joint": "ankle_r"
  ]

  @objc public func isAvailable(_ call: CAPPluginCall) {
    let bodySupported = ARBodyTrackingConfiguration.isSupported
    let lidarSupported = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    let sensorType = lidarSupported ? "lidar" : "none"
    call.resolve([
      "available": bodySupported && lidarSupported,
      "sensorType": sensorType
    ])
  }

  @objc public func startRecording(_ call: CAPPluginCall) {
    guard ARBodyTrackingConfiguration.isSupported,
      ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
      call.reject("Serve un dispositivo Apple con body tracking e LiDAR supportato.")
      return
    }
    maxDuration = call.getDouble("maxDurationSec") ?? 30.0

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
    lastSampleTime = 0
    call.resolve()
  }

  @objc public func stopRecording(_ call: CAPPluginCall) {
    recording = false
    session?.pause()

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

    guard let body = frame.bodyAnchor as? ARBodyAnchor else { return }
    let joints = serializeJoints(body)
    let depthStats = depthRangeStats(frame.sceneDepth?.depthMap)

    let entry: [String: Any] = [
      "timestamp": elapsed,
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
        "z": pos.z
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