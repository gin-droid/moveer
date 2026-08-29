import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, ChevronRight, Video, X } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";

export default function Exercises() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMacro, setActiveMacro] = useState("Tutti");
  const [activeSub, setActiveSub] = useState("Tutti");
  const [query, setQuery] = useState("");

  const loadExercises = async () => {
    try {
      const data = await base44.entities.Exercise.list("-created_date", 500);
      setExercises(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const macros = useMemo(() => ["Tutti", ...new Set(exercises.map((e) => e.macro_category))], [exercises]);
  const subs = useMemo(() => {
    const filtered = activeMacro === "Tutti" ? exercises : exercises.filter((e) => e.macro_category === activeMacro);
    return ["Tutti", ...new Set(filtered.map((e) => e.subcategory).filter(Boolean))];
  }, [activeMacro, exercises]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return exercises.filter((e) => {
      const okMacro = activeMacro === "Tutti" || e.macro_category === activeMacro;
      const okSub = activeSub === "Tutti" || e.subcategory === activeSub;
      const okQuery = !q || (
        e.name.toLowerCase().includes(q) ||
        (e.subcategory || "").toLowerCase().includes(q) ||
        (e.muscle_groups || []).join(" ").toLowerCase().includes(q) ||
        (e.equipment || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q)
      );
      return okMacro && okSub && okQuery;
    });
  }, [exercises, activeMacro, activeSub, query]);

  const diffColor = { Principiante: "text-emerald-300 bg-emerald-400/10", Intermedio: "text-amber-300 bg-amber-400/10", Avanzato: "text-rose-300 bg-rose-400/10" };

  return (
    <PullToRefresh onRefresh={loadExercises}>
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Catalogo esercizi</h1>
        <p className="text-zinc-400 mt-2 text-sm">Sfoglia per macro-categoria e sottocategoria, poi analizza la tua esecuzione.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome, muscolo, attrezzatura…"
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

      {/* Macro chips */}
      <div className="flex flex-wrap gap-2 pb-1">
        {macros.map((m) => (
          <button
            key={m}
            onClick={() => { setActiveMacro(m); setActiveSub("Tutti"); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeMacro === m ? "bg-emerald-400 text-zinc-950" : "bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Sub chips */}
      <div className="flex flex-wrap gap-2 -mt-2 pb-1">
        {subs.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSub(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeSub === s ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Result count */}
      {!loading && (
        <div className="text-xs text-zinc-500 -mt-2">
          {filtered.length} {filtered.length === 1 ? "esercizio" : "esercizi"}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-zinc-500 text-sm">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500 text-sm">
          Nessun esercizio trovato.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((e) => (
            <div key={e.id} className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden hover:border-emerald-500/40 transition-colors flex flex-col min-h-[170px]">
              <div className="p-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest text-emerald-300/80">{e.macro_category}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${diffColor[e.difficulty] || ""}`}>{e.difficulty}</span>
                </div>
                <h3 className="mt-2 font-display font-semibold text-white text-lg">{e.name}</h3>
                <div className="text-xs text-zinc-500 mt-0.5">{e.subcategory}</div>
                <p className="mt-3 text-sm text-zinc-400 line-clamp-3">{e.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(e.muscle_groups || []).slice(0, 3).map((m) => (
                    <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/70 text-zinc-400">{m}</span>
                  ))}
                </div>
              </div>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex items-center gap-2">
                <Link
                  to={`/analizza?exercise=${encodeURIComponent(e.id)}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-400/10 hover:bg-emerald-400 text-emerald-300 hover:text-zinc-950 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors border border-emerald-400/20 hover:border-emerald-400"
                >
                  <Video className="w-4 h-4" /> Analizza
                </Link>
                <Link
                  to={`/esercizi/${e.id}`}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}