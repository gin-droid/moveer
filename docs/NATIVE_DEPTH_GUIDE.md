# Percorso nativo: scansione profondità LiDAR/ToF

Questa guida descrive il modulo nativo che integra LiDAR su iPhone/iPad Pro e depth ARCore su Android nell'analisi biomeccanica basata sul video RGB.

## Stato implementazione

- `depth3d.ts` normalizza i nomi delle giunzioni, scarta coordinate non finite e punti con confidenza esplicitamente bassa, calcola angoli bilaterali e seleziona frame rappresentativi. Gli angoli inclusi valgono 180° a arto esteso; la flessione anatomica vale 0° in estensione.
- Durante la registrazione video, `CameraRecorder` avvia e ferma automaticamente il plugin Capacitor se il sensore è disponibile; il backend integra misure e punti 3D nel prompt e salva `depth_analysis` nel report.
- I report con dati depth mostrano misure aggregate e uno scheletro 3D orbitabile. I punti visualizzati sono relativi al bacino e restano espressi in metri.
- Il plugin iOS usa ARKit Body Tracking, serializza i nomi JointName e campiona al massimo 5 frame al secondo. Non fornisce confidenza per singola giuntura. `ARBodyTrackingConfiguration` non supporta `sceneDepth`, quindi su iOS non acquisisce la mappa LiDAR per-pixel.
- Il plugin Android usa ARCore `LATEST_CAMERA_IMAGE` + ML Kit Pose Detection, campiona al massimo 5 frame/s e unprojecta i landmark sulla depth map usando gli intrinseci della camera.
- Il video RGB resta obbligatorio per il report; la scansione depth è un'integrazione e non restituisce frame RGB. Nel browser/PWA i sensori LiDAR/ToF non sono esposti.
- Il pacchetto Capacitor locale e il modulo Gradle Android sono configurati. La shell Android va generata/sincronizzata con i comandi descritti nel README e provata su hardware.

## Perché serve il nativo

Il web (`getUserMedia`) fornisce solo il flusso RGB. I sensori di profondità non sono esposti dai browser. Per ottenere:
- **Mappa di profondità** pixel-per-pixel (LiDAR/ToF)
- **Pose 3D del corpo** (articolazioni in 3D reale, non 2D proiettato)
- **Mesh del corpo** (scansione volumetrica)

è necessario un modulo nativo che invii i dati al backend di analisi esistente.

## Flusso attuale

```
┌─────────────────────────┐     ┌──────────────────────┐
│  App moVeerAI           │     │  Modulo nativo       │
│  - Catalogo esercizi    │     │  (Capacitor plugin)  │
│  - Report, comparazioni │     │  - ARKit body/depth   │
│  - UI analisi           │◄────┤  - ARCore depth       │
│                        │     │  - Registrazione depth│
└─────────────────────────┘     └──────────┬───────────┘
                                           │ frame RGB + depth/pose JSON
                                           ▼
                                ┌──────────────────────┐
                                │  analyzeExercise     │
                                │  (funzione backend)  │
                                │  + dati profondità   │
                                └──────────────────────┘
```

Il modulo nativo è un **plugin Capacitor**. `CameraRecorder` lo avvia e lo ferma insieme al video; il video RGB resta l'input principale e i dati depth vengono aggiunti al payload di `analyzeExercise`.

## Rilevamento capability

`CameraRecorder` controlla `DepthScanner.isAvailable()` e, se il sensore è disponibile, avvia e ferma la scansione depth durante la stessa registrazione del video. Nel browser il plugin restituisce `available: false`: la registrazione video RGB resta utilizzabile senza dati depth.

---

## iOS — ARKit (LiDAR + Body Tracking)

### Requisiti
- iPhone 12 Pro+ o iPad Pro con LiDAR per `sceneDepth`
- iOS 14+ per `ARBodyTrackingConfiguration` (pose 3D del corpo)
- Xcode + CocoaPods

### Configurazione ARKit

```swift
// DepthScannerPlugin.swift
import ARKit
import Capacitor

@objc(DepthScannerPlugin)
class DepthScannerPlugin: CAPPlugin, ARSessionDelegate {
  var session: ARSession?
  var recording = false
  var frameBuffer: [[String: Any]] = []

  func startBodyTracking() {
    guard ARBodyTrackingConfiguration.isSupported else {
      resolveError("Body tracking non supportato su questo dispositivo")
      return
    }
    let config = ARBodyTrackingConfiguration()
    config.frameSemantics = [.bodyDetection]
    if #available(iOS 14.0, *) {
      // LiDAR: richiede world tracking con sceneDepth
      config.frameSemantics.insert(.sceneDepth)
    }
    session = ARSession()
    session?.delegate = self
    session?.run(config)
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard recording else { return }

    // 1. Skeleton 3D (2D proiettato + 3D modello)
    guard let body = frame.bodyAnchor else { return }
    let joints3D = body.skeleton.modelTransforms  // [simd_float4x4] per ogni giuntura

    // 2. Depth (LiDAR) se disponibile
    let depthMap = frame.sceneDepth?.depthMap  // CVPixelBuffer mappa profondità

    // 3. RGB frame
    let capturedImage = frame.capturedImage

    // Salva frame: RGB (JPEG) + joints 3D + depth stats
    let entry: [String: Any] = [
      "timestamp": frame.timestamp,
      "joints": serializeJoints(joints3D),
      "depthRange": depthStats(depthMap),
      "rgbUrl": saveJPEG(capturedImage)
    ]
    frameBuffer.append(entry)
  }
}
```

