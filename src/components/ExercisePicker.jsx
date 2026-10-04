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
        (e.muscle_groups || []).join(" ").toLowerCase().includes(q) ||
        (e.equipment || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q);
      return okMacro && okQuery;
    });
  }, [exercises, activeMacro, query]);

  const selected = exercises.find((e) => e.id === selectedId);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca esercizio, gruppo muscolare…"
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        {/* Macro chips */}
        <div className="scrollbar-hide mt-2.5 flex h-8 min-w-0 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto sm:justify-center">
          {macros.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMacro(m)}
              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                activeMacro === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="h-[35vh] min-h-[220px] max-h-[320px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
            Nessun esercizio trovato.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((e) => {
              const isActive = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className={`min-h-[52px] w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-sidebar-accent active:bg-sidebar-accent"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Dumbbell className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {e.macro_category} / {e.subcategory}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {selected && (
        <div className="px-4 py-3 border-t border-border bg-primary/5">
          <div className="text-[11px] uppercase tracking-widest text-primary/80">
            {selected.macro_category} / {selected.subcategory}
          </div>
          <div className="font-medium text-foreground mt-0.5 text-sm">{selected.name}</div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selected.description}</p>
        </div>
      )}
    </div>
  );
}