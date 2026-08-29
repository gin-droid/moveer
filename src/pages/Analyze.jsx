import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Video, Upload, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { validateMediaFile, extractVideoFrames, formatFileSize, isVideoFile } from "@/lib/videoFrames";
import ExercisePicker from "@/components/ExercisePicker";

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

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Exercise.list("-created_date", 500);
        setExercises(data);
        const pre = params.get("exercise");
        if (pre) setSelectedId(pre);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  // cleanup preview URL on unmount / change
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

  const analyze = async () => {
    setError("");
    if (!selected) { setError("Seleziona un esercizio da analizzare."); return; }
    if (!file) { setError("Carica un video o un'immagine della tua esecuzione."); return; }

    setAnalyzing(true);
    setProgressMsg("Preparazione dei frame…");
    try {
      // 1. Extract frames (if video) or use image directly
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

      // 2. Upload frames (small JPEGs) — needed for the analysis
      setProgressMsg("Caricamento dei frame…");
      const frameUrls = (
        await Promise.all(
          frameFiles.map((ff) =>
            base44.integrations.Core.UploadFile({ file: ff }).then((r) => r.file_url).catch(() => null)
          )
        )
      ).filter(Boolean);
      if (frameUrls.length === 0) {
        throw new Error("Errore nel caricamento dei frame. Riprova.");
      }

      // 3. Kick off the original-video upload in the background (size-capped to avoid
      //    timeouts on big files). It runs concurrently with the analysis and is
      //    attached to the report afterwards — it never blocks the analysis.
      const isVideo = isVideoFile(file);
      const VIDEO_STORE_CAP = 50 * 1024 * 1024; // 50MB
      let videoUploadPromise = Promise.resolve("");
      if (isVideo && file.size <= VIDEO_STORE_CAP) {
        videoUploadPromise = base44.integrations.Core
          .UploadFile({ file })
          .then((r) => r.file_url || "")
          .catch(() => "");
      }

      // 4. Analyze via backend function (frames only — fast)
      setProgressMsg("Analisi biomeccanica in corso…");
      const res = await base44.functions.invoke("analyzeExercise", {
        exerciseName: selected.name,
        macroCategory: selected.macro_category,
        subcategory: selected.subcategory,
        frameUrls,
        notes,
      });
      if (res.data?.error) throw new Error(res.data.error);
      const report = res.data?.report;
      if (!report?.id) throw new Error("Risposta non valida dalla funzione di analisi.");

      // 5. Attach the original video to the report (if the upload finished)
      try {
        const videoUrl = await videoUploadPromise;
        if (videoUrl) {
          await base44.entities.AnalysisReport.update(report.id, { video_url: videoUrl });
        }
      } catch (e) {
        /* non-blocking: the report is still valid without the video */
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Analizza la tua esecuzione</h1>
        <p className="text-zinc-400 mt-2 text-sm">Scegli l'esercizio, carica un video breve (frontale o laterale) e lascia che l'IA valuti tecnica e postura.</p>
      </div>

      {/* Step 1: select exercise */}
      <Step number={1} title="Seleziona l'esercizio">
        {loadingList ? (
          <div className="text-zinc-500 text-sm">Caricamento catalogo…</div>
        ) : (
          <div className="space-y-4">
            <ExercisePicker
              exercises={exercises}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <Link to={`/esercizi/${selected.id}`} className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">
                Dettagli esercizio <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}
      </Step>

      {/* Step 2: upload */}
      <Step number={2} title="Carica il video">
        <label className="block">
          <div className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-colors ${file ? "border-emerald-500/50 bg-emerald-400/5" : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/30"}`}>
            <input type="file" accept="video/*,image/*,.mp4,.mov,.webm,.m4v,.3gp,.mkv,.avi" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
            {file ? (
              <div className="space-y-2">
                <Video className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm text-white font-medium">{file.name}</div>
                <div className="text-xs text-zinc-500">{formatFileSize(file.size)} — clicca per cambiare</div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-zinc-500 mx-auto" />
                <div className="text-sm text-zinc-300">Trascina o seleziona un video</div>
                <div className="text-xs text-zinc-600">MP4, MOV, WEBM — max 100 MB — ripresa laterale o frontale</div>
              </div>
            )}
          </div>
        </label>
        {previewUrl && (
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            {isVideoFile(file) ? (
              <video src={previewUrl} controls className="w-full max-h-72 object-contain bg-black" />
            ) : (
              <img src={previewUrl} alt="Anteprima" className="w-full max-h-72 object-contain bg-black" />
            )}
          </div>
        )}
      </Step>

      {/* Step 3: notes */}
      <Step number={3} title="Note (opzionale)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Es. sento fastidio al ginocchio destro, o fatico a mantenere la schiena dritta…"
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
        />
      </Step>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

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
      {analyzing && <p className="text-center text-xs text-zinc-500">L'analisi può richiedere 20-40 secondi. Non chiudere la pagina.</p>}
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-semibold flex items-center justify-center">{number}</span>
        <h2 className="font-display font-semibold text-white text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}