### Giuntura dello scheletro (ARKit body)
ARKit fornisce 91 giuntura 3D. Per l'analisi biomeccanica le più rilevanti:
- `head`, `neck_1`, `spineShoulder`, `spineChest`, `spineBase`
- `leftShoulder`, `leftElbow`, `leftWrist`, `leftHand`
- `rightShoulder`, `rightElbow`, `rightWrist`, `rightHand`
- `leftHip`, `leftKnee`, `leftAnkle`, `leftFoot`
- `rightHip`, `rightKnee`, `rightAnkle`, `rightFoot`

Queste mappano direttamente sui `joints` del `body_diagram` nel report (`AnalysisReport.body_diagram`), ma in **3D reale** invece di 2D proiettato — il che permette di calcolare angoli articolari veri (es. flessione ginocchio, inclinazione busto) con precisione centimetrica.

---

## Android — ARCore (Depth API)

### Requisiti
- Dispositivo con ToF o depth supportato (ARCore `DepthMode.AUTOMATIC`)
- Android API 24+, ARCore 1.32+
- Android Studio

### Configurazione ARCore

```kotlin
// DepthScannerPlugin.kt
class DepthScannerPlugin : Plugin() {
  private var session: Session? = null
  private var recording = false

  fun startDepthTracking() {
    val config = Config(session)
    config.depthMode = Config.DepthMode.AUTOMATIC
    config.updateMode = Config.UpdateMode.LATEST_CAMERA_FRAME
    session!!.configure(config)
    session!!.resume()
  }

  fun onFrame(frame: Frame) {
    if (!recording) return
    val depthImage = frame.acquireDepthImage16() // Depth16, mm per pixel
    val rgbImage = frame.acquireCameraImage()

    // Skeleton 2D via ML Kit Pose Detection (Android non ha body tracking ARKit-level)
    // ARCore fornisce depth map + RGB → ricostruzione 3D del corpo
    val depthStats = computeDepthStats(depthImage)
    val joints = detectPose(rgbImage) // ML Kit Pose
    saveFrame(rgbImage, depthStats, joints)
  }
}
```

Nota: ARCore non ha un equivalente diretto di `ARBodyTrackingConfiguration`. Si combina:
- **ARCore Depth API** → mappa di profondità reale
- **ML Kit Pose Detection** → 2D joints
- Fusione: proietti i 2D joints sulla depth map per ottenere **3D joints** (x, y, depth → X, Y, Z nel mondo)

---

## Flusso dati verso il backend

Il plugin nativo produce, per ogni frame:
1. **Joints 3D** (array `{ id, x, y, z, confidence }`)
2. **Depth stats** (range min/max/mediana in millimetri)

Il video RGB è registrato da `CameraRecorder` separatamente; i suoi frame vengono caricati e passati come `frameUrls`. La scansione LiDAR/ToF è un'integrazione facoltativa del video, non un sostituto.

Il payload inviato a `analyzeExercise` viene esteso:

```json
{
  "exerciseName": "Squat",
  "macroCategory": "Forza",
  "subcategory": "Lower body",
  "frameUrls": ["https://..."],
  "depthData": {
    "sensorType": "lidar",
    "coordinateSystem": "right_handed_y_up_meters",
    "frames": [
      {
        "timestamp": 1.2,
        "joints3D": [
          { "id": "leftKnee", "x": 0.12, "y": -0.45, "z": 0.8, "confidence": 0.92 }
        ],
        "depthRangeMm": { "min": 320, "max": 2100, "median": 980 }
      }
    ],
    "sensorType": "lidar"
  }
}
```

La funzione `analyzeExercise` accetta già `depthData` opzionale, calcola angoli 3D, arricchisce il diagramma e salva `depth_analysis`/`depth_metadata` nel report. Se `depthData` manca, analizza i frame RGB normalmente.

---

## Plugin Capacitor presente

Struttura attuale del plugin `@moveerai/depth-scanner`:

```
depth-scanner-plugin/
├── Package.swift
├── package.json
├── src/
│   ├── definitions.ts
│   └── index.ts
├── ios/
│   └── DepthScannerPlugin.swift
└── android/
    └── DepthScannerPlugin.kt
    └── build.gradle
```

L'implementazione web restituisce `available: false`. In Capacitor, `CameraRecorder` avvia il plugin insieme al video e allega `depthData` alla registrazione quando il plugin restituisce frame validi.

---

## Lavori residui

1. Provare l'acquisizione su un iPhone 12 Pro con LiDAR e su un Android compatibile con ARCore Depth.
2. Integrare `sceneDepth` iOS con un percorso ARWorldTracking/Vision compatibile con il video, evitando semantiche non supportate da `ARBodyTrackingConfiguration`.
3. Validare scala, assi e proiezione del diagramma sui dispositivi reali.
4. Aggiungere marker anatomici ASIS/patella prima di stimare il Q-angle.

### Limiti noti
- Body tracking ARKit richiede iOS 14+ e iPhone Xs o superiore; LiDAR richiede 12 Pro+
- ARCore Depth API funziona solo su dispositivi con ToF o depth-from-motion (qualità variabile)
- Nessun supporto su desktop/web — il fallback `CameraRecorder` resta per quei casi
- La mappa di profondità non equivale a un modello di forze articolari: i punteggi restano indicatori di deviazione cinematica, non misure cliniche o di carico interno.

La compilazione iOS per simulatore è stata verificata. Per produrre un APK servono Android SDK e Android Studio; per distribuire su iPhone serve il profilo di firma Apple associato al Team Xcode.