import { useEffect, useRef, useState } from "react";
import { X, Video, VideoOff, RotateCcw, Loader2, Camera, Square, Download, Check, RefreshCw, Pause, Play, ScanLine } from "lucide-react";
import DepthScanner from "@moveerai/depth-scanner";

/**
 * CameraRecorder
 * Registra prima il video RGB. La scansione depth opzionale parte solo dopo
 * aver rilasciato la camera usata dal registratore video.
 */
export default function CameraRecorder({ onRecorded, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const depthTimerRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const depthElapsedSecondsRef = useRef(0);
  const depthScanActiveRef = useRef(false);
  const depthScanStartingRef = useRef(false);
  const discardOnStopRef = useRef(false);

  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [recorded, setRecorded] = useState(null); // { file, url }
  const [depthAvailable, setDepthAvailable] = useState(false);
  const [sensorType, setSensorType] = useState("none");
  const [depthStarting, setDepthStarting] = useState(false);
  const [depthScanning, setDepthScanning] = useState(false);
  const [depthFinalizing, setDepthFinalizing] = useState(false);
  const [depthSeconds, setDepthSeconds] = useState(0);
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
          frameRate: { ideal: 30 },
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
      .then((result) => {
        if (!active) return;
        setDepthAvailable(Boolean(result.available));
        setSensorType(result.sensorType || "none");
        startCamera(facing);
      })
      .catch(() => {
        if (active) {
          setDepthAvailable(false);
          setSensorType("none");
          startCamera(facing);
        }
      });
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (depthTimerRef.current) clearInterval(depthTimerRef.current);
      discardOnStopRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch { /* ignore teardown errors */ }
      }
      if (depthScanActiveRef.current || depthScanStartingRef.current) {
        DepthScanner.cancelRecording().catch(() => {});
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!recorded) return undefined;
    const url = recorded.url;
    return () => URL.revokeObjectURL(url);
  }, [recorded?.url]);

  const flipCamera = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setReady(false);
    startCamera(next);
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setPaused(false);
    setFinalizing(true);
    try {
      recorder.stop();
    } catch {
      setFinalizing(false);
      setError("Impossibile completare il file video. Riprova.");
    }
  };

  const startElapsedTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const next = elapsedSecondsRef.current + 1;
      elapsedSecondsRef.current = next;
      setSeconds(next);
      if (next >= 30) stopRecording();
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current || recording || paused || finalizing) return;
    discardOnStopRef.current = false;
    setError("");
    chunksRef.current = [];
    const requestedMime = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, requestedMime ? { mimeType: requestedMime } : undefined);
    } catch {
      try {
        recorder = new MediaRecorder(streamRef.current);
      } catch {
        setError("Registrazione non supportata su questo dispositivo.");
        return;
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setError("La registrazione video si è interrotta. Riprova.");
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      setFinalizing(false);
      if (discardOnStopRef.current) return;

      const blobType = recorder.mimeType || chunksRef.current.find((chunk) => chunk.type)?.type || requestedMime || "video/mp4";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];
      if (!blob.size) {
        setError("Il dispositivo non ha prodotto dati video. Riprova la registrazione.");
        return;
      }
      const ext = blobType.toLowerCase().includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `moVeerAI-${Date.now()}.${ext}`, { type: blob.type });
      setRecorded({ file, url: URL.createObjectURL(file) });
    };

    recorderRef.current = recorder;
    try {
      recorder.start(1000);
    } catch {
      try {
        recorder.start();
      } catch {
        recorderRef.current = null;
        setError("Impossibile avviare la registrazione su questo dispositivo.");
        return;
      }
    }
    elapsedSecondsRef.current = 0;
    setSeconds(0);
    setPaused(false);
    setRecording(true);
    startElapsedTimer();
  };

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    try {
      recorder.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setPaused(true);
    } catch {
      setError("Impossibile mettere in pausa la registrazione.");
    }
  };

  const resumeRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    try {
      recorder.resume();
      setPaused(false);
      setRecording(true);
      startElapsedTimer();
    } catch {
      setError("Impossibile riprendere la registrazione.");
    }
  };

  const stopDepthScan = async () => {
    if (!depthScanActiveRef.current) return;
    depthScanActiveRef.current = false;
    if (depthTimerRef.current) clearInterval(depthTimerRef.current);
    setDepthScanning(false);
    setDepthFinalizing(true);
    try {
      const result = await DepthScanner.stopRecording();
      const data = result?.depthData;
      const frames = Array.isArray(data?.frames)
        ? data.frames.filter((frame) => Array.isArray(frame.joints3D) && frame.joints3D.length >= 3)
        : [];
      if (frames.length) {
        const depthData = { ...data, frames };
        setRecorded((current) => current ? { ...current, depthData } : current);
        setDepthStatus(`Scansione ${sensorType === "lidar" ? "LiDAR" : "ToF"} completata: ${frames.length} frame validi.`);
      } else {
        setDepthStatus("Nessun frame depth valido. Il video è comunque pronto.");
      }
    } catch {
      setDepthStatus("Scansione depth non riuscita. Il video è comunque pronto.");
    } finally {
      setDepthFinalizing(false);
    }
  };

  const startDepthScan = async () => {
    if (!recorded || !depthAvailable || depthStarting || depthScanning || depthFinalizing || depthScanStartingRef.current || depthScanActiveRef.current) return;
    setDepthStarting(true);
    depthScanStartingRef.current = true;
    depthElapsedSecondsRef.current = 0;
    setDepthSeconds(0);
    setDepthStatus("");
    setReady(false);
    stopStream();
    try {
      await DepthScanner.startRecording({ maxDurationSec: 10, facing: "back" });
      depthScanStartingRef.current = false;
      if (discardOnStopRef.current) {
        await DepthScanner.cancelRecording();
        return;
      }
      depthScanActiveRef.current = true;
      setDepthScanning(true);
      depthTimerRef.current = setInterval(() => {
        const next = depthElapsedSecondsRef.current + 1;
        depthElapsedSecondsRef.current = next;
        setDepthSeconds(next);
        if (next >= 10) stopDepthScan();
      }, 1000);
    } catch {
      depthScanStartingRef.current = false;
      setDepthStatus("Sensore non avviabile. Il video è comunque pronto.");
    } finally {
      setDepthStarting(false);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const saveToPhone = async () => {
    if (!recorded) return;
    try {
      if (navigator.share && navigator.canShare?.({ files: [recorded.file] })) {
        await navigator.share({ files: [recorded.file], title: recorded.file.name });
        return;
      }
    } catch (shareError) {
      if (shareError?.name === "AbortError") return;
    }

    const a = document.createElement("a");
    a.href = recorded.url;
    a.download = recorded.file.name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => a.remove(), 1500);
  };

  const useForAnalysis = () => {
    if (!recorded) return;
    const file = recorded.file;
    const depthData = recorded.depthData;
    setRecorded(null);
    onRecorded?.(file, depthData);
  };

  const closeRecorder = () => {
    discardOnStopRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (depthTimerRef.current) clearInterval(depthTimerRef.current);
    if (depthScanActiveRef.current || depthScanStartingRef.current) {
      DepthScanner.cancelRecording().catch(() => {});
    }
    stopRecording();
    stopStream();
    onClose?.();
  };

  const recordAgain = () => {
    setRecorded(null);
    setSeconds(0);
    elapsedSecondsRef.current = 0;
    setDepthStatus("");
    startCamera(facing);
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
        {(recording || paused) && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full">
            <span className={`w-2.5 h-2.5 rounded-full ${paused ? "bg-amber-400" : "bg-rose-500 animate-pulse"}`} />
            <span className="text-white text-sm font-mono">{paused ? "PAUSA" : "REC"} {fmt(seconds)}</span>
          </div>
        )}

        {/* Flip button */}
        {ready && hasMultipleCams && !recording && !paused && !recorded && (
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

        {finalizing && !recorded && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-black/70">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-sm">Preparazione video…</span>
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
              {depthAvailable && !depthScanning && !depthStarting && !depthFinalizing && (
                <button
                  onClick={startDepthScan}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-100 font-medium text-sm px-4 py-3 rounded-xl transition-colors border border-emerald-800"
                >
                  <ScanLine className="w-4 h-4" />
                  {recorded.depthData ? "Ripeti scansione depth" : `Scansiona ${sensorType === "lidar" ? "LiDAR" : "ToF"}`}
                </button>
              )}
              {depthScanning && (
                <button
                  onClick={stopDepthScan}
                  className="w-full inline-flex items-center justify-center gap-2 bg-rose-900/70 hover:bg-rose-900 text-white font-medium text-sm px-4 py-3 rounded-xl transition-colors border border-rose-800"
                >
                  <Square className="w-4 h-4" fill="currentColor" /> Termina scansione
                </button>
              )}
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

        {(depthStarting || depthScanning || depthFinalizing) && (
          <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-white text-sm font-semibold">
              {depthStarting ? "Avvio sensore depth…" : depthFinalizing ? "Elaborazione frame depth…" : "Scansione depth in corso"}
            </p>
            {depthScanning && (
              <>
                <p className="text-zinc-300 text-xs max-w-xs">
                  Scansione separata dal video. Ripeti il movimento per 10 secondi mantenendo il corpo nell’inquadratura.
                </p>
                <p className="text-emerald-200 text-sm font-mono">{fmt(depthSeconds)} / 00:10</p>
                <button
                  onClick={stopDepthScan}
                  className="mt-2 inline-flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm px-5 py-3 rounded-xl"
                >
                  <Square className="w-4 h-4" fill="currentColor" /> STOP SCANSIONE
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {recorded ? (
        <div className="px-4 py-5 pb-safe bg-black" />
      ) : (
      <div className="px-4 py-5 pb-safe bg-black">
        <div className="flex items-center justify-center gap-5">
          {recording || paused ? (
            <>
              {recording ? (
                <button
                  onClick={pauseRecording}
                  className="w-16 h-16 rounded-full bg-amber-400 hover:bg-amber-300 flex flex-col items-center justify-center gap-1 transition-colors"
                  aria-label="Pausa"
                  title="Pausa"
                >
                  <Pause className="w-5 h-5 text-zinc-950" fill="currentColor" />
                  <span className="text-[10px] font-semibold text-zinc-950">PAUSA</span>
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="w-16 h-16 rounded-full bg-emerald-400 hover:bg-emerald-300 flex flex-col items-center justify-center gap-1 transition-colors"
                  aria-label="Riprendi registrazione"
                  title="Riprendi registrazione"
                >
                  <Play className="w-5 h-5 text-zinc-950" fill="currentColor" />
                  <span className="text-[10px] font-semibold text-zinc-950">RIPRENDI</span>
                </button>
              )}
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex flex-col items-center justify-center gap-1 transition-colors shadow-lg shadow-rose-500/30"
                aria-label="Stop"
                title="Stop"
              >
                <Square className="w-5 h-5 text-white" fill="currentColor" />
                <span className="text-[10px] font-semibold text-white">STOP</span>
              </button>
            </>
          ) : (
            <button
              onClick={startRecording}
              disabled={!ready || finalizing}
              className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-400 disabled:bg-zinc-700 disabled:opacity-50 flex flex-col items-center justify-center gap-1 transition-colors shadow-lg shadow-rose-500/30"
              aria-label="REC"
              title="REC"
            >
              <Video className="w-5 h-5 text-white" />
              <span className="text-[10px] font-semibold text-white">REC</span>
            </button>
          )}
        </div>
        <p className="text-center text-xs text-zinc-500 mt-3">
          {finalizing ? "Preparazione del video…" : paused ? "Registrazione in pausa" : recording ? `Registrazione in corso · max 30 secondi` : "Tocca REC per iniziare"}
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