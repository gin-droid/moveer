import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Loader2, Trash2, Pencil, UserCheck, Calendar, Sparkles, FileText,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoDialog from "@/components/InfoDialog";
import { differenceInYears, parseISO, format } from "date-fns";
import { it } from "date-fns/locale";

const emptyForm = { name: "", gender: "", birth_date: "", notes: "" };

export default function AthleteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [infoState, setInfoState] = useState({ open: false, title: "", description: "" });

  const loadAll = async () => {
    try {
      const a = await base44.entities.Athlete.get(id);
      setAthlete(a);
      setForm({
        name: a.name || "",
        gender: a.gender || "",
        birth_date: a.birth_date || "",
        notes: a.notes || "",
      });
      const reps = await base44.entities.AnalysisReport.filter({ athlete_id: id }, "-created_date", 200);
      setReports(reps);
    } catch (err) {
      setError(err.message || "Atleta non trovato.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Il nome è obbligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await base44.entities.Athlete.update(id, {
        name: form.name.trim(),
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        notes: form.notes.trim() || null,
      });
      setAthlete(updated || { ...athlete, ...form });
      setEditOpen(false);
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Athlete.delete(id);
      navigate("/atleti");
    } catch (err) {
      setInfoState({
        open: true,
        title: "Eliminazione fallita",
        description: err.message || "Errore durante l'eliminazione.",
      });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const getAge = (birthDate) => {
    if (!birthDate) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthDate));
    } catch {
      return null;
    }
  };

  const scoreColor = (score) => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 70) return "text-amber-400";
    return "text-rose-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error || "Atleta non trovato."}
        </div>
        <Link to="/atleti" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Torna agli atleti
        </Link>
      </div>
    );
  }

  const age = getAge(athlete.birth_date);

  return (
    <>
      <div className="space-y-5">
        <button
          onClick={() => navigate("/atleti")}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Atleti
        </button>

        {/* Athlete header */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold text-white truncate">{athlete.name}</h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                {athlete.gender && <span>{athlete.gender === "maschio" ? "Maschio" : "Femmina"}</span>}
                {age != null && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span>{age} anni</span>
                  </>
                )}
                {athlete.birth_date && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(athlete.birth_date), "dd MMM yyyy", { locale: it })}
                    </span>
                  </>
                )}
              </div>
              {athlete.notes && (
                <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{athlete.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditOpen(true)}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Modifica"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                aria-label="Elimina"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Link
            to={`/analizza?athlete=${athlete.id}`}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Nuova analisi per {athlete.name.split(" ")[0]}
          </Link>
        </div>

        {/* Report history */}
        <div>
          <h2 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Storico analisi ({reports.length})
          </h2>

          {reports.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
              <p className="text-sm text-zinc-400">Nessuna analisi registrata per questo atleta.</p>
              <p className="text-xs text-zinc-600 mt-1">
                Usa il pulsante "Nuova analisi" per creare il primo report.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  to={`/report/${r.id}`}
                  className="block rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 ${scoreColor(r.score)}`}>
                      <span className="font-display font-bold text-lg tabular-nums">{r.score ?? "—"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{r.exercise_name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {format(new Date(r.created_date), "dd MMM yyyy · HH:mm", { locale: it })}
                      </div>
                      {r.summary && (
                        <div className="text-xs text-zinc-600 mt-1 line-clamp-1">{r.summary}</div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-white">Modifica atleta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Nome *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Genere</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "maschio", label: "Maschio" },
                  { v: "femmina", label: "Femmina" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm({ ...form, gender: form.gender === opt.v ? "" : opt.v })}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      form.gender === opt.v
                        ? "bg-emerald-400/15 text-emerald-300 border-emerald-500/40"
                        : "bg-card text-zinc-400 border-border hover:border-zinc-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Data di nascita</label>
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Note</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            {error && <div className="text-xs text-rose-300">{error}</div>}
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <button type="button" className="px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white border border-border bg-transparent">
                  Annulla
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-400 hover:bg-emerald-300 text-zinc-950 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salva
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        opts={{
          title: "Elimina atleta",
          description: `Eliminare definitivamente "${athlete.name}"? I report associati non verranno eliminati.`,
          confirmLabel: "Elimina",
          loading: deleting,
        }}
      />
      <InfoDialog
        open={infoState.open}
        onOpenChange={(open) => setInfoState((s) => ({ ...s, open }))}
        opts={{ title: infoState.title, description: infoState.description }}
      />
    </>
  );
}