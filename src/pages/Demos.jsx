import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Play, ExternalLink, Loader2 } from "lucide-react";
import { hasDemoVideo, youtubeSearchUrl } from "@/lib/videoEmbed";
import DemoModal from "@/components/DemoModal";
import PullToRefresh from "@/components/PullToRefresh";

export default function Demos() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeMacro, setActiveMacro] = useState("Tutti");
  const [selected, setSelected] = useState(null);

  const loadDemos = async () => {
    try {
      setExercises(await base44.entities.Exercise.list("-created_date", 500));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemos();
  }, []);

  const macros = useMemo(
    () => ["Tutti", ...new Set(exercises.map((e) => e.macro_category))],
    [exercises]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return exercises.filter((e) => {
      const okMacro = activeMacro === "Tutti" || e.macro_category === activeMacro;
      const okQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.subcategory || "").toLowerCase().includes(q);
      return okMacro && okQuery;
    });
  }, [exercises, activeMacro, query]);

  return (
    <PullToRefresh onRefresh={loadDemos}>
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Video dimostrativi</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Guarda l'esecuzione corretta di ogni esercizio prima di allenarti o farti analizzare.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca esercizio…"
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
        />
      </div>

      {/* Macro chips */}
      <div className="flex flex-wrap gap-2">
        {macros.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMacro(m)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeMacro === m
                ? "bg-emerald-400 text-zinc-950"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-500 text-sm">Nessun esercizio trovato.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => {
            const demo = hasDemoVideo(e);
            return (
              <div key={e.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col">
                <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">{e.macro_category}</div>
                <h3 className="mt-1 font-display font-semibold text-white">{e.name}</h3>
                <div className="text-xs text-zinc-500 mt-0.5">{e.subcategory}</div>
                <p className="mt-2 text-sm text-zinc-400 line-clamp-2 flex-1">{e.description}</p>
                <div className="mt-4">
                  {demo ? (
                    <button
                      onClick={() => setSelected(e)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-400/10 hover:bg-emerald-400 text-emerald-300 hover:text-zinc-950 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors border border-emerald-400/20 hover:border-emerald-400"
                    >
                      <Play className="w-4 h-4" /> Guarda demo
                    </button>
                  ) : (
                    <a
                      href={youtubeSearchUrl(`${e.name} ${e.macro_category} esecuzione tecnica`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors border border-zinc-700"
                    >
                      <ExternalLink className="w-4 h-4" /> Cerca su YouTube
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DemoModal exercise={selected} onClose={() => setSelected(null)} />
    </div>
    </PullToRefresh>
  );
}