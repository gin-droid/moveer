import { useEffect, useRef, useState } from "react";
import { X, Video, VideoOff, RotateCcw, Loader2, Camera, Square, Info, Download, Check, RefreshCw } from "lucide-react";
import DepthScanner from "@moveerai/depth-scanner";

/**
 * CameraRecorder
 * Apre la fotocamera del dispositivo e registra un video breve da analizzare.
 * Preferisce la fotocamera posteriore (facingMode: "environment") che sui
 * dispositivi dotati di sensore LiDAR/ToF beneficia dell'autofocus assistito
 * dalla profondità, migliorando la nitidezza del corpo nello spazio.
 *
 * Nota tecnica: i browser web non espongono direttamente la mappa di profondità
 * dei sensori LiDAR/ToF tramite API standard (getUserMedia restituisce solo RGB).
 * Richiediamo però la massima risoluzione/frame rate disponibili per fornire
 * all'IA il miglior input possibile.
 */
export default function CameraRecorder({ onRecorded, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const depthStartPromiseRef = useRef(Promise.resolve(false));
  const depthRecordingRef = useRef(false);
  const discardOnStopRef = useRef(false);

  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [recorded, setRecorded] = useState(null); // { file, url }
  const [depthAvailable, setDepthAvailable] = useState(false);
  const [depthRecording, setDepthRecording] = useState(false);
  const [depthStatus, setDepthStatus] = useState("");

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facingMode) => {
    setStarting(true);
    setError("");
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Il tuo browser non supporta l'accesso alla fotocamera.");
      }
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Detect whether more than one camera is available (to show flip button)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCams(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch { /* ignore */ }
      setReady(true);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Permesso fotocamera negato. Abilitalo dalle impostazioni del browser.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Nessuna fotocamera disponibile su questo dispositivo.");
      } else {
        setError(err?.message || "Impossibile accedere alla fotocamera.");
      }
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    let active = true;
    DepthScanner.isAvailable()
      .then((result) => { if (active) setDepthAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setDepthAvailable(false); });
    startCamera(facing);
    return () => {
      active = false;
      stopStream();
      if (depthRecordingRef.current) DepthScanner.cancelRecording().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorded) URL.revokeObjectURL(recorded.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setReady(false);
    startCamera(next);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    discardOnStopRef.current = false;
    setDepthStatus("");
    chunksRef.current = [];
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    } catch {
      try {
        rec = new MediaRecorder(streamRef.current);
      } catch {
        setError("Registrazione non supportata su questo browser.");
        return;
      }
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      let nativeDepthData = null;
      const depthStarted = await depthStartPromiseRef.current.catch(() => false);
      if (depthStarted && !discardOnStopRef.current) {
        try {
          const result = await DepthScanner.stopRecording();
          nativeDepthData = result?.depthData || null;
          setDepthStatus(nativeDepthData?.frames?.length ? "Dati LiDAR/ToF acquisiti." : "Nessun frame depth valido; resta disponibile il video.");
        } catch {
          setDepthStatus("Scansione LiDAR/ToF non riuscita; resta disponibile il video.");
        } finally {
          depthRecordingRef.current = false;
          setDepthRecording(false);
        }
      }
      depthStartPromiseRef.current = Promise.resolve(false);
      if (discardOnStopRef.current) return;
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      const ext = (mime || "video/webm").includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `moVeerAI-${Date.now()}.${ext}`, { type: blob.type });
      const url = URL.createObjectURL(file);
      setRecorded({ file, url, depthData: nativeDepthData });
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= 30) stopRecording();
        return s + 1;
      });
    }, 1000);

    depthStartPromiseRef.current = DepthScanner.isAvailable()
      .then(async (availability) => {
        const available = Boolean(availability.available);
        setDepthAvailable(available);
        if (!available) return false;
        try {
          await DepthScanner.startRecording({ maxDurationSec: 30, facing });
          depthRecordingRef.current = true;
          setDepthRecording(true);
          return true;
        } catch {
          setDepthStatus("Video in registrazione; scansione LiDAR/ToF non disponibile.");
          return false;
        }
      })
      .catch(() => {
        setDepthAvailable(false);
        return false;
      });
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const saveToPhone = () => {
    if (!recorded) return;
    const a = document.createElement("a");
    a.href = recorded.url;
    a.download = recorded.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const useForAnalysis = () => {
    if (!recorded) return;
    const file = recorded.file;
    const depthData = recorded.depthData;
    URL.revokeObjectURL(recorded.url);
    setRecorded(null);
    onRecorded?.(file, depthData);
  };

  const closeRecorder = async () => {
    discardOnStopRef.current = true;
    stopRecording();
    try {
      const depthStarted = await depthStartPromiseRef.current.catch(() => false);
      if (depthStarted) await DepthScanner.cancelRecording();
    } catch {
      /* ignore cancellation errors */
    }
    depthRecordingRef.current = false;
    stopStream();
    if (recorded) URL.revokeObjectURL(recorded.url);
    onClose?.();
  };

  const recordAgain = () => {
    if (recorded) {
      URL.revokeObjectURL(recorded.url);
      setRecorded(null);
    }
    setSeconds(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 pt-safe">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="font-display font-semibold text-sm">Registrazione</span>
        </div>
        <button
          onClick={closeRecorder}
          className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          aria-label="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />

        {/* Recording indicator */}
        {recording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-white text-sm font-mono">{fmt(seconds)}</span>
            {depthRecording && <span className="border-l border-white/25 pl-2 text-[11px] text-emerald-200">LiDAR/ToF</span>}
          </div>
        )}

        {/* Flip button */}
        {ready && hasMultipleCams && !recording && (
          <button
            onClick={flipCamera}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Cambia fotocamera"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}

        {/* Starting / error overlay */}
        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-sm">Avvio fotocamera…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
            <VideoOff className="w-10 h-10 text-zinc-600" />
            <p className="text-zinc-300 text-sm max-w-xs">{error}</p>
            <button
              onClick={() => startCamera(facing)}
              className="mt-1 text-sm text-emerald-300 hover:text-emerald-200 font-medium"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Recorded preview + actions */}
        {recorded && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-5 px-6">
            <video
              src={recorded.url}
              controls
              playsInline
              className="max-h-[45vh] max-w-full rounded-xl border border-zinc-800"
            />
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                onClick={saveToPhone}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" /> Salva sul telefono
              </button>
              <button
                onClick={useForAnalysis}
                className="w-full inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm px-4 py-3 rounded-xl transition-colors border border-zinc-700"
              >
                <Check className="w-4 h-4" /> Usa per l'analisi
              </button>
              <button
                onClick={recordAgain}
                className="w-full inline-flex items-center justify-center gap-2 text-zinc-400 hover:text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Registra di nuovo
              </button>
              {depthStatus && <p className="text-center text-xs text-zinc-400">{depthStatus}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {recorded ? (
        <div className="px-4 py-5 pb-safe bg-black" />
      ) : (
      <div className="px-4 py-5 pb-safe bg-black">
        {/* LiDAR/ToF hint */}
        <div className="flex items-start gap-2 mb-4 text-zinc-400 text-xs leading-relaxed">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400/70" />
          <span>
            La registrazione video RGB resta il flusso principale. Nell'app nativa, LiDAR/ToF viene acquisito automaticamente se disponibile.
          </span>
        </div>
        {depthAvailable && !recording && (
          <p className="mb-3 text-center text-[11px] text-emerald-200">Sensore LiDAR/ToF rilevato: acquisizione automatica durante il video.</p>
        )}

        <div className="flex items-center justify-center gap-6">
          {recording ? (
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shadow-lg shadow-rose-500/30"
              aria-label="Ferma registrazione"
            >
              <Square className="w-6 h-6 text-white" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={!ready}
              className="w-16 h-16 rounded-full bg-emerald-400 hover:bg-emerald-300 disabled:bg-zinc-700 disabled:opacity-50 flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/30"
              aria-label="Registra"
            >
              <Video className="w-6 h-6 text-zinc-950" />
            </button>
          )}
        </div>
        <p className="text-center text-xs text-zinc-500 mt-3">
          {recording ? "Tocca per fermare (max 30 secondi)" : "Tocca per iniziare a registrare"}
        </p>
      </div>
      )}
    </div>
  );
}

function pickMime() {
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}