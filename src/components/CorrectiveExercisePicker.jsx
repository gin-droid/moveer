import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appApi";
import { Loader2, Dumbbell, Check, ExternalLink } from "lucide-react";

const normalize = (s) => ({
  exercise_id: s.exercise_id,
  name: s.exercise_name,
  target: s.target_issue,
  sets_reps: s.sets_reps || "",
  why: s.why || "",
});

export default function CorrectiveExercisePicker({ report, onSelectionChange }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const persist = async (ids, sugg) => {
    const arr = (sugg || []).filter((s) => ids.has(s.exercise_id)).map(normalize);
    setSaving(true);
    try {
      await appApi.entities.AnalysisReport.update(report.id, {
        selected_corrective_exercises: arr,
      });
      onSelectionChange?.(arr);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if ((report.issues_detected || []).length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await appApi.functions.invoke("suggestCorrectiveExercises", {
          reportId: report.id,
        });
        if (res.data?.error) throw new Error(res.data.error);
        const sugg = res.data?.suggestions || [];
        if (cancelled) return;
        setSuggestions(sugg);
        const persisted = report.selected_corrective_exercises || [];
        const ids =
          persisted.length > 0
            ? new Set(persisted.map((s) => s.exercise_id))
            : new Set(sugg.map((s) => s.exercise_id));
        setSelectedIds(ids);
        const arr = sugg.filter((s) => ids.has(s.exercise_id)).map(normalize);
        onSelectionChange?.(arr);
      } catch (err) {
        if (!cancelled)
          setError(err.message || "Errore nel caricamento dei suggerimenti.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  const toggle = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    persist(next, suggestions || []);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Generazione suggerimenti mirati dal catalogo…
      </div>
    );
  }

  if (error) {
    return <div className="text-xs text-destructive">{error}</div>;
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Nessun esercizio mirato trovato nel catalogo per i difetti rilevati.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        L'IA ha selezionato dal catalogo gli esercizi migliori per correggere i
        difetti rilevati. Seleziona quali includere nel report PDF.
        {saving && <span className="ml-1 text-primary">· salvataggio…</span>}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {suggestions.map((s) => {
          const checked = selectedIds.has(s.exercise_id);
          return (
            <div
              key={s.exercise_id}
              onClick={() => toggle(s.exercise_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(s.exercise_id);
                }
              }}
              className={`cursor-pointer rounded-xl border p-4 transition-colors select-none ${
                checked
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    checked ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {checked && (
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-medium text-foreground text-sm truncate">
                      {s.exercise_name}
                    </h3>
                  </div>
                  <div className="mt-1 text-xs text-secondary">
                    {s.target_issue}
                  </div>
                  {s.sets_reps && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {s.sets_reps}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {s.why}
                  </p>
                  <Link
                    to={`/esercizi/${s.exercise_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Vedi esercizio <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}