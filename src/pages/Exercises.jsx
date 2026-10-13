import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Search, SlidersHorizontal, Video, X } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { loadPreferredExercises } from "@/lib/exercisePreferences";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function Exercises() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeMacro, setActiveMacro] = useState("Tutti");
  const [activeSub, setActiveSub] = useState("Tutti");
  const [activeDiff, setActiveDiff] = useState("Tutti");
  const [activeMuscle, setActiveMuscle] = useState("Tutti");
  const [activeEquip, setActiveEquip] = useState("Tutti");
  const [query, setQuery] = useState("");
  const [extraFilterSearch, setExtraFilterSearch] = useState("");
  const [extraFiltersOpen, setExtraFiltersOpen] = useState(false);

  const loadExercises = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await loadPreferredExercises(user);
      setExercises(data);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, [user]);

  const macros = useMemo(() => ["Tutti", ...new Set(exercises.map((e) => e.macro_category))], [exercises]);
  const subs = useMemo(() => {
    const filtered = activeMacro === "Tutti" ? exercises : exercises.filter((e) => e.macro_category === activeMacro);
    return ["Tutti", ...new Set(filtered.map((e) => e.subcategory).filter(Boolean))];
  }, [activeMacro, exercises]);

  const muscles = useMemo(() => {
    const filtered = activeMacro === "Tutti" ? exercises : exercises.filter((e) => e.macro_category === activeMacro);
    return ["Tutti", ...new Set(filtered.flatMap((e) => e.muscle_groups || []).filter(Boolean))];
  }, [activeMacro, exercises]);

  const equipments = useMemo(() => {
    const filtered = activeMacro === "Tutti" ? exercises : exercises.filter((e) => e.macro_category === activeMacro);
    return ["Tutti", ...new Set(filtered.map((e) => e.equipment).filter(Boolean))];
  }, [activeMacro, exercises]);

  const difficulties = ["Tutti", "Principiante", "Intermedio", "Avanzato"];

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return exercises.filter((e) => {
      const okMacro = activeMacro === "Tutti" || e.macro_category === activeMacro;
      const okSub = activeSub === "Tutti" || e.subcategory === activeSub;
      const okDiff = activeDiff === "Tutti" || e.difficulty === activeDiff;
      const okMuscle = activeMuscle === "Tutti" || (e.muscle_groups || []).includes(activeMuscle);
      const okEquip = activeEquip === "Tutti" || (e.equipment || "") === activeEquip;
      const okQuery = !q || (
        e.name.toLowerCase().includes(q) ||
        (e.subcategory || "").toLowerCase().includes(q) ||
        (e.muscle_groups || []).join(" ").toLowerCase().includes(q) ||
        (e.equipment || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q)
      );
      return okMacro && okSub && okDiff && okMuscle && okEquip && okQuery;
    });
  }, [exercises, activeMacro, activeSub, activeDiff, activeMuscle, activeEquip, query]);

  const hasActiveFilters = activeMacro !== "Tutti" || activeSub !== "Tutti" || activeDiff !== "Tutti" || activeMuscle !== "Tutti" || activeEquip !== "Tutti" || query !== "";
  const extraFilterGroups = [
    { key: "subcategory", label: "Sottocategoria", options: subs.slice(1), value: activeSub, setValue: setActiveSub },
    { key: "muscle", label: "Gruppo muscolare", options: muscles.slice(1), value: activeMuscle, setValue: setActiveMuscle },
    { key: "equipment", label: "Attrezzatura", options: equipments.slice(1), value: activeEquip, setValue: setActiveEquip },
  ];
  const activeExtraFilterCount = extraFilterGroups.filter((group) => group.value !== "Tutti").length;
  const normalizedExtraSearch = extraFilterSearch.trim().toLocaleLowerCase("it");
  const matchingExtraOptions = extraFilterGroups.flatMap((group) =>
    group.options
      .filter((option) => option.toLocaleLowerCase("it").includes(normalizedExtraSearch))
      .map((option) => ({ ...group, option }))
  );

  const resetFilters = () => {
    setActiveMacro("Tutti");
    setActiveSub("Tutti");
    setActiveDiff("Tutti");
    setActiveMuscle("Tutti");
    setActiveEquip("Tutti");
    setQuery("");
  };

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

      {/* Difficulty chips */}
      <div className="flex flex-wrap gap-2 -mt-2 pb-1">
        {difficulties.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDiff(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeDiff === d ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40" : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Additional searchable filters */}
      {(subs.length > 1 || muscles.length > 1 || equipments.length > 1) && (
        <button
          type="button"
          onClick={() => setExtraFiltersOpen(true)}
          className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-300" />
            Altri filtri
          </span>
          <span className="text-xs text-zinc-500">
            {activeExtraFilterCount > 0 ? `${activeExtraFilterCount} attivi` : "Sottocategoria, muscoli, attrezzatura"}
          </span>
        </button>
      )}

      <Sheet open={extraFiltersOpen} onOpenChange={setExtraFiltersOpen}>
        <SheetContent side="bottom" className="flex max-h-[82vh] max-h-[82dvh] flex-col gap-0 rounded-t-2xl border-zinc-800 bg-zinc-950 p-0 text-white">
          <SheetHeader className="border-b border-zinc-800 px-5 pb-3 pt-5 text-left">
            <SheetTitle className="text-white">Altri filtri</SheetTitle>
          </SheetHeader>
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={extraFilterSearch}
                onChange={(event) => setExtraFilterSearch(event.target.value)}
                placeholder="Cerca sottocategoria, muscolo o attrezzatura…"
                aria-label="Cerca altri filtri"
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500/50"
              />
              {extraFilterSearch && (
                <button
                  type="button"
                  onClick={() => setExtraFilterSearch("")}
                  aria-label="Cancella ricerca filtri"
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {extraFilterGroups.map((group) => {
              const matchingOptions = group.options.filter((option) =>
                option.toLocaleLowerCase("it").includes(normalizedExtraSearch)
              );
              if (group.options.length === 0 || (normalizedExtraSearch && matchingOptions.length === 0)) return null;
              return (
                <section key={group.key} className="mb-4 last:mb-0">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.label}</h3>
                  <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => group.setValue("Tutti")}
                      aria-pressed={group.value === "Tutti"}
                      className="flex min-h-11 w-full items-center justify-between gap-3 bg-zinc-900/40 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900"
                    >
                      Tutti
                      {group.value === "Tutti" && <Check className="h-4 w-4 text-emerald-300" />}
                    </button>
                    {matchingOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => group.setValue(option)}
                        aria-pressed={group.value === option}
                        className="flex min-h-11 w-full items-center justify-between gap-3 bg-zinc-900/40 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900"
                      >
                        <span className="truncate">{option}</span>
                        {group.value === option && <Check className="h-4 w-4 shrink-0 text-emerald-300" />}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {normalizedExtraSearch && matchingExtraOptions.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-500">Nessun filtro corrispondente.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 pb-safe">
            <button
              type="button"
              onClick={() => {
                setActiveSub("Tutti");
                setActiveMuscle("Tutti");
                setActiveEquip("Tutti");
              }}
              className="text-sm text-zinc-400 hover:text-white"
            >
              Azzera selezioni
            </button>
            <button
              type="button"
              onClick={() => setExtraFiltersOpen(false)}
              className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
            >
              Mostra {filtered.length} esercizi
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Result count + reset */}
      {!loading && !loadError && (
        <div className="flex items-center justify-between -mt-2">
          <div className="text-xs text-zinc-500">
            {filtered.length} {filtered.length === 1 ? "esercizio" : "esercizi"}
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
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-zinc-500 text-sm">Caricamento…</div>
      ) : loadError && exercises.length === 0 ? (
        <div role="alert" className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-400 text-sm">
          <p>Catalogo non disponibile. Controlla la connessione e riprova.</p>
          <button
            type="button"
            onClick={loadExercises}
            className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-white hover:border-zinc-500"
          >
            Riprova
          </button>
        </div>
      ) : exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500 text-sm">
          Il catalogo non contiene ancora esercizi.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500 text-sm">
          Nessun esercizio trovato.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {filtered.map((e) => (
            <div key={e.id} className="group mx-auto w-full max-w-[24rem] rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden hover:border-emerald-500/40 transition-colors flex flex-col min-h-[170px]">
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