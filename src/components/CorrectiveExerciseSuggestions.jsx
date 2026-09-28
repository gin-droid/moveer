import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Sparkles, Target, ChevronRight, Dumbbell } from "lucide-react";

export default function CorrectiveExerciseSuggestions({ report }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("suggestCorrectiveExercises", { reportId: report.id });
      if (res.data?.error) throw new Error(res.data.error);
      setSuggestions(res.data?.suggestions || []);
    } catch (err) {
      setError(err.message || "Errore nel caricamento dei suggerimenti.");
    } finally {
      setLoading(false);
    }
  };

  if (!suggestions) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-5 text-center">
        <Target className="w-8 h-8 text-emerald-400/70 mx-auto mb-2" />
        <p className="text-sm text-zinc-300 mb-1">Suggerisci esercizi di correzione mirati</p>
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          L'IA analizza i difetti di postura rilevati e seleziona dal catalogo gli esercizi migliori per correggerli.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Analisi in corso…" : "Genera suggerimenti"}
        </button>
        {error && <p className="text-xs text-rose-300 mt-2">{error}</p>}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Nessun esercizio mirato trovato per i difetti rilevati.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {suggestions.map((s, i) => (
        <Link
          key={i}
          to={`/esercizi/${s.exercise_id}`}
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-emerald-500/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="font-medium text-white text-sm truncate">{s.exercise_name}</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0" />
          </div>
          <div className="mt-1.5 text-xs text-amber-300/80">{s.target_issue}</div>
          {s.sets_reps && <div className="mt-1 text-xs text-zinc-500">{s.sets_reps}</div>}
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{s.why}</p>
        </Link>
      ))}
    </div>
  );
}