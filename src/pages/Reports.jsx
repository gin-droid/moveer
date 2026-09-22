import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { FileText, ArrowRight, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { cacheReportList, getCachedReportList, removeCachedReport } from "@/lib/reportCache";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, id: null });
  const { toast } = useToast();

  const loadReports = async () => {
    try {
      const data = await base44.entities.AnalysisReport.list("-created_date", 100);
      setReports(data);
      cacheReportList(data);
    } catch (err) {
      const cached = getCachedReportList();
      if (cached.length > 0) setReports(cached);
      else console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const requestDelete = (id) => setConfirmState({ open: true, id });

  const handleDelete = async () => {
    const id = confirmState.id;
    if (!id) return;
    setDeletingId(id);
    const previous = reports;
    setReports((prev) => prev.filter((r) => r.id !== id)); // optimistic update
    try {
      await base44.entities.AnalysisReport.delete(id);
      removeCachedReport(id);
    } catch (err) {
      setReports(previous); // revert on failure
      toast({
        title: "Eliminazione fallita",
        description: "Impossibile eliminare il report. Riprova.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setConfirmState({ open: false, id: null });
    }
  };

  return (
    <>
    <PullToRefresh onRefresh={loadReports}>
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">I tuoi report</h1>
        <p className="text-zinc-400 mt-2 text-sm">Cronologia delle analisi e dei punteggi nel tempo.</p>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Caricamento…</div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Nessun report ancora.</p>
          <Link to="/analizza" className="mt-4 inline-flex items-center gap-2 bg-emerald-400 text-zinc-950 font-semibold text-sm px-4 py-2.5 rounded-xl">
            <FileText className="w-4 h-4" /> Avvia la prima analisi
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 hover:border-emerald-500/40 transition-colors min-h-[76px]"
            >
              <Link to={`/report/${r.id}`} className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <ScoreRing score={r.score} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">{r.macro_category} / {r.subcategory}</div>
                  <div className="font-medium text-white mt-0.5 truncate">{r.exercise_name}</div>
                  <p className="text-sm text-zinc-400 line-clamp-1 mt-1">{r.summary}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-300 transition-colors shrink-0" />
              </Link>
              <button
                onClick={() => requestDelete(r.id)}
                disabled={deletingId === r.id}
                title="Elimina report"
                className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors shrink-0"
              >
                {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
    <ConfirmDialog
      open={confirmState.open}
      onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
      onConfirm={handleDelete}
      opts={{
        title: "Elimina report",
        description: "Eliminare definitivamente questo report? L'operazione è irreversibile.",
        confirmLabel: "Elimina",
        loading: deletingId !== null,
      }}
    />
    </>
  );
}

function ScoreRing({ score }) {
  const s = score || 0;
  const color = s >= 75 ? "#34d399" : s >= 50 ? "#fbbf24" : "#fb7185";
  const circ = 2 * Math.PI * 18;
  const offset = circ - (s / 100) * circ;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(39 39 42)" strokeWidth="3.5" />
        <circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">{s}</div>
    </div>
  );
}