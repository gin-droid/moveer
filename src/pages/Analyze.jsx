import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Video, Upload, Loader2, ChevronRight, Sparkles, Camera, X } from "lucide-react";
import { validateMediaFile, extractVideoFrames, formatFileSize, isVideoFile } from "@/lib/videoFrames";
import ExercisePicker from "@/components/ExercisePicker";
import CameraRecorder from "@/components/CameraRecorder";
import WearableConnector from "@/components/WearableConnector";
import BottomSelectDrawer from "@/components/BottomSelectDrawer";

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

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Exercise.list("-created_date", 500);
        setExercises(data);
        const pre = params.get("exercise");
        if (pre) setSelectedId(pre);
        const aths = await base44.entities.Athlete.list("-created_date", 500);
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

  const analyze = async () => {
    setError("");
    if (!selected) { setError("Seleziona un esercizio da analizzare."); return; }
    if (!file) { setError("Carica un video o un'immagine della tua esecuzione."); return; }

    setAnalyzing(true);
    setProgressMsg("Preparazione dei frame…");
    try {
      let frameFiles = [];
      if (isVideoFile(file)) {
        setProgressMsg("Estrazione dei frame dal video…");
        frameFiles = await extractVideoFrames(file, 6);
        if (frameFiles.length === 0) {
          throw new Error("Impossibile estrarre frame dal video. Prova con un formato MP4/H.264 più leggero.");
        }
      } else {
        frameFiles = [file];
      }

      setProgressMsg("Caricamento dei frame…");
      const frameUrls = (
        await Promise.all(
          frameFiles.map((ff) =>
           base44.integrations.Core.UploadPublicFile({ file: ff }).then((r) => r.file_url).catch(() => null)
          )
        )
      ).filter(Boolean);
      if (frameUrls.length === 0) {
        throw new Error("Errore nel caricamento dei frame. Riprova.");
      }

      const isVideo = isVideoFile(file);
      const VIDEO_STORE_CAP = 50 * 1024 * 1024;
      let videoUploadPromise = Promise.resolve("");
      if (isVideo && file.size <= VIDEO_STORE_CAP) {
        videoUploadPromise = base44.integrations.Core
          .UploadPublicFile({ file })
          .then((r) => r.file_url || "")
          .catch(() => "");
      }

      setProgressMsg("Analisi biomeccanica in corso…");
      const res = await base44.functions.invoke("analyzeExercise", {
        exerciseName: selected.name,
        macroCategory: selected.macro_category,
        subcategory: selected.subcategory,
        frameUrls,
        notes,
        wearableData: wearableData || null,
        athleteId: selectedAthleteId || null,
      });
      if (res.data?.error) throw new Error(res.data.error);
      const report = res.data?.report;
      if (!report?.id) throw new Error("Risposta non valida dalla funzione di analisi.");

      try {
        const videoUrl = await videoUploadPromise;
        if (videoUrl) {
          await base44.entities.AnalysisReport.update(report.id, { video_url: videoUrl });
        }
      } catch (e) {
        /* non-blocking */
      }

      if (selectedAthleteId) {
        base44.functions.invoke("notifyAthleteReport", {
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
    <div className="flex flex-col items-center gap-5">
      {/* Header centrato */}
      <div className="text-center w-full">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Analizza la tua esecuzione
        </h1>
        <p className="text-zinc-400 mt-1.5 text-xs sm:text-sm leading-relaxed">
          Scegli l'esercizio, carica un video e lascia che l'IA valuti tecnica e postura.
        </p>
      </div>

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
          <div className="text-zinc-500 text-sm text-center py-4">Caricamento catalogo…</div>
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
                className="mt-2 text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 justify-center w-full"
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
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
            >
              <Camera className="w-4 h-4" /> Registra con la fotocamera
            </button>
            <label className="block">
              <div className="relative rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/30 p-5 text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="video/*,image/*,.mp4,.mov,.webm,.m4v,.3gp,.mkv,.avi"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
                <Upload className="w-7 h-7 text-zinc-500 mx-auto mb-1.5" />
                <div className="text-sm text-zinc-300">Seleziona un video</div>
                <div className="text-[11px] text-zinc-600 mt-0.5">MP4 · MOV · WEBM — max 100 MB</div>
              </div>
            </label>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-400/5 overflow-hidden">
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
              <Video className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white font-medium truncate">{file.name}</div>
                <div className="text-[10px] text-zinc-500">{formatFileSize(file.size)}</div>
              </div>
              <label className="text-[11px] text-emerald-300 font-medium cursor-pointer shrink-0">
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
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
        />
      </Section>

      {/* Errore */}
      {error && (
        <div className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 text-center">
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="w-full flex flex-col items-center gap-2 pt-1">
        <button
          onClick={analyze}
          disabled={analyzing}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-semibold text-sm px-5 py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 disabled:shadow-none"
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {progressMsg || "Analisi in corso…"}</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Genera report di analisi</>
          )}
        </button>
        {analyzing && (
          <p className="text-center text-[11px] text-zinc-500">
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

function Section({ label, hint, step, children }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-2.5">
        {step && (
          <span className="w-5 h-5 rounded-full bg-emerald-400/15 text-emerald-300 text-[10px] font-semibold flex items-center justify-center">
            {step}
          </span>
        )}
        <h2 className="font-display font-semibold text-white text-sm">
          {label}
          {hint && <span className="text-zinc-500 font-normal ml-1.5 text-xs">({hint})</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}