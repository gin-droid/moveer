import ARKit
import AVFoundation
import CoreImage
import SceneKit
import UIKit
import Vision

final class NativeDepthRecorderViewController: UIViewController, ARSCNViewDelegate {
  var onFinish: ((URL, [[String: Any]]) -> Void)?
  var onCancel: (() -> Void)?

  private let sceneView = ARSCNView(frame: .zero)
  private let captureQueue = DispatchQueue(label: "eu.moveerai.depth-recorder")
  private let frameInFlight = DispatchSemaphore(value: 1)
  private let ciContext = CIContext(options: [.cacheIntermediates: false])
  private let statusLabel = UILabel()
  private let timerLabel = UILabel()
  private let recordButton = UIButton(type: .system)
  private let pauseButton = UIButton(type: .system)
  private let stopButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)

  private var writer: AVAssetWriter?
  private var writerInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var outputURL: URL?
  private var frames: [[String: Any]] = []
  private var arFrameCount = 0
  private var videoFrameCount = 0
  private var depthFrameCount = 0
  private var lastWriterFailure = ""
  private var isRecording = false
  private var isPaused = false
  private var recordingStartTime: TimeInterval?
  private var pauseStartTime: TimeInterval?
  private var pausedDuration: TimeInterval = 0
  private var lastDepthSampleTime: TimeInterval = -1
  private var activeSeconds = 0
  private var timer: Timer?

  private let joints: [(VNHumanBodyPoseObservation.JointName, String)] = [
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

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    configurePreview()
    configureControls()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
      dismiss(animated: true) { self.onCancel?() }
      return
    }
    let configuration = ARWorldTrackingConfiguration()
    configuration.frameSemantics.insert(.sceneDepth)
    sceneView.delegate = self
    sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    timer?.invalidate()
    sceneView.delegate = nil
    sceneView.session.pause()
  }

  private func configurePreview() {
    sceneView.translatesAutoresizingMaskIntoConstraints = false
    sceneView.automaticallyUpdatesLighting = false
    sceneView.delegate = self
    view.addSubview(sceneView)
    NSLayoutConstraint.activate([
      sceneView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      sceneView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      sceneView.topAnchor.constraint(equalTo: view.topAnchor),
      sceneView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }

  private func configureControls() {
    statusLabel.text = "Inquadra il corpo, poi premi REC"
    statusLabel.textColor = .white
    statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(statusLabel)

    timerLabel.text = "00:00 / 00:30"
    timerLabel.textColor = .white
    timerLabel.font = .monospacedDigitSystemFont(ofSize: 16, weight: .medium)
    timerLabel.textAlignment = .center
    timerLabel.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(timerLabel)

    style(recordButton, title: "REC", color: .systemRed)
    style(pauseButton, title: "PAUSA", color: .systemOrange)
    style(stopButton, title: "STOP", color: .white)
    style(cancelButton, title: "CHIUDI", color: .white)
    recordButton.addTarget(self, action: #selector(startCapture), for: .touchUpInside)
    pauseButton.addTarget(self, action: #selector(togglePause), for: .touchUpInside)
    stopButton.addTarget(self, action: #selector(stopCapture), for: .touchUpInside)
    cancelButton.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    pauseButton.isHidden = true
    stopButton.isHidden = true

    let controls = UIStackView(arrangedSubviews: [recordButton, pauseButton, stopButton])
    controls.axis = .horizontal
    controls.alignment = .center
    controls.distribution = .equalSpacing
    controls.spacing = 24
    controls.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(controls)
    view.addSubview(cancelButton)

    NSLayoutConstraint.activate([
      statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      statusLabel.bottomAnchor.constraint(equalTo: timerLabel.topAnchor, constant: -12),
      statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
      timerLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      timerLabel.bottomAnchor.constraint(equalTo: controls.topAnchor, constant: -18),
      controls.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      controls.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -28),
      recordButton.widthAnchor.constraint(equalToConstant: 84),
      recordButton.heightAnchor.constraint(equalToConstant: 84),
      pauseButton.widthAnchor.constraint(equalToConstant: 84),
      pauseButton.heightAnchor.constraint(equalToConstant: 84),
      stopButton.widthAnchor.constraint(equalToConstant: 84),
      stopButton.heightAnchor.constraint(equalToConstant: 84),
      cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      cancelButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
      cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 72),
      cancelButton.heightAnchor.constraint(equalToConstant: 44)
    ])
  }

  private func style(_ button: UIButton, title: String, color: UIColor) {
    button.setTitle(title, for: .normal)
    button.setTitleColor(color, for: .normal)
    button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
    button.backgroundColor = UIColor.black.withAlphaComponent(0.7)
    button.layer.cornerRadius = 42
    button.layer.borderColor = color.cgColor
    button.layer.borderWidth = 2
    button.translatesAutoresizingMaskIntoConstraints = false
  }

  @objc private func startCapture() {
    captureQueue.async {
      self.frames.removeAll()
      self.arFrameCount = 0
      self.videoFrameCount = 0
      self.depthFrameCount = 0
      self.lastWriterFailure = ""
      self.writer = nil
      self.writerInput = nil
      self.pixelBufferAdaptor = nil
      self.recordingStartTime = nil
      self.pauseStartTime = nil
      self.pausedDuration = 0
      self.lastDepthSampleTime = -1
      self.isPaused = false
      self.isRecording = true
    }
    recordButton.isHidden = true
    pauseButton.isHidden = false
    stopButton.isHidden = false
    statusLabel.text = "REGISTRAZIONE VIDEO + DEPTH"
    activeSeconds = 0
    updateTimer()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self else { return }
      self.activeSeconds += 1
      self.updateTimer()
      if self.activeSeconds >= 30 { self.stopCapture() }
    }
  }

  @objc private func togglePause() {
    let shouldPause = pauseButton.title(for: .normal) == "PAUSA"
    captureQueue.async {
      if shouldPause {
        self.isPaused = true
        self.pauseStartTime = CACurrentMediaTime()
      } else {
        if let pauseStartTime = self.pauseStartTime {
          self.pausedDuration += CACurrentMediaTime() - pauseStartTime
        }
        self.pauseStartTime = nil
        self.isPaused = false
      }
    }
    if shouldPause {
      pauseButton.setTitle("RIPRENDI", for: .normal)
      statusLabel.text = "IN PAUSA"
      timer?.invalidate()
    } else {
      pauseButton.setTitle("PAUSA", for: .normal)
      statusLabel.text = "REGISTRAZIONE VIDEO + DEPTH"
      timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
        guard let self else { return }
        self.activeSeconds += 1
        self.updateTimer()
        if self.activeSeconds >= 30 { self.stopCapture() }
      }
    }
  }

  @objc private func stopCapture() {
    guard !stopButton.isHidden else { return }
    timer?.invalidate()
    recordButton.isHidden = true
    pauseButton.isHidden = true
    stopButton.isHidden = true
    statusLabel.text = "FINALIZZAZIONE VIDEO…"
    captureQueue.async {
      self.isRecording = false
      self.isPaused = false
      guard let writer = self.writer, let input = self.writerInput, let outputURL = self.outputURL else {
        DispatchQueue.main.async {
          self.statusLabel.text = "Nessun frame: AR \(self.arFrameCount) · video \(self.videoFrameCount) · depth \(self.depthFrameCount)"
          self.recordButton.isHidden = false
          self.stopButton.isHidden = true
        }
        return
      }
      guard self.videoFrameCount > 0 else {
        writer.cancelWriting()
        DispatchQueue.main.async {
          self.statusLabel.text = "MP4 vuoto: AR \(self.arFrameCount) · depth \(self.depthFrameCount)"
          self.recordButton.isHidden = false
          self.stopButton.isHidden = true
        }
        return
      }
      input.markAsFinished()
      writer.finishWriting {
        DispatchQueue.main.async {
          guard writer.status == .completed else {
            self.statusLabel.text = "Errore MP4 (\(self.videoFrameCount) frame): \(self.errorDetails(writer.error))"
            self.recordButton.isHidden = false
            return
          }
          self.dismiss(animated: true) {
            self.onFinish?(outputURL, self.frames)
          }
        }
      }
    }
  }

  @objc private func cancelCapture() {
    timer?.invalidate()
    captureQueue.async {
      self.isRecording = false
      self.writer?.cancelWriting()
      if let outputURL = self.outputURL { try? FileManager.default.removeItem(at: outputURL) }
      DispatchQueue.main.async {
        self.dismiss(animated: true) { self.onCancel?() }
      }
    }
  }

  private func updateTimer() {
    timerLabel.text = String(format: "%02d:%02d / 00:30", activeSeconds / 60, activeSeconds % 60)
  }

  func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
    guard let frame = sceneView.session.currentFrame,
          frameInFlight.wait(timeout: .now()) == .success else { return }
    captureQueue.async {
      defer { self.frameInFlight.signal() }
      self.processFrame(frame)
    }
  }

  private func processFrame(_ frame: ARFrame) {
    guard isRecording, !isPaused else { return }
    arFrameCount += 1
    if recordingStartTime == nil { recordingStartTime = frame.timestamp }
    let elapsed = frame.timestamp - (recordingStartTime ?? frame.timestamp) - pausedDuration
    guard elapsed >= 0, appendVideoFrame(frame.capturedImage, timestamp: elapsed) else { return }
    videoFrameCount += 1
    guard let depthMap = frame.sceneDepth?.depthMap else { return }
    depthFrameCount += 1
    guard elapsed - lastDepthSampleTime >= 0.2 else { return }
    lastDepthSampleTime = elapsed
    let bodyJoints = makeJoints(frame: frame, depthMap: depthMap)
    frames.append([
      "timestamp": elapsed,
      "joints3D": bodyJoints,
      "depthRangeMm": depthStats(depthMap)
    ])
  }

  private func appendVideoFrame(_ source: CVPixelBuffer, timestamp: TimeInterval) -> Bool {
    if writer == nil, !createWriter(for: source) { return false }
    guard let writer, let input = writerInput, let adaptor = pixelBufferAdaptor else { return false }
    if writer.status == .unknown {
      guard writer.startWriting() else { return false }
      writer.startSession(atSourceTime: .zero)
    }
    guard writer.status == .writing, input.isReadyForMoreMediaData,
          let pool = adaptor.pixelBufferPool else {
      lastWriterFailure = "status=\(writer.status.rawValue), ready=\(input.isReadyForMoreMediaData), pool=\(adaptor.pixelBufferPool != nil)"
      return false
    }

    var renderedBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &renderedBuffer) == kCVReturnSuccess,
          let renderedBuffer else { return false }
    let image = CIImage(cvPixelBuffer: source)
    ciContext.render(image, to: renderedBuffer, bounds: image.extent, colorSpace: CGColorSpaceCreateDeviceRGB())
    let presentationTime = CMTime(seconds: timestamp, preferredTimescale: 600)
    let appended = adaptor.append(renderedBuffer, withPresentationTime: presentationTime)
    if !appended { lastWriterFailure = errorDetails(writer.error) }
    return appended
  }

  private func errorDetails(_ error: Error?) -> String {
    guard let error else { return lastWriterFailure.isEmpty ? "errore non disponibile" : lastWriterFailure }
    let value = error as NSError
    let underlying = value.userInfo[NSUnderlyingErrorKey] as? NSError
    let base = "\(value.domain) (\(value.code)): \(value.localizedDescription)"
    guard let underlying else { return base }
    return "\(base); causa \(underlying.domain) (\(underlying.code)): \(underlying.localizedDescription)"
  }

  private func createWriter(for pixelBuffer: CVPixelBuffer) -> Bool {
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("moveer-\(UUID().uuidString)")
      .appendingPathExtension("mp4")
    do {
      let assetWriter = try AVAssetWriter(outputURL: url, fileType: .mp4)
      let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: 8_000_000,
          AVVideoExpectedSourceFrameRateKey: 30,
          AVVideoMaxKeyFrameIntervalKey: 30
        ]
      ])
      input.expectsMediaDataInRealTime = true
      input.transform = CGAffineTransform(rotationAngle: .pi / 2)
      let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
      ]
      let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
      guard assetWriter.canAdd(input) else { return false }
      assetWriter.add(input)
      writer = assetWriter
      writerInput = input
      pixelBufferAdaptor = adaptor
      outputURL = url
      return true
    } catch {
      return false
    }
  }

  private func makeJoints(frame: ARFrame, depthMap: CVPixelBuffer) -> [[String: Any]] {
    let request = VNDetectHumanBodyPoseRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: frame.capturedImage, orientation: .right)
    guard (try? handler.perform([request])) != nil,
          let observation = request.results?.first,
          let points = try? observation.recognizedPoints(.all) else { return [] }

    let imageWidth = CVPixelBufferGetWidth(frame.capturedImage)
    let imageHeight = CVPixelBufferGetHeight(frame.capturedImage)
    let depthWidth = CVPixelBufferGetWidth(depthMap)
    let depthHeight = CVPixelBufferGetHeight(depthMap)
    let intrinsics = frame.camera.intrinsics
    let fx = intrinsics.columns.0.x
    let fy = intrinsics.columns.1.y
    let cx = intrinsics.columns.2.x
    let cy = intrinsics.columns.2.y
    var output: [[String: Any]] = []

    for (joint, identifier) in joints {
      guard let point = points[joint], point.confidence >= 0.25 else { continue }
      let imageX = (1 - Float(point.location.y)) * Float(imageWidth)
      let imageY = (1 - Float(point.location.x)) * Float(imageHeight)
      let depthX = min(max(Int(imageX / Float(imageWidth) * Float(depthWidth)), 0), depthWidth - 1)
      let depthY = min(max(Int(imageY / Float(imageHeight) * Float(depthHeight)), 0), depthHeight - 1)
      guard let depth = depthMeters(depthMap, x: depthX, y: depthY), fx > 0, fy > 0 else { continue }
      let cameraX = (imageX - cx) * depth / fx
      let cameraY = (cy - imageY) * depth / fy
      let world = frame.camera.transform * SIMD4<Float>(cameraX, cameraY, -depth, 1)
      output.append([
        "id": identifier,
        "x": world.x,
        "y": world.y,
        "z": world.z,
        "confidence": Double(point.confidence)
      ])
    }
    return output
  }

  private func depthMeters(_ map: CVPixelBuffer, x: Int, y: Int) -> Float? {
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(map) else { return nil }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    let stride = CVPixelBufferGetBytesPerRow(map) / MemoryLayout<Float>.size
    let values = base.assumingMemoryBound(to: Float.self)
    var samples: [Float] = []
    for offsetY in -2...2 {
      for offsetX in -2...2 {
        let sx = x + offsetX
        let sy = y + offsetY
        guard sx >= 0, sx < width, sy >= 0, sy < height else { continue }
        let value = values[sy * stride + sx]
        if value.isFinite && value > 0 { samples.append(value) }
      }
    }
    samples.sort()
    return samples.isEmpty ? nil : samples[samples.count / 2]
  }

  private func depthStats(_ map: CVPixelBuffer) -> [String: Double] {
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(map) else { return [:] }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    let stride = CVPixelBufferGetBytesPerRow(map) / MemoryLayout<Float>.size
    let values = base.assumingMemoryBound(to: Float.self)
    var samples: [Float] = []
    for y in Swift.stride(from: 0, to: height, by: 8) {
      for x in Swift.stride(from: 0, to: width, by: 8) {
        let value = values[y * stride + x]
        if value.isFinite && value > 0 { samples.append(value) }
      }
    }
    guard !samples.isEmpty else { return [:] }
    samples.sort()
    return [
      "min": Double(samples[0]) * 1000,
      "max": Double(samples[samples.count - 1]) * 1000,
      "median": Double(samples[samples.count / 2]) * 1000
    ]
  }
}