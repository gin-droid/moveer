import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { appApi } from "@/api/appApi";
import { Activity, Video, Upload, Loader2, ChevronRight, Sparkles, Camera, X } from "lucide-react";
import { validateMediaFile, extractVideoFrames, formatFileSize, isVideoFile } from "@/lib/videoFrames";
import ExercisePicker from "@/components/ExercisePicker";
import CameraRecorder from "@/components/CameraRecorder";
import WearableConnector from "@/components/WearableConnector";
import BottomSelectDrawer from "@/components/BottomSelectDrawer";
import { analyzeDepthData } from "../../supabase/functions/_shared/depth3d";
import DepthScanner from "@moveerai/depth-scanner";

export default function Analyze() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [wearableData, setWearableData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [depthData, setDepthData] = useState(null);
  const [depthAvailability, setDepthAvailability] = useState(null);
  const [depthRecording, setDepthRecording] = useState(false);
  const [depthStatus, setDepthStatus] = useState("");

  useEffect(() => {
    let active = true;
    DepthScanner.isAvailable()
      .then((result) => {
        if (active) setDepthAvailability(result);
      })
      .catch(() => {
        if (active) setDepthAvailability({ available: false, sensorType: "none" });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await appApi.entities.Exercise.list("-created_date", 500);
        setExercises(data);
        const pre = params.get("exercise");
        if (pre) setSelectedId(pre);
        const aths = await appApi.entities.Athlete.list("-created_date", 500);
        setAthletes(aths);
        const preAth = params.get("athlete");
        if (preAth) setSelectedAthleteId(preAth);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selected = useMemo(() => exercises.find((e) => e.id === selectedId), [exercises, selectedId]);

  const handleFile = (f) => {
    setError("");
    const validationError = validateMediaFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
  };

  const startDepthScan = async () => {
    setError("");
    try {
      await DepthScanner.startRecording({ maxDurationSec: 30, facing: "back" });
      setDepthRecording(true);
      setDepthStatus("Scansione in corso: mantieni il corpo intero nell'inquadratura.");
    } catch (err) {
      setDepthRecording(false);
      setDepthStatus("");
      setError(err.message || "Impossibile avviare la scansione LiDAR/ToF.");
    }
  };

  const stopDepthScan = async () => {
    setDepthRecording(false);
    setDepthStatus("Elaborazione della scansione…");
    setError("");
    try {
      const result = await DepthScanner.stopRecording();
      const data = result?.depthData;
      if (!["lidar", "tof"].includes(data?.sensorType) || !Array.isArray(data.frames)) {
        throw new Error("La scansione non ha restituito dati di profondità validi.");
      }
      const analysis = analyzeDepthData(data);
      if (!analysis.validFrameCount) {
        throw new Error("Non sono state rilevate giunzioni 3D affidabili. Riprova mantenendo il corpo intero nell'inquadratura.");
      }
      setDepthData({ ...data, coordinateSystem: data.coordinateSystem || "right_handed_y_up_meters" });
      setDepthStatus(`${data.sensorType.toUpperCase()} · ${analysis.validFrameCount} frame validi`);
    } catch (err) {
      setDepthData(null);
      setDepthStatus("");
      setError(err.message || "Scansione LiDAR/ToF non riuscita.");
    }
  };

  const cancelDepthScan = async () => {
    try {
      if (depthRecording) await DepthScanner.cancelRecording();
    } catch {
      /* ignore cancellation errors */
    }
    setDepthRecording(false);
    setDepthData(null);
    setDepthStatus("");
  };

  const analyze = async () => {
    setError("");
    if (!selected) { setError("Seleziona un esercizio da analizzare."); return; }
    if (!file && !depthData) {
      setError("Carica un video o un'immagine, oppure completa una scansione LiDAR/ToF.");
      return;
    }

    setAnalyzing(true);
    setProgressMsg(file ? "Preparazione dei frame…" : "Preparazione dei dati LiDAR/ToF…");
    try {
      let frameFiles = [];
      if (file && isVideoFile(file)) {
        setProgressMsg("Estrazione dei frame dal video…");
        frameFiles = await extractVideoFrames(file, 6);
        if (frameFiles.length === 0) {
          throw new Error("Impossibile estrarre frame dal video. Prova con un formato MP4/H.264 più leggero.");
        }
      } else if (file) {
        frameFiles = [file];
      }

      if (frameFiles.length > 0) setProgressMsg("Caricamento dei frame…");
      // Upload frames to PRIVATE storage, then create short-lived signed URLs
      // for the LLM vision call (expire in 10 min — long enough for the analysis).
      const frameUris = frameFiles.length ? (
        await Promise.all(
          frameFiles.map((ff) =>
           appApi.integrations.Core.UploadPrivateFile({ file: ff }).then((r) => r.file_uri).catch(() => null)
          )
        )
      ).filter(Boolean) : [];
      if (frameFiles.length > 0 && frameUris.length === 0) {
        throw new Error("Errore nel caricamento dei frame. Riprova.");
      }
      const frameUrls = frameUris.length ? (
        await Promise.all(
          frameUris.map((uri) =>
            appApi.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 600 }).then((r) => r.signed_url).catch(() => null)
          )
        )
      ).filter(Boolean) : [];
      if (frameUris.length > 0 && frameUrls.length === 0) {
        throw new Error("Errore nel caricamento dei frame. Riprova.");
      }

      const isVideo = Boolean(file && isVideoFile(file));
      const VIDEO_STORE_CAP = 50 * 1024 * 1024;
      let videoUploadPromise = Promise.resolve(null);
      if (isVideo && file.size <= VIDEO_STORE_CAP) {
        videoUploadPromise = appApi.integrations.Core
          .UploadPrivateFile({ file })
          .then((r) => r.file_uri || null)
          .catch(() => null);
      }

      setProgressMsg("Analisi biomeccanica in corso…");
      const res = await appApi.functions.invoke("analyzeExercise", {
        exerciseName: selected.name,
        macroCategory: selected.macro_category,
        subcategory: selected.subcategory,
        frameUrls,
        depthData,
        notes,
        wearableData: wearableData || null,
        athleteId: selectedAthleteId || null,
      });
      if (res.data?.error) throw new Error(res.data.error);
      const report = res.data?.report;
      if (!report?.id) throw new Error("Risposta non valida dalla funzione di analisi.");

      try {
        const videoUri = await videoUploadPromise;
        if (videoUri) {
          await appApi.entities.AnalysisReport.update(report.id, { video_uri: videoUri });
        }
      } catch {
        /* non-blocking */
      }

      if (selectedAthleteId) {
        appApi.functions.invoke("notifyAthleteReport", {
          athleteId: selectedAthleteId,
          exerciseName: selected.name,
          reportId: report.id,
          score: report.score,
        }).catch(() => {});
      }

      navigate(`/report/${report.id}`);
    } catch (err) {
      setError(err.message || "Errore durante l'analisi.");
    } finally {
      setAnalyzing(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 shadow-lg shadow-primary/10">
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary/15 rounded-full blur-2xl z-0 pointer-events-none" />
        <div className="relative z-10 text-center">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Video className="w-3.5 h-3.5" /> Analisi IA
          </span>
          <h1 className="mt-2.5 font-display text-2xl font-semibold tracking-tight text-foreground leading-tight">
            Analizza la tua esecuzione
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            Scegli l'esercizio, carica un video e lascia che l'IA valuti tecnica e postura.
          </p>
        </div>
      </section>

      {/* Atleta */}
      <Section label="Atleta / Cliente" hint="opzionale">
        <BottomSelectDrawer
          value={selectedAthleteId}
          onChange={setSelectedAthleteId}
          title="Seleziona atleta"
          placeholder="— Analisi libera —"
          options={[
            { value: "", label: "Analisi libera (nessun atleta)" },
            ...athletes.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </Section>

      {/* Esercizio */}
      <Section label="Esercizio" step={1}>
        {loadingList ? (
          <div className="text-muted-foreground text-sm text-center py-4">Caricamento catalogo…</div>
        ) : (
          <>
            <ExercisePicker
              exercises={exercises}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <Link
                to={`/esercizi/${selected.id}`}
                className="mt-2 text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 justify-center w-full"
              >
                Dettagli esercizio <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </>
        )}
      </Section>

      {/* Video */}
      <Section label="Video" step={2}>
        {!file ? (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setShowCamera(true)}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/30 font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
            >
              <Camera className="w-4 h-4" /> Registra con la fotocamera
            </button>
            <label className="block">
              <div className="relative rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card p-5 text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="video/*,image/*,.mp4,.mov,.webm,.m4v,.3gp,.mkv,.avi"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
                <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                <div className="text-sm text-foreground">Seleziona un video</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">MP4 · MOV · WEBM — max 100 MB</div>
              </div>
            </label>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 overflow-hidden">
            <div className="relative">
              {isVideoFile(file) ? (
                <video src={previewUrl} controls className="w-full max-h-60 object-contain bg-black" />
              ) : (
                <img src={previewUrl} alt="Anteprima" className="w-full max-h-60 object-contain bg-black" />
              )}
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label="Rimuovi file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 py-2 flex items-center gap-2">
              <Video className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground font-medium truncate">{file.name}</div>
                <div className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</div>
              </div>
              <label className="text-[11px] text-primary font-medium cursor-pointer shrink-0">
                <input
                  type="file"
                  accept="video/*,image/*,.mp4,.mov,.webm,.m4v,.3gp,.mkv,.avi"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
                Cambia
              </label>
            </div>
          </div>
        )}
      </Section>

      <Section label="Scansione LiDAR / ToF" hint="opzionale">
        {depthAvailability?.available && (
          <p className="mb-3 text-xs text-muted-foreground">
            La scansione 3D può essere analizzata da sola. Il video RGB aggiunge osservazioni visive.
          </p>
        )}
        {depthData ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Activity className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">Scansione 3D acquisita</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{depthStatus}</div>
            </div>
            <button
              type="button"
              onClick={cancelDepthScan}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label="Rimuovi scansione 3D"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : depthRecording ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Scansione in corso
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{depthStatus}</p>
            <button
              type="button"
              onClick={stopDepthScan}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Activity className="h-4 w-4" /> Termina scansione
            </button>
          </div>
        ) : depthAvailability === null ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifica sensore di profondità…
          </div>
        ) : depthAvailability.available ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Sensore {depthAvailability.sensorType.toUpperCase()} disponibile. Inquadra il corpo intero, poi avvia la scansione.
            </p>
            <button
              type="button"
              onClick={startDepthScan}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <Camera className="h-4 w-4" /> Avvia scansione 3D
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center">
            <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-foreground">Scansione depth non disponibile</p>
            <p className="mt-1 text-xs text-muted-foreground">
              LiDAR/ToF richiede l'app nativa Capacitor e un dispositivo compatibile. Il browser usa la sola fotocamera RGB.
            </p>
          </div>
        )}
      </Section>

      {/* Wearable */}
      <Section label="Sensori wearable" hint="opzionale" step={3}>
        <WearableConnector onWearableData={setWearableData} />
      </Section>

      {/* Note */}
      <Section label="Note" hint="opzionale" step={4}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Es. fastidio al ginocchio destro, fatica a mantenere la schiena dritta…"
          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
      </Section>

      {/* Errore */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <button
          onClick={analyze}
          disabled={analyzing}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold text-sm px-5 py-3.5 rounded-xl transition-colors shadow-lg shadow-primary/20 disabled:shadow-none"
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {progressMsg || "Analisi in corso…"}</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Genera report di analisi</>
          )}
        </button>
        {analyzing && (
          <p className="text-center text-[11px] text-muted-foreground">
            L'analisi può richiedere 20-40 secondi. Non chiudere la pagina.
          </p>
        )}
      </div>

      {showCamera && (
        <CameraRecorder
          onRecorded={(f) => { handleFile(f); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

/** @param {{label: string, hint?: string, step?: number, children?: import("react").ReactNode}} props */
function Section({ label, hint, step, children }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-2.5">
        {step && (
          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
            {step}
          </span>
        )}
        <h2 className="font-display font-semibold text-foreground text-sm text-center">
          {label}
          {hint && <span className="text-muted-foreground font-normal ml-1.5 text-xs">({hint})</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}