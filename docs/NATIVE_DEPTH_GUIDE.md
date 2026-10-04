# Percorso nativo: scansione profondità LiDAR/ToF

Questa guida descrive il modulo nativo che integra LiDAR su iPhone/iPad Pro e depth ARCore su Android nell'analisi biomeccanica basata sul video RGB.

## Stato implementazione

- `depth3d.ts` normalizza i nomi delle giunzioni, scarta coordinate non finite e punti con confidenza esplicitamente bassa, calcola angoli bilaterali e seleziona frame rappresentativi. Gli angoli inclusi valgono 180° a arto esteso; la flessione anatomica vale 0° in estensione.
- `CameraRecorder` salva prima il video RGB. Solo dopo aver chiuso il flusso camera propone una scansione depth nativa facoltativa di 10 secondi; l'utente ripete il movimento.
- I report con dati depth mostrano misure aggregate e uno scheletro 3D orbitabile. I punti visualizzati sono relativi al bacino e restano espressi in metri.
- Il plugin iOS usa `ARWorldTrackingConfiguration.sceneDepth` per campionare la mappa LiDAR e Vision per rilevare e proiettare le giunzioni 3D. I frame sono campionati al massimo 5 volte al secondo.
- Il plugin Android usa ARCore `LATEST_CAMERA_IMAGE` + ML Kit Pose Detection, campiona al massimo 5 frame/s e unprojecta i landmark sulla depth map usando gli intrinseci della camera.
- Il video RGB resta obbligatorio per il report. La scansione depth usa una sessione camera separata e non è sincronizzata temporalmente col video. Nel browser/PWA i sensori LiDAR/ToF non sono esposti.
- Il pacchetto Capacitor locale e il modulo Gradle Android sono configurati. La shell Android va generata/sincronizzata con i comandi descritti nel README e provata su hardware.

## Perché serve il nativo

Il web (`getUserMedia`) fornisce solo il flusso RGB. I sensori di profondità non sono esposti dai browser. Per ottenere:
- **Mappa di profondità** pixel-per-pixel (LiDAR/ToF)
- **Pose 3D del corpo** (articolazioni in 3D reale, non 2D proiettato)
- **Mesh del corpo** (scansione volumetrica)

è necessario un modulo nativo che invii i dati al backend di analisi esistente.

## Flusso attuale

1. `getUserMedia` e `MediaRecorder` registrano il video RGB con REC, pausa, ripresa e stop.
2. Dopo lo stop, l'utente può avviare una scansione LiDAR/ToF separata. Il flusso RGB viene chiuso prima di avviare ARKit o ARCore, che usano la camera nativa.
3. I frame depth validi vengono allegati al file e inviati come dato supplementare a `analyzeExercise`; il video resta il riferimento principale.

La scansione è opzionale e non è sincronizzata col video: per ora l'utente ripete il movimento durante la fase depth. Un'acquisizione sincronizzata richiederebbe un unico registratore nativo che produca RGB e depth dalla stessa sessione.

## Rilevamento capability

`CameraRecorder` controlla `DepthScanner.isAvailable()` e mostra la scansione solo su app native compatibili. Il sensore parte esclusivamente dopo il completamento del video; un errore depth non annulla né modifica il file RGB. Nel browser il plugin restituisce `available: false`.

---

## iOS — ARKit LiDAR + Vision

### Requisiti
- iPhone 12 Pro+ o iPad Pro con LiDAR per `sceneDepth`
- iOS 14+ per `sceneDepth` e Vision body pose
- Xcode + CocoaPods

### LiDAR e pose 3D

Il plugin usa `ARWorldTrackingConfiguration` con il frame semantic `.sceneDepth`. Vision rileva naso, collo, spalle, gomiti, polsi, bacino, anche, ginocchia e caviglie; la depth map LiDAR fornisce la distanza per proiettare i punti 2D in coordinate 3D. Le statistiche min/max/mediana sono espresse in millimetri. Il codice effettivo è in `native/depth-scanner-plugin/ios/DepthScannerPlugin.swift`.

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
    config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
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

Il video RGB è registrato da `CameraRecorder` separatamente e resta obbligatorio. La scansione LiDAR/ToF è facoltativa e separata; non associare i timestamp depth a quelli RGB come se fossero sincronizzati.

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
          { "id": "spine_base", "x": 0.12, "y": -0.45, "z": 0.8, "confidence": 0.92 },
          { "id": "leftKnee", "x": 0.18, "y": -0.72, "z": 0.82, "confidence": 0.89 },
          { "id": "leftAnkle", "x": 0.20, "y": -0.94, "z": 0.84, "confidence": 0.91 }
        ],
        "depthRangeMm": { "min": 320, "max": 2100, "median": 980 }
      }
    ]
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