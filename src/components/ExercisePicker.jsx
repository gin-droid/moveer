import { useMemo, useState } from "react";
import { Search, ChevronRight, Dumbbell } from "lucide-react";

export default function ExercisePicker({ exercises, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const [activeMacro, setActiveMacro] = useState("Tutti");

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
        (e.subcategory || "").toLowerCase().includes(q) ||
        (e.muscle_groups || []).join(" ").toLowerCase().includes(q);
      return okMacro && okQuery;
    });
  }, [exercises, activeMacro, query]);

  const selected = exercises.find((e) => e.id === selectedId);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca esercizio, gruppo muscolare…"
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        {/* Macro chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {macros.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMacro(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeMacro === m
                  ? "bg-emerald-400 text-zinc-950"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Nessun esercizio trovato.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((e) => {
              const isActive = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-emerald-400/10" : "hover:bg-zinc-800/40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}>
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{e.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {e.macro_category} / {e.subcategory}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {selected && (
        <div className="px-4 py-3 border-t border-zinc-800 bg-emerald-400/5">
          <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">
            {selected.macro_category} / {selected.subcategory}
          </div>
          <div className="font-medium text-white mt-0.5 text-sm">{selected.name}</div>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{selected.description}</p>
        </div>
      )}
    </div>
  );
}