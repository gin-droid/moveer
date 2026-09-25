import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  UserPlus, Loader2, Trash2, ChevronRight, UserCheck, Calendar, Pencil,
  Search, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import PullToRefresh from "@/components/PullToRefresh";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoDialog from "@/components/InfoDialog";
import { differenceInYears, parseISO } from "date-fns";

const emptyForm = { name: "", gender: "", birth_date: "", notes: "" };

export default function Athletes() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("Tutti");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState({ open: false, athlete: null });
  const [deletingId, setDeletingId] = useState(null);
  const [infoState, setInfoState] = useState({ open: false, title: "", description: "" });

  const loadAthletes = async () => {
    try {
      const data = await base44.entities.Athlete.list("-created_date", 500);
      setAthletes(data);
    } catch (err) {
      setError(err.message || "Errore nel caricamento degli atleti.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAthletes();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (athlete) => {
    setForm({
      name: athlete.name || "",
      gender: athlete.gender || "",
      birth_date: athlete.birth_date || "",
      notes: athlete.notes || "",
    });
    setEditingId(athlete.id);
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Il nome è obbligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await base44.entities.Athlete.update(editingId, payload);
      } else {
        await base44.entities.Athlete.create(payload);
      }
      setDialogOpen(false);
      await loadAthletes();
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (athlete) => {
    setConfirmState({ open: true, athlete });
  };

  const handleDelete = async () => {
    const a = confirmState.athlete;
    if (!a) return;
    setDeletingId(a.id);
    try {
      await base44.entities.Athlete.delete(a.id);
      setAthletes((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      setInfoState({
        open: true,
        title: "Eliminazione fallita",
        description: err.message || "Errore durante l'eliminazione dell'atleta.",
      });
    } finally {
      setDeletingId(null);
      setConfirmState({ open: false, athlete: null });
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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return athletes.filter((a) => {
      const okQuery = !q || (a.name || "").toLowerCase().includes(q) || (a.notes || "").toLowerCase().includes(q);
      const okGender = genderFilter === "Tutti" || a.gender === genderFilter;
      return okQuery && okGender;
    });
  }, [athletes, query, genderFilter]);

  const hasActiveFilters = query !== "" || genderFilter !== "Tutti";
  const resetFilters = () => { setQuery(""); setGenderFilter("Tutti"); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <>
      <PullToRefresh onRefresh={loadAthletes}>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Atleti &amp; Clienti</h1>
              <p className="text-zinc-400 mt-2 text-sm">
                Crea i profili dei tuoi atleti per tenere lo storico delle analisi nel tempo.
              </p>
            </div>
            <button
              onClick={openAdd}
              className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm px-3.5 py-2.5 rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Aggiungi
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome o note…"
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Cancella ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Gender filter chips */}
          <div className="flex flex-wrap gap-2 -mt-1">
            {["Tutti", "maschio", "femmina"].map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  genderFilter === g ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40" : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {g === "Tutti" ? "Tutti" : g === "maschio" ? "Maschi" : "Femmine"}
              </button>
            ))}
          </div>

          {/* Result count + reset */}
          <div className="flex items-center justify-between -mt-1">
            <div className="text-xs text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "atleta" : "atleti"}
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" /> Azzera filtri
              </button>
            )}
          </div>

          {athletes.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <UserCheck className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-1">Nessun atleta creato</p>
              <p className="text-xs text-zinc-600">
                Aggiungi il tuo primo atleta o cliente per iniziare a tracciare le analisi.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500 text-sm">
              Nessun atleta trovato con i filtri attivi.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((a) => {
                const age = getAge(a.birth_date);
                return (
                  <div
                    key={a.id}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-3 hover:border-zinc-700 transition-colors"
                  >
                    <button
                      onClick={() => navigate(`/atleti/${a.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">{a.name}</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          {a.gender && <span>{a.gender === "maschio" ? "M" : "F"}</span>}
                          {age != null && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span>{age} anni</span>
                            </>
                          )}
                          {a.birth_date && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <Calendar className="w-3 h-3" />
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        aria-label="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => requestDelete(a)}
                        disabled={deletingId === a.id}
                        className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                        aria-label="Elimina"
                      >
                        {deletingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => navigate(`/atleti/${a.id}`)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-white transition-colors"
                        aria-label="Apri"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-white">
              {editingId ? "Modifica atleta" : "Nuovo atleta / cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Nome *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Es. Marco Rossi"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
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
                placeholder="Es. infortunio al ginocchio dx, obiettivo forza..."
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
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
                {editingId ? "Salva" : "Crea atleta"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        onConfirm={handleDelete}
        opts={{
          title: "Elimina atleta",
          description: `Eliminare definitivamente "${confirmState.athlete?.name ?? ""}"? I report associati non verranno eliminati ma non risulteranno più collegati a un atleta.`,
          confirmLabel: "Elimina",
          loading: deletingId !== null,
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