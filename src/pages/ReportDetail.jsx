import { lazy, Suspense, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { appApi } from "@/api/appApi";
import { AlertTriangle, Lightbulb, Dumbbell, CheckCircle2, Sparkles, Video, Activity, Trash2, Loader2 } from "lucide-react";
import ReportPdfExport from "@/components/ReportPdfExport";
import CorrectiveExercisePicker from "@/components/CorrectiveExercisePicker";
import { cacheReport, getCachedReport } from "@/lib/reportCache";
import BodyDiagram from "@/components/BodyDiagram";
const DepthAnalysisPanel = lazy(() => import("@/components/DepthAnalysisPanel"));
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const sevColor = { Lievo: "text-amber-300 bg-amber-400/10 border-amber-400/20", Moderato: "text-orange-300 bg-orange-400/10 border-orange-400/20", Grave: "text-rose-300 bg-rose-400/10 border-rose-400/20" };

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedCorrective, setSelectedCorrective] = useState([]);

  useEffect(() => {
    (async () => {
      let u = null;
      try {
        u = await appApi.auth.me();
        setUser(u);
      } catch (e) { /* ignore */ }
      try {
        const r = await appApi.entities.AnalysisReport.get(id);
        setReport(r);
        cacheReport(r);
        const isPro = u && (u.plan === "pro" || u.plan === "coach");
        setSelectedCorrective(
          isPro && (r.selected_corrective_exercises || []).length > 0
            ? r.selected_corrective_exercises
            : r.corrective_exercises || []
        );
      } catch (err) {
        const cached = getCachedReport(id);
        if (cached) setReport(cached);
        else console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isProOrCoach = user && (user.plan === "pro" || user.plan === "coach");
  const canShowLogo = isProOrCoach && !!user.logo_url;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await appApi.entities.AnalysisReport.delete(id);
      navigate("/report");
    } catch (err) {
      toast({
        title: "Eliminazione fallita",
        description: "Impossibile eliminare il report. Riprova.",
        variant: "destructive",
      });
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) return <div className="text-zinc-500 text-sm">Caricamento…</div>;
  if (!report) return <div className="text-zinc-500 text-sm">Report non trovato.</div>;

  return (
    <div className="mx-auto w-full min-w-0 max-w-sm space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-6 md:p-8">
        {canShowLogo && (
          <div className="mb-4 flex justify-end">
            <img src={user.logo_url} alt="Logo" className="max-h-16 max-w-[160px] object-contain opacity-90" />
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <ScoreRing score={report.score} big />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">{report.macro_category} / {report.subcategory}</div>
            <h1 className="mt-1 font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">{report.exercise_name}</h1>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{report.summary}</p>
          </div>
        </div>
      </div>

      {/* Diagramma corporeo */}
      {report.body_diagram && (
        <Section icon={Activity} title="Mappa posturale & stress articolare">
          <BodyDiagram diagram={report.body_diagram} gender={report.gender || "maschio"} />
        </Section>
      )}

      {report.depth_analysis && (
        <Section icon={Activity} title="Misure cinematiche 3D">
          <Suspense fallback={<div className="text-zinc-500 text-sm">Caricamento visualizzazione 3D...</div>}>
            <DepthAnalysisPanel analysis={report.depth_analysis} />
          </Suspense>
        </Section>
      )}

      {/* Issues */}
      {(report.issues_detected || []).length > 0 && (
        <Section icon={AlertTriangle} title="Problemi rilevati">
          <div className="space-y-3">
            {report.issues_detected.map((iss, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium text-white text-sm">{iss.title}</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sevColor[iss.severity] || sevColor.Lievo}`}>{iss.severity}</span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-400">{iss.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Corrections */}
      {(report.corrections || []).length > 0 && (
        <Section icon={Lightbulb} title="Correzioni">
          <div className="space-y-3">
            {report.corrections.map((c, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-amber-300/80 uppercase tracking-wide">{c.issue}</div>
                <p className="mt-1 text-sm text-zinc-300">{c.correction}</p>
                {c.cue && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-emerald-300/90 bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span><span className="font-medium">Cue:</span> {c.cue}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Corrective exercises */}
      {(isProOrCoach || (report.corrective_exercises || []).length > 0) && (
        <Section icon={Dumbbell} title="Esercizi correttivi">
          {isProOrCoach ? (
            <CorrectiveExercisePicker
              report={report}
              onSelectionChange={setSelectedCorrective}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(report.corrective_exercises || []).map((ex, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <h3 className="font-medium text-white text-sm">{ex.name}</h3>
                  <div className="mt-1.5 text-xs text-emerald-300/80">{ex.target}</div>
                  <div className="mt-1 text-xs text-zinc-500">{ex.sets_reps}</div>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{ex.why}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Recommendations */}
      {(report.recommendations || []).length > 0 && (
        <Section icon={CheckCircle2} title="Raccomandazioni">
          <ul className="space-y-2.5">
            {report.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/analizza"
          className="inline-flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm px-5 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Video className="w-4 h-4" /> Nuova analisi
        </Link>
        <ReportPdfExport
          report={report}
          logoUrl={canShowLogo ? user.logo_url : null}
          correctiveExercises={selectedCorrective}
        />
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
          className="inline-flex items-center gap-2 border border-zinc-700 hover:border-rose-500/50 text-zinc-300 hover:text-rose-400 font-medium text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Elimina
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        opts={{
          title: "Elimina report",
          description: "Eliminare definitivamente questo report? L'operazione è irreversibile.",
          confirmLabel: "Elimina",
          loading: deleting,
        }}
      />
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-emerald-400" />
        <h2 className="font-display font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ScoreRing({ score, big }) {
  const s = score || 0;
  const color = s >= 75 ? "#34d399" : s >= 50 ? "#fbbf24" : "#fb7185";
  const size = big ? 88 : 56;
  const r = big ? 38 : 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(39 39 42)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-semibold text-white ${big ? "text-2xl" : "text-sm"}`}>{s}</span>
        {big && <span className="text-[10px] text-zinc-500 uppercase tracking-widest">/ 100</span>}
      </div>
    </div>
  );
}